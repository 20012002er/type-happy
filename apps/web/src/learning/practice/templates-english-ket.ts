import { KET_CORE_VOCABULARY_COURSE } from '../content/ket-vocabulary'
import { defineEnglishUnitTemplates, type EnglishQuestionTemplate } from './english-template-kit'

/** KET 词汇级别：每单元固定五模板，随课程单元表扩充自动增长。 */
export const KET_CORE_VOCABULARY_TEMPLATES: readonly EnglishQuestionTemplate[] =
  KET_CORE_VOCABULARY_COURSE.units.flatMap((unit) =>
    defineEnglishUnitTemplates(KET_CORE_VOCABULARY_COURSE, {
      unitId: unit.id,
      knowledgePointPrefix: unit.id,
    }),
  )
