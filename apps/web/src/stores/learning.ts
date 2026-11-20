import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { LEARNING_RULES } from '../learning/config/rules'
import { GRADE4_AUTUMN_MATH_COURSE } from '../learning/content/grade4-math'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  UnsupportedSchemaVersionError,
  type LearningSnapshot,
} from '../learning/persistence/snapshot'
import {
  CorruptedSnapshotError,
  LearningRepository,
  RevisionConflictError,
} from '../learning/persistence/repository'
import type { Clock, IdGenerator, Random, StoragePort } from '../learning/ports'
import {
  createCryptoIdGenerator,
  getBrowserStorage,
  mathRandom,
  systemClock,
} from '../learning/system-adapters'
import { generateComprehensivePaper, generateSpecialPaper } from '../learning/practice/paper'
import { createRetestQuestion } from '../learning/practice/math-generator'
import { PracticeSessionRepository } from '../learning/practice/practice-repository'
import {
  abandonPracticeSession,
  advancePracticeSession,
  createPracticeSession,
  replacePracticeQuestion,
  submitPracticeAnswer,
  type PracticeSession,
} from '../learning/practice/practice-session'
import {
  getPracticeSessionSummary,
  getTodayLearningSummary,
} from '../learning/tasks/learning-summary'
import type { Answer, Difficulty } from '../learning/types'

const PREFERENCES_STORAGE_KEY = 'type-happy:learning:preferences:v1'

export interface LearningPreferences {
  courseIntroSeen: boolean
  soundEnabled: boolean
  animationsEnabled: boolean
}

export interface LearningStoreDependencies {
  storage?: StoragePort
  clock?: Clock
  ids?: IdGenerator
  random?: Random
}

export type StartPracticeOptions =
  | { mode: 'comprehensive' }
  | { mode: 'special'; unitId: string; difficulty: Difficulty }

export type SubmitPracticeResult = 'submitted' | 'replaced' | 'failed'

const DEFAULT_PREFERENCES: LearningPreferences = {
  courseIntroSeen: false,
  soundEnabled: true,
  animationsEnabled: true,
}

function readableLoadError(error: unknown): string {
  if (error instanceof CorruptedSnapshotError) return '学习存档已损坏，请恢复学习数据后再试'
  if (error instanceof UnsupportedSchemaVersionError) return '学习存档版本较新，请更新应用后再试'
  return error instanceof Error ? error.message : '学习数据暂时无法读取'
}

function readableSaveError(error: unknown): string {
  if (error instanceof RevisionConflictError) return '学习数据已在其他页面更新，请刷新后重试'
  return '本次进度暂未保存，请重试'
}

function parsePreferences(raw: string | null): LearningPreferences {
  if (raw === null) return { ...DEFAULT_PREFERENCES }
  try {
    const value = JSON.parse(raw) as Partial<LearningPreferences>
    return {
      courseIntroSeen: value.courseIntroSeen === true,
      soundEnabled: value.soundEnabled !== false,
      animationsEnabled: value.animationsEnabled !== false,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

function editableSession(session: PracticeSession): PracticeSession {
  return structuredClone(toRaw(session))
}

export const useLearningStore = defineStore('learning', () => {
  const snapshot = ref<LearningSnapshot>(createEmptyLearningSnapshot())
  const ready = ref(false)
  const loadError = ref('')
  const saveError = ref('')
  const notice = ref('')
  const saving = ref(false)
  const preferences = ref<LearningPreferences>({ ...DEFAULT_PREFERENCES })

  let storage: StoragePort | undefined
  let repository: LearningRepository | undefined
  let sessions: PracticeSessionRepository | undefined
  let clock: Clock = systemClock
  let ids: IdGenerator = createCryptoIdGenerator()
  let random: Random = mathRandom

  const today = computed(() =>
    getTodayLearningSummary(
      snapshot.value,
      clock.now(),
      LEARNING_RULES.dailyTask.defaultGoal,
    ),
  )
  const activeSession = computed(() =>
    Object.values(snapshot.value.practice.sessions)
      .filter((session) => session.status === 'active')
      .sort((left, right) => right.updatedAt - left.updatedAt)[0],
  )
  const practiceSessions = computed(() =>
    Object.values(snapshot.value.practice.sessions).sort(
      (left, right) => right.updatedAt - left.updatedAt,
    ),
  )

  function initialize(dependencies: LearningStoreDependencies = {}): boolean {
    if (dependencies.storage) storage = dependencies.storage
    if (dependencies.clock) clock = dependencies.clock
    if (dependencies.ids) ids = dependencies.ids
    if (dependencies.random) random = dependencies.random
    const selectedStorage = storage ?? getBrowserStorage()
    storage = selectedStorage
    repository = new LearningRepository(selectedStorage)
    sessions = new PracticeSessionRepository(repository)
    try {
      snapshot.value = repository.load()
      preferences.value = parsePreferences(selectedStorage.getItem(PREFERENCES_STORAGE_KEY))
      loadError.value = ''
      ready.value = true
      return true
    } catch (error) {
      loadError.value = readableLoadError(error)
      ready.value = true
      return false
    }
  }

  function refresh(): void {
    if (!repository) return
    try {
      snapshot.value = repository.load()
      loadError.value = ''
    } catch (error) {
      loadError.value = readableLoadError(error)
    }
  }

  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === LEARNING_STORAGE_KEY) refresh()
  }

  function persist(session: Parameters<PracticeSessionRepository['save']>[0]): boolean {
    if (!sessions) {
      saveError.value = '学习数据尚未准备好，请刷新后重试'
      return false
    }
    saving.value = true
    try {
      snapshot.value = sessions.save(
        session,
        snapshot.value.revision,
        LEARNING_RULES.dailyTask.defaultGoal,
      )
      saveError.value = ''
      return true
    } catch (error) {
      saveError.value = readableSaveError(error)
      return false
    } finally {
      saving.value = false
    }
  }

  function startPractice(options: StartPracticeOptions): string | null {
    if (activeSession.value) return activeSession.value.id
    const now = clock.now()
    const id = `practice-${ids.next()}`
    const paper =
      options.mode === 'comprehensive'
        ? generateComprehensivePaper({
            total: today.value.goal,
            seed: random.int(0, 0xffffffff),
            idPrefix: id,
            retestPool: snapshot.value.practice.retestPool,
          })
        : generateSpecialPaper({
            unitId: options.unitId,
            difficulty: options.difficulty,
            seed: random.int(0, 0xffffffff),
            idPrefix: id,
            retestPool: snapshot.value.practice.retestPool,
          })
    const session = createPracticeSession({
      id,
      mode: options.mode,
      questions: paper.questions,
      createdAt: now,
    })
    if (!persist(session)) return null
    notice.value = ''
    saveError.value = ''
    return id
  }

  function resumeSession(sessionId: string): boolean {
    if (!sessions) return false
    try {
      const session = sessions.resume(sessionId, clock.now())
      return session ? persist(session) : false
    } catch (error) {
      saveError.value = readableSaveError(error)
      return false
    }
  }

  function submitAnswer(sessionId: string, answer: Answer): SubmitPracticeResult {
    const session = snapshot.value.practice.sessions[sessionId]
    if (!session || session.status !== 'active') return 'failed'
    const current = session.questions[session.currentIndex]
    if (
      ['first-correct', 'mastered-after-hint', 'corrected-awaiting-retest'].includes(current.status)
    ) {
      return 'failed'
    }
    let submitted
    try {
      submitted = submitPracticeAnswer(editableSession(session), structuredClone(toRaw(answer)), clock.now(), {
        seed: random.int(0, 0xffffffff),
        idPrefix: sessionId,
      })
    } catch {
      return replaceContentError(sessionId)
    }
    return persist(submitted) ? 'submitted' : 'failed'
  }

  function replaceContentError(sessionId: string): SubmitPracticeResult {
    const session = snapshot.value.practice.sessions[sessionId]
    if (!session || session.status !== 'active') return 'failed'
    const current = session.questions[session.currentIndex]
    try {
      const replacement = createRetestQuestion(
        current.question,
        random.int(0, 0xffffffff),
        `${sessionId}-replacement-${ids.next()}`,
      )
      const replaced = replacePracticeQuestion(editableSession(session), replacement, clock.now())
      if (!persist(replaced)) return 'failed'
      notice.value = '这道题已为你更换，请继续作答'
      return 'replaced'
    } catch {
      saveError.value = '这道题暂时无法更换，请返回学习首页重试'
      return 'failed'
    }
  }

  function advanceSession(sessionId: string): boolean {
    const session = snapshot.value.practice.sessions[sessionId]
    if (!session || session.status !== 'active') return false
    try {
      return persist(advancePracticeSession(editableSession(session), clock.now()))
    } catch {
      saveError.value = '请先完成当前题目的订正'
      return false
    }
  }

  function abandonSession(sessionId: string): boolean {
    const session = snapshot.value.practice.sessions[sessionId]
    if (!session || session.status !== 'active') return false
    return persist(abandonPracticeSession(editableSession(session), clock.now()))
  }

  function getSession(sessionId: string) {
    return snapshot.value.practice.sessions[sessionId]
  }

  function getSessionSummary(sessionId: string) {
    return getPracticeSessionSummary(snapshot.value, sessionId)
  }

  function practiceRewardFor(questionInstanceId: string): number {
    return snapshot.value.wallet.ledger
      .filter(
        (entry) =>
          entry.source === 'practice' &&
          entry.direction === 'earn' &&
          entry.referenceId === questionInstanceId,
      )
      .reduce((total, entry) => total + entry.amount, 0)
  }

  function updatePreferences(patch: Partial<LearningPreferences>): void {
    const next = { ...preferences.value, ...patch }
    try {
      storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
      preferences.value = next
    } catch {
      saveError.value = '体验设置暂未保存，请重试'
    }
  }

  function clearMessages(): void {
    saveError.value = ''
    notice.value = ''
  }

  return {
    snapshot,
    ready,
    loadError,
    saveError,
    notice,
    saving,
    preferences,
    today,
    activeSession,
    practiceSessions,
    course: GRADE4_AUTUMN_MATH_COURSE,
    initialize,
    refresh,
    handleStorageEvent,
    startPractice,
    resumeSession,
    submitAnswer,
    advanceSession,
    abandonSession,
    getSession,
    getSessionSummary,
    practiceRewardFor,
    updatePreferences,
    clearMessages,
  }
})
