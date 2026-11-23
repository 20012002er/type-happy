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
const HOUR = 60 * MINUTE

function fundedSnapshot(balance = 2_000): LearningSnapshot {
  const snapshot = createEmptyLearningSnapshot()
  snapshot.farm = claimStarterGift(snapshot.farm, { actionId: 'starter-gift', now: NOW })
  if (balance > 0) {
    snapshot.wallet = settleWallet(snapshot.wallet, {
      settlementId: 'initial-fund',
      occurredAt: NOW,
      source: 'practice',
      referenceId: 'initial-fund',
      direction: 'earn',
      amount: balance,
    })
  }
  return snapshot
}

function setup(snapshot?: LearningSnapshot, storage = new MemoryStorage()) {
  if (snapshot) storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(snapshot))
  setActivePinia(createPinia())
  const learning = useLearningStore()
  const clock = createManualClock(NOW)
  let id = 0
  expect(
    learning.initialize({
      storage,
      clock,
      random: createSeededRandom(42),
      ids: { next: () => `farm-test-${++id}` },
    }),
  ).toBe(true)
  return { learning, storage, clock }
}

describe('learning farm store orchestration', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('persists planting, fertilizing and harvesting before publishing the snapshot', () => {
    const { learning, storage, clock } = setup(fundedSnapshot(100))
    expect(
      learning.performFarmOperation({ type: 'plant', plotId: 'plot-1', cropId: 'radish' }),
    ).toBe(true)
    expect(learning.snapshot.farm.inventory['radish-seed']).toBe(3)
    expect(learning.notice).toContain('播种成功')

    expect(
      learning.performFarmOperation({ type: 'buy-supplies', itemId: 'fertilizer', quantity: 1 }),
    ).toBe(true)
    expect(learning.performFarmOperation({ type: 'fertilize', plotId: 'plot-1' })).toBe(true)
    expect(learning.snapshot.farm.plots[0].crop).toMatchObject({
      fertilized: true,
      readyAt: NOW + 150_000,
    })
    expect(learning.pendingHarvests).toBe(0)

    clock.advance(150_000)
    expect(learning.getNow()).toBe(NOW + 150_000)
    expect(learning.pendingHarvests).toBe(1)
    expect(learning.performFarmOperation({ type: 'harvest', plotId: 'plot-1' })).toBe(true)
    expect(learning.snapshot.farm.inventory.radish).toBe(1)
    expect(learning.snapshot.farm.plots[0].crop).toBeNull()
    expect(JSON.parse(storage.getItem(LEARNING_STORAGE_KEY)!)).toEqual(learning.snapshot)
  })

  it('coordinates animals, sequential land purchases, buildings and a sale', () => {
    const { learning, clock } = setup(fundedSnapshot())
    expect(learning.performFarmOperation({ type: 'feed', animalId: 'chicken-1' })).toBe(true)
    clock.advance(HOUR)
    learning.getNow()
    expect(learning.pendingHarvests).toBe(1)
    expect(learning.performFarmOperation({ type: 'advance' })).toBe(true)
    expect(learning.snapshot.farm.animals[0].productPending).toBe(true)
    expect(learning.performFarmOperation({ type: 'collect', animalId: 'chicken-1' })).toBe(true)
    expect(learning.snapshot.farm.inventory.egg).toBe(1)

    const revision = learning.snapshot.revision
    expect(learning.performFarmOperation({ type: 'buy-building', building: 'cowshed' })).toBe(false)
    expect(learning.saveError).toContain('第 6 块土地')
    expect(learning.snapshot.revision).toBe(revision)

    expect(learning.performFarmOperation({ type: 'buy-plot' })).toBe(true)
    expect(learning.performFarmOperation({ type: 'buy-plot' })).toBe(true)
    expect(learning.snapshot.farm.plots).toHaveLength(6)
    expect(learning.performFarmOperation({ type: 'buy-building', building: 'chickenCoop' })).toBe(
      true,
    )
    expect(learning.performFarmOperation({ type: 'buy-building', building: 'cowshed' })).toBe(true)
    expect(learning.performFarmOperation({ type: 'buy-animal', kind: 'chicken' })).toBe(true)
    expect(learning.performFarmOperation({ type: 'buy-animal', kind: 'cow' })).toBe(true)
    expect(learning.snapshot.farm.buildings).toEqual({
      chickenCoop: { level: 2 },
      cowshed: { level: 1 },
    })

    expect(
      learning.performFarmOperation({ type: 'buy-supplies', itemId: 'cow-feed', quantity: 1 }),
    ).toBe(true)
    expect(learning.performFarmOperation({ type: 'feed', animalId: 'cow-1' })).toBe(true)
    clock.advance(2 * HOUR)
    expect(learning.performFarmOperation({ type: 'collect', animalId: 'cow-1' })).toBe(true)
    expect(learning.snapshot.farm.inventory.milk).toBe(1)

    const balance = learning.today.walletBalance
    expect(
      learning.performFarmOperation({
        type: 'sell',
        selection: { kind: 'item', itemId: 'egg', quantity: 1 },
      }),
    ).toBe(true)
    expect(learning.today.walletBalance).toBe(balance + 14)
    expect(learning.snapshot.farm.inventory.egg).toBe(0)
  })

  it('gives recovery seeds without coins and keeps failed operations side-effect free', () => {
    const snapshot = fundedSnapshot(0)
    snapshot.farm = { ...snapshot.farm, inventory: {} }
    const { learning } = setup(snapshot)
    expect(learning.performFarmOperation({ type: 'claim-recovery' })).toBe(true)
    expect(learning.snapshot.farm.inventory['radish-seed']).toBe(2)
    expect(learning.today.walletBalance).toBe(0)

    const revision = learning.snapshot.revision
    expect(learning.performFarmOperation({ type: 'claim-recovery' })).toBe(false)
    expect(learning.saveError).toContain('今日已领取过补给')
    expect(learning.snapshot.revision).toBe(revision)
    expect(
      learning.performFarmOperation({ type: 'buy-supplies', itemId: 'wheat-seed', quantity: 1 }),
    ).toBe(false)
    expect(learning.saveError).toContain('还差 12 金币')
    expect(learning.snapshot.farm.inventory['wheat-seed']).toBeUndefined()
  })

  it('does not publish a crop or success notice when saving fails and retries once', () => {
    const { learning, storage } = setup(fundedSnapshot(0))
    storage.failNext('setItem')
    expect(
      learning.performFarmOperation({ type: 'plant', plotId: 'plot-1', cropId: 'radish' }),
    ).toBe(false)
    expect(learning.saveError).toContain('本次进度暂未保存')
    expect(learning.notice).toBe('')
    expect(learning.snapshot.farm.plots[0].crop).toBeNull()
    expect(learning.snapshot.farm.inventory['radish-seed']).toBe(4)

    expect(
      learning.performFarmOperation({ type: 'plant', plotId: 'plot-1', cropId: 'radish' }),
    ).toBe(true)
    expect(learning.snapshot.farm.inventory['radish-seed']).toBe(3)
    expect(Object.keys(learning.snapshot.farm.actions)).toHaveLength(2)
  })

  it('reports revision conflicts and missing initialization without overwriting data', () => {
    const storage = new MemoryStorage()
    const first = setup(undefined, storage).learning
    const second = setup(undefined, storage).learning
    expect(first.performFarmOperation({ type: 'claim-gift' })).toBe(true)
    expect(second.performFarmOperation({ type: 'claim-gift' })).toBe(false)
    expect(second.saveError).toContain('其他页面更新')
    expect(second.snapshot.farm.starterGiftClaimed).toBe(false)

    setActivePinia(createPinia())
    const uninitialized = useLearningStore()
    expect(uninitialized.performFarmOperation({ type: 'claim-gift' })).toBe(false)
    expect(uninitialized.saveError).toContain('尚未准备好')
  })
})
