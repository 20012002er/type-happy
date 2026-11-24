import { GRADE4_SPRING_ENGLISH_COURSE } from '../content/course-registry'
import { defineEnglishUnitTemplates, type EnglishQuestionTemplate } from './english-template-kit'

export const GRADE4_SPRING_ENGLISH_TEMPLATES: readonly EnglishQuestionTemplate[] = [
  ...defineEnglishUnitTemplates(GRADE4_SPRING_ENGLISH_COURSE, {
    unitId: 'g4s-english-my-school',
    knowledgePointPrefix: 'g4s-english-my-school',
  }),
  ...defineEnglishUnitTemplates(GRADE4_SPRING_ENGLISH_COURSE, {
    unitId: 'g4s-english-what-time-is-it',
    knowledgePointPrefix: 'g4s-english-what-time',
  }),
  ...defineEnglishUnitTemplates(GRADE4_SPRING_ENGLISH_COURSE, {
    unitId: 'g4s-english-weather',
    knowledgePointPrefix: 'g4s-english-weather',
  }),
  ...defineEnglishUnitTemplates(GRADE4_SPRING_ENGLISH_COURSE, {
    unitId: 'g4s-english-at-the-farm',
    knowledgePointPrefix: 'g4s-english-at-the-farm',
  }),
  ...defineEnglishUnitTemplates(GRADE4_SPRING_ENGLISH_COURSE, {
    unitId: 'g4s-english-my-clothes',
    knowledgePointPrefix: 'g4s-english-my-clothes',
  }),
  ...defineEnglishUnitTemplates(GRADE4_SPRING_ENGLISH_COURSE, {
    unitId: 'g4s-english-shopping',
    knowledgePointPrefix: 'g4s-english-shopping',
  }),
]