import { describe, expect, it } from 'vitest'
import {
  GRADE4_SPRING_ENGLISH_COURSE,
  GRADE5_AUTUMN_ENGLISH_COURSE,
  GRADE5_SPRING_ENGLISH_COURSE,
} from '../../../src/learning/content/course-registry'
import { generateEnglishQuestion } from '../../../src/learning/practice/english-generator'
import { ENGLISH_TEMPLATES } from '../../../src/learning/practice/english-templates'
import {
  generateComprehensivePaper,
  hasPracticeContent,
  scaleEnglishBlueprint,
  type EnglishPaperBlueprint,
} from '../../../src/learning/practice/paper'
import {
  createChoiceVariant,
  createQuestionVariant,
  hasVariantGenerator,
} from '../../../src/learning/practice/question-variants'

const COURSE_ID = GRADE4_SPRING_ENGLISH_COURSE.id

const expectedBlueprints: Record<number, EnglishPaperBlueprint> = {
  10: { singleChoice: 4, spelling: 2, sentenceCompletion: 3, situationalExpression: 1 },
  15: { singleChoice: 7, spelling: 3, sentenceCompletion: 4, situationalExpression: 1 },
  20: { singleChoice: 8, spelling: 4, sentenceCompletion: 6, situationalExpression: 2 },
  25: { singleChoice: 11, spelling: 5, sentenceCompletion: 7, situationalExpression: 2 },
  30: { singleChoice: 12, spelling: 6, sentenceCompletion: 9, situationalExpression: 3 },
  35: { singleChoice: 15, spelling: 7, sentenceCompletion: 10, situationalExpression: 3 },
  40: { singleChoice: 16, spelling: 8, sentenceCompletion: 12, situationalExpression: 4 },
  45: { singleChoice: 19, spelling: 9, sentenceCompletion: 13, situationalExpression: 4 },
  50: { singleChoice: 20, spelling: 10, sentenceCompletion: 15, situationalExpression: 5 },
}

describe('english paper blueprint', () => {
  it.each(Object.entries(expectedBlueprints))(
    'scales total %s proportionally',
    (total, expected) => {
      expect(scaleEnglishBlueprint(Number(total))).toEqual(expected)
    },
  )

  it('keeps every ability covered for all totals from 10 to 50', () => {
    for (let total = 10; total <= 50; total += 1) {
      const blueprint = scaleEnglishBlueprint(total)
      const sum = Object.values(blueprint).reduce((left, right) => left + right, 0)
      expect(sum).toBe(total)
      expect(blueprint.spelling).toBeGreaterThanOrEqual(1)
      expect(blueprint.sentenceCompletion).toBeGreaterThanOrEqual(1)
      expect(blueprint.situationalExpression).toBeGreaterThanOrEqual(1)
    }
  })

  it('rejects invalid totals', () => {
    for (const total of [9, 51, 10.5, Number.NaN]) {
      expect(() => scaleEnglishBlueprint(total)).toThrow('组卷题量必须是 10–50 的整数')
    }
  })
})

describe('english template registry and content readiness', () => {
  it('registers 515 templates across three semesters and the KET level', () => {
    expect(ENGLISH_TEMPLATES).toHaveLength(515)
    expect(new Set(ENGLISH_TEMPLATES.map((template) => template.id)).size).toBe(515)
  })

  it('marks all three english courses as having practice content', () => {
    for (const course of [
      GRADE4_SPRING_ENGLISH_COURSE,
      GRADE5_AUTUMN_ENGLISH_COURSE,
      GRADE5_SPRING_ENGLISH_COURSE,
    ]) {
      expect(hasPracticeContent(course.id)).toBe(true)
    }
    expect(hasPracticeContent('unknown-course')).toBe(false)
  })
})

describe('english comprehensive paper ordering', () => {
  it('never repeats the same prompt next to each other', () => {
    const paper = generateComprehensivePaper({ courseId: COURSE_ID, seed: 11, idPrefix: 'en-adj' })
    for (let index = 1; index < paper.questions.length; index += 1) {
      const previous = paper.questions[index - 1].question
      const current = paper.questions[index].question
      if (previous.templateId === current.templateId) {
        expect(current.prompt).not.toBe(previous.prompt)
      }
    }
  })
})

describe('english question variants', () => {
  it('creates choice variants with variant origin and a different context', () => {
    const original = generateEnglishQuestion(
      'g4s-english-my-school-vocab-choice-v1',
      1,
      'en-variant-original',
    )
    expect(hasVariantGenerator(original.templateId)).toBe(true)
    const variant = createChoiceVariant(original, 2, 'en-variant-choice')
    expect(variant.variantOf).toEqual({
      templateId: original.templateId,
      instanceId: original.instanceId,
    })
    expect(variant.prompt).not.toBe(original.prompt)
    expect(variant.classification.knowledgePointId).toBe(original.classification.knowledgePointId)
    expect(variant.difficulty).toBe(original.difficulty)
    expect(variant.type).toBe(original.type)
  })

  it('creates retest variants for spelling and sentence completion', () => {
    for (const templateId of [
      'g4s-english-my-school-spelling-v1',
      'g4s-english-my-school-completion-v1',
    ]) {
      const original = generateEnglishQuestion(templateId, 3, `en-retest-${templateId}`)
      const variant = createQuestionVariant(original, 4, `en-retest-variant-${templateId}`)
      expect(variant.prompt).not.toBe(original.prompt)
      expect(variant.templateId).toBe(original.templateId)
      expect(variant.type).toBe(original.type)
    }
  })
})
