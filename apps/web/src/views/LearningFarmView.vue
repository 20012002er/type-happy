<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import FarmScene from '../components/learning/FarmScene.vue'
import LearningConfirmDialog from '../components/learning/LearningConfirmDialog.vue'
import LearningPage from '../components/learning/LearningPage.vue'
import { LEARNING_RULES } from '../learning/config/rules'
import { getWarehouse } from '../learning/farm/farm'
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
import { useLearningStore, type FarmOperation } from '../stores/learning'
import '../learning/farm.css'

const learning = useLearningStore()
const activeTab = ref<'farm' | 'shop' | 'warehouse'>('farm')
const displayNow = ref(learning.getNow())
const selectedKey = ref<string | null>('plot:plot-1')
const plantingCrop = ref<CropId>('radish')
const saleQuantities = ref<Record<string, number>>({})
let timer: number | undefined

const cropNames: Record<CropId, string> = { radish: '萝卜', wheat: '小麦', corn: '玉米', pumpkin: '南瓜' }
const itemNames: Record<string, string> = {
  ...Object.fromEntries(CROP_IDS.map((cropId) => [cropId, cropNames[cropId]])),
  ...Object.fromEntries(CROP_IDS.map((cropId) => [`${cropId}-seed`, `${cropNames[cropId]}种子`])),
  egg: '鸡蛋',
  milk: '牛奶',
  fertilizer: '化肥',
  'chicken-feed': '鸡饲料',
  'cow-feed': '牛饲料',
}
const categoryNames: Record<WarehouseCategory, string> = {
  crops: '作物',
  'animal-products': '动物产品',
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
  operation: FarmOperation
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

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

function shortage(price: number): number {
  return Math.max(0, price - learning.today.walletBalance)
}

function selectObject(key: string): void {
  selectedKey.value = key
  learning.clearMessages()
}

function switchTab(tab: 'farm' | 'shop' | 'warehouse'): void {
  activeTab.value = tab
  learning.clearMessages()
}

function execute(operation: FarmOperation): boolean {
  learning.clearMessages()
  const succeeded = learning.performFarmOperation(operation)
  displayNow.value = learning.getNow()
  scheduleRefresh()
  return succeeded
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
    operation: { type: 'buy-plot' },
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
    operation: { type: 'buy-building', building },
  })
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
    operation: { type: 'sell', selection },
  })
}

function confirmOperation(): void {
  if (!confirmation.value || learning.saving) return
  if (execute(confirmation.value.operation)) confirmation.value = null
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
        <nav class="farm-tabs" aria-label="农场功能">
          <button type="button" :class="{ 'is-active': activeTab === 'farm' }" :aria-current="activeTab === 'farm' ? 'page' : undefined" @click="switchTab('farm')">农场</button>
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
          <FarmScene :farm="farm" :now="displayNow" :selected-key="selectedKey" :busy="learning.saving" @select="selectObject" />

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
            <div><p class="learn-kicker">每日收入规则</p><h2 id="farm-sale-all-title">今日还可通过出售获得 {{ remainingSaleIncome }} 金币</h2><p>投入品不可出售。超出上限的出售不会提交，库存保持不变。</p></div>
            <button type="button" class="learn-button" :disabled="learning.saving || !categoryQuotes.all.quote" @click="requestSale({ kind: 'all' })">出售全部农产品</button>
            <p v-if="categoryQuotes.all.error" class="farm-context__reason">{{ categoryQuotes.all.error }}</p>
            <p v-else-if="categoryQuotes.all.quote">全部共 {{ categoryQuotes.all.quote.quantity }} 件，可获得 {{ categoryQuotes.all.quote.amount }} 金币。</p>
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
                    <div class="farm-inventory-item__name"><strong>{{ itemNames[row.itemId] }}</strong><small>单价 {{ row.salePrice }} 金币</small></div>
                    <span class="farm-inventory-item__quantity">库存 {{ row.quantity }}</span>
                    <input :aria-label="`出售${itemNames[row.itemId]}数量`" type="number" min="1" :max="Math.max(1, row.quantity)" step="1" :value="saleQuantities[row.itemId] ?? 1" :disabled="row.quantity === 0 || learning.saving" @input="updateSaleQuantity(row.itemId, $event)" />
                    <button type="button" class="learn-button learn-button--secondary" :disabled="learning.saving || !row.quote" @click="requestSale(row.selection)">出售</button>
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
