/** 瀚海商店物品定义 */
export interface HanhaiShopItemDef {
  itemId: string
  name: string
  price: number
  description: string
  /** 每周限购数量（0或不填=不限购） */
  weeklyLimit?: number
}

/** 赌坊游戏类型 */
export type CasinoGameType = 'roulette' | 'dice' | 'cup' | 'cricket' | 'cardflip' | 'texas' | 'buckshot'

/** 蛐蛐定义 */
export interface CricketDef {
  id: string
  name: string
  description: string
}

/** 轮盘赔率档位 */
export interface RouletteOutcome {
  label: string
  multiplier: number
  /** 概率百分比（所有项之和应为100） */
  chance: number
}

// === 瀚海扑克 ===

export type PokerSuit = 'spade' | 'heart' | 'diamond' | 'club'
export type PokerRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface PokerCard {
  suit: PokerSuit
  rank: PokerRank
}

export type PokerHandType =
  | 'royal_flush'
  | 'straight_flush'
  | 'four_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_kind'
  | 'two_pair'
  | 'one_pair'
  | 'high_card'

export interface PokerHandResult {
  type: PokerHandType
  /** 牌型优先级（越大越强） */
  typeRank: number
  /** 用于同类型比较的排序值数组（降序） */
  ranks: number[]
  label: string
}

export type TexasStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type PokerActionType = 'check' | 'raise' | 'call' | 'fold' | 'allin'
export type TexasTierId = 'beginner' | 'normal' | 'expert'

export interface TexasTierDef {
  id: TexasTierId
  name: string
  /** 入场费（= 双方初始筹码） */
  entryFee: number
  /** 大盲注 */
  blind: number
  /** 每局抽水（荷官小费） */
  rake: number
  /** 入场最低持有金钱 */
  minMoney: number
  /** 每次入场可对局手数 */
  rounds: number
}

export interface TexasSetup {
  playerHole: PokerCard[]
  dealerHole: PokerCard[]
  /** 预发5张，组件按街逐步展示 */
  community: PokerCard[]
  /** 场次配置 */
  tier: TexasTierDef
}

// === 通商系统 ===

/** 通商售货槽位 */
export interface TradeSlot {
  itemId: string
  quality: string
  quantity: number
  daysRemaining: number
  pointsReward: number
}

/** 通商店铺升级定义 */
export interface TradeShopUpgradeDef {
  level: number
  name: string
  maxSlots: number
  sellDays: number
  cost: number
  materialCost: { itemId: string; quantity: number }[]
}

/** 积分兑换物品定义 */
export interface TradeExchangeItemDef {
  itemId: string
  name: string
  pointsCost: number
  description: string
  weeklyLimit?: number
  totalLimit?: number
  /** 是否为钱袋物品（购买后自动加入钱袋） */
  isWalletItem?: boolean
  /** 是否为装备 */
  equipType?: 'weapon' | 'ring' | 'hat' | 'shoe'
  /** 兑换后把马升级为指定品种（需已有马厩与马） */
  isHorseUpgrade?: 'steppe' | 'cloud' | 'divine'
}

// === 恶魔轮盘 ===

export type ShellType = 'live' | 'blank'

export interface BuckshotSetup {
  shells: ShellType[]
  playerHP: number
  dealerHP: number
}
