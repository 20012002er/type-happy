import { GRADE5_SPRING_ENGLISH_COURSE } from '../content/course-registry'
import { defineEnglishUnitTemplates, type EnglishQuestionTemplate } from './english-template-kit'

export const GRADE5_SPRING_ENGLISH_TEMPLATES: readonly EnglishQuestionTemplate[] = [
  ...defineEnglishUnitTemplates(GRADE5_SPRING_ENGLISH_COURSE, {
    unitId: 'g5s-english-my-day',
    knowledgePointPrefix: 'g5s-english-my-day',
  }),
  ...defineEnglishUnitTemplates(GRADE5_SPRING_ENGLISH_COURSE, {
    unitId: 'g5s-english-my-favourite-season',
    knowledgePointPrefix: 'g5s-english-my-favourite-season',
  }),
  ...defineEnglishUnitTemplates(GRADE5_SPRING_ENGLISH_COURSE, {
    unitId: 'g5s-english-my-school-calendar',
    knowledgePointPrefix: 'g5s-english-my-school-calendar',
  }),
  ...defineEnglishUnitTemplates(GRADE5_SPRING_ENGLISH_COURSE, {
    unitId: 'g5s-english-when-is-the-art-show',
    knowledgePointPrefix: 'g5s-english-when-is-the-art-show',
  }),
  ...defineEnglishUnitTemplates(GRADE5_SPRING_ENGLISH_COURSE, {
    unitId: 'g5s-english-whose-dog-is-it',
    knowledgePointPrefix: 'g5s-english-whose-dog-is-it',
  }),
  ...defineEnglishUnitTemplates(GRADE5_SPRING_ENGLISH_COURSE, {
    unitId: 'g5s-english-work-quietly',
    knowledgePointPrefix: 'g5s-english-work-quietly',
  }),
]