import { BAG_CAP0, BAG_CAP_MAX, REBIRTH_LEVELS, SPOT_EXP_GAIN, SPOT_HP_COST, bagUpgradeCost, expForLevel } from '../constants'
import { CHAPTERS, chapter as chapterOf, itemById, npcById, sectById, skillById } from '../data'
import { persistSave, clearSave } from '../save'
import type {
  ArmorSlot,
  AttrKey,
  Attrs,
  ChapterDef,
  Character,
  Gender,
  NpcDef,
  RoomDef,
  SkillSlot,
  WulinSave,
} from '../types'
import { charLevel, evaluation, newCharacter, panel, spiritMax } from './character'
import { Combat, buildNpc, buildPlayer, type CombatMode } from './combat'
import { idleRate, settleAll, settleOffline, startIdle, stopIdle, type IdleRate, type OfflineReport } from './idle'
import { doDaily, doHarvest, doSectTask, doSignin, kowtow, rollDaily } from './quests'
import {
  addSkillExp,
  meditate,
  research,
  settleSeclusion,
  settleTraining,
  seclusionRemaining,
  startSeclusion,
  startTraining,
  stopTraining,
  teach,
  type SimCtx,
} from './training'
import {
  discipleReady,
  discipleWaitRemaining,
  doRebirth,
  nextRebirthLevel,
  rebirthAvailable,
  rescueChild,
  startRebirthQuest,
  trainDisciple,
} from './inheritance'

/** roomId → 所属章节 */
const ROOM_INDEX = new Map<string, { chapter: ChapterDef; room: RoomDef }>()
for (const ch of CHAPTERS) {
  for (const room of ch.rooms) ROOM_INDEX.set(room.id, { chapter: ch, room })
}

export function spotKey(roomId: string, index: number): string {
  return `${roomId}:train${index}`
}

export function roomOf(roomId: string): { chapter: ChapterDef; room: RoomDef } | undefined {
  return ROOM_INDEX.get(roomId)
}

/** 章节主线 boss 集合(一生只能击败一次,传承后重置) */
const BOSS_IDS = new Set<string>(['rb-judge'])
for (const ch of CHAPTERS) {
  for (const step of ch.quest) if (step.type === 'defeat') BOSS_IDS.add(step.target)
}

export class WulinSim {
  save: WulinSave
  combat: Combat | null = null
  /** 调试/e2e 用时间偏移 */
  timeOffset = 0
  onPersist: () => void

  constructor(save: WulinSave, onPersist?: () => void) {
    this.save = save
    const raw = onPersist ?? (() => persistSave(save))
    this.onPersist = () => {
      if (!this.persistDisabled) raw()
    }
    rollDaily(this.ctxOrThrow())
    // 先离线结算(依赖 lastSeen 差分),再进入常规结算
    this.offlineReport = settleOffline(this.ctxOrThrow()) ?? null
    this.settle()
  }

  offlineReport: OfflineReport | null = null

  now = (): number => Date.now() + this.timeOffset

  rate = (): number => (this.save.settings.pace === 'fast' ? 5 : 1)

  log = (text: string): void => {
    this.save.log.push(text)
    if (this.save.log.length > 60) this.save.log.splice(0, this.save.log.length - 60)
  }

  private ctxOrThrow(): SimCtx {
    const save = this.save
    if (!save.char) {
      // 未建角色时提供惰性上下文(仅用于 rollDaily/settle 空转)
      return {
        save,
        char: EMPTY_CHAR,
        now: this.now,
        rate: this.rate,
        log: this.log,
      }
    }
    return { save, char: save.char, now: this.now, rate: this.rate, log: this.log }
  }

  ctx(): SimCtx | null {
    if (!this.save.char) return null
    return this.ctxOrThrow()
  }

  private requireChar(): Character {
    if (!this.save.char) throw new Error('尚未创建角色')
    return this.save.char
  }

  // ============ 周期性结算 ============
  settle(): void {
    const ctx = this.ctxOrThrow()
    const char = this.save.char
    if (char) {
      const minutes = Math.max(0, (this.now() - this.save.lastSeen) / 60e3)
      char.hp = Math.min(1, char.hp + minutes * 0.02)
    }
    settleAll(ctx)
  }

  fastForward(ms: number): void {
    this.timeOffset += ms
    this.settle()
    this.onPersist()
  }

  // ============ 角色 ============
  createCharacter(name: string, gender: Gender, originId: string, attrs: Attrs, appearance: number, fortune: number): void {
    this.save.char = newCharacter(name, gender, originId, attrs, appearance, fortune)
    this.save.progress = {
      chapter: 'c1',
      room: 'c1-dock',
      questByChapter: {},
      unlocked: ['c1'],
      defeated: [],
      picked: [],
      trains: {},
      flags: {},
      chaptersDone: [],
    }
    this.save.log = []
    this.log(`${name} 踏入江湖,故事从柳叶渡开始。`)
    this.onPersist()
  }

  allocPoint(attr: AttrKey): string | null {
    const char = this.requireChar()
    if (char.attrPoints <= 0) return '没有可分配的属性点'
    char.attrPoints--
    char.rebirthAttrs[attr]++
    return null
  }

  evaluation(): number {
    return evaluation(this.requireChar())
  }

  // ============ 地图探索 ============
  currentChapter(): ChapterDef {
    return chapterOf(this.save.progress.chapter)
  }

  currentRoom(): RoomDef {
    const found = roomOf(this.save.progress.room)
    return found ? found.room : chapterOf(this.save.progress.chapter).rooms[0]
  }

  roomNpcs(room: RoomDef): NpcDef[] {
    const out: NpcDef[] = []
    const char = this.save.char
    for (const id of room.npcs ?? []) {
      const def = npcById.get(id)
      if (!def) continue
      if ((id === 'ye-weiyang' || id === 'ye-shadow') && (!char || char.rebirths < 1)) continue
      if (id === 'rb-child' && this.save.rebirth.stage < 1) continue
      out.push(def)
    }
    return out
  }
  moveTo(roomId: string): string | null {
    const target = roomOf(roomId)
    if (!target) return '去不了那里'
    if (!this.save.progress.unlocked.includes(target.chapter.id)) return '尚未打通前往该处的道路'
    const cur = this.currentRoom()
    if (cur.id !== roomId && !cur.exits.some((e) => e.to === roomId)) {
      // 允许在同章节内任意已访问房间间移动?保持严格:必须相邻
      return '此路不通'
    }
    this.save.progress.room = roomId
    this.save.progress.chapter = target.chapter.id
    return null
  }

  travelTo(chapterId: string): string | null {
    if (!this.save.progress.unlocked.includes(chapterId)) return '尚未游历到该地'
    const ch = chapterOf(chapterId)
    this.save.progress.chapter = ch.id
    this.save.progress.room = ch.start
    return null
  }

  // ============ 房间交互 ============
  pickup(room: RoomDef, index: number): string | null {
    const char = this.requireChar()
    const p = room.pickups?.[index]
    if (!p) return '这里没有东西'
    const key = `${room.id}:${index}`
    if (this.save.progress.picked.includes(key)) return '已经翻找过了'
    if (this.bagCount() >= char.bagCap) return '背包满了'
    char.bag[p.item] = (char.bag[p.item] ?? 0) + (p.count ?? 1)
    this.save.progress.picked.push(key)
    const name = itemById.get(p.item)?.name ?? p.item
    this.log(`翻找${room.name},得到【${name}】×${p.count ?? 1}。`)
    this.advanceQuest('pickup', p.item)
    this.onPersist()
    return null
  }

  trainSpot(room: RoomDef, index: number): string | null {
    const char = this.requireChar()
    const spot = room.train?.[index]
    if (!spot) return '这里没法练功'
    const used = this.save.progress.trains[spotKey(room.id, index)] ?? 0
    if (used >= spot.cap) return '这里的练习已到极限,去请教师傅吧'
    const p = panel(char)
    const effMax = p.hpMax - char.injury
    if (effMax * char.hp <= SPOT_HP_COST + 1) return '气血不足,先疗伤再来'
    char.hp = Math.max(0.02, (effMax * char.hp - SPOT_HP_COST) / effMax)
    const chIdx = chapterOf(this.save.progress.chapter).index || 1
    const gain = Math.round((SPOT_EXP_GAIN + chIdx * 8) * this.rate())
    if (!char.skills[spot.skill]) char.skills[spot.skill] = { level: 1, exp: 0, activeUnlocked: false }
    const cap = Math.min(spot.cap, charLevel(char) + 100)
    const st = char.skills[spot.skill]
    if (st.level >= cap) return `「${skillById.get(spot.skill)?.name}」在此处练不到更高层次了`
    const before = st.level
    addSkillExp(char, spot.skill, gain)
    st.level = Math.min(st.level, cap)
    this.save.progress.trains[spotKey(room.id, index)] = used + 1
    if (st.level > before) this.log(`${spot.label}:「${skillById.get(spot.skill)?.name}」升至 ${st.level} 级。`)
    return null
  }

  gift(npcId: string, itemId: string): string | null {
    const char = this.requireChar()
    const def = npcById.get(npcId)
    if (!def?.gift) return '对方不收礼'
    if (!(char.bag[itemId] > 0)) return '没有这件物品'
    char.bag[itemId] -= 1
    const r = def.gift.reward
    const liked = def.gift.likes.includes(itemId)
    const mult = liked ? 1 : 0.3
    if (r.exp) char.exp += Math.round(r.exp * mult * this.rate())
    if (r.silver) char.silver += Math.round(r.silver * mult)
    if (r.potential) char.potential += Math.round(r.potential * mult)
    if (r.item && liked) char.bag[r.item] = (char.bag[r.item] ?? 0) + 1
    if (r.flag && liked) this.save.progress.flags[r.flag] = true
    char.experience += liked ? 2 : 1
    this.log(liked ? `${def.name}欣然收下【${itemById.get(itemId)?.name}】,对你好感大增。` : `${def.name}客气地收下了,似乎并不太喜欢。`)
    this.onPersist()
    return null
  }

  // ============ 门派 ============
  joinSect(sectId: string): string | null {
    const char = this.requireChar()
    const s = sectById.get(sectId)
    if (!s) return '无此门派'
    if (char.sect) return '已有师门,一世不能改投(传承后可重择)'
    if (s.rebirthOnly && char.rebirths < 1) return '历经传承之人,方得此楼青睐'
    if (s.gender && char.gender !== s.gender) return s.gender === 'male' ? '此派只收男弟子' : '此派只收女弟子'
    if (s.requires) {
      for (const [k, v] of Object.entries(s.requires)) {
        if (char.innate[k as AttrKey] < (v as number)) return `入门需先天${ATTR_NAMES[k as AttrKey]} ${v}`
      }
    }
    char.sect = sectId
    char.contribution = 0
    this.log(`拜入「${s.name}」,自此有师有门。`)
    this.onPersist()
    return null
  }

  // ============ 战斗 ============
  canFight(npcId: string): boolean {
    const def = npcById.get(npcId)
    if (!def?.hostile) return false
    // 传承判官每世只战一次;其余头目可再战(避免提前击败导致主线死锁)
    if (npcId === 'rb-judge') return this.save.rebirth.stage === 1 && !this.save.progress.defeated.includes(npcId)
    return true
  }

  /** 剧情头目是否已击败过(地图上做褪色展示) */
  isDefeatedBoss(npcId: string): boolean {
    return BOSS_IDS.has(npcId) && this.save.progress.defeated.includes(npcId)
  }

  startFight(npcId: string, mode: CombatMode = 'duel'): string | null {
    const char = this.requireChar()
    if (this.combat && !this.combat.state.over) return '正在战斗中'
    const def = npcById.get(npcId)
    if (!def) return '找不到此人'
    if (!def.hostile && mode === 'duel') return '对方并不想与你生死相搏'
    if (!this.canFight(npcId)) return `${def.name}已败,不必再战`
    const err = this.checkLoadout()
    if (err) return err
    const levelOverride = npcId === 'rb-judge' ? (REBIRTH_LEVELS[char.rebirths] ?? 300) + 40 : undefined
    const playerC = buildPlayer(char)
    const p = panel(char)
    const effMax = Math.max(1, p.hpMax - char.injury)
    playerC.injury = char.injury
    playerC.hp = Math.min(effMax, effMax * Math.max(0.05, char.hp))
    const enemyC = buildNpc(def, levelOverride)
    this.combat = new Combat(playerC, enemyC, mode)
    this.combatNpcId = npcId
    this.combatResolved = false
    return null
  }

  combatNpcId: string | null = null
  combatResolved = false

  /** 装备与输出武学的武器匹配检查 */
  checkLoadout(): string | null {
    const char = this.requireChar()
    const outId = char.equipped.output
    if (!outId) return null
    const def = skillById.get(outId)
    if (!def) return null
    const weaponType = char.weapon ? itemById.get(char.weapon)?.weapon?.type ?? null : null
    if (def.weapon === 'fist') {
      if (weaponType) return `「${def.name}」需空手施展,先卸下武器`
    } else if (def.weapon && def.weapon !== weaponType) {
      return `「${def.name}」需手持对应兵刃`
    }
    return null
  }

  tickCombat(dt: number): void {
    if (!this.combat || this.combat.state.over) return
    this.combat.tick(dt)
  }

  fleeCombat(): void {
    this.combat?.flee()
  }

  /** 战斗结束面板关闭时调用:结算奖励/伤势(幂等) */
  finishCombat(): void {
    const combat = this.combat
    const npcId = this.combatNpcId
    if (!combat || !npcId || this.combatResolved) return
    this.combatResolved = true
    const char = this.requireChar()
    const def = npcById.get(npcId)
    const s = combat.state
    const p = panel(char)
    if (s.winner === 'player') {
      // 伤势带回战斗外
      char.injury = Math.min(p.hpMax * 0.6, s.player.injury)
      char.hp = Math.max(0.05, s.player.hp / Math.max(1, p.hpMax - char.injury))
      if (s.mode !== 'spar' && def) {
        const reward = this.npcReward(def, s.mode)
        char.exp += reward.exp
        char.silver += reward.silver
        char.experience += def.level >= 25 ? 5 : 1
        const drops: string[] = []
        for (const d of def.drops ?? []) {
          if (Math.random() < d.chance && this.bagCount() < char.bagCap) {
            char.bag[d.id] = (char.bag[d.id] ?? 0) + 1
            drops.push(itemById.get(d.id)?.name ?? d.id)
          }
        }
        this.log(`击败${def.name}:经验 +${reward.exp},碎银 +${reward.silver}${drops.length > 0 ? `,掉落【${drops.join('】【')}】` : ''}。`)
        if (BOSS_IDS.has(npcId)) this.save.progress.defeated.push(npcId)
        if (npcId === 'rb-judge') rescueChild(this.ctxOrThrow())
        this.advanceQuest('defeat', npcId)
      } else if (def) {
        const exp = Math.round(def.level * 3 * this.rate())
        char.exp += exp
        char.injury = Math.min(p.hpMax * 0.6, s.player.injury * 0.3)
        char.hp = Math.max(0.3, s.player.hp / Math.max(1, p.hpMax))
        this.log(`与${def.name}切磋获胜:经验 +${exp}。`)
      }
      char.prestige += s.mode === 'spar' ? 0 : def && def.level >= 40 ? 3 : 1
    } else if (s.winner === 'enemy') {
      char.injury = Math.min(p.hpMax * 0.75, char.injury + p.hpMax * 0.25)
      char.hp = 0.1
      const ch = chapterOf(this.save.progress.chapter)
      this.save.progress.room = ch.start
      this.log(`不敌${def?.name ?? '对手'},被打伤逃回${ch.title}。伤势不轻,好好调息。`)
    } else if (s.fled) {
      char.injury = Math.min(p.hpMax * 0.6, s.player.injury)
      char.hp = Math.max(0.05, s.player.hp / Math.max(1, p.hpMax - char.injury))
    }
    this.combat = null
    this.combatNpcId = null
    this.onPersist()
  }

  /** NPC 击败奖励(等级差衰减) */
  private npcReward(def: NpcDef, mode: CombatMode): { exp: number; silver: number } {
    const char = this.requireChar()
    const plvl = charLevel(char)
    const isBoss = BOSS_IDS.has(def.id) || !!def.silverReward
    const baseExp = isBoss ? 15 * Math.pow(def.level, 1.9) : 6 * Math.pow(def.level, 1.9)
    const decay = Math.max(0.15, Math.min(1, 1 - (plvl - def.level) / (def.level * 1.5 + 50)))
    const exp = Math.round(baseExp * decay * (def.expReward ?? 1) * this.rate())
    const silver = Math.round((def.silverReward ?? 3 * Math.pow(def.level, 1.5)) * decay * this.rate())
    void mode
    return { exp, silver }
  }

  // ============ 主线推进(步骤集合制:任意顺序完成,全部完成即通关) ============
  completedSteps(chapterId: string): number[] {
    const v = this.save.progress.questByChapter?.[chapterId]
    return Array.isArray(v) ? v : []
  }

  private markStep(chapterId: string, idx: number): void {
    if (!this.save.progress.questByChapter) this.save.progress.questByChapter = {}
    const arr = (this.save.progress.questByChapter[chapterId] ??= [])
    if (!arr.includes(idx)) arr.push(idx)
  }

  questInfo(): { chapter: ChapterDef; done: number; total: number; desc: string | null; finished: boolean } {
    const ch = chapterOf(this.save.progress.chapter)
    const doneArr = this.completedSteps(ch.id)
    const finished = this.save.progress.chaptersDone.includes(ch.id) || doneArr.length >= ch.quest.length
    const nextIdx = ch.quest.findIndex((_, i) => !doneArr.includes(i))
    return {
      chapter: ch,
      done: doneArr.length,
      total: ch.quest.length,
      desc: finished ? null : (ch.quest[nextIdx]?.desc ?? null),
      finished,
    }
  }

  questInfoOf(chapterId: string): { done: number; total: number; finished: boolean } {
    const ch = chapterOf(chapterId)
    const doneArr = this.completedSteps(chapterId)
    const finished = this.save.progress.chaptersDone.includes(chapterId) || doneArr.length >= ch.quest.length
    return { done: doneArr.length, total: ch.quest.length, finished }
  }

  advanceQuest(type: 'defeat' | 'talk' | 'pickup' | 'fetch', target: string): boolean {
    const chId = this.save.progress.chapter
    const ch = chapterOf(chId)
    if (this.save.progress.chaptersDone.includes(chId)) return false
    const doneArr = this.completedSteps(chId)
    const idx = ch.quest.findIndex((s, i) => s.type === type && s.target === target && !doneArr.includes(i))
    if (idx < 0) return false
    const cur = ch.quest[idx]
    const char = this.requireChar()
    if (cur.give) {
      if (cur.give.exp) char.exp += Math.round(cur.give.exp * this.rate())
      if (cur.give.silver) char.silver += Math.round(cur.give.silver * this.rate())
      if (cur.give.potential) char.potential += Math.round(cur.give.potential * this.rate())
      if (cur.give.item) char.bag[cur.give.item] = (char.bag[cur.give.item] ?? 0) + (cur.give.count ?? 1)
    }
    this.markStep(chId, idx)
    this.log(`主线「${ch.title}」推进:${cur.desc}`)
    if (this.completedSteps(chId).length >= ch.quest.length) this.completeChapter(ch)
    this.onPersist()
    return true
  }

  talkTo(npcId: string): string | null {
    const def = npcById.get(npcId)
    if (!def) return '找不到此人'
    const advanced = this.advanceQuest('talk', npcId)
    if (!advanced && def.hostile) return `${def.name}冷冷地盯着你,似乎随时会出手。`
    return null
  }

  private completeChapter(ch: ChapterDef): void {
    if (ch.id === 'rb') return
    const char = this.requireChar()
    char.exp += Math.round(ch.reward.exp * this.rate())
    char.silver += Math.round(ch.reward.silver * this.rate())
    if (ch.reward.potential) char.potential += Math.round(ch.reward.potential * this.rate())
    if (ch.reward.item) char.bag[ch.reward.item] = (char.bag[ch.reward.item] ?? 0) + 1
    if (!this.save.progress.chaptersDone.includes(ch.id)) this.save.progress.chaptersDone.push(ch.id)
    const nextIdx = ch.index + 1
    const next = CHAPTERS.find((c) => c.index === nextIdx)
    if (next && !this.save.progress.unlocked.includes(next.id)) {
      this.save.progress.unlocked.push(next.id)
      this.log(`【${ch.title}】主线完成!奖励:经验 +${Math.round(ch.reward.exp * this.rate())},碎银 +${Math.round(ch.reward.silver * this.rate())}。新地界「${next.title}」已解锁。`)
    } else if (ch.id === 'c10') {
      this.save.progress.flags['volume1-done'] = true
      this.log(`【${ch.title}】主线完成!第一卷《风起青萍》就此落幕。雷万钧临终的话在你心头萦绕:「玄夜楼……不会放过你。」`)
    } else {
      this.log(`【${ch.title}】主线完成!`)
    }
  }

  // ============ 武学/装备/背包 ============
  equipSkill(slot: SkillSlot, skillId: string): string | null {
    const char = this.requireChar()
    const def = skillById.get(skillId)
    if (!def || !char.skills[skillId]) return '尚未习得这门武学'
    if (!def.slots.includes(slot)) return `「${def.name}」不能装备在此处`
    char.equipped[slot] = skillId
    const err = slot === 'output' ? this.checkLoadout() : null
    if (err) {
      // 允许装备但给出提醒
      this.log(`提醒:${err}`)
    }
    this.onPersist()
    return null
  }

  equipWeapon(itemId: string): string | null {
    const char = this.requireChar()
    const def = itemById.get(itemId)
    if (!def || def.kind !== 'weapon') return '这不是武器'
    if (!(char.bag[itemId] > 0)) return '背包里没有这件武器'
    char.bag[itemId] -= 1
    if (char.weapon) char.bag[char.weapon] = (char.bag[char.weapon] ?? 0) + 1
    char.weapon = itemId
    this.onPersist()
    return null
  }

  unequipWeapon(): void {
    const char = this.requireChar()
    if (!char.weapon) return
    char.bag[char.weapon] = (char.bag[char.weapon] ?? 0) + 1
    char.weapon = null
    this.onPersist()
  }

  equipArmor(itemId: string): string | null {
    const char = this.requireChar()
    const def = itemById.get(itemId)
    if (!def?.armor) return '这不是防具'
    if (!(char.bag[itemId] > 0)) return '背包里没有这件防具'
    char.bag[itemId] -= 1
    const slot: ArmorSlot = def.armor.slot
    const old = char.armor[slot]
    if (old) char.bag[old] = (char.bag[old] ?? 0) + 1
    char.armor[slot] = itemId
    this.onPersist()
    return null
  }

  unequipArmor(slot: ArmorSlot): void {
    const char = this.requireChar()
    const old = char.armor[slot]
    if (!old) return
    if (this.bagCount() >= char.bagCap) return
    char.bag[old] = (char.bag[old] ?? 0) + 1
    delete char.armor[slot]
    this.onPersist()
  }

  bagCount(): number {
    const char = this.requireChar()
    return Object.values(char.bag).filter((n) => n > 0).length
  }

  upgradeBag(): string | null {
    const char = this.requireChar()
    if (char.bagCap >= BAG_CAP_MAX) return '背包已扩至上限'
    const cost = bagUpgradeCost(char.bagCap)
    if (char.silver < cost) return `碎银不足(需 ${cost})`
    char.silver -= cost
    char.bagCap += 5
    this.log(`背包扩容至 ${char.bagCap} 格(碎银 -${cost})。`)
    this.onPersist()
    return null
  }

  useItem(itemId: string): string | null {
    const char = this.requireChar()
    const def = itemById.get(itemId)
    if (!def) return '无此物品'
    if (!(char.bag[itemId] > 0)) return '没有这件物品'
    if (def.kind === 'quest' || def.kind === 'material' || def.kind === 'page') {
      if (itemId === 'wuxue-page') return '请在武学页面对具体武学使用残页'
      return '这件物品不能使用'
    }
    if (def.kind === 'weapon' || def.kind === 'armor') return '请直接装备'
    if (itemId === 'guard-pill') return '静心丸需在闭关时勾选使用'
    if (itemId === 'face-water') {
      char.bag[itemId] -= 1
      char.appearance = Math.min(40, char.appearance + 2)
      this.log('洗颜水入水,容貌 +2。')
      this.onPersist()
      return null
    }
    if (itemId === 'bodhi-seed') {
      char.bag[itemId] -= 1
      char.mpGrown += 30
      this.log('菩提子化开,内力上限永久 +30。')
      this.onPersist()
      return null
    }
    const use = def.use
    if (!use) return '这件物品不能使用'
    const p = panel(char)
    if (use.hp || use.injury) {
      if (char.hp >= 1 && char.injury <= 0) return '气血充盈,无需疗伤'
      char.bag[itemId] -= 1
      const effMax = Math.max(1, p.hpMax - char.injury)
      if (use.hp) char.hp = Math.min(1, char.hp + use.hp / effMax)
      if (use.injury) char.injury = Math.max(0, char.injury - use.injury)
      this.log(`服用【${def.name}】,伤势渐愈。`)
    } else if (use.mp) {
      if (this.combat && !this.combat.state.over) {
        char.bag[itemId] -= 1
        this.combat.state.player.mp = Math.min(this.combat.state.player.mpMax * 2, this.combat.state.player.mp + use.mp)
        this.log(`服用【${def.name}】,内力涌动。`)
      } else {
        return '战斗之外内力自足,无需服用'
      }
    } else if (use.spirit) {
      char.bag[itemId] -= 1
      char.spirit = Math.min(spiritMax(char), char.spirit + use.spirit)
      this.log(`服用【${def.name}】,精神一振。`)
    } else if (use.potential) {
      char.bag[itemId] -= 1
      char.potential += use.potential
      this.log(`服用【${def.name}】,潜能 +${use.potential}。`)
    } else if (use.exp) {
      char.bag[itemId] -= 1
      char.exp += Math.round(use.exp * this.rate())
      this.log(`服用【${def.name}】,经验 +${Math.round(use.exp * this.rate())}。`)
    } else if (use.mpMax) {
      char.bag[itemId] -= 1
      char.mpGrown += use.mpMax
      this.log(`服用【${def.name}】,内力上限永久 +${use.mpMax}。`)
    } else {
      return '这件物品不能使用'
    }
    this.onPersist()
    return null
  }

  sell(itemId: string, count = 1): string | null {
    const char = this.requireChar()
    const def = itemById.get(itemId)
    if (!def) return '无此物品'
    if (!(char.bag[itemId] >= count)) return '数量不足'
    if (def.kind === 'quest') return '任务物品不能出售'
    const price = Math.max(1, Math.floor((def.price ?? 10) * 0.5)) * count
    char.bag[itemId] -= count
    char.silver += price
    this.log(`卖出【${def.name}】×${count},碎银 +${price}。`)
    this.onPersist()
    return null
  }

  buy(npcId: string, itemId: string): string | null {
    const char = this.requireChar()
    const def = npcById.get(npcId)
    const entry = def?.shop?.find((s) => s.id === itemId)
    if (!entry) return '这里不卖这个'
    if (char.silver < entry.price) return `碎银不足(需 ${entry.price})`
    if (this.bagCount() >= char.bagCap && !(char.bag[itemId] > 0)) return '背包满了'
    char.silver -= entry.price
    char.bag[itemId] = (char.bag[itemId] ?? 0) + 1
    this.log(`购入【${itemById.get(itemId)?.name}】,碎银 -${entry.price}。`)
    this.onPersist()
    return null
  }

  buySect(itemId: string): string | null {
    const char = this.requireChar()
    const s = char.sect ? sectById.get(char.sect) : undefined
    const entry = s?.shop.find((x) => x.id === itemId)
    if (!s || !entry) return '门派商店没有这个'
    if (char.contribution < entry.cost) return `门派贡献不足(需 ${entry.cost})`
    if (this.bagCount() >= char.bagCap && !(char.bag[itemId] > 0)) return '背包满了'
    char.contribution -= entry.cost
    char.bag[itemId] = (char.bag[itemId] ?? 0) + 1
    this.log(`以 ${entry.cost} 贡献兑得【${itemById.get(itemId)?.name}】。`)
    this.onPersist()
    return null
  }

  /** 使用武学残页 */
  usePage(skillId: string): string | null {
    const char = this.requireChar()
    const def = skillById.get(skillId)
    if (!def?.active) return '这门武学没有可参悟的主动招式'
    const st = char.skills[skillId]
    if (!st) return '尚未习得这门武学'
    if (st.activeUnlocked) return '主动招式已参悟'
    if (!(char.bag['wuxue-page'] > 0)) return '没有武学残页'
    char.bag['wuxue-page'] -= 1
    char.pages[skillId] = (char.pages[skillId] ?? 0) + 1
    if ((char.pages[skillId] ?? 0) >= def.active.pages) {
      st.activeUnlocked = true
      this.log(`残页集齐,参悟出「${def.active.name}」!`)
    } else {
      this.log(`参悟「${def.name}」残页(${char.pages[skillId]}/${def.active.pages})。`)
    }
    this.onPersist()
    return null
  }

  /** 三卷合一,参悟太虚剑典 */
  comprehendTaixu(): string | null {
    const char = this.requireChar()
    for (const id of ['q-taixu-1', 'q-taixu-2', 'q-taixu-3']) {
      if (!(char.bag[id] > 0)) return `还缺一卷残卷(${itemById.get(id)?.name})`
    }
    for (const id of ['q-taixu-1', 'q-taixu-2', 'q-taixu-3']) char.bag[id] -= 1
    char.skills['tx-sword'] = { level: 1, exp: 0, activeUnlocked: false }
    this.log('三卷残篇合璧,剑意冲霄——你参悟了绝世剑典「太虚剑典」!')
    this.onPersist()
    return null
  }

  // ============ 委托:训练/任务/传承 ============
  teach(npcId: string, skillId: string): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    settleTraining(ctx)
    const err = teach(ctx, npcId, skillId)
    if (!err) this.onPersist()
    return err
  }

  startTraining(skillId: string): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = startTraining(ctx, skillId)
    if (!err) this.onPersist()
    return err
  }

  stopTraining(): void {
    const ctx = this.ctx()
    if (ctx) stopTraining(ctx)
    this.onPersist()
  }

  startSeclusion(skillId: string, useGuard: boolean): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = startSeclusion(ctx, skillId, useGuard)
    if (!err) this.onPersist()
    return err
  }

  seclusionRemaining(): number {
    const ctx = this.ctx()
    return ctx ? seclusionRemaining(ctx) : 0
  }

  research(skillId: string): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = research(ctx, skillId)
    if (!err) this.onPersist()
    return err
  }

  meditate(): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    settleSeclusion(ctx)
    const err = meditate(ctx)
    if (!err) this.onPersist()
    return err
  }

  idleRateFor(chapterId: string): IdleRate | null {
    const ctx = this.ctx()
    if (!ctx) return null
    return idleRate(ctx, chapterId)
  }

  startIdle(chapterId: string): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = startIdle(ctx, chapterId)
    if (!err) this.onPersist()
    return err
  }

  stopIdle(): void {
    const ctx = this.ctx()
    if (ctx) stopIdle(ctx)
    this.onPersist()
  }

  doHarvest(id: string): string | null {
    return this.questAction(doHarvest, id)
  }

  doDaily(id: string): string | null {
    return this.questAction(doDaily, id)
  }

  doSignin(): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = doSignin(ctx)
    if (!err) this.onPersist()
    return err
  }

  doSectTask(index: number): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = doSectTask(ctx, index)
    if (!err) this.onPersist()
    return err
  }

  kowtow(): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = kowtow(ctx)
    if (!err) this.onPersist()
    return err
  }

  private questAction(fn: (ctx: SimCtx, id: string) => string | null, id: string): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = fn(ctx, id)
    if (!err) this.onPersist()
    return err
  }

  // ---- 传承 ----
  rebirthAvailable(): boolean {
    const ctx = this.ctx()
    return ctx ? rebirthAvailable(ctx) : false
  }

  nextRebirthLevel(): number | null {
    const ctx = this.ctx()
    return ctx ? nextRebirthLevel(ctx) : null
  }

  startRebirthQuest(): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = startRebirthQuest(ctx)
    if (!err) this.onPersist()
    return err
  }

  trainDisciple(attr: AttrKey): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = trainDisciple(ctx, attr)
    if (!err) this.onPersist()
    return err
  }

  discipleWait(): number {
    const ctx = this.ctx()
    return ctx ? discipleWaitRemaining(ctx) : 0
  }

  discipleReady(): boolean {
    const ctx = this.ctx()
    return ctx ? discipleReady(ctx) : false
  }

  doRebirth(name: string): string | null {
    const ctx = this.ctx()
    if (!ctx) return '尚未创建角色'
    const err = doRebirth(ctx, name)
    if (!err) {
      settleSeclusion(ctx)
      this.combat = null
      this.onPersist()
    }
    return err
  }

  // ============ 存档 ============
  persistDisabled = false

  persist(): void {
    this.onPersist()
  }

  /** 重置存档:禁用回写(避免 pagehide 把旧档写回)并清空 */
  hardReset(): void {
    this.persistDisabled = true
    this.combat = null
    clearSave()
  }

  /** 导入替换前调用:禁用回写,防止旧档覆盖新档 */
  prepareReplace(): void {
    this.persistDisabled = true
    this.combat = null
  }

  level(): number {
    return charLevel(this.requireChar())
  }

  expProgress(): { cur: number; next: number; ratio: number } {
    const char = this.requireChar()
    const lv = charLevel(char)
    const curBase = lv >= 1000 ? expForLevel(1000) : expForLevel(lv)
    const next = expForLevel(Math.min(1000, lv + 1))
    const ratio = lv >= 1000 ? 1 : Math.min(1, (char.exp - curBase) / Math.max(1, next - curBase))
    return { cur: char.exp, next, ratio }
  }
}

const EMPTY_CHAR: Character = {
  name: '',
  gender: 'male',
  origin: 'orphan',
  innate: { arm: 10, agi: 10, bone: 10, ins: 10 },
  rebirthAttrs: { arm: 0, agi: 0, bone: 0, ins: 0 },
  attrPoints: 0,
  appearance: 20,
  fortune: 20,
  exp: 0,
  potential: 0,
  spirit: 120,
  mpGrown: 0,
  injury: 0,
  hp: 1,
  silver: 0,
  bank: 0,
  contribution: 0,
  prestige: 0,
  experience: 0,
  rebirths: 0,
  sect: null,
  skills: {},
  equipped: {},
  pages: {},
  weapon: null,
  armor: {},
  bag: {},
  bagCap: BAG_CAP0,
  autoActive: true,
}

export const ATTR_NAMES: Record<AttrKey, string> = { arm: '臂力', agi: '身法', bone: '根骨', ins: '悟性' }
