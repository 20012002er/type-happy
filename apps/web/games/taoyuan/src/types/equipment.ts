import type { EquipmentEffect } from './ring'

/** 帽子定义 */
export interface HatDef {
  id: string
  name: string
  description: string
  effects: EquipmentEffect[]
  /** 商店购买价格（null = 不可购买，需合成） */
  shopPrice: number | null
  /** 合成配方（null = 不可合成） */
  recipe: { itemId: string; quantity: number }[] | null
  /** 合成所需铜钱 */
  recipeMoney: number
  /** 获取途径描述 */
  obtainSource: string
  /** 出售价格 */
  sellPrice: number
}

/** 拥有的帽子实例 */
export interface OwnedHat {
  defId: string
  /** 强化等级 0-10（缺省 0） */
  enhance?: number
}

/** 鞋子定义 */
export interface ShoeDef {
  id: string
  name: string
  description: string
  effects: EquipmentEffect[]
  /** 商店购买价格（null = 不可购买，需合成） */
  shopPrice: number | null
  /** 合成配方（null = 不可合成） */
  recipe: { itemId: string; quantity: number }[] | null
  /** 合成所需铜钱 */
  recipeMoney: number
  /** 获取途径描述 */
  obtainSource: string
  /** 出售价格 */
  sellPrice: number
}

/** 拥有的鞋子实例 */
export interface OwnedShoe {
  defId: string
  /** 强化等级 0-10（缺省 0） */
  enhance?: number
}

/** 可强化的装备种类 */
export type EquipmentKind = 'weapon' | 'ring' | 'hat' | 'shoe'

/** 装备强化费用（level 为目标等级） */
export interface EnhanceCostDef {
  level: number
  money: number
  materials: { itemId: string; quantity: number }[]
}
