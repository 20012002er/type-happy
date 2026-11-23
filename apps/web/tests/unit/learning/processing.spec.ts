import { describe, expect, it, vi } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'
import { createEmptyFarmState } from '../../../src/learning/farm/farm-state'
import { transactProcessingOperation } from '../../../src/learning/persistence/processing-transactions'
import { LearningRepository } from '../../../src/learning/persistence/repository'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
} from '../../../src/learning/persistence/snapshot'
import {
  getProcessingRecipe,
  getProcessingSlotStatus,
  PROCESSING_RECIPES,
} from '../../../src/learning/processing/recipes'
import {
  createEmptyProcessingState,
  getProcessingPurchaseEligibility,
  parseProcessingState,
} from '../../../src/learning/processing/state'
import {
  isProcessingProduct,
  PROCESSING_PRODUCT_IDS,
  type ProcessingTask,
  type ProcessingWorkshopState,
} from '../../../src/learning/processing/types'
import { MemoryStorage } from '../../helpers/memory-storage'

const NOW = 1_800_000_000_000
const MINUTE_MS = 60_000

function createWorkshop(activeTask: ProcessingTask | null = null): ProcessingWorkshopState {
  return { purchased: true, activeTask, pendingOutput: null }
}

describe('processing recipes', () => {
  it('exposes the three fixed recipes in display order with all contract parameters', () => {
    expect(PROCESSING_RECIPES).toEqual([
      {
        id: 'flour',
        version: 1,
        title: '面粉',
        inputs: { wheat: 2 },
        durationMinutes: 20,
        output: { itemId: 'flour', quantity: 1 },
        unitPrice: 42,
        requiredManualHarvests: {},
      },
      {
        id: 'cream',
        version: 1,
        title: '奶油',
        inputs: { milk: 1 },
        durationMinutes: 30,
        output: { itemId: 'cream', quantity: 1 },
        unitPrice: 48,
        requiredManualHarvests: { milk: 1 },
      },
      {
        id: 'egg-milk-pudding',
        version: 1,
        title: '蛋奶布丁',
        inputs: { egg: 1, milk: 1 },
        durationMinutes: 45,
        output: { itemId: 'egg-milk-pudding', quantity: 1 },
        unitPrice: 60,
        requiredManualHarvests: { egg: 1, milk: 1 },
      },
    ])

    PROCESSING_PRODUCT_IDS.forEach((productId) => {
      expect(getProcessingRecipe(productId)).toBe(LEARNING_RULES.farm.processing.recipes[productId])
    })
  })

  it('keeps every processed product unit price within the daily sale income cap', () => {
    PROCESSING_RECIPES.forEach((recipe) => {
      expect(recipe.unitPrice).toBeGreaterThan(0)
      expect(recipe.unitPrice).toBeLessThanOrEqual(LEARNING_RULES.farm.dailySaleIncomeCap)
    })
  })

  it('recognizes only processing product IDs', () => {
    PROCESSING_PRODUCT_IDS.forEach((productId) => {
      expect(isProcessingProduct(productId)).toBe(true)
    })
    const nonProductIds = ['wheat', 'milk', 'egg', 'Flour', '']
    nonProductIds.forEach((value) => {
      expect(isProcessingProduct(value)).toBe(false)
    })
  })

  it('rejects an unknown recipe ID', () => {
    expect(() => getProcessingRecipe('unknown')).toThrow('未知加工配方：unknown')
  })
})

describe('processing slot status', () => {
  it('is idle without an active task or pending output', () => {
    const workshop = createWorkshop()
    expect(getProcessingSlotStatus(workshop, NOW)).toBe('idle')
    expect(workshop).toEqual({ purchased: true, activeTask: null, pendingOutput: null })
  })

  it('is processing before completion and ready exactly at the completion boundary', () => {
    const completesAt = NOW + 20 * MINUTE_MS
    const workshop = createWorkshop({
      id: 'task-1',
      recipeId: 'flour',
      recipeVersion: 1,
      startedAt: NOW,
      completesAt,
    })

    expect(getProcessingSlotStatus(workshop, NOW)).toBe('processing')
    expect(getProcessingSlotStatus(workshop, completesAt - 1)).toBe('processing')
    expect(getProcessingSlotStatus(workshop, completesAt)).toBe('ready-to-collect')
    expect(getProcessingSlotStatus(workshop, completesAt + 1)).toBe('ready-to-collect')
    expect(workshop.activeTask?.completesAt).toBe(completesAt)
    expect(workshop.pendingOutput).toBeNull()
  })

  it('always prioritizes pending output over an unfinished active task', () => {
    const workshop = createWorkshop({
      id: 'task-2',
      recipeId: 'cream',
      recipeVersion: 1,
      startedAt: NOW,
      completesAt: NOW + 30 * MINUTE_MS,
    })
    workshop.pendingOutput = {
      taskId: 'task-1',
      productId: 'flour',
      quantity: 1,
      completedAt: NOW,
    }

    expect(getProcessingSlotStatus(workshop, NOW)).toBe('ready-to-collect')
    expect(workshop.activeTask?.id).toBe('task-2')
    expect(workshop.pendingOutput?.productId).toBe('flour')
  })
})

describe('processing snapshot state', () => {
  const task: ProcessingTask = {
    id: 'task-1',
    recipeId: 'flour',
    recipeVersion: 1,
    startedAt: NOW,
    completesAt: NOW + 20 * MINUTE_MS,
  }
  const pendingOutput = {
    taskId: 'task-1',
    productId: 'flour',
    quantity: 1,
    completedAt: task.completesAt,
  } as const
  const stateWithTask = (patch: object = {}) => ({
    workshop: createWorkshop({ ...task, ...patch }),
    actions: {},
  })

  it('accepts empty, active and pending-output states', () => {
    const empty = createEmptyProcessingState()
    expect(parseProcessingState(empty)).toEqual(empty)
    expect(parseProcessingState(stateWithTask())).toEqual(stateWithTask())
    const pending = {
      workshop: { purchased: true, activeTask: null, pendingOutput },
      actions: { collect: 'collect-signature' },
    }
    expect(parseProcessingState(pending)).toEqual(pending)
  })

  it('rejects malformed recipes, times, products and action records', () => {
    expect(() => parseProcessingState(null)).toThrow('processing 必须是对象')
    expect(() => parseProcessingState({ workshop: [], actions: {} })).toThrow('workshop')
    expect(() =>
      parseProcessingState({ workshop: { ...createWorkshop(), purchased: 'yes' }, actions: {} }),
    ).toThrow('purchased')
    expect(() => parseProcessingState(stateWithTask({ id: '' }))).toThrow('activeTask.id')
    expect(() => parseProcessingState(stateWithTask({ recipeId: 'unknown' }))).toThrow(
      '未知加工配方',
    )
    expect(() => parseProcessingState(stateWithTask({ recipeVersion: 0 }))).toThrow('recipeVersion')
    expect(() => parseProcessingState(stateWithTask({ startedAt: -1 }))).toThrow('startedAt')
    expect(() => parseProcessingState(stateWithTask({ completesAt: NOW }))).toThrow(
      '完成时间必须晚于开始时间',
    )

    const pending = (patch: object = {}) => ({
      workshop: {
        purchased: true,
        activeTask: null,
        pendingOutput: { ...pendingOutput, ...patch },
      },
      actions: {},
    })
    expect(() => parseProcessingState(pending({ taskId: '' }))).toThrow('pendingOutput.taskId')
    expect(() => parseProcessingState(pending({ productId: 'wheat' }))).toThrow('未知加工品')
    expect(() => parseProcessingState(pending({ quantity: 0 }))).toThrow('pendingOutput.quantity')
    expect(() => parseProcessingState(pending({ completedAt: -1 }))).toThrow('completedAt')
    expect(() =>
      parseProcessingState({
        workshop: { purchased: true, activeTask: task, pendingOutput },
        actions: {},
      }),
    ).toThrow('不能同时存在')
    expect(() =>
      parseProcessingState({
        workshop: { purchased: false, activeTask: task, pendingOutput: null },
        actions: {},
      }),
    ).toThrow('未购买加工坊')
    expect(() => parseProcessingState({ ...createEmptyProcessingState(), actions: [] })).toThrow(
      'processing.actions',
    )
    expect(() =>
      parseProcessingState({ ...createEmptyProcessingState(), actions: { '': 'signature' } }),
    ).toThrow('操作记录无效')
    expect(() =>
      parseProcessingState({ ...createEmptyProcessingState(), actions: { action: '' } }),
    ).toThrow('操作记录无效')
  })

  it('counts only traceable manual crop and animal harvests for purchase eligibility', () => {
    const farm = createEmptyFarmState()
    farm.actions = {
      'harvest-1': JSON.stringify({ type: 'harvest-crop', plotId: 'plot-1' }),
      'harvest-2': JSON.stringify({ type: 'harvest-crop', plotId: 'plot-2' }),
      'unknown-animal': JSON.stringify({ type: 'collect-animal-product', animalId: 'cow-9' }),
      malformed: '{',
      unrelated: JSON.stringify({ type: 'plant', plotId: 'plot-1' }),
    }
    expect(getProcessingPurchaseEligibility(farm)).toEqual({
      eligible: false,
      manualHarvestQuantity: 2,
      requiredManualHarvestQuantity: 3,
    })
    farm.animals = [{ id: 'cow-1', kind: 'cow', production: null, productPending: false }]
    farm.actions = {
      ...farm.actions,
      'collect-milk': JSON.stringify({ type: 'collect-animal-product', animalId: 'cow-1' }),
    }
    expect(getProcessingPurchaseEligibility(farm)).toEqual({
      eligible: true,
      manualHarvestQuantity: 3,
      requiredManualHarvestQuantity: 3,
    })
  })
})

describe('processing transaction persistence', () => {
  function purchaseWorkshop(snapshot: ReturnType<typeof createEmptyLearningSnapshot>) {
    return {
      ...snapshot,
      processing: {
        ...snapshot.processing,
        workshop: { ...snapshot.processing.workshop, purchased: true },
      },
    }
  }

  it('commits an action record and its state together and deduplicates retries', () => {
    const repository = new LearningRepository(new MemoryStorage())
    const saved = repository.save(createEmptyLearningSnapshot(), 0)
    const operation = vi.fn(purchaseWorkshop)
    const request = { actionId: 'purchase-1', signature: 'purchase-workshop' }
    const purchased = transactProcessingOperation(repository, saved.revision, request, operation)

    expect(purchased.processing.workshop.purchased).toBe(true)
    expect(purchased.processing.actions[request.actionId]).toBe(request.signature)
    expect(purchased.revision).toBe(2)
    const repeated = transactProcessingOperation(repository, purchased.revision, request, operation)
    expect(repeated).toEqual(purchased)
    expect(operation).toHaveBeenCalledTimes(1)
    expect(() =>
      transactProcessingOperation(
        repository,
        purchased.revision,
        { ...request, signature: 'another-operation' },
        operation,
      ),
    ).toThrow('操作 ID 已用于另一项加工操作')
  })

  it('keeps the old snapshot after a write failure and settles only once on retry', () => {
    const storage = new MemoryStorage()
    const repository = new LearningRepository(storage)
    const saved = repository.save(createEmptyLearningSnapshot(), 0)
    const before = storage.getItem(LEARNING_STORAGE_KEY)
    const operation = vi.fn(purchaseWorkshop)
    const request = { actionId: 'purchase-retry', signature: 'purchase-workshop' }
    storage.failNext('setItem')

    expect(() =>
      transactProcessingOperation(repository, saved.revision, request, operation),
    ).toThrow('本次进度暂未保存')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(before)
    expect(repository.load().processing.workshop.purchased).toBe(false)

    const purchased = transactProcessingOperation(repository, saved.revision, request, operation)
    expect(purchased.processing.workshop.purchased).toBe(true)
    transactProcessingOperation(repository, purchased.revision, request, operation)
    expect(operation).toHaveBeenCalledTimes(2)
    expect(repository.load().processing.actions).toEqual({ [request.actionId]: request.signature })
  })

  it('rejects invalid action requests and invalid transactional results without saving', () => {
    const storage = new MemoryStorage()
    const repository = new LearningRepository(storage)
    const saved = repository.save(createEmptyLearningSnapshot(), 0)
    const before = storage.getItem(LEARNING_STORAGE_KEY)
    expect(() =>
      transactProcessingOperation(
        repository,
        saved.revision,
        { actionId: '', signature: 'signature' },
        purchaseWorkshop,
      ),
    ).toThrow('操作 ID 不能为空')
    expect(() =>
      transactProcessingOperation(
        repository,
        saved.revision,
        { actionId: 'action', signature: '' },
        purchaseWorkshop,
      ),
    ).toThrow('操作签名不能为空')
    expect(() =>
      transactProcessingOperation(
        repository,
        saved.revision,
        { actionId: 'invalid-result', signature: 'invalid-result' },
        (snapshot) => ({
          ...snapshot,
          farm: { ...snapshot.farm, inventory: { wheat: -1 } },
        }),
      ),
    ).toThrow('inventory.wheat')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(before)
  })

  it('supports draft mutation and blocks stale revisions before running the operation', () => {
    const storage = new MemoryStorage()
    const first = new LearningRepository(storage)
    const second = new LearningRepository(storage)
    const stale = second.load()
    const saved = first.save(first.load(), 0)
    const request = { actionId: 'draft-action', signature: 'draft-signature' }
    const conflictOperation = vi.fn(purchaseWorkshop)

    expect(() =>
      transactProcessingOperation(second, stale.revision, request, conflictOperation),
    ).toThrow('学习存档已被其他页面更新')
    expect(conflictOperation).not.toHaveBeenCalled()

    const mutated = transactProcessingOperation(first, saved.revision, request, (snapshot) => {
      snapshot.processing.workshop = { ...snapshot.processing.workshop, purchased: true }
    })
    expect(mutated.processing.workshop.purchased).toBe(true)
    expect(mutated.processing.actions[request.actionId]).toBe(request.signature)
  })
})
