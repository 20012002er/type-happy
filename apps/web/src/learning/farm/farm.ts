import { LEARNING_RULES } from '../config/rules'
import { getProcessingRecipe } from '../processing/recipes'
import { PROCESSING_PRODUCT_IDS } from '../processing/types'
import {
  addFarmInventory,
  advanceFarmTime,
  ANIMAL_KINDS,
  CROP_IDS,
  type CropId,
  type FarmActionRequest,
  type FarmAnimal,
  type FarmProductId,
  type FarmState,
  feedItemId,
  getEffectiveFarmTime,
  getFarmProductPrice,
  getPlotStatus,
  getWarehouseCategory,
  isCropId,
  type WarehouseCategory,
  removeFarmInventory,
  seedItemId,
} from './farm-state'

export interface WarehouseItem {
  itemId: string
  quantity: number
  salePrice: number | null
}

export interface WarehouseGroup {
  category: WarehouseCategory
  items: readonly WarehouseItem[]
}

function applyAction(
  farm: FarmState,
  request: FarmActionRequest,
  type: string,
  details: Readonly<Record<string, string | number>>,
  operation: (current: FarmState, effectiveNow: number) => FarmState,
): FarmState {
  if (request.actionId.trim().length === 0) throw new Error('操作 ID 不能为空')
  const signature = JSON.stringify({ type, now: request.now, ...details })
  const existing = farm.actions[request.actionId]
  if (existing !== undefined) {
    if (existing !== signature) throw new Error(`操作 ID 已用于另一项农场操作：${request.actionId}`)
    return farm
  }
  const current = advanceFarmTime(farm, request.now)
  const next = operation(current, getEffectiveFarmTime(current, request.now))
  return { ...next, actions: { ...next.actions, [request.actionId]: signature } }
}

function findPlot(farm: FarmState, plotId: string) {
  const plot = farm.plots.find((candidate) => candidate.id === plotId)
  if (!plot) throw new Error('土地不存在或尚未解锁')
  return plot
}

function findAnimal(farm: FarmState, animalId: string): FarmAnimal {
  const animal = farm.animals.find((candidate) => candidate.id === animalId)
  if (!animal) throw new Error('动物不存在')
  return animal
}

function updatePlot(farm: FarmState, plotId: string, crop: FarmState['plots'][number]['crop']) {
  return {
    ...farm,
    plots: farm.plots.map((plot) => (plot.id === plotId ? { ...plot, crop } : plot)),
  }
}

function updateAnimal(
  farm: FarmState,
  animalId: string,
  update: (animal: FarmAnimal) => FarmAnimal,
): FarmState {
  return {
    ...farm,
    animals: farm.animals.map((animal) => (animal.id === animalId ? update(animal) : animal)),
  }
}

export function claimStarterGift(farm: FarmState, request: FarmActionRequest): FarmState {
  return applyAction(farm, request, 'starter-gift', {}, (current) => {
    if (current.starterGiftClaimed) return current
    const gift = LEARNING_RULES.farm.starterGift
    let inventory = addFarmInventory(current.inventory, seedItemId('radish'), gift.radishSeeds)
    inventory = addFarmInventory(inventory, feedItemId('chicken'), gift.feed)
    return {
      ...current,
      starterGiftClaimed: true,
      inventory,
      plots: Array.from({ length: gift.unlockedPlots }, (_, index) => ({
        id: `plot-${index + 1}`,
        crop: null,
      })),
      buildings: { ...current.buildings, chickenCoop: { level: gift.chickenCoopLevel } },
      animals: [
        ...current.animals,
        { id: 'chicken-1', kind: 'chicken', production: null, productPending: false },
      ],
    }
  })
}

export function plantCrop(
  farm: FarmState,
  request: FarmActionRequest & { plotId: string; cropId: CropId },
): FarmState {
  if (!isCropId(request.cropId)) throw new Error('作物类型未知')
  return applyAction(
    farm,
    request,
    'plant',
    { plotId: request.plotId, cropId: request.cropId },
    (current, now) => {
      const plot = findPlot(current, request.plotId)
      if (plot.crop !== null) throw new Error('这块土地已有作物')
      const itemId = seedItemId(request.cropId)
      const inventory = removeFarmInventory(current.inventory, itemId, 1)
      const growthMs = LEARNING_RULES.farm.crops[request.cropId].growthMs
      return updatePlot({ ...current, inventory }, request.plotId, {
        cropId: request.cropId,
        plantedAt: now,
        readyAt: now + growthMs,
        fertilized: false,
      })
    },
  )
}

export function fertilizeCrop(
  farm: FarmState,
  request: FarmActionRequest & { plotId: string },
): FarmState {
  return applyAction(farm, request, 'fertilize', { plotId: request.plotId }, (current, now) => {
    const plot = findPlot(current, request.plotId)
    if (plot.crop === null) throw new Error('空地不能使用化肥')
    if (getPlotStatus(plot, now) === 'ready') throw new Error('成熟作物不能使用化肥')
    if (plot.crop.fertilized) throw new Error('每块作物最多使用一袋化肥')
    const inventory = removeFarmInventory(current.inventory, 'fertilizer', 1)
    const remaining = plot.crop.readyAt - now
    const readyAt =
      now + Math.ceil(remaining * LEARNING_RULES.farm.fertilizer.remainingTimeMultiplier)
    return updatePlot({ ...current, inventory }, request.plotId, {
      ...plot.crop,
      readyAt,
      fertilized: true,
    })
  })
}

export function harvestCrop(
  farm: FarmState,
  request: FarmActionRequest & { plotId: string },
): FarmState {
  return applyAction(farm, request, 'harvest-crop', { plotId: request.plotId }, (current, now) => {
    const plot = findPlot(current, request.plotId)
    if (plot.crop === null) throw new Error('这块土地没有作物')
    if (getPlotStatus(plot, now) !== 'ready') throw new Error('作物尚未成熟')
    const crop = LEARNING_RULES.farm.crops[plot.crop.cropId]
    const inventory = addFarmInventory(current.inventory, plot.crop.cropId, crop.harvestQuantity)
    return updatePlot({ ...current, inventory }, request.plotId, null)
  })
}

export function feedAnimal(
  farm: FarmState,
  request: FarmActionRequest & { animalId: string },
): FarmState {
  return applyAction(
    farm,
    request,
    'feed-animal',
    { animalId: request.animalId },
    (current, now) => {
      const animal = findAnimal(current, request.animalId)
      if (animal.productPending) throw new Error('请先收获已有产品')
      if (animal.production !== null) throw new Error('动物正在生产，无需重复喂食')
      const inventory = removeFarmInventory(current.inventory, feedItemId(animal.kind), 1)
      return updateAnimal({ ...current, inventory }, animal.id, (currentAnimal) => ({
        ...currentAnimal,
        production: {
          startedAt: now,
          readyAt: now + LEARNING_RULES.farm.animals[animal.kind].productionMs,
        },
      }))
    },
  )
}

export function collectAnimalProduct(
  farm: FarmState,
  request: FarmActionRequest & { animalId: string },
): FarmState {
  return applyAction(
    farm,
    request,
    'collect-animal-product',
    { animalId: request.animalId },
    (current) => {
      const animal = findAnimal(current, request.animalId)
      if (!animal.productPending) throw new Error('动物产品尚未成熟')
      const product = LEARNING_RULES.farm.animals[animal.kind].product
      const quantity = LEARNING_RULES.farm.animals[animal.kind].productQuantity
      const inventory = addFarmInventory(current.inventory, product, quantity)
      return updateAnimal({ ...current, inventory }, animal.id, (currentAnimal) => ({
        ...currentAnimal,
        productPending: false,
      }))
    },
  )
}

export function getWarehouse(farm: FarmState): readonly WarehouseGroup[] {
  const itemIds = [
    ...CROP_IDS,
    'egg',
    'milk',
    ...PROCESSING_PRODUCT_IDS,
    ...CROP_IDS.map((cropId) => seedItemId(cropId)),
    'fertilizer',
    ...ANIMAL_KINDS.map((kind) => feedItemId(kind)),
  ]
  const categories: WarehouseCategory[] = [
    'crops',
    'animal-products',
    'processed-products',
    'seeds',
    'fertilizer',
    'feed',
  ]
  return categories.map((category) => ({
    category,
    items: itemIds
      .filter((itemId) => getWarehouseCategory(itemId) === category)
      .map((itemId) => ({
        itemId,
        quantity: farm.inventory[itemId] ?? 0,
        salePrice:
          category === 'crops' || category === 'animal-products'
            ? getFarmProductPrice(itemId as FarmProductId)
            : category === 'processed-products'
              ? getProcessingRecipe(itemId).unitPrice
              : null,
      })),
  }))
}
