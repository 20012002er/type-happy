import { BATTLE, GAUGE_MAX, expForLevel } from '../constants'
import { npc as npcDef, skill as skillDef } from '../data'
import type { ActiveSkill, Attrs, Character, NpcDef, SkillMove } from '../types'
import { panel, type Panel } from './character'

export type CombatMode = 'duel' | 'spar' | 'rebirth'

export interface Combatant {
  name: string
  side: 'player' | 'enemy'
  hp: number
  hpMax: number
  injury: number
  mp: number
  mpMax: number
  gauge: number
  atk: number
  hit: number
  dodge: number
  def: number
  prot: number
  speed: number
  /** 每次攻击附带的加力值 */
  power: number
  /** 加力攻击(每点加力的附加伤害已折算) */
  pAtkPerPower: number
  moves: SkillMove[]
  actives: { def: ActiveSkill; cd: number }[]
  stun: number
  comboStep: number
}

export interface CombatEvent {
  type: 'attack' | 'skill' | 'miss' | 'heal' | 'stun' | 'end'
  side: 'player' | 'enemy'
  move?: string
  damage?: number
  part?: string
  heal?: number
  skill?: string
}

export interface LogEntry {
  text: string
  kind: 'normal' | 'miss' | 'skill' | 'bad' | 'good'
}

export interface CombatState {
  player: Combatant
  enemy: Combatant
  mode: CombatMode
  time: number
  over: boolean
  winner: 'player' | 'enemy' | null
  fled: boolean
  log: LogEntry[]
  events: CombatEvent[]
}

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

function makeCombatant(
  name: string,
  side: 'player' | 'enemy',
  p: Panel,
  moves: SkillMove[],
  actives: ActiveSkill[],
  power: number,
  pAtkPerPower: number,
  hpOverride?: number,
): Combatant {
  const hpMax = hpOverride ?? p.hpMax
  return {
    name,
    side,
    hp: hpMax,
    hpMax,
    injury: 0,
    mp: p.mpMax,
    mpMax: p.mpMax,
    gauge: 0,
    atk: p.atk,
    hit: p.hit,
    dodge: p.dodge,
    def: p.def,
    prot: p.prot,
    speed: p.speed,
    power,
    pAtkPerPower,
    moves: moves.length > 0 ? moves : [{ name: '挥击', atk: 1, dmg: 0, pre: 0.7, post: 0.7 }],
    actives: actives.map((def) => ({ def, cd: 0 })),
    stun: 0,
    comboStep: 0,
  }
}

/** 从玩家角色构建战斗单位 */
export function buildPlayer(char: Character): Combatant {
  const p = panel(char)
  const outId = char.equipped.output ?? 'bs-fist'
  const out = skillDef(outId)
  const actives: ActiveSkill[] = []
  for (const id of [char.equipped.output, char.equipped.internal]) {
    if (!id) continue
    const s = skillDef(id)
    if (s?.active && char.skills[id]?.activeUnlocked) actives.push(s.active)
  }
  const pAtkPerPower = (out?.pAtkCoef ?? 10) * (1 + (char.skills[outId]?.level ?? 1) / 500) * 0.5 * (1 + p.attrs.arm * 0.02)
  return makeCombatant(char.name || '少侠', 'player', p, out?.moves ?? [], actives, p.power, pAtkPerPower)
}

/** NPC → 临时 Character(复用玩家面板公式) */
export function npcAsCharacter(def: NpcDef, levelOverride?: number): Character {
  const level = levelOverride ?? def.level
  const attrs: Attrs = { ...def.attrs }
  const skills: Character['skills'] = {}
  for (const s of def.skills) skills[s.id] = { level: s.level, exp: 0, activeUnlocked: level >= 150 }
  const has = (id: string): boolean => !!skills[id]
  const equipped: Character['equipped'] = {}
  const findSlot = (slot: 'output' | 'internal' | 'lightness' | 'parry'): string | undefined => {
    let best: string | undefined
    let bestLv = -1
    for (const [id, st] of Object.entries(skills)) {
      const sd = skillDef(id)
      if (!sd || !sd.slots.includes(slot)) continue
      if (st.level > bestLv) {
        best = id
        bestLv = st.level
      }
    }
    return best
  }
  equipped.output = findSlot('output') ?? (has('bs-fist') ? 'bs-fist' : undefined)
  equipped.internal = findSlot('internal') ?? (has('bs-internal') ? 'bs-internal' : undefined)
  equipped.lightness = findSlot('lightness') ?? (has('bs-light') ? 'bs-light' : undefined)
  equipped.parry = findSlot('parry') ?? (has('bs-parry') ? 'bs-parry' : undefined)
  if (!skills['bs-internal']) skills['bs-internal'] = { level: Math.round(level * 0.8), exp: 0, activeUnlocked: false }
  if (!skills['bs-light']) skills['bs-light'] = { level: Math.round(level * 0.8), exp: 0, activeUnlocked: false }
  if (!skills['bs-parry']) skills['bs-parry'] = { level: Math.round(level * 0.8), exp: 0, activeUnlocked: false }
  if (!equipped.internal) equipped.internal = 'bs-internal'
  if (!equipped.lightness) equipped.lightness = 'bs-light'
  if (!equipped.parry) equipped.parry = 'bs-parry'
  if (!equipped.output) equipped.output = 'bs-fist'
  if (!skills['bs-fist'] && equipped.output === 'bs-fist') skills['bs-fist'] = { level: Math.round(level * 0.8), exp: 0, activeUnlocked: false }
  return {
    name: def.name,
    gender: def.gender,
    origin: 'npc',
    innate: attrs,
    rebirthAttrs: { arm: 0, agi: 0, bone: 0, ins: 0 },
    attrPoints: 0,
    appearance: 20,
    fortune: 10,
    exp: Math.floor(expForLevel(level) * 0.85),
    potential: 0,
    spirit: 100,
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
    skills,
    equipped,
    pages: {},
    weapon: null,
    armor: {},
    bag: {},
    bagCap: 30,
    autoActive: true,
  }
}

/** 从 NPC 定义构建战斗单位 */
export function buildNpc(def: NpcDef, levelOverride?: number): Combatant {
  const char = npcAsCharacter(def, levelOverride)
  const p = panel(char)
  const outId = char.equipped.output ?? 'bs-fist'
  const out = skillDef(outId)
  const actives: ActiveSkill[] = []
  for (const id of [char.equipped.output, char.equipped.internal]) {
    if (!id) continue
    const s = skillDef(id)
    if (s?.active && char.skills[id]?.activeUnlocked) actives.push(s.active)
  }
  const pAtkPerPower = (out?.pAtkCoef ?? 10) * 0.55
  return makeCombatant(def.title ? `${def.name}` : def.name, 'enemy', p, out?.moves ?? [], actives, def.power, pAtkPerPower, def.hp)
}

export function npcByName(id: string): NpcDef | undefined {
  return npcDef(id)
}

export class Combat {
  state: CombatState

  constructor(player: Combatant, enemy: Combatant, mode: CombatMode = 'duel') {
    this.state = {
      player,
      enemy,
      mode,
      time: 0,
      over: false,
      winner: null,
      fled: false,
      log: [
        {
          text: mode === 'spar' ? `你与${enemy.name}切磋,点到为止。` : `你与${enemy.name}战在一处!`,
          kind: 'normal',
        },
      ],
      events: [],
    }
  }

  private push(text: string, kind: LogEntry['kind'] = 'normal'): void {
    this.state.log.push({ text, kind })
    if (this.state.log.length > 60) this.state.log.splice(0, this.state.log.length - 60)
  }

  flee(): void {
    if (this.state.over) return
    this.state.over = true
    this.state.fled = true
    this.state.winner = null
    this.push('你虚晃一招,跳出圈外逃走了。', 'bad')
    this.state.events.push({ type: 'end', side: 'player' })
  }

  tick(dt: number): void {
    const s = this.state
    if (s.over) return
    s.time += dt
    for (const c of [s.player, s.enemy]) {
      for (const a of c.actives) a.cd = Math.max(0, a.cd - dt)
      if (c.stun > 0) {
        c.stun -= dt
        continue
      }
      c.gauge = Math.min(GAUGE_MAX * 1.5, c.gauge + c.speed * dt)
      this.tryActives(c)
      let guard = 0
      while (!s.over && guard++ < 8) {
        const move = pick(c.moves)
        const cost = move.pre + move.post
        if (c.gauge < cost) {
          c.comboStep = 0
          break
        }
        c.gauge -= cost
        const target = c === s.player ? s.enemy : s.player
        this.attack(c, target, move)
      }
    }
    if (!s.over) {
      if (s.player.hp <= 0) this.finish('enemy')
      else if (s.enemy.hp <= 0) this.finish('player')
    }
  }

  private tryActives(c: Combatant): void {
    const s = this.state
    const target = c === s.player ? s.enemy : s.player
    for (const a of c.actives) {
      if (a.cd > 0 || c.mp < a.def.mp || s.over) continue
      if (a.def.kind === 'heal') {
        const effMax = c.hpMax - c.injury
        if (c.hp > effMax * 0.55) continue
        c.mp -= a.def.mp
        a.cd = a.def.cd
        const heal = Math.min(a.def.power, effMax - c.hp)
        c.hp += heal
        this.push(`${c.name}运转「${a.def.name}」,回复 ${Math.round(heal)} 点气血。`, 'good')
        s.events.push({ type: 'heal', side: c.side, skill: a.def.name, heal: Math.round(heal) })
      } else if (a.def.kind === 'damage') {
        c.mp -= a.def.mp
        a.cd = a.def.cd
        const raw = c.atk * a.def.power
        const dmg = this.mitigate(raw, target)
        this.applyDamage(c, target, dmg, `「${a.def.name}」`, true)
      } else if (a.def.kind === 'control') {
        c.mp -= a.def.mp
        a.cd = a.def.cd
        target.stun = Math.max(target.stun, a.def.power)
        target.gauge = 0
        this.push(`${c.name}施展「${a.def.name}」,${target.name}身形一滞,行动条清零!`, 'skill')
        s.events.push({ type: 'stun', side: c.side, skill: a.def.name })
      }
    }
  }

  private mitigate(raw: number, target: Combatant): number {
    const mult = BATTLE.defK / (BATTLE.defK + target.def + target.prot)
    return Math.max(1, Math.round(raw * mult * (0.9 + Math.random() * 0.2)))
  }

  private attack(c: Combatant, target: Combatant, move: SkillMove): void {
    const s = this.state
    const hitP = clamp(c.hit / (c.hit + target.dodge), 0.2, 0.95)
    if (Math.random() > hitP) {
      this.push(`${c.name}施展「${move.name}」,被${target.name}侧身避过!`, 'miss')
      s.events.push({ type: 'miss', side: c.side, move: move.name })
      return
    }
    // 加力:消耗内力附伤
    const power = Math.min(c.power, Math.max(0, Math.floor(c.mp)))
    c.mp = Math.max(0, c.mp - power)
    const powerDmg = power * c.pAtkPerPower
    const part = pick(BATTLE.parts)
    // PVE 连击:一条黄条内多次出手,伤害按 100%/60%/40% 递减
    const combo = BATTLE.comboScale[Math.min(c.comboStep, BATTLE.comboScale.length - 1)] as number
    c.comboStep++
    const raw = (c.atk * move.atk + move.dmg + powerDmg) * part.mult * combo
    const dmg = this.mitigate(raw, target)
    this.applyDamage(c, target, dmg, `「${move.name}」`, false, part.name)
  }

  private applyDamage(c: Combatant, target: Combatant, dmg: number, moveLabel: string, isSkill: boolean, part?: string): void {
    const s = this.state
    target.hp -= dmg * (1 - BATTLE.injuryRatio)
    target.injury = Math.min(target.hpMax * 0.6, target.injury + dmg * BATTLE.injuryRatio)
    const partText = part ? `(${part})` : ''
    this.push(
      `${c.name}${isSkill ? '施展' : '使出'}${moveLabel}${partText},对${target.name}造成 ${Math.round(dmg)} 点伤害。`,
      isSkill ? 'skill' : c.side === 'enemy' ? 'bad' : 'normal',
    )
    s.events.push({
      type: isSkill ? 'skill' : 'attack',
      side: c.side,
      move: moveLabel,
      damage: Math.round(dmg),
      part,
    })
    if (s.mode === 'spar' && target.hp <= target.hpMax * 0.05) {
      target.hp = Math.max(1, target.hpMax * 0.05)
      this.finish(c.side === 'player' ? 'player' : 'enemy')
    }
  }

  private finish(winner: 'player' | 'enemy'): void {
    const s = this.state
    if (s.over) return
    s.over = true
    s.winner = winner
    if (s.mode === 'spar') {
      this.push(winner === 'player' ? `${s.enemy.name}抱拳:「好功夫,承让!」` : `${s.enemy.name}微微一笑:「留几分力气,下次再来。」`, 'good')
    } else {
      this.push(winner === 'player' ? `${s.enemy.name}倒地不起,你赢了!` : '你眼前一黑,被打倒在地……', winner === 'player' ? 'good' : 'bad')
    }
    s.events.push({ type: 'end', side: winner })
  }
}
