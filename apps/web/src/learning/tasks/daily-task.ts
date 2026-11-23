import { LEARNING_RULES } from '../config/rules'
import { assertLocalDateKey, shiftLocalDateKey, toLocalDateKey } from '../date-key'
import type { DailyTaskState, LearningSnapshot } from '../persistence/snapshot'

export function validateDailyGoal(goal: number): number {
  const rules = LEARNING_RULES.dailyTask
  if (
    !Number.isSafeInteger(goal) ||
    goal < rules.minimumGoal ||
    goal > rules.maximumGoal ||
    (goal - rules.minimumGoal) % rules.goalStep !== 0
  ) {
    throw new Error('每日目标必须是 10–50 之间以 5 为步长的整数')
  }
  return goal
}

export interface DailyGoalSettings {
  dailyGoal: number
  pendingDailyGoal?: number
  pendingDailyGoalEffectiveFrom?: string
}

export function getDailyGoalForDate(settings: DailyGoalSettings, at: Date | number): number {
  const current = validateDailyGoal(settings.dailyGoal)
  if (
    settings.pendingDailyGoal === undefined ||
    settings.pendingDailyGoalEffectiveFrom === undefined
  ) {
    return current
  }
  const effectiveFrom = assertLocalDateKey(settings.pendingDailyGoalEffectiveFrom)
  return toLocalDateKey(at) >= effectiveFrom
    ? validateDailyGoal(settings.pendingDailyGoal)
    : current
}

export function scheduleDailyGoalChange(
  settings: DailyGoalSettings,
  goal: number,
  at: Date | number,
): DailyGoalSettings {
  return {
    dailyGoal: getDailyGoalForDate(settings, at),
    pendingDailyGoal: validateDailyGoal(goal),
    pendingDailyGoalEffectiveFrom: shiftLocalDateKey(toLocalDateKey(at), 1),
  }
}

export function ensureDailyTask(
  snapshot: LearningSnapshot,
  dateKey: string,
  goal: number = LEARNING_RULES.dailyTask.defaultGoal,
): DailyTaskState {
  assertLocalDateKey(dateKey)
  const existing = snapshot.tasks.daily[dateKey]
  if (existing) return existing
  const task: DailyTaskState = { goal: validateDailyGoal(goal), completed: 0, rewarded: false }
  snapshot.tasks.daily = { ...snapshot.tasks.daily, [dateKey]: task }
  return task
}

export function incrementDailyTask(task: DailyTaskState): boolean {
  if (task.completed >= task.goal) return false
  task.completed += 1
  return task.completed === task.goal
}
