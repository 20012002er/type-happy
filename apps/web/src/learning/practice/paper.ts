import { LEARNING_RULES } from '../config/rules'
import { getCourseById } from '../content/course-registry'
import type { Difficulty, LearningAbility, QuestionSnapshot, QuestionType } from '../types'
import { generateEnglishQuestion } from './english-generator'
import type { EnglishPaperCategory } from './english-template-kit'
import { filterEnglishTemplates } from './english-templates'
import { generateMathQuestion } from './math-generator'
import type { MathPaperCategory } from './math-template-kit'
import { filterMathTemplates } from './math-templates'
import type { PracticeMode, PracticeQuestionInput } from './practice-session'
import { injectRetestsIntoPaper, type RetestPoolEntry } from './retest'

export type MathPaperBlueprint = Record<MathPaperCategory, number>
export type EnglishPaperBlueprint = Record<EnglishPaperCategory, number>

export interface PracticePaper {
  mode: PracticeMode
  blueprint?: MathPaperBlueprint | EnglishPaperBlueprint
  questions: readonly PracticeQuestionInput[]
}

export function hasPracticeContent(courseId: string): boolean {
  return (
    filterMathTemplates({ courseId }).length > 0 || filterEnglishTemplates({ courseId }).length > 0
  )
}

const CATEGORY_SEQUENCE: readonly MathPaperCategory[] = [
  'calculation',
  'singleChoice',
  'knowledgeApplication',
  'wordProblems',
]

const CATEGORY_LABELS: Record<MathPaperCategory, string> = {
  calculation: '数字计算与直接填空',
  singleChoice: '单项选择',
  knowledgeApplication: '知识应用填空',
  wordProblems: '应用问题',
}

const ENGLISH_CATEGORY_SEQUENCE: readonly EnglishPaperCategory[] = [
  'singleChoice',
  'spelling',
  'sentenceCompletion',
  'situationalExpression',
]

const ENGLISH_CATEGORY_LABELS: Record<EnglishPaperCategory, string> = {
  singleChoice: '单项选择',
  spelling: '单词拼写',
  sentenceCompletion: '句子补全',
  situationalExpression: '情境表达',
}

function assertSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('组卷种子必须是非负安全整数')
}

function assertIdPrefix(idPrefix: string): void {
  if (idPrefix.trim().length === 0) throw new Error('组卷实例 ID 前缀不能为空')
}

function deriveSeed(seed: number, index: number, attempt = 0): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b1) + Math.imul(attempt, 0x85ebca6b)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

export function scaleMathBlueprint(total: number): MathPaperBlueprint {
  const { minimumGoal, maximumGoal, defaultGoal } = LEARNING_RULES.dailyTask
  if (!Number.isInteger(total) || total < minimumGoal || total > maximumGoal) {
    throw new Error(`组卷题量必须是 ${minimumGoal}–${maximumGoal} 的整数`)
  }
  const base = LEARNING_RULES.paper.mathBlueprint
  const blueprint = {} as MathPaperBlueprint
  let assigned = 0
  for (const category of CATEGORY_SEQUENCE) {
    const count = Math.floor((base[category] * total) / defaultGoal)
    blueprint[category] = count
    assigned += count
  }
  let remaining = total - assigned
  let index = 0
  while (remaining > 0) {
    const category = LEARNING_RULES.paper.mathRefillOrder[
      index % LEARNING_RULES.paper.mathRefillOrder.length
    ] as MathPaperCategory
    blueprint[category] += 1
    remaining -= 1
    index += 1
  }
  if (blueprint.singleChoice < base.minimumSingleChoice) {
    throw new Error('单项选择题数量低于组卷下限')
  }
  if (blueprint.wordProblems < base.minimumWordProblems) {
    throw new Error('应用问题数量低于组卷下限')
  }
  return blueprint
}

export function scaleEnglishBlueprint(total: number): EnglishPaperBlueprint {
  const { minimumGoal, maximumGoal, defaultGoal } = LEARNING_RULES.dailyTask
  if (!Number.isInteger(total) || total < minimumGoal || total > maximumGoal) {
    throw new Error(`组卷题量必须是 ${minimumGoal}–${maximumGoal} 的整数`)
  }
  const base = LEARNING_RULES.paper.englishBlueprint
  const blueprint = {} as EnglishPaperBlueprint
  let assigned = 0
  for (const category of ENGLISH_CATEGORY_SEQUENCE) {
    const count = Math.floor((base[category] * total) / defaultGoal)
    blueprint[category] = count
    assigned += count
  }
  let remaining = total - assigned
  let index = 0
  while (remaining > 0) {
    const category = LEARNING_RULES.paper.englishRefillOrder[
      index % LEARNING_RULES.paper.englishRefillOrder.length
    ] as EnglishPaperCategory
    blueprint[category] += 1
    remaining -= 1
    index += 1
  }
  // 词汇/句型语法/情境运用三项能力分别由拼写、句子补全、情境表达保底
  for (const category of ['spelling', 'sentenceCompletion', 'situationalExpression'] as const) {
    if (blueprint[category] < base.minimumPerAbility) {
      throw new Error('缩放后各专项能力题量低于组卷下限')
    }
  }
  return blueprint
}

function categorySequence<C extends string>(blueprint: Record<C, number>, order: readonly C[]): C[] {
  const remaining = { ...blueprint }
  const sequence: C[] = []
  let total = order.reduce((sum, category) => sum + remaining[category], 0)
  while (total > 0) {
    for (const category of order) {
      if (remaining[category] === 0) continue
      sequence.push(category)
      remaining[category] -= 1
      total -= 1
    }
  }
  return sequence
}

interface PaperTemplateLike {
  id: string
  difficulty: Difficulty
  classification: { unitId: string; knowledgePointId: string }
}

type QuestionGenerator = (
  templateId: string,
  seed: number,
  instanceId: string,
  difficulty?: Difficulty,
) => QuestionSnapshot

function preferredTemplates<T extends PaperTemplateLike>(
  templates: readonly T[],
  preferredKnowledgePointIds: readonly string[],
): T[] {
  const preferred = new Set(preferredKnowledgePointIds)
  return [...templates].sort(
    (left, right) =>
      Number(preferred.has(right.classification.knowledgePointId)) -
      Number(preferred.has(left.classification.knowledgePointId)),
  )
}

function spreadAcrossUnits<T extends PaperTemplateLike>(
  templates: readonly T[],
  preferredKnowledgePointIds: readonly string[],
): T[] {
  const ordered = preferredTemplates(templates, preferredKnowledgePointIds)
  const byUnit = new Map<string, T[]>()
  for (const template of ordered) {
    const group = byUnit.get(template.classification.unitId) ?? []
    group.push(template)
    byUnit.set(template.classification.unitId, group)
  }
  const groups = [...byUnit.values()]
  const spread: T[] = []
  let offset = 0
  while (spread.length < ordered.length) {
    for (const group of groups) {
      const template = group[offset]
      if (template) spread.push(template)
    }
    offset += 1
  }
  return spread
}

function generateDistinctQuestion(
  template: PaperTemplateLike,
  seed: number,
  index: number,
  idPrefix: string,
  previous: PracticeQuestionInput | undefined,
  difficulty: Difficulty = template.difficulty,
  generate: QuestionGenerator = generateMathQuestion,
): PracticeQuestionInput {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const question = generate(
      template.id,
      deriveSeed(seed, index, attempt),
      `${idPrefix}-question-${index + 1}`,
      difficulty,
    )
    if (
      previous?.question.templateId !== question.templateId ||
      previous.question.prompt !== question.prompt
    ) {
      return { question }
    }
  }
  throw new Error(`无法为模板 ${template.id} 生成不同数字的相邻题`)
}

interface ComprehensiveOptions {
  courseId: string
  total?: number
  seed: number
  idPrefix: string
  preferredKnowledgePointIds?: readonly string[]
  retestPool?: readonly RetestPoolEntry[]
}

export function generateComprehensivePaper(options: ComprehensiveOptions): PracticePaper {
  assertSeed(options.seed)
  assertIdPrefix(options.idPrefix)
  const total = options.total ?? LEARNING_RULES.dailyTask.defaultGoal
  const course = getCourseById(options.courseId)
  if (course?.subject === 'english') {
    return assembleComprehensivePaper(options, {
      blueprint: scaleEnglishBlueprint(total),
      sequence: ENGLISH_CATEGORY_SEQUENCE,
      labels: ENGLISH_CATEGORY_LABELS,
      templates: filterEnglishTemplates({ courseId: options.courseId, includeReview: false }),
      generate: generateEnglishQuestion,
      spreadCategory: 'situationalExpression',
    })
  }
  return assembleComprehensivePaper(options, {
    blueprint: scaleMathBlueprint(total),
    sequence: CATEGORY_SEQUENCE,
    labels: CATEGORY_LABELS,
    templates: filterMathTemplates({ courseId: options.courseId, includeReview: false }),
    generate: generateMathQuestion,
    spreadCategory: 'wordProblems',
  })
}

function assembleComprehensivePaper<C extends string>(
  options: ComprehensiveOptions,
  config: {
    blueprint: Record<C, number>
    sequence: readonly C[]
    labels: Record<C, string>
    templates: readonly (PaperTemplateLike & { paperCategory: C })[]
    generate: QuestionGenerator
    spreadCategory: C
  },
): PracticePaper {
  const { blueprint, sequence, labels, templates: courseTemplates, generate, spreadCategory } = config
  if (courseTemplates.length === 0) throw new Error('该课程没有可用练习内容')
  const preferred = options.preferredKnowledgePointIds ?? []
  const pools = new Map<C, PaperTemplateLike[]>()
  for (const category of sequence) {
    if (blueprint[category] === 0) continue
    const templates = courseTemplates.filter((template) => template.paperCategory === category)
    if (templates.length === 0) {
      throw new Error(`该课程缺少${labels[category]}内容，暂不能组综合卷`)
    }
    pools.set(
      category,
      category === spreadCategory
        ? spreadAcrossUnits(templates, preferred)
        : preferredTemplates(templates, preferred),
    )
  }
  const occurrences: Partial<Record<C, number>> = {}
  const questions: PracticeQuestionInput[] = []
  for (const [index, category] of categorySequence(blueprint, sequence).entries()) {
    const templates = pools.get(category) as PaperTemplateLike[]
    const occurrence = occurrences[category] ?? 0
    const template = templates[occurrence % templates.length]
    questions.push(
      generateDistinctQuestion(
        template,
        options.seed,
        index,
        options.idPrefix,
        questions.at(-1),
        template.difficulty,
        generate,
      ),
    )
    occurrences[category] = occurrence + 1
  }
  return {
    mode: 'comprehensive',
    // 调用方仅传入数学或英语蓝图，泛型 Record 无法直接窄化
    blueprint: blueprint as MathPaperBlueprint | EnglishPaperBlueprint,
    questions: injectRetestsIntoPaper(questions, options.retestPool ?? [], options.idPrefix),
  }
}

export function generateSpecialPaper(options: {
  courseId: string
  unitId?: string
  knowledgePointId?: string
  ability?: LearningAbility
  questionType?: QuestionType
  difficulty: Difficulty
  seed: number
  idPrefix: string
  size?: number
  retestPool?: readonly RetestPoolEntry[]
}): PracticePaper {
  assertSeed(options.seed)
  assertIdPrefix(options.idPrefix)
  const isEnglish = getCourseById(options.courseId)?.subject === 'english'
  if (isEnglish) {
    if (!options.unitId && !options.knowledgePointId && !options.ability)
      throw new Error('专项练习必须选择知识模块、知识点或专项能力')
  } else if (!options.unitId && !options.knowledgePointId) {
    throw new Error('专项练习必须选择知识模块或知识点')
  }
  const size = options.size ?? LEARNING_RULES.paper.specialPracticeSize
  if (!Number.isInteger(size) || size < 1) throw new Error('专项题量必须是正整数')
  const baseFilter = {
    courseId: options.courseId,
    unitId: options.unitId,
    knowledgePointId: options.knowledgePointId,
    difficulty: options.difficulty,
    includeReview: false,
  }
  const templates: readonly PaperTemplateLike[] = isEnglish
    ? filterEnglishTemplates({
        ...baseFilter,
        ability: options.ability,
        questionType: options.questionType,
      })
    : filterMathTemplates({ ...baseFilter, questionType: options.questionType })
  if (templates.length === 0) {
    const withoutType = isEnglish
      ? filterEnglishTemplates({ ...baseFilter, ability: options.ability })
      : filterMathTemplates(baseFilter)
    if (options.questionType && withoutType.length > 0) {
      throw new Error('所选知识点没有该题型，请更换题型或条件')
    }
    throw new Error('所选知识点与难度没有可用题目')
  }
  const generate = isEnglish ? generateEnglishQuestion : generateMathQuestion
  const questions: PracticeQuestionInput[] = []
  for (let index = 0; index < size; index += 1) {
    const template = templates[index % templates.length]
    questions.push(
      generateDistinctQuestion(
        template,
        options.seed,
        index,
        options.idPrefix,
        questions.at(-1),
        options.difficulty,
        generate,
      ),
    )
  }
  return {
    mode: 'special',
    questions: injectRetestsIntoPaper(questions, options.retestPool ?? [], options.idPrefix),
  }
}
