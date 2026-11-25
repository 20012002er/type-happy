<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LEARNING_RULES } from '../../learning/config/rules'
import {
  getAnimalStatus,
  getBuildingCapacity,
  getEffectiveFarmTime,
  getPlotStatus,
  type AnimalKind,
  type FarmAnimal,
  type FarmPlot,
  type FarmState,
} from '../../learning/farm/farm-state'
import { projectFarmScene } from '../../learning/farm/scene-model'
import {
  FarmSceneRenderer,
  type FarmFeedbackKind,
  type FarmPixiModule,
  type SceneAnchor,
} from '../../learning/farm/scene-renderer'
import { createEmptyProcessingState, type ProcessingState } from '../../learning/processing/state'

const props = withDefaults(
  defineProps<{
    farm: FarmState
    now: number
    selectedKey: string | null
    busy: boolean
    processing?: ProcessingState
    motionReduced?: boolean
    pixi?: FarmPixiModule | null
  }>(),
  { processing: () => createEmptyProcessingState(), motionReduced: false, pixi: null },
)
const emit = defineEmits<{ select: [key: string] }>()

const sceneRoot = ref<HTMLElement | null>(null)
const canvasHost = ref<HTMLElement | null>(null)
const pixiActive = ref(false)
let renderer: FarmSceneRenderer | null = null
let resizeObserver: ResizeObserver | null = null

const sceneModel = computed(() =>
  projectFarmScene({
    farm: props.farm,
    processing: props.processing,
    now: props.now,
    selectedKey: props.selectedKey,
  }),
)

const processingText = computed(() => {
  const processing = sceneModel.value.processing
  switch (processing.state) {
    case 'locked':
      return `累计手动收获 ${processing.harvestProgress} / ${processing.harvestRequired} 份后解锁购买。`
    case 'unpurchased':
      return `已解锁购买资格，售价 ${processing.price} 学习金币。`
    case 'processing':
      return `加工中 · 剩余 ${formatMilliseconds(processing.remainingMs)}，完成后需手动收取。`
    case 'ready':
      return `加工品可收取 × ${processing.pendingQuantity}。`
    default:
      return '加工位空闲，等待投入原料。'
  }
})

function formatMilliseconds(milliseconds: number): string {
  const minutes = Math.ceil(milliseconds / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

function measureAnchors(): Map<string, SceneAnchor> {
  const anchors = new Map<string, SceneAnchor>()
  const root = sceneRoot.value
  if (!root) return anchors
  const rootRect = root.getBoundingClientRect()
  root.querySelectorAll<HTMLElement>('[data-scene-anchor]').forEach((element) => {
    const rect = element.getBoundingClientRect()
    const id = element.dataset.sceneAnchor
    if (!id) return
    anchors.set(id, {
      x: rect.left - rootRect.left,
      y: rect.top - rootRect.top,
      width: rect.width,
      height: rect.height,
    })
  })
  return anchors
}

function syncScene(): void {
  if (!renderer || !sceneRoot.value) return
  renderer.resize(sceneRoot.value.clientWidth, sceneRoot.value.clientHeight)
  renderer.sync(sceneModel.value, measureAnchors())
}

async function mountPixi(): Promise<void> {
  if (!canvasHost.value || !sceneRoot.value) return
  try {
    // 测试环境不加载真实 WebGL；组件测试通过 pixi prop 注入替身
    const pixi =
      props.pixi ??
      (import.meta.env.MODE === 'test'
        ? null
        : ((await import('pixi.js')) as unknown as FarmPixiModule))
    if (!pixi) return
    const candidate = new FarmSceneRenderer(pixi)
    await candidate.init(canvasHost.value, {
      width: Math.max(1, sceneRoot.value.clientWidth),
      height: Math.max(1, sceneRoot.value.clientHeight),
      resolution: Math.min(2, window.devicePixelRatio || 1),
    })
    renderer = candidate
    pixiActive.value = true
    renderer.setMotionMode(props.motionReduced ? 'static' : 'full')
    renderer.setHidden(document.hidden)
    syncScene()
  } catch {
    // 资源或 WebGL 失败：保留静态 DOM 像素场景，全部核心操作不受影响
    renderer?.destroy()
    renderer = null
    pixiActive.value = false
  }
}

function onVisibilityChange(): void {
  renderer?.setHidden(document.hidden)
}

watch(
  () => [props.farm, props.now, props.selectedKey, props.processing],
  () => syncScene(),
  { flush: 'post' },
)
watch(
  () => props.motionReduced,
  (reduced) => renderer?.setMotionMode(reduced ? 'static' : 'full'),
)

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (typeof ResizeObserver !== 'undefined' && sceneRoot.value) {
    resizeObserver = new ResizeObserver(() => syncScene())
    resizeObserver.observe(sceneRoot.value)
  }
  void mountPixi()
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  resizeObserver?.disconnect()
  resizeObserver = null
  renderer?.destroy()
  renderer = null
})

defineExpose({
  playFeedback: (id: string, kind: FarmFeedbackKind) => renderer?.playFeedback(id, kind),
  playCoins: (amount: number) => renderer?.playCoins(amount),
})

const cropNames = { radish: '萝卜', wheat: '小麦', corn: '玉米', pumpkin: '南瓜' } as const
const effectiveNow = computed(() => getEffectiveFarmTime(props.farm, props.now))
const plots = computed(() =>
  Array.from({ length: LEARNING_RULES.farm.plots.maximum }, (_, index) => {
    const id = `plot-${index + 1}`
    return props.farm.plots.find((plot) => plot.id === id) ?? { id, crop: null, locked: true }
  }),
)

function isLocked(plot: FarmPlot | { id: string; crop: null; locked: true }): boolean {
  return 'locked' in plot
}

function plotStatus(plot: FarmPlot): string {
  const status = getPlotStatus(plot, effectiveNow.value)
  if (status === 'empty') return '空地 · 可播种'
  const name = cropNames[plot.crop!.cropId]
  return status === 'ready' ? `${name} · 可收获` : `${name} · 生长中`
}

function remaining(timestamp: number): string {
  const seconds = Math.max(0, Math.ceil((timestamp - effectiveNow.value) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

function animalStatus(animal: FarmAnimal): string {
  const status = getAnimalStatus(animal, effectiveNow.value)
  if (status === 'ready') return `${animal.kind === 'chicken' ? '鸡蛋' : '牛奶'} · 可收取`
  if (status === 'producing') return `生产中 · ${remaining(animal.production!.readyAt)}`
  return '待喂食'
}

function animalsOf(kind: AnimalKind): readonly FarmAnimal[] {
  return props.farm.animals.filter((animal) => animal.kind === kind)
}
</script>

<template>
  <section ref="sceneRoot" class="farm-scene" :class="{ 'farm-scene--pixi': pixiActive }" aria-label="像素农场场景">
    <div class="farm-scene__sky" aria-hidden="true">
      <span class="farm-scene__sun" />
      <span class="farm-scene__cloud farm-scene__cloud--one" />
      <span class="farm-scene__cloud farm-scene__cloud--two" />
    </div>
    <div ref="canvasHost" class="farm-scene__canvas" aria-hidden="true" />

    <div class="farm-scene__legend" aria-label="场景图例">
      <span><i class="farm-legend-pixel farm-legend-pixel--growing" aria-hidden="true" />生长中</span>
      <span><i class="farm-legend-pixel farm-legend-pixel--ready" aria-hidden="true" />可收获</span>
      <span><i class="farm-legend-pixel farm-legend-pixel--empty" aria-hidden="true" />待操作</span>
    </div>

    <div class="farm-plots" aria-label="8 块土地">
      <button
        v-for="(plot, index) in plots"
        :key="plot.id"
        type="button"
        class="farm-plot"
        :class="[
          { 'is-selected': selectedKey === `plot:${plot.id}`, 'is-locked': isLocked(plot) },
          !isLocked(plot) && plot.crop ? `is-${getPlotStatus(plot, effectiveNow)}` : '',
        ]"
        :disabled="isLocked(plot) || busy"
        :aria-pressed="selectedKey === `plot:${plot.id}`"
        @click="emit('select', `plot:${plot.id}`)"
      >
        <span class="farm-plot__number">田地 {{ String(index + 1).padStart(2, '0') }}</span>
        <span v-if="isLocked(plot)" class="farm-plot__locked" :data-scene-anchor="`plot:${plot.id}`" aria-hidden="true"><i /></span>
        <span
          v-else-if="plot.crop"
          class="farm-crop"
          :class="[`farm-crop--${plot.crop.cropId}`, { 'is-ready': getPlotStatus(plot, effectiveNow) === 'ready' }]"
          :data-scene-anchor="`plot:${plot.id}`"
          aria-hidden="true"
        ><i /><b /></span>
        <span v-else class="farm-plot__furrows" :data-scene-anchor="`plot:${plot.id}`" aria-hidden="true"><i /><i /><i /></span>
        <strong>{{ isLocked(plot) ? '尚未解锁' : plotStatus(plot) }}</strong>
        <small v-if="!isLocked(plot) && plot.crop && getPlotStatus(plot, effectiveNow) === 'growing'">
          剩余 {{ remaining(plot.crop.readyAt) }}
        </small>
        <small v-else-if="isLocked(plot)">请按顺序在商店购买</small>
        <small v-else-if="!plot.crop">选择后查看种子</small>
        <small v-else>点击收获入仓</small>
      </button>
    </div>

    <div class="farm-buildings">
      <section class="farm-building farm-building--coop" aria-labelledby="farm-coop-title">
        <div class="farm-building__heading">
          <div>
            <p>CHICKEN COOP · LV{{ farm.buildings.chickenCoop.level }}</p>
            <h3 id="farm-coop-title">鸡舍</h3>
          </div>
          <span>{{ animalsOf('chicken').length }} / {{ getBuildingCapacity(farm, 'chickenCoop') }} 栏位</span>
        </div>
        <div class="farm-building__yard">
          <span class="farm-coop-pixel" data-scene-anchor="building:chickenCoop" aria-hidden="true"><i /><b /></span>
          <button
            v-for="animal in animalsOf('chicken')"
            :key="animal.id"
            type="button"
            class="farm-animal"
            :class="{ 'is-selected': selectedKey === `animal:${animal.id}`, 'is-ready': getAnimalStatus(animal, effectiveNow) === 'ready' }"
            :disabled="busy"
            :aria-pressed="selectedKey === `animal:${animal.id}`"
            @click="emit('select', `animal:${animal.id}`)"
          >
            <span class="farm-chicken-pixel" :data-scene-anchor="`animal:${animal.id}`" aria-hidden="true"><i /><b /></span>
            <strong>{{ animal.id.replace('chicken-', '鸡 ') }}</strong>
            <small>{{ animalStatus(animal) }}</small>
          </button>
          <p v-if="animalsOf('chicken').length === 0" class="farm-building__empty">领取礼包或购买鸡后，小鸡会住在这里。</p>
        </div>
      </section>

      <section class="farm-building farm-building--cowshed" aria-labelledby="farm-cowshed-title">
        <div class="farm-building__heading">
          <div>
            <p>COWSHED · LV{{ farm.buildings.cowshed.level }}</p>
            <h3 id="farm-cowshed-title">牛棚</h3>
          </div>
          <span>{{ animalsOf('cow').length }} / {{ getBuildingCapacity(farm, 'cowshed') }} 栏位</span>
        </div>
        <div class="farm-building__yard">
          <span class="farm-cowshed-pixel" data-scene-anchor="building:cowshed" aria-hidden="true"><i /><b /></span>
          <button
            v-for="animal in animalsOf('cow')"
            :key="animal.id"
            type="button"
            class="farm-animal"
            :class="{ 'is-selected': selectedKey === `animal:${animal.id}`, 'is-ready': getAnimalStatus(animal, effectiveNow) === 'ready' }"
            :disabled="busy"
            :aria-pressed="selectedKey === `animal:${animal.id}`"
            @click="emit('select', `animal:${animal.id}`)"
          >
            <span class="farm-cow-pixel" :data-scene-anchor="`animal:${animal.id}`" aria-hidden="true"><i /><b /></span>
            <strong>{{ animal.id.replace('cow-', '牛 ') }}</strong>
            <small>{{ animalStatus(animal) }}</small>
          </button>
          <p v-if="farm.buildings.cowshed.level === 0" class="farm-building__empty">购买第 6 块土地后，可在商店解锁牛棚。</p>
          <p v-else-if="animalsOf('cow').length === 0" class="farm-building__empty">牛棚已经建好，去商店迎接第一头牛吧。</p>
        </div>
      </section>

      <section class="farm-building farm-building--processing" aria-labelledby="farm-processing-title">
        <div class="farm-building__heading">
          <div>
            <p>PROCESSING · {{ sceneModel.processing.state === 'ready' ? 'READY' : sceneModel.processing.state === 'processing' ? 'WORKING' : 'STANDBY' }}</p>
            <h3 id="farm-processing-title">加工坊</h3>
          </div>
          <span v-if="sceneModel.processing.state === 'ready'">待收 {{ sceneModel.processing.pendingQuantity }} 份</span>
        </div>
        <div class="farm-building__yard">
          <span class="farm-processing-pixel" data-scene-anchor="building:processing" aria-hidden="true"><i /><b /></span>
          <p class="farm-building__empty">{{ processingText }}</p>
          <button
            type="button"
            class="learn-button learn-button--secondary farm-processing-entry"
            :disabled="busy"
            @click="emit('select', 'building:processing')"
          >
            {{ sceneModel.processing.state === 'locked' ? '查看解锁条件' : sceneModel.processing.state === 'unpurchased' ? '购买加工坊' : '进入加工坊' }}
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
