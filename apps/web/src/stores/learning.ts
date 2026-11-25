import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { LEARNING_RULES } from '../learning/config/rules'
import { GRADE4_AUTUMN_MATH_COURSE } from '../learning/content/grade4-math'
import { getCourseAvailability, getCourseById } from '../learning/content/course-registry'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  UnsupportedSchemaVersionError,
  type CourseSelection,
  type LearningSnapshot,
} from '../learning/persistence/snapshot'
import {
  CorruptedSnapshotError,
  LearningRepository,
  PersistenceWriteError,
  RevisionConflictError,
} from '../learning/persistence/repository'
import {
  claimStarterGift,
  collectAnimalProduct,
  feedAnimal,
  fertilizeCrop,
  harvestCrop,
  plantCrop,
} from '../learning/farm/farm'
import {
  claimRecoverySupply,
  purchaseFarmAnimal,
  purchaseFarmSupplies,
  purchaseNextPlot,
  purchaseOrUpgradeBuilding,
  sellFarmProducts,
  transactFarmOperation,
  type FarmSaleSelection,
  type FarmSupplyItemId,
} from '../learning/farm/farm-transactions'
import {
  collectProcessingOutput,
  purchaseProcessingWorkshop,
  sellProcessingProducts,
  settleProcessingWorkshop,
  startProcessingTask,
  type ProcessingSaleSelection,
} from '../learning/processing/operations'
import { transactProcessingOperation } from '../learning/persistence/processing-transactions'
import {
  advanceFarmTime,
  getPendingHarvestCount,
  type AnimalKind,
  type CropId,
} from '../learning/farm/farm-state'
import type { Clock, IdGenerator, Random, StoragePort } from '../learning/ports'
import {
  createCryptoIdGenerator,
  getBrowserStorage,
  mathRandom,
  systemClock,
} from '../learning/system-adapters'
import {
  generateComprehensivePaper,
  generateSpecialPaper,
  hasPracticeContent,
} from '../learning/practice/paper'
import { createQuestionVariant } from '../learning/practice/question-variants'
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
  getParentLearningSummary,
  getPracticeSessionSummary,
  getTodayLearningSummary,
} from '../learning/tasks/learning-summary'
import {
  getDailyGoalForDate,
  scheduleDailyGoalChange,
  validateDailyGoal,
} from '../learning/tasks/daily-task'
import { assertLocalDateKey } from '../learning/date-key'
import type { Answer, Difficulty, LearningAbility, QuestionType, Subject } from '../learning/types'

const PREFERENCES_STORAGE_KEY = 'type-happy:learning:preferences:v1'

export interface LearningPreferences {
  courseIntroSeen: boolean
  soundEnabled: boolean
  animationsEnabled: boolean
  reduceFarmMotion: boolean
  processingUnlockSeen: boolean
  processingGuideSeen: boolean
  dailyGoal: number
  pendingDailyGoal?: number
  pendingDailyGoalEffectiveFrom?: string
}

export interface LearningStoreDependencies {
  storage?: StoragePort
  clock?: Clock
  ids?: IdGenerator
  random?: Random
}

export type StartPracticeOptions =
  | { mode: 'comprehensive'; subject: Subject }
  | {
      mode: 'special'
      subject: Subject
      unitId?: string
      knowledgePointId?: string
      ability?: LearningAbility
      questionType?: QuestionType
      difficulty: Difficulty
    }

export type SubmitPracticeResult = 'submitted' | 'replaced' | 'failed'

export type FarmOperation =
  | { type: 'advance' }
  | { type: 'claim-gift' }
  | { type: 'plant'; plotId: string; cropId: CropId }
  | { type: 'fertilize'; plotId: string }
  | { type: 'harvest'; plotId: string }
  | { type: 'feed'; animalId: string }
  | { type: 'collect'; animalId: string }
  | { type: 'buy-supplies'; itemId: FarmSupplyItemId; quantity: number }
  | { type: 'buy-plot' }
  | { type: 'buy-building'; building: 'chickenCoop' | 'cowshed' }
  | { type: 'buy-animal'; kind: AnimalKind }
  | { type: 'sell'; selection: FarmSaleSelection }
  | { type: 'claim-recovery' }

export type ProcessingOperation =
  | { type: 'buy-workshop' }
  | { type: 'start-processing'; recipeId: string }
  | { type: 'collect-processing' }
  | { type: 'sell-processing'; selection: ProcessingSaleSelection }

const DEFAULT_PREFERENCES: LearningPreferences = {
  courseIntroSeen: false,
  soundEnabled: true,
  animationsEnabled: true,
  reduceFarmMotion: false,
  processingUnlockSeen: false,
  processingGuideSeen: false,
  dailyGoal: LEARNING_RULES.dailyTask.defaultGoal,
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
    const parsed: LearningPreferences = {
      courseIntroSeen: value.courseIntroSeen === true,
      soundEnabled: value.soundEnabled !== false,
      animationsEnabled: value.animationsEnabled !== false,
      reduceFarmMotion: value.reduceFarmMotion === true,
      processingUnlockSeen: value.processingUnlockSeen === true,
      processingGuideSeen: value.processingGuideSeen === true,
      dailyGoal: validateDailyGoal(value.dailyGoal ?? LEARNING_RULES.dailyTask.defaultGoal),
    }
    if (value.pendingDailyGoal !== undefined && value.pendingDailyGoalEffectiveFrom !== undefined) {
      parsed.pendingDailyGoal = validateDailyGoal(value.pendingDailyGoal)
      parsed.pendingDailyGoalEffectiveFrom = assertLocalDateKey(value.pendingDailyGoalEffectiveFrom)
    }
    return parsed
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

function editableSession(session: PracticeSession): PracticeSession {
  return structuredClone(toRaw(session))
}

const FARM_OPERATION_NOTICES: Partial<Record<FarmOperation['type'], string>> = {
  'claim-gift': '新手礼包已领取：4 块土地、4 粒萝卜种子、1 只鸡和 2 份鸡饲料',
  plant: '播种成功，作物会按真实时间生长',
  fertilize: '化肥已使用，本次剩余生长时间缩短一半',
  harvest: '作物已收获并放入仓库',
  feed: '喂食成功，动物开始生产',
  collect: '农产品已收入仓库',
  'buy-supplies': '物品已购买并放入仓库',
  'buy-plot': '新土地已解锁',
  'buy-building': '建筑已购买或升级，新容量已生效',
  'buy-animal': '动物已入住农场',
  sell: '农产品已出售，学习金币已到账',
  'claim-recovery': '恢复补给已放入仓库：萝卜种子 × 2',
}

const PROCESSING_OPERATION_NOTICES: Record<ProcessingOperation['type'], string> = {
  'buy-workshop': '加工坊已建成，可以开始加工农产品',
  'start-processing': '原料已投入，加工会按真实时间进行',
  'collect-processing': '加工品已收入仓库',
  'sell-processing': '加工品已出售，学习金币已到账',
}

function applyFarmOperation(
  snapshot: LearningSnapshot,
  operation: FarmOperation,
  id: string,
  now: number,
): LearningSnapshot {
  const action = { actionId: id, now }
  const settlement = { settlementId: id, now }
  switch (operation.type) {
    case 'advance':
      return settleProcessingWorkshop(
        { ...snapshot, farm: advanceFarmTime(snapshot.farm, now) },
        now,
      )
    case 'claim-gift':
      return { ...snapshot, farm: claimStarterGift(snapshot.farm, action) }
    case 'plant':
      return { ...snapshot, farm: plantCrop(snapshot.farm, { ...action, ...operation }) }
    case 'fertilize':
      return { ...snapshot, farm: fertilizeCrop(snapshot.farm, { ...action, ...operation }) }
    case 'harvest':
      return { ...snapshot, farm: harvestCrop(snapshot.farm, { ...action, ...operation }) }
    case 'feed':
      return { ...snapshot, farm: feedAnimal(snapshot.farm, { ...action, ...operation }) }
    case 'collect':
      return { ...snapshot, farm: collectAnimalProduct(snapshot.farm, { ...action, ...operation }) }
    case 'buy-supplies':
      return purchaseFarmSupplies(snapshot, { ...settlement, ...operation })
    case 'buy-plot':
      return purchaseNextPlot(snapshot, settlement)
    case 'buy-building':
      return purchaseOrUpgradeBuilding(snapshot, { ...settlement, ...operation })
    case 'buy-animal':
      return purchaseFarmAnimal(snapshot, { ...settlement, ...operation })
    case 'sell':
      return sellFarmProducts(snapshot, { ...settlement, ...operation })
    case 'claim-recovery':
      return claimRecoverySupply(snapshot, action)
  }
}

function applyProcessingOperation(
  snapshot: LearningSnapshot,
  operation: ProcessingOperation,
  id: string,
  now: number,
): LearningSnapshot {
  switch (operation.type) {
    case 'buy-workshop':
      return purchaseProcessingWorkshop(snapshot, { settlementId: id, now })
    case 'start-processing':
      return startProcessingTask(snapshot, { actionId: id, now, recipeId: operation.recipeId })
    case 'collect-processing':
      return collectProcessingOutput(snapshot, { actionId: id, now })
    case 'sell-processing':
      return sellProcessingProducts(snapshot, {
        settlementId: id,
        now,
        selection: operation.selection,
      })
  }
}

function processingOperationSignature(operation: ProcessingOperation, now: number): string {
  switch (operation.type) {
    case 'buy-workshop':
      return JSON.stringify({ type: 'purchase-workshop', now })
    case 'start-processing':
      return JSON.stringify({ type: 'start-processing', now, recipeId: operation.recipeId })
    case 'collect-processing':
      return JSON.stringify({ type: 'collect-processing', now })
    case 'sell-processing':
      return JSON.stringify({
        type: 'sell-processed-product',
        now,
        selection: operation.selection,
      })
  }
}

export const useLearningStore = defineStore('learning', () => {
  const snapshot = ref<LearningSnapshot>(createEmptyLearningSnapshot())
  const ready = ref(false)
  const loadError = ref('')
  const saveError = ref('')
  const notice = ref('')
  const saving = ref(false)
  const farmNow = ref(systemClock.now())
  const preferences = ref<LearningPreferences>({ ...DEFAULT_PREFERENCES })
  const courseSelectionRequired = ref(false)
  const systemReducedMotion = ref(false)

  let storage: StoragePort | undefined
  let repository: LearningRepository | undefined
  let sessions: PracticeSessionRepository | undefined
  let clock: Clock = systemClock
  let ids: IdGenerator = createCryptoIdGenerator()
  let random: Random = mathRandom
  let motionQuery: MediaQueryList | undefined

  function watchSystemReducedMotion(): void {
    if (motionQuery || typeof window === 'undefined' || !window.matchMedia) return
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    systemReducedMotion.value = motionQuery.matches
    motionQuery.addEventListener('change', (event) => {
      systemReducedMotion.value = event.matches
    })
  }

  const course = computed(() => {
    const availability = getCourseAvailability(
      snapshot.value.course.grade,
      snapshot.value.course.semester,
      'math',
    )
    return (
      (availability ? getCourseById(availability.courseId) : undefined) ?? GRADE4_AUTUMN_MATH_COURSE
    )
  })
  const subjectStatuses = computed(() => ({
    math: getSubjectStatus('math'),
    english: getSubjectStatus('english'),
  }))
  const today = computed(() =>
    getTodayLearningSummary(
      snapshot.value,
      farmNow.value,
      getDailyGoalForDate(preferences.value, farmNow.value),
    ),
  )
  const upcomingDailyGoal = computed(() => {
    const tomorrow = new Date(farmNow.value)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return getDailyGoalForDate(preferences.value, tomorrow)
  })
  const parentSummary = computed(() =>
    getParentLearningSummary(
      snapshot.value,
      farmNow.value,
      getDailyGoalForDate(preferences.value, farmNow.value),
    ),
  )
  const activeSession = computed(
    () =>
      Object.values(snapshot.value.practice.sessions)
        .filter((session) => session.status === 'active')
        .sort((left, right) => right.updatedAt - left.updatedAt)[0],
  )
  const activeCourse = computed(() => {
    const courseId = activeSession.value?.questions[0]?.question.classification.courseId
    return courseId ? getCourseById(courseId) : undefined
  })
  const practiceSessions = computed(() =>
    Object.values(snapshot.value.practice.sessions).sort(
      (left, right) => right.updatedAt - left.updatedAt,
    ),
  )
  const pendingHarvests = computed(() => getPendingHarvestCount(snapshot.value.farm, farmNow.value))
  // 系统级“减少动态效果”优先于应用内开关：系统开启时无论偏好如何都减少动效
  const animationsReduced = computed(
    () => systemReducedMotion.value || !preferences.value.animationsEnabled,
  )
  const farmMotionReduced = computed(
    () => systemReducedMotion.value || preferences.value.reduceFarmMotion,
  )

  function getSubjectStatus(subject: Subject) {
    const availability = getCourseAvailability(
      snapshot.value.course.grade,
      snapshot.value.course.semester,
      subject,
    )
    const registeredCourse = availability ? getCourseById(availability.courseId) : undefined
    const contentReady =
      availability?.available === true && hasPracticeContent(availability.courseId)
    return {
      availability,
      course: registeredCourse,
      contentReady,
      reason:
        availability?.available !== true
          ? (availability?.unavailableReason ?? '该学期暂未开放此学科')
          : contentReady
            ? ''
            : '课程内容正在准备中，暂不能开始练习',
    }
  }

  function initialize(dependencies: LearningStoreDependencies = {}): boolean {
    if (dependencies.storage) storage = dependencies.storage
    if (dependencies.clock) clock = dependencies.clock
    if (dependencies.ids) ids = dependencies.ids
    if (dependencies.random) random = dependencies.random
    watchSystemReducedMotion()
    getNow()
    const selectedStorage = storage ?? getBrowserStorage()
    storage = selectedStorage
    repository = new LearningRepository(selectedStorage)
    sessions = new PracticeSessionRepository(repository)
    try {
      const hasExistingSnapshot = selectedStorage.getItem(LEARNING_STORAGE_KEY) !== null
      snapshot.value = repository.load()
      preferences.value = parsePreferences(selectedStorage.getItem(PREFERENCES_STORAGE_KEY))
      courseSelectionRequired.value = !hasExistingSnapshot && !preferences.value.courseIntroSeen
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
      getNow()
      const hasExistingSnapshot = storage?.getItem(LEARNING_STORAGE_KEY) !== null
      snapshot.value = repository.load()
      preferences.value = parsePreferences(storage?.getItem(PREFERENCES_STORAGE_KEY) ?? null)
      courseSelectionRequired.value = !hasExistingSnapshot && !preferences.value.courseIntroSeen
      loadError.value = ''
      saveError.value = ''
    } catch (error) {
      loadError.value = readableLoadError(error)
    }
  }

  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === LEARNING_STORAGE_KEY || event.key === PREFERENCES_STORAGE_KEY) refresh()
  }

  function selectCourse(selection: CourseSelection): boolean {
    if (saving.value) return false
    if (!repository || !storage) {
      saveError.value = '学习数据尚未准备好，请刷新后重试'
      return false
    }
    if (!getCourseAvailability(selection.grade, selection.semester, 'math')?.available) {
      saveError.value = '所选学期课程无效，请重新选择'
      return false
    }

    saving.value = true
    notice.value = ''
    saveError.value = ''
    try {
      const next = repository.transact(snapshot.value.revision, (current) => ({
        ...current,
        course: { grade: selection.grade, semester: selection.semester },
      }))
      snapshot.value = next
      if (
        !writePreferences(
          { ...preferences.value, courseIntroSeen: true },
          '课程设置暂未保存，请重试',
        )
      ) {
        return false
      }
      courseSelectionRequired.value = false
      notice.value = activeSession.value
        ? '课程选择已保存；当前练习组仍按原课程继续，下一组才使用新选择'
        : '课程选择已保存到本机'
      return true
    } catch (error) {
      saveError.value = readableSaveError(error)
      return false
    } finally {
      saving.value = false
    }
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
        getDailyGoalForDate(preferences.value, getNow()),
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
    if (courseSelectionRequired.value) {
      saveError.value = '请先在首页选择课程，再开始练习'
      return null
    }
    const status = getSubjectStatus(options.subject)
    if (status.availability?.available !== true || !status.contentReady || !status.course) {
      saveError.value = status.reason
      return null
    }
    const courseId = status.course.id
    const now = getNow()
    const id = `practice-${ids.next()}`
    const paper =
      options.mode === 'comprehensive'
        ? generateComprehensivePaper({
            courseId,
            total: today.value.goal,
            seed: random.int(0, 0xffffffff),
            idPrefix: id,
            retestPool: snapshot.value.practice.retestPool,
          })
        : generateSpecialPaper({
            courseId,
            unitId: options.unitId,
            knowledgePointId: options.knowledgePointId,
            ability: options.ability,
            questionType: options.questionType,
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
      submitted = submitPracticeAnswer(
        editableSession(session),
        structuredClone(toRaw(answer)),
        clock.now(),
        {
          seed: random.int(0, 0xffffffff),
          idPrefix: sessionId,
        },
        {
          seed: random.int(0, 0xffffffff),
          idPrefix: sessionId,
        },
      )
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
      const replacement = createQuestionVariant(
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

  function getNow(): number {
    farmNow.value = clock.now()
    return farmNow.value
  }

  function performFarmOperation(operation: FarmOperation): boolean {
    if (saving.value) return false
    if (!repository) {
      saveError.value = '学习数据尚未准备好，请刷新后重试'
      return false
    }
    saving.value = true
    saveError.value = ''
    try {
      const now = getNow()
      const next = transactFarmOperation(repository, snapshot.value.revision, (current) =>
        applyFarmOperation(current, operation, `farm-${ids.next()}`, now),
      )
      snapshot.value = next
      notice.value = FARM_OPERATION_NOTICES[operation.type] ?? ''
      return true
    } catch (error) {
      saveError.value =
        error instanceof RevisionConflictError ||
        error instanceof PersistenceWriteError ||
        error instanceof CorruptedSnapshotError ||
        error instanceof UnsupportedSchemaVersionError
          ? readableSaveError(error)
          : error instanceof Error
            ? error.message
            : '农场操作暂时无法完成，请重试'
      notice.value = ''
      return false
    } finally {
      saving.value = false
    }
  }

  function performProcessingOperation(operation: ProcessingOperation): boolean {
    if (saving.value) return false
    if (!repository) {
      saveError.value = '学习数据尚未准备好，请刷新后重试'
      return false
    }
    saving.value = true
    saveError.value = ''
    try {
      const now = getNow()
      const id = `processing-${ids.next()}`
      const next = transactProcessingOperation(
        repository,
        snapshot.value.revision,
        { actionId: id, signature: processingOperationSignature(operation, now) },
        (current) => applyProcessingOperation(current, operation, id, now),
      )
      snapshot.value = next
      notice.value = PROCESSING_OPERATION_NOTICES[operation.type]
      return true
    } catch (error) {
      saveError.value =
        error instanceof RevisionConflictError ||
        error instanceof PersistenceWriteError ||
        error instanceof CorruptedSnapshotError ||
        error instanceof UnsupportedSchemaVersionError
          ? readableSaveError(error)
          : error instanceof Error
            ? error.message
            : '加工操作暂时无法完成，请重试'
      notice.value = ''
      return false
    } finally {
      saving.value = false
    }
  }

  function writePreferences(next: LearningPreferences, failureMessage: string): boolean {
    if (!storage) {
      saveError.value = '学习数据尚未准备好，请刷新后重试'
      return false
    }
    try {
      storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
      preferences.value = next
      saveError.value = ''
      return true
    } catch {
      saveError.value = failureMessage
      return false
    }
  }

  function updatePreferences(patch: Partial<LearningPreferences>): boolean {
    return writePreferences({ ...preferences.value, ...patch }, '体验设置暂未保存，请重试')
  }

  function updateDailyGoal(goal: number): boolean {
    notice.value = ''
    let next: LearningPreferences
    try {
      next = {
        ...preferences.value,
        ...scheduleDailyGoalChange(preferences.value, goal, getNow()),
      }
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : '每日目标无效'
      return false
    }
    if (!writePreferences(next, '每日目标暂未保存，请重试')) return false
    notice.value = `每日目标已保存，将从 ${next.pendingDailyGoalEffectiveFrom} 起调整为 ${goal} 题`
    return true
  }

  function clearLearningData(): boolean {
    if (!repository) {
      saveError.value = '学习数据尚未准备好，请刷新后重试'
      return false
    }
    saving.value = true
    notice.value = ''
    try {
      repository.clear()
      snapshot.value = createEmptyLearningSnapshot()
      courseSelectionRequired.value = !preferences.value.courseIntroSeen
      getNow()
      loadError.value = ''
      saveError.value = ''
      ready.value = true
      notice.value = '学习、金币和农场记录已清除'
      return true
    } catch {
      saveError.value = '学习数据暂未清除，请重试'
      return false
    } finally {
      saving.value = false
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
    farmNow,
    preferences,
    systemReducedMotion,
    animationsReduced,
    farmMotionReduced,
    courseSelectionRequired,
    course,
    subjectStatuses,
    activeCourse,
    today,
    upcomingDailyGoal,
    parentSummary,
    activeSession,
    practiceSessions,
    pendingHarvests,
    initialize,
    refresh,
    handleStorageEvent,
    selectCourse,
    startPractice,
    resumeSession,
    submitAnswer,
    advanceSession,
    abandonSession,
    getSession,
    getSessionSummary,
    practiceRewardFor,
    getNow,
    performFarmOperation,
    performProcessingOperation,
    updatePreferences,
    updateDailyGoal,
    clearLearningData,
    clearMessages,
  }
})
