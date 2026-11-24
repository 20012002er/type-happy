import { parseQuestionTemplate } from '../contracts'
import type { Course, Difficulty, QuestionOption, QuestionTemplate, QuestionType } from '../types'

export type EnglishPaperCategory =
  | 'singleChoice'
  | 'spelling'
  | 'sentenceCompletion'
  | 'situationalExpression'

export interface EnglishQuestionTemplate extends QuestionTemplate {
  generator: string
  supportedDifficulties: readonly Difficulty[]
  review: boolean
  paperCategory: EnglishPaperCategory
}

export interface EnglishTemplateSpec {
  id: string
  knowledgePointId: string
  unitId: string
  generator: string
  type: QuestionType
  difficulty: Difficulty
  supportedDifficulties: readonly Difficulty[]
  promptTemplate: string
  paperCategory: EnglishPaperCategory
  options?: readonly QuestionOption[]
}

/** 单选题模板的声明式占位选项；实例选项由生成器按种子产出并覆盖。 */
const CHOICE_PLACEHOLDER_OPTIONS: readonly QuestionOption[] = [
  { id: 'opt-a', text: '选项一' },
  { id: 'opt-b', text: '选项二' },
  { id: 'opt-c', text: '选项三' },
  { id: 'opt-d', text: '选项四' },
]

export interface EnglishUnitTemplateSpec {
  unitId: string
  /** 知识点 ID 前缀，拼接 -vocabulary/-sentences/-context。 */
  knowledgePointPrefix: string
}

/** 每个单元固定五个模板：拼写、词义选择、句型语法选择、句子补全、情境表达。 */
export function defineEnglishUnitTemplates(
  course: Course,
  spec: EnglishUnitTemplateSpec,
): readonly EnglishQuestionTemplate[] {
  const prefix = spec.knowledgePointPrefix
  return [
    defineEnglishTemplate(course, {
      id: `${prefix}-spelling-v1`,
      knowledgePointId: `${prefix}-vocabulary`,
      unitId: spec.unitId,
      generator: 'english-vocab-spelling',
      type: 'english-spelling',
      difficulty: 'L1',
      supportedDifficulties: ['L1', 'L2'],
      promptTemplate: '根据中文释义和英语语境写出单词',
      paperCategory: 'spelling',
    }),
    defineEnglishTemplate(course, {
      id: `${prefix}-vocab-choice-v1`,
      knowledgePointId: `${prefix}-vocabulary`,
      unitId: spec.unitId,
      generator: 'english-vocab-choice',
      type: 'single-choice',
      difficulty: 'L1',
      supportedDifficulties: ['L1', 'L2'],
      promptTemplate: '选出与中文释义对应的英语单词',
      paperCategory: 'singleChoice',
      options: CHOICE_PLACEHOLDER_OPTIONS,
    }),
    defineEnglishTemplate(course, {
      id: `${prefix}-grammar-choice-v1`,
      knowledgePointId: `${prefix}-sentences`,
      unitId: spec.unitId,
      generator: 'english-grammar-choice',
      type: 'single-choice',
      difficulty: 'L2',
      supportedDifficulties: ['L1', 'L2', 'L3'],
      promptTemplate: '选出符合句型语法的选项',
      paperCategory: 'singleChoice',
      options: CHOICE_PLACEHOLDER_OPTIONS,
    }),
    defineEnglishTemplate(course, {
      id: `${prefix}-completion-v1`,
      knowledgePointId: `${prefix}-sentences`,
      unitId: spec.unitId,
      generator: 'english-sentence-completion',
      type: 'sentence-completion',
      difficulty: 'L2',
      supportedDifficulties: ['L2', 'L3'],
      promptTemplate: '根据语境补全句子',
      paperCategory: 'sentenceCompletion',
    }),
    defineEnglishTemplate(course, {
      id: `${prefix}-situation-v1`,
      knowledgePointId: `${prefix}-context`,
      unitId: spec.unitId,
      generator: 'english-situational-choice',
      type: 'single-choice',
      difficulty: 'L2',
      supportedDifficulties: ['L2', 'L3'],
      promptTemplate: '根据中文情境选择恰当的英语表达',
      paperCategory: 'situationalExpression',
      options: CHOICE_PLACEHOLDER_OPTIONS,
    }),
  ]
}

export function defineEnglishTemplate(
  course: Course,
  spec: EnglishTemplateSpec,
): EnglishQuestionTemplate {
  const point = course.knowledgePoints.find((item) => item.id === spec.knowledgePointId)
  if (!point) throw new Error(`模板知识点不存在：${spec.knowledgePointId}`)
  if (point.unitId !== spec.unitId) throw new Error(`模板单元与知识点不一致：${spec.id}`)
  const base = parseQuestionTemplate(
    {
      id: spec.id,
      version: 1,
      classification: {
        courseId: course.id,
        subject: course.subject,
        grade: course.grade,
        semester: course.semester,
        textbook: course.textbook,
        unitId: spec.unitId,
        knowledgePointId: spec.knowledgePointId,
        ...(point.ability ? { ability: point.ability } : {}),
      },
      type: spec.type,
      difficulty: spec.difficulty,
      promptTemplate: spec.promptTemplate,
      ...(spec.options ? { options: spec.options } : {}),
    },
    course,
  )
  return {
    ...base,
    generator: spec.generator,
    supportedDifficulties: spec.supportedDifficulties,
    review: point.source === 'review',
    paperCategory: spec.paperCategory,
  }
}