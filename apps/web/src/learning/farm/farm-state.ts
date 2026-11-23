import { LEARNING_RULES } from '../config/rules'
import { assertLocalDateKey, toLocalDateKey } from '../date-key'
import { isProcessingProduct } from '../processing/types'

export const CROP_IDS = ['radish', 'wheat', 'corn', 'pumpkin'] as const
export const ANIMAL_KINDS = ['chicken', 'cow'] as const
export const FEED_ITEM_IDS = ['chicken-feed', 'cow-feed'] as const

export type CropId = (typeof CROP_IDS)[number]
export type AnimalKind = (typeof ANIMAL_KINDS)[number]
export type FeedItemId = (typeof FEED_ITEM_IDS)[number]
export type FarmProductId = CropId | 'egg' | 'milk'
export type WarehouseCategory =
  'crops' | 'animal-products' | 'processed-products' | 'seeds' | 'fertilizer' | 'feed'

export interface CropState {
  cropId: CropId
  plantedAt: number
  readyAt: number
  fertilized: boolean
}

export interface FarmPlot {
  id: string
  crop: CropState | null
}

export interface AnimalProduction {
  startedAt: number
  readyAt: number
}

export interface FarmAnimal {
  id: string
  kind: AnimalKind
  production: AnimalProduction | null
  productPending: boolean
}

export interface FarmBuilding {
  level: number
}

export interface FarmState {
  starterGiftClaimed: boolean
  inventory: Readonly<Record<string, number>>
  plots: readonly FarmPlot[]
  animals: readonly FarmAnimal[]
  buildings: {
    chickenCoop: FarmBuilding
    cowshed: FarmBuilding
  }
  saleIncomeByDate: Readonly<Record<string, number>>
  recoveryClaimDates: readonly string[]
  lastAdvancedAt: number | null
  actions: Readonly<Record<string, string>>
}

export interface FarmActionRequest {
  actionId: string
  now: number
}

export class FarmValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FarmValidationError'
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FarmValidationError(`${path} 必须是对象`)
  }
  return value as Record<string, unknown>
}

function expectBoolean(value: unknown, path: string): void {
  if (typeof value !== 'boolean') throw new FarmValidationError(`${path} 必须是布尔值`)
}

function expectInteger(value: unknown, path: string, minimum = 0): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new FarmValidationError(`${path} 必须是大于等于 ${minimum} 的安全整数`)
  }
}

export function assertFarmTimestamp(value: number): void {
  expectInteger(value, '农场时间')
}

export function seedItemId(cropId: CropId): string {
  return `${cropId}-seed`
}

export function feedItemId(kind: AnimalKind): FeedItemId {
  return `${kind}-feed`
}

export function isCropId(value: string): value is CropId {
  return CROP_IDS.includes(value as CropId)
}

export function isAnimalKind(value: string): value is AnimalKind {
  return ANIMAL_KINDS.includes(value as AnimalKind)
}

export function isFarmProduct(itemId: string): itemId is FarmProductId {
  return isCropId(itemId) || itemId === 'egg' || itemId === 'milk'
}

export function getFarmProductPrice(itemId: FarmProductId): number {
  if (isCropId(itemId)) return LEARNING_RULES.farm.crops[itemId].salePrice
  return itemId === 'egg'
    ? LEARNING_RULES.farm.animals.chicken.salePrice
    : LEARNING_RULES.farm.animals.cow.salePrice
}

export function getWarehouseCategory(itemId: string): WarehouseCategory | null {
  if (isCropId(itemId)) return 'crops'
  if (itemId === 'egg' || itemId === 'milk') return 'animal-products'
  if (isProcessingProduct(itemId)) return 'processed-products'
  if (CROP_IDS.some((cropId) => seedItemId(cropId) === itemId)) return 'seeds'
  if (itemId === 'fertilizer') return 'fertilizer'
  if (FEED_ITEM_IDS.includes(itemId as FeedItemId)) return 'feed'
  return null
}

export function getBuildingCapacity(farm: FarmState, building: 'chickenCoop' | 'cowshed'): number {
  const level = farm.buildings[building].level
  const rules = LEARNING_RULES.farm.buildings[building]
  if (level === 0) return 0
  return level === 1 ? rules.initialCapacity : rules.upgradedCapacity
}

export function createEmptyFarmState(): FarmState {
  return {
    starterGiftClaimed: false,
    inventory: {},
    plots: [],
    animals: [],
    buildings: { chickenCoop: { level: 0 }, cowshed: { level: 0 } },
    saleIncomeByDate: {},
    recoveryClaimDates: [],
    lastAdvancedAt: null,
    actions: {},
  }
}

export function parseFarmState(value: unknown): FarmState {
  const farm = expectRecord(value, 'farm')
  expectBoolean(farm.starterGiftClaimed, 'farm.starterGiftClaimed')
  const inventory = expectRecord(farm.inventory, 'farm.inventory')
  Object.entries(inventory).forEach(([itemId, quantity]) => {
    if (itemId.trim().length === 0) throw new FarmValidationError('物品 ID 不能为空')
    expectInteger(quantity, `farm.inventory.${itemId}`)
  })

  if (!Array.isArray(farm.plots) || farm.plots.length > LEARNING_RULES.farm.plots.maximum) {
    throw new FarmValidationError('farm.plots 必须是最多 8 块土地的数组')
  }
  farm.plots.forEach((value, index) => {
    const plot = expectRecord(value, `farm.plots[${index}]`)
    if (plot.id !== `plot-${index + 1}`) {
      throw new FarmValidationError('土地必须按顺序排列')
    }
    if (plot.crop === null) return
    const crop = expectRecord(plot.crop, `farm.plots[${index}].crop`)
    if (typeof crop.cropId !== 'string' || !isCropId(crop.cropId)) {
      throw new FarmValidationError('作物类型未知')
    }
    expectInteger(crop.plantedAt, `farm.plots[${index}].crop.plantedAt`)
    expectInteger(crop.readyAt, `farm.plots[${index}].crop.readyAt`, 1)
    if (crop.readyAt <= crop.plantedAt)
      throw new FarmValidationError('作物成熟时间必须晚于播种时间')
    expectBoolean(crop.fertilized, `farm.plots[${index}].crop.fertilized`)
  })

  const buildings = expectRecord(farm.buildings, 'farm.buildings')
  const chickenCoop = expectRecord(buildings.chickenCoop, 'farm.buildings.chickenCoop')
  const cowshed = expectRecord(buildings.cowshed, 'farm.buildings.cowshed')
  expectInteger(chickenCoop.level, 'farm.buildings.chickenCoop.level')
  expectInteger(cowshed.level, 'farm.buildings.cowshed.level')
  if (chickenCoop.level > 2 || cowshed.level > 2) {
    throw new FarmValidationError('建筑等级不能超过 Lv2')
  }

  if (!Array.isArray(farm.animals)) throw new FarmValidationError('farm.animals 必须是数组')
  const animalIds = new Set<string>()
  farm.animals.forEach((value, index) => {
    const animal = expectRecord(value, `farm.animals[${index}]`)
    if (
      typeof animal.id !== 'string' ||
      animal.id.trim().length === 0 ||
      animalIds.has(animal.id)
    ) {
      throw new FarmValidationError('动物 ID 必须非空且唯一')
    }
    animalIds.add(animal.id)
    if (typeof animal.kind !== 'string' || !isAnimalKind(animal.kind)) {
      throw new FarmValidationError('动物类型未知')
    }
    expectBoolean(animal.productPending, `farm.animals[${index}].productPending`)
    if (animal.production !== null) {
      const production = expectRecord(animal.production, `farm.animals[${index}].production`)
      expectInteger(production.startedAt, `farm.animals[${index}].production.startedAt`)
      expectInteger(production.readyAt, `farm.animals[${index}].production.readyAt`, 1)
      if (production.readyAt <= production.startedAt) {
        throw new FarmValidationError('动物产品成熟时间必须晚于喂食时间')
      }
      if (animal.productPending) throw new FarmValidationError('动物不能同时生产和持有待收产品')
    }
  })
  const parsed = farm as unknown as FarmState
  for (const kind of ANIMAL_KINDS) {
    const count = parsed.animals.filter((animal) => animal.kind === kind).length
    const building = kind === 'chicken' ? 'chickenCoop' : 'cowshed'
    if (count > getBuildingCapacity(parsed, building)) {
      throw new FarmValidationError(`${kind} 数量超过建筑容量`)
    }
  }

  const sales = expectRecord(farm.saleIncomeByDate, 'farm.saleIncomeByDate')
  Object.entries(sales).forEach(([dateKey, income]) => {
    assertLocalDateKey(dateKey)
    expectInteger(income, `farm.saleIncomeByDate.${dateKey}`)
    if (income > LEARNING_RULES.farm.dailySaleIncomeCap) {
      throw new FarmValidationError('每日出售收入不能超过上限')
    }
  })
  if (!Array.isArray(farm.recoveryClaimDates)) {
    throw new FarmValidationError('farm.recoveryClaimDates 必须是数组')
  }
  const recoveryDates = new Set<string>()
  farm.recoveryClaimDates.forEach((dateKey) => {
    if (typeof dateKey !== 'string' || recoveryDates.has(dateKey)) {
      throw new FarmValidationError('补给日期必须唯一')
    }
    assertLocalDateKey(dateKey)
    recoveryDates.add(dateKey)
  })
  if (farm.lastAdvancedAt !== null) expectInteger(farm.lastAdvancedAt, 'farm.lastAdvancedAt')
  const actions = expectRecord(farm.actions, 'farm.actions')
  Object.entries(actions).forEach(([actionId, signature]) => {
    if (actionId.trim().length === 0 || typeof signature !== 'string' || signature.length === 0) {
      throw new FarmValidationError('农场操作记录无效')
    }
  })
  return parsed
}

export function getEffectiveFarmTime(farm: FarmState, now: number): number {
  assertFarmTimestamp(now)
  return farm.lastAdvancedAt === null ? now : Math.max(now, farm.lastAdvancedAt)
}

export function getEffectiveFarmDateKey(farm: FarmState, now: number): string {
  return toLocalDateKey(getEffectiveFarmTime(farm, now))
}

export function advanceFarmTime(farm: FarmState, now: number): FarmState {
  const effectiveNow = getEffectiveFarmTime(farm, now)
  let changed = farm.lastAdvancedAt !== effectiveNow
  const animals = farm.animals.map((animal) => {
    if (
      animal.production !== null &&
      !animal.productPending &&
      animal.production.readyAt <= effectiveNow
    ) {
      changed = true
      return { ...animal, production: null, productPending: true }
    }
    return animal
  })
  if (!changed) return farm
  return { ...farm, animals, lastAdvancedAt: effectiveNow }
}

export function getPlotStatus(plot: FarmPlot, now: number): 'empty' | 'growing' | 'ready' {
  if (plot.crop === null) return 'empty'
  return plot.crop.readyAt <= now ? 'ready' : 'growing'
}

export function getAnimalStatus(
  animal: FarmAnimal,
  now: number,
): 'needs-feed' | 'producing' | 'ready' {
  if (animal.productPending || (animal.production !== null && animal.production.readyAt <= now)) {
    return 'ready'
  }
  return animal.production === null ? 'needs-feed' : 'producing'
}

export function getPendingHarvestCount(farm: FarmState, now: number): number {
  const effectiveNow = getEffectiveFarmTime(farm, now)
  const crops = farm.plots.filter((plot) => getPlotStatus(plot, effectiveNow) === 'ready').length
  const products = farm.animals.filter(
    (animal) => getAnimalStatus(animal, effectiveNow) === 'ready',
  ).length
  return crops + products
}

export function addFarmInventory(
  inventory: Readonly<Record<string, number>>,
  itemId: string,
  quantity: number,
): Record<string, number> {
  expectInteger(quantity, '物品数量', 1)
  const next = (inventory[itemId] ?? 0) + quantity
  if (!Number.isSafeInteger(next)) throw new FarmValidationError('物品数量超出安全整数')
  return { ...inventory, [itemId]: next }
}

export function removeFarmInventory(
  inventory: Readonly<Record<string, number>>,
  itemId: string,
  quantity: number,
): Record<string, number> {
  expectInteger(quantity, '物品数量', 1)
  const available = inventory[itemId] ?? 0
  if (available < quantity) throw new FarmValidationError(`${itemId} 数量不足`)
  return { ...inventory, [itemId]: available - quantity }
}
