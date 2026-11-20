import { LEARNING_RULES } from '../config/rules'
import { assertLocalDateKey, shiftLocalDateKey } from '../date-key'
import type { LearningSnapshot } from '../persistence/snapshot'
import { settleWallet } from '../wallet/wallet'

export interface StreakMilestone {
  days: number
  reward: number
}

export interface StreakCompletion {
  current: number
  longest: number
  milestone: StreakMilestone | null
  reward: number
}

export function getStreakMilestone(days: number): StreakMilestone | null {
  const rules = LEARNING_RULES.streak
  const fixed = rules.milestones.find((milestone) => milestone.days === days)
  if (fixed) return fixed
  if (
    days > rules.recurringAfterDays &&
    (days - rules.recurringAfterDays) % rules.recurringIntervalDays === 0
  ) {
    return { days, reward: rules.recurringReward }
  }
  return null
}

export function getNextStreakMilestone(current: number): StreakMilestone {
  const rules = LEARNING_RULES.streak
  const fixed = rules.milestones.find((milestone) => milestone.days > current)
  if (fixed) return fixed
  const intervals = Math.max(
    0,
    Math.floor((current - rules.recurringAfterDays) / rules.recurringIntervalDays),
  )
  return {
    days: rules.recurringAfterDays + (intervals + 1) * rules.recurringIntervalDays,
    reward: rules.recurringReward,
  }
}

export function completeStreak(
  snapshot: LearningSnapshot,
  dateKey: string,
  occurredAt: number,
): StreakCompletion {
  assertLocalDateKey(dateKey)
  const streak = snapshot.tasks.streak
  if (streak.lastCompletedDateKey === dateKey) {
    return { current: streak.current, longest: streak.longest, milestone: null, reward: 0 }
  }

  const current =
    streak.lastCompletedDateKey === shiftLocalDateKey(dateKey, -1) ? streak.current + 1 : 1
  const longest = Math.max(streak.longest, current)
  const milestone = getStreakMilestone(current)
  if (milestone) {
    const segmentId = shiftLocalDateKey(dateKey, -(current - 1))
    snapshot.wallet = settleWallet(snapshot.wallet, {
      settlementId: `streak:${segmentId}:${milestone.days}`,
      occurredAt,
      source: 'streak',
      referenceId: `${segmentId}:${milestone.days}`,
      direction: 'earn',
      amount: milestone.reward,
    })
  }
  snapshot.tasks.streak = { current, longest, lastCompletedDateKey: dateKey }
  return { current, longest, milestone, reward: milestone?.reward ?? 0 }
}
