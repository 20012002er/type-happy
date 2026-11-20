import { describe, expect, it } from 'vitest'
import { LearningRepository } from '../../../src/learning/persistence/repository'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import { generateSpecialPaper } from '../../../src/learning/practice/paper'
import { PracticeSessionRepository } from '../../../src/learning/practice/practice-repository'
import {
  abandonPracticeSession,
  advancePracticeSession,
  createPracticeSession,
  getPracticeOutcome,
  submitPracticeAnswer,
  type PracticeSession,
} from '../../../src/learning/practice/practice-session'
import { parseRetestPoolEntry } from '../../../src/learning/practice/retest'
import type { Answer, QuestionSnapshot } from '../../../src/learning/types'
import { MemoryStorage } from '../../helpers/memory-storage'

function makeSession(id: string, size = 3): PracticeSession {
  const paper = generateSpecialPaper({
    knowledgePointId: 'oral-multiplication-by-one-digit',
    difficulty: 'L1',
    seed: 71,
    idPrefix: `${id}-paper`,
    size,
  })
  return createPracticeSession({ id, mode: 'special', questions: paper.questions, createdAt: 100 })
}

function wrongAnswer(question: QuestionSnapshot): Answer {
  if (question.standardAnswer.kind !== 'number') throw new Error('测试只使用数字答案')
  return { kind: 'number', value: question.standardAnswer.value + 1 }
}

function current(session: PracticeSession) {
  return session.questions[session.currentIndex]
}

function answerCorrectly(session: PracticeSession, at: number): PracticeSession {
  return submitPracticeAnswer(session, current(session).question.standardAnswer, at)
}

describe('practice session persistence and recovery', () => {
  it('saves each result atomically and resumes at the next unsettled question without duplicate records', () => {
    const storage = new MemoryStorage()
    const repository = new PracticeSessionRepository(new LearningRepository(storage))
    let session = makeSession('persisted', 2)
    let snapshot = repository.save(session, 0)
    expect(snapshot.revision).toBe(1)

    session = answerCorrectly(session, 110)
    snapshot = repository.save(session, snapshot.revision)
    expect(snapshot.revision).toBe(2)
    expect(snapshot.learning.records).toHaveLength(1)
    expect(snapshot.wallet.balance).toBe(0)
    expect(snapshot.tasks.daily).toEqual({})

    expect(repository.save(session, snapshot.revision).revision).toBe(2)
    expect(repository.load('persisted')?.questions[0].status).toBe('first-correct')
    expect(repository.resume('persisted', 120)?.currentIndex).toBe(1)
    expect(repository.resume('missing', 120)).toBeUndefined()
  })

  it('keeps completed groups read-only at the repository boundary', () => {
    const repository = new PracticeSessionRepository(new LearningRepository(new MemoryStorage()))
    let session = makeSession('readonly', 1)
    let snapshot = repository.save(session, 0)
    session = answerCorrectly(session, 110)
    snapshot = repository.save(session, snapshot.revision)
    session = advancePracticeSession(session, 120)
    snapshot = repository.save(session, snapshot.revision)
    expect(snapshot.revision).toBe(3)

    const changed = structuredClone(session)
    changed.updatedAt = 999
    expect(() => repository.save(changed, snapshot.revision)).toThrow('只读状态')
    expect(repository.save(session, snapshot.revision).revision).toBe(3)
  })

  it('enqueues an explanation correction and completes its scheduled retest as a new instance', () => {
    const repository = new PracticeSessionRepository(new LearningRepository(new MemoryStorage()))
    let session = makeSession('retest-now', 6)
    let snapshot = repository.save(session, 0)
    const original = current(session).question
    session = submitPracticeAnswer(session, wrongAnswer(original), 110)
    session = submitPracticeAnswer(session, wrongAnswer(original), 120)
    session = submitPracticeAnswer(session, original.standardAnswer, 130, {
      seed: 800,
      idPrefix: 'retest-now',
    })
    snapshot = repository.save(session, snapshot.revision)
    const poolEntry = snapshot.practice.retestPool.find(
      (entry) => entry.originalQuestion.instanceId === original.instanceId,
    )
    expect(poolEntry?.status).toBe('scheduled')
    const retestIndex = session.questions.findIndex(
      (entry) => entry.retestOfInstanceId === original.instanceId,
    )
    expect(retestIndex).toBeGreaterThanOrEqual(3)
    const retestInstanceId = session.questions[retestIndex].question.instanceId
    expect(retestInstanceId).not.toBe(original.instanceId)
    expect(session.questions).toHaveLength(6)

    while (session.currentIndex < retestIndex) {
      session = advancePracticeSession(session, session.updatedAt + 1)
      session = answerCorrectly(session, session.updatedAt + 1)
    }
    snapshot = repository.save(session, snapshot.revision)
    expect(getPracticeOutcome(session.questions[retestIndex]).rewardResult).toBe('first-correct')
    const completed = snapshot.practice.retestPool.find((entry) => entry.id === poolEntry?.id)
    expect(completed).toMatchObject({ status: 'completed', retestInstanceId })
    expect(
      snapshot.learning.records.filter(
        (record) => record.questionInstanceId === original.instanceId,
      ),
    ).toHaveLength(1)
    expect(
      snapshot.learning.records.filter((record) => record.questionInstanceId === retestInstanceId),
    ).toHaveLength(1)
  })

  it('injects an unscheduled pending retest into the next group by replacement, not expansion', () => {
    const repository = new PracticeSessionRepository(new LearningRepository(new MemoryStorage()))
    let first = makeSession('retest-later', 2)
    let snapshot = repository.save(first, 0)
    const original = current(first).question
    first = submitPracticeAnswer(first, wrongAnswer(original), 110)
    first = submitPracticeAnswer(first, wrongAnswer(original), 120)
    first = submitPracticeAnswer(first, original.standardAnswer, 130, {
      seed: 700,
      idPrefix: 'retest-later',
    })
    expect(first.questions.some((entry) => entry.retestOfInstanceId === original.instanceId)).toBe(
      false,
    )
    snapshot = repository.save(first, snapshot.revision)
    expect(snapshot.practice.retestPool[0].status).toBe('pending')

    const paper = generateSpecialPaper({
      knowledgePointId: original.classification.knowledgePointId,
      difficulty: original.difficulty,
      seed: 88,
      idPrefix: 'next-group-paper',
      size: 10,
      retestPool: snapshot.practice.retestPool,
    })
    expect(paper.questions).toHaveLength(10)
    const input = paper.questions.find((item) => item.retestOfInstanceId === original.instanceId)
    expect(input).toBeDefined()
    expect(input?.question.instanceId).not.toBe(original.instanceId)
    expect(input?.question.prompt).not.toBe(original.prompt)

    let next = createPracticeSession({
      id: 'next-group',
      mode: 'special',
      questions: paper.questions,
      createdAt: 200,
    })
    snapshot = repository.save(next, snapshot.revision)
    expect(snapshot.practice.retestPool[0].status).toBe('scheduled')
    next = answerCorrectly(next, 210)
    snapshot = repository.save(next, snapshot.revision)
    expect(snapshot.practice.retestPool[0].status).toBe('completed')
    expect(snapshot.practice.sessions['next-group'].questions).toHaveLength(10)
  })

  it('rejects a conflicting record for an already settled question instance', () => {
    const repository = new PracticeSessionRepository(new LearningRepository(new MemoryStorage()))
    let session = makeSession('conflict', 1)
    let snapshot = repository.save(session, 0)
    session = answerCorrectly(session, 110)
    snapshot = repository.save(session, snapshot.revision)
    const changed = structuredClone(session)
    changed.records[0].settledAt = 999
    expect(() => repository.save(changed, snapshot.revision)).toThrow('学习记录发生冲突')
    expect(repository.load('conflict')?.records[0].settledAt).toBe(110)
  })

  it('returns a retest to pending when its scheduled group is abandoned', () => {
    const repository = new PracticeSessionRepository(new LearningRepository(new MemoryStorage()))
    let session = makeSession('retest-abandoned', 6)
    let snapshot = repository.save(session, 0)
    const original = current(session).question
    session = submitPracticeAnswer(session, wrongAnswer(original), 110)
    session = submitPracticeAnswer(session, wrongAnswer(original), 120)
    session = submitPracticeAnswer(session, original.standardAnswer, 130, {
      seed: 800,
      idPrefix: 'retest-abandoned',
    })
    snapshot = repository.save(session, snapshot.revision)
    expect(snapshot.practice.retestPool[0].status).toBe('scheduled')
    session = abandonPracticeSession(session, 140)
    snapshot = repository.save(session, snapshot.revision)
    expect(snapshot.practice.retestPool[0]).toMatchObject({
      status: 'pending',
      retestInstanceId: undefined,
      settledAt: undefined,
    })
  })

  it('validates retest pool entries restored from storage', () => {
    const valid = {
      id: 'retest-1',
      originalQuestion: generateMathQuestion('oral-mul-one-v1', 1, 'original'),
      originSessionId: 'session',
      seed: 2,
      createdAt: 100,
      status: 'completed',
      retestInstanceId: 'retest-instance',
      settledAt: 200,
    }
    expect(parseRetestPoolEntry(structuredClone(valid))).toEqual(valid)
    const invalidCases: Array<[unknown, string]> = [
      [null, '必须是对象'],
      [{ ...valid, id: '' }, '复测 ID'],
      [{ ...valid, originSessionId: '' }, '来源练习组'],
      [{ ...valid, seed: -1 }, '种子无效'],
      [{ ...valid, createdAt: -1 }, '创建时间无效'],
      [{ ...valid, status: 'other' }, '状态无效'],
      [{ ...valid, retestInstanceId: 1 }, '实例 ID 无效'],
      [{ ...valid, settledAt: -1 }, '结算时间无效'],
    ]
    for (const [value, message] of invalidCases) {
      expect(() => parseRetestPoolEntry(value)).toThrow(message)
    }
  })
})
