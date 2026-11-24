import type { Difficulty, LearningAbility, QuestionType } from '../types'
import type { EnglishQuestionTemplate } from './english-template-kit'
import { GRADE4_SPRING_ENGLISH_TEMPLATES } from './templates-english-grade4-spring'
import { GRADE5_AUTUMN_ENGLISH_TEMPLATES } from './templates-english-grade5-autumn'
import { GRADE5_SPRING_ENGLISH_TEMPLATES } from './templates-english-grade5-spring'

export type { EnglishPaperCategory, EnglishQuestionTemplate } from './english-template-kit'

export const ENGLISH_TEMPLATES: readonly EnglishQuestionTemplate[] = [
  ...GRADE4_SPRING_ENGLISH_TEMPLATES,
  ...GRADE5_AUTUMN_ENGLISH_TEMPLATES,
  ...GRADE5_SPRING_ENGLISH_TEMPLATES,
]

export function getEnglishTemplate(templateId: string): EnglishQuestionTemplate {
  const template = ENGLISH_TEMPLATES.find((item) => item.id === templateId)
  if (!template) throw new Error(`未知英语题目模板：${templateId}`)
  return template
}

export function filterEnglishTemplates(filter: {
  courseId?: string
  knowledgePointId?: string
  unitId?: string
  ability?: LearningAbility
  questionType?: QuestionType
  difficulty?: Difficulty
  includeReview?: boolean
}): readonly EnglishQuestionTemplate[] {
  return ENGLISH_TEMPLATES.filter(
    (template) =>
      (!filter.courseId || template.classification.courseId === filter.courseId) &&
      (!filter.knowledgePointId ||
        template.classification.knowledgePointId === filter.knowledgePointId) &&
      (!filter.unitId || template.classification.unitId === filter.unitId) &&
      (!filter.ability || template.classification.ability === filter.ability) &&
      (!filter.questionType || template.type === filter.questionType) &&
      (!filter.difficulty || template.supportedDifficulties.includes(filter.difficulty)) &&
      (filter.includeReview !== false || !template.review),
  )
}