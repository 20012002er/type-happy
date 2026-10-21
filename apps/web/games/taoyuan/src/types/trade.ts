import type { Season } from './game'
import type { AnimalType, FruitTreeType } from './animal'
import type { MachineType } from './processing'

// === 商会（村内贸易，与瀚海通商无关） ===

/** 订单物品池分类 */
export type TradePoolCategory = 'crop' | 'animal' | 'processed' | 'fish' | 'mineral' | 'forage'

/** 订单类型：日单 / 周单 */
export type TradeOrderKind = 'daily' | 'weekly'

/** 订单需求项 */
export interface TradeOrderLine {
  itemId: string
  quantity: number
}

/** 商会订单实例（存档用） */
export interface TradeOrder {
  /** 日单 d{日序号}-{序号}，周单 w{周序号} */
  id: string
  kind: TradeOrderKind
  lines: TradeOrderLine[]
  /** 基础积分（全部按普通品质交付） */
  points: number
  delivered: boolean
}

/** 生成订单时参考的玩家进度 */
export interface TradePoolContext {
  season: Season
  /** 有温室时反季作物也会少量出现 */
  hasGreenhouse: boolean
  /** 已拥有的牲畜种类 */
  animalTypes: AnimalType[]
  /** 已种下的果树种类 */
  fruitTreeTypes: FruitTreeType[]
  /** 已建造的加工机器种类 */
  machineTypes: MachineType[]
  /** 主矿洞已到达的最深安全点 */
  mineSafeFloor: number
  /** 是否到过骷髅矿穴 */
  skullCavernReached: boolean
}

/** 订单物品池条目 */
export interface TradePoolEntry {
  itemId: string
  category: TradePoolCategory
  /** 抽取权重 */
  weight: number
}

/** 兑换品发放方式：普通物品进背包，装备进对应装备栏 */
export type TradeRewardType = 'item' | 'ring' | 'hat' | 'shoe'

/** 积分兑换品定义 */
export interface TradeRewardDef {
  /** 物品或装备的定义 ID */
  itemId: string
  type: TradeRewardType
  /** 所需积分 */
  cost: number
  /** 每周限兑次数 */
  weeklyLimit?: number
  /** 总限兑次数 */
  totalLimit?: number
}

/** 商会操作结果 */
export interface TradeActionResult {
  success: boolean
  message: string
}
