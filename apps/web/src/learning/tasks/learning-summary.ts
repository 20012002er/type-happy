import { LEARNING_RULES } from '../config/rules'
import { toLocalDateKey } from '../date-key'
import type { LearningSnapshot } from '../persistence/snapshot'
import type { LearningRecord, LearningResult } from '../types'
import type { WalletSource } from '../wallet/wallet'
import { validateDailyGoal } from './daily-task'
import { getNextStreakMilestone, type StreakMilestone } from './streak'

interface LearningCounts {
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
