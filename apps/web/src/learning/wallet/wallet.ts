export const WALLET_SOURCES = [
  'practice',
  'daily-task',
  'streak',
  'farm-sale',
  'farm-purchase',
  'farm-building',
  'recovery',
  'activity',
] as const

export type WalletSource = (typeof WALLET_SOURCES)[number]
export type SettlementDirection = 'earn' | 'spend'

export interface SettlementRequest {
  settlementId: string
  occurredAt: number
  source: WalletSource
  referenceId: string
  direction: SettlementDirection
  amount: number
}

export interface WalletLedgerEntry extends SettlementRequest {
  balanceAfter: number
}

export interface WalletState {
  balance: number
  ledger: readonly WalletLedgerEntry[]
}

export class WalletValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WalletValidationError'
  }
}

export class InsufficientBalanceError extends Error {
  readonly shortage: number

  constructor(shortage: number) {
    super(`金币不足，还差 ${shortage} 金币`)
    this.name = 'InsufficientBalanceError'
    this.shortage = shortage
  }
}

export class SettlementConflictError extends Error {
  constructor(settlementId: string) {
    super(`结算 ID 已用于另一项操作：${settlementId}`)
    this.name = 'SettlementConflictError'
  }
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WalletValidationError('钱包数据必须是对象')
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new WalletValidationError(`${field} 必须是非空字符串`)
  }
}

function expectInteger(value: unknown, field: string, minimum = 0): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new WalletValidationError(`${field} 必须是大于等于 ${minimum} 的安全整数`)
  }
}

function expectSettlement(value: unknown, path = 'settlement'): SettlementRequest {
  const request = expectRecord(value)
  expectString(request.settlementId, `${path}.settlementId`)
  expectInteger(request.occurredAt, `${path}.occurredAt`)
  expectString(request.referenceId, `${path}.referenceId`)
  expectInteger(request.amount, `${path}.amount`, 1)
  if (!WALLET_SOURCES.includes(request.source as WalletSource)) {
    throw new WalletValidationError(`${path}.source 来源未知`)
  }
  if (request.direction !== 'earn' && request.direction !== 'spend') {
    throw new WalletValidationError(`${path}.direction 方向未知`)
  }
  return request as unknown as SettlementRequest
}

function sameSettlement(left: SettlementRequest, right: SettlementRequest): boolean {
  return (
    left.settlementId === right.settlementId &&
    left.occurredAt === right.occurredAt &&
    left.source === right.source &&
    left.referenceId === right.referenceId &&
    left.direction === right.direction &&
    left.amount === right.amount
  )
}

export function createEmptyWallet(): WalletState {
  return { balance: 0, ledger: [] }
}

export function parseWalletState(value: unknown): WalletState {
  const wallet = expectRecord(value)
  expectInteger(wallet.balance, 'wallet.balance')
  if (!Array.isArray(wallet.ledger)) throw new WalletValidationError('wallet.ledger 必须是数组')

  let balance = 0
  const settlementIds = new Set<string>()
  wallet.ledger.forEach((item, index) => {
    const entry = expectSettlement(item, `wallet.ledger[${index}]`)
    const rawEntry = item as Record<string, unknown>
    expectInteger(rawEntry.balanceAfter, `wallet.ledger[${index}].balanceAfter`)
    if (settlementIds.has(entry.settlementId)) {
      throw new WalletValidationError(`重复结算 ID：${entry.settlementId}`)
    }
    settlementIds.add(entry.settlementId)
    balance = entry.direction === 'earn' ? balance + entry.amount : balance - entry.amount
    if (balance < 0 || !Number.isSafeInteger(balance)) {
      throw new WalletValidationError('钱包流水导致余额为负数或超出安全整数')
    }
    if (rawEntry.balanceAfter !== balance) {
      throw new WalletValidationError(`wallet.ledger[${index}].balanceAfter 与流水不一致`)
    }
  })
  if (wallet.balance !== balance) throw new WalletValidationError('钱包余额与流水不一致')
  return wallet as unknown as WalletState
}

export function settleWallet(state: WalletState, request: SettlementRequest): WalletState {
  const wallet = parseWalletState(state)
  const settlement = expectSettlement(request)
  const existing = wallet.ledger.find((entry) => entry.settlementId === settlement.settlementId)
  if (existing) {
    if (!sameSettlement(existing, settlement))
      throw new SettlementConflictError(settlement.settlementId)
    return wallet
  }

  const balanceAfter =
    settlement.direction === 'earn'
      ? wallet.balance + settlement.amount
      : wallet.balance - settlement.amount
  if (balanceAfter < 0) throw new InsufficientBalanceError(-balanceAfter)
  if (!Number.isSafeInteger(balanceAfter)) throw new WalletValidationError('钱包余额超出安全整数')

  const entry: WalletLedgerEntry = { ...settlement, balanceAfter }
  return { balance: balanceAfter, ledger: [...wallet.ledger, entry] }
}
