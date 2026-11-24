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
import { registerVariantGenerator } from '../../../src/learning/practice/question-variants'
import type { Answer, QuestionSnapshot } from '../../../src/learning/types'
import { buildChoiceFixture, buildQuestionFixture } from '../../helpers/question-fixtures'

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

const CHOICE_TEMPLATE_ID = 'session-choice-v1'
registerVariantGenerator(CHOICE_TEMPLATE_ID, (original, seed, instanceId) =>
  buildChoiceFixture({
    templateId: original.templateId,
    instanceId,
    seed,
    prompt: `新情境 ${seed}：下面关于乘法交换律的说法，哪一个是正确的？`,
  }),
)

function makeChoiceSession(size = 6, id = 'choice-session'): PracticeSession {
  const questions = Array.from({ length: size }, (_, index) => ({
    question: buildChoiceFixture({
      templateId: CHOICE_TEMPLATE_ID,
      instanceId: `${id}-q${index}`,
      seed: 100 + index,
    }),
  }))
  return createPracticeSession({ id, mode: 'special', questions, createdAt: 100 })
}

describe('single-choice variant correction flow', () => {
  it('settles a first-correct choice without any variant', () => {
    const initial = makeChoiceSession(1)
    const next = submitPracticeAnswer(initial, { kind: 'single-choice', optionId: 'opt-b' }, 110)
    expect(current(next).status).toBe('first-correct')
    expect(current(next).question.variantOf).toBeUndefined()
    expect(next.records[0]).toMatchObject({
      questionType: 'single-choice',
      result: 'first-correct',
    })
  })

  it('requires variant scheduling and replaces the original question in place on first error', () => {
    const initial = makeChoiceSession()
    const original = current(initial).question
    expect(() =>
      submitPracticeAnswer(initial, { kind: 'single-choice', optionId: 'opt-a' }, 110),
    ).toThrow('选择题订正需要变式题支持')
    expect(current(initial).status).toBe('pending')

    const next = submitPracticeAnswer(
      initial,
      { kind: 'single-choice', optionId: 'opt-a' },
      110,
      undefined,
      {
        seed: 500,
        idPrefix: 'choice-session',
      },
    )
    const entry = current(next)
    expect(entry.status).toBe('awaiting-correction')
    expect(entry.attempts).toBe(1)
    expect(next.questions).toHaveLength(initial.questions.length)
    expect(entry.question.instanceId).toBe(`choice-session-variant-${original.instanceId}`)
    expect(entry.question.prompt).not.toBe(original.prompt)
    expect(entry.question.variantOf).toEqual({
      templateId: original.templateId,
      instanceId: original.instanceId,
    })
    expect(entry.feedback?.hintLevel).toBe(1)
    expect(entry.feedback?.revealedAnswer).toBeUndefined()
    expect(next.records).toHaveLength(0)
    expect(parsePracticeSession(structuredClone(next))).toEqual(next)
  })

  it('corrects on the variant for mastered-after-hint and never returns to the original options', () => {
    let session = makeChoiceSession()
    session = submitPracticeAnswer(
      session,
      { kind: 'single-choice', optionId: 'opt-a' },
      110,
      undefined,
      {
        seed: 500,
        idPrefix: 'choice-session',
      },
    )
    const variant = current(session).question
    session = submitPracticeAnswer(session, { kind: 'single-choice', optionId: 'opt-b' }, 120)
    expect(current(session).status).toBe('mastered-after-hint')
    expect(current(session).question.instanceId).toBe(variant.instanceId)
    expect(session.records[0]).toMatchObject({
      questionInstanceId: variant.instanceId,
      result: 'mastered-after-hint',
      attempts: 2,
    })
  })

  it('reveals the variant answer after a second error and schedules a variant retest', () => {
    let session = makeChoiceSession()
    session = submitPracticeAnswer(
      session,
      { kind: 'single-choice', optionId: 'opt-a' },
      110,
      undefined,
      {
        seed: 500,
        idPrefix: 'choice-session',
      },
    )
    const variant = current(session).question
    session = submitPracticeAnswer(session, { kind: 'single-choice', optionId: 'opt-c' }, 120)
    expect(current(session).status).toBe('needs-explanation')
    expect(current(session).question.instanceId).toBe(variant.instanceId)
    expect(current(session).feedback?.revealedAnswer).toEqual(variant.standardAnswer)

    session = submitPracticeAnswer(session, { kind: 'single-choice', optionId: 'opt-b' }, 130, {
      seed: 900,
      idPrefix: 'choice-session',
    })
    expect(current(session).status).toBe('corrected-awaiting-retest')
    const retestIndex = session.questions.findIndex(
      (entry) => entry.retestOfInstanceId === variant.instanceId,
    )
    expect(retestIndex).toBeGreaterThanOrEqual(3)
    expect(retestIndex).toBeLessThanOrEqual(5)
    const retest = session.questions[retestIndex].question
    expect(retest.prompt).not.toBe(variant.prompt)
    expect(retest.variantOf?.instanceId).toBe(variant.instanceId)
    expect(parsePracticeSession(structuredClone(session))).toEqual(session)
  })
})

describe('record classification and all-type state machine', () => {
  const cases: Array<{
    name: string
    question: QuestionSnapshot
    wrong: Answer
    correct: Answer
    feedbackCheck?: (
      feedback: NonNullable<PracticeSession['questions'][number]['feedback']>,
    ) => void
  }> = [
    {
      name: 'fill-blanks',
      question: buildQuestionFixture({
        instanceId: 'type-fill-blanks',
        standardAnswer: { kind: 'fill-blanks', values: ['交换', '结合'] },
        acceptedAnswerRule: {
          kind: 'fill-blanks',
          values: [['交换'], ['结合']],
          trimWhitespace: true,
        },
      }),
      wrong: { kind: 'fill-blanks', values: ['交换', '分配'] },
      correct: { kind: 'fill-blanks', values: ['交换', '结合'] },
      feedbackCheck: (feedback) => expect(feedback.correctBlanks).toEqual([0]),
    },
    {
      name: 'word-problem',
      question: buildQuestionFixture({
        instanceId: 'type-word-problem',
        standardAnswer: { kind: 'word-problem', value: 12, unit: '元' },
        acceptedAnswerRule: {
          kind: 'word-problem',
          values: [{ value: 12, unit: '元' }],
          unitRequired: true,
        },
      }),
      wrong: { kind: 'word-problem', value: 12, unit: '角' },
      correct: { kind: 'word-problem', value: 12, unit: '元' },
      feedbackCheck: (feedback) => expect(feedback.preservedValue).toBe(12),
    },
    {
      name: 'fraction',
      question: buildQuestionFixture({
        instanceId: 'type-fraction',
        courseId: 'pep-grade5-autumn-math',
        standardAnswer: { kind: 'fraction', numerator: 1, denominator: 2 },
        acceptedAnswerRule: {
          kind: 'fraction',
          values: [{ numerator: 1, denominator: 2 }],
          requireSimplest: true,
        },
      }),
      wrong: { kind: 'fraction', numerator: 2, denominator: 4 },
      correct: { kind: 'fraction', numerator: 1, denominator: 2 },
      feedbackCheck: (feedback) => expect(feedback.hint).toContain('最大公因数'),
    },
    {
      name: 'english-spelling',
      question: buildQuestionFixture({
        instanceId: 'type-english-spelling',
        standardAnswer: { kind: 'english-spelling', value: 'apple' },
        acceptedAnswerRule: { kind: 'english-spelling', values: ['apple'], caseSensitive: false },
      }),
      wrong: { kind: 'english-spelling', value: 'aple' },
      correct: { kind: 'english-spelling', value: 'Apple' },
    },
    {
      name: 'sentence-completion',
      question: buildQuestionFixture({
        instanceId: 'type-sentence-completion',
        standardAnswer: { kind: 'sentence-completion', values: ['am', 'is'] },
        acceptedAnswerRule: {
          kind: 'sentence-completion',
          values: [['am'], ['is']],
          caseSensitive: false,
          ignoreTerminalPunctuation: true,
        },
      }),
      wrong: { kind: 'sentence-completion', values: ['am', 'are'] },
      correct: { kind: 'sentence-completion', values: ['am', 'is'] },
      feedbackCheck: (feedback) => expect(feedback.correctBlanks).toEqual([0]),
    },
  ]

  for (const item of cases) {
    it(`runs the correction flow and records classification for ${item.name}`, () => {
      const initial = createPracticeSession({
        id: `type-${item.name}`,
        mode: 'special',
        questions: [{ question: item.question }],
        createdAt: 100,
      })
      const incorrect = submitPracticeAnswer(initial, item.wrong, 110)
      expect(current(incorrect).status).toBe('awaiting-correction')
      expect(current(incorrect).lastAnswer).toEqual(item.wrong)
      if (item.feedbackCheck) item.feedbackCheck(current(incorrect).feedback!)
      expect(parsePracticeSession(structuredClone(incorrect))).toEqual(incorrect)

      const corrected = submitPracticeAnswer(incorrect, item.correct, 120)
      expect(current(corrected).status).toBe('mastered-after-hint')
      const classification = item.question.classification
      expect(corrected.records[0]).toMatchObject({
        questionType: item.name,
        courseId: classification.courseId,
        unitId: classification.unitId,
        knowledgePointId: classification.knowledgePointId,
        subject: classification.subject,
        grade: classification.grade,
        semester: classification.semester,
        ability: classification.ability,
        result: 'mastered-after-hint',
      })
      expect(getPracticeOutcome(current(corrected)).effectiveCompletion).toBe(true)

      const firstCorrect = submitPracticeAnswer(initial, item.correct, 130)
      expect(current(firstCorrect).status).toBe('first-correct')
      expect(firstCorrect.records[0].questionType).toBe(item.name)
    })
  }

  it('validates the extended feedback fields when restoring a session', () => {
    const wordProblem = cases.find((item) => item.name === 'word-problem')!
    let session = createPracticeSession({
      id: 'feedback-validation',
      mode: 'special',
      questions: [{ question: wordProblem.question }],
      createdAt: 100,
    })
    session = submitPracticeAnswer(session, wordProblem.wrong, 110)
    const withFeedback = (patch: Record<string, unknown>) => ({
      ...session,
      questions: session.questions.map((entry, index) =>
        index === 0 ? { ...entry, feedback: { ...entry.feedback, ...patch } } : entry,
      ),
    })
    expect(() => parsePracticeSession(withFeedback({ preservedValue: '12' }))).toThrow('有限数字')
    expect(() => parsePracticeSession(withFeedback({ preservedUnit: ' ' }))).toThrow('不能为空')
    expect(() => parsePracticeSession(withFeedback({ correctBlanks: '0' }))).toThrow('必须是数组')
    expect(() => parsePracticeSession(withFeedback({ correctBlanks: [0.5] }))).toThrow('安全整数')
    expect(parsePracticeSession(withFeedback({ correctBlanks: [0] }))).toBeTruthy()
  })
})

function nextResult(session: PracticeSession) {
  return session.records.at(-1)?.result
}
