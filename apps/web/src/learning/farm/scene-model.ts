import { LEARNING_RULES } from '../config/rules'
import type { ProcessingState } from '../processing/state'
import { getProcessingPurchaseEligibility } from '../processing/state'
import {
  getAnimalStatus,
  getBuildingCapacity,
  getEffectiveFarmDateKey,
  getEffectiveFarmTime,
  getPlotStatus,
  type AnimalKind,
  type CropId,
  type FarmState,
} from './farm-state'

/** 作物形态阶段：幼苗与生长中必须有可区分形态（FR-08） */
export type PlotStage = 'locked' | 'empty' | 'seedling' | 'growing' | 'ready'
export type AnimalSceneState = 'idle' | 'producing' | 'ready'
export type ProcessingSceneState = 'locked' | 'unpurchased' | 'idle' | 'processing' | 'ready'
export type SceneWeather = 'none' | 'drizzle'

export interface ScenePlot {
  readonly id: string
  readonly index: number
  readonly stage: PlotStage
  readonly cropId: CropId | null
  readonly progress: number
  readonly remainingMs: number
  readonly selected: boolean
}

export interface SceneAnimal {
  readonly id: string
  readonly kind: AnimalKind
  readonly state: AnimalSceneState
  readonly progress: number
  readonly remainingMs: number
  readonly selected: boolean
}

export interface SceneBuilding {
  readonly id: string
  readonly kind: 'chickenCoop' | 'cowshed'
  readonly level: number
  readonly capacity: number
  readonly count: number
  readonly hasReadyProduct: boolean
}

export interface SceneProcessing {
  readonly id: string
  readonly state: ProcessingSceneState
  readonly progress: number
  readonly remainingMs: number
  readonly pendingQuantity: number
  readonly harvestProgress: number
  readonly harvestRequired: number
  readonly price: number
}

export interface SceneCloud {
  readonly id: string
  readonly lane: number
  readonly speed: number
  readonly scale: number
}

export interface SceneEnvironment {
  readonly clouds: readonly SceneCloud[]
  readonly daylight: number
  readonly weather: SceneWeather
}

export interface FarmSceneModel {
  readonly plots: readonly ScenePlot[]
  readonly animals: readonly SceneAnimal[]
  readonly buildings: readonly SceneBuilding[]
  readonly processing: SceneProcessing
  readonly environment: SceneEnvironment
}

export interface FarmSceneInput {
  readonly farm: FarmState
  readonly processing: ProcessingState
  readonly now: number
  readonly selectedKey: string | null
}

/** 同屏云层数量受控（T09-03）：固定 3 朵，参数由常量决定，投影不含随机 */
const CLOUD_LANES: readonly { lane: number; speed: number; scale: number }[] = [
  { lane: 0.16, speed: 9, scale: 1 },
  { lane: 0.3, speed: 6, scale: 0.72 },
  { lane: 0.08, speed: 12, scale: 0.55 },
]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function progressBetween(startedAt: number, readyAt: number, now: number): number {
  const total = readyAt - startedAt
  return total <= 0 ? 1 : clamp01((now - startedAt) / total)
}

function hashText(text: string): number {
  let hash = 7
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

/**
 * 只读场景投影：土地、作物、动物、建筑和装饰使用稳定对象 ID。
 * 纯函数、确定性输出；渲染 ticker 只消费本模型，不修改任何领域状态（T09-01）。
 * 时间一律取 getEffectiveFarmTime，时钟回拨不会让形态倒退。
 */
export function projectFarmScene(input: FarmSceneInput): FarmSceneModel {
  const { farm, processing, now, selectedKey } = input
  const effectiveNow = getEffectiveFarmTime(farm, now)

  const plots: ScenePlot[] = Array.from(
    { length: LEARNING_RULES.farm.plots.maximum },
    (_, index) => {
      const id = `plot:plot-${index + 1}`
      const plot = farm.plots[index]
      if (!plot) {
        return {
          id,
          index,
          stage: 'locked',
          cropId: null,
          progress: 0,
          remainingMs: 0,
          selected: false,
        }
      }
      const status = getPlotStatus(plot, effectiveNow)
      const crop = plot.crop
      const progress = crop ? progressBetween(crop.plantedAt, crop.readyAt, effectiveNow) : 0
      const stage: PlotStage =
        status === 'empty'
          ? 'empty'
          : status === 'ready'
            ? 'ready'
            : progress < 1 / 3
              ? 'seedling'
              : 'growing'
      return {
        id,
        index,
        stage,
        cropId: crop?.cropId ?? null,
        progress,
        remainingMs: crop ? Math.max(0, crop.readyAt - effectiveNow) : 0,
        selected: selectedKey === id,
      }
    },
  )

  const animals: SceneAnimal[] = farm.animals.map((animal) => {
    const id = `animal:${animal.id}`
    const status = getAnimalStatus(animal, effectiveNow)
    const production = animal.production
    return {
      id,
      kind: animal.kind,
      state: status === 'needs-feed' ? 'idle' : status,
      progress: production
        ? progressBetween(production.startedAt, production.readyAt, effectiveNow)
        : 0,
      remainingMs: production ? Math.max(0, production.readyAt - effectiveNow) : 0,
      selected: selectedKey === id,
    }
  })

  const buildings: SceneBuilding[] = (['chickenCoop', 'cowshed'] as const).map((kind) => ({
    id: `building:${kind}`,
    kind,
    level: farm.buildings[kind].level,
    capacity: getBuildingCapacity(farm, kind),
    count: farm.animals.filter((animal) =>
      kind === 'chickenCoop' ? animal.kind === 'chicken' : animal.kind === 'cow',
    ).length,
    hasReadyProduct: animals.some(
      (animal) =>
        animal.state === 'ready' &&
        (kind === 'chickenCoop' ? animal.kind === 'chicken' : animal.kind === 'cow'),
    ),
  }))

  const workshop = processing.workshop
  const eligibility = getProcessingPurchaseEligibility(farm)
  const task = workshop.activeTask
  // 已购买的加工坊直接呈现真实状态；解锁进度只门控购买资格
  const processingState: ProcessingSceneState = workshop.purchased
    ? workshop.pendingOutput
      ? 'ready'
      : task
        ? 'processing'
        : 'idle'
    : eligibility.eligible
      ? 'unpurchased'
      : 'locked'
  const processingScene: SceneProcessing = {
    id: 'building:processing',
    state: processingState,
    progress: task ? progressBetween(task.startedAt, task.completesAt, effectiveNow) : 0,
    remainingMs: task ? Math.max(0, task.completesAt - effectiveNow) : 0,
    pendingQuantity: workshop.pendingOutput?.quantity ?? 0,
    harvestProgress: eligibility.manualHarvestQuantity,
    harvestRequired: eligibility.requiredManualHarvestQuantity,
    price: LEARNING_RULES.farm.processing.purchasePrice,
  }

  // 装饰天气只作展示：由日期决定，不参与生长、产量、售价或任务（T09-03）
  const dateKey = getEffectiveFarmDateKey(farm, now)
  const hour = new Date(effectiveNow).getHours()
  const environment: SceneEnvironment = {
    clouds: CLOUD_LANES.map((cloud, index) => ({ id: `decor:cloud-${index + 1}`, ...cloud })),
    daylight: clamp01(1 - Math.abs(hour - 13) / 10),
    weather: hashText(dateKey) % 4 === 0 ? 'drizzle' : 'none',
  }

  return { plots, animals, buildings, processing: processingScene, environment }
}
