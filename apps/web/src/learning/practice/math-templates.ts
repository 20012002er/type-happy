import { GRADE4_AUTUMN_MATH_COURSE } from '../content/grade4-math'
import { parseQuestionTemplate } from '../contracts'
import type { Difficulty, QuestionTemplate } from '../types'

export type MathGeneratorKind =
  | 'oral-multiplication-one'
  | 'oral-multiplication-tens'
  | 'oral-division-tens'
  | 'written-multiplication-two'
  | 'written-multiplication-three'
  | 'written-multiplication-zero'
  | 'written-division'
  | 'trial-division'
  | 'remainder-division'
  | 'product-rule'
  | 'quotient-rule'
  | 'multiplication-estimation'
  | 'division-estimation'
  | 'division-verification'
  | 'prior-review'

export interface MathQuestionTemplate extends QuestionTemplate {
  generator: MathGeneratorKind
  supportedDifficulties: readonly Difficulty[]
  review: boolean
}

function defineTemplate(
  id: string,
  knowledgePointId: string,
  unitId: string,
  generator: MathGeneratorKind,
  difficulty: Difficulty,
  supportedDifficulties: readonly Difficulty[],
  promptTemplate: string,
): MathQuestionTemplate {
  const base = parseQuestionTemplate(
    {
      id,
      version: 1,
      classification: {
        courseId: GRADE4_AUTUMN_MATH_COURSE.id,
        subject: 'math',
        grade: 4,
        semester: 'autumn',
        textbook: '人教版新旧融合',
        unitId,
        knowledgePointId,
      },
      type: ['written-division', 'trial-division', 'remainder-division'].includes(generator)
        ? 'quotient-remainder'
        : 'number',
      difficulty,
      promptTemplate,
    },
    GRADE4_AUTUMN_MATH_COURSE,
  )
  return {
    ...base,
    generator,
    supportedDifficulties,
    review: knowledgePointId === 'prior-basic-calculation-review',
  }
}

export const MATH_TEMPLATES: readonly MathQuestionTemplate[] = [
  defineTemplate(
    'oral-mul-one-v1',
    'oral-multiplication-by-one-digit',
    'oral-calculation',
    'oral-multiplication-one',
    'L1',
    ['L1', 'L2'],
    '{a} × {b} = ?',
  ),
  defineTemplate(
    'oral-mul-tens-v1',
    'oral-multiplication-by-tens',
    'oral-calculation',
    'oral-multiplication-tens',
    'L1',
    ['L1', 'L2'],
    '{a} × {b} = ?',
  ),
  defineTemplate(
    'oral-div-tens-v1',
    'oral-division-by-tens',
    'oral-calculation',
    'oral-division-tens',
    'L1',
    ['L1', 'L2'],
    '{dividend} ÷ {divisor} = ?',
  ),
  defineTemplate(
    'written-mul-two-v1',
    'written-multiplication-two-digits',
    'written-multiplication',
    'written-multiplication-two',
    'L2',
    ['L1', 'L2', 'L3'],
    '{a} × {b} = ?',
  ),
  defineTemplate(
    'written-mul-three-v1',
    'written-multiplication-three-by-two',
    'written-multiplication',
    'written-multiplication-three',
    'L2',
    ['L1', 'L2', 'L3'],
    '{a} × {b} = ?',
  ),
  defineTemplate(
    'written-mul-zero-v1',
    'written-multiplication-with-zero',
    'written-multiplication',
    'written-multiplication-zero',
    'L2',
    ['L1', 'L2', 'L3'],
    '{a} × {b} = ?',
  ),
  defineTemplate(
    'written-div-v1',
    'written-division-by-two-digits',
    'written-division',
    'written-division',
    'L2',
    ['L1', 'L2', 'L3'],
    '{dividend} ÷ {divisor}，商和余数分别是多少？',
  ),
  defineTemplate(
    'trial-div-v1',
    'trial-quotient-and-adjustment',
    'written-division',
    'trial-division',
    'L2',
    ['L1', 'L2', 'L3'],
    '{dividend} ÷ {divisor}，试商并写出商和余数。',
  ),
  defineTemplate(
    'remainder-div-v1',
    'division-with-remainder',
    'written-division',
    'remainder-division',
    'L2',
    ['L1', 'L2', 'L3'],
    '{dividend} ÷ {divisor}，商和余数分别是多少？',
  ),
  defineTemplate(
    'product-rule-v1',
    'product-change-rule',
    'change-rules',
    'product-rule',
    'L3',
    ['L2', 'L3'],
    '根据已知积求变化后的积',
  ),
  defineTemplate(
    'quotient-rule-v1',
    'quotient-change-rule',
    'change-rules',
    'quotient-rule',
    'L3',
    ['L2', 'L3'],
    '根据已知商求变化后的商',
  ),
  defineTemplate(
    'mul-estimate-v1',
    'multiplication-estimation',
    'estimation-verification',
    'multiplication-estimation',
    'L2',
    ['L2', 'L3'],
    '按指定估法估算积',
  ),
  defineTemplate(
    'div-estimate-v1',
    'division-estimation-verification',
    'estimation-verification',
    'division-estimation',
    'L2',
    ['L2', 'L3'],
    '按指定估法估算商',
  ),
  defineTemplate(
    'div-verify-v1',
    'division-estimation-verification',
    'estimation-verification',
    'division-verification',
    'L2',
    ['L2', 'L3'],
    '用乘法验算除法',
  ),
  defineTemplate(
    'prior-review-v1',
    'prior-basic-calculation-review',
    'prior-review',
    'prior-review',
    'L1',
    ['L1'],
    '{a} × {b} = ?',
  ),
]

export function getMathTemplate(templateId: string): MathQuestionTemplate {
  const template = MATH_TEMPLATES.find((item) => item.id === templateId)
  if (!template) throw new Error(`未知数学题目模板：${templateId}`)
  return template
}

export function filterMathTemplates(filter: {
  knowledgePointId?: string
  unitId?: string
  difficulty?: Difficulty
  includeReview?: boolean
}): readonly MathQuestionTemplate[] {
  return MATH_TEMPLATES.filter(
    (template) =>
      (!filter.knowledgePointId ||
        template.classification.knowledgePointId === filter.knowledgePointId) &&
      (!filter.unitId || template.classification.unitId === filter.unitId) &&
      (!filter.difficulty || template.supportedDifficulties.includes(filter.difficulty)) &&
      (filter.includeReview !== false || !template.review),
  )
}
