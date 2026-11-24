import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { claimStarterGift } from '../../src/learning/farm/farm'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../../src/learning/persistence/snapshot'
import { settleWallet } from '../../src/learning/wallet/wallet'
import { useLearningStore } from '../../src/stores/learning'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'
import { createSeededRandom } from '../helpers/seeded-random'

const NOW = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000

function workshopReadySnapshot(): LearningSnapshot {
  const snapshot = createEmptyLearningSnapshot()
  snapshot.farm = claimStarterGift(snapshot.farm, { actionId: 'starter-gift', now: NOW })
  snapshot.farm = {
    ...snapshot.farm,
    inventory: { ...snapshot.farm.inventory, wheat: 2 },
    actions: {
      ...snapshot.farm.actions,
      'harvest-1': JSON.stringify({ type: 'harvest-crop', now: NOW, plotId: 'plot-1' }),
      'harvest-2': JSON.stringify({ type: 'harvest-crop', now: NOW, plotId: 'plot-2' }),
      'harvest-3': JSON.stringify({ type: 'harvest-crop', now: NOW, plotId: 'plot-3' }),
    },
  }
  snapshot.wallet = settleWallet(snapshot.wallet, {
    settlementId: 'initial-fund',
    occurredAt: NOW,
    source: 'practice',
    referenceId: 'initial-fund',
    direction: 'earn',
    amount: 500,
  })
  return snapshot
}

function setup(snapshot: LearningSnapshot, storage = new MemoryStorage()) {
  storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(snapshot))
  setActivePinia(createPinia())
  const learning = useLearningStore()
  const clock = createManualClock(NOW)
  let id = 0
  expect(
    learning.initialize({
      storage,
      clock,
      random: createSeededRandom(42),
      ids: { next: () => `proc-test-${++id}` },
    }),
  ).toBe(true)
  return { learning, storage, clock }
}

describe('learning processing store orchestration', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('persists the full buy → start → settle → collect → sell chain with notices', () => {
    const { learning, storage, clock } = setup(workshopReadySnapshot())
    expect(learning.performProcessingOperation({ type: 'buy-workshop' })).toBe(true)
    expect(learning.notice).toBe('加工坊已建成，可以开始加工农产品')
    expect(learning.snapshot.wallet.balance).toBe(260)
    expect(learning.snapshot.processing.workshop.purchased).toBe(true)

    expect(
      learning.performProcessingOperation({ type: 'start-processing', recipeId: 'flour' }),
    ).toBe(true)
    expect(learning.snapshot.farm.inventory.wheat).toBe(0)
    expect(learning.snapshot.processing.workshop.activeTask?.completesAt).toBe(NOW + 20 * MINUTE)

    clock.advance(20 * MINUTE)
    expect(learning.performFarmOperation({ type: 'advance' })).toBe(true)
    expect(learning.snapshot.processing.workshop.pendingOutput?.productId).toBe('flour')

    expect(learning.performProcessingOperation({ type: 'collect-processing' })).toBe(true)
    expect(learning.notice).toBe('加工品已收入仓库')
    expect(learning.snapshot.farm.inventory.flour).toBe(1)

    expect(
      learning.performProcessingOperation({
        type: 'sell-processing',
        selection: { kind: 'item', itemId: 'flour', quantity: 1 },
      }),
    ).toBe(true)
    expect(learning.snapshot.wallet.balance).toBe(302)
    expect(learning.snapshot.farm.inventory.flour).toBe(0)
    const persisted = JSON.parse(storage.getItem(LEARNING_STORAGE_KEY)!) as LearningSnapshot
    expect(persisted.wallet.balance).toBe(302)
    expect(persisted.processing.workshop.pendingOutput).toBeNull()
    expect(persisted.wallet.ledger.at(-1)).toMatchObject({ source: 'processing-sale', amount: 42 })
  })

  it('keeps inputs untouched when the save fails and settles once on retry', () => {
    const snapshot = workshopReadySnapshot()
    snapshot.processing = {
      ...snapshot.processing,
      workshop: { purchased: true, activeTask: null, pendingOutput: null },
    }
    const { learning, storage } = setup(snapshot)
    storage.failNext('setItem')
    expect(
      learning.performProcessingOperation({ type: 'start-processing', recipeId: 'flour' }),
    ).toBe(false)
    expect(learning.saveError).toBe('本次进度暂未保存，请重试')
    expect(learning.notice).toBe('')
    expect(learning.snapshot.farm.inventory.wheat).toBe(2)
    expect(learning.snapshot.processing.workshop.activeTask).toBeNull()

    expect(
      learning.performProcessingOperation({ type: 'start-processing', recipeId: 'flour' }),
    ).toBe(true)
    expect(learning.snapshot.farm.inventory.wheat).toBe(0)
    const persisted = JSON.parse(storage.getItem(LEARNING_STORAGE_KEY)!) as LearningSnapshot
    expect(persisted.farm.inventory.wheat).toBe(0)
    expect(persisted.processing.workshop.activeTask?.recipeId).toBe('flour')
  })

  it('surfaces domain errors without publishing state changes', () => {
    const { learning } = setup(workshopReadySnapshot())
    expect(
      learning.performProcessingOperation({ type: 'start-processing', recipeId: 'flour' }),
    ).toBe(false)
    expect(learning.saveError).toBe('请先购买加工坊')
    expect(learning.snapshot.farm.inventory.wheat).toBe(2)

    expect(learning.performProcessingOperation({ type: 'buy-workshop' })).toBe(true)
    expect(
      learning.performProcessingOperation({ type: 'start-processing', recipeId: 'flour' }),
    ).toBe(true)
    expect(
      learning.performProcessingOperation({ type: 'start-processing', recipeId: 'flour' }),
    ).toBe(false)
    expect(learning.saveError).toBe('加工位正在使用中')
    expect(learning.snapshot.farm.inventory.wheat).toBe(0)
  })
})
