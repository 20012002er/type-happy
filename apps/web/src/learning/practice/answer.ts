import { normalizeEnglishSentence, normalizeEnglishSpelling } from '../normalize-text'
import type {
  AcceptedAnswerRule,
  Answer,
  ErrorCauseRule,
  QuestionSnapshot,
  QuestionType,
} from '../types'

export interface QuotientRemainderInput {
  quotient: string
  remainder: string
}

export interface FractionInput {
  numerator: string
  denominator: string
}

export interface WordProblemInput {
  value: string
  unit?: string
}

export interface NumberAnswerOptions {
  allowNegative?: boolean
  allowDecimal?: boolean
  decimalPlaces?: number
}

export type AnswerParseField =
  'answer' | 'quotient' | 'remainder' | 'numerator' | 'denominator' | 'unit' | `blank-${number}`

export type AnswerParseResult =
  | { ok: true; answer: Answer }
  | {
      ok: false
      field: AnswerParseField
      reason: 'empty' | 'invalid' | 'zero-denominator'
    }

function parseInteger(
  input: string,
  field: AnswerParseField,
  allowNegative = false,
):
  | { ok: true; value: number }
  | { ok: false; field: AnswerParseField; reason: 'empty' | 'invalid' } {
  const normalized = input.trim()
  if (normalized.length === 0) return { ok: false, field, reason: 'empty' }
  const pattern = allowNegative ? /^-?\d+$/ : /^\d+$/
  if (!pattern.test(normalized)) return { ok: false, field, reason: 'invalid' }
  const value = Number(normalized)
  if (!Number.isSafeInteger(value)) return { ok: false, field, reason: 'invalid' }
  return { ok: true, value: value === 0 ? 0 : value }
}

function canonicalDecimal(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) return text
  const sign = match[1] === '-' ? '-' : ''
  const integer = match[2].replace(/^0+(?=\d)/, '')
  const fraction = (match[3] ?? '').replace(/0+$/, '')
  const body = fraction.length > 0 ? `${integer}.${fraction}` : integer
  return body === '0' ? '0' : `${sign}${body}`
}

function canonicalNumber(value: number): string {
  return canonicalDecimal(String(value))
}

export function parseNumberAnswer(input: string, options?: NumberAnswerOptions): AnswerParseResult {
  const normalized = input.trim()
  if (normalized.length === 0) return { ok: false, field: 'answer', reason: 'empty' }
  const allowNegative = options?.allowNegative === true
  const allowDecimal = options?.allowDecimal === true
  const pattern = allowNegative
    ? allowDecimal
      ? /^-?\d+(\.\d+)?$/
      : /^-?\d+$/
    : allowDecimal
      ? /^\d+(\.\d+)?$/
      : /^\d+$/
  if (!pattern.test(normalized)) return { ok: false, field: 'answer', reason: 'invalid' }
  const canonical = canonicalDecimal(normalized)
  if (allowDecimal && options?.decimalPlaces !== undefined) {
    const fraction = canonical.split('.')[1] ?? ''
    if (fraction.length > options.decimalPlaces) {
      return { ok: false, field: 'answer', reason: 'invalid' }
    }
  }
  const significantDigits = canonical.replace('-', '').replace('.', '').replace(/^0+/, '')
  if (significantDigits.length > 15) return { ok: false, field: 'answer', reason: 'invalid' }
  const value = Number(canonical)
  if (!Number.isFinite(value)) return { ok: false, field: 'answer', reason: 'invalid' }
  return { ok: true, answer: { kind: 'number', value: value === 0 ? 0 : value } }
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

function parseBlankValues(inputs: readonly string[], count: number): AnswerParseResult | string[] {
  if (inputs.length !== count) return { ok: false, field: 'answer', reason: 'invalid' }
  for (const [index, value] of inputs.entries()) {
    if (value.trim().length === 0) return { ok: false, field: `blank-${index}`, reason: 'empty' }
  }
  return [...inputs]
}

export function parseFillBlanksAnswer(inputs: readonly string[], count: number): AnswerParseResult {
  const parsed = parseBlankValues(inputs, count)
  if (!Array.isArray(parsed)) return parsed
  return { ok: true, answer: { kind: 'fill-blanks', values: parsed } }
}

export function parseSentenceCompletionAnswer(
  inputs: readonly string[],
  count: number,
): AnswerParseResult {
  const parsed = parseBlankValues(inputs, count)
  if (!Array.isArray(parsed)) return parsed
  return { ok: true, answer: { kind: 'sentence-completion', values: parsed } }
}

export function parseSingleChoiceAnswer(
  optionId: string,
  optionIds: readonly string[],
): AnswerParseResult {
  const normalized = optionId.trim()
  if (normalized.length === 0) return { ok: false, field: 'answer', reason: 'empty' }
  if (!optionIds.includes(normalized)) return { ok: false, field: 'answer', reason: 'invalid' }
  return { ok: true, answer: { kind: 'single-choice', optionId: normalized } }
}

export function parseWordProblemAnswer(
  input: WordProblemInput,
  rule: {
    values: readonly { value: number; unit?: string }[]
    unitRequired: boolean
    decimalPlaces?: number
  },
): AnswerParseResult {
  const allowDecimal =
    rule.decimalPlaces !== undefined || rule.values.some((value) => !Number.isInteger(value.value))
  const parsed = parseNumberAnswer(input.value, { allowDecimal, decimalPlaces: rule.decimalPlaces })
  if (!parsed.ok) return parsed
  if (parsed.answer.kind !== 'number') return { ok: false, field: 'answer', reason: 'invalid' }
  const unit = input.unit?.trim() ?? ''
  if (rule.unitRequired && unit.length === 0) return { ok: false, field: 'unit', reason: 'empty' }
  return {
    ok: true,
    answer: { kind: 'word-problem', value: parsed.answer.value, unit: unit || undefined },
  }
}

export function parseFractionAnswer(input: FractionInput): AnswerParseResult {
  const numerator = parseInteger(input.numerator, 'numerator', true)
  if (!numerator.ok) return numerator
  const denominator = parseInteger(input.denominator, 'denominator')
  if (!denominator.ok) return denominator
  if (denominator.value === 0)
    return { ok: false, field: 'denominator', reason: 'zero-denominator' }
  return {
    ok: true,
    answer: { kind: 'fraction', numerator: numerator.value, denominator: denominator.value },
  }
}

export function parseEnglishSpellingAnswer(input: string): AnswerParseResult {
  const normalized = input.trim()
  if (normalized.length === 0) return { ok: false, field: 'answer', reason: 'empty' }
  if (!/^[A-Za-z'’\- ]+$/.test(normalized)) return { ok: false, field: 'answer', reason: 'invalid' }
  return { ok: true, answer: { kind: 'english-spelling', value: normalized } }
}

export interface AnswerJudgement {
  correct: boolean
  answer: Answer
  message: string
  cause?: ErrorCauseRule
  quotientCorrect?: boolean
  remainderCorrect?: boolean
  blankResults?: readonly boolean[]
  valueCorrect?: boolean
  unitCorrect?: boolean
  simplestNeeded?: boolean
}

const GENERIC_INCORRECT = '答案还不正确，请根据提示检查'

function expectRule<Kinds extends AcceptedAnswerRule['kind']>(
  snapshot: QuestionSnapshot,
  kind: Kinds,
): Extract<AcceptedAnswerRule, { kind: Kinds }> {
  const rule = snapshot.acceptedAnswerRule
  if (rule.kind !== kind) throw new Error('题目答案规则配置无效')
  return rule as Extract<AcceptedAnswerRule, { kind: Kinds }>
}

function expectStandard<Kinds extends Answer['kind']>(
  snapshot: QuestionSnapshot,
  kind: Kinds,
): Extract<Answer, { kind: Kinds }> {
  const standard = snapshot.standardAnswer
  if (standard.kind !== kind) throw new Error('题目标准答案配置无效')
  return standard as Extract<Answer, { kind: Kinds }>
}

function fractionsEquivalent(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number },
): boolean {
  return (
    BigInt(left.numerator) * BigInt(right.denominator) ===
    BigInt(right.numerator) * BigInt(left.denominator)
  )
}

function blankMessage(blankResults: readonly boolean[]): string {
  const wrong = blankResults
    .map((correct, index) => (correct ? null : index + 1))
    .filter((index): index is number => index !== null)
  return `第 ${wrong.join('、')} 空还需要检查`
}

function judgeNumber(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'number') throw new Error('答案类型与题型不一致')
  const rule = expectRule(snapshot, 'number')
  const correct = rule.values.some(
    (value) => canonicalNumber(value) === canonicalNumber(answer.value),
  )
  return { correct, answer, message: GENERIC_INCORRECT }
}

function judgeQuotientRemainder(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'quotient-remainder') throw new Error('答案类型与题型不一致')
  const rule = expectRule(snapshot, 'quotient-remainder')
  const correct = rule.values.some(
    (value) => value.quotient === answer.quotient && value.remainder === answer.remainder,
  )
  const standard = expectStandard(snapshot, 'quotient-remainder')
  const quotientCorrect = answer.quotient === standard.quotient
  const remainderCorrect = answer.remainder === standard.remainder
  const message = quotientCorrect
    ? '商正确，再检查余数'
    : remainderCorrect
      ? '余数正确，再检查商'
      : '再检查商和余数'
  return { correct, answer, message, quotientCorrect, remainderCorrect }
}

function judgeFillBlanks(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'fill-blanks') throw new Error('答案类型与题型不一致')
  const rule = expectRule(snapshot, 'fill-blanks')
  if (answer.values.length !== rule.values.length) throw new Error('填空数量与题目不一致')
  const normalize = (value: string) => (rule.trimWhitespace ? value.trim() : value)
  const blankResults = answer.values.map((value, index) =>
    rule.values[index].some((candidate) => normalize(candidate) === normalize(value)),
  )
  return {
    correct: blankResults.every(Boolean),
    answer,
    message: blankMessage(blankResults),
    blankResults,
  }
}

function judgeSingleChoice(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'single-choice') throw new Error('答案类型与题型不一致')
  const rule = expectRule(snapshot, 'single-choice')
  if (snapshot.options && !snapshot.options.some((option) => option.id === answer.optionId)) {
    throw new Error('选项不存在')
  }
  return {
    correct: rule.values.includes(answer.optionId),
    answer,
    message: '选项还不正确，请根据提示检查',
  }
}

function judgeWordProblem(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'word-problem') throw new Error('答案类型与题型不一致')
  const rule = expectRule(snapshot, 'word-problem')
  const standard = expectStandard(snapshot, 'word-problem')
  const correct = rule.values.some(
    (value) =>
      canonicalNumber(value.value) === canonicalNumber(answer.value) &&
      (value.unit ?? '') === (answer.unit ?? ''),
  )
  const valueCorrect = canonicalNumber(standard.value) === canonicalNumber(answer.value)
  const unitCorrect = (standard.unit ?? '') === (answer.unit ?? '')
  const hasUnit = rule.unitRequired || standard.unit !== undefined
  const message = !hasUnit
    ? GENERIC_INCORRECT
    : valueCorrect
      ? '数量正确，再检查单位'
      : unitCorrect
        ? '单位正确，再检查数量'
        : '再检查数量和单位'
  return { correct, answer, message, valueCorrect, unitCorrect }
}

function judgeFraction(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'fraction') throw new Error('答案类型与题型不一致')
  if (answer.denominator === 0) throw new Error('分母不能为 0')
  const rule = expectRule(snapshot, 'fraction')
  const equivalent = rule.values.some((value) => fractionsEquivalent(value, answer))
  const correct = rule.requireSimplest
    ? rule.values.some(
        (value) => value.numerator === answer.numerator && value.denominator === answer.denominator,
      )
    : equivalent
  const simplestNeeded = rule.requireSimplest && !correct && equivalent
  return {
    correct,
    answer,
    message: simplestNeeded ? '数值正确，请把分数化成最简形式' : GENERIC_INCORRECT,
    simplestNeeded,
  }
}

function judgeEnglishSpelling(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'english-spelling') throw new Error('答案类型与题型不一致')
  const rule = expectRule(snapshot, 'english-spelling')
  const normalize = (value: string) => normalizeEnglishSpelling(value, rule.caseSensitive)
  return {
    correct: rule.values.some((value) => normalize(value) === normalize(answer.value)),
    answer,
    message: '拼写还不正确，请根据提示检查',
  }
}

function judgeSentenceCompletion(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== 'sentence-completion') throw new Error('答案类型与题型不一致')
  const rule = expectRule(snapshot, 'sentence-completion')
  if (answer.values.length !== rule.values.length) throw new Error('填空数量与题目不一致')
  const normalize = (value: string) =>
    normalizeEnglishSentence(value, rule.caseSensitive, rule.ignoreTerminalPunctuation)
  const blankResults = answer.values.map((value, index) =>
    rule.values[index].some((candidate) => normalize(candidate) === normalize(value)),
  )
  return {
    correct: blankResults.every(Boolean),
    answer,
    message: blankMessage(blankResults),
    blankResults,
  }
}

export const ANSWER_JUDGES: Readonly<Record<QuestionType, typeof judgeNumber>> = {
  number: judgeNumber,
  'quotient-remainder': judgeQuotientRemainder,
  'fill-blanks': judgeFillBlanks,
  'single-choice': judgeSingleChoice,
  'word-problem': judgeWordProblem,
  fraction: judgeFraction,
  'english-spelling': judgeEnglishSpelling,
  'sentence-completion': judgeSentenceCompletion,
}

function answersEqual(left: Answer, right: Answer, rule: AcceptedAnswerRule): boolean {
  if (left.kind !== right.kind) return false
  switch (left.kind) {
    case 'number':
      return canonicalNumber(left.value) === canonicalNumber((right as typeof left).value)
    case 'quotient-remainder': {
      const other = right as typeof left
      return left.quotient === other.quotient && left.remainder === other.remainder
    }
    case 'fill-blanks': {
      const other = right as typeof left
      const trim = rule.kind === 'fill-blanks' ? rule.trimWhitespace : true
      const normalize = (value: string) => (trim ? value.trim() : value)
      return (
        left.values.length === other.values.length &&
        left.values.every((value, index) => normalize(value) === normalize(other.values[index]))
      )
    }
    case 'single-choice':
      return left.optionId === (right as typeof left).optionId
    case 'word-problem': {
      const other = right as typeof left
      return (
        canonicalNumber(left.value) === canonicalNumber(other.value) &&
        (left.unit ?? '') === (other.unit ?? '')
      )
    }
    case 'fraction':
      return fractionsEquivalent(left, right as typeof left)
    case 'english-spelling': {
      const caseSensitive = rule.kind === 'english-spelling' ? rule.caseSensitive : false
      return (
        normalizeEnglishSpelling(left.value, caseSensitive) ===
        normalizeEnglishSpelling((right as typeof left).value, caseSensitive)
      )
    }
    case 'sentence-completion': {
      const other = right as typeof left
      const caseSensitive = rule.kind === 'sentence-completion' ? rule.caseSensitive : false
      const ignorePunctuation =
        rule.kind === 'sentence-completion' ? rule.ignoreTerminalPunctuation : true
      const normalize = (value: string) =>
        normalizeEnglishSentence(value, caseSensitive, ignorePunctuation)
      return (
        left.values.length === other.values.length &&
        left.values.every((value, index) => normalize(value) === normalize(other.values[index]))
      )
    }
  }
}

function matchCause(snapshot: QuestionSnapshot, answer: Answer): ErrorCauseRule | undefined {
  return snapshot.errorCauseRules.find((rule) =>
    rule.answers.some((candidate) => answersEqual(candidate, answer, snapshot.acceptedAnswerRule)),
  )
}

export function judgeAnswer(snapshot: QuestionSnapshot, answer: Answer): AnswerJudgement {
  if (answer.kind !== snapshot.type) throw new Error('答案类型与题型不一致')
  const judgement = ANSWER_JUDGES[snapshot.type](snapshot, answer)
  if (judgement.correct) return { ...judgement, message: '回答正确', cause: undefined }
  return { ...judgement, cause: matchCause(snapshot, answer) }
}
