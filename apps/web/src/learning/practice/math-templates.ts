import { GRADE4_AUTUMN_MATH_COURSE } from '../content/grade4-math'
import type { Difficulty, QuestionOption, QuestionType } from '../types'
import { isMathTemplateDisabled } from './content-health'
import {
  defineMathTemplate,
  type MathPaperCategory,
  type MathQuestionTemplate,
} from './math-template-kit'
import { GRADE4_SPRING_MATH_TEMPLATES } from './templates-grade4-spring'
import { GRADE5_AUTUMN_MATH_TEMPLATES } from './templates-grade5-autumn'
import { GRADE5_SPRING_MATH_TEMPLATES } from './templates-grade5-spring'

export type { MathPaperCategory, MathQuestionTemplate } from './math-template-kit'

function grade4Autumn(
  id: string,
  knowledgePointId: string,
  unitId: string,
  generator: string,
  type: QuestionType,
  difficulty: Difficulty,
  supportedDifficulties: readonly Difficulty[],
  promptTemplate: string,
  paperCategory: MathPaperCategory = 'calculation',
  options?: readonly QuestionOption[],
): MathQuestionTemplate {
  return defineMathTemplate(GRADE4_AUTUMN_MATH_COURSE, {
    id,
    knowledgePointId,
    unitId,
    generator,
    type,
    difficulty,
    supportedDifficulties,
    promptTemplate,
    paperCategory,
    ...(options ? { options } : {}),
  })
}

/** 选择题模板的声明式选项；实例选项由生成器按种子产出并覆盖。 */
const RULE_CHOICE_OPTIONS: readonly QuestionOption[] = [
  { id: 'opt-a', text: '按相同倍数变化' },
  { id: 'opt-b', text: '按相反方向变化' },
  { id: 'opt-c', text: '不变' },
  { id: 'opt-d', text: '无法确定' },
]

const ESTIMATE_CHOICE_OPTIONS: readonly QuestionOption[] = [
  { id: 'opt-a', text: '用四舍五入后的近似数相乘' },
  { id: 'opt-b', text: '近似数取值错误' },
  { id: 'opt-c', text: '只近似一个乘数' },
  { id: 'opt-d', text: '用原数精确计算' },
]

const GRADE4_AUTUMN_TEMPLATES: readonly MathQuestionTemplate[] = [
  grade4Autumn(
    'oral-mul-one-v1',
    'oral-multiplication-by-one-digit',
    'oral-calculation',
    'oral-multiplication-one',
    'number',
    'L1',
    ['L1', 'L2'],
    '{a} × {b} = ?',
  ),
  grade4Autumn(
    'oral-mul-tens-v1',
    'oral-multiplication-by-tens',
    'oral-calculation',
    'oral-multiplication-tens',
    'number',
    'L1',
    ['L1', 'L2'],
    '{a} × {b} = ?',
  ),
  grade4Autumn(
    'oral-div-tens-v1',
    'oral-division-by-tens',
    'oral-calculation',
    'oral-division-tens',
    'number',
    'L1',
    ['L1', 'L2'],
    '{dividend} ÷ {divisor} = ?',
  ),
  grade4Autumn(
    'written-mul-two-v1',
    'written-multiplication-two-digits',
    'written-multiplication',
    'written-multiplication-two',
    'number',
    'L2',
    ['L1', 'L2', 'L3'],
    '{a} × {b} = ?',
  ),
  grade4Autumn(
    'written-mul-three-v1',
    'written-multiplication-three-by-two',
    'written-multiplication',
    'written-multiplication-three',
    'number',
    'L2',
    ['L1', 'L2', 'L3'],
    '{a} × {b} = ?',
  ),
  grade4Autumn(
    'written-mul-zero-v1',
    'written-multiplication-with-zero',
    'written-multiplication',
    'written-multiplication-zero',
    'number',
    'L2',
    ['L1', 'L2', 'L3'],
    '{a} × {b} = ?',
  ),
  grade4Autumn(
    'written-div-v1',
    'written-division-by-two-digits',
    'written-division',
    'written-division',
    'quotient-remainder',
    'L2',
    ['L1', 'L2', 'L3'],
    '{dividend} ÷ {divisor}，商和余数分别是多少？',
  ),
  grade4Autumn(
    'trial-div-v1',
    'trial-quotient-and-adjustment',
    'written-division',
    'trial-division',
    'quotient-remainder',
    'L2',
    ['L1', 'L2', 'L3'],
    '{dividend} ÷ {divisor}，试商并写出商和余数。',
  ),
  grade4Autumn(
    'remainder-div-v1',
    'division-with-remainder',
    'written-division',
    'remainder-division',
    'quotient-remainder',
    'L2',
    ['L1', 'L2', 'L3'],
    '{dividend} ÷ {divisor}，商和余数分别是多少？',
  ),
  grade4Autumn(
    'product-rule-v1',
    'product-change-rule',
    'change-rules',
    'product-rule',
    'number',
    'L3',
    ['L2', 'L3'],
    '根据已知积求变化后的积',
  ),
  grade4Autumn(
    'quotient-rule-v1',
    'quotient-change-rule',
    'change-rules',
    'quotient-rule',
    'number',
    'L3',
    ['L2', 'L3'],
    '根据已知商求变化后的商',
  ),
  grade4Autumn(
    'mul-estimate-v1',
    'multiplication-estimation',
    'estimation-verification',
    'multiplication-estimation',
    'number',
    'L2',
    ['L2', 'L3'],
    '按指定估法估算积',
  ),
  grade4Autumn(
    'div-estimate-v1',
    'division-estimation-verification',
    'estimation-verification',
    'division-estimation',
    'number',
    'L2',
    ['L2', 'L3'],
    '按指定估法估算商',
  ),
  grade4Autumn(
    'div-verify-v1',
    'division-estimation-verification',
    'estimation-verification',
    'division-verification',
    'number',
    'L2',
    ['L2', 'L3'],
    '用乘法验算除法',
  ),
  grade4Autumn(
    'prior-review-v1',
    'prior-basic-calculation-review',
    'prior-review',
    'prior-review',
    'number',
    'L1',
    ['L1'],
    '{a} × {b} = ?',
  ),
  grade4Autumn(
    'product-rule-choice-v1',
    'product-change-rule',
    'change-rules',
    'product-rule-choice',
    'single-choice',
    'L2',
    ['L2', 'L3'],
    '根据积的变化规律选择正确答案',
    'singleChoice',
    RULE_CHOICE_OPTIONS,
  ),
  grade4Autumn(
    'quotient-rule-choice-v1',
    'quotient-change-rule',
    'change-rules',
    'quotient-rule-choice',
    'single-choice',
    'L2',
    ['L2', 'L3'],
    '根据商的变化规律选择正确答案',
    'singleChoice',
    RULE_CHOICE_OPTIONS,
  ),
  grade4Autumn(
    'estimate-method-choice-v1',
    'multiplication-estimation',
    'estimation-verification',
    'estimate-method-choice',
    'single-choice',
    'L2',
    ['L2', 'L3'],
    '选择最合适的估算方法',
    'singleChoice',
    ESTIMATE_CHOICE_OPTIONS,
  ),
  grade4Autumn(
    'product-rule-blank-v1',
    'product-change-rule',
    'change-rules',
    'product-rule-blank',
    'fill-blanks',
    'L2',
    ['L2', 'L3'],
    '按积的变化规律填空',
    'knowledgeApplication',
  ),
  grade4Autumn(
    'quotient-rule-blank-v1',
    'quotient-change-rule',
    'change-rules',
    'quotient-rule-blank',
    'fill-blanks',
    'L2',
    ['L2', 'L3'],
    '按商的变化规律填空',
    'knowledgeApplication',
  ),
  grade4Autumn(
    'shopping-estimate-word-v1',
    'multiplication-estimation',
    'estimation-verification',
    'shopping-estimate-word',
    'word-problem',
    'L2',
    ['L2', 'L3'],
    '按指定估法估算购物总价',
    'wordProblems',
  ),
  grade4Autumn(
    'shopping-multiplication-word-v1',
    'written-multiplication-three-by-two',
    'written-multiplication',
    'shopping-multiplication-word',
    'word-problem',
    'L2',
    ['L2', 'L3'],
    '用三位数乘两位数解决购物问题',
    'wordProblems',
  ),
]

export const MATH_TEMPLATES: readonly MathQuestionTemplate[] = [
  ...GRADE4_AUTUMN_TEMPLATES,
  ...GRADE4_SPRING_MATH_TEMPLATES,
  ...GRADE5_AUTUMN_MATH_TEMPLATES,
  ...GRADE5_SPRING_MATH_TEMPLATES,
]

export function getMathTemplate(templateId: string): MathQuestionTemplate {
  const template = MATH_TEMPLATES.find((item) => item.id === templateId)
  if (!template) throw new Error(`未知数学题目模板：${templateId}`)
  return template
}

export function filterMathTemplates(filter: {
  courseId?: string
  knowledgePointId?: string
  unitId?: string
  questionType?: QuestionType
  difficulty?: Difficulty
  includeReview?: boolean
}): readonly MathQuestionTemplate[] {
  return MATH_TEMPLATES.filter(
    (template) =>
      !isMathTemplateDisabled(template.id) &&
      (!filter.courseId || template.classification.courseId === filter.courseId) &&
      (!filter.knowledgePointId ||
        template.classification.knowledgePointId === filter.knowledgePointId) &&
      (!filter.unitId || template.classification.unitId === filter.unitId) &&
      (!filter.questionType || template.type === filter.questionType) &&
      (!filter.difficulty || template.supportedDifficulties.includes(filter.difficulty)) &&
      (filter.includeReview !== false || !template.review),
  )
}
