import { describe, expect, it } from 'vitest'
import {
  assertReleaseReviewGates,
  createCurrentContentManifest,
  validateLearningContent,
  type LearningContentManifest,
  type RecipeContent,
} from '../../../scripts/validate-learning-content'
import { GRADE4_AUTUMN_MATH_COURSE } from '../../../src/learning/content/grade4-math'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import { MATH_TEMPLATES } from '../../../src/learning/practice/math-templates'
import { parseLearningSnapshot } from '../../../src/learning/persistence/snapshot'
import {
  createGrade4MathCourseGoldenFixture,
  createHistoricalMathQuestionGoldenFixture,
} from '../../fixtures/content'
import { createRichLearningSnapshotFixture } from '../../fixtures/learning'

const validRecipe: RecipeContent = {
  id: 'flour-extra-v1',
  version: 1,
  inputs: { wheat: 2 },
  durationMinutes: 20,
  output: { itemId: 'flour', quantity: 1 },
  unitPrice: 42,
}

function validManifest(): LearningContentManifest {
  const current = createCurrentContentManifest()
  return {
    ...current,
    english: [{ id: 'english-fixture-v1', version: 1 }],
    courseAvailability: [
      ...current.courseAvailability,
      {
        courseId: 'future-grade4-spring',
        subject: 'english',
        available: false,
        unavailableReason: '课程内容尚未注册',
      },
    ],
    recipes: [...current.recipes, validRecipe],
  }
}

describe('WP00 immutable learning goldens', () => {
  it('freezes the current grade 4 course independently from its production definition', () => {
    const golden = createGrade4MathCourseGoldenFixture()
    expect(golden).toEqual(GRADE4_AUTUMN_MATH_COURSE)
    expect(golden).not.toBe(GRADE4_AUTUMN_MATH_COURSE)
    expect(createGrade4MathCourseGoldenFixture()).toEqual(golden)
  })

  it('freezes the historical question snapshot including answer, hints and explanation', () => {
    const golden = createHistoricalMathQuestionGoldenFixture()
    expect(generateMathQuestion('written-mul-three-v1', 42, 'golden', 'L2')).toEqual(golden)
    golden.hints.level1 = 'mutated'
    expect(createHistoricalMathQuestionGoldenFixture().hints.level1).not.toBe('mutated')
  })

  it('provides a rich current-schema snapshot with history, wallet, tasks and farm assets', () => {
    const snapshot = createRichLearningSnapshotFixture()
    expect(parseLearningSnapshot(snapshot)).toEqual(snapshot)
    expect(snapshot.learning.records).toHaveLength(1)
    expect(snapshot.wallet.ledger).toHaveLength(3)
    expect(snapshot.farm.plots).toHaveLength(2)
    expect(snapshot.farm.animals).toHaveLength(2)
    expect(snapshot.tasks.daily['2026-11-19']?.completed).toBe(4)
  })
})

describe('WP00 learning content validation entry', () => {
  it('validates every registered math template and all supported difficulties', () => {
    expect(validateLearningContent()).toEqual({
      math: MATH_TEMPLATES.length,
      english: 0,
      courseAvailability: 8,
      recipes: 3,
    })
  })

  it('accepts versioned math, English, availability and recipe registrations', () => {
    expect(validateLearningContent(validManifest())).toEqual({
      math: MATH_TEMPLATES.length,
      english: 1,
      courseAvailability: 9,
      recipes: 4,
    })
  })

  it('rejects duplicate IDs and invalid content versions', () => {
    const duplicate = validManifest()
    duplicate.english = [
      { id: 'same', version: 1 },
      { id: 'same', version: 2 },
    ]
    expect(() => validateLearningContent(duplicate)).toThrow('english 内容 ID 重复')

    const invalidVersion = validManifest()
    invalidVersion.math = [{ id: 'bad-version', version: 0 }]
    expect(() => validateLearningContent(invalidVersion)).toThrow('version 必须是正整数')
  })

  it('rejects ambiguous course availability entries', () => {
    const withoutReason = validManifest()
    withoutReason.courseAvailability = [
      { courseId: 'future-course', subject: 'english', available: false },
    ]
    expect(() => validateLearningContent(withoutReason)).toThrow('不可用课程必须说明原因')

    const duplicate = validManifest()
    duplicate.courseAvailability = [
      { courseId: 'same-course', subject: 'math', available: true },
      { courseId: 'same-course', subject: 'math', available: true },
    ]
    expect(() => validateLearningContent(duplicate)).toThrow('课程可用性重复')
  })

  it.each([
    [{ ...validRecipe, inputs: {} }, '至少包含一种原料'],
    [{ ...validRecipe, inputs: { wheat: 0 } }, 'inputs.wheat 必须是正整数'],
    [{ ...validRecipe, durationMinutes: 0 }, 'durationMinutes 必须是正整数'],
    [{ ...validRecipe, output: { itemId: 'flour', quantity: 0 } }, 'output.quantity 必须是正整数'],
    [{ ...validRecipe, unitPrice: 61 }, '单价不能超过每日出售上限'],
  ])('rejects invalid recipe registrations before UI startup', (recipe, message) => {
    const manifest = validManifest()
    manifest.recipes = [recipe]
    expect(() => validateLearningContent(manifest)).toThrow(message)
  })

  it('requires explicit Q1 and Q2 review references only for release validation', () => {
    expect(() => assertReleaseReviewGates({})).toThrow('CONTENT_REVIEW_REF')
    expect(() => assertReleaseReviewGates({ contentReviewRef: 'review/content-123' })).toThrow(
      'ECONOMY_REVIEW_REF',
    )
    expect(() =>
      assertReleaseReviewGates({
        contentReviewRef: 'review/content-123',
        economyReviewRef: 'review/economy-456',
      }),
    ).not.toThrow()
  })
})
