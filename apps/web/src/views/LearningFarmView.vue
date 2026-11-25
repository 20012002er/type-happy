<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import FarmScene from '../components/learning/FarmScene.vue'
import LearningConfirmDialog from '../components/learning/LearningConfirmDialog.vue'
import LearningPage from '../components/learning/LearningPage.vue'
import { LEARNING_RULES } from '../learning/config/rules'
import { getWarehouse } from '../learning/farm/farm'
import type { FarmFeedbackKind } from '../learning/farm/scene-renderer'
import {
  getRecoverySupplyStatus,
  quoteFarmSale,
  type FarmSaleQuote,
  type FarmSaleSelection,
  type FarmSupplyItemId,
} from '../learning/farm/farm-transactions'
import {
  CROP_IDS,
  getAnimalStatus,
  getBuildingCapacity,
  getEffectiveFarmDateKey,
  getEffectiveFarmTime,
  getPendingHarvestCount,
  getPlotStatus,
  isFarmProduct,
  type AnimalKind,
  type CropId,
  type FarmProductId,
  type WarehouseCategory,
} from '../learning/farm/farm-state'
import {
  quoteProcessingSale,
  type ProcessingSaleQuote,
  type ProcessingSaleSelection,
} from '../learning/processing/operations'
import { PROCESSING_RECIPES, getProcessingRecipe, getProcessingSlotStatus } from '../learning/processing/recipes'
import { getProcessingPurchaseEligibility, getRecipeAvailability } from '../learning/processing/state'
import { isProcessingProduct, type ProcessingProductId } from '../learning/processing/types'
import { useLearningStore, type FarmOperation, type ProcessingOperation } from '../stores/learning'
import '../learning/farm.css'

const learning = useLearningStore()
const activeTab = ref<'farm' | 'processing' | 'shop' | 'warehouse'>('farm')
const displayNow = ref(learning.getNow())
const selectedKey = ref<string | null>('plot:plot-1')
const plantingCrop = ref<CropId>('radish')
const saleQuantities = ref<Record<string, number>>({})
const sceneRef = ref<InstanceType<typeof FarmScene> | null>(null)
let timer: number | undefined

const cropNames: Record<CropId, string> = { radish: '萝卜', wheat: '小麦', corn: '玉米', pumpkin: '南瓜' }
const itemNames: Record<string, string> = {
  ...Object.fromEntries(CROP_IDS.map((cropId) => [cropId, cropNames[cropId]])),
  ...Object.fromEntries(CROP_IDS.map((cropId) => [`${cropId}-seed`, `${cropNames[cropId]}种子`])),
  egg: '鸡蛋',
  milk: '牛奶',
  flour: '面粉',
  cream: '奶油',
  'egg-milk-pudding': '蛋奶布丁',
  fertilizer: '化肥',
  'chicken-feed': '鸡饲料',
  'cow-feed': '牛饲料',
}
const categoryNames: Record<WarehouseCategory, string> = {
  crops: '作物',
  'animal-products': '动物产品',
  'processed-products': '加工品',
  seeds: '种子',
  fertilizer: '化肥',
  feed: '饲料',
}
const supplies: readonly {
  itemId: FarmSupplyItemId
  price: number
  description: string
}[] = [
  ...CROP_IDS.map((cropId) => ({
    itemId: `${cropId}-seed` as FarmSupplyItemId,
    price: LEARNING_RULES.farm.crops[cropId].seedPrice,
    description: `${cropNames[cropId]} · ${formatDuration(LEARNING_RULES.farm.crops[cropId].growthMs)}成熟，收获 1 个`,
  })),
  { itemId: 'fertilizer', price: LEARNING_RULES.farm.fertilizer.price, description: '使当前作物剩余生长时间缩短 50%' },
  { itemId: 'chicken-feed', price: LEARNING_RULES.farm.animals.chicken.feedPrice, description: '喂食 1 份，1 小时后产出 1 个鸡蛋' },
  { itemId: 'cow-feed', price: LEARNING_RULES.farm.animals.cow.feedPrice, description: '喂食 1 份，2 小时后产出 1 份牛奶' },
]

interface QuoteResult {
  quote: FarmSaleQuote | null
  error: string
}

interface Confirmation {
  title: string
  description: string
  lines: readonly string[]
  confirmLabel: string
  operations: readonly (FarmOperation | ProcessingOperation)[]
}

const confirmation = ref<Confirmation | null>(null)
const farm = computed(() => learning.snapshot.farm)
const effectiveNow = computed(() => getEffectiveFarmTime(farm.value, displayNow.value))
const pendingNow = computed(() => getPendingHarvestCount(farm.value, displayNow.value))
const warehouse = computed(() => getWarehouse(farm.value))
const recovery = computed(() => getRecoverySupplyStatus(learning.snapshot, displayNow.value))
const saleDateKey = computed(() => getEffectiveFarmDateKey(farm.value, displayNow.value))
const remainingSaleIncome = computed(
  () => LEARNING_RULES.farm.dailySaleIncomeCap - (farm.value.saleIncomeByDate[saleDateKey.value] ?? 0),
)
const selectedPlot = computed(() => {
  if (!selectedKey.value?.startsWith('plot:')) return null
  const id = selectedKey.value.slice(5)
  return farm.value.plots.find((plot) => plot.id === id) ?? null
})
const selectedAnimal = computed(() => {
  if (!selectedKey.value?.startsWith('animal:')) return null
  const id = selectedKey.value.slice(7)
  return farm.value.animals.find((animal) => animal.id === id) ?? null
})
const selectedPlotStatus = computed(() =>
  selectedPlot.value ? getPlotStatus(selectedPlot.value, effectiveNow.value) : null,
)
const selectedAnimalStatus = computed(() =>
  selectedAnimal.value ? getAnimalStatus(selectedAnimal.value, effectiveNow.value) : null,
)
const selectedSeedCount = computed(() => farm.value.inventory[`${plantingCrop.value}-seed`] ?? 0)
const fertilizerCount = computed(() => farm.value.inventory.fertilizer ?? 0)
const nextPlotNumber = computed(() => farm.value.plots.length + 1)
const nextPlotPrice = computed(
  () => LEARNING_RULES.farm.plots.purchasePrices[farm.value.plots.length - 4] as number | undefined,
)
const buildingCards = computed(() =>
  (['chickenCoop', 'cowshed'] as const).map((building) => {
    const level = farm.value.buildings[building].level
    const rules = LEARNING_RULES.farm.buildings[building]
    const unlockAtPlot = 'unlockAtPlot' in rules ? rules.unlockAtPlot : 0
    const maximum = level >= 2
    const locked = building === 'cowshed' && level === 0 && farm.value.plots.length < unlockAtPlot
    const price = maximum ? null : level === 0 && 'purchasePrice' in rules ? rules.purchasePrice : rules.upgradePrice
    const capacity = getBuildingCapacity(farm.value, building)
    const nextCapacity = maximum ? capacity : level === 0 ? rules.initialCapacity : rules.upgradedCapacity
    const shortage = price === null ? 0 : Math.max(0, price - learning.today.walletBalance)
    const name = building === 'chickenCoop' ? '鸡舍' : '牛棚'
    let reason = ''
    if (maximum) reason = `${name}已升至最高等级`
    else if (locked) reason = `购买第 ${unlockAtPlot} 块土地后解锁`
    else if (shortage > 0) reason = `学习金币不足，还差 ${shortage} 金币`
    return { building, name, level, maximum, locked, price, capacity, nextCapacity, shortage, reason }
  }),
)
const animalCards = computed(() =>
  (['chicken', 'cow'] as const).map((kind) => {
    const building = kind === 'chicken' ? 'chickenCoop' : 'cowshed'
    const rules = LEARNING_RULES.farm.animals[kind]
    const count = farm.value.animals.filter((animal) => animal.kind === kind).length
    const capacity = getBuildingCapacity(farm.value, building)
    const shortage = Math.max(0, rules.purchasePrice - learning.today.walletBalance)
    let reason = ''
    if (capacity === 0) reason = kind === 'chicken' ? '请先领取新手礼包获得鸡舍' : '请先购买牛棚'
    else if (count >= capacity) reason = '栏位已满，请先升级建筑'
    else if (shortage > 0) reason = `学习金币不足，还差 ${shortage} 金币`
    return { kind, building, rules, count, capacity, shortage, reason }
  }),
)

function getQuote(selection: FarmSaleSelection): QuoteResult {
  try {
    return { quote: quoteFarmSale(farm.value, selection, displayNow.value), error: '' }
  } catch (error) {
    return { quote: null, error: error instanceof Error ? error.message : '暂时无法计算出售金额' }
  }
}

const productRows = computed(() =>
  warehouse.value
    .filter((group) => group.category === 'crops' || group.category === 'animal-products')
    .flatMap((group) =>
      group.items.filter((item) => isFarmProduct(item.itemId)).map((item) => {
        const selection: FarmSaleSelection = {
          kind: 'item',
          itemId: item.itemId as FarmProductId,
          quantity: saleQuantities.value[item.itemId] ?? 1,
        }
        return { ...item, category: group.category, selection, ...getQuote(selection) }
      }),
    ),
)
const categoryQuotes = computed(() => ({
  crops: getQuote({ kind: 'category', category: 'crops' }),
  'animal-products': getQuote({ kind: 'category', category: 'animal-products' }),
  all: getQuote({ kind: 'all' }),
}))

const workshop = computed(() => learning.snapshot.processing.workshop)
const eligibility = computed(() => getProcessingPurchaseEligibility(farm.value))
const slotStatus = computed(() => getProcessingSlotStatus(workshop.value, effectiveNow.value))
const activeRecipe = computed(() =>
  workshop.value.activeTask ? getProcessingRecipe(workshop.value.activeTask.recipeId) : null,
)
const pendingOutput = computed(() => workshop.value.pendingOutput)
const pendingProduct = computed(() => {
  if (pendingOutput.value) {
    return { itemId: pendingOutput.value.productId, quantity: pendingOutput.value.quantity }
  }
  const recipe = activeRecipe.value
  return recipe ? { itemId: recipe.output.itemId, quantity: recipe.output.quantity } : null
})
const workshopPrice = LEARNING_RULES.farm.processing.purchasePrice
const workshopShortage = computed(() => Math.max(0, workshopPrice - learning.today.walletBalance))
const motionReduced = computed(() => learning.animationsReduced || learning.farmMotionReduced)
const processableRawIds = [...new Set(PROCESSING_RECIPES.flatMap((recipe) => Object.keys(recipe.inputs)))]

const recipeCards = computed(() =>
  PROCESSING_RECIPES.map((recipe) => {
    const availability = getRecipeAvailability(farm.value, recipe)
    const inputs = Object.entries(recipe.inputs).map(([itemId, required]) => {
      const available = farm.value.inventory[itemId] ?? 0
      return { itemId, required, available, shortage: Math.max(0, required - available) }
    })
    let reason = ''
    if (!workshop.value.purchased) reason = '请先购买加工坊'
    else if (!availability.available) {
      reason = `解锁条件：${availability.missing
        .map((entry) => `还需手动收获${itemNames[entry.itemId]} × ${entry.required - entry.collected}`)
        .join('、')}`
    } else if (workshop.value.pendingOutput !== null) reason = '请先收取待收加工品'
    else if (workshop.value.activeTask !== null) reason = '加工位正在使用中'
    else {
      const shortages = inputs.filter((input) => input.shortage > 0)
      if (shortages.length > 0) {
        reason = `原料不足：${shortages
          .map((input) => `${itemNames[input.itemId]}还差 ${input.shortage} 件`)
          .join('、')}`
      }
    }
    return { recipe, availability, inputs, reason }
  }),
)

interface ProcessingQuoteResult {
  quote: ProcessingSaleQuote | null
  error: string
}

function getProcessingQuote(selection: ProcessingSaleSelection): ProcessingQuoteResult {
  try {
    return { quote: quoteProcessingSale(farm.value, selection, displayNow.value), error: '' }
  } catch (error) {
    return { quote: null, error: error instanceof Error ? error.message : '暂时无法计算出售金额' }
  }
}

const processedRows = computed(() =>
  warehouse.value
    .filter((group) => group.category === 'processed-products')
    .flatMap((group) =>
      group.items.filter((item) => isProcessingProduct(item.itemId)).map((item) => {
        const selection: ProcessingSaleSelection = {
          kind: 'item',
          itemId: item.itemId as ProcessingProductId,
          quantity: saleQuantities.value[item.itemId] ?? 1,
        }
        return { ...item, selection, ...getProcessingQuote(selection) }
      }),
    ),
)
const processingAllQuote = computed(() => getProcessingQuote({ kind: 'all' }))
// 农产品与加工品共享每日 60 金币上限：全部可售清单按全部库存合计校验额度，
// 任一类别单独超限也先提示分类/分项出售，避免静默漏卖
const allSale = computed(() => {
  const farmQuote = categoryQuotes.value.all.quote
  const procQuote = processingAllQuote.value.quote
  const sellableItems = warehouse.value
    .filter(
      (group) =>
        group.category === 'crops' ||
        group.category === 'animal-products' ||
        group.category === 'processed-products',
    )
    .flatMap((group) => group.items)
    .filter((item) => item.quantity > 0 && item.salePrice !== null)
  const quantity = sellableItems.reduce((total, item) => total + item.quantity, 0)
  const amount = sellableItems.reduce((total, item) => total + item.quantity * (item.salePrice ?? 0), 0)
  if (quantity === 0) {
    return { farmQuote, procQuote, quantity, amount, error: '没有可出售的农产品或加工品' }
  }
  if (amount > remainingSaleIncome.value) {
    return {
      farmQuote,
      procQuote,
      quantity,
      amount,
      error: `全部可售物品合计 ${amount} 金币，超出今日剩余可售额度 ${remainingSaleIncome.value} 金币，请分类或分项出售`,
    }
  }
  return { farmQuote, procQuote, quantity, amount, error: '' }
})

const guideReopened = ref(false)
const guideVisible = computed(
  () =>
    workshop.value.purchased &&
    (!learning.preferences.processingGuideSeen || guideReopened.value),
)
const unlockNoticeVisible = computed(
  () =>
    eligibility.value.eligible &&
    !workshop.value.purchased &&
    !learning.preferences.processingUnlockSeen,
)
const completionNotice = ref('')
let celebratedTaskId: string | null = null

// 完成庆祝只在会话内从加工中转为可收取时播放一次；刷新/重入只显示当前状态
watch(slotStatus, (status, previous) => {
  if (status !== 'ready-to-collect' || previous !== 'processing') return
  const task = workshop.value.activeTask
  const output = workshop.value.pendingOutput
  const taskId = output?.taskId ?? task?.id ?? null
  if (!taskId || celebratedTaskId === taskId) return
  celebratedTaskId = taskId
  const product = pendingProduct.value
  completionNotice.value = product
    ? `加工完成：${itemNames[product.itemId]} × ${product.quantity} 待收取。`
    : '加工完成，加工品待收取。'
  if (!motionReduced.value) sceneRef.value?.playFeedback('building:processing', 'process-collect')
})

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function shortage(price: number): number {
  return Math.max(0, price - learning.today.walletBalance)
}

function selectObject(key: string): void {
  selectedKey.value = key
  learning.clearMessages()
  if (key === 'building:processing') activeTab.value = 'processing'
}

function switchTab(tab: 'farm' | 'processing' | 'shop' | 'warehouse'): void {
  activeTab.value = tab
  learning.clearMessages()
}

function isProcessingOperation(
  operation: FarmOperation | ProcessingOperation,
): operation is ProcessingOperation {
  return (
    operation.type === 'buy-workshop' ||
    operation.type === 'start-processing' ||
    operation.type === 'collect-processing' ||
    operation.type === 'sell-processing'
  )
}

function execute(operation: FarmOperation | ProcessingOperation): boolean {
  learning.clearMessages()
  const balanceBefore = learning.today.walletBalance
  const succeeded = isProcessingOperation(operation)
    ? learning.performProcessingOperation(operation)
    : learning.performFarmOperation(operation)
  displayNow.value = learning.getNow()
  scheduleRefresh()
  // 成功效果只在保存成功后播放；失败保留原视觉状态，不展示到账效果（T09-07）
  if (succeeded) {
    const target = feedbackTarget(operation)
    if (target) sceneRef.value?.playFeedback(target.id, target.kind)
    const delta = learning.today.walletBalance - balanceBefore
    if (delta !== 0) sceneRef.value?.playCoins(delta)
    if (operation.type === 'buy-workshop') {
      // 建成引导只自动开放一次；之后可通过“查看使用引导”重看
      learning.updatePreferences({ processingGuideSeen: true })
      guideReopened.value = true
    }
    if (operation.type === 'collect-processing') completionNotice.value = ''
  }
  return succeeded
}

function feedbackTarget(
  operation: FarmOperation | ProcessingOperation,
): { id: string; kind: FarmFeedbackKind } | null {
  switch (operation.type) {
    case 'plant':
      return { id: `plot:${operation.plotId}`, kind: 'plant' }
    case 'fertilize':
      return { id: `plot:${operation.plotId}`, kind: 'fertilize' }
    case 'harvest':
      return { id: `plot:${operation.plotId}`, kind: 'harvest' }
    case 'feed':
      return { id: `animal:${operation.animalId}`, kind: 'feed' }
    case 'collect':
      return { id: `animal:${operation.animalId}`, kind: 'collect' }
    case 'buy-plot':
      return { id: `plot:plot-${farm.value.plots.length}`, kind: 'buy' }
    case 'buy-building':
      return { id: `building:${operation.building}`, kind: 'buy' }
    case 'buy-animal': {
      const count = farm.value.animals.filter((animal) => animal.kind === operation.kind).length
      return { id: `animal:${operation.kind}-${count}`, kind: 'buy' }
    }
    case 'buy-workshop':
      return { id: 'building:processing', kind: 'buy' }
    case 'start-processing':
      return { id: 'building:processing', kind: 'process-start' }
    case 'collect-processing':
      return { id: 'building:processing', kind: 'process-collect' }
    default:
      return null
  }
}

function claimGift(): void {
  if (execute({ type: 'claim-gift' })) selectedKey.value = 'plot:plot-1'
}

function buyAnimal(kind: AnimalKind): void {
  const nextId = `${kind}-${farm.value.animals.filter((animal) => animal.kind === kind).length + 1}`
  if (execute({ type: 'buy-animal', kind })) selectedKey.value = `animal:${nextId}`
}

function openConfirmation(input: Confirmation): void {
  learning.clearMessages()
  confirmation.value = input
}

function buyNextPlot(): void {
  if (nextPlotPrice.value === undefined) return
  openConfirmation({
    title: `购买第 ${nextPlotNumber.value} 块土地？`,
    description: '土地按顺序解锁，购买后可立即播种。',
    lines: [
      `总价：${nextPlotPrice.value} 学习金币`,
      `购买后余额：${learning.today.walletBalance - nextPlotPrice.value} 金币`,
      `土地数量：${farm.value.plots.length} → ${nextPlotNumber.value} 块`,
    ],
    confirmLabel: `确认支付 ${nextPlotPrice.value} 金币`,
    operations: [{ type: 'buy-plot' }],
  })
}

function buyBuilding(building: 'chickenCoop' | 'cowshed'): void {
  const card = buildingCards.value.find((item) => item.building === building)
  if (!card || card.price === null || card.reason) return
  openConfirmation({
    title: `${card.level === 0 ? '购买' : '升级'}${card.name}？`,
    description: '已有动物会保留，新栏位在保存成功后立即可用。',
    lines: [
      `总价：${card.price} 学习金币`,
      `建筑等级：Lv${card.level} → Lv${card.level + 1}`,
      `动物容量：${card.capacity} → ${card.nextCapacity} 个栏位`,
      `购买后余额：${learning.today.walletBalance - card.price} 金币`,
    ],
    confirmLabel: `确认支付 ${card.price} 金币`,
    operations: [{ type: 'buy-building', building }],
  })
}

function buyWorkshop(): void {
  if (!eligibility.value.eligible || workshopShortage.value > 0) return
  openConfirmation({
    title: '购买加工坊？',
    description:
      '加工坊把小麦、鸡蛋、牛奶加工成更值钱的加工品。只有 1 个加工位，一次只能加工一份配方，完成后需手动收取。',
    lines: [
      `总价：${workshopPrice} 学习金币`,
      `当前余额：${learning.today.walletBalance} 金币`,
      `购买后余额：${learning.today.walletBalance - workshopPrice} 金币`,
      `解锁条件已满足：累计手动收获 ${eligibility.value.manualHarvestQuantity} / ${eligibility.value.requiredManualHarvestQuantity} 份`,
    ],
    confirmLabel: `确认支付 ${workshopPrice} 金币`,
    operations: [{ type: 'buy-workshop' }],
  })
}

function requestStartProcessing(recipeId: ProcessingProductId): void {
  const card = recipeCards.value.find((candidate) => candidate.recipe.id === recipeId)
  if (!card || card.reason) return
  const recipe = card.recipe
  openConfirmation({
    title: `开始加工${recipe.title}？`,
    description: '原料会在开始时一次性扣除。加工任务不可取消，原料不可退回。',
    lines: [
      ...card.inputs.map(
        (input) =>
          `投入：${itemNames[input.itemId]} × ${input.required}（库存 ${input.available} → ${input.available - input.required}）`,
      ),
      `加工时长：${recipe.durationMinutes} 分钟`,
      `预计完成：${formatClock(effectiveNow.value + recipe.durationMinutes * 60_000)}`,
      `产出：${itemNames[recipe.output.itemId]} × ${recipe.output.quantity}，单价 ${recipe.unitPrice} 金币`,
    ],
    confirmLabel: '确认投入并开始加工',
    operations: [{ type: 'start-processing', recipeId }],
  })
}

function dismissGuide(): void {
  guideReopened.value = false
  learning.updatePreferences({ processingGuideSeen: true })
}

// 收取前再校验一次槽位状态：同帧双击的第二次点击在 DOM 更新前直接被拦下
function collectProcessing(): void {
  if (slotStatus.value !== 'ready-to-collect') return
  execute({ type: 'collect-processing' })
}

function reopenGuide(): void {
  guideReopened.value = true
}

function dismissUnlockNotice(open: boolean): void {
  learning.updatePreferences({ processingUnlockSeen: true })
  if (open) switchTab('processing')
}

function requestSale(selection: FarmSaleSelection): void {
  const result = getQuote(selection)
  if (!result.quote) return
  const quote = result.quote
  openConfirmation({
    title: selection.kind === 'all' ? '出售全部农产品？' : selection.kind === 'category' ? `出售全部${categoryNames[selection.category]}？` : `出售${itemNames[selection.itemId]}？`,
    description: `本单收入 ${quote.amount} 学习金币。今日出售收入上限为 60 金币，收获本身不受上限影响。`,
    lines: [
      ...quote.lines.map((line) => `${itemNames[line.itemId]} × ${line.quantity}，单价 ${line.unitPrice}，小计 ${line.amount} 金币`),
      `合计：${quote.quantity} 件，${quote.amount} 学习金币`,
      `出售后今日剩余可售收入：${quote.remainingIncome - quote.amount} 金币`,
    ],
    confirmLabel: `确认出售并获得 ${quote.amount} 金币`,
    operations: [{ type: 'sell', selection }],
  })
}

function requestProcessingSale(selection: ProcessingSaleSelection): void {
  const result = getProcessingQuote(selection)
  if (!result.quote) return
  const quote = result.quote
  openConfirmation({
    title: selection.kind === 'all' ? '出售全部加工品？' : `出售${itemNames[selection.itemId]}？`,
    description: `本单收入 ${quote.amount} 学习金币。加工品与农产品共享今日 60 金币出售上限。`,
    lines: [
      ...quote.lines.map((line) => `${itemNames[line.itemId]} × ${line.quantity}，单价 ${line.unitPrice}，小计 ${line.amount} 金币`),
      `合计：${quote.quantity} 件，${quote.amount} 学习金币`,
      `出售后今日剩余可售收入：${quote.remainingIncome - quote.amount} 金币`,
    ],
    confirmLabel: `确认出售并获得 ${quote.amount} 金币`,
    operations: [{ type: 'sell-processing', selection }],
  })
}

function requestAllSale(): void {
  const { farmQuote, procQuote, quantity, amount, error } = allSale.value
  if (error || (!farmQuote && !procQuote)) return
  const operations: (FarmOperation | ProcessingOperation)[] = []
  const lines: string[] = []
  if (farmQuote) {
    operations.push({ type: 'sell', selection: { kind: 'all' } })
    lines.push(
      ...farmQuote.lines.map((line) => `${itemNames[line.itemId]} × ${line.quantity}，单价 ${line.unitPrice}，小计 ${line.amount} 金币`),
    )
  }
  if (procQuote) {
    operations.push({ type: 'sell-processing', selection: { kind: 'all' } })
    lines.push(
      ...procQuote.lines.map((line) => `${itemNames[line.itemId]} × ${line.quantity}，单价 ${line.unitPrice}，小计 ${line.amount} 金币`),
    )
  }
  openConfirmation({
    title: '出售全部可售物品？',
    description: `本单收入 ${amount} 学习金币。农产品与加工品共享今日 60 金币出售上限，收获与加工本身不受上限影响。`,
    lines: [
      ...lines,
      `合计：${quantity} 件，${amount} 学习金币`,
      `出售后今日剩余可售收入：${remainingSaleIncome.value - amount} 金币`,
    ],
    confirmLabel: `确认出售并获得 ${amount} 金币`,
    operations,
  })
}

function confirmOperation(): void {
  if (!confirmation.value || learning.saving) return
  const remaining = [...confirmation.value.operations]
  while (remaining.length > 0) {
    if (!execute(remaining[0])) {
      // 保存失败保留弹层与剩余操作，重试只补未完成部分，不重复结算
      confirmation.value = { ...confirmation.value, operations: remaining }
      return
    }
    remaining.shift()
  }
  confirmation.value = null
}

function updateSaleQuantity(itemId: string, event: Event): void {
  saleQuantities.value[itemId] = Number((event.target as HTMLInputElement).value)
}

function stopRefresh(): void {
  if (timer !== undefined) window.clearTimeout(timer)
  timer = undefined
}

function scheduleRefresh(): void {
  stopRefresh()
  if (document.hidden) return
  const readyTimes = [
    ...farm.value.plots.flatMap((plot) =>
      plot.crop && plot.crop.readyAt > displayNow.value ? [plot.crop.readyAt] : [],
    ),
    ...farm.value.animals.flatMap((animal) =>
      animal.production && animal.production.readyAt > displayNow.value
        ? [animal.production.readyAt]
        : [],
    ),
    ...(workshop.value.activeTask && workshop.value.activeTask.completesAt > displayNow.value
      ? [workshop.value.activeTask.completesAt]
      : []),
  ]
  const nextReadyAt = readyTimes.length > 0 ? Math.min(...readyTimes) : Number.POSITIVE_INFINITY
  const delay = Math.min(60_000, Math.max(50, nextReadyAt - displayNow.value))
  timer = window.setTimeout(() => {
    displayNow.value = learning.getNow()
    scheduleRefresh()
  }, delay)
}

function onVisibilityChange(): void {
  if (document.hidden) {
    stopRefresh()
    return
  }
  displayNow.value = learning.getNow()
  scheduleRefresh()
}

function onStorage(event: StorageEvent): void {
  learning.handleStorageEvent(event)
  displayNow.value = learning.getNow()
  scheduleRefresh()
}

onMounted(() => {
  if (learning.initialize()) execute({ type: 'advance' })
  displayNow.value = learning.getNow()
  scheduleRefresh()
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  stopRefresh()
  window.removeEventListener('storage', onStorage)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <LearningPage
    eyebrow="LEARNING FARM · FIELD NOTES"
    title="把练习的收获，种成一座小农场"
    description="这里只使用学习金币，与桃源乡铜钱完全独立。作物和动物按真实时间生长，离开页面也会继续。"
  >
    <template #heading-action>
      <RouterLink class="learn-button learn-button--secondary" to="/learning/records">查看金币流水</RouterLink>
    </template>

    <div v-if="learning.notice" class="learn-message" role="status">{{ learning.notice }}</div>
    <div v-if="learning.saveError && !confirmation" class="learn-message learn-message--error" role="alert">
      <span>{{ learning.saveError }}</span>
      <button type="button" class="learn-text-button" @click="learning.refresh()">重新读取</button>
    </div>

    <div class="farm-workspace learn-reveal learn-reveal--late">
      <dl class="farm-overview">
        <div><dt>学习金币余额</dt><dd>{{ learning.today.walletBalance }} 金币</dd></div>
        <div><dt>现在待收获 / 收取</dt><dd>{{ pendingNow }} 处</dd></div>
        <div><dt>今日剩余可售收入</dt><dd>{{ remainingSaleIncome }} / 60 金币</dd></div>
      </dl>

      <section v-if="!farm.starterGiftClaimed" class="learn-paper learn-section farm-starter" aria-labelledby="farm-starter-title">
        <div>
          <p class="learn-kicker">第一份农场手册</p>
          <h2 id="farm-starter-title">领取一次性新手礼包</h2>
          <p>礼包不赠送金币，也不会重复发放。领取后就能播种萝卜、喂养第一只鸡。</p>
          <div class="farm-starter__gift">
            <span class="learn-tag">4 块土地</span><span class="learn-tag">萝卜种子 × 4</span>
            <span class="learn-tag">鸡舍 Lv1</span><span class="learn-tag">鸡 × 1</span><span class="learn-tag">鸡饲料 × 2</span>
          </div>
        </div>
        <button type="button" class="learn-button" :disabled="learning.saving || !!learning.loadError" @click="claimGift">
          领取新手礼包
        </button>
      </section>

      <template v-else>
        <section v-if="unlockNoticeVisible" class="learn-note farm-unlock-notice" role="status" aria-labelledby="farm-unlock-title">
          <strong id="farm-unlock-title">新设施可以建造了：加工坊</strong>
          把小麦、鸡蛋、牛奶加工成更值钱的加工品，不强制立即购买。
          <div class="learn-actions">
            <button type="button" class="learn-button learn-button--secondary" @click="dismissUnlockNotice(true)">去看看</button>
            <button type="button" class="learn-text-button" @click="dismissUnlockNotice(false)">知道了</button>
          </div>
        </section>

        <nav class="farm-tabs" aria-label="农场功能">
          <button type="button" :class="{ 'is-active': activeTab === 'farm' }" :aria-current="activeTab === 'farm' ? 'page' : undefined" @click="switchTab('farm')">农场</button>
          <button type="button" :class="{ 'is-active': activeTab === 'processing' }" :aria-current="activeTab === 'processing' ? 'page' : undefined" :aria-label="pendingOutput ? `加工坊，待收 ${pendingOutput.quantity} 份` : '加工坊'" @click="switchTab('processing')">加工坊<span v-if="pendingOutput" class="farm-tabs__badge">待收 {{ pendingOutput.quantity }}</span></button>
          <button type="button" :class="{ 'is-active': activeTab === 'shop' }" :aria-current="activeTab === 'shop' ? 'page' : undefined" @click="switchTab('shop')">商店与建筑</button>
          <button type="button" :class="{ 'is-active': activeTab === 'warehouse' }" :aria-current="activeTab === 'warehouse' ? 'page' : undefined" @click="switchTab('warehouse')">仓库与出售</button>
        </nav>

        <section v-if="recovery.eligible" class="learn-note farm-recovery" aria-labelledby="farm-recovery-title">
          <strong id="farm-recovery-title">恢复补给可用</strong>
          当前没有金币、农产品、作物、动物产品、种子或饲料。可领取萝卜种子 × 2，不直接发放金币，每日最多一次。
          <div class="learn-actions">
            <button type="button" class="learn-button learn-button--secondary" :disabled="learning.saving" @click="execute({ type: 'claim-recovery' })">领取恢复补给</button>
          </div>
        </section>

        <div v-if="activeTab === 'farm'" class="farm-layout">
          <FarmScene
            ref="sceneRef"
            :farm="farm"
            :processing="learning.snapshot.processing"
            :now="displayNow"
            :selected-key="selectedKey"
            :busy="learning.saving"
            :motion-reduced="learning.animationsReduced || learning.farmMotionReduced"
            @select="selectObject"
          />

          <aside class="learn-paper learn-section farm-context" aria-labelledby="farm-context-title">
            <p class="learn-kicker">对象操作卡</p>
            <template v-if="selectedPlot">
              <h2 id="farm-context-title">第 {{ selectedPlot.id.replace('plot-', '') }} 块土地</h2>
              <span class="farm-context__status">
                {{ selectedPlotStatus === 'empty' ? '空地 · 可播种' : selectedPlotStatus === 'ready' ? `${cropNames[selectedPlot.crop!.cropId]} · 可收获` : `${cropNames[selectedPlot.crop!.cropId]} · 生长中` }}
              </span>

              <template v-if="selectedPlotStatus === 'empty'">
                <label class="learn-field">
                  选择种子
                  <select v-model="plantingCrop">
                    <option v-for="cropId in CROP_IDS" :key="cropId" :value="cropId">
                      {{ cropNames[cropId] }}种子 · 库存 {{ farm.inventory[`${cropId}-seed`] ?? 0 }}
                    </option>
                  </select>
                </label>
                <ul class="farm-context__facts">
                  <li>消耗：<strong>{{ cropNames[plantingCrop] }}种子 × 1</strong></li>
                  <li>生长时间：<strong>{{ formatDuration(LEARNING_RULES.farm.crops[plantingCrop].growthMs) }}</strong></li>
                  <li>预计收获：<strong>{{ cropNames[plantingCrop] }} × {{ LEARNING_RULES.farm.crops[plantingCrop].harvestQuantity }}</strong></li>
                </ul>
                <p v-if="selectedSeedCount === 0" class="farm-context__reason">没有{{ cropNames[plantingCrop] }}种子，请先去商店购买。</p>
                <button type="button" class="learn-button" :disabled="learning.saving || selectedSeedCount === 0" @click="execute({ type: 'plant', plotId: selectedPlot.id, cropId: plantingCrop })">播种{{ cropNames[plantingCrop] }}</button>
              </template>

              <template v-else-if="selectedPlotStatus === 'growing'">
                <ul class="farm-context__facts">
                  <li>距离成熟：<strong>{{ formatDuration(selectedPlot.crop!.readyAt - effectiveNow) }}</strong></li>
                  <li>化肥状态：<strong>{{ selectedPlot.crop!.fertilized ? '已使用，每块作物限一次' : '尚未使用' }}</strong></li>
                  <li>化肥库存：<strong>{{ fertilizerCount }} 袋</strong></li>
                </ul>
                <template v-if="!selectedPlot.crop!.fertilized">
                  <p>使用 1 袋化肥后，当前剩余时间变为约 {{ formatDuration(Math.ceil((selectedPlot.crop!.readyAt - effectiveNow) * 0.5)) }}。</p>
                  <p v-if="fertilizerCount === 0" class="farm-context__reason">没有化肥，请先去商店购买。</p>
                  <button type="button" class="learn-button" :disabled="learning.saving || fertilizerCount === 0" @click="execute({ type: 'fertilize', plotId: selectedPlot.id })">使用 1 袋化肥</button>
                </template>
                <p v-else class="learn-note">正在生长，成熟后这里会出现收获操作。</p>
              </template>

              <template v-else>
                <ul class="farm-context__facts">
                  <li>本次收获：<strong>{{ cropNames[selectedPlot.crop!.cropId] }} × {{ LEARNING_RULES.farm.crops[selectedPlot.crop!.cropId].harvestQuantity }}</strong></li>
                  <li>收获后直接放入仓库，不会自动出售。</li>
                </ul>
                <button type="button" class="learn-button" :disabled="learning.saving" @click="execute({ type: 'harvest', plotId: selectedPlot.id })">收获入仓</button>
              </template>
            </template>

            <template v-else-if="selectedAnimal">
              <h2 id="farm-context-title">{{ selectedAnimal.kind === 'chicken' ? '小鸡' : '奶牛' }} {{ selectedAnimal.id.split('-')[1] }}</h2>
              <span class="farm-context__status">
                {{ selectedAnimalStatus === 'ready' ? '产品可收取' : selectedAnimalStatus === 'producing' ? '生产中' : '待喂食' }}
              </span>
              <template v-if="selectedAnimalStatus === 'needs-feed'">
                <ul class="farm-context__facts">
                  <li>消耗：<strong>{{ selectedAnimal.kind === 'chicken' ? '鸡饲料' : '牛饲料' }} × 1</strong></li>
                  <li>库存：<strong>{{ farm.inventory[`${selectedAnimal.kind}-feed`] ?? 0 }} 份</strong></li>
                  <li>生产结果：<strong>{{ selectedAnimal.kind === 'chicken' ? '1 小时后产鸡蛋 × 1' : '2 小时后产牛奶 × 1' }}</strong></li>
                  <li>未收取前不会开始第二轮，也不会饥饿、生病或死亡。</li>
                </ul>
                <p v-if="(farm.inventory[`${selectedAnimal.kind}-feed`] ?? 0) === 0" class="farm-context__reason">饲料不足，请先去商店购买。</p>
                <button type="button" class="learn-button" :disabled="learning.saving || (farm.inventory[`${selectedAnimal.kind}-feed`] ?? 0) === 0" @click="execute({ type: 'feed', animalId: selectedAnimal.id })">喂食并开始生产</button>
              </template>
              <template v-else-if="selectedAnimalStatus === 'producing'">
                <ul class="farm-context__facts">
                  <li>距离产出：<strong>{{ formatDuration(selectedAnimal.production!.readyAt - effectiveNow) }}</strong></li>
                  <li>无需重复喂食，离开页面也会继续生产。</li>
                </ul>
              </template>
              <template v-else>
                <ul class="farm-context__facts">
                  <li>可收取：<strong>{{ selectedAnimal.kind === 'chicken' ? '鸡蛋' : '牛奶' }} × 1</strong></li>
                  <li>收取后回到待喂食状态，产品进入仓库。</li>
                </ul>
                <button type="button" class="learn-button" :disabled="learning.saving" @click="execute({ type: 'collect', animalId: selectedAnimal.id })">收取产品</button>
              </template>
            </template>

            <template v-else>
              <h2 id="farm-context-title">选择一块土地或一只动物</h2>
              <p>场景中的图形和文字会一起显示状态。选择后，这里只出现当前合法的操作。</p>
            </template>
          </aside>
        </div>

        <div v-else-if="activeTab === 'processing'" class="farm-processing">
          <section v-if="guideVisible" class="learn-note farm-processing__guide" aria-labelledby="farm-processing-guide-title">
            <strong id="farm-processing-guide-title">加工坊三步上手</strong>
            <ol>
              <li>选配方：确认原料库存后投入，原料不可退回。</li>
              <li>等加工：按真实时间进行，离开页面也会继续。</li>
              <li>收取入仓：完成后手动收取，加工品可在仓库出售。</li>
            </ol>
            <div class="learn-actions">
              <button type="button" class="learn-button learn-button--secondary" @click="dismissGuide">跳过引导</button>
            </div>
          </section>

          <p v-if="completionNotice" class="learn-message" role="status">{{ completionNotice }}</p>

          <section v-if="!workshop.purchased" class="learn-paper learn-section farm-shop-card" aria-labelledby="farm-workshop-buy-title">
            <div class="farm-shop-card__top">
              <div><p class="learn-kicker">新设施</p><h2 id="farm-workshop-buy-title">加工坊</h2></div>
              <span class="farm-shop-card__price">{{ workshopPrice }} <small>金币</small></span>
            </div>
            <div class="farm-shop-card__facts">
              <span>解锁条件：<strong>累计手动收获 {{ eligibility.manualHarvestQuantity }} / {{ eligibility.requiredManualHarvestQuantity }} 份</strong></span>
              <span>当前余额：<strong>{{ learning.today.walletBalance }} 金币</strong></span>
              <span>只有 1 个加工位，一次加工一份配方，完成后手动收取</span>
            </div>
            <p class="farm-shop-card__reason" :class="{ 'farm-shop-card__ok': eligibility.eligible && workshopShortage === 0 }">
              {{ !eligibility.eligible ? `累计手动收获 ${eligibility.requiredManualHarvestQuantity} 份后解锁购买（当前 ${eligibility.manualHarvestQuantity} 份）` : workshopShortage > 0 ? `学习金币不足，还差 ${workshopShortage} 金币` : '购买前会确认价格、用途与单加工位规则' }}
            </p>
            <RouterLink v-if="eligibility.eligible && workshopShortage > 0" class="learn-button learn-button--secondary" to="/learning">去学习赚金币</RouterLink>
            <button type="button" class="learn-button" :disabled="learning.saving || !eligibility.eligible || workshopShortage > 0" @click="buyWorkshop">购买加工坊</button>
          </section>

          <template v-else>
            <section class="learn-paper learn-section farm-processing__status" aria-labelledby="farm-processing-status-title">
              <div class="farm-shop-card__top">
                <div><p class="learn-kicker">单加工位</p><h2 id="farm-processing-status-title">加工位状态</h2></div>
                <button type="button" class="learn-text-button" @click="reopenGuide">查看使用引导</button>
              </div>
              <template v-if="slotStatus === 'processing' && workshop.activeTask">
                <span class="farm-context__status">{{ activeRecipe?.title }} · 加工中</span>
                <ul class="farm-context__facts">
                  <li>开始时间：<strong>{{ formatClock(workshop.activeTask.startedAt) }}</strong></li>
                  <li>预计完成：<strong>{{ formatClock(workshop.activeTask.completesAt) }}</strong></li>
                  <li>剩余时间：<strong>{{ formatDuration(workshop.activeTask.completesAt - effectiveNow) }}</strong></li>
                  <li>加工开始后不可取消，原料不会退回；离开页面也会继续。</li>
                </ul>
                <button type="button" class="learn-button" disabled>加工尚未完成，不能提前收取</button>
              </template>
              <template v-else-if="slotStatus === 'ready-to-collect'">
                <span class="farm-context__status">加工完成 · 可收取</span>
                <ul class="farm-context__facts">
                  <li v-if="pendingProduct">可收取：<strong>{{ itemNames[pendingProduct.itemId] }} × {{ pendingProduct.quantity }}</strong></li>
                  <li>收取后加工品进入仓库，加工位恢复空闲。</li>
                </ul>
                <button type="button" class="learn-button" :disabled="learning.saving" @click="collectProcessing">收取加工品入仓</button>
              </template>
              <template v-else>
                <span class="farm-context__status">空闲 · 可开始加工</span>
                <p>选择下方配方开始加工。完成后需要手动收取，不会自动开始下一轮。</p>
              </template>
            </section>

            <div class="farm-processing__recipes">
              <section v-for="card in recipeCards" :key="card.recipe.id" class="learn-paper learn-section farm-shop-card" :aria-labelledby="`farm-recipe-${card.recipe.id}`">
                <div class="farm-shop-card__top">
                  <div><p class="learn-kicker">配方 · {{ card.recipe.durationMinutes }} 分钟</p><h2 :id="`farm-recipe-${card.recipe.id}`">{{ card.recipe.title }}</h2></div>
                  <span class="farm-shop-card__price">{{ card.recipe.unitPrice }} <small>金币/份</small></span>
                </div>
                <div class="farm-shop-card__facts">
                  <span v-for="input in card.inputs" :key="input.itemId">投入：<strong>{{ itemNames[input.itemId] }} × {{ input.required }}</strong> · 库存 {{ input.available }}<template v-if="input.shortage > 0"> · 还差 {{ input.shortage }} 件</template></span>
                  <span>产出：<strong>{{ itemNames[card.recipe.output.itemId] }} × {{ card.recipe.output.quantity }}</strong></span>
                  <span>解锁状态：{{ card.availability.available ? '已解锁' : '未解锁' }}</span>
                </div>
                <p class="farm-shop-card__reason" :class="{ 'farm-shop-card__ok': !card.reason }">{{ card.reason || `投入后原料不可退回，加工需 ${card.recipe.durationMinutes} 分钟` }}</p>
                <button type="button" class="learn-button" :disabled="learning.saving || !!card.reason" @click="requestStartProcessing(card.recipe.id)">开始加工{{ card.recipe.title }}</button>
              </section>
            </div>
          </template>
        </div>

        <div v-else-if="activeTab === 'shop'" class="farm-shop-grid">
          <section class="learn-paper learn-section farm-shop-card" aria-labelledby="farm-land-shop-title">
            <div class="farm-shop-card__top">
              <div><p class="learn-kicker">按顺序扩张</p><h2 id="farm-land-shop-title">下一块土地</h2></div>
              <span class="farm-shop-card__price">{{ nextPlotPrice ?? '—' }} <small>金币</small></span>
            </div>
            <div class="farm-shop-card__facts">
              <span>当前土地：<strong>{{ farm.plots.length }} / 8 块</strong></span>
              <span v-if="nextPlotPrice !== undefined">购买第 {{ nextPlotNumber }} 块，余额 {{ learning.today.walletBalance }} 金币</span>
              <span>第 5–8 块价格依次为 100 / 160 / 240 / 320 金币</span>
            </div>
            <p class="farm-shop-card__reason" :class="{ 'farm-shop-card__ok': nextPlotPrice !== undefined && shortage(nextPlotPrice) === 0 }">
              {{ nextPlotPrice === undefined ? '8 块土地已全部解锁' : shortage(nextPlotPrice) > 0 ? `学习金币不足，还差 ${shortage(nextPlotPrice)} 金币` : '购买前会再次确认总价和结果' }}
            </p>
            <button type="button" class="learn-button" :disabled="learning.saving || nextPlotPrice === undefined || shortage(nextPlotPrice) > 0" @click="buyNextPlot">购买第 {{ nextPlotNumber }} 块土地</button>
          </section>

          <section v-for="card in buildingCards" :key="card.building" class="learn-paper learn-section farm-shop-card" :aria-labelledby="`farm-building-${card.building}`">
            <div class="farm-shop-card__top">
              <div><p class="learn-kicker">建筑 Lv{{ card.level }}</p><h2 :id="`farm-building-${card.building}`">{{ card.name }}</h2></div>
              <span class="farm-shop-card__price">{{ card.price ?? 'MAX' }} <small v-if="card.price !== null">金币</small></span>
            </div>
            <div class="farm-shop-card__facts">
              <span>当前容量：<strong>{{ card.capacity }} 个栏位</strong></span>
              <span v-if="!card.maximum">下一等级：<strong>Lv{{ card.level + 1 }} · {{ card.nextCapacity }} 个栏位</strong></span>
              <span v-if="card.building === 'cowshed'">解锁条件：已购买第 6 块土地</span>
              <span>已有动物保留，升级不会重置生产状态</span>
            </div>
            <p class="farm-shop-card__reason" :class="{ 'farm-shop-card__ok': !card.reason }">{{ card.reason || '购买或升级前会确认价格与容量' }}</p>
            <button type="button" class="learn-button" :disabled="learning.saving || !!card.reason" @click="buyBuilding(card.building)">{{ card.level === 0 ? '购买' : '升级' }}{{ card.name }}</button>
          </section>

          <section v-for="card in animalCards" :key="card.kind" class="learn-paper learn-section farm-shop-card" :aria-labelledby="`farm-animal-${card.kind}`">
            <div class="farm-shop-card__top">
              <div><p class="learn-kicker">动物入住</p><h2 :id="`farm-animal-${card.kind}`">购买{{ card.kind === 'chicken' ? '小鸡' : '奶牛' }}</h2></div>
              <span class="farm-shop-card__price">{{ card.rules.purchasePrice }} <small>金币</small></span>
            </div>
            <div class="farm-shop-card__facts">
              <span>栏位：<strong>{{ card.count }} / {{ card.capacity }}</strong></span>
              <span>饲料 {{ card.rules.feedPrice }} 金币 / 份 · {{ card.kind === 'chicken' ? '1 小时产鸡蛋，售 14' : '2 小时产牛奶，售 32' }} 金币</span>
              <span>动物不会饥饿、生病或死亡</span>
            </div>
            <p class="farm-shop-card__reason" :class="{ 'farm-shop-card__ok': !card.reason }">{{ card.reason || `余额充足，购买后剩 ${learning.today.walletBalance - card.rules.purchasePrice} 金币` }}</p>
            <button type="button" class="learn-button" :disabled="learning.saving || !!card.reason" @click="buyAnimal(card.kind)">购买{{ card.kind === 'chicken' ? '小鸡' : '奶牛' }}</button>
          </section>

          <section v-for="supply in supplies" :key="supply.itemId" class="learn-paper learn-section farm-shop-card" :aria-labelledby="`farm-supply-${supply.itemId}`">
            <div class="farm-shop-card__top">
              <div><p class="learn-kicker">农场投入品</p><h2 :id="`farm-supply-${supply.itemId}`">{{ itemNames[supply.itemId] }}</h2></div>
              <span class="farm-shop-card__price">{{ supply.price }} <small>金币</small></span>
            </div>
            <div class="farm-shop-card__facts">
              <span>{{ supply.description }}</span>
              <span>当前库存：<strong>{{ farm.inventory[supply.itemId] ?? 0 }}</strong> · 每次购买 1 件</span>
            </div>
            <p class="farm-shop-card__reason" :class="{ 'farm-shop-card__ok': shortage(supply.price) === 0 }">{{ shortage(supply.price) > 0 ? `学习金币不足，还差 ${shortage(supply.price)} 金币` : `购买后余额 ${learning.today.walletBalance - supply.price} 金币` }}</p>
            <button type="button" class="learn-button learn-button--secondary" :disabled="learning.saving || shortage(supply.price) > 0" @click="execute({ type: 'buy-supplies', itemId: supply.itemId, quantity: 1 })">购买 1 件</button>
          </section>
        </div>

        <div v-else class="farm-warehouse">
          <section class="learn-paper learn-section farm-warehouse__summary" aria-labelledby="farm-sale-all-title">
            <div><p class="learn-kicker">每日收入规则</p><h2 id="farm-sale-all-title">今日还可通过出售获得 {{ remainingSaleIncome }} 金币</h2><p>农产品与加工品共享每日 60 金币上限，投入品不可出售。超出上限的出售不会提交，库存保持不变。</p></div>
            <button type="button" class="learn-button" :disabled="learning.saving || !!allSale.error" @click="requestAllSale">出售全部可售物品</button>
            <p v-if="allSale.error" class="farm-context__reason">{{ allSale.error }}</p>
            <p v-else>全部共 {{ allSale.quantity }} 件，可获得 {{ allSale.amount }} 金币。</p>
          </section>

          <div class="farm-warehouse__groups">
            <section v-for="group in warehouse" :key="group.category" class="farm-inventory-group" :aria-labelledby="`farm-inventory-${group.category}`">
              <div class="farm-inventory-group__heading">
                <h3 :id="`farm-inventory-${group.category}`">{{ categoryNames[group.category] }}</h3>
                <button v-if="group.category === 'crops' || group.category === 'animal-products'" type="button" class="learn-button learn-button--quiet" :disabled="learning.saving || !categoryQuotes[group.category].quote" @click="requestSale({ kind: 'category', category: group.category })">
                  出售本类别<template v-if="categoryQuotes[group.category].quote"> · {{ categoryQuotes[group.category].quote!.amount }} 金币</template>
                </button>
              </div>
              <p v-if="(group.category === 'crops' || group.category === 'animal-products') && categoryQuotes[group.category].error" class="farm-context__reason">{{ categoryQuotes[group.category].error }}</p>

              <template v-if="group.category === 'crops' || group.category === 'animal-products'">
                <ul class="farm-inventory-list">
                  <li v-for="row in productRows.filter((item) => item.category === group.category)" :key="row.itemId" class="farm-inventory-item">
                    <div class="farm-inventory-item__name"><strong>{{ itemNames[row.itemId] }}<span v-if="processableRawIds.includes(row.itemId)" class="farm-inventory-item__tag">可用于加工</span></strong><small>单价 {{ row.salePrice }} 金币</small></div>
                    <span class="farm-inventory-item__quantity">库存 {{ row.quantity }}</span>
                    <input :aria-label="`出售${itemNames[row.itemId]}数量`" type="number" min="1" :max="Math.max(1, row.quantity)" step="1" :value="saleQuantities[row.itemId] ?? 1" :disabled="row.quantity === 0 || learning.saving" @input="updateSaleQuantity(row.itemId, $event)" />
                    <button type="button" class="learn-button learn-button--secondary" :disabled="learning.saving || !row.quote" @click="requestSale(row.selection)">出售</button>
                    <p class="farm-inventory-item__quote" :class="{ 'is-error': !!row.error }">{{ row.error || `本单 ${row.quote!.quantity} 件，共 ${row.quote!.amount} 金币` }}<button v-if="processableRawIds.includes(row.itemId)" type="button" class="learn-text-button" @click="switchTab('processing')">查看配方</button></p>
                  </li>
                </ul>
              </template>
              <template v-else-if="group.category === 'processed-products'">
                <ul class="farm-inventory-list">
                  <li v-for="row in processedRows" :key="row.itemId" class="farm-inventory-item">
                    <div class="farm-inventory-item__name"><strong>{{ itemNames[row.itemId] }}</strong><small>加工品 · 单价 {{ row.salePrice }} 金币</small></div>
                    <span class="farm-inventory-item__quantity">库存 {{ row.quantity }}</span>
                    <input :aria-label="`出售${itemNames[row.itemId]}数量`" type="number" min="1" :max="Math.max(1, row.quantity)" step="1" :value="saleQuantities[row.itemId] ?? 1" :disabled="row.quantity === 0 || learning.saving" @input="updateSaleQuantity(row.itemId, $event)" />
                    <button type="button" class="learn-button learn-button--secondary" :disabled="learning.saving || !row.quote" @click="requestProcessingSale(row.selection)">出售</button>
                    <p class="farm-inventory-item__quote" :class="{ 'is-error': !!row.error }">{{ row.error || `本单 ${row.quote!.quantity} 件，共 ${row.quote!.amount} 金币` }}</p>
                  </li>
                </ul>
              </template>
              <template v-else>
                <ul class="farm-inventory-list">
                  <li v-for="item in group.items" :key="item.itemId" class="farm-inventory-item">
                    <div class="farm-inventory-item__name"><strong>{{ itemNames[item.itemId] }}</strong><small>投入品 · 不可出售</small></div>
                    <span class="farm-inventory-item__quantity">库存 {{ item.quantity }}</span>
                  </li>
                </ul>
              </template>
            </section>
          </div>
        </div>
      </template>
    </div>

    <LearningConfirmDialog
      v-if="confirmation"
      :title="confirmation.title"
      :description="confirmation.description"
      :lines="confirmation.lines"
      :confirm-label="confirmation.confirmLabel"
      :busy="learning.saving"
      :error="learning.saveError"
      @cancel="confirmation = null"
      @confirm="confirmOperation"
    />
  </LearningPage>
</template>
