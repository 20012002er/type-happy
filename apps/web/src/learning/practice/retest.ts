import { parseQuestionSnapshot } from '../contracts'
import type { QuestionSnapshot } from '../types'
import { createRetestQuestion } from './math-generator'
import type {
  PracticeQuestionInput,
  PracticeSession,
  RetestSchedulingOptions,
} from './practice-session'

export type RetestStatus = 'pending' | 'scheduled' | 'completed'

export interface RetestPoolEntry {
  id: string
  originalQuestion: QuestionSnapshot
  originSessionId: string
  seed: number
  createdAt: number
  status: RetestStatus
  retestInstanceId?: string
  settledAt?: number
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function seedFromInstance(instanceId: string, originalSeed: number): number {
  let hash = originalSeed >>> 0
  for (let index = 0; index < instanceId.length; index += 1) {
    hash = Math.imul(hash ^ instanceId.charCodeAt(index), 0x01000193) >>> 0
  }
  return hash
}

function retestId(original: QuestionSnapshot): string {
  return `retest-${original.instanceId}`
}

function createPoolEntry(
  original: QuestionSnapshot,
  originSessionId: string,
  createdAt: number,
): RetestPoolEntry {
  return {
    id: retestId(original),
    originalQuestion: clone(original),
    originSessionId,
    seed: seedFromInstance(original.instanceId, original.seed),
    createdAt,
    status: 'pending',
  }
}

function replaceWithRetest(
  input: PracticeQuestionInput,
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
): PracticeQuestionInput {
  return {
    question: createRetestQuestion(original, seed, instanceId),
    retestOfInstanceId: original.instanceId,
  }
}

export function scheduleRetestInSession(
  session: PracticeSession,
  original: QuestionSnapshot,
  options: RetestSchedulingOptions,
  scheduledAt: number,
): PracticeSession {
  if (options.idPrefix.trim().length === 0) throw new Error('复测实例 ID 前缀不能为空')
  const next = clone(session)
  const first = next.currentIndex + 3
  const last = Math.min(next.currentIndex + 5, next.questions.length - 1)
  const candidates = next.questions
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry, index }) =>
        index >= first &&
        index <= last &&
        entry.status === 'pending' &&
        entry.retestOfInstanceId === undefined,
    )
  const target =
    candidates.find(({ entry }) => entry.question.templateId === original.templateId) ??
    candidates.find(
      ({ entry }) => entry.question.classification.unitId === original.classification.unitId,
    )
  if (!target) return next
  ;(next.questions as PracticeSession['questions'][number][])[target.index] = {
    ...next.questions[target.index],
    ...replaceWithRetest(
      next.questions[target.index],
      original,
      options.seed,
      `${options.idPrefix}-retest-${original.instanceId}`,
    ),
  }
  next.updatedAt = scheduledAt
  return next
}

export function injectRetestsIntoPaper(
  questions: readonly PracticeQuestionInput[],
  pool: readonly RetestPoolEntry[],
  idPrefix: string,
): PracticeQuestionInput[] {
  const next = clone(questions) as PracticeQuestionInput[]
  const reserved = new Set(next.map((input) => input.question.instanceId))
  for (const poolEntry of pool.filter((entry) => entry.status === 'pending')) {
    const candidates = next
      .map((input, index) => ({ input, index }))
      .filter(({ input }) => input.retestOfInstanceId === undefined)
    const target =
      candidates.find(
        ({ input }) => input.question.templateId === poolEntry.originalQuestion.templateId,
      ) ??
      candidates.find(
        ({ input }) =>
          input.question.classification.unitId === poolEntry.originalQuestion.classification.unitId,
      )
    if (!target) continue
    let instanceId = `${idPrefix}-${poolEntry.id}`
    let suffix = 2
    while (reserved.has(instanceId)) {
      instanceId = `${idPrefix}-${poolEntry.id}-${suffix}`
      suffix += 1
    }
    reserved.add(instanceId)
    next[target.index] = replaceWithRetest(
      target.input,
      poolEntry.originalQuestion,
      poolEntry.seed,
      instanceId,
    )
  }
  return next
}

export function reconcileRetestPool(
  pool: readonly RetestPoolEntry[],
  session: PracticeSession,
  reconciledAt: number,
): RetestPoolEntry[] {
  const next = clone(pool) as RetestPoolEntry[]
  for (const entry of session.questions) {
    if (
      entry.status === 'corrected-awaiting-retest' &&
      !next.some((item) => item.id === retestId(entry.question))
    ) {
      next.push(createPoolEntry(entry.question, session.id, entry.settledAt ?? reconciledAt))
    }
    if (!entry.retestOfInstanceId) continue
    const poolEntry = next.find((item) => item.id === `retest-${entry.retestOfInstanceId}`)
    if (!poolEntry) continue
    const effectiveCompletion = [
      'first-correct',
      'mastered-after-hint',
      'corrected-awaiting-retest',
    ].includes(entry.status)
    if (effectiveCompletion) {
      poolEntry.status = 'completed'
      poolEntry.retestInstanceId = entry.question.instanceId
      poolEntry.settledAt = entry.settledAt ?? reconciledAt
    } else if (entry.status === 'abandoned') {
      poolEntry.status = 'pending'
      poolEntry.retestInstanceId = undefined
      poolEntry.settledAt = undefined
    } else {
      poolEntry.status = 'scheduled'
      poolEntry.retestInstanceId = entry.question.instanceId
    }
  }
  return next
}

export function parseRetestPoolEntry(value: unknown): RetestPoolEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('复测池条目必须是对象')
  }
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string' || entry.id.trim().length === 0)
    throw new Error('复测 ID 不能为空')
  if (typeof entry.originSessionId !== 'string' || entry.originSessionId.trim().length === 0) {
    throw new Error('复测来源练习组不能为空')
  }
  parseQuestionSnapshot(entry.originalQuestion)
  if (!Number.isSafeInteger(entry.seed) || Number(entry.seed) < 0) throw new Error('复测种子无效')
  if (!Number.isSafeInteger(entry.createdAt) || Number(entry.createdAt) < 0) {
    throw new Error('复测创建时间无效')
  }
  if (!['pending', 'scheduled', 'completed'].includes(String(entry.status))) {
    throw new Error('复测状态无效')
  }
  if (entry.retestInstanceId !== undefined && typeof entry.retestInstanceId !== 'string') {
    throw new Error('复测实例 ID 无效')
  }
  if (
    entry.settledAt !== undefined &&
    (!Number.isSafeInteger(entry.settledAt) || Number(entry.settledAt) < 0)
  ) {
    throw new Error('复测结算时间无效')
  }
  return entry as unknown as RetestPoolEntry
}
