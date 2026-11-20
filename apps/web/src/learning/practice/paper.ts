import { LEARNING_RULES } from '../config/rules'
import type { Difficulty } from '../types'
import { generateMathQuestion } from './math-generator'
import { filterMathTemplates, type MathQuestionTemplate } from './math-templates'
import type { PracticeMode, PracticeQuestionInput } from './practice-session'
import { injectRetestsIntoPaper, type RetestPoolEntry } from './retest'

export type PaperCategory = keyof typeof LEARNING_RULES.paper.defaultBlueprint
export type PaperBlueprint = Record<PaperCategory, number>

export interface PracticePaper {
  mode: PracticeMode
  blueprint?: PaperBlueprint
  questions: readonly PracticeQuestionInput[]
}

const CATEGORY_UNITS: Record<PaperCategory, string> = {
  oralCalculation: 'oral-calculation',
  writtenMultiplication: 'written-multiplication',
  writtenDivision: 'written-division',
  changeRules: 'change-rules',
  estimationVerification: 'estimation-verification',
}

const CATEGORY_SEQUENCE = Object.keys(CATEGORY_UNITS) as PaperCategory[]

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

export function scalePaperBlueprint(total: number): PaperBlueprint {
  const { minimumGoal, maximumGoal } = LEARNING_RULES.dailyTask
  if (!Number.isInteger(total) || total < minimumGoal || total > maximumGoal) {
    throw new Error(`组卷题量必须是 ${minimumGoal}–${maximumGoal} 的整数`)
  }
  const blueprint = {} as PaperBlueprint
  const defaultTotal = LEARNING_RULES.dailyTask.defaultGoal
  let assigned = 0
  for (const category of CATEGORY_SEQUENCE) {
    const count = Math.floor(
      (LEARNING_RULES.paper.defaultBlueprint[category] * total) / defaultTotal,
    )
    blueprint[category] = count
    assigned += count
  }
  let remaining = total - assigned
  let index = 0
  while (remaining > 0) {
    const category = LEARNING_RULES.paper.refillOrder[
      index % LEARNING_RULES.paper.refillOrder.length
    ] as PaperCategory
    blueprint[category] += 1
    remaining -= 1
    index += 1
  }
  if (blueprint.changeRules < LEARNING_RULES.paper.minimumChangeRules) {
    throw new Error('规律题数量低于组卷下限')
  }
  if (blueprint.estimationVerification < LEARNING_RULES.paper.minimumEstimationVerification) {
    throw new Error('估算与验算题数量低于组卷下限')
  }
  return blueprint
}

function categorySequence(blueprint: PaperBlueprint): PaperCategory[] {
  const remaining = { ...blueprint }
  const sequence: PaperCategory[] = []
  let total = CATEGORY_SEQUENCE.reduce((sum, category) => sum + remaining[category], 0)
  while (total > 0) {
    for (const category of CATEGORY_SEQUENCE) {
      if (remaining[category] === 0) continue
      sequence.push(category)
      remaining[category] -= 1
      total -= 1
    }
  }
  return sequence
}

function preferredTemplates(
  templates: readonly MathQuestionTemplate[],
  preferredKnowledgePointIds: readonly string[],
): MathQuestionTemplate[] {
  const preferred = new Set(preferredKnowledgePointIds)
  return [...templates].sort(
    (left, right) =>
      Number(preferred.has(right.classification.knowledgePointId)) -
      Number(preferred.has(left.classification.knowledgePointId)),
  )
}

function generateDistinctQuestion(
  template: MathQuestionTemplate,
  seed: number,
  index: number,
  idPrefix: string,
  previous: PracticeQuestionInput | undefined,
  difficulty: Difficulty = template.difficulty,
): PracticeQuestionInput {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const question = generateMathQuestion(
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

export function generateComprehensivePaper(options: {
  total?: number
  seed: number
  idPrefix: string
  preferredKnowledgePointIds?: readonly string[]
  retestPool?: readonly RetestPoolEntry[]
}): PracticePaper {
  assertSeed(options.seed)
  assertIdPrefix(options.idPrefix)
  const total = options.total ?? LEARNING_RULES.dailyTask.defaultGoal
  const blueprint = scalePaperBlueprint(total)
  const occurrences: Partial<Record<PaperCategory, number>> = {}
  const questions: PracticeQuestionInput[] = []
  for (const [index, category] of categorySequence(blueprint).entries()) {
    const templates = preferredTemplates(
      filterMathTemplates({ unitId: CATEGORY_UNITS[category], includeReview: false }),
      options.preferredKnowledgePointIds ?? [],
    )
    const occurrence = occurrences[category] ?? 0
    const template = templates[occurrence % templates.length]
    questions.push(
      generateDistinctQuestion(template, options.seed, index, options.idPrefix, questions.at(-1)),
    )
    occurrences[category] = occurrence + 1
  }
  return {
    mode: 'comprehensive',
    blueprint,
    questions: injectRetestsIntoPaper(questions, options.retestPool ?? [], options.idPrefix),
  }
}

export function generateSpecialPaper(options: {
  unitId?: string
  knowledgePointId?: string
  difficulty: Difficulty
  seed: number
  idPrefix: string
  size?: number
  retestPool?: readonly RetestPoolEntry[]
}): PracticePaper {
  assertSeed(options.seed)
  assertIdPrefix(options.idPrefix)
  if (!options.unitId && !options.knowledgePointId)
    throw new Error('专项练习必须选择知识模块或知识点')
  const size = options.size ?? LEARNING_RULES.paper.specialPracticeSize
  if (!Number.isInteger(size) || size < 1) throw new Error('专项题量必须是正整数')
  const templates = filterMathTemplates({
    unitId: options.unitId,
    knowledgePointId: options.knowledgePointId,
    difficulty: options.difficulty,
    includeReview: false,
  })
  if (templates.length === 0) throw new Error('所选知识点与难度没有可用题目')
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
      ),
    )
  }
  return {
    mode: 'special',
    questions: injectRetestsIntoPaper(questions, options.retestPool ?? [], options.idPrefix),
  }
}
