import { describe, expect, it } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'
import { GRADE4_AUTUMN_MATH_COURSE } from '../../../src/learning/content/grade4-math'
import {
  generateComprehensivePaper,
  generateSpecialPaper,
  hasPracticeContent,
  scaleMathBlueprint,
  type MathPaperBlueprint,
} from '../../../src/learning/practice/paper'
import { getMathTemplate } from '../../../src/learning/practice/math-templates'

const COURSE_ID = GRADE4_AUTUMN_MATH_COURSE.id

const expectedBlueprints: Record<number, MathPaperBlueprint> = {
  10: { calculation: 4, singleChoice: 2, knowledgeApplication: 2, wordProblems: 2 },
  15: { calculation: 6, singleChoice: 3, knowledgeApplication: 3, wordProblems: 3 },
  20: { calculation: 8, singleChoice: 4, knowledgeApplication: 4, wordProblems: 4 },
  25: { calculation: 10, singleChoice: 5, knowledgeApplication: 5, wordProblems: 5 },
  30: { calculation: 12, singleChoice: 6, knowledgeApplication: 6, wordProblems: 6 },
  35: { calculation: 14, singleChoice: 7, knowledgeApplication: 7, wordProblems: 7 },
  40: { calculation: 16, singleChoice: 8, knowledgeApplication: 8, wordProblems: 8 },
  45: { calculation: 18, singleChoice: 9, knowledgeApplication: 9, wordProblems: 9 },
  50: { calculation: 20, singleChoice: 10, knowledgeApplication: 10, wordProblems: 10 },
}

function expectNoRepeatedNumbersNextToEachOther(
  questions: ReturnType<typeof generateSpecialPaper>['questions'],
): void {
  for (let index = 1; index < questions.length; index += 1) {
    const previous = questions[index - 1].question
    const current = questions[index].question
    if (previous.templateId === current.templateId) expect(current.prompt).not.toBe(previous.prompt)
  }
}

describe('math paper blueprint scaling', () => {
  it.each(Object.entries(expectedBlueprints))(
    'matches the PRD 12/6/6/6 sample for %s questions',
    (total, expected) => {
      expect(scaleMathBlueprint(Number(total))).toEqual(expected)
    },
  )

  it('preserves exact totals and minimum choice/application coverage for every integer from 10 to 50', () => {
    const base = LEARNING_RULES.paper.mathBlueprint
    for (let total = 10; total <= 50; total += 1) {
      const blueprint = scaleMathBlueprint(total)
      expect(Object.values(blueprint).reduce((sum, count) => sum + count, 0)).toBe(total)
      expect(blueprint.singleChoice).toBeGreaterThanOrEqual(base.minimumSingleChoice)
      expect(blueprint.wordProblems).toBeGreaterThanOrEqual(base.minimumWordProblems)
      for (const category of Object.keys(blueprint) as (keyof MathPaperBlueprint)[]) {
        expect(blueprint[category]).toBeGreaterThanOrEqual(
          Math.floor((base[category] * total) / 30),
        )
      }
    }
  })

  it('refills remainders in the configured category order', () => {
    expect(scaleMathBlueprint(11)).toEqual({
      calculation: 5,
      singleChoice: 2,
      knowledgeApplication: 2,
      wordProblems: 2,
    })
    expect(scaleMathBlueprint(14)).toEqual({
      calculation: 6,
      singleChoice: 3,
      knowledgeApplication: 3,
      wordProblems: 2,
    })
  })

  it('rejects out-of-range and fractional totals', () => {
    for (const total of [9, 51, 10.5, Number.NaN])
      expect(() => scaleMathBlueprint(total)).toThrow('组卷题量')
  })
})

describe('comprehensive and special paper generation', () => {
  it('generates the full 12/6/6/6 blueprint with reproducible instances and no review questions', () => {
    const options = { courseId: COURSE_ID, seed: 2026, idPrefix: 'daily-1' }
    const paper = generateComprehensivePaper(options)
    expect(paper).toEqual(generateComprehensivePaper(options))
    expect(paper.mode).toBe('comprehensive')
    expect(paper.blueprint).toEqual(expectedBlueprints[30])
    expect(paper.questions).toHaveLength(30)
    expect(new Set(paper.questions.map((input) => input.question.instanceId)).size).toBe(30)
    expect(paper.questions.every((input) => input.question.source !== 'review')).toBe(true)
    expectNoRepeatedNumbersNextToEachOther(paper.questions)
    const counts = { calculation: 0, singleChoice: 0, knowledgeApplication: 0, wordProblems: 0 }
    for (const input of paper.questions) {
      counts[getMathTemplate(input.question.templateId).paperCategory] += 1
    }
    expect(counts).toEqual(expectedBlueprints[30])
    const applicationUnits = new Set(
      paper.questions
        .filter(
          (input) => getMathTemplate(input.question.templateId).paperCategory === 'wordProblems',
        )
        .map((input) => input.question.classification.unitId),
    )
    expect(applicationUnits.size).toBeGreaterThanOrEqual(2)
  })

  it('prioritizes recent-error knowledge points without changing blueprint totals', () => {
    const paper = generateComprehensivePaper({
      courseId: COURSE_ID,
      seed: 8,
      idPrefix: 'preferred',
      total: 10,
      preferredKnowledgePointIds: ['division-with-remainder'],
    })
    expect(paper.questions).toHaveLength(10)
    expect(paper.questions[0].question.classification.knowledgePointId).toBe(
      'division-with-remainder',
    )
    expect(paper.blueprint).toEqual(expectedBlueprints[10])
  })

  it('generates ten filtered special questions at the requested difficulty', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const paper = generateSpecialPaper({
        courseId: COURSE_ID,
        knowledgePointId: 'division-with-remainder',
        difficulty: 'L3',
        seed,
        idPrefix: `special-${seed}`,
      })
      expect(paper.mode).toBe('special')
      expect(paper.questions).toHaveLength(10)
      expectNoRepeatedNumbersNextToEachOther(paper.questions)
      for (const input of paper.questions) {
        expect(input.question.classification.knowledgePointId).toBe('division-with-remainder')
        expect(input.question.difficulty).toBe('L3')
        expect(input.question.participatesInTask).toBe(true)
        expect(input.question.rewardEligible).toBe(true)
      }
    }
  })

  it('filters special practice by question type and reports unsupported types', () => {
    const paper = generateSpecialPaper({
      courseId: COURSE_ID,
      unitId: 'change-rules',
      questionType: 'single-choice',
      difficulty: 'L2',
      seed: 3,
      idPrefix: 'choice',
    })
    expect(paper.questions).toHaveLength(10)
    expect(paper.questions.every((input) => input.question.type === 'single-choice')).toBe(true)
    expect(() =>
      generateSpecialPaper({
        courseId: COURSE_ID,
        unitId: 'change-rules',
        questionType: 'word-problem',
        difficulty: 'L2',
        seed: 3,
        idPrefix: 'missing-type',
      }),
    ).toThrow('没有该题型')
  })

  it('supports unit filters and rejects missing or empty selections', () => {
    const paper = generateSpecialPaper({
      courseId: COURSE_ID,
      unitId: 'written-multiplication',
      difficulty: 'L1',
      seed: 1,
      idPrefix: 'unit',
    })
    expect(
      paper.questions.every(
        (input) => input.question.classification.unitId === 'written-multiplication',
      ),
    ).toBe(true)
    expect(() =>
      generateSpecialPaper({ courseId: COURSE_ID, difficulty: 'L1', seed: 1, idPrefix: 'missing' }),
    ).toThrow('必须选择')
    expect(() =>
      generateSpecialPaper({
        courseId: COURSE_ID,
        knowledgePointId: 'missing',
        difficulty: 'L1',
        seed: 1,
        idPrefix: 'empty',
      }),
    ).toThrow('没有可用题目')
    expect(() =>
      generateComprehensivePaper({ courseId: COURSE_ID, seed: -1, idPrefix: 'bad' }),
    ).toThrow('种子')
    expect(() =>
      generateComprehensivePaper({ courseId: COURSE_ID, seed: 1, idPrefix: ' ' }),
    ).toThrow('前缀')
  })

  it('never repeats identical adjacent questions across all four math semesters', () => {
    const courseIds = [
      'pep-grade4-autumn-integrated-math',
      'pep-grade4-spring-math',
      'pep-grade5-autumn-math',
      'pep-grade5-spring-math',
    ]
    for (const courseId of courseIds) {
      for (const seed of [1, 7, 42]) {
        const paper = generateComprehensivePaper({ courseId, seed, idPrefix: 'adjacent' })
        expectNoRepeatedNumbersNextToEachOther(paper.questions)
      }
    }
    // 单模板专项会循环复用同一模板，相邻题面仍须不同
    const special = generateSpecialPaper({
      courseId: 'pep-grade5-spring-math',
      knowledgePointId: 'g5s-defective-item-strategy',
      difficulty: 'L2',
      seed: 3,
      idPrefix: 'adjacent-special',
    })
    expect(special.questions).toHaveLength(10)
    expectNoRepeatedNumbersNextToEachOther(special.questions)
  })

  it('gates courses by practice content availability', () => {
    expect(hasPracticeContent(COURSE_ID)).toBe(true)
    expect(hasPracticeContent('pep-grade4-spring-math')).toBe(true)
    expect(hasPracticeContent('pep-grade4-spring-english')).toBe(false)
    expect(() =>
      generateComprehensivePaper({
        courseId: 'pep-grade4-spring-english',
        seed: 1,
        idPrefix: 'no-content',
      }),
    ).toThrow('没有可用练习内容')
  })
})
