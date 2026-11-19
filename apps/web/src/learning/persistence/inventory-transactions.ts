import { settleWallet } from '../wallet/wallet'
import type { LearningRepository } from './repository'
import type { LearningSnapshot } from './snapshot'

export interface InventorySettlementRequest {
  settlementId: string
  occurredAt: number
  itemId: string
  direction: 'purchase' | 'sale'
  quantity: number
  unitPrice: number
}

export class InsufficientInventoryError extends Error {
  readonly shortage: number

  constructor(shortage: number) {
    super(`库存不足，还差 ${shortage} 件`)
    this.name = 'InsufficientInventoryError'
    this.shortage = shortage
  }
}

export function applyInventorySettlement(
  snapshot: LearningSnapshot,
  request: InventorySettlementRequest,
): LearningSnapshot {
  if (request.itemId.trim().length === 0) throw new Error('物品 ID 不能为空')
  if (!Number.isSafeInteger(request.quantity) || request.quantity < 1) {
    throw new Error('物品数量必须是正整数')
  }
  if (!Number.isSafeInteger(request.unitPrice) || request.unitPrice < 1) {
    throw new Error('物品单价必须是正整数')
  }
  const amount = request.quantity * request.unitPrice
  if (!Number.isSafeInteger(amount)) throw new Error('结算金额超出安全整数')

  const wallet = settleWallet(snapshot.wallet, {
    settlementId: request.settlementId,
    occurredAt: request.occurredAt,
    source: request.direction === 'purchase' ? 'farm-purchase' : 'farm-sale',
    referenceId: request.itemId,
    direction: request.direction === 'purchase' ? 'spend' : 'earn',
    amount,
  })
  if (wallet === snapshot.wallet) return snapshot

  const currentQuantity = snapshot.farm.inventory[request.itemId] ?? 0
  const nextQuantity =
    request.direction === 'purchase'
      ? currentQuantity + request.quantity
      : currentQuantity - request.quantity
  if (nextQuantity < 0) throw new InsufficientInventoryError(-nextQuantity)
  if (!Number.isSafeInteger(nextQuantity)) throw new Error('物品数量超出安全整数')

  return {
    ...snapshot,
    wallet,
    farm: {
      ...snapshot.farm,
      inventory: { ...snapshot.farm.inventory, [request.itemId]: nextQuantity },
    },
  }
}

export function transactInventorySettlement(
  repository: LearningRepository,
  expectedRevision: number,
  request: InventorySettlementRequest,
): LearningSnapshot {
  return repository.transact(expectedRevision, (snapshot) =>
    applyInventorySettlement(snapshot, request),
  )
}
