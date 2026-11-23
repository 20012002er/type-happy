export const PROCESSING_PRODUCT_IDS = ['flour', 'cream', 'egg-milk-pudding'] as const

export type ProcessingProductId = (typeof PROCESSING_PRODUCT_IDS)[number]

export function isProcessingProduct(value: string): value is ProcessingProductId {
  return PROCESSING_PRODUCT_IDS.some((productId) => productId === value)
}

export interface ProcessingRecipe {
  id: ProcessingProductId
  version: number
  title: string
  inputs: Readonly<Record<string, number>>
  durationMinutes: number
  output: {
    itemId: ProcessingProductId
    quantity: number
  }
  unitPrice: number
  requiredManualHarvests: Readonly<Record<string, number>>
}

export interface ProcessingTask {
  id: string
  recipeId: ProcessingProductId
  recipeVersion: number
  startedAt: number
  completesAt: number
}

export interface PendingProcessingOutput {
  taskId: string
  productId: ProcessingProductId
  quantity: number
  completedAt: number
}

export interface ProcessingWorkshopState {
  purchased: boolean
  activeTask: ProcessingTask | null
  pendingOutput: PendingProcessingOutput | null
}

export type ProcessingSlotStatus = 'idle' | 'processing' | 'ready-to-collect'

export type ProcessingActionKind =
  'purchase-workshop' | 'start-processing' | 'collect-processing' | 'sell-processed-product'
