import { describe, expect, it } from 'vitest'
import {
  judgeAnswer,
  parseNumberAnswer,
  parseQuotientRemainderAnswer,
} from '../../../src/learning/practice/answer'
import { createCorrectionGuidance } from '../../../src/learning/practice/correction'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import type { Answer } from '../../../src/learning/types'

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
