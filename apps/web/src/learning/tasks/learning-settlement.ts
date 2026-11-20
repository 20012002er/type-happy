import { LEARNING_RULES } from '../config/rules'
import { toLocalDateKey } from '../date-key'
import type { LearningSnapshot } from '../persistence/snapshot'
import { getPracticeOutcome, type PracticeSession } from '../practice/practice-session'
import type { LearningRecord } from '../types'
import { settleWallet } from '../wallet/wallet'
import { ensureDailyTask, incrementDailyTask } from './daily-task'
import { completeStreak } from './streak'

export type PracticeRewardPhase = 'within-goal' | 'extra-practice' | 'not-applicable'

export interface LearningSettlementSummary {
  recordId: string
  dateKey: string
  phase: PracticeRewardPhase
  practiceReward: number
  dailyReward: number
  streakReward: number
  totalReward: number
  dailyCompleted: number
  dailyGoal: number
  streakCurrent: number
  alreadySettled: boolean
}

const rewardKeys = {
  'first-correct': 'firstCorrect',
  'mastered-after-hint': 'correctedAfterHint',
  'corrected-awaiting-retest': 'correctedAfterExplanation',
} as const

function sameRecord(left: LearningRecord, right: LearningRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function settleLearningRecord(
  snapshot: LearningSnapshot,
  session: PracticeSession,
  record: LearningRecord,
  dailyGoal: number = LEARNING_RULES.dailyTask.defaultGoal,
): LearningSettlementSummary {
  if (record.settledAt === undefined) throw new Error('学习记录缺少结算时间')
  const dateKey = toLocalDateKey(record.settledAt)
  const existing = snapshot.learning.records.find(
    (item) => item.id === record.id || item.questionInstanceId === record.questionInstanceId,
  )
  if (existing) {
    if (!sameRecord(existing, record)) throw new Error('题目实例的学习记录发生冲突')
    const daily = snapshot.tasks.daily[dateKey]
    return {
      recordId: record.id,
      dateKey,
      phase: 'not-applicable',
      practiceReward: 0,
      dailyReward: 0,
      streakReward: 0,
      totalReward: 0,
      dailyCompleted: daily?.completed ?? 0,
      dailyGoal: daily?.goal ?? dailyGoal,
      streakCurrent: snapshot.tasks.streak.current,
      alreadySettled: true,
    }
  }

  const entry = session.questions.find(
    (item) => item.question.instanceId === record.questionInstanceId,
  )
  const nonEffective = record.result === 'abandoned' || record.result === 'content-error'
  if (!entry && !nonEffective) throw new Error('学习记录没有对应的题目实例')
  const outcome = nonEffective ? null : getPracticeOutcome(entry!)
  let phase: PracticeRewardPhase = 'not-applicable'
  let practiceReward = 0
  let dailyReward = 0
  let streakReward = 0
  let daily = snapshot.tasks.daily[dateKey]

  if (outcome?.effectiveCompletion) {
    daily = ensureDailyTask(snapshot, dateKey, dailyGoal)
    phase = daily.completed >= daily.goal ? 'extra-practice' : 'within-goal'
    if (outcome.rewardEligible && outcome.rewardResult) {
      const rules =
        phase === 'within-goal'
          ? LEARNING_RULES.practiceRewards.withinGoal
          : LEARNING_RULES.practiceRewards.extraPractice
      practiceReward = rules[rewardKeys[outcome.rewardResult]]
      if (practiceReward > 0) {
        snapshot.wallet = settleWallet(snapshot.wallet, {
          settlementId: `practice:${record.questionInstanceId}`,
          occurredAt: record.settledAt,
          source: 'practice',
          referenceId: record.questionInstanceId,
          direction: 'earn',
          amount: practiceReward,
        })
      }
    }

    if (outcome.participatesInTask && incrementDailyTask(daily)) {
      dailyReward = LEARNING_RULES.dailyTask.completionReward
      snapshot.wallet = settleWallet(snapshot.wallet, {
        settlementId: `daily-task:${dateKey}`,
        occurredAt: record.settledAt,
        source: 'daily-task',
        referenceId: dateKey,
        direction: 'earn',
        amount: dailyReward,
      })
      daily.rewarded = true
      streakReward = completeStreak(snapshot, dateKey, record.settledAt).reward
    }
  }

  snapshot.learning.records = [...snapshot.learning.records, record]
  return {
    recordId: record.id,
    dateKey,
    phase,
    practiceReward,
    dailyReward,
    streakReward,
    totalReward: practiceReward + dailyReward + streakReward,
    dailyCompleted: daily?.completed ?? 0,
    dailyGoal: daily?.goal ?? dailyGoal,
    streakCurrent: snapshot.tasks.streak.current,
    alreadySettled: false,
  }
}
