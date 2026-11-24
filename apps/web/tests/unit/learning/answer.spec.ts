import { describe, expect, it } from 'vitest'
import {
  ANSWER_JUDGES,
  judgeAnswer,
  parseEnglishSpellingAnswer,
  parseFillBlanksAnswer,
  parseFractionAnswer,
  parseNumberAnswer,
  parseQuotientRemainderAnswer,
  parseSentenceCompletionAnswer,
  parseSingleChoiceAnswer,
  parseWordProblemAnswer,
} from '../../../src/learning/practice/answer'
import { createCorrectionGuidance } from '../../../src/learning/practice/correction'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import { QUESTION_TYPES, type Answer } from '../../../src/learning/types'
import { buildChoiceFixture, buildQuestionFixture } from '../../helpers/question-fixtures'

describe('answer input parsing', () => {
  it('trims non-negative integer input and accepts leading zeroes', () => {
    expect(parseNumberAnswer('  042\n')).toEqual({
      ok: true,
      answer: { kind: 'number', value: 42 },
    })
    expect(parseNumberAnswer('0')).toEqual({ ok: true, answer: { kind: 'number', value: 0 } })
  })

  it.each(['-1', '+1', '1.0', '1e2', '1余2', 'abc', '１２', '9007199254740992'])(
    'rejects invalid numeric input: %s',
    (input) => {
      expect(parseNumberAnswer(input)).toEqual({ ok: false, field: 'answer', reason: 'invalid' })
    },
  )

  it('rejects empty numeric, quotient and remainder fields independently', () => {
    expect(parseNumberAnswer('  ')).toEqual({ ok: false, field: 'answer', reason: 'empty' })
    expect(parseQuotientRemainderAnswer({ quotient: '', remainder: '2' })).toEqual({
      ok: false,
      field: 'quotient',
      reason: 'empty',
    })
    expect(parseQuotientRemainderAnswer({ quotient: '3', remainder: 'x' })).toEqual({
      ok: false,
      field: 'remainder',
      reason: 'invalid',
    })
    expect(parseQuotientRemainderAnswer({ quotient: ' 3 ', remainder: ' 2 ' })).toEqual({
      ok: true,
      answer: { kind: 'quotient-remainder', quotient: 3, remainder: 2 },
    })
  })
})

describe('answer judgement', () => {
  it('accepts configured numeric answers and matches a specific error cause', () => {
    const question = generateMathQuestion('written-mul-three-v1', 42, 'judgement')
    expect(judgeAnswer(question, question.standardAnswer)).toMatchObject({
      correct: true,
      message: '回答正确',
    })
    const cause = question.errorCauseRules[0]
    expect(judgeAnswer(question, cause.answers[0])).toMatchObject({
      correct: false,
      cause: { id: cause.id },
    })
  })

  it('judges quotient and remainder independently and preserves a correct quotient', () => {
    const question = generateMathQuestion('remainder-div-v1', 42, 'judgement')
    const standard = question.standardAnswer
    if (standard.kind !== 'quotient-remainder') throw new Error('expected division question')
    const wrongRemainder: Answer = {
      kind: 'quotient-remainder',
      quotient: standard.quotient,
      remainder: standard.remainder + 1,
    }
    expect(judgeAnswer(question, wrongRemainder)).toMatchObject({
      correct: false,
      quotientCorrect: true,
      remainderCorrect: false,
      message: '商正确，再检查余数',
    })
    expect(
      judgeAnswer(question, {
        kind: 'quotient-remainder',
        quotient: standard.quotient + 1,
        remainder: standard.remainder,
      }),
    ).toMatchObject({
      quotientCorrect: false,
      remainderCorrect: true,
      message: '余数正确，再检查商',
    })
    expect(
      judgeAnswer(question, {
        kind: 'quotient-remainder',
        quotient: standard.quotient + 1,
        remainder: standard.remainder + 1,
      }),
    ).toMatchObject({ quotientCorrect: false, remainderCorrect: false, message: '再检查商和余数' })
  })

  it('rejects mismatched answer and snapshot types', () => {
    const question = generateMathQuestion('oral-mul-one-v1', 2, 'judgement')
    expect(() =>
      judgeAnswer(question, { kind: 'quotient-remainder', quotient: 1, remainder: 0 }),
    ).toThrow('答案类型与题型不一致')
  })
})

describe('correction guidance', () => {
  it('uses error-specific level-one feedback without revealing the answer', () => {
    const question = generateMathQuestion('written-mul-three-v1', 42, 'correction')
    const cause = question.errorCauseRules[0]
    const judgement = judgeAnswer(question, cause.answers[0])
    const first = createCorrectionGuidance(question, judgement, 1)
    expect(first).toEqual({
      hintLevel: 1,
      message: '答案还不正确，请根据提示检查',
      hint: cause.feedback,
      explanationSteps: [],
      revealedAnswer: undefined,
      preservedQuotient: undefined,
    })
    expect(first.hint).not.toContain('34000')
  })

  it('shows level-two guidance, complete steps and the answer after a second error', () => {
    const question = generateMathQuestion('written-mul-three-v1', 42, 'correction')
    const judgement = judgeAnswer(question, { kind: 'number', value: 1 })
    const second = createCorrectionGuidance(question, judgement, 2)
    expect(second.hintLevel).toBe(2)
    expect(second.hint).toContain(question.hints.level2)
    expect(second.explanationSteps).toEqual(question.explanationSteps)
    expect(second.revealedAnswer).toEqual(question.standardAnswer)
    expect(createCorrectionGuidance(question, judgement, 3).hintLevel).toBe(2)
  })

  it('only asks for remainder correction and preserves the quotient when it is correct', () => {
    const question = generateMathQuestion('remainder-div-v1', 42, 'correction')
    const rule = question.errorCauseRules.find((item) => item.id === 'remainder-not-smaller')
    expect(rule).toBeDefined()
    const judgement = judgeAnswer(question, rule!.answers[0])
    const guidance = createCorrectionGuidance(question, judgement, 1)
    expect(guidance.message).toBe('商正确，再检查余数')
    expect(guidance.hint).toBe(rule!.feedback)
    expect(guidance.preservedQuotient).toBe(
      judgement.answer.kind === 'quotient-remainder' ? judgement.answer.quotient : undefined,
    )

    const generic = judgeAnswer(question, {
      kind: 'quotient-remainder',
      quotient: judgement.answer.kind === 'quotient-remainder' ? judgement.answer.quotient : 0,
      remainder: 0,
    })
    const genericGuidance = createCorrectionGuidance(question, generic, 1)
    expect(genericGuidance.hint).toContain('只检查余数')
    const second = createCorrectionGuidance(question, generic, 2)
    expect(second.hintLevel).toBe(2)
    expect(second.hint).toContain('只检查余数')
    expect(second.explanationSteps).toEqual(question.explanationSteps)
    expect(second.preservedQuotient).toBe(genericGuidance.preservedQuotient)
  })

  it('rejects guidance for correct answers and invalid attempt counts', () => {
    const question = generateMathQuestion('oral-mul-one-v1', 2, 'correction')
    const correct = judgeAnswer(question, question.standardAnswer)
    expect(() => createCorrectionGuidance(question, correct, 1)).toThrow('不需要订正提示')
    const wrong = judgeAnswer(question, { kind: 'number', value: 0 })
    expect(() => createCorrectionGuidance(question, wrong, 0)).toThrow('错误提交次数')
  })
})

describe('judge registry', () => {
  it('registers a pure judge for every question type', () => {
    expect(Object.keys(ANSWER_JUDGES).sort()).toEqual([...QUESTION_TYPES].sort())
  })
})

describe('decimal and signed number answers', () => {
  it('parses decimals and negatives only when the question allows them', () => {
    expect(parseNumberAnswer(' 3.50 ', { allowDecimal: true })).toEqual({
      ok: true,
      answer: { kind: 'number', value: 3.5 },
    })
    expect(parseNumberAnswer('-2.5', { allowNegative: true, allowDecimal: true })).toEqual({
      ok: true,
      answer: { kind: 'number', value: -2.5 },
    })
    expect(parseNumberAnswer('-2', {})).toEqual({ ok: false, field: 'answer', reason: 'invalid' })
    expect(parseNumberAnswer('1.5', {})).toEqual({ ok: false, field: 'answer', reason: 'invalid' })
    expect(parseNumberAnswer('1.5', { allowNegative: true })).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
  })

  it('enforces declared decimal places and rejects precision beyond safe decimals', () => {
    expect(parseNumberAnswer('3.141', { allowDecimal: true, decimalPlaces: 2 })).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
    expect(parseNumberAnswer('3.14', { allowDecimal: true, decimalPlaces: 2 }).ok).toBe(true)
    expect(parseNumberAnswer('3.1', { allowDecimal: true, decimalPlaces: 2 }).ok).toBe(true)
    expect(parseNumberAnswer('0.1234567890123456', { allowDecimal: true })).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
  })

  it('compares decimals exactly without binary floating point误判', () => {
    const question = buildQuestionFixture({
      standardAnswer: { kind: 'number', value: 0.3 },
      acceptedAnswerRule: { kind: 'number', values: [0.3], allowDecimal: true, decimalPlaces: 2 },
      courseId: 'pep-grade4-spring-math',
    })
    expect(judgeAnswer(question, { kind: 'number', value: 0.3 }).correct).toBe(true)
    expect(judgeAnswer(question, { kind: 'number', value: 0.1 + 0.2 }).correct).toBe(false)
    const parsed = parseNumberAnswer('0.30', { allowDecimal: true, decimalPlaces: 2 })
    expect(parsed.ok && judgeAnswer(question, parsed.answer).correct).toBe(true)
  })
})

describe('fill-blanks answers', () => {
  const question = buildQuestionFixture({
    standardAnswer: { kind: 'fill-blanks', values: ['交换', '结合'] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [['交换'], ['结合', '结合律']],
      trimWhitespace: true,
    },
    errorCauseRules: [
      {
        id: 'law-confused',
        label: '运算定律混淆',
        feedback: '先回顾每种运算定律改变的是顺序还是分组',
        answers: [{ kind: 'fill-blanks', values: ['结合', '交换'] }],
      },
    ],
  })

  it('blocks empty blanks per field without counting an attempt', () => {
    expect(parseFillBlanksAnswer(['交换', ' ', ''], 3)).toEqual({
      ok: false,
      field: 'blank-1',
      reason: 'empty',
    })
    expect(parseFillBlanksAnswer(['交换'], 2)).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
    expect(parseFillBlanksAnswer([' 交换 ', '结合'], 2)).toEqual({
      ok: true,
      answer: { kind: 'fill-blanks', values: [' 交换 ', '结合'] },
    })
  })

  it('judges each blank independently and keeps other correct inputs', () => {
    const judgement = judgeAnswer(question, { kind: 'fill-blanks', values: ['交换', '分配'] })
    expect(judgement).toMatchObject({
      correct: false,
      blankResults: [true, false],
      message: '第 2 空还需要检查',
    })
    expect(judgeAnswer(question, { kind: 'fill-blanks', values: ['交换', '结合律'] }).correct).toBe(
      true,
    )
    const guidance = createCorrectionGuidance(question, judgement, 1)
    expect(guidance.correctBlanks).toEqual([0])
  })

  it('matches error causes with the same normalization and rejects wrong blank counts', () => {
    const judgement = judgeAnswer(question, { kind: 'fill-blanks', values: ['结合', '交换'] })
    expect(judgement.cause?.id).toBe('law-confused')
    expect(() => judgeAnswer(question, { kind: 'fill-blanks', values: ['交换'] })).toThrow(
      '填空数量与题目不一致',
    )
  })
})

describe('single-choice answers', () => {
  const question = buildChoiceFixture()

  it('requires a selected and existing option before submission', () => {
    const ids = question.options!.map((option) => option.id)
    expect(parseSingleChoiceAnswer('  ', ids)).toEqual({
      ok: false,
      field: 'answer',
      reason: 'empty',
    })
    expect(parseSingleChoiceAnswer('opt-x', ids)).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
    expect(parseSingleChoiceAnswer(' opt-b ', ids)).toEqual({
      ok: true,
      answer: { kind: 'single-choice', optionId: 'opt-b' },
    })
  })

  it('judges the configured best option and rejects unknown option references', () => {
    expect(judgeAnswer(question, { kind: 'single-choice', optionId: 'opt-b' }).correct).toBe(true)
    expect(judgeAnswer(question, { kind: 'single-choice', optionId: 'opt-a' })).toMatchObject({
      correct: false,
      message: '选项还不正确，请根据提示检查',
    })
    expect(() => judgeAnswer(question, { kind: 'single-choice', optionId: 'opt-x' })).toThrow(
      '选项不存在',
    )
  })
})

describe('word-problem answers', () => {
  const question = buildQuestionFixture({
    standardAnswer: { kind: 'word-problem', value: 12, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: 12, unit: '元' }],
      unitRequired: true,
    },
  })

  it('requires the unit when declared and parses decimal quantities', () => {
    const unitRule = { values: [{ value: 12, unit: '元' }], unitRequired: true }
    expect(parseWordProblemAnswer({ value: '12', unit: ' ' }, unitRule)).toEqual({
      ok: false,
      field: 'unit',
      reason: 'empty',
    })
    expect(parseWordProblemAnswer({ value: '12', unit: '元' }, unitRule)).toEqual({
      ok: true,
      answer: { kind: 'word-problem', value: 12, unit: '元' },
    })
    const decimalRule = {
      values: [{ value: 3.5, unit: '米' }],
      unitRequired: true,
      decimalPlaces: 1,
    }
    expect(parseWordProblemAnswer({ value: '3.50', unit: '米' }, decimalRule).ok).toBe(true)
    expect(parseWordProblemAnswer({ value: '3.55', unit: '米' }, decimalRule)).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
  })

  it('judges quantity and unit together and preserves the correct part', () => {
    expect(judgeAnswer(question, { kind: 'word-problem', value: 12, unit: '元' }).correct).toBe(
      true,
    )
    const wrongUnit = judgeAnswer(question, { kind: 'word-problem', value: 12, unit: '角' })
    expect(wrongUnit).toMatchObject({
      correct: false,
      valueCorrect: true,
      unitCorrect: false,
      message: '数量正确，再检查单位',
    })
    const wrongValue = judgeAnswer(question, { kind: 'word-problem', value: 11, unit: '元' })
    expect(wrongValue).toMatchObject({
      valueCorrect: false,
      unitCorrect: true,
      message: '单位正确，再检查数量',
    })
    expect(judgeAnswer(question, { kind: 'word-problem', value: 11, unit: '角' }).message).toBe(
      '再检查数量和单位',
    )

    const guidance = createCorrectionGuidance(question, wrongUnit, 1)
    expect(guidance.hint).toContain('只检查单位')
    expect(guidance.preservedValue).toBe(12)
    expect(createCorrectionGuidance(question, wrongUnit, 2).hint).toContain('只检查单位：')
    const unitKept = createCorrectionGuidance(question, wrongValue, 1)
    expect(unitKept.preservedUnit).toBe('元')
  })
})

describe('fraction answers', () => {
  const simplest = buildQuestionFixture({
    standardAnswer: { kind: 'fraction', numerator: 1, denominator: 2 },
    acceptedAnswerRule: {
      kind: 'fraction',
      values: [{ numerator: 1, denominator: 2 }],
      requireSimplest: true,
    },
    courseId: 'pep-grade5-autumn-math',
  })
  const equivalent = buildQuestionFixture({
    instanceId: 'fraction-equivalent',
    standardAnswer: { kind: 'fraction', numerator: 1, denominator: 3 },
    acceptedAnswerRule: {
      kind: 'fraction',
      values: [{ numerator: 1, denominator: 3 }],
      requireSimplest: false,
    },
    courseId: 'pep-grade5-autumn-math',
  })

  it('parses numerator and denominator separately and blocks zero denominators', () => {
    expect(parseFractionAnswer({ numerator: '3', denominator: '0' })).toEqual({
      ok: false,
      field: 'denominator',
      reason: 'zero-denominator',
    })
    expect(parseFractionAnswer({ numerator: '', denominator: '4' })).toEqual({
      ok: false,
      field: 'numerator',
      reason: 'empty',
    })
    expect(parseFractionAnswer({ numerator: 'x', denominator: '4' })).toEqual({
      ok: false,
      field: 'numerator',
      reason: 'invalid',
    })
    expect(parseFractionAnswer({ numerator: '3', denominator: '-4' })).toEqual({
      ok: false,
      field: 'denominator',
      reason: 'invalid',
    })
    expect(parseFractionAnswer({ numerator: '-3', denominator: '4' })).toEqual({
      ok: true,
      answer: { kind: 'fraction', numerator: -3, denominator: 4 },
    })
  })

  it('uses exact rational equivalence and enforces simplest form only when declared', () => {
    expect(
      judgeAnswer(equivalent, { kind: 'fraction', numerator: 2, denominator: 6 }).correct,
    ).toBe(true)
    const notSimplest = judgeAnswer(simplest, { kind: 'fraction', numerator: 2, denominator: 4 })
    expect(notSimplest).toMatchObject({
      correct: false,
      simplestNeeded: true,
      message: '数值正确，请把分数化成最简形式',
    })
    expect(judgeAnswer(simplest, { kind: 'fraction', numerator: 1, denominator: 2 }).correct).toBe(
      true,
    )
    expect(judgeAnswer(simplest, { kind: 'fraction', numerator: 1, denominator: 3 }).correct).toBe(
      false,
    )
    expect(() => judgeAnswer(simplest, { kind: 'fraction', numerator: 1, denominator: 0 })).toThrow(
      '分母不能为 0',
    )
  })

  it('gives a simplest-form hint without revealing the answer at level one', () => {
    const judgement = judgeAnswer(simplest, { kind: 'fraction', numerator: 2, denominator: 4 })
    const first = createCorrectionGuidance(simplest, judgement, 1)
    expect(first.hintLevel).toBe(1)
    expect(first.hint).toContain('最简分数')
    expect(first.revealedAnswer).toBeUndefined()
    const second = createCorrectionGuidance(simplest, judgement, 2)
    expect(second.hintLevel).toBe(2)
    expect(second.revealedAnswer).toEqual(simplest.standardAnswer)
  })
})

describe('english spelling answers', () => {
  const question = buildQuestionFixture({
    standardAnswer: { kind: 'english-spelling', value: 'library' },
    acceptedAnswerRule: {
      kind: 'english-spelling',
      values: ['library', 'library '],
      caseSensitive: false,
    },
    prompt: '拼写单词：图书馆',
  })

  it('trims input and rejects empty or non-english characters', () => {
    expect(parseEnglishSpellingAnswer('  library ')).toEqual({
      ok: true,
      answer: { kind: 'english-spelling', value: 'library' },
    })
    expect(parseEnglishSpellingAnswer('   ')).toEqual({
      ok: false,
      field: 'answer',
      reason: 'empty',
    })
    expect(parseEnglishSpellingAnswer('图书馆')).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
    expect(parseEnglishSpellingAnswer('abc1')).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
    expect(parseEnglishSpellingAnswer("don't").ok).toBe(true)
  })

  it('is case-insensitive for ordinary words and case-sensitive only when declared', () => {
    expect(judgeAnswer(question, { kind: 'english-spelling', value: 'Library' }).correct).toBe(true)
    const proper = buildQuestionFixture({
      instanceId: 'spelling-proper',
      standardAnswer: { kind: 'english-spelling', value: 'Monday' },
      acceptedAnswerRule: {
        kind: 'english-spelling',
        values: ['Monday'],
        caseSensitive: true,
      },
    })
    expect(judgeAnswer(proper, { kind: 'english-spelling', value: 'monday' })).toMatchObject({
      correct: false,
      message: '拼写还不正确，请根据提示检查',
    })
    expect(judgeAnswer(proper, { kind: 'english-spelling', value: 'Monday' }).correct).toBe(true)
  })
})

describe('sentence completion answers', () => {
  const question = buildQuestionFixture({
    standardAnswer: { kind: 'sentence-completion', values: ["It's time for school"] },
    acceptedAnswerRule: {
      kind: 'sentence-completion',
      values: [["It's time for school"]],
      caseSensitive: false,
      ignoreTerminalPunctuation: true,
    },
    prompt: '补全句子：该上学了。',
  })

  it('normalizes spaces, curly apostrophes, case and terminal punctuation', () => {
    expect(
      judgeAnswer(question, {
        kind: 'sentence-completion',
        values: ['  it’s  time for school.  '],
      }).correct,
    ).toBe(true)
    expect(
      judgeAnswer(question, { kind: 'sentence-completion', values: ["It's time for school!"] })
        .correct,
    ).toBe(true)
  })

  it('keeps case and punctuation as error points when the question declares them', () => {
    const strict = buildQuestionFixture({
      instanceId: 'cloze-strict',
      standardAnswer: { kind: 'sentence-completion', values: ['Monday'] },
      acceptedAnswerRule: {
        kind: 'sentence-completion',
        values: [['Monday']],
        caseSensitive: true,
        ignoreTerminalPunctuation: false,
      },
    })
    expect(judgeAnswer(strict, { kind: 'sentence-completion', values: ['monday'] }).correct).toBe(
      false,
    )
    expect(judgeAnswer(strict, { kind: 'sentence-completion', values: ['Monday.'] }).correct).toBe(
      false,
    )
    expect(judgeAnswer(strict, { kind: 'sentence-completion', values: ['Monday'] }).correct).toBe(
      true,
    )
  })

  it('only accepts pre-configured alternative answers and judges blanks independently', () => {
    const alternatives = buildQuestionFixture({
      instanceId: 'cloze-alt',
      standardAnswer: { kind: 'sentence-completion', values: ['color'] },
      acceptedAnswerRule: {
        kind: 'sentence-completion',
        values: [['color', 'colour']],
        caseSensitive: false,
        ignoreTerminalPunctuation: true,
      },
    })
    expect(
      judgeAnswer(alternatives, { kind: 'sentence-completion', values: ['colour'] }).correct,
    ).toBe(true)
    expect(
      judgeAnswer(alternatives, { kind: 'sentence-completion', values: ['colors'] }).correct,
    ).toBe(false)
    expect(parseSentenceCompletionAnswer(['a', ''], 2)).toEqual({
      ok: false,
      field: 'blank-1',
      reason: 'empty',
    })
    const twoBlanks = buildQuestionFixture({
      instanceId: 'cloze-two',
      standardAnswer: { kind: 'sentence-completion', values: ['is', 'are'] },
      acceptedAnswerRule: {
        kind: 'sentence-completion',
        values: [['is'], ['are']],
        caseSensitive: false,
        ignoreTerminalPunctuation: true,
      },
    })
    expect(
      judgeAnswer(twoBlanks, { kind: 'sentence-completion', values: ['is', 'is'] }),
    ).toMatchObject({ blankResults: [true, false], message: '第 2 空还需要检查' })
  })

  it('parses completed blanks and rejects mismatched counts', () => {
    expect(parseSentenceCompletionAnswer([' am ', 'is'], 2)).toEqual({
      ok: true,
      answer: { kind: 'sentence-completion', values: [' am ', 'is'] },
    })
    expect(parseSentenceCompletionAnswer(['am'], 2)).toEqual({
      ok: false,
      field: 'answer',
      reason: 'invalid',
    })
  })
})

describe('error cause matching across answer types', () => {
  it('matches choice causes by option id', () => {
    const question = buildChoiceFixture({
      errorCauseRules: [
        {
          id: 'confuse-law',
          label: '混淆运算定律',
          feedback: '交换律改变的是因数顺序',
          answers: [{ kind: 'single-choice', optionId: 'opt-a' }],
        },
      ],
    })
    expect(judgeAnswer(question, { kind: 'single-choice', optionId: 'opt-a' }).cause?.id).toBe(
      'confuse-law',
    )
    expect(
      judgeAnswer(question, { kind: 'single-choice', optionId: 'opt-c' }).cause,
    ).toBeUndefined()
  })

  it('matches word-problem causes with exact quantity and unit', () => {
    const question = buildQuestionFixture({
      standardAnswer: { kind: 'word-problem', value: 12, unit: '元' },
      acceptedAnswerRule: {
        kind: 'word-problem',
        values: [{ value: 12, unit: '元' }],
        unitRequired: true,
      },
      errorCauseRules: [
        {
          id: 'wrong-operation',
          label: '用错运算',
          feedback: '求总价用乘法，不是加法',
          answers: [{ kind: 'word-problem', value: 11, unit: '元' }],
        },
      ],
    })
    expect(judgeAnswer(question, { kind: 'word-problem', value: 11, unit: '元' }).cause?.id).toBe(
      'wrong-operation',
    )
    expect(
      judgeAnswer(question, { kind: 'word-problem', value: 11, unit: '角' }).cause,
    ).toBeUndefined()
  })

  it('matches fraction causes by rational equivalence', () => {
    const question = buildQuestionFixture({
      courseId: 'pep-grade5-autumn-math',
      standardAnswer: { kind: 'fraction', numerator: 1, denominator: 2 },
      acceptedAnswerRule: {
        kind: 'fraction',
        values: [{ numerator: 1, denominator: 2 }],
        requireSimplest: false,
      },
      errorCauseRules: [
        {
          id: 'half-third',
          label: '半分混淆',
          feedback: '平均分成 2 份取 1 份是二分之一',
          answers: [{ kind: 'fraction', numerator: 2, denominator: 6 }],
        },
      ],
    })
    expect(
      judgeAnswer(question, { kind: 'fraction', numerator: 1, denominator: 3 }).cause?.id,
    ).toBe('half-third')
  })

  it('matches english causes with the declared normalization', () => {
    const spelling = buildQuestionFixture({
      standardAnswer: { kind: 'english-spelling', value: 'library' },
      acceptedAnswerRule: { kind: 'english-spelling', values: ['library'], caseSensitive: false },
      errorCauseRules: [
        {
          id: 'missing-r',
          label: '漏写字母',
          feedback: '注意中间还有一个 r',
          answers: [{ kind: 'english-spelling', value: 'Libary' }],
        },
      ],
    })
    expect(judgeAnswer(spelling, { kind: 'english-spelling', value: 'libary' }).cause?.id).toBe(
      'missing-r',
    )

    const cloze = buildQuestionFixture({
      standardAnswer: { kind: 'sentence-completion', values: ['is'] },
      acceptedAnswerRule: {
        kind: 'sentence-completion',
        values: [['is']],
        caseSensitive: false,
        ignoreTerminalPunctuation: true,
      },
      errorCauseRules: [
        {
          id: 'be-verb',
          label: 'be 动词误用',
          feedback: '主语是单数，用 is',
          answers: [{ kind: 'sentence-completion', values: ['Are.'] }],
        },
      ],
    })
    expect(judgeAnswer(cloze, { kind: 'sentence-completion', values: ['are'] }).cause?.id).toBe(
      'be-verb',
    )
  })
})
