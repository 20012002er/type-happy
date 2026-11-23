import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
} from '../../src/learning/persistence/snapshot'
import { useLearningStore } from '../../src/stores/learning'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'
import { createSeededRandom } from '../helpers/seeded-random'

const NOW = new Date(2026, 10, 20, 12).getTime()

function setup(initialStorage?: MemoryStorage) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const storage = initialStorage ?? new MemoryStorage()
  const clock = createManualClock(NOW)
  let id = 0
  const learning = useLearningStore()
  expect(
    learning.initialize({
      storage,
      clock,
      random: createSeededRandom(42),
      ids: { next: () => `test-${++id}` },
    }),
  ).toBe(true)
  return { learning, storage, clock }
}

function startSpecial(learning: ReturnType<typeof useLearningStore>): string {
  const id = learning.startPractice({
    mode: 'special',
    unitId: 'written-multiplication',
    difficulty: 'L1',
  })
  if (!id) throw new Error('练习组创建失败')
  return id
}

function current(learning: ReturnType<typeof useLearningStore>, sessionId: string) {
  const session = learning.getSession(sessionId)
  if (!session) throw new Error('练习组不存在')
  return session.questions[session.currentIndex]
}

function wrongNumber(value: number) {
  return { kind: 'number' as const, value: value + 1 }
}

describe('learning store UI orchestration', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('settles a first-correct answer before advancing and restores the group after refresh', () => {
    const { learning, storage } = setup()
    const sessionId = startSpecial(learning)
    const first = current(learning, sessionId)
    if (first.question.standardAnswer.kind !== 'number') throw new Error('预期数字题')

    expect(learning.submitAnswer(sessionId, first.question.standardAnswer)).toBe('submitted')
    expect(current(learning, sessionId).status).toBe('first-correct')
    expect(learning.today.walletBalance).toBe(3)
    expect(learning.today.taskCompleted).toBe(1)
    expect(learning.practiceRewardFor(first.question.instanceId)).toBe(3)

    expect(learning.advanceSession(sessionId)).toBe(true)
    expect(learning.getSession(sessionId)?.currentIndex).toBe(1)

    const restored = setup(storage).learning
    expect(restored.activeSession?.id).toBe(sessionId)
    expect(restored.getSession(sessionId)?.currentIndex).toBe(1)
    expect(restored.resumeSession(sessionId)).toBe(true)
    expect(restored.getSession(sessionId)?.currentIndex).toBe(1)
    expect(restored.today.walletBalance).toBe(3)
  })

  it('shows two correction stages and settles zero coins after an explanation', () => {
    const { learning } = setup()
    const sessionId = startSpecial(learning)
    const first = current(learning, sessionId)
    if (first.question.standardAnswer.kind !== 'number') throw new Error('预期数字题')
    const wrong = wrongNumber(first.question.standardAnswer.value)

    expect(learning.submitAnswer(sessionId, wrong)).toBe('submitted')
    expect(current(learning, sessionId)).toMatchObject({
      status: 'awaiting-correction',
      highestHintLevel: 1,
    })
    expect(learning.today.walletBalance).toBe(0)

    expect(learning.submitAnswer(sessionId, wrong)).toBe('submitted')
    expect(current(learning, sessionId)).toMatchObject({
      status: 'needs-explanation',
      highestHintLevel: 2,
      explanationViewed: true,
    })
    expect(current(learning, sessionId).feedback?.explanationSteps.length).toBeGreaterThan(0)

    expect(learning.submitAnswer(sessionId, first.question.standardAnswer)).toBe('submitted')
    expect(current(learning, sessionId).status).toBe('corrected-awaiting-retest')
    expect(learning.today.walletBalance).toBe(0)
    expect(learning.today.effectiveCompleted).toBe(1)
    expect(learning.today.correctedAfterExplanation).toBe(1)
    expect(learning.today.pendingRetest).toBe(1)
  })

  it('does not publish a reward when persistence fails and can retry exactly once', () => {
    const { learning, storage } = setup()
    const sessionId = startSpecial(learning)
    const first = current(learning, sessionId)
    storage.failNext('setItem')

    expect(learning.submitAnswer(sessionId, first.question.standardAnswer)).toBe('failed')
    expect(current(learning, sessionId).status).toBe('pending')
    expect(learning.today.walletBalance).toBe(0)
    expect(learning.practiceRewardFor(first.question.instanceId)).toBe(0)
    expect(learning.saveError).toContain('本次进度暂未保存')

    expect(learning.submitAnswer(sessionId, first.question.standardAnswer)).toBe('submitted')
    expect(current(learning, sessionId).status).toBe('first-correct')
    expect(learning.today.walletBalance).toBe(3)
    expect(
      learning.snapshot.wallet.ledger.filter(
        (entry) => entry.source === 'practice' && entry.referenceId === first.question.instanceId,
      ),
    ).toHaveLength(1)
  })

  it('switches from 3 to 2 coins at the daily goal without adding extra task progress', () => {
    const snapshot = createEmptyLearningSnapshot()
    snapshot.tasks.daily = {
      '2026-11-20': { goal: 30, completed: 29, rewarded: false },
    }
    const storage = new MemoryStorage({ [LEARNING_STORAGE_KEY]: JSON.stringify(snapshot) })
    const { learning } = setup(storage)
    const sessionId = startSpecial(learning)

    const first = current(learning, sessionId)
    expect(learning.submitAnswer(sessionId, first.question.standardAnswer)).toBe('submitted')
    expect(learning.practiceRewardFor(first.question.instanceId)).toBe(3)
    expect(learning.today).toMatchObject({
      taskCompleted: 30,
      taskRemaining: 0,
      dailyRewarded: true,
      dailyReward: 20,
      walletBalance: 23,
      currentStreak: 1,
    })

    expect(learning.advanceSession(sessionId)).toBe(true)
    const second = current(learning, sessionId)
    expect(learning.submitAnswer(sessionId, second.question.standardAnswer)).toBe('submitted')
    expect(learning.practiceRewardFor(second.question.instanceId)).toBe(2)
    expect(learning.today).toMatchObject({ taskCompleted: 30, dailyReward: 20, walletBalance: 25 })
    expect(
      learning.snapshot.wallet.ledger.filter((entry) => entry.source === 'daily-task'),
    ).toHaveLength(1)
  })

  it('keeps completed groups read-only on repeated entry', () => {
    const { learning, storage } = setup()
    const sessionId = startSpecial(learning)
    for (let index = 0; index < 10; index += 1) {
      const entry = current(learning, sessionId)
      expect(learning.submitAnswer(sessionId, entry.question.standardAnswer)).toBe('submitted')
      expect(learning.advanceSession(sessionId)).toBe(true)
    }
    expect(learning.getSession(sessionId)?.status).toBe('completed')
    expect(learning.today.walletBalance).toBe(30)

    const restored = setup(storage).learning
    expect(restored.resumeSession(sessionId)).toBe(true)
    expect(restored.resumeSession(sessionId)).toBe(true)
    expect(restored.today.walletBalance).toBe(30)
    expect(
      restored.snapshot.wallet.ledger.filter((entry) => entry.source === 'practice'),
    ).toHaveLength(10)
  })

  it('persists course, sound and animation preferences independently from learning rewards', () => {
    const { learning, storage } = setup()
    learning.updatePreferences({
      courseIntroSeen: true,
      soundEnabled: false,
      animationsEnabled: false,
    })
    const restored = setup(storage).learning
    expect(restored.preferences).toEqual({
      courseIntroSeen: true,
      soundEnabled: false,
      animationsEnabled: false,
      dailyGoal: 30,
    })
    expect(restored.today.walletBalance).toBe(0)
  })
})
