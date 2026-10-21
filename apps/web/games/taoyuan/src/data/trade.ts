import type {
  MachineType,
  Quality,
  TradeOrder,
  TradeOrderKind,
  TradeOrderLine,
  TradePoolCategory,
  TradePoolContext,
  TradePoolEntry,
  TradeRewardDef
} from '@/types'
import { CROPS } from './crops'
import { FRUIT_TREE_DEFS } from './fruitTrees'
import { ANIMAL_DEFS } from './animals'
import { PROCESSING_RECIPES } from './processing'
import { FISH } from './fish'
import { FORAGE_ITEMS } from './forage'
import { getItemById, isProtectedItem } from './items'

// ==================== 积分规则 ====================

/** 每日订单数 */
export const DAILY_ORDER_COUNT = 3

/** 周单需求物品种类数 */
const WEEKLY_LINE_MIN = 2
const WEEKLY_LINE_MAX = 3

/** 每多少文售价折 1 积分 */
export const VALUE_PER_POINT = 10

/** 周单积分倍率（相对同价值日单） */
export const WEEKLY_POINTS_MULTIPLIER = 2.5

/** 交付品质加成 */
export const TRADE_QUALITY_MULTIPLIER: Record<Quality, number> = {
  normal: 1,
  fine: 1.25,
  excellent: 1.5,
  supreme: 2
}

/** 交付扣除顺序：低品质优先 */
export const TRADE_QUALITY_ORDER: Quality[] = ['normal', 'fine', 'excellent', 'supreme']

/** 订单物品售价下限：木材、柴火这类几文钱的东西不值得单开一张订单 */
const MIN_ORDER_ITEM_PRICE = 10

/** 数量分档：售价越低要得越多 */
const QUANTITY_TIERS: { maxPrice: number; min: number; max: number }[] = [
  { maxPrice: 20, min: 15, max: 20 },
  { maxPrice: 50, min: 10, max: 15 },
  { maxPrice: 100, min: 8, max: 12 },
  { maxPrice: 200, min: 5, max: 8 },
  { maxPrice: 400, min: 4, max: 6 },
  { maxPrice: Infinity, min: 3, max: 4 }
]

/** 订单积分：售价总值折算，周单乘倍率 */
export const calcOrderPoints = (value: number, kind: TradeOrderKind): number => {
  const raw = (value / VALUE_PER_POINT) * (kind === 'weekly' ? WEEKLY_POINTS_MULTIPLIER : 1)
  // 先抹掉浮点尾差再向上取整，避免 130.0000001 被算成 131
  return Math.ceil(Math.round(raw * 1000) / 1000)
}

/** 物品基础售价 */
export const getTradeUnitPrice = (itemId: string): number => getItemById(itemId)?.sellPrice ?? 0

/** 订单需求总值（全部按普通品质） */
const getLinesValue = (lines: TradeOrderLine[]): number =>
  lines.reduce((sum, line) => sum + getTradeUnitPrice(line.itemId) * line.quantity, 0)

// ==================== 订单物品池 ====================

/** 计入「加工品」的机器：种子机、结晶机、回收机、熔炉、蚯蚓箱的产物不算 */
const PROCESSED_MACHINES: MachineType[] = [
  'wine_workshop',
  'sauce_jar',
  'bee_house',
  'oil_press',
  'mayo_maker',
  'smoker',
  'dehydrator',
  'cheese_press',
  'loom',
  'charcoal_kiln',
  'mill',
  'tea_maker',
  'tofu_press',
  'herb_grinder',
  'incense_maker'
]

/** 不进订单的加工产物：饲料与兽药、野兽药材、与杂交作物同 ID 的桂花茶 */
const PROCESSED_EXCLUDED = new Set<string>([
  'animal_medicine',
  'premium_feed',
  'nourishing_feed',
  'vitality_feed',
  'bear_gall_pill',
  'tiger_bone_tonic',
  'osmanthus_tea'
])

/** 矿石与金属锭：按矿洞进度解锁（主矿洞安全点层数 / 是否到过骷髅矿穴） */
const MINERAL_ENTRIES: { itemId: string; minSafeFloor: number; needSkullCavern?: boolean }[] = [
  { itemId: 'copper_bar', minSafeFloor: 5 },
  { itemId: 'iron_ore', minSafeFloor: 45 },
  { itemId: 'iron_bar', minSafeFloor: 45 },
  { itemId: 'crystal_ore', minSafeFloor: 65 },
  { itemId: 'gold_ore', minSafeFloor: 85 },
  { itemId: 'gold_bar', minSafeFloor: 85 },
  { itemId: 'shadow_ore', minSafeFloor: 85 },
  { itemId: 'void_ore', minSafeFloor: 105 },
  { itemId: 'iridium_ore', minSafeFloor: 0, needSkullCavern: true },
  { itemId: 'iridium_bar', minSafeFloor: 0, needSkullCavern: true }
]

/** 反季作物在有温室时的权重（当季为 1） */
const OFF_SEASON_GREENHOUSE_WEIGHT = 0.05

/** 难钓的鱼出现权重（其余为 1） */
const HARD_FISH_WEIGHT = 0.3

const CROP_IDS = new Set(CROPS.map(c => c.id))

/** 牲畜产物 → 产出它的牲畜种类 */
const ANIMAL_PRODUCT_SOURCE = new Map(ANIMAL_DEFS.filter(a => a.productId).map(a => [a.productId, a.type] as const))

/** 果树水果 → 果树种类（与作物同 ID 的不算，作物照样能种出来） */
const FRUIT_SOURCE = new Map(FRUIT_TREE_DEFS.filter(t => !CROP_IDS.has(t.fruitId)).map(t => [t.fruitId, t.type] as const))

/** 加工原料当前能否弄到：牲畜产物要养了对应牲畜，果树水果要种了对应果树 */
const isInputObtainable = (inputItemId: string | null, ctx: TradePoolContext): boolean => {
  if (!inputItemId) return true
  const animalType = ANIMAL_PRODUCT_SOURCE.get(inputItemId)
  if (animalType) return ctx.animalTypes.includes(animalType)
  const treeType = FRUIT_SOURCE.get(inputItemId)
  if (treeType) return ctx.fruitTreeTypes.includes(treeType)
  return true
}

/** 作物：只收商店有种子卖的作物（杂交、远古、瀚海作物不进订单），当季优先 */
const buildCropEntries = (ctx: TradePoolContext): TradePoolEntry[] => {
  const entries: TradePoolEntry[] = []
  for (const crop of CROPS) {
    if (crop.seedPrice <= 0) continue
    const weight = crop.season.includes(ctx.season) ? 1 : ctx.hasGreenhouse ? OFF_SEASON_GREENHOUSE_WEIGHT : 0
    if (weight > 0) entries.push({ itemId: crop.id, category: 'crop', weight })
  }
  for (const tree of FRUIT_TREE_DEFS) {
    if (tree.fruitSeason === ctx.season && ctx.fruitTreeTypes.includes(tree.type)) {
      entries.push({ itemId: tree.fruitId, category: 'crop', weight: 1 })
    }
  }
  return entries
}

/** 畜产品：只收已养牲畜的产物 */
const buildAnimalEntries = (ctx: TradePoolContext): TradePoolEntry[] =>
  ANIMAL_DEFS.filter(def => def.productId && ctx.animalTypes.includes(def.type)).map(def => ({
    itemId: def.productId,
    category: 'animal' as const,
    weight: 1
  }))

/** 加工品：只收已建机器、且原料弄得到的产物；瀚海原料的不收 */
const buildProcessedEntries = (ctx: TradePoolContext): TradePoolEntry[] =>
  PROCESSING_RECIPES.filter(
    recipe =>
      PROCESSED_MACHINES.includes(recipe.machineType) &&
      ctx.machineTypes.includes(recipe.machineType) &&
      !recipe.inputItemId?.startsWith('hanhai_') &&
      !PROCESSED_EXCLUDED.has(recipe.outputItemId) &&
      isInputObtainable(recipe.inputItemId, ctx)
  ).map(recipe => ({ itemId: recipe.outputItemId, category: 'processed' as const, weight: 1 }))

/** 鱼：当季、非传说鱼 */
const buildFishEntries = (ctx: TradePoolContext): TradePoolEntry[] =>
  FISH.filter(fish => fish.difficulty !== 'legendary' && fish.season.includes(ctx.season)).map(fish => ({
    itemId: fish.id,
    category: 'fish' as const,
    weight: fish.difficulty === 'hard' ? HARD_FISH_WEIGHT : 1
  }))

/** 矿石与金属锭：按矿洞进度 */
const buildMineralEntries = (ctx: TradePoolContext): TradePoolEntry[] =>
  MINERAL_ENTRIES.filter(m => (m.needSkullCavern ? ctx.skullCavernReached : ctx.mineSafeFloor >= m.minSafeFloor)).map(m => ({
    itemId: m.itemId,
    category: 'mineral' as const,
    weight: 1
  }))

/** 采集物：当季竹林采集物，按出现概率加权；古物、化石不收 */
const buildForageEntries = (ctx: TradePoolContext): TradePoolEntry[] =>
  FORAGE_ITEMS.filter(f => {
    if (!f.season.includes(ctx.season)) return false
    const category = getItemById(f.itemId)?.category
    return category !== 'artifact' && category !== 'fossil'
  }).map(f => ({ itemId: f.itemId, category: 'forage' as const, weight: f.chance }))

/** 按玩家进度生成订单物品池（去重、剔除不存在 / 受保护 / 过于便宜的物品） */
export const buildTradePool = (ctx: TradePoolContext): TradePoolEntry[] => {
  const all = [
    ...buildCropEntries(ctx),
    ...buildAnimalEntries(ctx),
    ...buildProcessedEntries(ctx),
    ...buildFishEntries(ctx),
    ...buildMineralEntries(ctx),
    ...buildForageEntries(ctx)
  ]
  const seen = new Set<string>()
  return all.filter(entry => {
    if (seen.has(entry.itemId) || entry.weight <= 0) return false
    seen.add(entry.itemId)
    const def = getItemById(entry.itemId)
    return !!def && def.sellPrice >= MIN_ORDER_ITEM_PRICE && !isProtectedItem(entry.itemId)
  })
}

// ==================== 订单生成 ====================

/** 可复现的伪随机数（mulberry32）：同一日序号 / 周序号生成的订单固定，读档刷不出新单 */
export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAILY_SEED_SALT = 17
const WEEKLY_SEED_SALT = 1_000_003

/** 按权重抽一项 */
const pickWeighted = <T>(list: T[], weightOf: (item: T) => number, rng: () => number): T | null => {
  const total = list.reduce((sum, item) => sum + weightOf(item), 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const item of list) {
    roll -= weightOf(item)
    if (roll < 0) return item
  }
  return list[list.length - 1] ?? null
}

const ALL_CATEGORIES: TradePoolCategory[] = ['crop', 'animal', 'processed', 'fish', 'forage', 'mineral']

/** 每张单子各需求项的取材方向：作物 → 牧场 / 加工 → 鱼 / 采集 / 矿 */
const ORDER_SLOT_CATEGORIES: TradePoolCategory[][] = [['crop'], ['animal', 'processed'], ['fish', 'forage', 'mineral']]

/** 先等概率选分类，再在分类内按权重选物品（避免鱼种多而挤占其他分类） */
const pickFromCategories = (
  pool: TradePoolEntry[],
  categories: TradePoolCategory[],
  usedIds: Set<string>,
  rng: () => number
): TradePoolEntry | null => {
  const candidatesOf = (category: TradePoolCategory) => pool.filter(e => e.category === category && !usedIds.has(e.itemId))
  const available = categories.filter(category => candidatesOf(category).length > 0)
  const category = pickWeighted(available, () => 1, rng)
  if (!category) return null
  return pickWeighted(candidatesOf(category), e => e.weight, rng)
}

/** 第 slot 个需求项选品；对应方向没货时从全部分类里补 */
const pickSlotEntry = (pool: TradePoolEntry[], slot: number, usedIds: Set<string>, rng: () => number): TradePoolEntry | null =>
  pickFromCategories(pool, ORDER_SLOT_CATEGORIES[slot] ?? ALL_CATEGORIES, usedIds, rng) ??
  pickFromCategories(pool, ALL_CATEGORIES, usedIds, rng)

/** 按售价分档随机数量 */
const rollQuantity = (unitPrice: number, rng: () => number): number => {
  const tier = QUANTITY_TIERS.find(t => unitPrice <= t.maxPrice) ?? QUANTITY_TIERS[QUANTITY_TIERS.length - 1]!
  return tier.min + Math.floor(rng() * (tier.max - tier.min + 1))
}

/** 连续选出 count 个不重复的需求项，第 i 项按 ORDER_SLOT_CATEGORIES[i] 取材 */
const rollLines = (pool: TradePoolEntry[], count: number, rng: () => number): TradeOrderLine[] => {
  const usedIds = new Set<string>()
  const lines: TradeOrderLine[] = []
  for (let slot = 0; slot < count; slot++) {
    const entry = pickSlotEntry(pool, slot, usedIds, rng)
    if (!entry) break
    usedIds.add(entry.itemId)
    lines.push({ itemId: entry.itemId, quantity: rollQuantity(getTradeUnitPrice(entry.itemId), rng) })
  }
  return lines
}

/** 生成某日的日单：每张 1 种物品，三张分别偏向作物、牧场 / 加工、鱼 / 采集 / 矿 */
export const generateDailyOrders = (ctx: TradePoolContext, dayIndex: number): TradeOrder[] => {
  const rng = createSeededRandom(dayIndex * 31 + DAILY_SEED_SALT)
  return rollLines(buildTradePool(ctx), DAILY_ORDER_COUNT, rng).map((line, i) => ({
    id: `d${dayIndex}-${i}`,
    kind: 'daily',
    lines: [line],
    points: calcOrderPoints(getLinesValue([line]), 'daily'),
    delivered: false
  }))
}

/** 生成某周的周单：2-3 种物品，积分按周单倍率 */
export const generateWeeklyOrder = (ctx: TradePoolContext, weekIndex: number): TradeOrder | null => {
  const rng = createSeededRandom(weekIndex * 31 + WEEKLY_SEED_SALT)
  const count = WEEKLY_LINE_MIN + Math.floor(rng() * (WEEKLY_LINE_MAX - WEEKLY_LINE_MIN + 1))
  const lines = rollLines(buildTradePool(ctx), count, rng)
  if (lines.length === 0) return null
  return { id: `w${weekIndex}`, kind: 'weekly', lines, points: calcOrderPoints(getLinesValue(lines), 'weekly'), delivered: false }
}

// ==================== 积分兑换 ====================

/** 兑换列表（每次兑换 1 个） */
export const TRADE_REWARDS: TradeRewardDef[] = [
  // 稀有材料
  { itemId: 'ancient_seed', type: 'item', cost: 300, weeklyLimit: 2 },
  { itemId: 'iridium_bar', type: 'item', cost: 80, weeklyLimit: 5 },
  { itemId: 'gold_bar', type: 'item', cost: 30, weeklyLimit: 10 },
  { itemId: 'prismatic_shard', type: 'item', cost: 400, weeklyLimit: 1 },
  // 稀有种子：商店不卖、平时只能靠育种得到的杂交种
  { itemId: 'seed_golden_melon', type: 'item', cost: 80, weeklyLimit: 5 },
  { itemId: 'seed_jade_tea', type: 'item', cost: 70, weeklyLimit: 5 },
  { itemId: 'seed_phoenix_pepper', type: 'item', cost: 120, weeklyLimit: 3 },
  { itemId: 'seed_frost_garlic', type: 'item', cost: 80, weeklyLimit: 5 },
  // 稀有装备：无商店价、无配方，平时只能靠矿洞宝箱或怪物掉落
  { itemId: 'ancient_jade_ring', type: 'ring', cost: 800, totalLimit: 1 },
  { itemId: 'crystal_prism_band', type: 'ring', cost: 1200, totalLimit: 1 },
  { itemId: 'treasure_cap', type: 'hat', cost: 600, totalLimit: 1 },
  { itemId: 'lucky_boots', type: 'shoe', cost: 700, totalLimit: 1 },
  { itemId: 'shadow_striders', type: 'shoe', cost: 1500, totalLimit: 1 }
]

/** 按物品 ID 查兑换品 */
export const getTradeRewardById = (itemId: string): TradeRewardDef | undefined => TRADE_REWARDS.find(r => r.itemId === itemId)
