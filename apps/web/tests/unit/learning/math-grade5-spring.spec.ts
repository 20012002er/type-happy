import { describe, expect, it } from 'vitest'
import { GRADE5_SPRING_MATH_COURSE } from '../../../src/learning/content/course-registry'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import { gcd } from '../../../src/learning/practice/math-gen-shared'
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

const COURSE_ID = GRADE5_SPRING_MATH_COURSE.id
const COURSE_TEMPLATES = filterMathTemplates({ courseId: COURSE_ID })

function expectFraction(
  answer: QuestionSnapshot['standardAnswer'],
  num: number,
  den: number,
): void {
  const divisor = gcd(num, den)
  expect(answer).toEqual({
    kind: 'fraction',
    numerator: num / divisor,
    denominator: den / divisor,
  })
}

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
  if (templateId === 'g5s-surface-area-calc-v1') {
    const cube = question.prompt.match(/棱长是 (\d+) 厘米，它的表面积/)
    const cuboid = question.prompt.match(/长 (\d+) 厘米、宽 (\d+) 厘米、高 (\d+) 厘米，它的表面积/)
    const expected = cube
      ? 6 * Number(cube[1]) ** 2
      : 2 *
        (Number(cuboid?.[1]) * Number(cuboid?.[2]) +
          Number(cuboid?.[2]) * Number(cuboid?.[3]) +
          Number(cuboid?.[1]) * Number(cuboid?.[3]))
    expect(cube ?? cuboid).not.toBeNull()
    expect(numberValue()).toBe(expected)
    expect(question.resources.length).toBeGreaterThan(0)
    return
  }
  if (templateId === 'g5s-volume-calc-v1') {
    const cube = question.prompt.match(/棱长是 (\d+) 厘米，它的体积/)
    const cuboid = question.prompt.match(/长 (\d+) 厘米、宽 (\d+) 厘米、高 (\d+) 厘米，它的体积/)
    const expected = cube
      ? Number(cube[1]) ** 3
      : Number(cuboid?.[1]) * Number(cuboid?.[2]) * Number(cuboid?.[3])
    expect(cube ?? cuboid).not.toBeNull()
    expect(numberValue()).toBe(expected)
    expect(question.resources.length).toBeGreaterThan(0)
    return
  }
  if (templateId === 'g5s-volume-units-blank-v1') {
    const match = question.prompt.match(
      /^(\d+) (立方米|升|立方厘米|毫升) =（____）(立方分米|毫升|升)$/,
    )
    expect(match).not.toBeNull()
    const n = Number(match?.[1])
    const from = match?.[2]
    const expected = from === '立方米' || from === '升' ? n * 1000 : n / 1000
    expect(answer).toEqual({ kind: 'fill-blanks', values: [String(expected)] })
    return
  }
  if (templateId === 'g5s-cuboid-application-word-v1') {
    const match = question.prompt.match(/长 (\d+) 分米、宽 (\d+) 分米、高 (\d+) 分米/)
    expect(match).not.toBeNull()
    expect(wordValue()).toBe(Number(match?.[1]) * Number(match?.[2]) * Number(match?.[3]))
    expect(answer.kind === 'word-problem' && answer.unit).toBe('升')
    return
  }
  if (templateId === 'g5s-fraction-division-blank-v1') {
    const match = question.prompt.match(/^(\d+) ÷ (\d+) =（____）/)
    expect(match).not.toBeNull()
    expect(answer).toEqual({ kind: 'fill-blanks', values: [`${match?.[1]}/${match?.[2]}`] })
    return
  }
  if (templateId === 'g5s-fraction-property-blank-v1') {
    const match = question.prompt.match(/^(\d+)\/(\d+) =（____）\/(\d+)$/)
    expect(match).not.toBeNull()
    const expected = Number(match?.[1]) * (Number(match?.[3]) / Number(match?.[2]))
    expect(answer).toEqual({ kind: 'fill-blanks', values: [String(expected)] })
    return
  }
  if (templateId === 'g5s-reducing-calc-v1') {
    const match = question.prompt.match(/把 (\d+)\/(\d+) 约分成最简分数/)
    expect(match).not.toBeNull()
    expectFraction(answer, Number(match?.[1]), Number(match?.[2]))
    return
  }
  if (templateId === 'g5s-fraction-decimal-calc-v1') {
    const match = question.prompt.match(/把 (\d+)\/(\d+) 化成小数/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBeCloseTo(Number(match?.[1]) / Number(match?.[2]), 10)
    return
  }
  if (templateId === 'g5s-same-denominator-calc-v1') {
    const match = question.prompt.match(/^(\d+)\/(\d+) ([+-]) (\d+)\/(\d+) = \?$/)
    expect(match).not.toBeNull()
    const resultNum =
      match?.[3] === '+'
        ? Number(match?.[1]) + Number(match?.[4])
        : Number(match?.[1]) - Number(match?.[4])
    expectFraction(answer, resultNum, Number(match?.[2]))
    return
  }
  if (templateId === 'g5s-different-denominator-calc-v1') {
    const match = question.prompt.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+) = \?$/)
    expect(match).not.toBeNull()
    const resultNum =
      Number(match?.[1]) * Number(match?.[4]) + Number(match?.[3]) * Number(match?.[2])
    expectFraction(answer, resultNum, Number(match?.[2]) * Number(match?.[4]))
    return
  }
  if (templateId === 'g5s-fraction-simplify-calc-v1') {
    const match = question.prompt.match(/\+ 1\/(\d+) \+/)
    expect(match).not.toBeNull()
    expectFraction(answer, Number(match?.[1]) + 1, Number(match?.[1]))
    return
  }
  if (templateId === 'g5s-fraction-application-word-v1') {
    const match = question.prompt.match(/第一次用去 (\d+)\/(\d+) 米，第二次用去 (\d+)\/(\d+) 米/)
    expect(match).not.toBeNull()
    const expected =
      Number(match?.[1]) / Number(match?.[2]) + Number(match?.[3]) / Number(match?.[4])
    expect(wordValue()).toBeCloseTo(expected, 10)
    expect(answer.kind === 'word-problem' && answer.unit).toBe('米')
    return
  }
  if (templateId === 'g5s-line-chart-trends-word-v1') {
    const chart = question.resources[0]?.altText ?? ''
    const values = [...chart.matchAll(/星期[一二三四五] (\d+)℃/g)].map((item) => Number(item[1]))
    expect(values).toHaveLength(5)
    expect(wordValue()).toBe(values[4] - values[0])
    expect(answer.kind === 'word-problem' && answer.unit).toBe('摄氏度')
    return
  }
  if (templateId === 'g5s-defective-strategy-calc-v1') {
    const match = question.prompt.match(/有 (\d+) 个同样的零件/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBe(Math.round(Math.log(Number(match?.[1])) / Math.log(3)))
    return
  }
  if (templateId === 'g5s-defective-reasoning-word-v1') {
    const match = question.prompt.match(/有 (\d+) 个球.*各放 (\d+) 个/)
    expect(match).not.toBeNull()
    expect(wordValue()).toBe(Number(match?.[1]) - 2 * Number(match?.[2]))
    expect(answer.kind === 'word-problem' && answer.unit).toBe('个')
  }
}

describe('grade 5 spring math course pack', () => {
  it('covers every knowledge point across all seven modules with every paper category', () => {
    expect(COURSE_TEMPLATES).toHaveLength(27)
    expect(
      new Set(COURSE_TEMPLATES.map((template) => template.classification.knowledgePointId)),
    ).toEqual(new Set(GRADE5_SPRING_MATH_COURSE.knowledgePoints.map((point) => point.id)))
    expect(new Set(COURSE_TEMPLATES.map((template) => template.classification.unitId))).toEqual(
      new Set(GRADE5_SPRING_MATH_COURSE.units.map((unit) => unit.id)),
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
          const question = generateMathQuestion(templateId, seed, `g5s-${seed}`, difficulty)
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
      idPrefix: 'g5s-daily',
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
      knowledgePointId: 'g5s-defective-item-strategy',
      difficulty: 'L2',
      seed: 5,
      idPrefix: 'g5s-defective',
    })
    expect(paper.questions).toHaveLength(10)
    expect(
      paper.questions.every(
        (input) => input.question.classification.knowledgePointId === 'g5s-defective-item-strategy',
      ),
    ).toBe(true)
    const fractions = generateSpecialPaper({
      courseId: COURSE_ID,
      unitId: 'g5s-fraction-addition-subtraction',
      questionType: 'fraction',
      difficulty: 'L2',
      seed: 5,
      idPrefix: 'g5s-fraction',
    })
    expect(fractions.questions.every((input) => input.question.type === 'fraction')).toBe(true)
    expect(() =>
      generateSpecialPaper({
        courseId: COURSE_ID,
        knowledgePointId: 'g5s-factors-and-multiples',
        questionType: 'number',
        difficulty: 'L1',
        seed: 5,
        idPrefix: 'g5s-factors',
      }),
    ).toThrow('没有该题型')
  })
})
