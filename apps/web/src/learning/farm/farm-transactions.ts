import { LEARNING_RULES } from '../config/rules'
import { applyInventorySettlement } from '../persistence/inventory-transactions'
import type { LearningRepository } from '../persistence/repository'
import type { LearningSnapshot } from '../persistence/snapshot'
import { PROCESSING_PRODUCT_IDS } from '../processing/types'
import { SettlementConflictError, settleWallet, type WalletSource } from '../wallet/wallet'
import {
  addFarmInventory,
  advanceFarmTime,
  type AnimalKind,
  ANIMAL_KINDS,
  CROP_IDS,
  type CropId,
  type FarmProductId,
  type FarmState,
  feedItemId,
  type FeedItemId,
  getBuildingCapacity,
  getEffectiveFarmDateKey,
  getFarmProductPrice,
  getWarehouseCategory,
  isAnimalKind,
  isFarmProduct,
  seedItemId,
} from './farm-state'

export type FarmSupplyItemId = `${CropId}-seed` | 'fertilizer' | FeedItemId

export type FarmSaleSelection =
  | { kind: 'item'; itemId: FarmProductId; quantity: number }
  | { kind: 'category'; category: 'crops' | 'animal-products' }
  | { kind: 'all' }

export interface FarmSaleLine {
  itemId: FarmProductId
  quantity: number
  unitPrice: number
  amount: number
}

export interface FarmSaleQuote {
  dateKey: string
  lines: readonly FarmSaleLine[]
  quantity: number
  amount: number
  remainingIncome: number
}

export interface RecoverySupplyStatus {
  eligible: boolean
  claimedToday: boolean
  reasons: readonly string[]
}

export class DailySaleLimitError extends Error {
  readonly remainingIncome: number
  readonly maximumQuantity: number | null

  constructor(remainingIncome: number, maximumQuantity: number | null = null) {
    super(
      maximumQuantity === null
        ? `超出今日出售收入上限，还可获得 ${remainingIncome} 金币`
        : `超出今日出售收入上限，当前最多可出售 ${maximumQuantity} 件`,
    )
    this.name = 'DailySaleLimitError'
    this.remainingIncome = remainingIncome
    this.maximumQuantity = maximumQuantity
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label}必须是正整数`)
}

function prepareFarm(snapshot: LearningSnapshot, now: number): FarmState {
  return advanceFarmTime(snapshot.farm, now)
}

function duplicateAssetOperation(
  snapshot: LearningSnapshot,
  request: { settlementId: string; now: number },
  source: WalletSource,
  referencePrefix: string,
): LearningSnapshot | null {
  const existing = snapshot.wallet.ledger.find(
    (entry) => entry.settlementId === request.settlementId,
  )
  if (!existing) return null
  if (!existing.referenceId.startsWith(referencePrefix)) {
    throw new SettlementConflictError(request.settlementId)
  }
  settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    source,
    referenceId: existing.referenceId,
    direction: 'spend',
    amount: existing.amount,
  })
  return snapshot
}

function supplyUnitPrice(itemId: string): number | null {
  const cropId = CROP_IDS.find((candidate) => seedItemId(candidate) === itemId)
  if (cropId) return LEARNING_RULES.farm.crops[cropId].seedPrice
  if (itemId === 'fertilizer') return LEARNING_RULES.farm.fertilizer.price
  const kind = ANIMAL_KINDS.find((candidate) => feedItemId(candidate) === itemId)
  return kind ? LEARNING_RULES.farm.animals[kind].feedPrice : null
}

export function purchaseFarmSupplies(
  snapshot: LearningSnapshot,
  request: {
    settlementId: string
    now: number
    itemId: FarmSupplyItemId
    quantity: number
  },
): LearningSnapshot {
  const unitPrice = supplyUnitPrice(request.itemId)
  if (unitPrice === null) throw new Error('该物品不是可购买的种子、化肥或饲料')
  const current = { ...snapshot, farm: prepareFarm(snapshot, request.now) }
  return applyInventorySettlement(current, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    itemId: request.itemId,
    direction: 'purchase',
    quantity: request.quantity,
    unitPrice,
  })
}

export function purchaseNextPlot(
  snapshot: LearningSnapshot,
  request: { settlementId: string; now: number },
): LearningSnapshot {
  const duplicate = duplicateAssetOperation(snapshot, request, 'farm-purchase', 'plot-')
  if (duplicate) return duplicate
  const farm = prepareFarm(snapshot, request.now)
  const nextPlotNumber = farm.plots.length + 1
  const price = LEARNING_RULES.farm.plots.purchasePrices[nextPlotNumber - 5]
  if (!farm.starterGiftClaimed) throw new Error('请先领取新手礼包')
  if (nextPlotNumber < 5 || nextPlotNumber > LEARNING_RULES.farm.plots.maximum || !price) {
    throw new Error('土地已全部购买')
  }
  const plotId = `plot-${nextPlotNumber}`
  const wallet = settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    source: 'farm-purchase',
    referenceId: plotId,
    direction: 'spend',
    amount: price,
  })
  return {
    ...snapshot,
    wallet,
    farm: { ...farm, plots: [...farm.plots, { id: plotId, crop: null }] },
  }
}

export function purchaseOrUpgradeBuilding(
  snapshot: LearningSnapshot,
  request: { settlementId: string; now: number; building: 'chickenCoop' | 'cowshed' },
): LearningSnapshot {
  if (request.building !== 'chickenCoop' && request.building !== 'cowshed') {
    throw new Error('建筑类型未知')
  }
  const duplicate = duplicateAssetOperation(
    snapshot,
    request,
    'farm-building',
    `${request.building}:`,
  )
  if (duplicate) return duplicate
  const farm = prepareFarm(snapshot, request.now)
  const level = farm.buildings[request.building].level
  if (!farm.starterGiftClaimed) throw new Error('请先领取新手礼包')
  if (request.building === 'chickenCoop' && level !== 1) {
    throw new Error('鸡舍已升至最高等级')
  }
  if (request.building === 'cowshed') {
    if (level >= 2) throw new Error('牛棚已升至最高等级')
    const unlockAtPlot = LEARNING_RULES.farm.buildings.cowshed.unlockAtPlot
    if (level === 0 && farm.plots.length < unlockAtPlot) {
      throw new Error(`购买第 ${unlockAtPlot} 块土地后解锁牛棚`)
    }
  }
  const rules = LEARNING_RULES.farm.buildings[request.building]
  const price =
    level === 0 ? ('purchasePrice' in rules ? rules.purchasePrice : 0) : rules.upgradePrice
  const nextLevel = level + 1
  const wallet = settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    source: 'farm-building',
    referenceId: `${request.building}:lv-${nextLevel}`,
    direction: 'spend',
    amount: price,
  })
  return {
    ...snapshot,
    wallet,
    farm: {
      ...farm,
      buildings: { ...farm.buildings, [request.building]: { level: nextLevel } },
    },
  }
}

export function purchaseFarmAnimal(
  snapshot: LearningSnapshot,
  request: { settlementId: string; now: number; kind: AnimalKind },
): LearningSnapshot {
  if (!isAnimalKind(request.kind)) throw new Error('动物类型未知')
  const duplicate = duplicateAssetOperation(
    snapshot,
    request,
    'farm-purchase',
    `animal:${request.kind}-`,
  )
  if (duplicate) return duplicate
  const farm = prepareFarm(snapshot, request.now)
  const building = request.kind === 'chicken' ? 'chickenCoop' : 'cowshed'
  if (getBuildingCapacity(farm, building) <= 0) throw new Error('请先购买对应建筑')
  const count = farm.animals.filter((animal) => animal.kind === request.kind).length
  if (count >= getBuildingCapacity(farm, building)) throw new Error('建筑栏位不足，请先升级')
  const animalId = `${request.kind}-${count + 1}`
  const wallet = settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    source: 'farm-purchase',
    referenceId: `animal:${animalId}`,
    direction: 'spend',
    amount: LEARNING_RULES.farm.animals[request.kind].purchasePrice,
  })
  return {
    ...snapshot,
    wallet,
    farm: {
      ...farm,
      animals: [
        ...farm.animals,
        { id: animalId, kind: request.kind, production: null, productPending: false },
      ],
    },
  }
}

function selectionKey(selection: FarmSaleSelection): string {
  return JSON.stringify(selection)
}

function selectedProductIds(selection: FarmSaleSelection): readonly FarmProductId[] {
  if (selection.kind === 'item') {
    if (!isFarmProduct(selection.itemId)) throw new Error('种子和投入品不可出售')
    return [selection.itemId]
  }
  if (selection.kind === 'category') {
    if (selection.category !== 'crops' && selection.category !== 'animal-products') {
      throw new Error('该仓库类别不可出售')
    }
    return ([...CROP_IDS, 'egg', 'milk'] as FarmProductId[]).filter(
      (itemId) => getWarehouseCategory(itemId) === selection.category,
    )
  }
  if (selection.kind !== 'all') throw new Error('出售范围未知')
  return [...CROP_IDS, 'egg', 'milk']
}

export function quoteFarmSale(
  farm: FarmState,
  selection: FarmSaleSelection,
  now: number,
): FarmSaleQuote {
  const dateKey = getEffectiveFarmDateKey(farm, now)
  const usedIncome = farm.saleIncomeByDate[dateKey] ?? 0
  const remainingIncome = LEARNING_RULES.farm.dailySaleIncomeCap - usedIncome
  const itemIds = selectedProductIds(selection)
  if (selection.kind === 'item') assertPositiveInteger(selection.quantity, '出售数量')
  const lines: FarmSaleLine[] = []
  for (const itemId of itemIds) {
    const available = farm.inventory[itemId] ?? 0
    const quantity = selection.kind === 'item' ? selection.quantity : available
    if (selection.kind === 'item' && quantity > available) {
      throw new Error(`${itemId} 库存不足，当前可出售 ${available} 件`)
    }
    if (quantity === 0) continue
    const unitPrice = getFarmProductPrice(itemId)
    const amount = quantity * unitPrice
    if (!Number.isSafeInteger(amount)) throw new Error('出售金额超出安全整数')
    lines.push({ itemId, quantity, unitPrice, amount })
  }
  if (lines.length === 0) throw new Error('没有可出售的农产品')
  const amount = lines.reduce((total, line) => total + line.amount, 0)
  if (!Number.isSafeInteger(amount)) throw new Error('出售金额超出安全整数')
  if (amount > remainingIncome) {
    const maximumQuantity =
      selection.kind === 'item'
        ? Math.min(
            farm.inventory[selection.itemId] ?? 0,
            Math.floor(remainingIncome / getFarmProductPrice(selection.itemId)),
          )
        : null
    throw new DailySaleLimitError(remainingIncome, maximumQuantity)
  }
  return {
    dateKey,
    lines,
    quantity: lines.reduce((total, line) => total + line.quantity, 0),
    amount,
    remainingIncome,
  }
}

export function sellFarmProducts(
  snapshot: LearningSnapshot,
  request: { settlementId: string; now: number; selection: FarmSaleSelection },
): LearningSnapshot {
  const key = selectionKey(request.selection)
  const existing = snapshot.wallet.ledger.find(
    (entry) => entry.settlementId === request.settlementId,
  )
  if (existing) {
    if (!existing.referenceId.startsWith(`sale:${key}|`)) {
      throw new Error(`结算 ID 已用于另一项操作：${request.settlementId}`)
    }
    const wallet = settleWallet(snapshot.wallet, {
      settlementId: request.settlementId,
      occurredAt: request.now,
      source: 'farm-sale',
      referenceId: existing.referenceId,
      direction: 'earn',
      amount: existing.amount,
    })
    return wallet === snapshot.wallet ? snapshot : { ...snapshot, wallet }
  }

  const farm = prepareFarm(snapshot, request.now)
  const quote = quoteFarmSale(farm, request.selection, request.now)
  const manifest = quote.lines.map((line) => `${line.itemId}:${line.quantity}`).join(',')
  const wallet = settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    source: 'farm-sale',
    referenceId: `sale:${key}|${manifest}`,
    direction: 'earn',
    amount: quote.amount,
  })
  let inventory = farm.inventory
  for (const line of quote.lines) {
    const available = inventory[line.itemId] ?? 0
    if (available < line.quantity) throw new Error(`${line.itemId} 库存不足`)
    inventory = { ...inventory, [line.itemId]: available - line.quantity }
  }
  return {
    ...snapshot,
    wallet,
    farm: {
      ...farm,
      inventory,
      saleIncomeByDate: {
        ...farm.saleIncomeByDate,
        [quote.dateKey]: (farm.saleIncomeByDate[quote.dateKey] ?? 0) + quote.amount,
      },
    },
  }
}

export function getRecoverySupplyStatus(
  snapshot: LearningSnapshot,
  now: number,
): RecoverySupplyStatus {
  const farm = snapshot.farm
  const dateKey = getEffectiveFarmDateKey(farm, now)
  const claimedToday = farm.recoveryClaimDates.includes(dateKey)
  const reasons: string[] = []
  if (!farm.starterGiftClaimed) reasons.push('请先领取新手礼包')
  const minimumSeedPrice = Math.min(
    ...CROP_IDS.map((cropId) => LEARNING_RULES.farm.crops[cropId].seedPrice),
  )
  if (snapshot.wallet.balance >= minimumSeedPrice) {
    reasons.push('金币仍足够购买最低价格种子')
  }
  if ([...CROP_IDS, 'egg', 'milk'].some((itemId) => (farm.inventory[itemId] ?? 0) > 0)) {
    reasons.push('仓库仍有可出售农产品')
  }
  if (farm.plots.some((plot) => plot.crop !== null)) reasons.push('土地仍有生长中或成熟作物')
  if (farm.animals.some((animal) => animal.production !== null || animal.productPending)) {
    reasons.push('动物仍在生产或有待收产品')
  }
  const workshop = snapshot.processing.workshop
  if (workshop.activeTask !== null) reasons.push('加工坊仍有加工中的原料')
  if (workshop.pendingOutput !== null) reasons.push('加工坊仍有待收加工品')
  if (PROCESSING_PRODUCT_IDS.some((itemId) => (farm.inventory[itemId] ?? 0) > 0)) {
    reasons.push('仓库仍有可出售加工品')
  }
  const seedsOrFeed = [
    ...CROP_IDS.map((cropId) => seedItemId(cropId)),
    ...ANIMAL_KINDS.map((kind) => feedItemId(kind)),
  ]
  if (seedsOrFeed.some((itemId) => (farm.inventory[itemId] ?? 0) > 0)) {
    reasons.push('仓库仍有种子或饲料')
  }
  if (claimedToday) reasons.push('今日已领取过补给')
  return { eligible: reasons.length === 0, claimedToday, reasons }
}

export function claimRecoverySupply(
  snapshot: LearningSnapshot,
  request: { actionId: string; now: number },
): LearningSnapshot {
  if (request.actionId.trim().length === 0) throw new Error('操作 ID 不能为空')
  const signature = JSON.stringify({ type: 'recovery-supply', now: request.now })
  const existing = snapshot.farm.actions[request.actionId]
  if (existing !== undefined) {
    if (existing !== signature) throw new Error(`操作 ID 已用于另一项农场操作：${request.actionId}`)
    return snapshot
  }
  const farm = prepareFarm(snapshot, request.now)
  const current = { ...snapshot, farm }
  const status = getRecoverySupplyStatus(current, request.now)
  if (!status.eligible) throw new Error(`暂不满足补给条件：${status.reasons.join('；')}`)
  const dateKey = getEffectiveFarmDateKey(farm, request.now)
  return {
    ...snapshot,
    farm: {
      ...farm,
      inventory: addFarmInventory(
        farm.inventory,
        seedItemId('radish'),
        LEARNING_RULES.farm.recoverySupply.radishSeeds,
      ),
      recoveryClaimDates: [...farm.recoveryClaimDates, dateKey],
      actions: { ...farm.actions, [request.actionId]: signature },
    },
  }
}

export function transactFarmOperation(
  repository: LearningRepository,
  expectedRevision: number,
  operation: (snapshot: LearningSnapshot) => LearningSnapshot,
): LearningSnapshot {
  return repository.transact(expectedRevision, operation)
}
