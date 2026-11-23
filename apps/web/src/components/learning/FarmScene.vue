<script setup lang="ts">
import { computed } from 'vue'
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

const props = defineProps<{
  farm: FarmState
  now: number
  selectedKey: string | null
  busy: boolean
}>()
const emit = defineEmits<{ select: [key: string] }>()

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
  <section class="farm-scene" aria-label="像素农场场景">
    <div class="farm-scene__sky" aria-hidden="true">
      <span class="farm-scene__sun" />
      <span class="farm-scene__cloud farm-scene__cloud--one" />
      <span class="farm-scene__cloud farm-scene__cloud--two" />
    </div>

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
        <span v-if="isLocked(plot)" class="farm-plot__locked" aria-hidden="true"><i /></span>
        <span
          v-else-if="plot.crop"
          class="farm-crop"
          :class="[`farm-crop--${plot.crop.cropId}`, { 'is-ready': getPlotStatus(plot, effectiveNow) === 'ready' }]"
          aria-hidden="true"
        ><i /><b /></span>
        <span v-else class="farm-plot__furrows" aria-hidden="true"><i /><i /><i /></span>
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
          <span class="farm-coop-pixel" aria-hidden="true"><i /><b /></span>
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
            <span class="farm-chicken-pixel" aria-hidden="true"><i /><b /></span>
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
          <span class="farm-cowshed-pixel" aria-hidden="true"><i /><b /></span>
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
            <span class="farm-cow-pixel" aria-hidden="true"><i /><b /></span>
            <strong>{{ animal.id.replace('cow-', '牛 ') }}</strong>
            <small>{{ animalStatus(animal) }}</small>
          </button>
          <p v-if="farm.buildings.cowshed.level === 0" class="farm-building__empty">购买第 6 块土地后，可在商店解锁牛棚。</p>
          <p v-else-if="animalsOf('cow').length === 0" class="farm-building__empty">牛棚已经建好，去商店迎接第一头牛吧。</p>
        </div>
      </section>
    </div>
  </section>
</template>
