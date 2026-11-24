import { describe, expect, it } from 'vitest'
import { GRADE4_SPRING_MATH_COURSE } from '../../../src/learning/content/course-registry'
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

const COURSE_ID = GRADE4_SPRING_MATH_COURSE.id
const COURSE_TEMPLATES = filterMathTemplates({ courseId: COURSE_ID })

function expectArithmetic(templateId: string, question: QuestionSnapshot): void {
  const answer = question.standardAnswer
  const numberValue = (): number => {
    expect(answer.kind).toBe('number')
    return answer.kind === 'number' ? answer.value : Number.NaN
  }
  if (templateId === 'g4s-mixed-order-v1') {
    const add = question.prompt.match(/^(\d+) \+ (\d+) × (\d+) = \?$/)
    const sub = question.prompt.match(/^(\d+) - (\d+) × (\d+) = \?$/)
    const div = question.prompt.match(/^(\d+) - (\d+) ÷ (\d+) = \?$/)
    const match = add ?? sub ?? div
    expect(match).not.toBeNull()
    const [x, y, z] = [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])]
    const expected = add ? x + y * z : sub ? x - y * z : x - y / z
    expect(numberValue()).toBe(expected)
    return
  }
  if (templateId === 'g4s-parentheses-v1') {
    const add = question.prompt.match(/^\((\d+) \+ (\d+)\) × (\d+) = \?$/)
    const sub = question.prompt.match(/^\((\d+) - (\d+)\) × (\d+) = \?$/)
    const mul = question.prompt.match(/^(\d+) × \((\d+) \+ (\d+)\) = \?$/)
    const match = add ?? sub ?? mul
    expect(match).not.toBeNull()
    const [x, y, z] = [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])]
    const expected = add ? (x + y) * z : sub ? (x - y) * z : x * (y + z)
    expect(numberValue()).toBe(expected)
    return
  }
  if (templateId === 'g4s-simplify-calc-v1') {
    const match = question.prompt.match(/^(\d+) × (\d+) × (\d+) = \?$/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBe(Number(match?.[1]) * Number(match?.[2]) * Number(match?.[3]))
    return
  }
  if (templateId === 'g4s-decimal-point-move-v1') {
    const match = question.prompt.match(/^(\d+\.\d+) (× 10|× 100|÷ 10) = \?$/)
    expect(match).not.toBeNull()
    const base = Number(match?.[1])
    const expected =
      match?.[2] === '× 10' ? base * 10 : match?.[2] === '× 100' ? base * 100 : base / 10
    expect(numberValue()).toBeCloseTo(expected, 10)
    return
  }
  if (templateId === 'g4s-decimal-round-v1') {
    const match = question.prompt.match(/^把 (\d+\.\d{2}) 四舍五入保留一位小数/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBeCloseTo(Math.round(Number(match?.[1]) * 10) / 10, 10)
    return
  }
  if (templateId === 'g4s-decimal-add-v1') {
    const match = question.prompt.match(/^(\d+\.\d+) \+ (\d+\.\d+) = \?$/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBeCloseTo(Number(match?.[1]) + Number(match?.[2]), 10)
    return
  }
  if (templateId === 'g4s-decimal-simplify-v1') {
    const match = question.prompt.match(/^(\d+\.\d+) \+ (\d+) \+ (\d+\.\d+) = \?$/)
    expect(match).not.toBeNull()
    const expected = Number(match?.[1]) + Number(match?.[2]) + Number(match?.[3])
    expect(numberValue()).toBeCloseTo(expected, 10)
    expect(Number.isInteger(numberValue())).toBe(true)
    return
  }
  if (templateId === 'g4s-triangle-angle-calc-v1') {
    const match = question.prompt.match(/∠1 = (\d+)°，∠2 = (\d+)°/)
    expect(match).not.toBeNull()
    expect(numberValue()).toBe(180 - Number(match?.[1]) - Number(match?.[2]))
    expect(question.resources.length).toBeGreaterThan(0)
    expect(question.resources[0].altText).toContain('示意图')
    return
  }
  if (templateId === 'g4s-average-calc-v1') {
    const match = question.prompt.match(/^([\d、]+) 的平均数是多少？$/)
    expect(match).not.toBeNull()
    const values = (match?.[1] ?? '').split('、').map(Number)
    const sum = values.reduce((total, value) => total + value, 0)
    expect(sum % values.length).toBe(0)
    expect(numberValue()).toBe(sum / values.length)
    return
  }
  if (templateId === 'g4s-operations-word-v1') {
    const match = question.prompt.match(/买 (\d+) 本笔记本，每本 (\d+) 元，付 (\d+) 元/)
    expect(match).not.toBeNull()
    expect(answer).toEqual({
      kind: 'word-problem',
      value: Number(match?.[3]) - Number(match?.[1]) * Number(match?.[2]),
      unit: '元',
    })
    return
  }
  if (templateId === 'g4s-decimal-shopping-word-v1') {
    const match = question.prompt.match(
      /文具盒 (\d+\.\d+) 元，一本笔记本 (\d+\.\d+) 元。付 (\d+) 元/,
    )
    expect(match).not.toBeNull()
    const expected = Number(match?.[3]) - Number(match?.[1]) - Number(match?.[2])
    expect(answer.kind).toBe('word-problem')
    if (answer.kind === 'word-problem') {
      expect(answer.value).toBeCloseTo(expected, 10)
      expect(answer.unit).toBe('元')
    }
    return
  }
  if (templateId === 'g4s-rental-word-v1') {
    const match = question.prompt.match(/^(\d+) 名同学去划船，每条船限乘 (\d+) 人/)
    expect(match).not.toBeNull()
    const people = Number(match?.[1])
    const cap = Number(match?.[2])
    expect(people % cap).not.toBe(0)
    expect(answer).toEqual({ kind: 'word-problem', value: Math.ceil(people / cap), unit: '条' })
    return
  }
  if (templateId === 'g4s-travel-word-v1') {
    const match = question.prompt.match(
      /每小时行 (\d+) 千米，行了 (\d+) 小时，离目的地还有 (\d+) 千米/,
    )
    expect(match).not.toBeNull()
    expect(answer).toEqual({
      kind: 'word-problem',
      value: Number(match?.[1]) * Number(match?.[2]) + Number(match?.[3]),
      unit: '千米',
    })
    return
  }
  if (templateId === 'g4s-chicken-rabbit-v1') {
    const match = question.prompt.match(/鸡和兔共 (\d+) 只，脚共 (\d+) 只/)
    expect(match).not.toBeNull()
    const heads = Number(match?.[1])
    const feet = Number(match?.[2])
    const rabbits = (feet - 2 * heads) / 2
    expect(Number.isInteger(rabbits)).toBe(true)
    expect(rabbits).toBeGreaterThan(0)
    expect(answer).toEqual({ kind: 'word-problem', value: heads - rabbits, unit: '只' })
    return
  }
  if (templateId === 'g4s-bar-chart-compare-word-v1') {
    const chart = question.resources[0]?.altText ?? ''
    const values = [...chart.matchAll(/星期[一二三四] (\d+) 本/g)].map((item) => Number(item[1]))
    expect(values).toHaveLength(4)
    expect(answer.kind).toBe('word-problem')
    if (answer.kind === 'word-problem') {
      const total = values.reduce((sum, value) => sum + value, 0)
      const diff = Math.max(...values) - Math.min(...values)
      expect([total, diff]).toContain(answer.value)
      expect(answer.unit).toBe('本')
    }
    return
  }
  if (templateId === 'g4s-triangle-angle-sum-blank-v1') {
    const match = question.prompt.match(/∠1 \+ ∠2 = (\d+)°/)
    expect(match).not.toBeNull()
    expect(answer).toEqual({ kind: 'fill-blanks', values: [String(180 - Number(match?.[1]))] })
    return
  }
  if (templateId === 'g4s-unit-conversion-blank-v1') {
    const match = question.prompt.match(/^(\d+) 米 (\d+) 厘米/)
    expect(match).not.toBeNull()
    const meters = Number(match?.[1])
    const centimeters = Number(match?.[2])
    expect(answer).toEqual({
      kind: 'fill-blanks',
      values: [`${meters}.${String(centimeters).padStart(2, '0')}`],
    })
    return
  }
  if (templateId === 'g4s-law-application-blank-v1') {
    const match = question.prompt.match(
      /^(\d+) × (\d+) \+ (\d+) × (\d+) = (\d+) ×（____ \+ ____）$/,
    )
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(Number(match?.[3]))
    expect(Number(match?.[1])).toBe(Number(match?.[5]))
    expect(answer).toEqual({ kind: 'fill-blanks', values: [match?.[2], match?.[4]] })
  }
}

describe('grade 4 spring math course pack', () => {
  it('covers every knowledge point across all eight modules with every paper category', () => {
    expect(COURSE_TEMPLATES).toHaveLength(29)
    expect(
      new Set(COURSE_TEMPLATES.map((template) => template.classification.knowledgePointId)),
    ).toEqual(new Set(GRADE4_SPRING_MATH_COURSE.knowledgePoints.map((point) => point.id)))
    expect(new Set(COURSE_TEMPLATES.map((template) => template.classification.unitId))).toEqual(
      new Set(GRADE4_SPRING_MATH_COURSE.units.map((unit) => unit.id)),
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
          const question = generateMathQuestion(templateId, seed, `g4s-${seed}`, difficulty)
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
      idPrefix: 'g4s-daily',
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
      knowledgePointId: 'g4s-chicken-rabbit-basic',
      difficulty: 'L3',
      seed: 5,
      idPrefix: 'g4s-chicken',
    })
    expect(paper.questions).toHaveLength(10)
    expect(
      paper.questions.every(
        (input) => input.question.classification.knowledgePointId === 'g4s-chicken-rabbit-basic',
      ),
    ).toBe(true)
    const choice = generateSpecialPaper({
      courseId: COURSE_ID,
      unitId: 'g4s-triangles',
      questionType: 'single-choice',
      difficulty: 'L2',
      seed: 5,
      idPrefix: 'g4s-triangle-choice',
    })
    expect(choice.questions.every((input) => input.question.type === 'single-choice')).toBe(true)
    expect(() =>
      generateSpecialPaper({
        courseId: COURSE_ID,
        knowledgePointId: 'g4s-chicken-rabbit-basic',
        difficulty: 'L1',
        seed: 5,
        idPrefix: 'g4s-too-easy',
      }),
    ).toThrow('没有可用题目')
  })
})
