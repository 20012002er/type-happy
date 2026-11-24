import { GRADE5_AUTUMN_ENGLISH_COURSE } from '../content/course-registry'
import { defineEnglishUnitTemplates, type EnglishQuestionTemplate } from './english-template-kit'

export const GRADE5_AUTUMN_ENGLISH_TEMPLATES: readonly EnglishQuestionTemplate[] = [
  ...defineEnglishUnitTemplates(GRADE5_AUTUMN_ENGLISH_COURSE, {
    unitId: 'g5a-english-whats-he-like',
    knowledgePointPrefix: 'g5a-english-whats-he-like',
  }),
  ...defineEnglishUnitTemplates(GRADE5_AUTUMN_ENGLISH_COURSE, {
    unitId: 'g5a-english-my-week',
    knowledgePointPrefix: 'g5a-english-my-week',
  }),
  ...defineEnglishUnitTemplates(GRADE5_AUTUMN_ENGLISH_COURSE, {
    unitId: 'g5a-english-what-would-you-like',
    knowledgePointPrefix: 'g5a-english-what-would-you-like',
  }),
  ...defineEnglishUnitTemplates(GRADE5_AUTUMN_ENGLISH_COURSE, {
    unitId: 'g5a-english-what-can-you-do',
    knowledgePointPrefix: 'g5a-english-what-can-you-do',
  }),
  ...defineEnglishUnitTemplates(GRADE5_AUTUMN_ENGLISH_COURSE, {
    unitId: 'g5a-english-there-is-a-big-bed',
    knowledgePointPrefix: 'g5a-english-there-is-a-big-bed',
  }),
  ...defineEnglishUnitTemplates(GRADE5_AUTUMN_ENGLISH_COURSE, {
    unitId: 'g5a-english-in-a-nature-park',
    knowledgePointPrefix: 'g5a-english-in-a-nature-park',
  }),
]