import { parseQuestionTemplate } from '../contracts'
import type { Course, Difficulty, QuestionOption, QuestionTemplate, QuestionType } from '../types'

export type MathPaperCategory =
  'calculation' | 'singleChoice' | 'knowledgeApplication' | 'wordProblems'

export interface MathQuestionTemplate extends QuestionTemplate {
  generator: string
  supportedDifficulties: readonly Difficulty[]
  review: boolean
  paperCategory: MathPaperCategory
}

export interface MathTemplateSpec {
  id: string
  knowledgePointId: string
  unitId: string
  generator: string
  type: QuestionType
  difficulty: Difficulty
  supportedDifficulties: readonly Difficulty[]
  promptTemplate: string
  paperCategory: MathPaperCategory
  options?: readonly QuestionOption[]
}

export function defineMathTemplate(course: Course, spec: MathTemplateSpec): MathQuestionTemplate {
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
