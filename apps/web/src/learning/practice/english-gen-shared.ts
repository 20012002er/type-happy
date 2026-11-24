import type { Random } from '../ports'
import type {
  AcceptedAnswerRule,
  Answer,
  Course,
  Difficulty,
  ErrorCauseRule,
  QuestionHints,
  QuestionOption,
  QuestionSnapshot,
} from '../types'
import type { EnglishQuestionTemplate } from './english-template-kit'
import { cause, seededRandom, shuffleOptions } from './math-gen-shared'

export { cause, seededRandom, shuffleOptions }

/** 词汇条目：中文释义 + 含空位的英语语境句，拼写与词义选择共用。 */
export interface EnglishWordItem {
  word: string
  meaning: string
  context: string
  misspellings?: readonly { value: string; feedback: string }[]
}

/** 句型语法选择条目：options[0] 为正确答案，其余为干扰项。 */
export interface EnglishGrammarItem {
  prompt: string
  options: readonly [string, string, string, string]
  languagePoint: string
  distractorFeedback: readonly [string, string, string]
  hint1: string
  hint2: string
  explanation: readonly string[]
}

/** 句子补全条目：每个空位一组可接受答案，多解必须预先声明。 */
export interface EnglishCompletionItem {
  prompt: string
  answers: readonly (readonly string[])[]
  languagePoint: string
  hint1: string
  hint2: string
  explanation: readonly string[]
  commonErrors?: readonly { values: readonly string[]; feedback: string }[]
}

/** 情境表达条目：中文情境 + 四个英语表达选项，options[0] 最恰当。 */
export interface EnglishSituationItem {
  situation: string
  options: readonly [string, string, string, string]
  distractorFeedback: readonly [string, string, string]
  hint1: string
  hint2: string
  explanation: readonly string[]
}

export interface EnglishUnitContent {
  words: readonly EnglishWordItem[]
  grammar: readonly EnglishGrammarItem[]
  completions: readonly EnglishCompletionItem[]
  situations: readonly EnglishSituationItem[]
}

const contentRegistry = new Map<string, EnglishUnitContent>()

function contentKey(courseId: string, unitId: string): string {
  return `${courseId}:${unitId}`
}

export function registerEnglishUnitContent(
  courseId: string,
  unitId: string,
  content: EnglishUnitContent,
): void {
  const key = contentKey(courseId, unitId)
  if (contentRegistry.has(key)) throw new Error(`英语单元内容重复注册：${key}`)
  if (content.words.length < 4) throw new Error(`英语单元 ${key} 词汇条目不足 4 个`)
  if (content.grammar.length < 3) throw new Error(`英语单元 ${key} 语法条目不足 3 个`)
  if (content.completions.length < 3) throw new Error(`英语单元 ${key} 补全条目不足 3 个`)
  if (content.situations.length < 3) throw new Error(`英语单元 ${key} 情境条目不足 3 个`)
  contentRegistry.set(key, content)
}

export function getEnglishUnitContent(courseId: string, unitId: string): EnglishUnitContent {
  const content = contentRegistry.get(contentKey(courseId, unitId))
  if (!content) throw new Error(`英语单元内容未注册：${courseId}:${unitId}`)
  return content
}

export interface EnglishGeneratorContext {
  template: EnglishQuestionTemplate
  course: Course
  difficulty: Difficulty
  seed: number
  instanceId: string
  random: Random
}

export type EnglishGeneratorFn = (context: EnglishGeneratorContext) => QuestionSnapshot

const generatorRegistry = new Map<string, EnglishGeneratorFn>()

export function registerEnglishGenerator(kind: string, generator: EnglishGeneratorFn): void {
  if (generatorRegistry.has(kind)) throw new Error(`英语生成器重复注册：${kind}`)
  generatorRegistry.set(kind, generator)
}

export function getEnglishGenerator(kind: string): EnglishGeneratorFn {
  const generator = generatorRegistry.get(kind)
  if (!generator) throw new Error(`未知英语生成器：${kind}`)
  return generator
}

export interface EnglishSnapshotFields {
  prompt: string
  answer: Answer
  acceptedAnswerRule: AcceptedAnswerRule
  hints: QuestionHints
  explanationSteps: readonly string[]
  errorCauseRules?: readonly ErrorCauseRule[]
  options?: readonly QuestionOption[]
}

export function buildEnglishSnapshot(
  context: EnglishGeneratorContext,
  fields: EnglishSnapshotFields,
): QuestionSnapshot {
  const point = context.course.knowledgePoints.find(
    (item) => item.id === context.template.classification.knowledgePointId,
  )
  if (!point) {
    throw new Error(`模板知识点不存在：${context.template.classification.knowledgePointId}`)
  }
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
    resources: [],
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

export function spellingRule(values: readonly string[]): AcceptedAnswerRule {
  return { kind: 'english-spelling', values, caseSensitive: false }
}

export function sentenceRule(values: readonly (readonly string[])[]): AcceptedAnswerRule {
  return {
    kind: 'sentence-completion',
    values,
    caseSensitive: false,
    ignoreTerminalPunctuation: true,
  }
}

export interface EnglishChoiceFields {
  prompt: string
  /** 四个选项文本，第 0 个为正确答案。 */
  options: readonly [string, string, string, string]
  /** 与三个干扰项一一对应的错因反馈。 */
  distractorFeedback: readonly [string, string, string]
  hints: QuestionHints
  explanationSteps: readonly string[]
}

/** 构造四选项单选快照：选项 ID 固定绑定内容，顺序按种子打乱，错因按干扰项归因。 */
export function buildChoiceSnapshot(
  context: EnglishGeneratorContext,
  fields: EnglishChoiceFields,
): QuestionSnapshot {
  const options: QuestionOption[] = fields.options.map((text, index) => ({
    id: `opt-${String.fromCharCode(97 + index)}`,
    text,
  }))
  const errorCauseRules = options.slice(1).map((option, index) =>
    cause(`distractor-${option.id}`, '干扰项辨析', fields.distractorFeedback[index], [
      { kind: 'single-choice', optionId: option.id },
    ]),
  )
  return buildEnglishSnapshot(context, {
    prompt: fields.prompt,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    hints: fields.hints,
    explanationSteps: fields.explanationSteps,
    errorCauseRules,
    options: shuffleOptions(context.random, options),
  })
}