import { LEARNING_RULES } from '../config/rules'
import { shiftLocalDateKey, toLocalDateKey } from '../date-key'
import type { LearningSnapshot } from '../persistence/snapshot'
import type { LearningRecord, LearningResult } from '../types'
import { WALLET_SOURCES, type WalletLedgerEntry, type WalletSource } from '../wallet/wallet'
import { validateDailyGoal } from './daily-task'
import { getNextStreakMilestone, type StreakMilestone } from './streak'

export interface LearningCounts {
  effectiveCompleted: number
  firstCorrect: number
  correctedAfterHint: number
  correctedAfterExplanation: number
  corrected: number
  mastered: number
  abandoned: number
  contentError: number
}

export interface TodayLearningSummary extends LearningCounts {
  dateKey: string
  goal: number
  taskCompleted: number
  taskRemaining: number
  dailyRewarded: boolean
  currentStreak: number
  longestStreak: number
  nextMilestone: StreakMilestone
  pendingRetest: number
  walletBalance: number
  practiceReward: number
  dailyReward: number
  streakReward: number
}

export interface PracticeSessionSummary extends LearningCounts {
  sessionId: string
  status: 'active' | 'completed' | 'abandoned'
  totalQuestions: number
  currentIndex: number
  pendingRetest: number
  practiceReward: number
}

export interface ErrorCauseSummary {
  id: string
  label: string
  count: number
}

export interface KnowledgePointSummary extends LearningCounts {
  knowledgePointId: string
  errorCauses: ErrorCauseSummary[]
  unclassifiedErrorRecords: number
}

export interface DailyLearningSummary extends LearningCounts {
  dateKey: string
  goal: number
  completed: number
  rewarded: boolean
}

export interface WalletSourceSummary {
  source: WalletSource
  todayEarned: number
  todaySpent: number
  totalEarned: number
  totalSpent: number
}

export interface ParentLearningSummary {
  today: TodayLearningSummary
  recentDays: DailyLearningSummary[]
  currentStreak: number
  longestStreak: number
  knowledgePoints: KnowledgePointSummary[]
  wallet: WalletSourceSummary[]
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageCount: number
  pageSize: number
}

function countRecords(records: readonly LearningRecord[]): LearningCounts {
  const count = (result: LearningResult) =>
    records.filter((record) => record.result === result).length
  const firstCorrect = count('first-correct')
  const correctedAfterHint = count('mastered-after-hint')
  const correctedAfterExplanation = count('corrected-awaiting-retest')
  return {
    effectiveCompleted: firstCorrect + correctedAfterHint + correctedAfterExplanation,
    firstCorrect,
    correctedAfterHint,
    correctedAfterExplanation,
    corrected: correctedAfterHint + correctedAfterExplanation,
    mastered: firstCorrect + correctedAfterHint,
    abandoned: count('abandoned'),
    contentError: count('content-error'),
  }
}

function rewardFor(
  snapshot: LearningSnapshot,
  source: WalletSource,
  matches: (occurredAt: number, referenceId: string) => boolean,
): number {
  return snapshot.wallet.ledger
    .filter(
      (entry) =>
        entry.source === source &&
        entry.direction === 'earn' &&
        matches(entry.occurredAt, entry.referenceId),
    )
    .reduce((total, entry) => total + entry.amount, 0)
}

export function getTodayLearningSummary(
  snapshot: LearningSnapshot,
  at: Date | number,
  goal: number = LEARNING_RULES.dailyTask.defaultGoal,
): TodayLearningSummary {
  const dateKey = toLocalDateKey(at)
  const daily = snapshot.tasks.daily[dateKey] ?? {
    goal: validateDailyGoal(goal),
    completed: 0,
    rewarded: false,
  }
  const records = snapshot.learning.records.filter(
    (record) => record.settledAt !== undefined && toLocalDateKey(record.settledAt) === dateKey,
  )
  const onDate = (occurredAt: number) => toLocalDateKey(occurredAt) === dateKey
  return {
    ...countRecords(records),
    dateKey,
    goal: daily.goal,
    taskCompleted: daily.completed,
    taskRemaining: Math.max(0, daily.goal - daily.completed),
    dailyRewarded: daily.rewarded,
    currentStreak: snapshot.tasks.streak.current,
    longestStreak: snapshot.tasks.streak.longest,
    nextMilestone: getNextStreakMilestone(snapshot.tasks.streak.current),
    pendingRetest: snapshot.practice.retestPool.filter((entry) => entry.status !== 'completed')
      .length,
    walletBalance: snapshot.wallet.balance,
    practiceReward: rewardFor(snapshot, 'practice', onDate),
    dailyReward: rewardFor(snapshot, 'daily-task', onDate),
    streakReward: rewardFor(snapshot, 'streak', onDate),
  }
}

export function getPracticeSessionSummary(
  snapshot: LearningSnapshot,
  sessionId: string,
): PracticeSessionSummary | null {
  const session = snapshot.practice.sessions[sessionId]
  if (!session) return null
  const instanceIds = new Set(session.questions.map((entry) => entry.question.instanceId))
  return {
    ...countRecords(session.records),
    sessionId,
    status: session.status,
    totalQuestions: session.questions.length,
    currentIndex: session.currentIndex,
    pendingRetest: snapshot.practice.retestPool.filter(
      (entry) => entry.originSessionId === sessionId && entry.status !== 'completed',
    ).length,
    practiceReward: rewardFor(snapshot, 'practice', (_occurredAt, referenceId) =>
      instanceIds.has(referenceId),
    ),
  }
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function summarizeKnowledgePoints(records: readonly LearningRecord[]): KnowledgePointSummary[] {
  const grouped = new Map<string, LearningRecord[]>()
  for (const record of records) {
    const group = grouped.get(record.knowledgePointId) ?? []
    group.push(record)
    grouped.set(record.knowledgePointId, group)
  }

  return Array.from(grouped, ([knowledgePointId, pointRecords]) => {
    const causes = new Map<string, ErrorCauseSummary>()
    for (const record of pointRecords) {
      for (const cause of record.errorCauses ?? []) {
        const existing = causes.get(cause.id)
        if (existing) {
          existing.count += 1
        } else {
          causes.set(cause.id, { id: cause.id, label: cause.label, count: 1 })
        }
      }
    }
    return {
      ...countRecords(pointRecords),
      knowledgePointId,
      errorCauses: Array.from(causes.values()).sort(
        (left, right) =>
          right.count - left.count ||
          compareText(left.label, right.label) ||
          compareText(left.id, right.id),
      ),
      unclassifiedErrorRecords: pointRecords.filter(
        (record) => record.attempts > 1 && record.errorCauses === undefined,
      ).length,
    }
  }).sort((left, right) => compareText(left.knowledgePointId, right.knowledgePointId))
}

function summarizeWallet(snapshot: LearningSnapshot, dateKey: string): WalletSourceSummary[] {
  const summaries = new Map<WalletSource, WalletSourceSummary>(
    WALLET_SOURCES.map((source) => [
      source,
      { source, todayEarned: 0, todaySpent: 0, totalEarned: 0, totalSpent: 0 },
    ]),
  )
  for (const entry of snapshot.wallet.ledger) {
    const summary = summaries.get(entry.source)
    if (!summary) continue
    if (entry.direction === 'earn') {
      summary.totalEarned += entry.amount
      if (toLocalDateKey(entry.occurredAt) === dateKey) summary.todayEarned += entry.amount
    } else {
      summary.totalSpent += entry.amount
      if (toLocalDateKey(entry.occurredAt) === dateKey) summary.todaySpent += entry.amount
    }
  }
  return WALLET_SOURCES.map((source) => summaries.get(source)!)
}

export function getParentLearningSummary(
  snapshot: LearningSnapshot,
  at: Date | number,
  goal: number = LEARNING_RULES.dailyTask.defaultGoal,
): ParentLearningSummary {
  const todayKey = toLocalDateKey(at)
  const fallbackGoal = validateDailyGoal(goal)
  const recentDays = Array.from({ length: 7 }, (_, index): DailyLearningSummary => {
    const dateKey = shiftLocalDateKey(todayKey, index - 6)
    const daily = snapshot.tasks.daily[dateKey]
    const records = snapshot.learning.records.filter(
      (record) => record.settledAt !== undefined && toLocalDateKey(record.settledAt) === dateKey,
    )
    return {
      ...countRecords(records),
      dateKey,
      goal: daily?.goal ?? fallbackGoal,
      completed: daily?.completed ?? 0,
      rewarded: daily?.rewarded ?? false,
    }
  })
  return {
    today: getTodayLearningSummary(snapshot, at, goal),
    recentDays,
    currentStreak: snapshot.tasks.streak.current,
    longestStreak: snapshot.tasks.streak.longest,
    knowledgePoints: summarizeKnowledgePoints(snapshot.learning.records),
    wallet: summarizeWallet(snapshot, todayKey),
  }
}

function normalizePositiveInteger(value: number, fallback: number, maximum: number): number {
  if (Number.isNaN(value)) return fallback
  if (value === Number.POSITIVE_INFINITY) return maximum
  if (!Number.isFinite(value)) return 1
  return Math.min(maximum, Math.max(1, Math.floor(value)))
}

function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const normalizedPageSize = normalizePositiveInteger(pageSize, 20, 100)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / normalizedPageSize))
  const requestedPage = normalizePositiveInteger(page, 1, Number.MAX_SAFE_INTEGER)
  const normalizedPage = Math.min(requestedPage, pageCount)
  const start = (normalizedPage - 1) * normalizedPageSize
  return {
    items: items.slice(start, start + normalizedPageSize),
    total,
    page: normalizedPage,
    pageCount,
    pageSize: normalizedPageSize,
  }
}

export function getLearningRecordsPage(
  snapshot: LearningSnapshot,
  page = 1,
  pageSize = 20,
): Page<LearningRecord> {
  const sorted = [...snapshot.learning.records].sort((left, right) => {
    const leftTime = left.settledAt ?? -1
    const rightTime = right.settledAt ?? -1
    if (leftTime !== rightTime) return leftTime > rightTime ? -1 : 1
    return compareText(left.id, right.id)
  })
  return paginate(sorted, page, pageSize)
}

export function getWalletLedgerPage(
  snapshot: LearningSnapshot,
  page = 1,
  pageSize = 20,
): Page<WalletLedgerEntry> {
  const sorted = snapshot.wallet.ledger
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.occurredAt !== right.entry.occurredAt) {
        return left.entry.occurredAt > right.entry.occurredAt ? -1 : 1
      }
      return right.index - left.index
    })
    .map(({ entry }) => entry)
  return paginate(sorted, page, pageSize)
}
