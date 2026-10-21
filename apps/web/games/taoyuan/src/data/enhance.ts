import type { EnhanceCostDef, EquipmentEffectType } from '@/types'

/** 装备强化最高等级 */
export const MAX_ENHANCE_LEVEL = 10

/** 每级强化的效果加成：+10 时效果翻倍 */
export const ENHANCE_BONUS_PER_LEVEL = 0.1

/** 强化费用（level 为目标等级），成功率 100% */
export const ENHANCE_COSTS: EnhanceCostDef[] = [
  { level: 1, money: 1000, materials: [{ itemId: 'iron_bar', quantity: 3 }] },
  { level: 2, money: 2000, materials: [{ itemId: 'iron_bar', quantity: 5 }] },
  { level: 3, money: 4000, materials: [{ itemId: 'iron_bar', quantity: 8 }] },
  { level: 4, money: 8000, materials: [{ itemId: 'gold_bar', quantity: 3 }] },
  { level: 5, money: 15000, materials: [{ itemId: 'gold_bar', quantity: 5 }] },
  { level: 6, money: 25000, materials: [{ itemId: 'gold_bar', quantity: 8 }] },
  { level: 7, money: 40000, materials: [{ itemId: 'iridium_bar', quantity: 3 }] },
  { level: 8, money: 60000, materials: [{ itemId: 'iridium_bar', quantity: 5 }] },
  { level: 9, money: 90000, materials: [{ itemId: 'iridium_bar', quantity: 8 }] },
  {
    level: 10,
    money: 150000,
    materials: [
      { itemId: 'iridium_bar', quantity: 10 },
      { itemId: 'prismatic_shard', quantity: 1 }
    ]
  }
]

/** 升到目标等级的费用，超出范围返回 null */
export const getEnhanceCost = (targetLevel: number): EnhanceCostDef | null => ENHANCE_COSTS.find(c => c.level === targetLevel) ?? null

/** 规整强化等级：缺省 / 越界 / 非数字都收敛到 0-10 */
export const normalizeEnhanceLevel = (level: number | undefined): number => {
  const value = Math.floor(level ?? 0)
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(value, MAX_ENHANCE_LEVEL)
}

/** 强化倍率：1 + 0.1 × 等级 */
export const getEnhanceMultiplier = (level: number | undefined): number => 1 + ENHANCE_BONUS_PER_LEVEL * normalizeEnhanceLevel(level)

/** 强化后的武器攻击力（四舍五入） */
export const getEnhancedAttack = (baseAttack: number, level: number | undefined): number =>
  Math.round(baseAttack * getEnhanceMultiplier(level))

/** 按整数结算的效果（攻击、生命、矿石数），放大后取整 */
const INTEGER_EFFECT_TYPES = new Set<EquipmentEffectType>(['attack_bonus', 'max_hp_bonus', 'ore_bonus'])

/** 单件装备的效果值按强化等级放大 */
export const scaleEffectValue = (type: EquipmentEffectType, value: number, level: number | undefined): number => {
  const scaled = value * getEnhanceMultiplier(level)
  return INTEGER_EFFECT_TYPES.has(type) ? Math.round(scaled) : scaled
}

/**
 * 叠加上限：这些效果以「1 - 值」参与计算，强化后合计不能越过上限，
 * 否则会出现负价格、负耗时、负伤害。上限都高于未强化时的最大叠加值，不影响原有平衡。
 */
export const EQUIPMENT_EFFECT_CAPS: Partial<Record<EquipmentEffectType, number>> = {
  defense_bonus: 0.8,
  stamina_reduction: 0.9,
  farming_stamina: 0.9,
  mining_stamina: 0.9,
  fishing_stamina: 0.9,
  fishing_calm: 0.9,
  shop_discount: 0.9,
  travel_speed: 0.9
}

/** 套用叠加上限 */
export const capEffectTotal = (type: EquipmentEffectType, total: number): number => {
  const cap = EQUIPMENT_EFFECT_CAPS[type]
  return cap === undefined ? total : Math.min(total, cap)
}

/** 装备显示名：强化过的带「+N」 */
export const formatEnhanceName = (name: string, level: number | undefined): string => {
  const value = normalizeEnhanceLevel(level)
  return value > 0 ? `${name}+${value}` : name
}

/** 装备效果名称 */
export const EQUIPMENT_EFFECT_NAMES: Record<EquipmentEffectType, string> = {
  attack_bonus: '攻击力',
  crit_rate_bonus: '暴击率',
  defense_bonus: '减伤',
  vampiric: '吸血',
  max_hp_bonus: '最大HP',
  stamina_reduction: '体力消耗降低',
  mining_stamina: '采矿体力降低',
  farming_stamina: '农耕体力降低',
  fishing_stamina: '钓鱼体力降低',
  crop_quality_bonus: '作物品质',
  crop_growth_bonus: '作物生长加速',
  fish_quality_bonus: '鱼类品质',
  fishing_calm: '鱼温顺度',
  sell_price_bonus: '售价加成',
  shop_discount: '商店折扣',
  gift_friendship: '送礼好感',
  monster_drop_bonus: '怪物掉落',
  exp_bonus: '经验加成',
  treasure_find: '宝箱发现率',
  ore_bonus: '额外矿石',
  luck: '幸运',
  travel_speed: '旅行加速'
}

/** 效果数值显示：攻击、生命、矿石为整数，其余为百分比（保留一位小数） */
export const formatEquipmentEffectValue = (type: EquipmentEffectType, value: number): string =>
  INTEGER_EFFECT_TYPES.has(type) ? `+${value}` : `+${Math.round(value * 1000) / 10}%`
