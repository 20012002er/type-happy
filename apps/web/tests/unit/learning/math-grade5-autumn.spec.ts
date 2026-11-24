import { describe, expect, it } from 'vitest'
import { GRADE5_AUTUMN_MATH_COURSE } from '../../../src/learning/content/course-registry'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import {
  filterMathTemplates,
  getMathTemplate,
  MATH_TEMPLATES,
} from '../../../src/learning/practice/math-templates'
import {
  generateComprehensivePaper,
  generateSpecialPaper,
} from '../../../src/learning/practice/paper'
import type { QuestionSnapshot } from '../../../src/learning/types'

const COURSE_ID = GRADE5_AUTUMN_MATH_COURSE.id
const COURSE_TEMPLATES = filterMathTemplates({ courseId: COURSE_ID })

function expectArithmetic(templateId: string, question: QuestionSnapshot): void {
  const answer = question.standardAnswer
  const numberValue = (): number => {
    expect(answer.kind).toBe('number')
    return answer.kind === 'number' ? answer.value : Number.NaN
  }
  const wordValue = (): number => {
    expect(answer.kind).toBe('word-problem')
    return answer.kind === 'word-problem' ? answer.value : Number.NaN
  }
  if (templateId === 'g5a-decimal-times-integer-v1') {
    const match = question.prompt.match(/^(\d+\.\d+) × (\d+) = \?$/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBeCloseTo(Number(match?.[1]) * Number(match?.[2]), 10)
    return
  }
  if (templateId === 'g5a-decimal-times-decimal-v1') {
    const match = question.prompt.match(/^(\d+\.\d+) × (\d+\.\d+) = \?$/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBeCloseTo(Number(match?.[1]) * Number(match?.[2]), 10)
    return
  }
  if (templateId === 'g5a-product-approximation-v1') {
    const match = question.prompt.match(/先计算 (\d+\.\d+) × (\d+\.\d+)，再把积保留一位小数/)
    expect(match).not.toBeNull()
    const product = Math.round(Number(match?.[1]) * 10) * Math.round(Number(match?.[2]) * 10)
    const expected = Math.round(product / 10) / 10
    expect(numberValue()).toBeCloseTo(expected, 10)
    return
  }
  if (templateId === 'g5a-multiplication-shopping-word-v1') {
    const match = question.prompt.match(/每千克苹果 (\d+\.\d+) 元，买 (\d+) 千克/)
    expect(match).not.toBeNull()
    expect(wordValue()).toBeCloseTo(Number(match?.[1]) * Number(match?.[2]), 10)
    expect(answer.kind === 'word-problem' && answer.unit).toBe('元')
    return
  }
  if (templateId === 'g5a-decimal-divided-by-integer-v1') {
    const match = question.prompt.match(/^(\d+(?:\.\d+)?) ÷ (\d+) = \?$/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBeCloseTo(Number(match?.[1]) / Number(match?.[2]), 10)
    return
  }
  if (templateId === 'g5a-divide-by-decimal-v1') {
    const match = question.prompt.match(/^(\d+(?:\.\d+)?) ÷ (\d+(?:\.\d+)?) = \?$/)
    expect(match).not.toBeNull()
    const expected = Math.round(Number(match?.[1]) * 10) / Math.round(Number(match?.[2]) * 10)
    expect(Number.isInteger(expected)).toBe(true)
    expect(numberValue()).toBe(expected)
    return
  }
  if (templateId === 'g5a-quotient-approximation-v1') {
    const match = question.prompt.match(/把 (\d+) ÷ (\d+) 的商保留两位小数/)
    expect(match).not.toBeNull()
    const expected = Math.round((Number(match?.[1]) * 100) / Number(match?.[2])) / 100
    expect(numberValue()).toBeCloseTo(expected, 10)
    return
  }
  if (templateId === 'g5a-division-application-word-v1') {
    const match = question.prompt.match(/把 (\d+(?:\.\d+)?) 米长的绳子/)
    expect(match).not.toBeNull()
    expect(wordValue()).toBeCloseTo(Number(match?.[1]) / 0.5, 10)
    expect(answer.kind === 'word-problem' && answer.unit).toBe('段')
    return
  }
  if (templateId === 'g5a-position-pairs-blank-v1') {
    const match = question.prompt.match(/第 (\d+) 列第 (\d+) 行/)
    expect(match).not.toBeNull()
    expect(answer).toEqual({ kind: 'fill-blanks', values: [match?.[1], match?.[2]] })
    return
  }
  if (templateId === 'g5a-position-from-pairs-blank-v1') {
    const match = question.prompt.match(/数对（(\d+)，(\d+)）/)
    expect(match).not.toBeNull()
    expect(answer).toEqual({ kind: 'fill-blanks', values: [match?.[1], match?.[2]] })
    return
  }
  if (templateId === 'g5a-algebraic-expression-blank-v1') {
    const match = question.prompt.match(/^([axm]) 的 (\d+) 倍/)
    expect(match).not.toBeNull()
    expect(answer).toEqual({ kind: 'fill-blanks', values: [`${match?.[2]}${match?.[1]}`] })
    return
  }
  if (templateId === 'g5a-solve-equation-v1') {
    const two = question.prompt.match(/^解方程 (\d+)x \+ (\d+) = (\d+)/)
    const mul = question.prompt.match(/^解方程 (\d+)x = (\d+)/)
    const add = question.prompt.match(/^解方程 x \+ (\d+) = (\d+)/)
    const sub = question.prompt.match(/^解方程 x - (\d+) = (\d+)/)
    const match = two ?? mul ?? add ?? sub
    expect(match).not.toBeNull()
    const expected = two
      ? (Number(match?.[3]) - Number(match?.[2])) / Number(match?.[1])
      : mul
        ? Number(match?.[2]) / Number(match?.[1])
        : add
          ? Number(match?.[2]) - Number(match?.[1])
          : Number(match?.[2]) + Number(match?.[1])
    expect(numberValue()).toBe(expected)
    return
  }
  if (templateId === 'g5a-equation-application-word-v1') {
    const match = question.prompt.match(/花了 (\d+) 元，还剩 (\d+) 元/)
    expect(match).not.toBeNull()
    expect(wordValue()).toBe(Number(match?.[1]) + Number(match?.[2]))
    expect(answer.kind === 'word-problem' && answer.unit).toBe('元')
    return
  }
  if (templateId === 'g5a-parallelogram-area-v1') {
    const match = question.prompt.match(/底是 (\d+) 厘米，高是 (\d+) 厘米/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBe(Number(match?.[1]) * Number(match?.[2]))
    expect(question.resources.length).toBeGreaterThan(0)
    return
  }
  if (templateId === 'g5a-triangle-area-v1') {
    const match = question.prompt.match(/底是 (\d+) 厘米，高是 (\d+) 厘米/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBe((Number(match?.[1]) * Number(match?.[2])) / 2)
    expect(question.resources.length).toBeGreaterThan(0)
    return
  }
  if (templateId === 'g5a-trapezoid-area-v1') {
    const match = question.prompt.match(/上底是 (\d+) 厘米，下底是 (\d+) 厘米，高是 (\d+) 厘米/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBe(((Number(match?.[1]) + Number(match?.[2])) * Number(match?.[3])) / 2)
    expect(question.resources.length).toBeGreaterThan(0)
    return
  }
  if (templateId === 'g5a-composite-area-word-v1') {
    const match = question.prompt.match(
      /长方形宽 (\d+) 米、高 (\d+) 米，三角形底 (\d+) 米、高 (\d+) 米/,
    )
    expect(match).not.toBeNull()
    const expected =
      Number(match?.[1]) * Number(match?.[2]) + (Number(match?.[3]) * Number(match?.[4])) / 2
    expect(wordValue()).toBe(expected)
    expect(answer.kind === 'word-problem' && answer.unit).toBe('平方米')
    return
  }
  if (
    templateId === 'g5a-planting-both-ends-word-v1' ||
    templateId === 'g5a-planting-one-end-word-v1' ||
    templateId === 'g5a-planting-no-ends-word-v1'
  ) {
    const match = question.prompt.match(
      /长 (\d+) 米的小路一边植树，每隔 (\d+) 米栽一棵（(两端都栽|只栽一端|两端都不栽)）/,
    )
    expect(match).not.toBeNull()
    const intervals = Number(match?.[1]) / Number(match?.[2])
    expect(Number.isInteger(intervals)).toBe(true)
    const expected =
      match?.[3] === '两端都栽'
        ? intervals + 1
        : match?.[3] === '只栽一端'
          ? intervals
          : intervals - 1
    expect(wordValue()).toBe(expected)
    expect(answer.kind === 'word-problem' && answer.unit).toBe('棵')
  }
}

describe('grade 5 autumn math course pack', () => {
  it('covers every knowledge point across all seven modules with every paper category', () => {
    expect(COURSE_TEMPLATES).toHaveLength(25)
    expect(
      new Set(COURSE_TEMPLATES.map((template) => template.classification.knowledgePointId)),
    ).toEqual(new Set(GRADE5_AUTUMN_MATH_COURSE.knowledgePoints.map((point) => point.id)))
    expect(new Set(COURSE_TEMPLATES.map((template) => template.classification.unitId))).toEqual(
      new Set(GRADE5_AUTUMN_MATH_COURSE.units.map((unit) => unit.id)),
    )
    expect(new Set(COURSE_TEMPLATES.map((template) => template.paperCategory))).toEqual(
      new Set(['calculation', 'singleChoice', 'knowledgeApplication', 'wordProblems']),
    )
    expect(
      COURSE_TEMPLATES.every((template) => template.classification.courseId === COURSE_ID),
    ).toBe(true)
    expect(
      MATH_TEMPLATES.filter((template) => template.classification.courseId === COURSE_ID).every(
        (template) => template.classification.ability !== undefined,
      ),
    ).toBe(true)
  })

  it.each(
    COURSE_TEMPLATES.map((template) => [template.id, template.supportedDifficulties] as const),
  )(
    '%s produces judge-correct answers and judge-wrong error causes',
    (templateId, difficulties) => {
      for (const difficulty of difficulties) {
        for (let seed = 0; seed < 100; seed += 1) {
          const question = generateMathQuestion(templateId, seed, `g5a-${seed}`, difficulty)
          expect(question.classification.courseId).toBe(COURSE_ID)
          expect(judgeAnswer(question, question.standardAnswer).correct).toBe(true)
          expectArithmetic(templateId, question)
          for (const rule of question.errorCauseRules) {
            for (const wrong of rule.answers) {
              const judgement = judgeAnswer(question, wrong)
              expect(judgement.correct).toBe(false)
              expect(judgement.cause?.id).toBe(rule.id)
            }
          }
          if (question.type === 'single-choice') {
            expect(question.options).toHaveLength(4)
            expect(new Set(question.options?.map((option) => option.text)).size).toBe(4)
          }
        }
      }
    },
  )

  it('builds a 12/6/6/6 comprehensive paper with application questions across modules', () => {
    const paper = generateComprehensivePaper({
      courseId: COURSE_ID,
      seed: 7,
      idPrefix: 'g5a-daily',
    })
    expect(paper.questions).toHaveLength(30)
    expect(paper.blueprint).toEqual({
      calculation: 12,
      singleChoice: 6,
      knowledgeApplication: 6,
      wordProblems: 6,
    })
    const counts = { calculation: 0, singleChoice: 0, knowledgeApplication: 0, wordProblems: 0 }
    for (const input of paper.questions) {
      counts[getMathTemplate(input.question.templateId).paperCategory] += 1
    }
    expect(counts).toEqual(paper.blueprint)
    const applicationUnits = new Set(
      paper.questions
        .filter(
          (input) => getMathTemplate(input.question.templateId).paperCategory === 'wordProblems',
        )
        .map((input) => input.question.classification.unitId),
    )
    expect(applicationUnits.size).toBeGreaterThanOrEqual(2)
  })

  it('supports knowledge point and question type filters for special practice', () => {
    const paper = generateSpecialPaper({
      courseId: COURSE_ID,
      knowledgePointId: 'g5a-planting-both-ends',
      difficulty: 'L2',
      seed: 5,
      idPrefix: 'g5a-planting',
    })
    expect(paper.questions).toHaveLength(10)
    expect(
      paper.questions.every(
        (input) => input.question.classification.knowledgePointId === 'g5a-planting-both-ends',
      ),
    ).toBe(true)
    const choice = generateSpecialPaper({
      courseId: COURSE_ID,
      unitId: 'g5a-polygon-area',
      questionType: 'number',
      difficulty: 'L2',
      seed: 5,
      idPrefix: 'g5a-area',
    })
    expect(choice.questions.every((input) => input.question.type === 'number')).toBe(true)
    expect(() =>
      generateSpecialPaper({
        courseId: COURSE_ID,
        knowledgePointId: 'g5a-position-pairs',
        questionType: 'single-choice',
        difficulty: 'L1',
        seed: 5,
        idPrefix: 'g5a-position',
      }),
    ).toThrow('没有该题型')
  })
})
