import { describe, expect, it } from 'vitest'
import { toLocalDateKey } from '../../../src/learning/date-key'
import {
  createEmptyLearningSnapshot,
  type LearningSnapshot,
} from '../../../src/learning/persistence/snapshot'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import {
  createPracticeSession,
  submitPracticeAnswer,
} from '../../../src/learning/practice/practice-session'
import {
  getLearningRecordsPage,
  getParentLearningSummary,
  getWalletLedgerPage,
} from '../../../src/learning/tasks/learning-summary'
import type { LearningRecord } from '../../../src/learning/types'
import {
  settleWallet,
  WALLET_SOURCES,
  type SettlementDirection,
  type WalletSource,
} from '../../../src/learning/wallet/wallet'

const TODAY = new Date(2026, 10, 23, 12).getTime()

function at(dayOffset = 0, hour = 12): number {
  return new Date(2026, 10, 23 + dayOffset, hour).getTime()
}

function dateKey(dayOffset = 0): string {
  return toLocalDateKey(at(dayOffset))
}

function makeRecord(id: string, patch: Partial<LearningRecord> = {}): LearningRecord {
  return {
    id,
    questionInstanceId: `instance-${id}`,
    templateId: 'template-1',
    templateVersion: 1,
    courseId: 'course-1',
    knowledgePointId: 'kp-a',
    result: 'first-correct',
    attempts: 1,
    highestHintLevel: 0,
    explanationViewed: false,
    errorCauses: [],
    startedAt: TODAY - 1_000,
    settledAt: TODAY,
    ...patch,
  }
}

function addLedgerEntry(
  snapshot: LearningSnapshot,
  id: string,
  source: WalletSource,
  direction: SettlementDirection,
  amount: number,
  occurredAt: number,
): void {
  snapshot.wallet = settleWallet(snapshot.wallet, {
    settlementId: id,
    occurredAt,
    source,
    referenceId: id,
    direction,
    amount,
  })
}

describe('parent learning summary', () => {
  it('keeps first-correct, hint correction, explanation correction and retest counts distinct', () => {
    const snapshot = createEmptyLearningSnapshot()
    snapshot.learning.records = [
      makeRecord('first', { knowledgePointId: 'kp-b' }),
      makeRecord('hint', {
        result: 'mastered-after-hint',
        attempts: 2,
        highestHintLevel: 1,
        errorCauses: [
          { id: 'carry', label: '进位错误' },
          { id: 'cause-b', label: 'B 错因' },
        ],
      }),
      makeRecord('explanation', {
        result: 'corrected-awaiting-retest',
        attempts: 3,
        highestHintLevel: 2,
        explanationViewed: true,
        errorCauses: [
          { id: 'carry', label: '进位错误' },
          { id: 'cause-a', label: 'A 错因' },
        ],
      }),
    ]
    snapshot.practice.retestPool = [
      {
        id: 'pending-retest',
        originalQuestion: generateMathQuestion('oral-mul-one-v1', 1, 'retest-original'),
        originSessionId: 'session-1',
        seed: 2,
        createdAt: TODAY,
        status: 'pending',
      },
    ]

    const summary = getParentLearningSummary(snapshot, TODAY)
    expect(summary.today).toMatchObject({
      effectiveCompleted: 3,
      firstCorrect: 1,
      correctedAfterHint: 1,
      correctedAfterExplanation: 1,
      corrected: 2,
      mastered: 2,
      pendingRetest: 1,
    })
    expect(summary.knowledgePoints.map((point) => point.knowledgePointId)).toEqual(['kp-a', 'kp-b'])
    expect(summary.knowledgePoints[0]).toMatchObject({
      effectiveCompleted: 2,
      firstCorrect: 0,
      correctedAfterHint: 1,
      correctedAfterExplanation: 1,
      corrected: 2,
      mastered: 1,
      unclassifiedErrorRecords: 0,
    })
    expect(summary.knowledgePoints[0].errorCauses).toEqual([
      { id: 'carry', label: '进位错误', count: 2 },
      { id: 'cause-a', label: 'A 错因', count: 1 },
      { id: 'cause-b', label: 'B 错因', count: 1 },
    ])
    expect(summary.knowledgePoints[1]).toMatchObject({ effectiveCompleted: 1, firstCorrect: 1 })
  })

  it('projects seven natural days from oldest to today with persisted task values and fallbacks', () => {
    const snapshot = createEmptyLearningSnapshot()
    for (let offset = -6; offset <= 0; offset += 1) {
      snapshot.learning.records = [
        ...snapshot.learning.records,
        makeRecord(`day${offset}`, { settledAt: at(offset), startedAt: at(offset) - 1_000 }),
      ]
      if (offset !== -2) {
        snapshot.tasks.daily = {
          ...snapshot.tasks.daily,
          [dateKey(offset)]: { goal: 35, completed: offset + 6, rewarded: offset === 0 },
        }
      }
    }
    snapshot.tasks.streak = { current: 4, longest: 9, lastCompletedDateKey: dateKey() }

    const summary = getParentLearningSummary(snapshot, TODAY, 15)
    expect(summary.recentDays.map((day) => day.dateKey)).toEqual(
      Array.from({ length: 7 }, (_, index) => dateKey(index - 6)),
    )
    expect(summary.recentDays.every((day) => day.effectiveCompleted === 1)).toBe(true)
    expect(summary.recentDays[4]).toMatchObject({
      dateKey: dateKey(-2),
      goal: 15,
      completed: 0,
      rewarded: false,
    })
    expect(summary.recentDays[6]).toMatchObject({ goal: 35, completed: 6, rewarded: true })
    expect(summary).toMatchObject({ currentStreak: 4, longestStreak: 9 })
    expect(summary.today).toMatchObject({ currentStreak: 4, longestStreak: 9, goal: 35 })
  })

  it('counts only legacy multi-attempt records without errorCauses as unclassified', () => {
    const snapshot = createEmptyLearningSnapshot()
    const legacy = makeRecord('legacy', { result: 'mastered-after-hint', attempts: 2 })
    delete legacy.errorCauses
    const legacyFirstCorrect = makeRecord('legacy-first')
    delete legacyFirstCorrect.errorCauses
    snapshot.learning.records = [
      legacy,
      legacyFirstCorrect,
      makeRecord('new-unmatched', { result: 'mastered-after-hint', attempts: 2 }),
      makeRecord('classified', {
        result: 'corrected-awaiting-retest',
        attempts: 3,
        errorCauses: [{ id: 'carry', label: '进位错误' }],
      }),
    ]

    const point = getParentLearningSummary(snapshot, TODAY).knowledgePoints[0]
    expect(point.unclassifiedErrorRecords).toBe(1)
    expect(point.errorCauses).toEqual([{ id: 'carry', label: '进位错误', count: 1 }])
  })

  it('summarizes today and all-time wallet income and spending in fixed source order', () => {
    const snapshot = createEmptyLearningSnapshot()
    addLedgerEntry(snapshot, 'practice-old', 'practice', 'earn', 7, at(-1))
    addLedgerEntry(snapshot, 'practice-today', 'practice', 'earn', 3, TODAY)
    addLedgerEntry(snapshot, 'daily-today', 'daily-task', 'earn', 20, TODAY)
    addLedgerEntry(snapshot, 'sale-today', 'farm-sale', 'earn', 9, TODAY)
    addLedgerEntry(snapshot, 'purchase-today', 'farm-purchase', 'spend', 5, TODAY)
    addLedgerEntry(snapshot, 'building-today', 'farm-building', 'spend', 2, TODAY)
    snapshot.tasks.daily = {
      [dateKey()]: { goal: 30, completed: 2, rewarded: false },
    }

    const summary = getParentLearningSummary(snapshot, TODAY)
    expect(summary.wallet.map((entry) => entry.source)).toEqual([...WALLET_SOURCES])
    expect(summary.wallet.find((entry) => entry.source === 'practice')).toEqual({
      source: 'practice',
      todayEarned: 3,
      todaySpent: 0,
      totalEarned: 10,
      totalSpent: 0,
    })
    expect(summary.wallet.find((entry) => entry.source === 'farm-sale')).toMatchObject({
      todayEarned: 9,
      totalEarned: 9,
    })
    expect(summary.wallet.find((entry) => entry.source === 'farm-purchase')).toMatchObject({
      todaySpent: 5,
      totalSpent: 5,
    })
    expect(summary.wallet.find((entry) => entry.source === 'farm-building')).toMatchObject({
      todaySpent: 2,
      totalSpent: 2,
    })
    expect(summary.wallet.find((entry) => entry.source === 'recovery')).toEqual({
      source: 'recovery',
      todayEarned: 0,
      todaySpent: 0,
      totalEarned: 0,
      totalSpent: 0,
    })
    expect(summary.recentDays[6].completed).toBe(2)
  })

  it('returns zeroed projections for empty data', () => {
    const summary = getParentLearningSummary(createEmptyLearningSnapshot(), TODAY, 20)
    expect(summary.today).toMatchObject({ goal: 20, effectiveCompleted: 0, walletBalance: 0 })
    expect(summary.recentDays).toHaveLength(7)
    expect(
      summary.recentDays.every(
        (day) =>
          day.effectiveCompleted === 0 && day.goal === 20 && day.completed === 0 && !day.rewarded,
      ),
    ).toBe(true)
    expect(summary.knowledgePoints).toEqual([])
    expect(summary.wallet).toHaveLength(WALLET_SOURCES.length)
    expect(
      summary.wallet.every(
        (entry) =>
          entry.todayEarned === 0 &&
          entry.todaySpent === 0 &&
          entry.totalEarned === 0 &&
          entry.totalSpent === 0,
      ),
    ).toBe(true)
  })

  it('uses only learning.records and never double-counts practice session records', () => {
    const snapshot = createEmptyLearningSnapshot()
    const question = generateMathQuestion('oral-mul-one-v1', 9, 'session-only')
    const initial = createPracticeSession({
      id: 'session-only',
      mode: 'special',
      questions: [{ question }],
      createdAt: TODAY - 1_000,
    })
    const session = submitPracticeAnswer(initial, question.standardAnswer, TODAY)
    snapshot.practice.sessions = { [session.id]: session }
    snapshot.learning.records = [makeRecord('global-only')]

    const summary = getParentLearningSummary(snapshot, TODAY)
    expect(summary.today.firstCorrect).toBe(1)
    expect(summary.today.effectiveCompleted).toBe(1)
    expect(session.records).toHaveLength(1)
  })
})

describe('stable learning pagination', () => {
  it('sorts records by settlement descending and id, clamps pages and preserves the snapshot', () => {
    const snapshot = createEmptyLearningSnapshot()
    snapshot.learning.records = [
      makeRecord('b'),
      makeRecord('pending', { settledAt: undefined }),
      makeRecord('old', { settledAt: at(-1) }),
      makeRecord('a'),
      makeRecord('new', { settledAt: TODAY + 1_000 }),
    ]
    const originalOrder = snapshot.learning.records.map((record) => record.id)

    const first = getLearningRecordsPage(snapshot, 1, 2)
    expect(first).toMatchObject({ total: 5, page: 1, pageCount: 3, pageSize: 2 })
    expect(first.items.map((record) => record.id)).toEqual(['new', 'a'])
    expect(getLearningRecordsPage(snapshot, 2, 2).items.map((record) => record.id)).toEqual([
      'b',
      'old',
    ])
    expect(getLearningRecordsPage(snapshot, 99, 2)).toMatchObject({ page: 3, pageCount: 3 })
    expect(getLearningRecordsPage(snapshot, 99, 2).items.map((record) => record.id)).toEqual([
      'pending',
    ])
    expect(getLearningRecordsPage(snapshot, -4, 2.9)).toMatchObject({ page: 1, pageSize: 2 })
    expect(getLearningRecordsPage(snapshot, Number.NaN, Number.NaN)).toMatchObject({
      page: 1,
      pageSize: 20,
    })
    expect(getLearningRecordsPage(snapshot, 1, 1_000).pageSize).toBe(100)
    expect(snapshot.learning.records.map((record) => record.id)).toEqual(originalOrder)
    expect(getLearningRecordsPage(snapshot, 1, 2).items).not.toBe(first.items)
  })

  it('sorts wallet entries by time descending and later ledger position for ties', () => {
    const snapshot = createEmptyLearningSnapshot()
    addLedgerEntry(snapshot, 'a', 'practice', 'earn', 10, TODAY)
    addLedgerEntry(snapshot, 'b', 'practice', 'earn', 5, TODAY)
    addLedgerEntry(snapshot, 'c', 'practice', 'earn', 1, at(-1))
    addLedgerEntry(snapshot, 'd', 'practice', 'earn', 2, TODAY + 1_000)
    const originalOrder = snapshot.wallet.ledger.map((entry) => entry.settlementId)

    expect(getWalletLedgerPage(snapshot, 1, 2).items.map((entry) => entry.settlementId)).toEqual([
      'd',
      'b',
    ])
    expect(getWalletLedgerPage(snapshot, 2, 2).items.map((entry) => entry.settlementId)).toEqual([
      'a',
      'c',
    ])
    expect(snapshot.wallet.ledger.map((entry) => entry.settlementId)).toEqual(originalOrder)
  })

  it('returns at least one empty page for empty projections', () => {
    const snapshot = createEmptyLearningSnapshot()
    expect(getLearningRecordsPage(snapshot, 10, 20)).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: 20,
    })
    expect(getWalletLedgerPage(snapshot)).toMatchObject({ total: 0, page: 1, pageCount: 1 })
  })

  it('returns only one page for a year of daily records', () => {
    const snapshot = createEmptyLearningSnapshot()
    const records = Array.from({ length: 365 * 30 }, (_, index) =>
      makeRecord(`record-${String(index).padStart(5, '0')}`, {
        settledAt: at(-Math.floor(index / 30)),
        startedAt: at(-Math.floor(index / 30)) - 1_000,
      }),
    )
    snapshot.learning.records = records

    const page = getLearningRecordsPage(snapshot)
    expect(page).toMatchObject({ total: 10_950, page: 1, pageCount: 548, pageSize: 20 })
    expect(page.items).toHaveLength(20)
    expect(getLearningRecordsPage(snapshot, 3, 100).items).toHaveLength(100)
    expect(snapshot.learning.records).toBe(records)
    expect(snapshot.learning.records[0].id).toBe('record-00000')
  })
})
