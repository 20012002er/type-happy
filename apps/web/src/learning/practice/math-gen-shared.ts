import type { Random } from '../ports'
import type {
  AcceptedAnswerRule,
  Answer,
  Course,
  Difficulty,
  ErrorCauseRule,
  QuestionHints,
  QuestionOption,
  QuestionResource,
  QuestionSnapshot,
} from '../types'
import type { MathQuestionTemplate } from './math-template-kit'

export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const int = (minimum: number, maximum: number) =>
    minimum + Math.floor(next() * (maximum - minimum + 1))
  return {
    next,
    int,
    pick: (values) => {
      if (values.length === 0) throw new Error('Cannot pick from an empty collection')
      return values[int(0, values.length - 1)]
    },
  }
}

export interface MathGeneratorContext {
  template: MathQuestionTemplate
  course: Course
  difficulty: Difficulty
  seed: number
  instanceId: string
  random: Random
}

export type MathGeneratorFn = (context: MathGeneratorContext) => QuestionSnapshot

const generatorRegistry = new Map<string, MathGeneratorFn>()

export function registerMathGenerator(kind: string, generator: MathGeneratorFn): void {
  if (generatorRegistry.has(kind)) throw new Error(`数学生成器重复注册：${kind}`)
  generatorRegistry.set(kind, generator)
}

export function getMathGenerator(kind: string): MathGeneratorFn {
  const generator = generatorRegistry.get(kind)
  if (!generator) throw new Error(`未知数学生成器：${kind}`)
  return generator
}

export function cause(
  id: string,
  label: string,
  feedback: string,
  answers: ErrorCauseRule['answers'],
): ErrorCauseRule {
  return { id, label, feedback, answers }
}

export interface MathSnapshotFields {
  prompt: string
  answer: Answer
  acceptedAnswerRule: AcceptedAnswerRule
  hints: QuestionHints
  explanationSteps: readonly string[]
  errorCauseRules?: readonly ErrorCauseRule[]
  resources?: readonly QuestionResource[]
  options?: readonly QuestionOption[]
}

export function buildMathSnapshot(
  context: MathGeneratorContext,
  fields: MathSnapshotFields,
): QuestionSnapshot {
  const point = context.course.knowledgePoints.find(
    (item) => item.id === context.template.classification.knowledgePointId,
  )
  if (!point)
    throw new Error(`模板知识点不存在：${context.template.classification.knowledgePointId}`)
  return {
    templateId: context.template.id,
    templateVersion: context.template.version,
    instanceId: context.instanceId,
    seed: context.seed,
    classification: context.template.classification,
    source: point.source,
    countsTowardNewKnowledge: point.source !== 'review',
    type: fields.answer.kind,
    difficulty: context.difficulty,
    prompt: fields.prompt,
    resources: fields.resources ?? [],
    ...(fields.options ? { options: fields.options } : {}),
    standardAnswer: fields.answer,
    acceptedAnswerRule: fields.acceptedAnswerRule,
    errorCauseRules: fields.errorCauseRules ?? [],
    hints: fields.hints,
    explanationSteps: fields.explanationSteps,
    retestKnowledgePointIds: [point.id],
    participatesInTask: true,
    rewardEligible: true,
  }
}

export function numberRule(value: number, allowDecimal = false): AcceptedAnswerRule {
  return allowDecimal
    ? { kind: 'number', values: [value], allowDecimal: true }
    : { kind: 'number', values: [value] }
}

/** 用整数缩放值精确表示小数，避免浮点误差；输出会去掉多余尾零。 */
export function decimalText(scaled: number, places: number): string {
  const sign = scaled < 0 ? '-' : ''
  const absolute = Math.abs(scaled)
  const base = 10 ** places
  const integer = Math.floor(absolute / base)
  const fraction = absolute % base
  if (places === 0 || fraction === 0) return `${sign}${integer}`
  const fractionText = String(fraction).padStart(places, '0').replace(/0+$/, '')
  return `${sign}${integer}.${fractionText}`
}

export function decimalValue(scaled: number, places: number): number {
  return Number(decimalText(scaled, places))
}

export function gcd(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) {
    const next = a % b
    a = b
    b = next
  }
  return a
}

export function shuffleOptions(
  random: Random,
  options: readonly QuestionOption[],
): readonly QuestionOption[] {
  const shuffled = [...options]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = random.int(0, index)
    const held = shuffled[index]
    shuffled[index] = shuffled[target]
    shuffled[target] = held
  }
  return shuffled
}

export function textResource(id: string, description: string): QuestionResource {
  return { id, type: 'text', uri: `text:${id}`, altText: description }
}

export const DIAGRAM_NOTE = '示意图不一定按比例绘制，请以标注数据为准。'
