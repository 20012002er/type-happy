import { describe, expect, it } from 'vitest'
import { toLocalDateKey } from '../../../src/learning/date-key'
import { getWarehouse } from '../../../src/learning/farm/farm'
import { createEmptyFarmState } from '../../../src/learning/farm/farm-state'
import {
  getRecoverySupplyStatus,
  sellFarmProducts,
} from '../../../src/learning/farm/farm-transactions'
import {
  createEmptyLearningSnapshot,
  type LearningSnapshot,
} from '../../../src/learning/persistence/snapshot'
import {
  collectProcessingOutput,
  purchaseProcessingWorkshop,
  quoteProcessingSale,
  sellProcessingProducts,
  settleProcessingWorkshop,
  startProcessingTask,
} from '../../../src/learning/processing/operations'
import {
  getProcessingRecipe,
  getProcessingSlotStatus,
} from '../../../src/learning/processing/recipes'
import {
  getManualHarvestTally,
  getProcessingPurchaseEligibility,
  getRecipeAvailability,
} from '../../../src/learning/processing/state'
import { InsufficientBalanceError, settleWallet } from '../../../src/learning/wallet/wallet'

const NOW = 1_800_000_000_000
const MINUTE = 60_000

function fund(snapshot: LearningSnapshot, amount: number): LearningSnapshot {
  return {
    ...snapshot,
    wallet: settleWallet(snapshot.wallet, {
      settlementId: 'fund',
      occurredAt: NOW,
      source: 'practice',
      referenceId: 'fund',
      direction: 'earn',
      amount,
    }),
  }
}

function withHarvestRecords(
  snapshot: LearningSnapshot,
  records: { crops?: number; eggs?: number; milk?: number },
): LearningSnapshot {
  const actions: Record<string, string> = { ...snapshot.farm.actions }
  const animals = [...snapshot.farm.animals]
  const buildings = { ...snapshot.farm.buildings }
  for (let index = 0; index < (records.crops ?? 0); index += 1) {
    actions[`harvest-crop-${index}`] = JSON.stringify({
      type: 'harvest-crop',
      now: NOW,
      plotId: 'plot-1',
    })
  }
  if (records.eggs) {
    if (!animals.some((animal) => animal.id === 'chicken-1')) {
      animals.push({ id: 'chicken-1', kind: 'chicken', production: null, productPending: false })
      buildings.chickenCoop = { level: 1 }
    }
    for (let index = 0; index < records.eggs; index += 1) {
      actions[`collect-egg-${index}`] = JSON.stringify({
        type: 'collect-animal-product',
        now: NOW,
        animalId: 'chicken-1',
      })
    }
  }
  if (records.milk) {
    if (!animals.some((animal) => animal.id === 'cow-1')) {
      animals.push({ id: 'cow-1', kind: 'cow', production: null, productPending: false })
      buildings.cowshed = { level: 1 }
    }
    for (let index = 0; index < records.milk; index += 1) {
      actions[`collect-milk-${index}`] = JSON.stringify({
        type: 'collect-animal-product',
        now: NOW,
        animalId: 'cow-1',
      })
    }
  }
  return { ...snapshot, farm: { ...snapshot.farm, actions, animals, buildings } }
}

function purchasedSnapshot(balance = 500): LearningSnapshot {
  const snapshot = fund(createEmptyLearningSnapshot(), balance)
  return {
    ...snapshot,
    processing: {
      ...snapshot.processing,
      workshop: { purchased: true, activeTask: null, pendingOutput: null },
    },
  }
}

function withInventory(snapshot: LearningSnapshot, inventory: Record<string, number>) {
  return { ...snapshot, farm: { ...snapshot.farm, inventory: { ...inventory } } }
}

function startFlour(snapshot: LearningSnapshot, actionId = 'start-1', now = NOW) {
  return startProcessingTask(snapshot, { actionId, now, recipeId: 'flour' })
}

describe('T10-01 workshop purchase', () => {
  it('gates purchase on three manual harvests and deducts 240 exactly once', () => {
    const locked = fund(withHarvestRecords(createEmptyLearningSnapshot(), { crops: 2 }), 500)
    expect(() => purchaseProcessingWorkshop(locked, { settlementId: 'buy-1', now: NOW })).toThrow(
      '累计手动收获 3 份后才能购买加工坊（当前 2 份）',
    )
    const ready = fund(withHarvestRecords(createEmptyLearningSnapshot(), { crops: 3 }), 500)
    const purchased = purchaseProcessingWorkshop(ready, { settlementId: 'buy-1', now: NOW })
    expect(purchased.processing.workshop.purchased).toBe(true)
    expect(purchased.wallet.balance).toBe(260)
    expect(purchased.wallet.ledger.at(-1)).toMatchObject({
      source: 'processing-purchase',
      referenceId: 'workshop',
      direction: 'spend',
      amount: 240,
    })
    const repeated = purchaseProcessingWorkshop(purchased, { settlementId: 'buy-1', now: NOW })
    expect(repeated).toEqual(purchased)
    expect(repeated.wallet.ledger.filter((e) => e.source === 'processing-purchase')).toHaveLength(1)
  })

  it('keeps the workshop undelivered when the balance is insufficient', () => {
    const snapshot = fund(withHarvestRecords(createEmptyLearningSnapshot(), { crops: 3 }), 239)
    expect(() => purchaseProcessingWorkshop(snapshot, { settlementId: 'buy-1', now: NOW })).toThrow(
      InsufficientBalanceError,
    )
    expect(() => purchaseProcessingWorkshop(snapshot, { settlementId: 'buy-1', now: NOW })).toThrow(
      '金币不足，还差 1 金币',
    )
    expect(snapshot.processing.workshop.purchased).toBe(false)
    expect(snapshot.wallet.balance).toBe(239)
  })

  it('rejects repurchase with a new settlement and conflicting settlement reuse', () => {
    const ready = fund(withHarvestRecords(createEmptyLearningSnapshot(), { crops: 3 }), 1_000)
    const purchased = purchaseProcessingWorkshop(ready, { settlementId: 'buy-1', now: NOW })
    expect(() =>
      purchaseProcessingWorkshop(purchased, { settlementId: 'buy-2', now: NOW }),
    ).toThrow('加工坊已购买，无需重复购买')
    const funded = fund(createEmptyLearningSnapshot(), 1_000)
    expect(() => purchaseProcessingWorkshop(funded, { settlementId: 'fund', now: NOW })).toThrow(
      '结算 ID 已用于另一项操作',
    )
  })
})

describe('T10-02 recipe availability', () => {
  it('unlocks flour immediately and gates cream/pudding on per-item manual harvests', () => {
    const fresh = createEmptyLearningSnapshot()
    expect(getRecipeAvailability(fresh.farm, getProcessingRecipe('flour')).available).toBe(true)
    expect(getRecipeAvailability(fresh.farm, getProcessingRecipe('cream')).available).toBe(false)
    const withMilk = withHarvestRecords(fresh, { milk: 1 })
    expect(getRecipeAvailability(withMilk.farm, getProcessingRecipe('cream')).available).toBe(true)
    const pudding = getRecipeAvailability(withMilk.farm, getProcessingRecipe('egg-milk-pudding'))
    expect(pudding.available).toBe(false)
    expect(pudding.missing).toEqual([{ itemId: 'egg', required: 1, collected: 0 }])
    const both = withHarvestRecords(fresh, { eggs: 1, milk: 1 })
    expect(
      getRecipeAvailability(both.farm, getProcessingRecipe('egg-milk-pudding')).available,
    ).toBe(true)
    expect(getManualHarvestTally(both.farm).byItemId).toEqual({ egg: 1, milk: 1 })
    expect(getProcessingPurchaseEligibility(both.farm).manualHarvestQuantity).toBe(2)
  })

  it('rejects starting a locked recipe with the missing harvest reason', () => {
    const snapshot = withInventory(purchasedSnapshot(), { milk: 1 })
    expect(() =>
      startProcessingTask(snapshot, {
        actionId: 'start-1',
        now: NOW,
        recipeId: 'egg-milk-pudding',
      }),
    ).toThrow('配方尚未解锁：egg 还需手动收获 1 份')
    expect(snapshot.farm.inventory.milk).toBe(1)
  })
})

describe('T10-03 start processing transaction', () => {
  it('consumes inputs once, creates the unique task and writes no coin ledger entry', () => {
    const snapshot = withInventory(purchasedSnapshot(), { wheat: 3 })
    const ledgerBefore = snapshot.wallet.ledger
    const started = startFlour(snapshot)
    expect(started.farm.inventory.wheat).toBe(1)
    expect(started.processing.workshop.activeTask).toEqual({
      id: 'task-start-1',
      recipeId: 'flour',
      recipeVersion: 1,
      startedAt: NOW,
      completesAt: NOW + 20 * MINUTE,
    })
    expect(started.wallet.ledger).toEqual(ledgerBefore)
    expect(started.processing.actions['start-1']).toBe(
      JSON.stringify({ type: 'start-processing', now: NOW, recipeId: 'flour' }),
    )
    expect(getProcessingSlotStatus(started.processing.workshop, NOW)).toBe('processing')
  })

  it('validates every input item before touching inventory', () => {
    const snapshot = withInventory(withHarvestRecords(purchasedSnapshot(), { eggs: 1, milk: 1 }), {
      egg: 1,
    })
    expect(() =>
      startProcessingTask(snapshot, {
        actionId: 'start-1',
        now: NOW,
        recipeId: 'egg-milk-pudding',
      }),
    ).toThrow('原料不足：milk 还差 1 件')
    expect(snapshot.farm.inventory).toEqual({ egg: 1 })
    expect(snapshot.processing.workshop.activeTask).toBeNull()
  })

  it('enforces the single slot: busy task and pending output both block a new task', () => {
    const busy = startFlour(withInventory(purchasedSnapshot(), { wheat: 4 }))
    expect(() => startFlour(busy, 'start-2')).toThrow('加工位正在使用中')
    const ready = settleProcessingWorkshop(busy, NOW + 20 * MINUTE)
    expect(() => startFlour(ready, 'start-2', NOW + 20 * MINUTE)).toThrow('请先收取待收加工品')
    expect(busy.farm.inventory.wheat).toBe(2)
  })

  it('deduplicates double clicks and rejects action ID reuse with another recipe', () => {
    const snapshot = withInventory(purchasedSnapshot(), { wheat: 4 })
    const started = startFlour(snapshot)
    const repeated = startFlour(started)
    expect(repeated).toEqual(started)
    expect(repeated.farm.inventory.wheat).toBe(2)
    expect(() =>
      startProcessingTask(started, { actionId: 'start-1', now: NOW, recipeId: 'cream' }),
    ).toThrow('操作 ID 已用于另一项加工操作')
  })

  it('rejects unknown recipes and an unpurchased workshop', () => {
    const snapshot = withInventory(purchasedSnapshot(), { wheat: 2 })
    expect(() =>
      startProcessingTask(snapshot, { actionId: 'start-1', now: NOW, recipeId: 'bread' }),
    ).toThrow('未知加工配方')
    const unpurchased = withInventory(fund(createEmptyLearningSnapshot(), 500), { wheat: 2 })
    expect(() => startFlour(unpurchased)).toThrow('请先购买加工坊')
  })
})

describe('T10-05 offline settlement and clock rollback', () => {
  it('settles a completed task into pending output exactly once and stops the timer', () => {
    const started = startFlour(withInventory(purchasedSnapshot(), { wheat: 2 }))
    const early = settleProcessingWorkshop(started, NOW + 19 * MINUTE)
    expect(early.processing.workshop.activeTask).not.toBeNull()
    expect(early.processing.workshop.pendingOutput).toBeNull()
    const settled = settleProcessingWorkshop(started, NOW + 20 * MINUTE)
    expect(settled.processing.workshop.activeTask).toBeNull()
    expect(settled.processing.workshop.pendingOutput).toEqual({
      taskId: 'task-start-1',
      productId: 'flour',
      quantity: 1,
      completedAt: NOW + 20 * MINUTE,
    })
    const repeated = settleProcessingWorkshop(settled, NOW + 40 * MINUTE)
    expect(repeated.processing.workshop).toEqual(settled.processing.workshop)
    expect(settled.farm.inventory.flour ?? 0).toBe(0)
  })

  it('never completes early after a clock rollback', () => {
    const started = startFlour(withInventory(purchasedSnapshot(), { wheat: 2 }))
    const advanced = {
      ...started,
      farm: { ...started.farm, lastAdvancedAt: NOW + 10 * MINUTE },
    }
    const rolledBack = settleProcessingWorkshop(advanced, NOW - 60 * MINUTE)
    expect(rolledBack.processing.workshop.pendingOutput).toBeNull()
    expect(rolledBack.processing.workshop.activeTask?.completesAt).toBe(NOW + 20 * MINUTE)
    expect(rolledBack.farm.lastAdvancedAt).toBe(NOW + 10 * MINUTE)
  })

  it('keeps the pending output waiting indefinitely without auto collecting or restarting', () => {
    const started = startFlour(withInventory(purchasedSnapshot(), { wheat: 2 }))
    const settled = settleProcessingWorkshop(started, NOW + 20 * MINUTE)
    const muchLater = settleProcessingWorkshop(settled, NOW + 365 * 24 * 60 * MINUTE)
    expect(muchLater.processing.workshop.pendingOutput).toEqual(
      settled.processing.workshop.pendingOutput,
    )
    expect(muchLater.processing.workshop.activeTask).toBeNull()
    expect(muchLater.farm.inventory.flour ?? 0).toBe(0)
  })
})

describe('T10-06 manual collection', () => {
  it('rejects early collection and collecting with nothing pending', () => {
    const started = startFlour(withInventory(purchasedSnapshot(), { wheat: 2 }))
    expect(() => collectProcessingOutput(started, { actionId: 'collect-1', now: NOW })).toThrow(
      '加工尚未完成，不能提前收取',
    )
    expect(() =>
      collectProcessingOutput(purchasedSnapshot(), { actionId: 'collect-1', now: NOW }),
    ).toThrow('当前没有待收加工品')
  })

  it('moves the output into the warehouse once and frees the slot for the next manual task', () => {
    const started = startFlour(withInventory(purchasedSnapshot(), { wheat: 4 }))
    const collectAt = NOW + 20 * MINUTE
    const collected = collectProcessingOutput(started, { actionId: 'collect-1', now: collectAt })
    expect(collected.farm.inventory.flour).toBe(1)
    expect(collected.processing.workshop).toEqual({
      purchased: true,
      activeTask: null,
      pendingOutput: null,
    })
    const repeated = collectProcessingOutput(collected, { actionId: 'collect-1', now: collectAt })
    expect(repeated).toEqual(collected)
    expect(repeated.farm.inventory.flour).toBe(1)
    expect(() =>
      collectProcessingOutput(collected, { actionId: 'collect-2', now: collectAt }),
    ).toThrow('当前没有待收加工品')
    const next = startFlour(collected, 'start-2', collectAt)
    expect(next.processing.workshop.activeTask?.id).toBe('task-start-2')
    expect(next.farm.inventory.wheat).toBe(0)
  })
})

describe('T10-08 processed product sale with the shared daily cap', () => {
  function stockedSnapshot(): LearningSnapshot {
    return withInventory(purchasedSnapshot(), { flour: 2, cream: 1, 'egg-milk-pudding': 1 })
  }

  it('quotes item and all selections with recipe prices and settles through processing-sale', () => {
    const snapshot = stockedSnapshot()
    const single = withInventory(purchasedSnapshot(), { flour: 1 })
    const quote = quoteProcessingSale(single.farm, { kind: 'all' }, NOW)
    expect(quote.lines).toEqual([{ itemId: 'flour', quantity: 1, unitPrice: 42, amount: 42 }])
    expect(quote.amount).toBe(42)
    expect(quote.remainingIncome).toBe(60)
    expect(() => quoteProcessingSale(snapshot.farm, { kind: 'all' }, NOW)).toThrow(
      '超出今日出售收入上限',
    )
    const sold = sellProcessingProducts(snapshot, {
      settlementId: 'sell-1',
      now: NOW,
      selection: { kind: 'item', itemId: 'flour', quantity: 1 },
    })
    expect(sold.wallet.balance).toBe(542)
    expect(sold.farm.inventory.flour).toBe(1)
    expect(sold.wallet.ledger.at(-1)).toMatchObject({ source: 'processing-sale', amount: 42 })
    expect(sold.farm.saleIncomeByDate[toLocalDateKey(NOW)]).toBe(42)
    const repeated = sellProcessingProducts(sold, {
      settlementId: 'sell-1',
      now: NOW,
      selection: { kind: 'item', itemId: 'flour', quantity: 1 },
    })
    expect(repeated).toEqual(sold)
  })

  it('shares the 60 coin cap with farm sales across categories and never deducts over-limit stock', () => {
    const dateKey = toLocalDateKey(NOW)
    const snapshot = {
      ...stockedSnapshot(),
      farm: { ...stockedSnapshot().farm, saleIncomeByDate: { [dateKey]: 51 } },
    }
    expect(() =>
      sellProcessingProducts(snapshot, {
        settlementId: 'sell-1',
        now: NOW,
        selection: { kind: 'item', itemId: 'flour', quantity: 1 },
      }),
    ).toThrow('超出今日出售收入上限，当前最多可出售 0 件')
    expect(snapshot.farm.inventory.flour).toBe(2)
    expect(snapshot.wallet.balance).toBe(500)

    const farmSold = sellFarmProducts(withInventory(snapshot, { flour: 2, radish: 1 }), {
      settlementId: 'farm-sell',
      now: NOW,
      selection: { kind: 'item', itemId: 'radish', quantity: 1 },
    })
    expect(farmSold.farm.saleIncomeByDate[dateKey]).toBe(60)
    expect(() =>
      sellProcessingProducts(farmSold, {
        settlementId: 'sell-2',
        now: NOW,
        selection: { kind: 'item', itemId: 'flour', quantity: 1 },
      }),
    ).toThrow('超出今日出售收入上限，当前最多可出售 0 件')
    expect(farmSold.farm.inventory.flour).toBe(2)
  })

  it('keeps production, processing and collection available after the cap is reached', () => {
    const dateKey = toLocalDateKey(NOW)
    const base = withInventory(purchasedSnapshot(), { wheat: 2 })
    const capped = { ...base, farm: { ...base.farm, saleIncomeByDate: { [dateKey]: 60 } } }
    const started = startFlour(capped)
    const collected = collectProcessingOutput(started, {
      actionId: 'collect-1',
      now: NOW + 20 * MINUTE,
    })
    expect(collected.farm.inventory.flour).toBe(1)
  })

  it('rejects invalid selections, missing stock and farm-channel sales of processed products', () => {
    const snapshot = stockedSnapshot()
    expect(() =>
      quoteProcessingSale(snapshot.farm, { kind: 'item', itemId: 'flour', quantity: 3 }, NOW),
    ).toThrow('flour 库存不足，当前可出售 2 件')
    expect(() => quoteProcessingSale(purchasedSnapshot().farm, { kind: 'all' }, NOW)).toThrow(
      '没有可出售的加工品',
    )
    expect(() =>
      sellFarmProducts(snapshot, {
        settlementId: 'sell-x',
        now: NOW,
        selection: { kind: 'item', itemId: 'flour' as never, quantity: 1 },
      }),
    ).toThrow('种子和投入品不可出售')
  })
})

describe('T10-07 warehouse classification', () => {
  it('lists processed products as their own category with recipe prices', () => {
    const snapshot = withInventory(purchasedSnapshot(), { flour: 2, wheat: 1 })
    const groups = getWarehouse(snapshot.farm)
    const processed = groups.find((group) => group.category === 'processed-products')
    expect(processed?.items).toEqual([
      { itemId: 'flour', quantity: 2, salePrice: 42 },
      { itemId: 'cream', quantity: 0, salePrice: 48 },
      { itemId: 'egg-milk-pudding', quantity: 0, salePrice: 60 },
    ])
    const crops = groups.find((group) => group.category === 'crops')
    expect(crops?.items.map((item) => item.itemId)).toEqual(['radish', 'wheat', 'corn', 'pumpkin'])
  })
})

describe('T10-09 recovery supply considers processing assets', () => {
  function assetlessSnapshot(): LearningSnapshot {
    const snapshot = createEmptyLearningSnapshot()
    return {
      ...snapshot,
      farm: { ...createEmptyFarmState(), starterGiftClaimed: true },
      processing: {
        ...snapshot.processing,
        workshop: { purchased: true, activeTask: null, pendingOutput: null },
      },
    }
  }

  it('blocks supply while inputs are processing, output is pending or processed stock exists', () => {
    const base = assetlessSnapshot()
    expect(getRecoverySupplyStatus(base, NOW).eligible).toBe(true)
    const started = startFlour(withInventory(base, { wheat: 2 }))
    expect(getRecoverySupplyStatus(started, NOW).reasons).toContain('加工坊仍有加工中的原料')
    const settled = settleProcessingWorkshop(started, NOW + 20 * MINUTE)
    expect(getRecoverySupplyStatus(settled, NOW + 20 * MINUTE).reasons).toContain(
      '加工坊仍有待收加工品',
    )
    const collected = collectProcessingOutput(settled, {
      actionId: 'collect-1',
      now: NOW + 20 * MINUTE,
    })
    const status = getRecoverySupplyStatus(collected, NOW + 20 * MINUTE)
    expect(status.eligible).toBe(false)
    expect(status.reasons).toContain('仓库仍有可出售加工品')
  })
})
