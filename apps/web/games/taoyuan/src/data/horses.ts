/**
 * 马匹品种。
 *
 * 原先马只有一种、只影响赶路速度，好感度养满也毫无回报。
 * 这里给出三个档次：普通马可以直接买，好马要靠稀有渠道换，
 * 并让好感度真正起作用——熟悉主人的马赶路更省力，放牧时还会帮着把牲口拢住。
 */
export type HorseBreed = 'common' | 'steppe' | 'cloud' | 'divine'

export interface HorseBreedDef {
  id: HorseBreed
  name: string
  description: string
  /** 旅行耗时倍率，越低越快 */
  travelTimeMultiplier: number
  /** 旅行体力消耗倍率 */
  travelStaminaMultiplier: number
  /** 放牧时每头牲畜额外产出的触发概率 */
  grazeBonusChance: number
  /** 获取途径说明 */
  sourceHint: string
}

export const HORSE_BREEDS: HorseBreedDef[] = [
  {
    id: 'common',
    name: '土马',
    description: '村里常见的驮马，性子温顺，赶路比走着强。',
    travelTimeMultiplier: 0.7,
    travelStaminaMultiplier: 0.5,
    grazeBonusChance: 0.05,
    sourceHint: '马厩购买'
  },
  {
    id: 'steppe',
    name: '草原马',
    description: '瀚海商队带来的良驹，耐力极佳。',
    travelTimeMultiplier: 0.55,
    travelStaminaMultiplier: 0.4,
    grazeBonusChance: 0.12,
    sourceHint: '瀚海通商积分兑换'
  },
  {
    id: 'cloud',
    name: '踏云驹',
    description: '据说能踏云而行，蹄下生风。',
    travelTimeMultiplier: 0.4,
    travelStaminaMultiplier: 0.3,
    grazeBonusChance: 0.2,
    sourceHint: '冒险家公会高阶悬赏'
  },
  {
    id: 'divine',
    name: '龙驹',
    description: '传说中龙种所化，通人性，识归途。',
    travelTimeMultiplier: 0.3,
    travelStaminaMultiplier: 0.2,
    grazeBonusChance: 0.3,
    sourceHint: '仙缘·龙灵结缘后赠予'
  }
]

export const getHorseBreed = (id: HorseBreed | undefined): HorseBreedDef => {
  return HORSE_BREEDS.find(b => b.id === id) ?? HORSE_BREEDS[0]!
}

/**
 * 好感度对马匹能力的加成系数（0~1）。
 * 满好感时再额外减免一成耗时与体力，并提升放牧协助概率。
 */
export const getHorseBondFactor = (friendship: number): number => {
  return Math.min(1, Math.max(0, friendship / 1000))
}

/** 马匹好感带来的额外耗时减免上限 */
export const HORSE_BOND_TIME_BONUS = 0.1

/** 马匹好感带来的额外体力减免上限 */
export const HORSE_BOND_STAMINA_BONUS = 0.15

/** 马匹好感带来的额外放牧协助概率上限 */
export const HORSE_BOND_GRAZE_BONUS = 0.15
