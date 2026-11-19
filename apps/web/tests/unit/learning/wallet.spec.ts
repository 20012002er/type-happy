import { describe, expect, it } from 'vitest'
import {
  createEmptyWallet,
  InsufficientBalanceError,
  parseWalletState,
  SettlementConflictError,
  settleWallet,
  WalletValidationError,
  type SettlementRequest,
} from '../../../src/learning/wallet/wallet'

const earn = (overrides: Partial<SettlementRequest> = {}): SettlementRequest => ({
  settlementId: 'practice:question-1',
  occurredAt: 100,
  source: 'practice',
  referenceId: 'question-1',
  direction: 'earn',
  amount: 3,
  ...overrides,
})

describe('wallet settlement', () => {
  it('appends immutable auditable ledger entries for earnings and spending', () => {
    const initial = createEmptyWallet()
    const earned = settleWallet(initial, earn({ amount: 30 }))
    const spent = settleWallet(earned, {
      ...earn({
        settlementId: 'farm:radish',
        source: 'farm-purchase',
        referenceId: 'radish',
        direction: 'spend',
        amount: 12,
      }),
      occurredAt: 200,
    })

    expect(initial).toEqual({ balance: 0, ledger: [] })
    expect(earned.balance).toBe(30)
    expect(spent.balance).toBe(18)
    expect(spent.ledger.map((entry) => entry.balanceAfter)).toEqual([30, 18])
    expect(parseWalletState(spent)).toEqual(spent)
  })

  it('settles an identical ID exactly once without changing the wallet', () => {
    const original = settleWallet(createEmptyWallet(), earn())
    const repeated = settleWallet(original, earn())

    expect(repeated).toBe(original)
    expect(repeated.ledger).toHaveLength(1)
    expect(() => settleWallet(original, earn({ amount: 4 }))).toThrow(SettlementConflictError)
    expect(original.balance).toBe(3)
  })

  it('rejects insufficient funds before appending a ledger entry', () => {
    const original = settleWallet(createEmptyWallet(), earn({ amount: 5 }))
    expect(() =>
      settleWallet(original, earn({ settlementId: 'purchase', direction: 'spend', amount: 12 })),
    ).toThrow(InsufficientBalanceError)
    expect(original.balance).toBe(5)
    expect(original.ledger).toHaveLength(1)
  })

  it('rejects invalid requests and overflow', () => {
    const wallet = createEmptyWallet()
    expect(() => settleWallet(wallet, earn({ amount: 0 }))).toThrow(WalletValidationError)
    expect(() => settleWallet(wallet, earn({ source: 'unknown' as never }))).toThrow('来源未知')
    expect(() => settleWallet(wallet, earn({ direction: 'other' as never }))).toThrow('方向未知')
    expect(() => settleWallet(wallet, earn({ amount: Number.MAX_SAFE_INTEGER }))).not.toThrow()
    const full = settleWallet(wallet, earn({ amount: Number.MAX_SAFE_INTEGER }))
    expect(() => settleWallet(full, earn({ settlementId: 'overflow' }))).toThrow('安全整数')
  })
})

describe('wallet snapshot invariants', () => {
  it('rejects balances that cannot be reconciled with the ledger', () => {
    const wallet = settleWallet(createEmptyWallet(), earn())
    expect(() => parseWalletState({ ...wallet, balance: 4 })).toThrow('余额与流水不一致')
    expect(() =>
      parseWalletState({ ...wallet, ledger: [{ ...wallet.ledger[0], balanceAfter: 4 }] }),
    ).toThrow('balanceAfter 与流水不一致')
    expect(() =>
      parseWalletState({ ...wallet, ledger: [wallet.ledger[0], wallet.ledger[0]] }),
    ).toThrow('重复结算 ID')
  })

  it('rejects malformed states and negative ledger balances', () => {
    expect(() => parseWalletState(null)).toThrow('钱包数据必须是对象')
    expect(() => parseWalletState({ balance: 0, ledger: {} })).toThrow('必须是数组')
    expect(() =>
      parseWalletState({
        balance: 0,
        ledger: [{ ...earn(), balanceAfter: -3 }],
      }),
    ).toThrow('balanceAfter')
    const spending = {
      balance: 0,
      ledger: [{ ...earn({ direction: 'spend' }), balanceAfter: 0 }],
    }
    expect(() => parseWalletState(spending)).toThrow('余额为负数')
  })
})
