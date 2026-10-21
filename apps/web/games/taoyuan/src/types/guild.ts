/** 怪物讨伐目标定义 */
export interface MonsterGoalDef {
  monsterId: string
  monsterName: string
  zone: string
  killTarget: number
  reward: {
    money?: number
    items?: { itemId: string; quantity: number }[]
  }
  description: string
}

/** 捐献物品定义 */
export interface GuildDonationDef {
  itemId: string
  points: number
}

/** 公会等级定义 */
export interface GuildLevelDef {
  level: number
  expRequired: number
}

/** 公会商店物品定义 */
export interface GuildShopItemDef {
  itemId: string
  name: string
  price: number
  contributionCost?: number
  description: string
  /** 解锁所需公会等级 */
  unlockGuildLevel?: number
  /** 每日限购数 */
  dailyLimit?: number
  /** 每周限购数 */
  weeklyLimit?: number
  /** 永久总购买上限 */
  totalLimit?: number
  /** 装备类型（购买后加入对应装备栏） */
  equipType?: 'weapon' | 'ring' | 'hat' | 'shoe'
  /** 兑换后把马升级为指定品种（需已有马） */
  horseUpgrade?: 'steppe' | 'cloud' | 'divine'
  /** 合成材料 */
  materials?: { itemId: string; quantity: number }[]
}
