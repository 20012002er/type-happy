import { LEARNING_RULES } from '../config/rules'
import {
  addFarmInventory,
  advanceFarmTime,
  type FarmState,
  getEffectiveFarmDateKey,
  getEffectiveFarmTime,
  removeFarmInventory,
} from '../farm/farm-state'
import { DailySaleLimitError } from '../farm/farm-transactions'
import type { LearningSnapshot } from '../persistence/snapshot'
import { SettlementConflictError, settleWallet } from '../wallet/wallet'
import { getProcessingRecipe } from './recipes'
import { getProcessingPurchaseEligibility, getRecipeAvailability } from './state'
import {
  isProcessingProduct,
  PROCESSING_PRODUCT_IDS,
  type ProcessingProductId,
  type ProcessingTask,
} from './types'

export type ProcessingSaleSelection =
  { kind: 'item'; itemId: ProcessingProductId; quantity: number } | { kind: 'all' }

export interface ProcessingSaleLine {
  itemId: ProcessingProductId
  quantity: number
  unitPrice: number
  amount: number
}

export interface ProcessingSaleQuote {
  dateKey: string
  lines: readonly ProcessingSaleLine[]
  quantity: number
  amount: number
  remainingIncome: number
}

// 离线推进：按任务时间戳结算已完成加工，时钟回拨不回退（沿用农场有效时间）。
// 完成后只生成待收产出并停下计时，不自动收取、不自动开始下一轮。
function prepareProcessing(snapshot: LearningSnapshot, now: number): LearningSnapshot {
  const farm = advanceFarmTime(snapshot.farm, now)
  const effectiveNow = getEffectiveFarmTime(farm, now)
  const workshop = snapshot.processing.workshop
  let nextWorkshop = workshop
  if (workshop.activeTask !== null && workshop.activeTask.completesAt <= effectiveNow) {
    const task = workshop.activeTask
    const recipe = getProcessingRecipe(task.recipeId)
    nextWorkshop = {
      ...workshop,
      activeTask: null,
      pendingOutput: {
        taskId: task.id,
        productId: recipe.output.itemId,
        quantity: recipe.output.quantity,
        completedAt: task.completesAt,
      },
    }
  }
  if (farm === snapshot.farm && nextWorkshop === workshop) return snapshot
  return { ...snapshot, farm, processing: { ...snapshot.processing, workshop: nextWorkshop } }
}

export function settleProcessingWorkshop(
  snapshot: LearningSnapshot,
  now: number,
): LearningSnapshot {
  return prepareProcessing(snapshot, now)
}

function expectActionId(actionId: string): void {
  if (actionId.trim().length === 0) throw new Error('操作 ID 不能为空')
}

function duplicateProcessingAction(
  snapshot: LearningSnapshot,
  actionId: string,
  signature: string,
): boolean {
  const existing = snapshot.processing.actions[actionId]
  if (existing === undefined) return false
  if (existing !== signature) throw new Error(`操作 ID 已用于另一项加工操作：${actionId}`)
  return true
}

export function purchaseProcessingWorkshop(
  snapshot: LearningSnapshot,
  request: { settlementId: string; now: number },
): LearningSnapshot {
  const existing = snapshot.wallet.ledger.find(
    (entry) => entry.settlementId === request.settlementId,
  )
  if (existing) {
    if (existing.source !== 'processing-purchase' || existing.referenceId !== 'workshop') {
      throw new SettlementConflictError(request.settlementId)
    }
    settleWallet(snapshot.wallet, {
      settlementId: request.settlementId,
      occurredAt: request.now,
      source: 'processing-purchase',
      referenceId: 'workshop',
      direction: 'spend',
      amount: existing.amount,
    })
    return snapshot
  }
  const current = prepareProcessing(snapshot, request.now)
  const workshop = current.processing.workshop
  if (workshop.purchased) throw new Error('加工坊已购买，无需重复购买')
  const eligibility = getProcessingPurchaseEligibility(current.farm)
  if (!eligibility.eligible) {
    throw new Error(
      `累计手动收获 ${eligibility.requiredManualHarvestQuantity} 份后才能购买加工坊（当前 ${eligibility.manualHarvestQuantity} 份）`,
    )
  }
  const wallet = settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    source: 'processing-purchase',
    referenceId: 'workshop',
    direction: 'spend',
    amount: LEARNING_RULES.farm.processing.purchasePrice,
  })
  return {
    ...current,
    wallet,
    processing: { ...current.processing, workshop: { ...workshop, purchased: true } },
  }
}

export function startProcessingTask(
  snapshot: LearningSnapshot,
  request: { actionId: string; now: number; recipeId: string },
): LearningSnapshot {
  expectActionId(request.actionId)
  const signature = JSON.stringify({
    type: 'start-processing',
    now: request.now,
    recipeId: request.recipeId,
  })
  if (duplicateProcessingAction(snapshot, request.actionId, signature)) return snapshot
  const current = prepareProcessing(snapshot, request.now)
  const workshop = current.processing.workshop
  if (!workshop.purchased) throw new Error('请先购买加工坊')
  const recipe = getProcessingRecipe(request.recipeId)
  const availability = getRecipeAvailability(current.farm, recipe)
  if (!availability.available) {
    throw new Error(
      `配方尚未解锁：${availability.missing
        .map((entry) => `${entry.itemId} 还需手动收获 ${entry.required - entry.collected} 份`)
        .join('；')}`,
    )
  }
  if (workshop.pendingOutput !== null) throw new Error('请先收取待收加工品')
  if (workshop.activeTask !== null) throw new Error('加工位正在使用中')
  const shortages = Object.entries(recipe.inputs)
    .map(([itemId, required]) => ({
      itemId,
      required,
      available: current.farm.inventory[itemId] ?? 0,
    }))
    .filter((entry) => entry.available < entry.required)
  if (shortages.length > 0) {
    throw new Error(
      `原料不足：${shortages
        .map((entry) => `${entry.itemId} 还差 ${entry.required - entry.available} 件`)
        .join('；')}`,
    )
  }
  let inventory = current.farm.inventory
  for (const [itemId, quantity] of Object.entries(recipe.inputs)) {
    inventory = removeFarmInventory(inventory, itemId, quantity)
  }
  const effectiveNow = getEffectiveFarmTime(current.farm, request.now)
  const task: ProcessingTask = {
    id: `task-${request.actionId}`,
    recipeId: recipe.id,
    recipeVersion: recipe.version,
    startedAt: effectiveNow,
    completesAt: effectiveNow + recipe.durationMinutes * 60_000,
  }
  return {
    ...current,
    farm: { ...current.farm, inventory },
    processing: {
      ...current.processing,
      workshop: { ...workshop, activeTask: task },
      actions: { ...current.processing.actions, [request.actionId]: signature },
    },
  }
}

export function collectProcessingOutput(
  snapshot: LearningSnapshot,
  request: { actionId: string; now: number },
): LearningSnapshot {
  expectActionId(request.actionId)
  const signature = JSON.stringify({ type: 'collect-processing', now: request.now })
  if (duplicateProcessingAction(snapshot, request.actionId, signature)) return snapshot
  const current = prepareProcessing(snapshot, request.now)
  const workshop = current.processing.workshop
  if (!workshop.purchased) throw new Error('请先购买加工坊')
  if (workshop.pendingOutput === null) {
    throw new Error(
      workshop.activeTask !== null ? '加工尚未完成，不能提前收取' : '当前没有待收加工品',
    )
  }
  const output = workshop.pendingOutput
  const inventory = addFarmInventory(current.farm.inventory, output.productId, output.quantity)
  return {
    ...current,
    farm: { ...current.farm, inventory },
    processing: {
      ...current.processing,
      workshop: { purchased: true, activeTask: null, pendingOutput: null },
      actions: { ...current.processing.actions, [request.actionId]: signature },
    },
  }
}

function selectedProcessingIds(selection: ProcessingSaleSelection): readonly ProcessingProductId[] {
  if (selection.kind === 'item') {
    if (!isProcessingProduct(selection.itemId)) throw new Error('该物品不是加工品')
    return [selection.itemId]
  }
  if (selection.kind !== 'all') throw new Error('出售范围未知')
  return PROCESSING_PRODUCT_IDS
}

// 加工品与农产品共享每日出售收入上限（farm.saleIncomeByDate 跨类别累计）。
export function quoteProcessingSale(
  farm: FarmState,
  selection: ProcessingSaleSelection,
  now: number,
): ProcessingSaleQuote {
  const dateKey = getEffectiveFarmDateKey(farm, now)
  const usedIncome = farm.saleIncomeByDate[dateKey] ?? 0
  const remainingIncome = LEARNING_RULES.farm.dailySaleIncomeCap - usedIncome
  const itemIds = selectedProcessingIds(selection)
  if (selection.kind === 'item') {
    if (!Number.isSafeInteger(selection.quantity) || selection.quantity < 1) {
      throw new Error('出售数量必须是正整数')
    }
  }
  const lines: ProcessingSaleLine[] = []
  for (const itemId of itemIds) {
    const available = farm.inventory[itemId] ?? 0
    const quantity = selection.kind === 'item' ? selection.quantity : available
    if (selection.kind === 'item' && quantity > available) {
      throw new Error(`${itemId} 库存不足，当前可出售 ${available} 件`)
    }
    if (quantity === 0) continue
    const unitPrice = getProcessingRecipe(itemId).unitPrice
    const amount = quantity * unitPrice
    if (!Number.isSafeInteger(amount)) throw new Error('出售金额超出安全整数')
    lines.push({ itemId, quantity, unitPrice, amount })
  }
  if (lines.length === 0) throw new Error('没有可出售的加工品')
  const amount = lines.reduce((total, line) => total + line.amount, 0)
  if (!Number.isSafeInteger(amount)) throw new Error('出售金额超出安全整数')
  if (amount > remainingIncome) {
    const maximumQuantity =
      selection.kind === 'item'
        ? Math.min(
            farm.inventory[selection.itemId] ?? 0,
            Math.floor(remainingIncome / getProcessingRecipe(selection.itemId).unitPrice),
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

export function sellProcessingProducts(
  snapshot: LearningSnapshot,
  request: { settlementId: string; now: number; selection: ProcessingSaleSelection },
): LearningSnapshot {
  const key = JSON.stringify(request.selection)
  const existing = snapshot.wallet.ledger.find(
    (entry) => entry.settlementId === request.settlementId,
  )
  if (existing) {
    if (!existing.referenceId.startsWith(`processing-sale:${key}|`)) {
      throw new Error(`结算 ID 已用于另一项操作：${request.settlementId}`)
    }
    const wallet = settleWallet(snapshot.wallet, {
      settlementId: request.settlementId,
      occurredAt: request.now,
      source: 'processing-sale',
      referenceId: existing.referenceId,
      direction: 'earn',
      amount: existing.amount,
    })
    return wallet === snapshot.wallet ? snapshot : { ...snapshot, wallet }
  }
  const current = prepareProcessing(snapshot, request.now)
  const quote = quoteProcessingSale(current.farm, request.selection, request.now)
  const manifest = quote.lines.map((line) => `${line.itemId}:${line.quantity}`).join(',')
  const wallet = settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.now,
    source: 'processing-sale',
    referenceId: `processing-sale:${key}|${manifest}`,
    direction: 'earn',
    amount: quote.amount,
  })
  let inventory = current.farm.inventory
  for (const line of quote.lines) {
    const available = inventory[line.itemId] ?? 0
    if (available < line.quantity) throw new Error(`${line.itemId} 库存不足`)
    inventory = { ...inventory, [line.itemId]: available - line.quantity }
  }
  return {
    ...current,
    wallet,
    farm: {
      ...current.farm,
      inventory,
      saleIncomeByDate: {
        ...current.farm.saleIncomeByDate,
        [quote.dateKey]: (current.farm.saleIncomeByDate[quote.dateKey] ?? 0) + quote.amount,
      },
    },
  }
}
