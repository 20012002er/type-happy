import { describe, expect, it } from 'vitest'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import { generateSpecialPaper } from '../../../src/learning/practice/paper'
import {
  abandonPracticeSession,
  advancePracticeSession,
  createPracticeSession,
  getPracticeOutcome,
  parsePracticeSession,
  replacePracticeQuestion,
  resumePracticeSession,
  submitPracticeAnswer,
  type PracticeSession,
} from '../../../src/learning/practice/practice-session'
import type { Answer, QuestionSnapshot } from '../../../src/learning/types'

function makeSession(size = 6, id = 'session-1'): PracticeSession {
  const paper = generateSpecialPaper({
    knowledgePointId: 'oral-multiplication-by-one-digit',
    difficulty: 'L1',
    seed: 91,
    idPrefix: `${id}-paper`,
    size,
  })
  return createPracticeSession({ id, mode: 'special', questions: paper.questions, createdAt: 100 })
}

function wrongAnswer(question: QuestionSnapshot): Answer {
  const answer = question.standardAnswer
  if (answer.kind === 'number') return { kind: 'number', value: answer.value + 1 }
  if (answer.kind !== 'quotient-remainder') throw new Error('当前练习仅支持数值题和商余数题')
  return {
    kind: 'quotient-remainder',
    quotient: answer.quotient + 1,
    remainder: answer.remainder,
  }
}

function makeCausedSession(id: string) {
  const paper = generateSpecialPaper({
    knowledgePointId: 'oral-multiplication-by-one-digit',
    difficulty: 'L1',
    seed: 91,
    idPrefix: `${id}-paper`,
    size: 1,
  })
  const input = paper.questions[0]
  const wrong = wrongAnswer(input.question)
  const question: QuestionSnapshot = {
    ...input.question,
    errorCauseRules: [
      ...input.question.errorCauseRules,
      {
        id: 'test-cause',
        label: '测试错因',
        feedback: '检查计算过程',
        answers: [wrong],
      },
    ],
  }
  return {
    session: createPracticeSession({
      id,
      mode: 'special',
      questions: [{ ...input, question }],
      createdAt: 100,
    }),
    wrong,
  }
}

function current(session: PracticeSession) {
  return session.questions[session.currentIndex]
}

describe('practice question state machine', () => {
  it('settles a first-correct answer once with effective completion and reward eligibility', () => {
    const initial = makeSession()
    const original = current(initial)
    const next = submitPracticeAnswer(initial, original.question.standardAnswer, 110)
    expect(next).not.toBe(initial)
    expect(current(initial).status).toBe('pending')
    expect(current(next).status).toBe('first-correct')
    expect(current(next).attempts).toBe(1)
    expect(next.records).toHaveLength(1)
    expect(next.records[0]).toMatchObject({
      result: 'first-correct',
      attempts: 1,
      settledAt: 110,
      errorCauses: [],
    })
    expect(getPracticeOutcome(current(next))).toEqual({
      effectiveCompletion: true,
      participatesInTask: true,
      rewardEligible: true,
      rewardResult: 'first-correct',
    })
    expect(() => submitPracticeAnswer(next, original.question.standardAnswer, 120)).toThrow(
      '不能重复提交',
    )
  })

  it('moves through level-one correction to mastered-after-hint', () => {
    const initial = makeSession()
    const wrong = wrongAnswer(current(initial).question)
    const incorrect = submitPracticeAnswer(initial, wrong, 110)
    expect(current(incorrect).status).toBe('awaiting-correction')
    expect(current(incorrect).feedback).toMatchObject({ hintLevel: 1, explanationSteps: [] })
    expect(current(incorrect).lastAnswer).toEqual(wrong)
    expect(incorrect.records).toHaveLength(0)

    const corrected = submitPracticeAnswer(
      incorrect,
      current(incorrect).question.standardAnswer,
      120,
    )
    expect(current(corrected).status).toBe('mastered-after-hint')
    expect(current(corrected).highestHintLevel).toBe(1)
    expect(current(corrected).explanationViewed).toBe(false)
    expect(nextResult(corrected)).toBe('mastered-after-hint')
  })

  it('deduplicates matched causes and keeps them in corrected and abandoned records', () => {
    const caused = makeCausedSession('caused-session')
    let session = submitPracticeAnswer(caused.session, caused.wrong, 110)
    session = submitPracticeAnswer(session, caused.wrong, 120)
    expect(current(session).errorCauses).toEqual([{ id: 'test-cause', label: '测试错因' }])
    expect(session.records).toHaveLength(0)

    session = submitPracticeAnswer(session, current(session).question.standardAnswer, 130)
    expect(session.records).toHaveLength(1)
    expect(session.records[0].errorCauses).toEqual([{ id: 'test-cause', label: '测试错因' }])
    expect(parsePracticeSession(structuredClone(session))).toEqual(session)

    const abandonedCause = makeCausedSession('abandoned-cause')
    const incorrect = submitPracticeAnswer(abandonedCause.session, abandonedCause.wrong, 110)
    const abandoned = abandonPracticeSession(incorrect, 120)
    expect(abandoned.records[0]).toMatchObject({
      result: 'abandoned',
      errorCauses: [{ id: 'test-cause', label: '测试错因' }],
    })
  })

  it('shows level-two guidance after a second error and settles explanation correction for retest', () => {
    const initial = makeSession()
    let session = submitPracticeAnswer(initial, wrongAnswer(current(initial).question), 110)
    session = submitPracticeAnswer(session, wrongAnswer(current(session).question), 120)
    expect(current(session).status).toBe('needs-explanation')
    expect(current(session).feedback).toMatchObject({
      hintLevel: 2,
      revealedAnswer: current(session).question.standardAnswer,
    })
    expect(current(session).feedback?.explanationSteps.length).toBeGreaterThan(0)
    expect(session.records).toHaveLength(0)

    const original = current(session).question
    const beforeLength = session.questions.length
    session = submitPracticeAnswer(session, original.standardAnswer, 130, {
      seed: 900,
      idPrefix: 'session-1',
    })
    expect(current(session).status).toBe('corrected-awaiting-retest')
    expect(nextResult(session)).toBe('corrected-awaiting-retest')
    expect(session.questions).toHaveLength(beforeLength)
    const retestIndex = session.questions.findIndex(
      (entry) => entry.retestOfInstanceId === original.instanceId,
    )
    expect(retestIndex).toBeGreaterThanOrEqual(3)
    expect(retestIndex).toBeLessThanOrEqual(5)
    expect(session.questions[retestIndex].question.instanceId).not.toBe(original.instanceId)
    expect(session.questions[retestIndex].question.prompt).not.toBe(original.prompt)
    expect(session.questions[retestIndex].question.templateId).toBe(original.templateId)
  })

  it('rejects invalid navigation and keeps completed or abandoned groups read-only', () => {
    const initial = makeSession(2)
    expect(() => advancePracticeSession(initial, 110)).toThrow('尚未结算')
    let session = submitPracticeAnswer(initial, current(initial).question.standardAnswer, 110)
    session = advancePracticeSession(session, 120)
    expect(session.currentIndex).toBe(1)
    session = submitPracticeAnswer(session, current(session).question.standardAnswer, 130)
    session = advancePracticeSession(session, 140)
    expect(session.status).toBe('completed')
    expect(() => advancePracticeSession(session, 150)).toThrow('只读')
    expect(() => abandonPracticeSession(session, 150)).toThrow('只读')

    const abandoned = abandonPracticeSession(makeSession(3), 200)
    expect(abandoned.status).toBe('abandoned')
    expect(abandoned.records).toHaveLength(3)
    expect(abandoned.questions.every((entry) => entry.status === 'abandoned')).toBe(true)
    expect(
      abandoned.questions.every((entry) => !getPracticeOutcome(entry).effectiveCompletion),
    ).toBe(true)
    expect(() =>
      submitPracticeAnswer(abandoned, current(abandoned).question.standardAnswer, 210),
    ).toThrow('只读')
  })

  it('resumes at the next unsettled question and completes an all-settled restored group', () => {
    const initial = makeSession(2)
    const answered = submitPracticeAnswer(initial, current(initial).question.standardAnswer, 110)
    const resumed = resumePracticeSession(answered, 120)
    expect(resumed.currentIndex).toBe(1)
    expect(current(resumed).status).toBe('pending')
    const completed = {
      ...answered,
      questions: answered.questions.map((entry) => ({
        ...entry,
        status: 'abandoned' as const,
        settledAt: 110,
      })),
    }
    expect(resumePracticeSession(completed, 130).status).toBe('completed')
  })

  it('replaces an invalid current question without counting an error or increasing group size', () => {
    const initial = makeSession(3)
    const previous = current(initial)
    const replacement = generateMathQuestion('oral-mul-one-v1', 999, 'replacement', 'L1')
    const next = replacePracticeQuestion(initial, replacement, 110)
    expect(next.questions).toHaveLength(3)
    expect(next.records[0]).toMatchObject({
      questionInstanceId: previous.question.instanceId,
      result: 'content-error',
      attempts: 0,
    })
    expect(current(next)).toMatchObject({ status: 'pending', attempts: 0 })
    expect(current(next).question).toEqual(replacement)
    expect(getPracticeOutcome(current(next)).effectiveCompletion).toBe(false)
    expect(() => replacePracticeQuestion(next, replacement, 120)).toThrow('新的题目实例 ID')
  })

  it('restores correction feedback, revealed answers and quotient-preserving guidance', () => {
    let session = makeSession()
    session = submitPracticeAnswer(session, wrongAnswer(current(session).question), 110)
    expect(parsePracticeSession(structuredClone(session))).toEqual(session)
    session = submitPracticeAnswer(session, wrongAnswer(current(session).question), 120)
    expect(parsePracticeSession(structuredClone(session))).toEqual(session)

    const division = generateSpecialPaper({
      knowledgePointId: 'division-with-remainder',
      difficulty: 'L2',
      seed: 14,
      idPrefix: 'division-feedback',
      size: 1,
    })
    let divisionSession = createPracticeSession({
      id: 'division-feedback',
      mode: 'special',
      questions: division.questions,
      createdAt: 100,
    })
    const answer = current(divisionSession).question.standardAnswer
    if (answer.kind !== 'quotient-remainder') throw new Error('需要商余数题')
    divisionSession = submitPracticeAnswer(
      divisionSession,
      { kind: 'quotient-remainder', quotient: answer.quotient, remainder: answer.remainder + 1 },
      110,
    )
    expect(current(divisionSession).feedback?.preservedQuotient).toBe(answer.quotient)
    expect(parsePracticeSession(structuredClone(divisionSession))).toEqual(divisionSession)
  })

  it('validates persisted session shape', () => {
    const session = makeSession()
    expect(parsePracticeSession(structuredClone(session))).toEqual(session)
    const legacy = structuredClone(session)
    for (const entry of legacy.questions) delete entry.errorCauses
    expect(parsePracticeSession(legacy)).toEqual(legacy)
    const invalidCases: Array<[string, unknown, string]> = [
      ['root', null, '必须是对象'],
      ['blank id', { ...session, id: ' ' }, '不能为空'],
      ['mode', { ...session, mode: 'other' }, '练习类型无效'],
      ['status', { ...session, status: 'other' }, '练习组状态无效'],
      ['created time', { ...session, createdAt: -1 }, '安全整数'],
      ['updated time', { ...session, updatedAt: 1.5 }, '安全整数'],
      ['empty questions', { ...session, questions: [] }, '非空数组'],
      ['current index', { ...session, currentIndex: 99 }, '越界'],
      ['records', { ...session, records: {} }, '记录必须是数组'],
      [
        'attempts',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, attempts: -1 } : entry,
          ),
        },
        '安全整数',
      ],
      [
        'error causes',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, errorCauses: [{ id: 'cause' }] } : entry,
          ),
        },
        'label',
      ],
      [
        'hint level',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, highestHintLevel: 3 } : entry,
          ),
        },
        '提示等级无效',
      ],
      [
        'explanation flag',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, explanationViewed: 'yes' } : entry,
          ),
        },
        '讲解查看状态无效',
      ],
      [
        'started time',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, startedAt: -1 } : entry,
          ),
        },
        '安全整数',
      ],
      [
        'settled time',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, status: 'first-correct' } : entry,
          ),
        },
        '缺少结算时间',
      ],
      [
        'early settled time',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, settledAt: 110 } : entry,
          ),
        },
        '不能有结算时间',
      ],
      [
        'retest source',
        {
          ...session,
          questions: session.questions.map((entry, index) =>
            index === 0 ? { ...entry, retestOfInstanceId: '' } : entry,
          ),
        },
        '不能为空',
      ],
      [
        'duplicate instances',
        { ...session, questions: [session.questions[0], session.questions[0]] },
        '不能重复',
      ],
    ]
    for (const [, value, message] of invalidCases) {
      expect(() => parsePracticeSession(value)).toThrow(message)
    }
    const incorrect = submitPracticeAnswer(session, wrongAnswer(current(session).question), 110)
    expect(() =>
      parsePracticeSession({
        ...incorrect,
        questions: incorrect.questions.map((entry, index) =>
          index === 0 ? { ...entry, feedback: { ...entry.feedback, hintLevel: 3 } } : entry,
        ),
      }),
    ).toThrow('提示等级无效')
  })
})

function nextResult(session: PracticeSession) {
  return session.records.at(-1)?.result
}
