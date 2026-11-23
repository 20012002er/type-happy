import { LEARNING_RULES } from '../config/rules'
import type { FarmState } from '../farm/farm-state'
import { PROCESSING_RECIPES } from './recipes'
import {
  isProcessingProduct,
  type PendingProcessingOutput,
  type ProcessingTask,
  type ProcessingWorkshopState,
} from './types'

export interface ProcessingState {
  workshop: ProcessingWorkshopState
  actions: Readonly<Record<string, string>>
}

export interface ProcessingPurchaseEligibility {
  eligible: boolean
  manualHarvestQuantity: number
  requiredManualHarvestQuantity: number
}

export class ProcessingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProcessingValidationError'
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProcessingValidationError(`${path} 必须是对象`)
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProcessingValidationError(`${path} 必须是非空字符串`)
  }
  return value
}

function expectInteger(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new ProcessingValidationError(`${path} 必须是大于等于 ${minimum} 的安全整数`)
  }
  return value
}

function parseTask(value: unknown): ProcessingTask {
  const task = expectRecord(value, 'processing.workshop.activeTask')
  expectString(task.id, 'processing.workshop.activeTask.id')
  const recipeId = expectString(task.recipeId, 'processing.workshop.activeTask.recipeId')
  if (!PROCESSING_RECIPES.some((recipe) => recipe.id === recipeId)) {
    throw new ProcessingValidationError(`未知加工配方：${recipeId}`)
  }
  expectInteger(task.recipeVersion, 'processing.workshop.activeTask.recipeVersion', 1)
  const startedAt = expectInteger(task.startedAt, 'processing.workshop.activeTask.startedAt')
  const completesAt = expectInteger(
    task.completesAt,
    'processing.workshop.activeTask.completesAt',
    1,
  )
  if (completesAt <= startedAt) {
    throw new ProcessingValidationError('加工完成时间必须晚于开始时间')
  }
  return task as unknown as ProcessingTask
}

function parsePendingOutput(value: unknown): PendingProcessingOutput {
  const output = expectRecord(value, 'processing.workshop.pendingOutput')
  expectString(output.taskId, 'processing.workshop.pendingOutput.taskId')
  const productId = expectString(output.productId, 'processing.workshop.pendingOutput.productId')
  if (!isProcessingProduct(productId)) {
    throw new ProcessingValidationError(`未知加工品：${productId}`)
  }
  expectInteger(output.quantity, 'processing.workshop.pendingOutput.quantity', 1)
  expectInteger(output.completedAt, 'processing.workshop.pendingOutput.completedAt')
  return output as unknown as PendingProcessingOutput
}

export function createEmptyProcessingState(): ProcessingState {
  return {
    workshop: { purchased: false, activeTask: null, pendingOutput: null },
    actions: {},
  }
}

export function parseProcessingState(value: unknown): ProcessingState {
  const state = expectRecord(value, 'processing')
  const workshop = expectRecord(state.workshop, 'processing.workshop')
  if (typeof workshop.purchased !== 'boolean') {
    throw new ProcessingValidationError('processing.workshop.purchased 必须是布尔值')
  }
  const activeTask = workshop.activeTask === null ? null : parseTask(workshop.activeTask)
  const pendingOutput =
    workshop.pendingOutput === null ? null : parsePendingOutput(workshop.pendingOutput)
  if (activeTask !== null && pendingOutput !== null) {
    throw new ProcessingValidationError('加工任务与待收产出不能同时存在')
  }
  if (!workshop.purchased && (activeTask !== null || pendingOutput !== null)) {
    throw new ProcessingValidationError('未购买加工坊不能包含加工任务或待收产出')
  }
  const actions = expectRecord(state.actions, 'processing.actions')
  Object.entries(actions).forEach(([actionId, signature]) => {
    if (actionId.trim().length === 0 || typeof signature !== 'string' || signature.length === 0) {
      throw new ProcessingValidationError('加工操作记录无效')
    }
  })
  return state as unknown as ProcessingState
}

export function getProcessingPurchaseEligibility(farm: FarmState): ProcessingPurchaseEligibility {
  let manualHarvestQuantity = 0
  for (const signature of Object.values(farm.actions)) {
    try {
      const action = JSON.parse(signature) as Record<string, unknown>
      if (action.type === 'harvest-crop' && typeof action.plotId === 'string') {
        manualHarvestQuantity += 1
      }
      if (action.type === 'collect-animal-product' && typeof action.animalId === 'string') {
        const animal = farm.animals.find((candidate) => candidate.id === action.animalId)
        if (animal) {
          manualHarvestQuantity += LEARNING_RULES.farm.animals[animal.kind].productQuantity
        }
      }
    } catch {
      // Legacy free-form action signatures do not prove a manual harvest.
    }
  }
  const requiredManualHarvestQuantity = LEARNING_RULES.farm.processing.unlockManualHarvestQuantity
  return {
    eligible: manualHarvestQuantity >= requiredManualHarvestQuantity,
    manualHarvestQuantity,
    requiredManualHarvestQuantity,
  }
}
