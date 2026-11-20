import { describe, expect, it } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'
import {
  claimStarterGift,
  collectAnimalProduct,
  feedAnimal,
  harvestCrop,
  plantCrop,
} from '../../../src/learning/farm/farm'
import { advanceFarmTime } from '../../../src/learning/farm/farm-state'
import {
  claimRecoverySupply,
  DailySaleLimitError,
  type FarmSaleSelection,
  getRecoverySupplyStatus,
  purchaseFarmAnimal,
  purchaseFarmSupplies,
  purchaseNextPlot,
  purchaseOrUpgradeBuilding,
  quoteFarmSale,
  sellFarmProducts,
  transactFarmOperation,
} from '../../../src/learning/farm/farm-transactions'
import { LearningRepository } from '../../../src/learning/persistence/repository'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../../../src/learning/persistence/snapshot'
import { settleWallet } from '../../../src/learning/wallet/wallet'
import { MemoryStorage } from '../../helpers/memory-storage'

const NOW = new Date(2026, 10, 20, 8, 0, 0).getTime()
const NEXT_DAY = new Date(2026, 10, 21, 8, 0, 0).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE

function fundedSnapshot(balance = 2_000): LearningSnapshot {
  let snapshot = createEmptyLearningSnapshot()
  snapshot.farm = claimStarterGift(snapshot.farm, { actionId: 'starter-gift', now: NOW })
  if (balance > 0) snapshot = addLearningIncome(snapshot, balance, 'initial-fund', NOW)
  return snapshot
}

function addLearningIncome(
  snapshot: LearningSnapshot,
  amount: number,
  id: string,
  now: number,
): LearningSnapshot {
  return {
    ...snapshot,
    wallet: settleWallet(snapshot.wallet, {
      settlementId: id,
      occurredAt: now,
      source: 'practice',
      referenceId: id,
      direction: 'earn',
      amount,
    }),
  }
}

function emptyRecoverySnapshot(): LearningSnapshot {
  const snapshot = fundedSnapshot(0)
  return { ...snapshot, farm: { ...snapshot.farm, inventory: {} } }
}

describe('farm purchases and building progression', () => {
  it('charges the configured prices for every seed, fertilizer and animal feed', () => {
    const itemIds = [
      'radish-seed',
      'wheat-seed',
      'corn-seed',
      'pumpkin-seed',
      'fertilizer',
      'chicken-feed',
      'cow-feed',
    ] as const
    let snapshot = fundedSnapshot()
    itemIds.forEach((itemId) => {
      snapshot = purchaseFarmSupplies(snapshot, {
        settlementId: `buy-${itemId}`,
        now: NOW,
        itemId,
        quantity: 1,
      })
    })
    expect(snapshot.wallet.balance).toBe(2_000 - 105)
    expect(snapshot.farm.inventory).toMatchObject({
      'wheat-seed': 1,
      'corn-seed': 1,
      'pumpkin-seed': 1,
      fertilizer: 1,
      'chicken-feed': 3,
      'cow-feed': 1,
    })
    expect(snapshot.farm.inventory['radish-seed']).toBe(5)

    const before = snapshot
    expect(() =>
      purchaseFarmSupplies(snapshot, {
        settlementId: 'unaffordable-feed',
        now: NOW,
        itemId: 'cow-feed',
        quantity: 1_000,
      }),
    ).toThrow('金币不足')
    expect(snapshot).toBe(before)
    expect(snapshot.farm.inventory['cow-feed']).toBe(1)
    const feedPurchase = purchaseFarmSupplies(snapshot, {
      settlementId: 'shared-settlement',
      now: NOW,
      itemId: 'chicken-feed',
      quantity: 1,
    })
    expect(() =>
      purchaseFarmAnimal(feedPurchase, {
        settlementId: 'shared-settlement',
        now: NOW,
        kind: 'chicken',
      }),
    ).toThrow('结算 ID 已用于另一项操作')
    expect(() =>
      purchaseFarmSupplies(snapshot, {
        settlementId: 'invalid-supply',
        now: NOW,
        itemId: 'egg' as 'radish-seed',
        quantity: 1,
      }),
    ).toThrow('不是可购买')
  })

  it('buys plots strictly in order at 100/160/240/320 and stops at eight', () => {
    let snapshot = fundedSnapshot()
    LEARNING_RULES.farm.plots.purchasePrices.forEach((price, index) => {
      const balanceBefore = snapshot.wallet.balance
      snapshot = purchaseNextPlot(snapshot, {
        settlementId: `buy-plot-${index + 5}`,
        now: NOW,
      })
      expect(snapshot.farm.plots.at(-1)?.id).toBe(`plot-${index + 5}`)
      expect(snapshot.wallet.balance).toBe(balanceBefore - price)
    })
    expect(snapshot.farm.plots).toHaveLength(8)
    expect(snapshot.wallet.balance).toBe(1_180)
    expect(() => purchaseNextPlot(snapshot, { settlementId: 'buy-plot-9', now: NOW })).toThrow()
  })

  it('is idempotent for plot purchases and persists assets with their ledger entry', () => {
    const storage = new MemoryStorage()
    const repository = new LearningRepository(storage)
    const funded = repository.save(fundedSnapshot(), 0)
    const purchased = transactFarmOperation(repository, funded.revision, (snapshot) =>
      purchaseNextPlot(snapshot, { settlementId: 'buy-plot-5', now: NOW }),
    )
    const repeated = transactFarmOperation(repository, purchased.revision, (snapshot) =>
      purchaseNextPlot(snapshot, { settlementId: 'buy-plot-5', now: NOW }),
    )
    expect(repeated).toEqual(purchased)
    expect(repeated.revision).toBe(2)
    expect(repository.load().farm.plots).toHaveLength(5)
    expect(repository.load().wallet.ledger.at(-1)).toMatchObject({
      settlementId: 'buy-plot-5',
      amount: 100,
    })
  })

  it('upgrades the chicken coop from two to four slots without removing animals', () => {
    let snapshot = purchaseFarmAnimal(fundedSnapshot(), {
      settlementId: 'buy-chicken-2',
      now: NOW,
      kind: 'chicken',
    })
    expect(() =>
      purchaseFarmAnimal(snapshot, {
        settlementId: 'buy-chicken-3-locked',
        now: NOW,
        kind: 'chicken',
      }),
    ).toThrow('栏位不足')
    snapshot = purchaseOrUpgradeBuilding(snapshot, {
      settlementId: 'upgrade-coop',
      now: NOW,
      building: 'chickenCoop',
    })
    expect(snapshot.farm.buildings.chickenCoop.level).toBe(2)
    expect(snapshot.farm.animals.map((animal) => animal.id)).toEqual(['chicken-1', 'chicken-2'])
    snapshot = purchaseFarmAnimal(snapshot, {
      settlementId: 'buy-chicken-3',
      now: NOW,
      kind: 'chicken',
    })
    snapshot = purchaseFarmAnimal(snapshot, {
      settlementId: 'buy-chicken-4',
      now: NOW,
      kind: 'chicken',
    })
    expect(snapshot.farm.animals).toHaveLength(4)
    expect(snapshot.wallet.balance).toBe(1_460)
    expect(
      purchaseOrUpgradeBuilding(snapshot, {
        settlementId: 'upgrade-coop',
        now: NOW,
        building: 'chickenCoop',
      }),
    ).toBe(snapshot)
    expect(
      purchaseFarmAnimal(snapshot, { settlementId: 'buy-chicken-4', now: NOW, kind: 'chicken' }),
    ).toBe(snapshot)
  })

  it('rejects unknown buildings and building purchases before the starter gift', () => {
    const snapshot = fundedSnapshot()
    expect(() =>
      purchaseOrUpgradeBuilding(snapshot, {
        settlementId: 'unknown-building',
        now: NOW,
        building: 'pigsty' as 'cowshed',
      }),
    ).toThrow('建筑类型未知')
    const withoutGift = addLearningIncome(createEmptyLearningSnapshot(), 1_000, 'fund', NOW)
    expect(() =>
      purchaseOrUpgradeBuilding(withoutGift, {
        settlementId: 'building-before-gift',
        now: NOW,
        building: 'chickenCoop',
      }),
    ).toThrow('新手礼包')
  })

  it('unlocks the cowshed at plot six and preserves cows through upgrade', () => {
    let snapshot = fundedSnapshot(3_000)
    expect(() =>
      purchaseOrUpgradeBuilding(snapshot, {
        settlementId: 'cowshed-locked',
        now: NOW,
        building: 'cowshed',
      }),
    ).toThrow('第 6 块土地')
    snapshot = purchaseNextPlot(snapshot, { settlementId: 'plot-5', now: NOW })
    snapshot = purchaseNextPlot(snapshot, { settlementId: 'plot-6', now: NOW })
    snapshot = purchaseOrUpgradeBuilding(snapshot, {
      settlementId: 'buy-cowshed',
      now: NOW,
      building: 'cowshed',
    })
    snapshot = purchaseFarmAnimal(snapshot, { settlementId: 'buy-cow-1', now: NOW, kind: 'cow' })
    expect(() =>
      purchaseFarmAnimal(snapshot, { settlementId: 'buy-cow-2-locked', now: NOW, kind: 'cow' }),
    ).toThrow('栏位不足')
    snapshot = purchaseOrUpgradeBuilding(snapshot, {
      settlementId: 'upgrade-cowshed',
      now: NOW,
      building: 'cowshed',
    })
    snapshot = purchaseFarmAnimal(snapshot, { settlementId: 'buy-cow-2', now: NOW, kind: 'cow' })
    expect(snapshot.farm.buildings.cowshed.level).toBe(2)
    expect(snapshot.farm.animals.filter((animal) => animal.kind === 'cow')).toHaveLength(2)
    expect(snapshot.farm.animals.find((animal) => animal.id === 'cow-1')).toBeDefined()
  })
})

describe('farm warehouse sales and daily cap', () => {
  it('sells one item with quantity × unit price and prevents duplicate income', () => {
    const snapshot = fundedSnapshot(0)
    snapshot.farm = { ...snapshot.farm, inventory: { radish: 3 } }
    const sold = sellFarmProducts(snapshot, {
      settlementId: 'sell-radishes',
      now: NOW,
      selection: { kind: 'item', itemId: 'radish', quantity: 2 },
    })
    expect(sold.wallet.balance).toBe(18)
    expect(sold.tasks).toBe(snapshot.tasks)
    expect(sold.farm.inventory.radish).toBe(1)
    expect(sold.wallet.ledger[0]).toMatchObject({ source: 'farm-sale', amount: 18 })
    expect(
      sellFarmProducts(sold, {
        settlementId: 'sell-radishes',
        now: NOW,
        selection: { kind: 'item', itemId: 'radish', quantity: 2 },
      }),
    ).toBe(sold)
    expect(() =>
      sellFarmProducts(sold, {
        settlementId: 'sell-radishes',
        now: NOW,
        selection: { kind: 'item', itemId: 'radish', quantity: 1 },
      }),
    ).toThrow('结算 ID')
  })

  it('supports category and all-product sales with an auditable item manifest', () => {
    let categorySnapshot = fundedSnapshot(0)
    categorySnapshot.farm = {
      ...categorySnapshot.farm,
      inventory: { radish: 2, wheat: 1, egg: 1 },
    }
    categorySnapshot = sellFarmProducts(categorySnapshot, {
      settlementId: 'sell-crops',
      now: NOW,
      selection: { kind: 'category', category: 'crops' },
    })
    expect(categorySnapshot.wallet.balance).toBe(36)
    expect(categorySnapshot.farm.inventory).toMatchObject({ radish: 0, wheat: 0, egg: 1 })
    expect(categorySnapshot.wallet.ledger[0].referenceId).toContain('radish:2,wheat:1')

    let allSnapshot = fundedSnapshot(0)
    allSnapshot.farm = { ...allSnapshot.farm, inventory: { radish: 1, egg: 1, milk: 1 } }
    const quote = quoteFarmSale(allSnapshot.farm, { kind: 'all' }, NOW)
    expect(quote).toMatchObject({ quantity: 3, amount: 55 })
    allSnapshot = sellFarmProducts(allSnapshot, {
      settlementId: 'sell-all',
      now: NOW,
      selection: { kind: 'all' },
    })
    expect(allSnapshot.wallet.balance).toBe(55)
    expect(allSnapshot.farm.inventory).toMatchObject({ radish: 0, egg: 0, milk: 0 })
  })

  it('rejects over-limit quantities and reports the maximum sale quantity', () => {
    const snapshot = fundedSnapshot(0)
    snapshot.farm = { ...snapshot.farm, inventory: { radish: 10 } }
    expect(() =>
      sellFarmProducts(snapshot, {
        settlementId: 'sell-too-many',
        now: NOW,
        selection: { kind: 'item', itemId: 'radish', quantity: 7 },
      }),
    ).toThrow(DailySaleLimitError)
    try {
      sellFarmProducts(snapshot, {
        settlementId: 'sell-too-many',
        now: NOW,
        selection: { kind: 'item', itemId: 'radish', quantity: 7 },
      })
    } catch (error) {
      expect(error).toMatchObject({ remainingIncome: 60, maximumQuantity: 6 })
    }
    expect(snapshot.wallet.balance).toBe(0)
    expect(snapshot.farm.inventory.radish).toBe(10)
  })

  it('caps each local day at 60 without blocking harvest and resets the next day', () => {
    let snapshot = fundedSnapshot(0)
    snapshot.farm = { ...snapshot.farm, inventory: { egg: 2, milk: 1, 'radish-seed': 1 } }
    snapshot = sellFarmProducts(snapshot, {
      settlementId: 'sell-60',
      now: NOW,
      selection: { kind: 'all' },
    })
    expect(snapshot.wallet.balance).toBe(60)
    snapshot.farm = plantCrop(snapshot.farm, {
      actionId: 'plant-at-cap',
      now: NOW,
      plotId: 'plot-1',
      cropId: 'radish',
    })
    snapshot.farm = harvestCrop(snapshot.farm, {
      actionId: 'harvest-at-cap',
      now: NOW + 5 * MINUTE,
      plotId: 'plot-1',
    })
    expect(snapshot.farm.inventory.radish).toBe(1)
    expect(() =>
      sellFarmProducts(snapshot, {
        settlementId: 'sell-over-cap',
        now: NOW + 5 * MINUTE,
        selection: { kind: 'item', itemId: 'radish', quantity: 1 },
      }),
    ).toThrow('最多可出售 0 件')
    snapshot = sellFarmProducts(snapshot, {
      settlementId: 'sell-next-day',
      now: NEXT_DAY,
      selection: { kind: 'item', itemId: 'radish', quantity: 1 },
    })
    expect(snapshot.wallet.balance).toBe(69)
  })

  it('does not let a clock rollback reopen an earlier daily allowance', () => {
    let snapshot = fundedSnapshot(0)
    snapshot.farm = { ...snapshot.farm, inventory: { egg: 2, milk: 1, radish: 1 } }
    snapshot = sellFarmProducts(snapshot, {
      settlementId: 'sell-60',
      now: NEXT_DAY,
      selection: { kind: 'item', itemId: 'milk', quantity: 1 },
    })
    snapshot = sellFarmProducts(snapshot, {
      settlementId: 'sell-eggs',
      now: NEXT_DAY,
      selection: { kind: 'category', category: 'animal-products' },
    })
    expect(snapshot.wallet.balance).toBe(60)
    expect(() =>
      sellFarmProducts(snapshot, {
        settlementId: 'rollback-sale',
        now: NOW,
        selection: { kind: 'item', itemId: 'radish', quantity: 1 },
      }),
    ).toThrow(DailySaleLimitError)
    expect(snapshot.wallet.balance).toBe(60)
    expect(snapshot.farm.inventory.radish).toBe(1)
  })

  it('validates sale quantities, available inventory and safe totals', () => {
    const snapshot = fundedSnapshot(0)
    snapshot.farm = { ...snapshot.farm, inventory: { radish: 1 } }
    expect(() =>
      quoteFarmSale(snapshot.farm, { kind: 'item', itemId: 'radish', quantity: 0 }, NOW),
    ).toThrow('出售数量')
    expect(() =>
      quoteFarmSale(snapshot.farm, { kind: 'item', itemId: 'radish', quantity: 2 }, NOW),
    ).toThrow('库存不足')
    expect(() =>
      quoteFarmSale(snapshot.farm, { kind: 'category', category: 'crops' }, NOW),
    ).not.toThrow()
    expect(() =>
      quoteFarmSale(snapshot.farm, { kind: 'category', category: 'animal-products' }, NOW),
    ).toThrow('没有可出售')
    snapshot.farm = {
      ...snapshot.farm,
      inventory: { radish: Number.MAX_SAFE_INTEGER },
    }
    expect(() =>
      quoteFarmSale(
        snapshot.farm,
        { kind: 'item', itemId: 'radish', quantity: Number.MAX_SAFE_INTEGER },
        NOW,
      ),
    ).toThrow('金额超出安全整数')
  })

  it('rejects seeds and other inputs from every sale path', () => {
    const snapshot = fundedSnapshot(0)
    expect(() =>
      sellFarmProducts(snapshot, {
        settlementId: 'sell-seed',
        now: NOW,
        selection: {
          kind: 'item',
          itemId: 'radish-seed',
          quantity: 1,
        } as unknown as FarmSaleSelection,
      }),
    ).toThrow('不可出售')
    expect(() =>
      quoteFarmSale(
        snapshot.farm,
        { kind: 'category', category: 'seeds' } as unknown as FarmSaleSelection,
        NOW,
      ),
    ).toThrow('不可出售')
  })
})

describe('farm recovery supply and atomic persistence', () => {
  it('appears only when every recovery condition is met', () => {
    const baseline = emptyRecoverySnapshot()
    expect(getRecoverySupplyStatus(baseline, NOW).eligible).toBe(true)

    expect(
      getRecoverySupplyStatus(addLearningIncome(baseline, 6, 'six-coins', NOW), NOW).eligible,
    ).toBe(false)
    expect(
      getRecoverySupplyStatus(
        { ...baseline, farm: { ...baseline.farm, inventory: { egg: 1 } } },
        NOW,
      ).eligible,
    ).toBe(false)
    expect(
      getRecoverySupplyStatus(
        { ...baseline, farm: { ...baseline.farm, inventory: { 'wheat-seed': 1 } } },
        NOW,
      ).eligible,
    ).toBe(false)
    expect(
      getRecoverySupplyStatus(
        { ...baseline, farm: { ...baseline.farm, inventory: { 'chicken-feed': 1 } } },
        NOW,
      ).eligible,
    ).toBe(false)
    const growing = {
      ...baseline,
      farm: plantCrop(
        { ...baseline.farm, inventory: { 'radish-seed': 1 } },
        { actionId: 'growing', now: NOW, plotId: 'plot-1', cropId: 'radish' },
      ),
    }
    expect(getRecoverySupplyStatus(growing, NOW).eligible).toBe(false)
    const producing = {
      ...baseline,
      farm: feedAnimal(
        { ...baseline.farm, inventory: { 'chicken-feed': 1 } },
        { actionId: 'producing', now: NOW, animalId: 'chicken-1' },
      ),
    }
    expect(getRecoverySupplyStatus(producing, NOW).eligible).toBe(false)
  })

  it('delivers only two radish seeds once per local day and never coins', () => {
    const baseline = emptyRecoverySnapshot()
    const claimed = claimRecoverySupply(baseline, { actionId: 'recovery-1', now: NOW })
    expect(claimed.farm.inventory['radish-seed']).toBe(2)
    expect(claimed.wallet).toBe(baseline.wallet)
    expect(claimed.wallet.balance).toBe(0)
    expect(claimRecoverySupply(claimed, { actionId: 'recovery-1', now: NOW })).toBe(claimed)
    expect(() =>
      claimRecoverySupply(claimed, { actionId: 'recovery-again', now: NOW + 1 }),
    ).toThrow('今日已领取')
    expect(getRecoverySupplyStatus(claimed, NEXT_DAY).claimedToday).toBe(false)
  })

  it('does not reopen recovery claims when the clock returns to an earlier date', () => {
    const claimed = claimRecoverySupply(emptyRecoverySnapshot(), {
      actionId: 'recovery-tomorrow',
      now: NEXT_DAY,
    })
    expect(getRecoverySupplyStatus(claimed, NOW).claimedToday).toBe(true)
    expect(() => claimRecoverySupply(claimed, { actionId: 'recovery-rollback', now: NOW })).toThrow(
      '今日已领取',
    )
    expect(claimed.farm.inventory['radish-seed']).toBe(2)
    expect(claimed.wallet.balance).toBe(0)
  })

  it('advances a reopened save once without touching tasks or granting coins', () => {
    const storage = new MemoryStorage()
    const repository = new LearningRepository(storage)
    const initial = fundedSnapshot(0)
    initial.farm = feedAnimal(initial.farm, {
      actionId: 'feed-before-close',
      now: NOW,
      animalId: 'chicken-1',
    })
    const saved = repository.save(initial, 0)
    const reopenedRepository = new LearningRepository(storage)
    const reopened = transactFarmOperation(reopenedRepository, saved.revision, (snapshot) => ({
      ...snapshot,
      farm: advanceFarmTime(snapshot.farm, NOW + 24 * HOUR),
    }))
    expect(reopened.farm.animals[0].productPending).toBe(true)
    expect(reopened.wallet).toEqual(saved.wallet)
    expect(reopened.tasks).toEqual(saved.tasks)
    const rolledBack = transactFarmOperation(reopenedRepository, reopened.revision, (snapshot) => ({
      ...snapshot,
      farm: advanceFarmTime(snapshot.farm, NOW - 24 * HOUR),
    }))
    expect(rolledBack).toEqual(reopened)
    expect(repository.load().farm.animals[0].productPending).toBe(true)
  })

  it('keeps the last saved wallet and farm when a farm transaction cannot be written', () => {
    const storage = new MemoryStorage()
    const repository = new LearningRepository(storage)
    const funded = repository.save(fundedSnapshot(), 0)
    const before = storage.getItem(LEARNING_STORAGE_KEY)
    storage.failNext('setItem')
    expect(() =>
      transactFarmOperation(repository, funded.revision, (snapshot) =>
        purchaseNextPlot(snapshot, { settlementId: 'failed-plot', now: NOW }),
      ),
    ).toThrow('本次进度暂未保存')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(before)
    expect(repository.load().farm.plots).toHaveLength(4)
    expect(repository.load().wallet.balance).toBe(2_000)
  })
})

describe('farm economic simulation', () => {
  it('keeps normal learning income above capped farm sale income across two days', () => {
    let snapshot = fundedSnapshot(0)
    snapshot.farm.plots.forEach((plot, index) => {
      snapshot.farm = plantCrop(snapshot.farm, {
        actionId: `initial-plant-${index}`,
        now: NOW,
        plotId: plot.id,
        cropId: 'radish',
      })
    })
    snapshot.farm = feedAnimal(snapshot.farm, {
      actionId: 'initial-feed',
      now: NOW,
      animalId: 'chicken-1',
    })
    const dailySales: number[] = []
    for (const [dayIndex, dayStart] of [NOW + HOUR, NEXT_DAY].entries()) {
      snapshot = addLearningIncome(snapshot, 110, `learning-day-${dayIndex}`, dayStart)
      snapshot.farm = advanceFarmTime(snapshot.farm, dayStart)
      snapshot.farm.plots.forEach((plot, index) => {
        if (plot.crop) {
          snapshot.farm = harvestCrop(snapshot.farm, {
            actionId: `day-${dayIndex}-harvest-${index}`,
            now: dayStart,
            plotId: plot.id,
          })
        }
      })
      if (snapshot.farm.animals[0].productPending) {
        snapshot.farm = collectAnimalProduct(snapshot.farm, {
          actionId: `day-${dayIndex}-collect-egg`,
          now: dayStart,
          animalId: 'chicken-1',
        })
      }
      const sale = quoteFarmSale(
        snapshot.farm,
        { kind: 'item', itemId: 'radish', quantity: 4 },
        dayStart,
      )
      snapshot = sellFarmProducts(snapshot, {
        settlementId: `day-${dayIndex}-sale`,
        now: dayStart,
        selection: { kind: 'item', itemId: 'radish', quantity: 4 },
      })
      dailySales.push(sale.amount)
      expect(sale.amount).toBeLessThanOrEqual(60)
      expect(110).toBeGreaterThan(sale.amount)

      if (dayIndex === 0) {
        snapshot = purchaseFarmSupplies(snapshot, {
          settlementId: 'replant-seeds',
          now: dayStart,
          itemId: 'radish-seed',
          quantity: 4,
        })
        snapshot.farm.plots.forEach((plot, index) => {
          snapshot.farm = plantCrop(snapshot.farm, {
            actionId: `day-${dayIndex}-plant-${index}`,
            now: dayStart,
            plotId: plot.id,
            cropId: 'radish',
          })
        })
      }
    }
    expect(dailySales).toEqual([36, 36])
    expect(snapshot.wallet.ledger.filter((entry) => entry.source === 'practice')).toHaveLength(2)
    expect(snapshot.wallet.ledger.filter((entry) => entry.source === 'farm-sale')).toHaveLength(2)
  })
})
