import { describe, expect, it } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'
import {
  generateComprehensivePaper,
  generateSpecialPaper,
  scalePaperBlueprint,
  type PaperBlueprint,
} from '../../../src/learning/practice/paper'

const expectedBlueprints: Record<number, PaperBlueprint> = {
  10: {
    oralCalculation: 2,
    writtenMultiplication: 2,
    writtenDivision: 4,
    changeRules: 1,
    estimationVerification: 1,
  },
  15: {
    oralCalculation: 3,
    writtenMultiplication: 4,
    writtenDivision: 6,
    changeRules: 1,
    estimationVerification: 1,
  },
  20: {
    oralCalculation: 4,
    writtenMultiplication: 5,
    writtenDivision: 7,
    changeRules: 2,
    estimationVerification: 2,
  },
  25: {
    oralCalculation: 5,
    writtenMultiplication: 7,
    writtenDivision: 9,
    changeRules: 2,
    estimationVerification: 2,
  },
  30: {
    oralCalculation: 6,
    writtenMultiplication: 8,
    writtenDivision: 10,
    changeRules: 3,
    estimationVerification: 3,
  },
  35: {
    oralCalculation: 7,
    writtenMultiplication: 10,
    writtenDivision: 12,
    changeRules: 3,
    estimationVerification: 3,
  },
  40: {
    oralCalculation: 8,
    writtenMultiplication: 10,
    writtenDivision: 14,
    changeRules: 4,
    estimationVerification: 4,
  },
  45: {
    oralCalculation: 9,
    writtenMultiplication: 12,
    writtenDivision: 16,
    changeRules: 4,
    estimationVerification: 4,
  },
  50: {
    oralCalculation: 10,
    writtenMultiplication: 13,
    writtenDivision: 17,
    changeRules: 5,
    estimationVerification: 5,
  },
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

describe('practice paper blueprint scaling', () => {
  it.each(Object.entries(expectedBlueprints))(
    'matches the PRD fixed sample for %s questions',
    (total, expected) => {
      expect(scalePaperBlueprint(Number(total))).toEqual(expected)
    },
  )

  it('preserves exact totals and minimum rule/estimation coverage for every integer from 10 to 50', () => {
    for (let total = 10; total <= 50; total += 1) {
      const blueprint = scalePaperBlueprint(total)
      expect(Object.values(blueprint).reduce((sum, count) => sum + count, 0)).toBe(total)
      expect(blueprint.changeRules).toBeGreaterThanOrEqual(LEARNING_RULES.paper.minimumChangeRules)
      expect(blueprint.estimationVerification).toBeGreaterThanOrEqual(
        LEARNING_RULES.paper.minimumEstimationVerification,
      )
      for (const category of Object.keys(blueprint) as (keyof PaperBlueprint)[]) {
        expect(blueprint[category]).toBeGreaterThanOrEqual(
          Math.floor((LEARNING_RULES.paper.defaultBlueprint[category] * total) / 30),
        )
      }
    }
  })

  it('rejects out-of-range and fractional totals', () => {
    for (const total of [9, 51, 10.5, Number.NaN])
      expect(() => scalePaperBlueprint(total)).toThrow('组卷题量')
  })
})

describe('comprehensive and special paper generation', () => {
  it('generates the full default blueprint with reproducible instances and no review questions', () => {
    const options = { seed: 2026, idPrefix: 'daily-1' }
    const paper = generateComprehensivePaper(options)
    expect(paper).toEqual(generateComprehensivePaper(options))
    expect(paper.mode).toBe('comprehensive')
    expect(paper.blueprint).toEqual(expectedBlueprints[30])
    expect(paper.questions).toHaveLength(30)
    expect(new Set(paper.questions.map((input) => input.question.instanceId)).size).toBe(30)
    expect(paper.questions.every((input) => input.question.source !== 'review')).toBe(true)
    expectNoRepeatedNumbersNextToEachOther(paper.questions)
    const units = paper.questions.map((input) => input.question.classification.unitId)
    expect(units.filter((unit) => unit === 'oral-calculation')).toHaveLength(6)
    expect(units.filter((unit) => unit === 'written-multiplication')).toHaveLength(8)
    expect(units.filter((unit) => unit === 'written-division')).toHaveLength(10)
    expect(units.filter((unit) => unit === 'change-rules')).toHaveLength(3)
    expect(units.filter((unit) => unit === 'estimation-verification')).toHaveLength(3)
  })

  it('prioritizes recent-error knowledge points without changing blueprint totals', () => {
    const paper = generateComprehensivePaper({
      seed: 8,
      idPrefix: 'preferred',
      total: 10,
      preferredKnowledgePointIds: ['division-with-remainder'],
    })
    expect(paper.questions).toHaveLength(10)
    expect(paper.questions[2].question.classification.knowledgePointId).toBe(
      'division-with-remainder',
    )
    expect(paper.blueprint).toEqual(expectedBlueprints[10])
  })

  it('generates ten filtered special questions at the requested difficulty without a separate task', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const paper = generateSpecialPaper({
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

  it('supports unit filters and rejects missing or empty selections', () => {
    const paper = generateSpecialPaper({
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
    expect(() => generateSpecialPaper({ difficulty: 'L1', seed: 1, idPrefix: 'missing' })).toThrow(
      '必须选择',
    )
    expect(() =>
      generateSpecialPaper({
        knowledgePointId: 'missing',
        difficulty: 'L1',
        seed: 1,
        idPrefix: 'empty',
      }),
    ).toThrow('没有可用题目')
    expect(() => generateComprehensivePaper({ seed: -1, idPrefix: 'bad' })).toThrow('种子')
    expect(() => generateComprehensivePaper({ seed: 1, idPrefix: ' ' })).toThrow('前缀')
  })
})
