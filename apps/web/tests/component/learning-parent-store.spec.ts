import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../../src/learning/persistence/snapshot'
import { useLearningStore } from '../../src/stores/learning'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'
import { createSeededRandom } from '../helpers/seeded-random'

const NOW = new Date(2026, 10, 20, 12).getTime()
const DAY = 24 * 60 * 60 * 1000
const PREFERENCES_KEY = 'type-happy:learning:preferences:v1'

function setup(initialStorage?: MemoryStorage, snapshot?: LearningSnapshot) {
  setActivePinia(createPinia())
  const storage = initialStorage ?? new MemoryStorage()
  if (snapshot) storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(snapshot))
  const clock = createManualClock(NOW)
  let id = 0
  const learning = useLearningStore()
  expect(
    learning.initialize({
      storage,
      clock,
      random: createSeededRandom(42),
      ids: { next: () => `parent-test-${++id}` },
    }),
  ).toBe(true)
  return { learning, storage, clock }
}

describe('parent daily goal settings', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('accepts only 10–50 in steps of five without publishing invalid values', () => {
    const { learning, storage } = setup()
    for (const goal of [0, 9, 11, 51, 10.5, Number.NaN]) {
      expect(learning.updateDailyGoal(goal)).toBe(false)
      expect(learning.saveError).toContain('10–50')
    }
    expect(learning.preferences.dailyGoal).toBe(30)
    expect(learning.preferences.pendingDailyGoal).toBeUndefined()
    expect(storage.getItem(PREFERENCES_KEY)).toBeNull()

    expect(learning.updateDailyGoal(10)).toBe(true)
    expect(learning.updateDailyGoal(50)).toBe(true)
    expect(learning.today.goal).toBe(30)
    expect(learning.upcomingDailyGoal).toBe(50)
  })

  it('keeps today and its existing task snapshot unchanged, then applies the goal next day', () => {
    const snapshot = createEmptyLearningSnapshot()
    snapshot.tasks.daily = {
      ...snapshot.tasks.daily,
      '2026-11-20': { goal: 30, completed: 7, rewarded: false },
    }
    const { learning, clock } = setup(undefined, snapshot)

    expect(learning.updateDailyGoal(35)).toBe(true)
    expect(learning.today.goal).toBe(30)
    expect(learning.today.taskCompleted).toBe(7)
    expect(learning.snapshot.tasks.daily['2026-11-20']).toEqual({
      goal: 30,
      completed: 7,
      rewarded: false,
    })
    expect(learning.preferences).toMatchObject({
      dailyGoal: 30,
      pendingDailyGoal: 35,
      pendingDailyGoalEffectiveFrom: '2026-11-21',
    })

    clock.advance(DAY)
    learning.getNow()
    expect(learning.today.goal).toBe(35)
    expect(learning.upcomingDailyGoal).toBe(35)
    const sessionId = learning.startPractice({ mode: 'comprehensive', subject: 'math' })
    expect(sessionId).not.toBeNull()
    expect(learning.getSession(sessionId!)?.questions).toHaveLength(35)
    expect(learning.snapshot.tasks.daily['2026-11-20'].goal).toBe(30)
  })

  it('restores pending settings and reports preference write failures', () => {
    const { learning, storage } = setup()
    expect(learning.updateDailyGoal(40)).toBe(true)
    const restored = setup(storage).learning
    expect(restored.today.goal).toBe(30)
    expect(restored.upcomingDailyGoal).toBe(40)

    restored.saveError = ''
    storage.failNext('setItem')
    expect(restored.updateDailyGoal(45)).toBe(false)
    expect(restored.saveError).toBe('每日目标暂未保存，请重试')
    expect(restored.upcomingDailyGoal).toBe(40)
    expect(restored.notice).toBe('')
  })
})

describe('learning data clearing', () => {
  it('clears only learning records and resets reactive state while preserving other modules', () => {
    const { learning, storage } = setup()
    storage.setItem('typing-progress', 'keep-typing')
    storage.setItem('taoyuan-save', 'keep-taoyuan')
    learning.updatePreferences({ soundEnabled: false })
    expect(learning.updateDailyGoal(35)).toBe(true)

    expect(learning.clearLearningData()).toBe(true)
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
    expect(storage.getItem('typing-progress')).toBe('keep-typing')
    expect(storage.getItem('taoyuan-save')).toBe('keep-taoyuan')
    expect(learning.snapshot.revision).toBe(0)
    expect(learning.snapshot.wallet.balance).toBe(0)
    expect(learning.activeSession).toBeUndefined()
    expect(learning.today.goal).toBe(30)
    expect(learning.upcomingDailyGoal).toBe(35)
    expect(learning.preferences.soundEnabled).toBe(false)
    expect(learning.notice).toContain('已清除')
  })

  it('keeps the existing snapshot and allows retry after a clear failure', () => {
    const { learning, storage } = setup(undefined, createEmptyLearningSnapshot())
    const before = learning.snapshot
    storage.failNext('removeItem')
    expect(learning.clearLearningData()).toBe(false)
    expect(learning.snapshot).toEqual(before)
    expect(storage.getItem(LEARNING_STORAGE_KEY)).not.toBeNull()
    expect(learning.saveError).toBe('学习数据暂未清除，请重试')

    expect(learning.clearLearningData()).toBe(true)
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
  })
})
