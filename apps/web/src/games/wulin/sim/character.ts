import {
  ATTR_MIN,
  ATTR_TOTAL,
  BASE_HP,
  BASE_MP,
  BASE_SPIRIT,
  BATTLE,
  EVAL_ATTR_W,
  EVAL_REBIRTH,
  EVAL_SKILL_W,
  EXTRA_TOTAL,
  FORTUNE_MAX,
  SPIRIT_MAX_BONUS_PER_REBIRTH,
  levelFromExp,
} from '../constants'
import { originById, skill, itemById } from '../data'
import type { AttrKey, Attrs, Character, Gender } from '../types'

/** 基本武学 → 后天属性映射(每 10 级 +1) */
export const ACQUIRED_MAP: Partial<Record<string, AttrKey>> = {
  'bs-fist': 'arm',
  'bs-light': 'agi',
  'bs-internal': 'bone',
  'bs-read': 'ins',
}

export function charLevel(char: Character): number {
  return levelFromExp(char.exp)
}

export function skillLevel(char: Character, id: string): number {
  return char.skills[id]?.level ?? 0
}

/** 后天属性:基本武学每 10 级 +1 */
export function acquiredAttrs(char: Character): Attrs {
  const out: Attrs = { arm: 0, agi: 0, bone: 0, ins: 0 }
  for (const [sid, key] of Object.entries(ACQUIRED_MAP)) {
    const lv = skillLevel(char, sid)
    if (lv > 0 && key) out[key] += Math.floor(lv / 10)
  }
  return out
}

/** 有效属性 = 先天 + 传承 + 后天/2 */
export function effectiveAttrs(char: Character): Attrs {
  const acq = acquiredAttrs(char)
  return {
    arm: char.innate.arm + char.rebirthAttrs.arm + acq.arm / 2,
    agi: char.innate.agi + char.rebirthAttrs.agi + acq.agi / 2,
    bone: char.innate.bone + char.rebirthAttrs.bone + acq.bone / 2,
    ins: char.innate.ins + char.rebirthAttrs.ins + acq.ins / 2,
  }
}

export function spiritMax(char: Character): number {
  return spiritMaxOf(char.rebirths)
}

export function equippedSkillId(char: Character, slot: 'output' | 'internal' | 'lightness' | 'parry'): string | null {
  return char.equipped[slot] ?? null
}

/** 有效轻功等级 = 基本轻功/2 + 准备轻功 */
function effectiveLightLv(char: Character): number {
  return skillLevel(char, 'bs-light') / 2 + skillLevel(char, char.equipped.lightness ?? '')
}

/** 有效招架等级 = 基本招架/2 + 准备招架 */
function effectiveParryLv(char: Character): number {
  return skillLevel(char, 'bs-parry') / 2 + skillLevel(char, char.equipped.parry ?? '')
}

function internalLv(char: Character): number {
  return skillLevel(char, char.equipped.internal ?? '')
}

export interface Panel {
  level: number
  atk: number
  hit: number
  dodge: number
  def: number
  prot: number
  speed: number
  power: number
  hpMax: number
  mpMax: number
  attrs: Attrs
}

/** 面板数值(公式借鉴原作,按压缩节奏调参) */
export function panel(char: Character): Panel {
  const attrs = effectiveAttrs(char)
  const level = charLevel(char)
  const outId = char.equipped.output ?? 'bs-fist'
  const out = skill(outId)
  const outLv = Math.max(1, skillLevel(char, outId))
  const lightId = char.equipped.lightness ?? 'bs-light'
  const light = skill(lightId)
  const parryId = char.equipped.parry ?? 'bs-parry'
  const parry = skill(parryId)
  const intId = char.equipped.internal ?? 'bs-internal'
  const intl = skill(intId)
  const basicIntLv = Math.max(1, skillLevel(char, 'bs-internal'))

  const weapon = char.weapon ? itemWeaponAtk(char.weapon) : 0
  const armorDef = armorStat(char, 'def')
  const armorProt = armorStat(char, 'prot')

  const mpBase = (BASE_MP + basicIntLv * 8 + char.mpGrown) * (1.4 + 0.008 * attrs.bone + 0.002 * attrs.arm + 0.002 * attrs.agi)
  const mpMax = Math.floor(mpBase + internalLv(char) * (intl?.mpCoef ?? 0) * 0.6)

  const hpMax = Math.floor(
    BASE_HP + level * 12 + attrs.bone * 14 + internalLv(char) * (intl?.hpCoef ?? 0) * 0.8 + basicIntLv * 4,
  )

  const expBase = Math.pow(Math.max(0, char.exp), 0.4)
  const atkCoef = out?.atkCoef ?? 40
  const dmgCoef = out?.dmgCoef ?? 0
  const atk =
    (outLv * 0.03 * atkCoef + mpMax / 20 + 10 + expBase) * (1 + 0.02 * attrs.arm) + weapon + dmgCoef * 0.5

  const hit = (outLv * 0.15 * (out?.hitCoef ?? 50) + 1000 + 0.5 * Math.sqrt(char.exp)) * (1 + 0.02 * attrs.arm)

  const lightLv = effectiveLightLv(char)
  const dodge = (lightLv * (light?.dodgeCoef ?? 30) * 0.01 + 10 + 0.2 * Math.sqrt(char.exp)) * (1.6 + attrs.agi * 0.01)

  const parryLv = effectiveParryLv(char)
  const def =
    ((5 * parryLv * (parry?.defCoef ?? 40)) / 120 + expBase + 10) * (1.35 + attrs.agi / 200) + armorDef

  const prot = attrs.bone + armorProt

  // 攻速:轻功攻速系数为主,身法递减加成,武器过重减速、臂力足够加速
  const wItem = char.weapon ? itemWeight(char.weapon) : 0
  const weightMod = wItem === 0 ? 0 : attrs.arm >= wItem * 10 ? 0.15 : -0.06 * wItem
  const speed =
    BATTLE.baseSpeed *
    (1 +
      (out?.speedCoef ?? 10) / 100 +
      (light?.speedCoef ?? 10) / 160 +
      Math.min(0.25, attrs.agi / 500) +
      weightMod)

  // 加力 = (基本内功/2 + 准备内功)/2
  const power = Math.floor((basicIntLv / 2 + internalLv(char)) / 2)

  return { level, atk, hit, dodge, def, prot, speed, power, hpMax, mpMax, attrs }
}

function itemWeaponAtk(itemId: string): number {
  return itemById.get(itemId)?.weapon?.atk ?? 0
}

function itemWeight(itemId: string): number {
  return itemById.get(itemId)?.weapon?.weight ?? 0
}

function armorStat(char: Character, key: 'def' | 'prot'): number {
  let sum = 0
  for (const id of Object.values(char.armor)) {
    if (!id) continue
    const it = itemById.get(id)
    if (it?.armor) sum += key === 'def' ? it.armor.def : it.armor.prot
  }
  return sum
}

/** 综合评价:挂机倍率与主站分数依据 */
export function evaluation(char: Character): number {
  const attrs = effectiveAttrs(char)
  const eqLevels = (['output', 'internal', 'lightness', 'parry'] as const).reduce(
    (s, slot) => s + skillLevel(char, char.equipped[slot] ?? ''),
    0,
  )
  return Math.round(
    charLevel(char) * 2 + eqLevels * EVAL_SKILL_W + (attrs.arm + attrs.agi + attrs.bone + attrs.ins) * EVAL_ATTR_W + char.rebirths * EVAL_REBIRTH,
  )
}

/** 出身属性 roll:四维总和 80、单项 [10, cap];容貌+福缘=40 */
export function rollOrigin(originId: string, rand: () => number = Math.random): { attrs: Attrs; appearance: number; fortune: number } {
  const origin = originById.get(originId)
  const capOf = (k: AttrKey): number => origin?.capOverride?.[k] ?? origin?.cap ?? 25
  let attrs: Attrs = { arm: 20, agi: 20, bone: 20, ins: 20 }
  for (let attempt = 0; attempt < 200; attempt++) {
    const keys: AttrKey[] = ['arm', 'agi', 'bone', 'ins']
    const a: Attrs = { arm: 0, agi: 0, bone: 0, ins: 0 }
    for (const k of keys) {
      const cap = capOf(k)
      a[k] = ATTR_MIN + Math.floor(rand() * (cap - ATTR_MIN + 1))
    }
    let rest = ATTR_TOTAL - (a.arm + a.agi + a.bone + a.ins)
    // 把差值随机摊到未达上限的项上
    for (let i = 0; i < 400 && rest !== 0; i++) {
      const k = keys[Math.floor(rand() * keys.length)]
      if (rest > 0 && a[k] < capOf(k)) {
        a[k]++
        rest--
      } else if (rest < 0 && a[k] > ATTR_MIN) {
        a[k]--
        rest++
      }
    }
    if (rest === 0) {
      attrs = a
      break
    }
  }
  const fortuneMax = Math.min(FORTUNE_MAX, EXTRA_TOTAL - 13)
  const fortuneBase = 13 + Math.floor(rand() * (Math.min(22, fortuneMax) - 13 + 1))
  const bonus = origin?.fortuneBonus ?? 0
  const fortune = Math.min(fortuneMax, fortuneBase + bonus)
  return { attrs, appearance: EXTRA_TOTAL - fortune, fortune }
}

export function newCharacter(
  name: string,
  gender: Gender,
  originId: string,
  attrs: Attrs,
  appearance: number,
  fortune: number,
): Character {
  const origin = originById.get(originId)
  const char: Character = {
    name,
    gender,
    origin: originId,
    innate: { ...attrs },
    rebirthAttrs: { arm: 0, agi: 0, bone: 0, ins: 0 },
    attrPoints: 0,
    appearance,
    fortune,
    exp: 0,
    potential: 0,
    spirit: spiritMaxOf(0),
    mpGrown: 0,
    injury: 0,
    hp: 1,
    silver: origin?.silver ?? 100,
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
    bagCap: 30,
    autoActive: true,
  }
  for (const s of origin?.startSkills ?? []) {
    char.skills[s.id] = { level: s.level, exp: 0, activeUnlocked: false }
  }
  for (const it of origin?.startItems ?? []) {
    char.bag[it.id] = (char.bag[it.id] ?? 0) + it.count
  }
  // 默认装备基本功
  char.equipped = { output: 'bs-fist', internal: 'bs-internal', lightness: 'bs-light', parry: 'bs-parry' }
  for (const id of ['bs-fist', 'bs-internal', 'bs-light', 'bs-parry']) {
    if (!char.skills[id]) char.skills[id] = { level: 1, exp: 0, activeUnlocked: false }
  }
  return char
}

export function spiritMaxOf(rebirths: number): number {
  return BASE_SPIRIT + rebirths * SPIRIT_MAX_BONUS_PER_REBIRTH
}

/** 武学等级上限:非基本武学 ≤ min(人物等级, 对应基本武学+1);基本武学 ≤ 人物等级+100 */
export function skillLevelCap(char: Character, skillId: string): number {
  const def = skill(skillId)
  if (!def) return 1
  const level = charLevel(char)
  if (def.tier === 'basic') return level + 100
  if (!def.basic || def.basic === 'read') return level
  const basicId = basicIdOf(def.basic)
  return Math.min(level, skillLevel(char, basicId) + 1)
}

export function basicIdOf(kind: string): string {
  return `bs-${kind}`
}
