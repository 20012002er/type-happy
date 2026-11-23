import { LEARNING_RULES } from '../config/rules'
import {
  PROCESSING_PRODUCT_IDS,
  type ProcessingRecipe,
  type ProcessingSlotStatus,
  type ProcessingWorkshopState,
} from './types'

export const PROCESSING_RECIPES: readonly ProcessingRecipe[] = PROCESSING_PRODUCT_IDS.map(
  (productId) => LEARNING_RULES.farm.processing.recipes[productId],
)

export function getProcessingRecipe(id: string): ProcessingRecipe {
  const recipe = PROCESSING_RECIPES.find((candidate) => candidate.id === id)
  if (!recipe) throw new Error(`未知加工配方：${id}`)
  return recipe
}

export function getProcessingSlotStatus(
  workshop: ProcessingWorkshopState,
  now: number,
): ProcessingSlotStatus {
  if (workshop.pendingOutput !== null) return 'ready-to-collect'
  if (workshop.activeTask === null) return 'idle'
  return now >= workshop.activeTask.completesAt ? 'ready-to-collect' : 'processing'
}
