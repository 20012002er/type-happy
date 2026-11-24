import type { Answer, QuestionSnapshot } from '../types'
import type { AnswerJudgement } from './answer'

export interface CorrectionGuidance {
  hintLevel: 1 | 2
  message: string
  hint: string
  explanationSteps: readonly string[]
  revealedAnswer?: Answer
  preservedQuotient?: number
  preservedValue?: number
  preservedUnit?: string
  correctBlanks?: readonly number[]
}

export function createCorrectionGuidance(
  snapshot: QuestionSnapshot,
  judgement: AnswerJudgement,
  incorrectSubmissions: number,
): CorrectionGuidance {
  if (judgement.correct) throw new Error('正确答案不需要订正提示')
  if (!Number.isInteger(incorrectSubmissions) || incorrectSubmissions < 1) {
    throw new Error('错误提交次数必须是正整数')
  }

  const secondError = incorrectSubmissions >= 2
  const onlyRemainderNeedsChecking =
    judgement.answer.kind === 'quotient-remainder' && judgement.quotientCorrect === true
  const onlyUnitNeedsChecking =
    judgement.answer.kind === 'word-problem' &&
    judgement.valueCorrect === true &&
    judgement.unitCorrect === false
  const onlySimplestNeedsChecking = judgement.simplestNeeded === true
  const causeFeedback = judgement.cause?.feedback
  const hint = onlyRemainderNeedsChecking
    ? secondError
      ? `只检查余数：${causeFeedback ?? '余数必须小于除数，并用被除数减去除数与商的乘积'}`
      : (causeFeedback ?? '只检查余数是否小于除数，并重新验算余数')
    : onlyUnitNeedsChecking
      ? secondError
        ? `只检查单位：${causeFeedback ?? '先确认题目要求的单位，再检查答案单位是否一致'}`
        : (causeFeedback ?? '只检查单位是否与题目要求一致')
      : onlySimplestNeedsChecking && !secondError
        ? (causeFeedback ?? '数值已经正确，把分子和分母同时除以它们的最大公因数，化成最简分数')
        : secondError
          ? `${snapshot.hints.level2}${causeFeedback ? ` ${causeFeedback}` : ''}`
          : (causeFeedback ?? snapshot.hints.level1)

  const correctBlanks = judgement.blankResults
    ?.map((correct, index) => (correct ? index : null))
    .filter((index): index is number => index !== null)

  return {
    hintLevel: secondError ? 2 : 1,
    message: judgement.message,
    hint,
    explanationSteps: secondError ? snapshot.explanationSteps : [],
    revealedAnswer: secondError ? snapshot.standardAnswer : undefined,
    preservedQuotient:
      onlyRemainderNeedsChecking && judgement.answer.kind === 'quotient-remainder'
        ? judgement.answer.quotient
        : undefined,
    preservedValue:
      onlyUnitNeedsChecking && judgement.answer.kind === 'word-problem'
        ? judgement.answer.value
        : undefined,
    preservedUnit:
      judgement.answer.kind === 'word-problem' &&
      judgement.unitCorrect === true &&
      judgement.valueCorrect === false
        ? judgement.answer.unit
        : undefined,
    correctBlanks: correctBlanks && correctBlanks.length > 0 ? correctBlanks : undefined,
  }
}
