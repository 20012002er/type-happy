import type { Answer, ErrorCauseRule, QuestionSnapshot } from '../types'

export interface QuotientRemainderInput {
  quotient: string
  remainder: string
}

export type AnswerParseResult =
  | { ok: true; answer: Answer }
  | {
      ok: false
      field: 'answer' | 'quotient' | 'remainder'
      reason: 'empty' | 'invalid'
    }

function parseInteger(
  input: string,
  field: 'answer' | 'quotient' | 'remainder',
): { ok: true; value: number } | { ok: false; field: typeof field; reason: 'empty' | 'invalid' } {
  const normalized = input.trim()
  if (normalized.length === 0) return { ok: false, field, reason: 'empty' }
  if (!/^\d+$/.test(normalized)) return { ok: false, field, reason: 'invalid' }
  const value = Number(normalized)
  if (!Number.isSafeInteger(value)) return { ok: false, field, reason: 'invalid' }
  return { ok: true, value }
}

export function parseNumberAnswer(input: string): AnswerParseResult {
  const parsed = parseInteger(input, 'answer')
  if (!parsed.ok) return parsed
  return { ok: true, answer: { kind: 'number', value: parsed.value } }
}

export function parseQuotientRemainderAnswer(input: QuotientRemainderInput): AnswerParseResult {
  const quotient = parseInteger(input.quotient, 'quotient')
  if (!quotient.ok) return quotient
  const remainder = parseInteger(input.remainder, 'remainder')
  if (!remainder.ok) return remainder
  return {
    ok: true,
    answer: { kind: 'quotient-remainder', quotient: quotient.value, remainder: remainder.value },
  }
}

function answersEqual(left: Answer, right: Answer): boolean {
  if (left.kind === 'number' && right.kind === 'number') return left.value === right.value
  if (left.kind === 'quotient-remainder' && right.kind === 'quotient-remainder') {
    return left.quotient === right.quotient && left.remainder === right.remainder
  }
  return false
}

function acceptedAnswers(snapshot: QuestionSnapshot): readonly Answer[] {
  const rule = snapshot.acceptedAnswerRule
  switch (rule.kind) {
    case 'number':
      return rule.values.map((value) => ({ kind: 'number', value }))
    case 'quotient-remainder':
      return rule.values.map((value) => ({ kind: 'quotient-remainder', ...value }))
    default:
      throw new Error('WP04 前不支持该题型的判分')
  }
}

function matchCause(snapshot: QuestionSnapshot, answer: Answer): ErrorCauseRule | undefined {
  return snapshot.errorCauseRules.find((rule) =>
    rule.answers.some((candidate) => answersEqual(candidate, answer)),
  )
}

export interface AnswerJudgement {
  correct: boolean
  answer: Answer
  message: string
  cause?: ErrorCauseRule
  quotientCorrect?: boolean
  remainderCorrect?: boolean
}

export function judgeAnswer(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== snapshot.type) throw new Error('答案类型与题型不一致')
  const correct = acceptedAnswers(snapshot).some((candidate) => answersEqual(candidate, answer))
  const base = { correct, answer, cause: correct ? undefined : matchCause(snapshot, answer) }
  if (correct) return { ...base, message: '回答正确' }
  if (answer.kind === 'number') return { ...base, message: '答案还不正确，请根据提示检查' }
  if (answer.kind !== 'quotient-remainder') throw new Error('WP04 前不支持该题型的判分')

  const standard = snapshot.standardAnswer
  if (standard.kind !== 'quotient-remainder') throw new Error('商余数题的标准答案配置无效')
  const quotientCorrect = answer.quotient === standard.quotient
  const remainderCorrect = answer.remainder === standard.remainder
  const message = quotientCorrect
    ? '商正确，再检查余数'
    : remainderCorrect
      ? '余数正确，再检查商'
      : '再检查商和余数'
  return { ...base, message, quotientCorrect, remainderCorrect }
}
