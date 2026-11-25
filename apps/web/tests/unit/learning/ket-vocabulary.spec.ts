import { describe, expect, it } from 'vitest'
import { KET_CORE_VOCABULARY_COURSE } from '../../../src/learning/content/ket-vocabulary'
import { COURSE_REGISTRY, getCourseById } from '../../../src/learning/content/course-registry'
import { parseCourse } from '../../../src/learning/contracts'
import { generateEnglishQuestion } from '../../../src/learning/practice/english-generator'
import {
  ENGLISH_TEMPLATES,
  filterEnglishTemplates,
  getEnglishTemplate,
} from '../../../src/learning/practice/english-templates'
import {
  generateComprehensivePaper,
  generateSpecialPaper,
  hasPracticeContent,
} from '../../../src/learning/practice/paper'
import { createQuestionVariant } from '../../../src/learning/practice/question-variants'

const COURSE_ID = KET_CORE_VOCABULARY_COURSE.id

describe('course track contract', () => {
  it('accepts the optional vocab-level track marker', () => {
    expect(parseCourse(KET_CORE_VOCABULARY_COURSE).track).toBe('vocab-level')
  })

  it('rejects unknown track values', () => {
    expect(() => parseCourse({ ...KET_CORE_VOCABULARY_COURSE, track: 'unknown' })).toThrow(
      'course.track',
    )
  })

  it('keeps semester courses parseable without a track', () => {
    const semesterCourse = COURSE_REGISTRY.find((course) => course.track === undefined)
    expect(semesterCourse).toBeDefined()
    expect(parseCourse(semesterCourse!).track).toBeUndefined()
  })
})

describe('KET core vocabulary course registry', () => {
  it('registers the KET level course outside semester availability', () => {
    expect(COURSE_ID).toBe('ket-core-vocabulary-english')
    expect(getCourseById(COURSE_ID)).toBe(KET_CORE_VOCABULARY_COURSE)
    expect(COURSE_REGISTRY).toContain(KET_CORE_VOCABULARY_COURSE)
    expect(KET_CORE_VOCABULARY_COURSE.subject).toBe('english')
    expect(KET_CORE_VOCABULARY_COURSE.track).toBe('vocab-level')
    expect(KET_CORE_VOCABULARY_COURSE.units.length).toBeGreaterThanOrEqual(17)
  })

  it('registers five templates per unit with unique ids', () => {
    const templates = filterEnglishTemplates({ courseId: COURSE_ID })
    expect(templates).toHaveLength(KET_CORE_VOCABULARY_COURSE.units.length * 5)
    expect(new Set(templates.map((template) => template.id)).size).toBe(templates.length)
    expect(ENGLISH_TEMPLATES).toHaveLength(90 + templates.length)
    expect(hasPracticeContent(COURSE_ID)).toBe(true)
  })
})

describe('KET level paper assembly', () => {
  it('assembles a 30-question comprehensive paper with the english blueprint', () => {
    const paper = generateComprehensivePaper({ courseId: COURSE_ID, seed: 7, idPrefix: 'ket-comp' })
    expect(paper.questions).toHaveLength(30)
    const categories = paper.questions.map(
      (entry) => getEnglishTemplate(entry.question.templateId).paperCategory,
    )
    const count = (category: string) => categories.filter((item) => item === category).length
    expect(count('singleChoice')).toBe(12)
    expect(count('spelling')).toBe(6)
    expect(count('sentenceCompletion')).toBe(9)
    expect(count('situationalExpression')).toBe(3)
    expect(
      paper.questions.every((entry) => entry.question.classification.courseId === COURSE_ID),
    ).toBe(true)
  })

  it('assembles ability-filtered and unit-filtered special papers', () => {
    const byAbility = generateSpecialPaper({
      courseId: COURSE_ID,
      ability: 'english-vocabulary',
      difficulty: 'L1',
      seed: 9,
      idPrefix: 'ket-spec-ability',
    })
    expect(byAbility.questions).toHaveLength(10)
    expect(
      byAbility.questions.every(
        (entry) => entry.question.classification.ability === 'english-vocabulary',
      ),
    ).toBe(true)

    const unitId = KET_CORE_VOCABULARY_COURSE.units[0].id
    const byUnit = generateSpecialPaper({
      courseId: COURSE_ID,
      unitId,
      difficulty: 'L2',
      seed: 9,
      idPrefix: 'ket-spec-unit',
    })
    expect(byUnit.questions).toHaveLength(10)
    expect(byUnit.questions.every((entry) => entry.question.classification.unitId === unitId)).toBe(
      true,
    )
  })
})

describe('KET level question variants', () => {
  it('creates retest variants with a different context for every template kind', () => {
    const unitId = KET_CORE_VOCABULARY_COURSE.units[0].id
    for (const suffix of [
      'spelling',
      'vocab-choice',
      'grammar-choice',
      'completion',
      'situation',
    ]) {
      const templateId = `${unitId}-${suffix}-v1`
      const original = generateEnglishQuestion(templateId, 3, `ket-variant-${suffix}`)
      const variant = createQuestionVariant(original, 4, `ket-variant-new-${suffix}`)
      expect(variant.prompt).not.toBe(original.prompt)
      expect(variant.templateId).toBe(templateId)
      expect(variant.type).toBe(original.type)
    }
  })
})
