import { createPinia, setActivePinia } from 'pinia'
import { toRaw } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { GRADE4_AUTUMN_MATH_COURSE } from '../../src/learning/content/grade4-math'
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
  learning.selectCourse({ grade: 4, semester: 'autumn' })
  const id = learning.startPractice({
    mode: 'special',
    subject: 'math',
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
      reduceFarmMotion: false,
      dailyGoal: 30,
    })
    expect(restored.today.walletBalance).toBe(0)
  })

  it('requires a new user to choose a course and restores the selection after refresh', () => {
    const { learning, storage } = setup()
    expect(learning.courseSelectionRequired).toBe(true)
    expect(learning.startPractice({ mode: 'comprehensive', subject: 'math' })).toBeNull()
    expect(learning.saveError).toContain('请先')
    expect(learning.practiceSessions).toHaveLength(0)

    expect(learning.selectCourse({ grade: 4, semester: 'spring' })).toBe(true)
    expect(learning.courseSelectionRequired).toBe(false)
    expect(learning.snapshot.course).toEqual({ grade: 4, semester: 'spring' })

    const restored = setup(storage).learning
    expect(restored.courseSelectionRequired).toBe(false)
    expect(restored.snapshot.course).toEqual({ grade: 4, semester: 'spring' })
    expect(restored.course.id).toBe('pep-grade4-spring-math')
  })

  it('keeps existing users on grade 4 autumn without forcing course onboarding', () => {
    const snapshot = createEmptyLearningSnapshot()
    const storage = new MemoryStorage({ [LEARNING_STORAGE_KEY]: JSON.stringify(snapshot) })
    const { learning } = setup(storage)

    expect(learning.courseSelectionRequired).toBe(false)
    expect(learning.snapshot.course).toEqual({ grade: 4, semester: 'autumn' })
    expect(learning.startPractice({ mode: 'comprehensive', subject: 'math' })).not.toBeNull()
  })

  it('blocks unavailable subjects and courses without creating empty groups', () => {
    const { learning } = setup()
    expect(learning.selectCourse({ grade: 4, semester: 'autumn' })).toBe(true)
    expect(learning.subjectStatuses.english.contentReady).toBe(false)
    expect(learning.startPractice({ mode: 'comprehensive', subject: 'english' })).toBeNull()
    expect(learning.saveError).toContain('暂未开放英语')

    expect(learning.selectCourse({ grade: 4, semester: 'spring' })).toBe(true)
    expect(learning.subjectStatuses.math.contentReady).toBe(true)
    expect(
      learning.startPractice({
        mode: 'special',
        subject: 'math',
        unitId: 'g4s-four-operations',
        difficulty: 'L2',
      }),
    ).toMatch(/^practice-/)
    expect(learning.practiceSessions).toHaveLength(1)
    expect(learning.abandonSession(learning.practiceSessions[0].id)).toBe(true)

    expect(learning.selectCourse({ grade: 4, semester: 'autumn' })).toBe(true)
    expect(learning.subjectStatuses.math.contentReady).toBe(true)
    expect(startSpecial(learning)).toMatch(/^practice-/)
  })

  it('starts special practice filtered by knowledge point and question type', () => {
    const { learning } = setup()
    expect(learning.selectCourse({ grade: 5, semester: 'spring' })).toBe(true)
    const id = learning.startPractice({
      mode: 'special',
      subject: 'math',
      knowledgePointId: 'g5s-defective-item-strategy',
      questionType: 'number',
      difficulty: 'L2',
    })
    expect(id).toMatch(/^practice-/)
    const session = learning.getSession(id!)
    expect(session?.questions).toHaveLength(10)
    expect(
      session?.questions.every(
        (entry) =>
          entry.question.classification.knowledgePointId === 'g5s-defective-item-strategy' &&
          entry.question.type === 'number',
      ),
    ).toBe(true)
    expect(learning.abandonSession(id!)).toBe(true)
    expect(() =>
      learning.startPractice({
        mode: 'special',
        subject: 'math',
        knowledgePointId: 'g5s-factors-and-multiples',
        questionType: 'fraction',
        difficulty: 'L1',
      }),
    ).toThrow('没有该题型')
  })

  it('starts english comprehensive and ability-filtered special practice', () => {
    const { learning } = setup()
    expect(learning.selectCourse({ grade: 4, semester: 'spring' })).toBe(true)
    expect(learning.subjectStatuses.english.contentReady).toBe(true)

    const comprehensive = learning.startPractice({ mode: 'comprehensive', subject: 'english' })
    expect(comprehensive).toMatch(/^practice-/)
    const session = learning.getSession(comprehensive!)
    expect(session?.questions).toHaveLength(30)
    expect(
      session?.questions.every((entry) => entry.question.classification.subject === 'english'),
    ).toBe(true)
    const first = session!.questions[0]
    expect(learning.submitAnswer(comprehensive!, first.question.standardAnswer)).toBe('submitted')
    expect(learning.abandonSession(comprehensive!)).toBe(true)

    const special = learning.startPractice({
      mode: 'special',
      subject: 'english',
      ability: 'english-vocabulary',
      difficulty: 'L1',
    })
    expect(special).toMatch(/^practice-/)
    const specialSession = learning.getSession(special!)
    expect(specialSession?.questions).toHaveLength(10)
    expect(
      specialSession?.questions.every(
        (entry) => entry.question.classification.ability === 'english-vocabulary',
      ),
    ).toBe(true)
    expect(learning.abandonSession(special!)).toBe(true)

    expect(() =>
      learning.startPractice({
        mode: 'special',
        subject: 'english',
        ability: 'english-situational',
        questionType: 'english-spelling',
        difficulty: 'L2',
      }),
    ).toThrow('没有该题型')
  })

  it('changes only the course when switching during practice and preserves the original group', () => {
    const { learning } = setup()
    const sessionId = startSpecial(learning)
    const first = current(learning, sessionId)
    expect(learning.submitAnswer(sessionId, first.question.standardAnswer)).toBe('submitted')
    expect(learning.performFarmOperation({ type: 'claim-gift' })).toBe(true)
    const originalQuestions = structuredClone(toRaw(learning.getSession(sessionId)!.questions))
    const originalSnapshot = structuredClone(toRaw(learning.snapshot))
    const before = {
      learning: originalSnapshot.learning,
      practice: originalSnapshot.practice,
      tasks: originalSnapshot.tasks,
      wallet: originalSnapshot.wallet,
      farm: originalSnapshot.farm,
      processing: originalSnapshot.processing,
    }

    expect(learning.selectCourse({ grade: 5, semester: 'autumn' })).toBe(true)
    expect({
      learning: learning.snapshot.learning,
      practice: learning.snapshot.practice,
      tasks: learning.snapshot.tasks,
      wallet: learning.snapshot.wallet,
      farm: learning.snapshot.farm,
      processing: learning.snapshot.processing,
    }).toEqual(before)
    expect(learning.activeCourse?.id).toBe(GRADE4_AUTUMN_MATH_COURSE.id)
    expect(learning.getSession(sessionId)?.questions).toEqual(originalQuestions)
    expect(learning.startPractice({ mode: 'comprehensive', subject: 'math' })).toBe(sessionId)
  })

  it('does not publish a course selection when its snapshot write fails', () => {
    const { learning, storage } = setup()
    storage.failNext('setItem')

    expect(learning.selectCourse({ grade: 5, semester: 'spring' })).toBe(false)
    expect(learning.snapshot.course).toEqual({ grade: 4, semester: 'autumn' })
    expect(learning.preferences.courseIntroSeen).toBe(false)
    expect(learning.courseSelectionRequired).toBe(true)
    expect(learning.saveError).toContain('暂未保存')
  })
})
