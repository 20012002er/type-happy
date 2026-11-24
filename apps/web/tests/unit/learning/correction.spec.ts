import { describe, expect, it } from 'vitest'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import { createCorrectionGuidance } from '../../../src/learning/practice/correction'
import { buildQuestionFixture } from '../../helpers/question-fixtures'

const numberQuestion = buildQuestionFixture({
  standardAnswer: { kind: 'number', value: 24 },
  acceptedAnswerRule: { kind: 'number', values: [24] },
  hints: {
    level1: '先想一想乘法口诀里哪一句能得到这个积',
    level2: '先用口诀确定因数，再交换因数验算一遍',
  },
  explanationSteps: ['找出两个因数', '用乘法口诀求积', '交换因数验算'],
})

describe('correction guidance levels', () => {
  it('rejects correct judgements and invalid submission counts', () => {
    const correct = judgeAnswer(numberQuestion, { kind: 'number', value: 24 })
    expect(() => createCorrectionGuidance(numberQuestion, correct, 1)).toThrow(
      '正确答案不需要订正提示',
    )
    const wrong = judgeAnswer(numberQuestion, { kind: 'number', value: 25 })
    expect(() => createCorrectionGuidance(numberQuestion, wrong, 0)).toThrow('正整数')
    expect(() => createCorrectionGuidance(numberQuestion, wrong, 1.5)).toThrow('正整数')
  })

  it('keeps level one hint free of answers and explains key relations at level two', () => {
    const wrong = judgeAnswer(numberQuestion, { kind: 'number', value: 25 })
    const first = createCorrectionGuidance(numberQuestion, wrong, 1)
    expect(first).toMatchObject({
      hintLevel: 1,
      hint: '先想一想乘法口诀里哪一句能得到这个积',
      explanationSteps: [],
    })
    expect(first.revealedAnswer).toBeUndefined()
    expect(first.hint).not.toContain('24')

    const second = createCorrectionGuidance(numberQuestion, wrong, 2)
    expect(second).toMatchObject({
      hintLevel: 2,
      hint: '先用口诀确定因数，再交换因数验算一遍',
      explanationSteps: ['找出两个因数', '用乘法口诀求积', '交换因数验算'],
      revealedAnswer: { kind: 'number', value: 24 },
    })
    expect(createCorrectionGuidance(numberQuestion, wrong, 3).hintLevel).toBe(2)
  })

  it('prefers matched cause feedback and appends it to level two explanation', () => {
    const caused = buildQuestionFixture({
      standardAnswer: { kind: 'number', value: 24 },
      acceptedAnswerRule: { kind: 'number', values: [24] },
      errorCauseRules: [
        {
          id: '口诀混淆',
          label: '口诀混淆',
          feedback: '三八二十四，不是四六二十四',
          answers: [{ kind: 'number', value: 25 }],
        },
      ],
    })
    const wrong = judgeAnswer(caused, { kind: 'number', value: 25 })
    expect(createCorrectionGuidance(caused, wrong, 1).hint).toBe('三八二十四，不是四六二十四')
    expect(createCorrectionGuidance(caused, wrong, 2).hint).toBe(
      `${caused.hints.level2} 三八二十四，不是四六二十四`,
    )
  })
})

describe('word-problem correction guidance', () => {
  const question = buildQuestionFixture({
    standardAnswer: { kind: 'word-problem', value: 12, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: 12, unit: '元' }],
      unitRequired: true,
    },
    hints: {
      level1: '先找出单价和数量，再想一想求总价用什么方法',
      level2: '总价 = 单价 × 数量，算出结果后写上题目要求的单位“元”',
    },
    explanationSteps: ['找出单价和数量', '用乘法求总价', '检查结果并写上单位'],
  })

  it('explains conditions, quantity relation and unit at level two', () => {
    const wrong = judgeAnswer(question, { kind: 'word-problem', value: 11, unit: '角' })
    const first = createCorrectionGuidance(question, wrong, 1)
    expect(first.hint).toBe('先找出单价和数量，再想一想求总价用什么方法')
    expect(first.revealedAnswer).toBeUndefined()
    const second = createCorrectionGuidance(question, wrong, 2)
    expect(second.hint).toContain('总价 = 单价 × 数量')
    expect(second.hint).toContain('单位')
    expect(second.explanationSteps).toEqual([
      '找出单价和数量',
      '用乘法求总价',
      '检查结果并写上单位',
    ])
    expect(second.revealedAnswer).toEqual({ kind: 'word-problem', value: 12, unit: '元' })
  })

  it('preserves the correct quantity when only the unit is wrong', () => {
    const wrongUnit = judgeAnswer(question, { kind: 'word-problem', value: 12, unit: '角' })
    const first = createCorrectionGuidance(question, wrongUnit, 1)
    expect(first).toMatchObject({
      message: '数量正确，再检查单位',
      hint: '只检查单位是否与题目要求一致',
      preservedValue: 12,
    })
    expect(first.preservedUnit).toBeUndefined()
    const second = createCorrectionGuidance(question, wrongUnit, 2)
    expect(second.hint).toContain('只检查单位：')
    expect(second.preservedValue).toBe(12)
    expect(second.revealedAnswer).toEqual({ kind: 'word-problem', value: 12, unit: '元' })
  })

  it('preserves the correct unit when only the quantity is wrong', () => {
    const wrongValue = judgeAnswer(question, { kind: 'word-problem', value: 11, unit: '元' })
    const first = createCorrectionGuidance(question, wrongValue, 1)
    expect(first).toMatchObject({
      message: '单位正确，再检查数量',
      preservedUnit: '元',
    })
    expect(first.preservedValue).toBeUndefined()
    expect(first.hint).toBe(question.hints.level1)
  })
})

describe('fraction and multi-blank correction guidance', () => {
  const fractionQuestion = buildQuestionFixture({
    standardAnswer: { kind: 'fraction', numerator: 1, denominator: 2 },
    acceptedAnswerRule: {
      kind: 'fraction',
      values: [{ numerator: 1, denominator: 2 }],
      requireSimplest: true,
    },
    courseId: 'pep-grade5-autumn-math',
  })

  it('guides simplest form without revealing the answer at level one', () => {
    const notSimplest = judgeAnswer(fractionQuestion, {
      kind: 'fraction',
      numerator: 2,
      denominator: 4,
    })
    const first = createCorrectionGuidance(fractionQuestion, notSimplest, 1)
    expect(first.hint).toContain('最大公因数')
    expect(first.revealedAnswer).toBeUndefined()
    const second = createCorrectionGuidance(fractionQuestion, notSimplest, 2)
    expect(second.hint).toBe(fractionQuestion.hints.level2)
    expect(second.revealedAnswer).toEqual({ kind: 'fraction', numerator: 1, denominator: 2 })
  })

  it('keeps every correct blank and omits the list when none is correct', () => {
    const blanks = buildQuestionFixture({
      standardAnswer: { kind: 'fill-blanks', values: ['交换', '结合', '分配'] },
      acceptedAnswerRule: {
        kind: 'fill-blanks',
        values: [['交换'], ['结合'], ['分配']],
        trimWhitespace: true,
      },
    })
    const partial = judgeAnswer(blanks, {
      kind: 'fill-blanks',
      values: ['交换', '错误', '分配'],
    })
    expect(createCorrectionGuidance(blanks, partial, 1).correctBlanks).toEqual([0, 2])
    const none = judgeAnswer(blanks, { kind: 'fill-blanks', values: ['甲', '乙', '丙'] })
    expect(createCorrectionGuidance(blanks, none, 1).correctBlanks).toBeUndefined()

    const sentence = buildQuestionFixture({
      standardAnswer: { kind: 'sentence-completion', values: ['am', 'is'] },
      acceptedAnswerRule: {
        kind: 'sentence-completion',
        values: [['am'], ['is']],
        caseSensitive: false,
        ignoreTerminalPunctuation: true,
      },
    })
    const sentenceJudgement = judgeAnswer(sentence, {
      kind: 'sentence-completion',
      values: ['am', 'are'],
    })
    const guidance = createCorrectionGuidance(sentence, sentenceJudgement, 1)
    expect(guidance.correctBlanks).toEqual([0])
    expect(guidance.message).toBe('第 2 空还需要检查')
  })

  it('preserves the correct quotient for remainder-only errors', () => {
    const division = buildQuestionFixture({
      standardAnswer: { kind: 'quotient-remainder', quotient: 7, remainder: 3 },
      acceptedAnswerRule: {
        kind: 'quotient-remainder',
        values: [{ quotient: 7, remainder: 3 }],
      },
    })
    const wrong = judgeAnswer(division, { kind: 'quotient-remainder', quotient: 7, remainder: 9 })
    const first = createCorrectionGuidance(division, wrong, 1)
    expect(first).toMatchObject({
      message: '商正确，再检查余数',
      hint: '只检查余数是否小于除数，并重新验算余数',
      preservedQuotient: 7,
    })
    expect(createCorrectionGuidance(division, wrong, 2).hint).toContain('只检查余数：')
  })
})
