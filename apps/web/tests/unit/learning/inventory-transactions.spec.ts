import { describe, expect, it } from 'vitest'
import {
  applyInventorySettlement,
  InsufficientInventoryError,
  transactInventorySettlement,
  type InventorySettlementRequest,
} from '../../../src/learning/persistence/inventory-transactions'
import { LearningRepository } from '../../../src/learning/persistence/repository'
import { LEARNING_STORAGE_KEY } from '../../../src/learning/persistence/snapshot'
import { settleWallet } from '../../../src/learning/wallet/wallet'
import { createLearningSnapshotFixture } from '../../fixtures/learning'
import { MemoryStorage } from '../../helpers/memory-storage'

const purchase = (
  overrides: Partial<InventorySettlementRequest> = {},
): InventorySettlementRequest => ({
  settlementId: 'buy-radish-1',
  occurredAt: 100,
  itemId: 'radish-seed',
  direction: 'purchase',
  quantity: 2,
  unitPrice: 6,
  ...overrides,
})

function fundedSnapshot() {
  const snapshot = createLearningSnapshotFixture()
  snapshot.wallet = settleWallet(snapshot.wallet, {
    settlementId: 'fund',
    occurredAt: 1,
    source: 'practice',
    referenceId: 'practice',
    direction: 'earn',
    amount: 100,
  })
  return snapshot
}

describe('inventory and wallet atomic settlement', () => {
  it('debts coins and delivers items in one immutable result', () => {
    const original = fundedSnapshot()
    const purchased = applyInventorySettlement(original, purchase())

    expect(purchased.wallet.balance).toBe(88)
    expect(purchased.farm.inventory['radish-seed']).toBe(2)
    expect(original.wallet.balance).toBe(100)
    expect(original.farm.inventory['radish-seed']).toBeUndefined()
    expect(purchased.wallet.ledger).toHaveLength(2)
  })

  it('deducts inventory and adds sale income once', () => {
    const original = applyInventorySettlement(fundedSnapshot(), purchase())
    const sold = applyInventorySettlement(
      original,
      purchase({ settlementId: 'sell-radish-1', direction: 'sale', quantity: 1, unitPrice: 9 }),
    )

    expect(sold.wallet.balance).toBe(97)
    expect(sold.farm.inventory['radish-seed']).toBe(1)
    expect(sold.wallet.ledger.at(-1)).toMatchObject({
      source: 'farm-sale',
      direction: 'earn',
      amount: 9,
    })
  })

  it('returns the original result for an exact duplicate settlement', () => {
    const repository = new LearningRepository(new MemoryStorage())
    const funded = repository.save(fundedSnapshot(), 0)
    const purchased = transactInventorySettlement(repository, funded.revision, purchase())
    const repeated = transactInventorySettlement(repository, purchased.revision, purchase())

    expect(repeated).toEqual(purchased)
    expect(repeated.revision).toBe(2)
    expect(repeated.wallet.balance).toBe(88)
    expect(repeated.farm.inventory['radish-seed']).toBe(2)
  })

  it('does not deliver items when balance is insufficient', () => {
    const original = fundedSnapshot()
    expect(() => applyInventorySettlement(original, purchase({ quantity: 20 }))).toThrow('金币不足')
    expect(original.farm.inventory['radish-seed']).toBeUndefined()
    expect(original.wallet.ledger).toHaveLength(1)
  })

  it('does not credit income when inventory is insufficient', () => {
    const original = fundedSnapshot()
    expect(() => applyInventorySettlement(original, purchase({ direction: 'sale' }))).toThrow(
      InsufficientInventoryError,
    )
    expect(original.wallet.balance).toBe(100)
    expect(original.wallet.ledger).toHaveLength(1)
  })

  it('rejects reused IDs for a different operation without duplicate delivery', () => {
    const original = applyInventorySettlement(fundedSnapshot(), purchase())
    expect(() => applyInventorySettlement(original, purchase({ itemId: 'wheat-seed' }))).toThrow(
      '结算 ID 已用于另一项操作',
    )
    expect(original.farm.inventory['wheat-seed']).toBeUndefined()
  })

  it('keeps the last saved snapshot when the atomic write fails', () => {
    const storage = new MemoryStorage()
    const repository = new LearningRepository(storage)
    const funded = repository.save(fundedSnapshot(), 0)
    const before = storage.getItem(LEARNING_STORAGE_KEY)
    storage.failNext('setItem')

    expect(() => transactInventorySettlement(repository, funded.revision, purchase())).toThrow(
      '暂未保存',
    )
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(before)
    expect(repository.load().farm.inventory['radish-seed']).toBeUndefined()
  })

  it('validates quantities, prices, identifiers and safe totals', () => {
    const snapshot = fundedSnapshot()
    expect(() => applyInventorySettlement(snapshot, purchase({ itemId: '' }))).toThrow('物品 ID')
    expect(() => applyInventorySettlement(snapshot, purchase({ quantity: 0 }))).toThrow('物品数量')
    expect(() => applyInventorySettlement(snapshot, purchase({ unitPrice: 0 }))).toThrow('物品单价')
    expect(() =>
      applyInventorySettlement(
        snapshot,
        purchase({ quantity: 2, unitPrice: Number.MAX_SAFE_INTEGER }),
      ),
    ).toThrow('结算金额')
    snapshot.farm.inventory = { 'radish-seed': Number.MAX_SAFE_INTEGER }
    expect(() => applyInventorySettlement(snapshot, purchase({ quantity: 1 }))).toThrow(
      '物品数量超出',
    )
  })
})
