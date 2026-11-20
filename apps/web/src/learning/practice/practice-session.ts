import { parseAnswer, parseLearningRecord, parseQuestionSnapshot } from '../contracts'
import type { Answer, LearningRecord, QuestionSnapshot } from '../types'
import { judgeAnswer } from './answer'
import { createCorrectionGuidance, type CorrectionGuidance } from './correction'
import { scheduleRetestInSession } from './retest'

export const PRACTICE_QUESTION_STATUSES = [
  'pending',
  'awaiting-correction',
  'needs-explanation',
  'first-correct',
  'mastered-after-hint',
  'corrected-awaiting-retest',
  'abandoned',
  'content-error',
] as const

export type PracticeQuestionStatus = (typeof PRACTICE_QUESTION_STATUSES)[number]
export type PracticeSessionStatus = 'active' | 'completed' | 'abandoned'
export type PracticeMode = 'comprehensive' | 'special'

export interface PracticeQuestionInput {
  question: QuestionSnapshot
  retestOfInstanceId?: string
}

export interface PracticeQuestionEntry extends PracticeQuestionInput {
  status: PracticeQuestionStatus
  attempts: number
  highestHintLevel: 0 | 1 | 2
  explanationViewed: boolean
  startedAt: number
  settledAt?: number
  lastAnswer?: Answer
  feedback?: CorrectionGuidance
}

export interface PracticeSession {
  id: string
  mode: PracticeMode
  status: PracticeSessionStatus
  currentIndex: number
  questions: readonly PracticeQuestionEntry[]
  records: readonly LearningRecord[]
  createdAt: number
  updatedAt: number
}

export interface RetestSchedulingOptions {
  seed: number
  idPrefix: string
}

export interface PracticeOutcome {
  effectiveCompletion: boolean
  participatesInTask: boolean
  rewardEligible: boolean
  rewardResult: 'first-correct' | 'mastered-after-hint' | 'corrected-awaiting-retest' | null
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function isTerminal(status: PracticeQuestionStatus): boolean {
  return [
    'first-correct',
    'mastered-after-hint',
    'corrected-awaiting-retest',
    'abandoned',
    'content-error',
  ].includes(status)
}

function expectTimestamp(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} 必须是非负安全整数`)
  }
}

function makeRecord(
  session: PracticeSession,
  entry: PracticeQuestionEntry,
  result: LearningRecord['result'],
  settledAt: number,
): LearningRecord {
  return {
    id: `record-${session.id}-${entry.question.instanceId}`,
    questionInstanceId: entry.question.instanceId,
    templateId: entry.question.templateId,
    templateVersion: entry.question.templateVersion,
    courseId: entry.question.classification.courseId,
    knowledgePointId: entry.question.classification.knowledgePointId,
    result,
    answer: entry.lastAnswer,
    attempts: entry.attempts,
    highestHintLevel: entry.highestHintLevel,
    explanationViewed: entry.explanationViewed,
    startedAt: entry.startedAt,
    settledAt,
  }
}

function currentEntry(session: PracticeSession): PracticeQuestionEntry {
  if (session.status !== 'active') throw new Error('已完成或已放弃的练习组为只读状态')
  const entry = session.questions[session.currentIndex]
  if (!entry) throw new Error('当前题目不存在')
  return entry
}

function createEntry(input: PracticeQuestionInput, startedAt: number): PracticeQuestionEntry {
  return {
    ...clone(input),
    status: 'pending',
    attempts: 0,
    highestHintLevel: 0,
    explanationViewed: false,
    startedAt,
  }
}

export function createPracticeSession(options: {
  id: string
  mode: PracticeMode
  questions: readonly PracticeQuestionInput[]
  createdAt: number
}): PracticeSession {
  if (options.id.trim().length === 0) throw new Error('练习组 ID 不能为空')
  if (options.questions.length === 0) throw new Error('练习组至少需要一道题')
  expectTimestamp(options.createdAt, '创建时间')
  const instanceIds = new Set<string>()
  for (const input of options.questions) {
    parseQuestionSnapshot(input.question)
    if (instanceIds.has(input.question.instanceId)) throw new Error('题目实例 ID 不能重复')
    instanceIds.add(input.question.instanceId)
  }
  return {
    id: options.id,
    mode: options.mode,
    status: 'active',
    currentIndex: 0,
    questions: options.questions.map((input) => createEntry(input, options.createdAt)),
    records: [],
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  }
}

export function getPracticeOutcome(entry: PracticeQuestionEntry): PracticeOutcome {
  const rewardResult =
    entry.status === 'first-correct' ||
    entry.status === 'mastered-after-hint' ||
    entry.status === 'corrected-awaiting-retest'
      ? entry.status
      : null
  const effectiveCompletion = rewardResult !== null
  return {
    effectiveCompletion,
    participatesInTask: effectiveCompletion && entry.question.participatesInTask,
    rewardEligible: effectiveCompletion && entry.question.rewardEligible,
    rewardResult,
  }
}

export function submitPracticeAnswer(
  session: PracticeSession,
  answer: Answer,
  submittedAt: number,
  retestScheduling?: RetestSchedulingOptions,
): PracticeSession {
  expectTimestamp(submittedAt, '提交时间')
  const current = currentEntry(session)
  if (isTerminal(current.status)) throw new Error('当前题目已结算，不能重复提交')
  const judgement = judgeAnswer(current.question, answer)
  const next = clone(session)
  const entry = next.questions[next.currentIndex]
  entry.attempts += 1
  entry.lastAnswer = clone(answer)
  next.updatedAt = submittedAt

  if (judgement.correct) {
    entry.status =
      current.status === 'pending'
        ? 'first-correct'
        : current.status === 'awaiting-correction'
          ? 'mastered-after-hint'
          : 'corrected-awaiting-retest'
    entry.settledAt = submittedAt
    entry.feedback = undefined
    next.records = [...next.records, makeRecord(next, entry, entry.status, submittedAt)]
    if (entry.status === 'corrected-awaiting-retest' && retestScheduling) {
      return scheduleRetestInSession(next, entry.question, retestScheduling, submittedAt)
    }
    return next
  }

  const guidance = createCorrectionGuidance(current.question, judgement, entry.attempts)
  entry.feedback = guidance
  entry.highestHintLevel = guidance.hintLevel
  if (guidance.hintLevel === 2) {
    entry.status = 'needs-explanation'
    entry.explanationViewed = true
  } else {
    entry.status = 'awaiting-correction'
  }
  return next
}

export function advancePracticeSession(
  session: PracticeSession,
  advancedAt: number,
): PracticeSession {
  expectTimestamp(advancedAt, '推进时间')
  const current = currentEntry(session)
  if (!isTerminal(current.status)) throw new Error('当前题目尚未结算，不能进入下一题')
  const next = clone(session)
  next.updatedAt = advancedAt
  if (next.currentIndex === next.questions.length - 1) {
    next.status = 'completed'
    return next
  }
  next.currentIndex += 1
  return next
}

export function resumePracticeSession(
  session: PracticeSession,
  resumedAt: number,
): PracticeSession {
  expectTimestamp(resumedAt, '恢复时间')
  const next = clone(session)
  if (next.status !== 'active') return next
  const nextIndex = next.questions.findIndex((entry) => !isTerminal(entry.status))
  next.updatedAt = resumedAt
  if (nextIndex === -1) {
    next.status = 'completed'
    return next
  }
  next.currentIndex = nextIndex
  return next
}

export function abandonPracticeSession(
  session: PracticeSession,
  abandonedAt: number,
): PracticeSession {
  expectTimestamp(abandonedAt, '放弃时间')
  currentEntry(session)
  const next = clone(session)
  const records = [...next.records]
  for (const entry of next.questions) {
    if (isTerminal(entry.status)) continue
    entry.status = 'abandoned'
    entry.settledAt = abandonedAt
    records.push(makeRecord(next, entry, 'abandoned', abandonedAt))
  }
  next.records = records
  next.status = 'abandoned'
  next.updatedAt = abandonedAt
  return next
}

export function replacePracticeQuestion(
  session: PracticeSession,
  replacement: QuestionSnapshot,
  replacedAt: number,
): PracticeSession {
  expectTimestamp(replacedAt, '换题时间')
  const current = currentEntry(session)
  if (isTerminal(current.status)) throw new Error('已结算题目不能换题')
  parseQuestionSnapshot(replacement)
  if (session.questions.some((entry) => entry.question.instanceId === replacement.instanceId)) {
    throw new Error('替换题必须使用新的题目实例 ID')
  }
  const next = clone(session)
  const previous = next.questions[next.currentIndex]
  previous.status = 'content-error'
  previous.settledAt = replacedAt
  next.records = [...next.records, makeRecord(next, previous, 'content-error', replacedAt)]
  ;(next.questions as PracticeQuestionEntry[])[next.currentIndex] = createEntry(
    { question: replacement, retestOfInstanceId: previous.retestOfInstanceId },
    replacedAt,
  )
  next.updatedAt = replacedAt
  return next
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} 必须是对象`)
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} 不能为空`)
  return value
}

function expectInteger(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${path} 必须是大于等于 ${minimum} 的安全整数`)
  }
  return value as number
}

function parseFeedback(value: unknown): CorrectionGuidance {
  const feedback = expectObject(value, 'feedback')
  if (feedback.hintLevel !== 1 && feedback.hintLevel !== 2) throw new Error('提示等级无效')
  expectString(feedback.message, 'feedback.message')
  expectString(feedback.hint, 'feedback.hint')
  if (!Array.isArray(feedback.explanationSteps)) throw new Error('讲解步骤必须是数组')
  feedback.explanationSteps.forEach((step) => expectString(step, '讲解步骤'))
  if (feedback.revealedAnswer !== undefined) parseAnswer(feedback.revealedAnswer)
  if (feedback.preservedQuotient !== undefined) {
    expectInteger(feedback.preservedQuotient, 'feedback.preservedQuotient')
  }
  return feedback as unknown as CorrectionGuidance
}

export function parsePracticeSession(value: unknown): PracticeSession {
  const session = expectObject(value, 'practiceSession')
  expectString(session.id, 'practiceSession.id')
  if (session.mode !== 'comprehensive' && session.mode !== 'special')
    throw new Error('练习类型无效')
  if (!['active', 'completed', 'abandoned'].includes(String(session.status))) {
    throw new Error('练习组状态无效')
  }
  expectInteger(session.createdAt, 'practiceSession.createdAt')
  expectInteger(session.updatedAt, 'practiceSession.updatedAt')
  if (!Array.isArray(session.questions) || session.questions.length === 0) {
    throw new Error('练习组题目必须是非空数组')
  }
  const instanceIds = new Set<string>()
  session.questions.forEach((item, index) => {
    const entry = expectObject(item, `questions[${index}]`)
    const question = parseQuestionSnapshot(entry.question)
    if (instanceIds.has(question.instanceId)) throw new Error('题目实例 ID 不能重复')
    instanceIds.add(question.instanceId)
    if (!PRACTICE_QUESTION_STATUSES.includes(entry.status as PracticeQuestionStatus)) {
      throw new Error(`questions[${index}].status 状态无效`)
    }
    expectInteger(entry.attempts, `questions[${index}].attempts`)
    if (![0, 1, 2].includes(Number(entry.highestHintLevel))) throw new Error('提示等级无效')
    if (typeof entry.explanationViewed !== 'boolean') throw new Error('讲解查看状态无效')
    expectInteger(entry.startedAt, `questions[${index}].startedAt`)
    if (entry.settledAt !== undefined)
      expectInteger(entry.settledAt, `questions[${index}].settledAt`)
    if (entry.lastAnswer !== undefined) parseAnswer(entry.lastAnswer)
    if (entry.feedback !== undefined) parseFeedback(entry.feedback)
    if (entry.retestOfInstanceId !== undefined)
      expectString(entry.retestOfInstanceId, '复测来源 ID')
    const terminal = isTerminal(entry.status as PracticeQuestionStatus)
    if (terminal && entry.settledAt === undefined) throw new Error('已结算题目缺少结算时间')
    if (!terminal && entry.settledAt !== undefined) throw new Error('未结算题目不能有结算时间')
  })
  expectInteger(session.currentIndex, 'practiceSession.currentIndex')
  if (Number(session.currentIndex) >= session.questions.length) throw new Error('当前题号越界')
  if (!Array.isArray(session.records)) throw new Error('练习记录必须是数组')
  session.records.forEach((record) => parseLearningRecord(record))
  return session as unknown as PracticeSession
}
