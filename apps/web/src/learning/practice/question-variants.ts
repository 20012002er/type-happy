import { parseQuestionSnapshot } from '../contracts'
import type { QuestionSnapshot } from '../types'
import { isMathTemplateDisabled } from './content-health'
import { createRetestQuestion, generateMathQuestion } from './math-generator'
import { filterMathTemplates, MATH_TEMPLATES } from './math-templates'

export type VariantGenerator = (
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
) => QuestionSnapshot

const variantGenerators = new Map<string, VariantGenerator>()

export function registerVariantGenerator(templateId: string, generator: VariantGenerator): void {
  if (templateId.trim().length === 0) throw new Error('变式模板 ID 不能为空')
  if (variantGenerators.has(templateId)) {
    throw new Error(`模板 ${templateId} 已注册变式生成器`)
  }
  variantGenerators.set(templateId, generator)
}

export function hasVariantGenerator(templateId: string): boolean {
  return variantGenerators.has(templateId) || MATH_TEMPLATES.some((item) => item.id === templateId)
}

function assertVariant(original: QuestionSnapshot, variant: QuestionSnapshot): void {
  parseQuestionSnapshot(variant)
  if (variant.instanceId === original.instanceId) {
    throw new Error('变式题必须使用新的题目实例 ID')
  }
  if (
    variant.classification.courseId !== original.classification.courseId ||
    variant.classification.knowledgePointId !== original.classification.knowledgePointId
  ) {
    throw new Error('变式题必须保持相同课程与知识点')
  }
  if (variant.difficulty !== original.difficulty) throw new Error('变式题必须保持相同难度')
  if (variant.type !== original.type) throw new Error('变式题必须保持相同题型')
}

function withVariantOrigin(
  original: QuestionSnapshot,
  variant: QuestionSnapshot,
): QuestionSnapshot {
  return {
    ...variant,
    variantOf: { templateId: original.templateId, instanceId: original.instanceId },
  }
}

function generateRegisteredVariant(
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
): QuestionSnapshot {
  const generator = variantGenerators.get(original.templateId)
  if (!generator) throw new Error(`模板 ${original.templateId} 没有可用的变式生成器`)
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('变式种子必须是非负安全整数')
  if (instanceId.trim().length === 0) throw new Error('变式实例 ID 不能为空')
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generator(original, seed + attempt, instanceId)
    assertVariant(original, candidate)
    if (candidate.prompt !== original.prompt) return withVariantOrigin(original, candidate)
  }
  throw new Error('无法生成不同题干或情境的变式')
}

export function createChoiceVariant(
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
): QuestionSnapshot {
  if (original.type !== 'single-choice') throw new Error('只有选择题使用变式订正')
  return generateRegisteredVariant(original, seed, instanceId)
}

export function createQuestionVariant(
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
): QuestionSnapshot {
  if (isMathTemplateDisabled(original.templateId)) {
    return createReplacementForDisabledTemplate(original, seed, instanceId)
  }
  if (MATH_TEMPLATES.some((item) => item.id === original.templateId)) {
    return createRetestQuestion(original, seed, instanceId)
  }
  return generateRegisteredVariant(original, seed, instanceId)
}

/** 模板停用后优先用同知识点模板换题；没有时退回同单元同题型，仍保持课程与难度不变。 */
function createReplacementForDisabledTemplate(
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
): QuestionSnapshot {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('变式种子必须是非负安全整数')
  if (instanceId.trim().length === 0) throw new Error('变式实例 ID 不能为空')
  const baseFilter = {
    courseId: original.classification.courseId,
    questionType: original.type,
    difficulty: original.difficulty,
    includeReview: false,
  }
  const sameKnowledgePoint = filterMathTemplates({
    ...baseFilter,
    knowledgePointId: original.classification.knowledgePointId,
  }).filter((template) => template.id !== original.templateId)
  const candidates =
    sameKnowledgePoint.length > 0
      ? sameKnowledgePoint
      : filterMathTemplates({ ...baseFilter, unitId: original.classification.unitId }).filter(
          (template) => template.id !== original.templateId,
        )
  if (candidates.length === 0) throw new Error('该知识点没有可替换的题目模板')
  const template = candidates[seed % candidates.length]
  const replacement = generateMathQuestion(template.id, seed, instanceId, original.difficulty)
  if (
    replacement.classification.courseId !== original.classification.courseId ||
    replacement.difficulty !== original.difficulty ||
    replacement.type !== original.type
  ) {
    throw new Error('替换题必须保持相同课程、难度与题型')
  }
  return withVariantOrigin(original, replacement)
}
