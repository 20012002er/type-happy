import {
  MEDITATE_SPIRIT,
  RESEARCH_SPIRIT,
  SECLUSION_OUTCOME,
  SECLUSION_POTENTIAL,
  SECLUSION_SEC,
  TEACH_STEP,
  TRAIN_EXP_PER_HOUR,
  TRAIN_SPIRIT_PER_HOUR,
  researchExp,
  researchPotential,
  skillExpForLevel,
  teachPotentialCost,
} from '../constants'
import { npc as npcById, sect as sectById, skill as skillById } from '../data'
import type { Character, WulinSave } from '../types'
import { effectiveAttrs, skillLevelCap } from './character'

export interface SimCtx {
  save: WulinSave
  char: Character
  now: () => number
  rate: () => number
  log: (text: string) => void
}

export interface LevelUpResult {
  levels: number
  capped: boolean
  spent: number
}

/** 给武学加修为经验,自动升级并遵守等级上限 */
export function addSkillExp(char: Character, skillId: string, amount: number): LevelUpResult {
  const st = char.skills[skillId]
  if (!st) return { levels: 0, capped: true, spent: 0 }
  st.exp += amount
  let levels = 0
  const cap = skillLevelCap(char, skillId)
  while (st.level < cap) {
    const cost = skillExpForLevel(st.level)
    if (st.exp < cost) break
    st.exp -= cost
    st.level++
    levels++
  }
  if (st.level >= cap) st.exp = Math.min(st.exp, skillExpForLevel(st.level) - 1)
  return { levels, capped: st.level >= cap, spent: levels }
}

/** 结算练功(懒结算:按时间戳差分) */
export function settleTraining(ctx: SimCtx): void {
  const { save, char } = ctx
  const t = save.training
  if (!t.skill) return
  const now = ctx.now()
  const elapsedH = Math.max(0, (now - t.since) / 3600e3)
  if (elapsedH <= 0) return
  const def = skillById(t.skill)
  if (!def) {
    t.skill = null
    return
  }
  const hoursAffordable = char.spirit / TRAIN_SPIRIT_PER_HOUR
  const used = Math.min(elapsedH, hoursAffordable)
  if (used <= 0) {
    t.skill = null
    ctx.log(`精神耗尽,「${def.name}」的练功中断了。`)
    return
  }
  char.spirit -= used * TRAIN_SPIRIT_PER_HOUR
  const ins = effectiveAttrs(char).ins
  const gain = used * TRAIN_EXP_PER_HOUR * (def.conversion / 50) * (1 + ins / 100) * ctx.rate()
  const r = addSkillExp(char, t.skill, gain)
  t.since = now
  if (r.capped && r.levels > 0) {
    ctx.log(`「${def.name}」练至 ${char.skills[t.skill]?.level} 级,受限于人物等级/基本武学,练功自动中断。`)
    t.skill = null
  }
  if (char.spirit <= 0.5 && t.skill) {
    char.spirit = 0
    t.skill = null
    ctx.log(`精神耗尽,「${def.name}」的练功中断了。`)
  }
}

export function startTraining(ctx: SimCtx, skillId: string): string | null {
  const { char } = ctx
  const def = skillById(skillId)
  if (!def || !char.skills[skillId]) return '尚未习得这门武学'
  if (def.tier === 'basic') return '基本武学需向师傅请教或研读,无法练功'
  if (def.slots.includes('internal')) return '内功需闭关修炼'
  if (char.spirit < TRAIN_SPIRIT_PER_HOUR / 12) return '精神不足,先休息或服用回神丹'
  settleTraining(ctx)
  ctx.save.training = { skill: skillId, since: ctx.now() }
  ctx.log(`开始练功:「${def.name}」,每小时耗精神 ${TRAIN_SPIRIT_PER_HOUR}。`)
  return null
}

export function stopTraining(ctx: SimCtx): void {
  settleTraining(ctx)
  ctx.save.training.skill = null
}

/** 请教:基本武学升级 / 门派武学解锁 / 公共武学习得 */
export function teach(ctx: SimCtx, npcId: string, skillId: string): string | null {
  const { char } = ctx
  const def = skillById(skillId)
  const teacher = npcById(npcId)
  if (!def || !teacher) return '无此武学'
  if (!teacher.teach?.includes(skillId) && !(char.sect && sectById(char.sect)?.skills.includes(skillId) && teacher.id === sectById(char.sect)?.master)) {
    // 门派师傅可教本门全部武学
    const sectOfSkill = def.sect
    const ok = char.sect === sectOfSkill && isSectTeacher(teacher.id, char.sect)
    if (!ok) return `${teacher.name}不会这门武学`
  }
  if (def.tier === 'basic') {
    const st = char.skills[skillId]
    if (!st) {
      char.skills[skillId] = { level: 1, exp: 0, activeUnlocked: false }
      ctx.log(`向${teacher.name}请教,习得「${def.name}」。`)
      return null
    }
    const cap = skillLevelCap(char, skillId)
    if (st.level >= cap) return '已达当前等级上限'
    const cost = teachPotentialCost(st.level)
    if (char.potential < cost) return `潜能不足(需 ${cost})`
    char.potential -= cost
    const before = st.level
    addSkillExp(char, skillId, enoughExpFor(TEACH_STEP, st.level))
    ctx.log(`向${teacher.name}请教「${def.name}」:${before} 级 → ${st.level} 级(潜能 -${cost})。`)
    return null
  }
  // 非基本武学:解锁
  if (char.skills[skillId]) return '已习得这门武学,可通过练功/闭关提升'
  if (def.sect && char.sect !== def.sect) return '这是门派武学,需先入门'
  const { potential, silver, contribution } = def.learn
  if (char.potential < potential) return `潜能不足(需 ${potential})`
  if (char.silver < silver) return `碎银不足(需 ${silver})`
  if (char.contribution < contribution) return `门派贡献不足(需 ${contribution})`
  char.potential -= potential
  char.silver -= silver
  char.contribution -= contribution
  char.skills[skillId] = { level: 1, exp: 0, activeUnlocked: false }
  ctx.log(`正式习得「${def.name}」!`)
  return null
}

function enoughExpFor(levels: number, fromLevel: number): number {
  let sum = 0
  for (let i = 0; i < levels; i++) sum += skillExpForLevel(fromLevel + i)
  return sum + 1
}

function isSectTeacher(npcId: string, sectId: string | null): boolean {
  if (!sectId) return false
  const s = sectById(sectId)
  return s?.master === npcId
}

/** 闭关:提升内功类武学 */
export function startSeclusion(ctx: SimCtx, skillId: string, useGuard: boolean): string | null {
  const { char, save } = ctx
  const def = skillById(skillId)
  if (!def || !char.skills[skillId]) return '尚未习得这门武学'
  if (!def.slots.includes('internal')) return '只有内功可以闭关修炼'
  if (save.seclusion.skill) return '已在闭关中'
  if (char.potential < SECLUSION_POTENTIAL) return `潜能不足(需 ${SECLUSION_POTENTIAL})`
  if (useGuard && !(char.bag['guard-pill'] > 0)) return '没有静心丸'
  if (useGuard) char.bag['guard-pill'] -= 1
  char.potential -= SECLUSION_POTENTIAL
  settleTraining(ctx)
  save.training.skill = null
  save.seclusion = { skill: skillId, since: ctx.now(), totalSec: SECLUSION_SEC / ctx.rate(), guard: useGuard }
  ctx.log(`闭关修炼「${def.name}」,约需 ${fmtDur(save.seclusion.totalSec)}。`)
  return null
}

export function seclusionRemaining(ctx: SimCtx): number {
  const s = ctx.save.seclusion
  if (!s.skill) return 0
  return Math.max(0, s.totalSec - (ctx.now() - s.since) / 1000)
}

/** 结算闭关(完成时开奖) */
export function settleSeclusion(ctx: SimCtx): void {
  const { save, char } = ctx
  const s = save.seclusion
  if (!s.skill) return
  if (seclusionRemaining(ctx) > 0) return
  const def = skillById(s.skill)
  const roll = Math.random()
  const failChance = s.guard ? 0 : SECLUSION_OUTCOME.fail.chance
  const perfectChance = SECLUSION_OUTCOME.perfect.chance + (s.guard ? 0.1 : 0)
  let basic: number
  let art: number
  let label: string
  if (roll < failChance) {
    basic = SECLUSION_OUTCOME.fail.basic
    art = SECLUSION_OUTCOME.fail.art
    label = '走火入魔'
  } else if (roll < failChance + perfectChance) {
    basic = SECLUSION_OUTCOME.perfect.basic
    art = SECLUSION_OUTCOME.perfect.art
    label = '完美出关'
  } else {
    basic = SECLUSION_OUTCOME.normal.basic
    art = SECLUSION_OUTCOME.normal.art
    label = '普通出关'
  }
  if (s.skill === 'bs-internal') {
    art = basic // 闭基本内功时只涨自己
    basic = 0
  }
  if (basic !== 0) adjustLevel(char, 'bs-internal', basic)
  if (art !== 0) adjustLevel(char, s.skill, art)
  ctx.log(`闭关结束——${label}!${def ? `「${def.name}」${art >= 0 ? '+' : ''}${art} 级` : ''}${basic !== 0 ? `,基本内功 ${basic > 0 ? '+' : ''}${basic} 级` : ''}。`)
  save.seclusion = { skill: null, since: 0, totalSec: 0, guard: false }
}

function adjustLevel(char: Character, skillId: string, delta: number): void {
  const st = char.skills[skillId]
  if (!st) return
  const cap = skillLevelCap(char, skillId)
  st.level = Math.max(1, Math.min(cap, st.level + delta))
}

/** 研究:基本武学 ≥500 级后消耗潜能/精神涨修为(公式借鉴原作) */
export function research(ctx: SimCtx, skillId: string): string | null {
  const { char } = ctx
  const def = skillById(skillId)
  if (!def || def.tier !== 'basic') return '只能研究基本武学'
  if (!char.skills[skillId]) return '尚未习得这门武学'
  const ins = effectiveAttrs(char).ins
  const pCost = researchPotential(ins)
  const sCost = RESEARCH_SPIRIT
  if (char.potential < pCost) return `潜能不足(需 ${pCost})`
  if (char.spirit < sCost) return `精神不足(需 ${sCost})`
  if (char.skills[skillId].level >= skillLevelCap(char, skillId)) return '已达等级上限'
  char.potential -= pCost
  char.spirit -= sCost
  const gain = researchExp(ins)
  const r = addSkillExp(char, skillId, gain)
  ctx.log(`研读「${def.name}」有所得:+${gain} 修为${r.levels > 0 ? `,升 ${r.levels} 级` : ''}(潜能 -${pCost},精神 -${sCost})。`)
  return null
}

/** 打坐:疗养伤势;内力超上限运转,永久内力上限 +1(借鉴原作) */
export function meditate(ctx: SimCtx): string | null {
  const { char } = ctx
  if (char.spirit < MEDITATE_SPIRIT) return `精神不足(需 ${MEDITATE_SPIRIT})`
  char.spirit -= MEDITATE_SPIRIT
  const healed = Math.max(5, Math.round(char.injury * 0.25))
  char.injury = Math.max(0, char.injury - healed)
  char.mpGrown += 1
  ctx.log(`打坐行功一个周天:伤势恢复 ${healed},内力上限永久 +1(现 ${char.mpGrown})。`)
  return null
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} 秒`
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟`
  return `${(sec / 3600).toFixed(1)} 小时`
}

export { fmtDur }
