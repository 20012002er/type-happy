import { describe, expect, it } from 'vitest'
import { GRADE4_AUTUMN_MATH_COURSE } from '../../../src/learning/content/grade4-math'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import {
  createRetestQuestion,
  generateMathQuestion,
} from '../../../src/learning/practice/math-generator'
import {
  filterMathTemplates,
  getMathTemplate,
  MATH_TEMPLATES,
} from '../../../src/learning/practice/math-templates'
import type { Answer, QuestionSnapshot } from '../../../src/learning/types'

function answersEqual(left: Answer, right: Answer): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function expectCommonInvariants(question: QuestionSnapshot): void {
  expect(question.instanceId).toBe(`instance-${question.seed}`)
  expect(question.acceptedAnswerRule.values).toHaveLength(1)
  const accepted = question.acceptedAnswerRule.values[0]
  const acceptedAnswer: Answer =
    question.acceptedAnswerRule.kind === 'number'
      ? { kind: 'number', value: accepted as number }
      : { kind: 'quotient-remainder', ...(accepted as { quotient: number; remainder: number }) }
  expect(answersEqual(acceptedAnswer, question.standardAnswer)).toBe(true)
  if (
    question.standardAnswer.kind !== 'number' &&
    question.standardAnswer.kind !== 'quotient-remainder'
  ) {
    throw new Error('当前数学生成器仅支持数值题和商余数题')
  }
  expect(question.retestKnowledgePointIds).toEqual([question.classification.knowledgePointId])
  expect(question.participatesInTask).toBe(true)
  expect(question.rewardEligible).toBe(true)
  expect(question.hints.level1).not.toContain(
    question.standardAnswer.kind === 'number'
      ? String(question.standardAnswer.value)
      : String(question.standardAnswer.quotient),
  )
  for (const rule of question.errorCauseRules) {
    expect(rule.answers.length).toBeGreaterThan(0)
    for (const answer of rule.answers) {
      expect(answer.kind).toBe(question.type)
      expect(answersEqual(answer, question.standardAnswer)).toBe(false)
    }
  }
}

function expectTemplateArithmetic(templateId: string, question: QuestionSnapshot): void {
  const answer = question.standardAnswer
  if (
    [
      'oral-mul-one-v1',
      'oral-mul-tens-v1',
      'written-mul-two-v1',
      'written-mul-three-v1',
      'written-mul-zero-v1',
    ].includes(templateId)
  ) {
    const match = question.prompt.match(/^(\d+) × (\d+) = \?$/)
    expect(match).not.toBeNull()
    const a = Number(match?.[1])
    const b = Number(match?.[2])
    expect(answer).toEqual({ kind: 'number', value: a * b })
    expect(a * b).toBeLessThanOrEqual(100_000)
    if (templateId === 'written-mul-three-v1') {
      expect(a).toBeGreaterThanOrEqual(100)
      expect(a).toBeLessThanOrEqual(999)
      expect(b).toBeGreaterThanOrEqual(10)
      expect(b).toBeLessThanOrEqual(99)
    }
    if (templateId === 'written-mul-zero-v1') {
      expect(a % 10 === 0 || (a >= 100 && Math.floor(a / 10) % 10 === 0)).toBe(true)
    }
    if (templateId === 'oral-mul-tens-v1') expect(b % 10).toBe(0)
    if (templateId === 'oral-mul-one-v1' && question.difficulty === 'L2') {
      expect(a % 10).toBe(0)
    }
    return
  }

  if (['written-div-v1', 'trial-div-v1', 'remainder-div-v1'].includes(templateId)) {
    const match = question.prompt.match(/^(\d+) ÷ (\d+)/)
    expect(match).not.toBeNull()
    const dividend = Number(match?.[1])
    const divisor = Number(match?.[2])
    expect(divisor).toBeGreaterThan(0)
    expect(dividend).toBeLessThanOrEqual(999)
    expect(answer).toEqual({
      kind: 'quotient-remainder',
      quotient: Math.floor(dividend / divisor),
      remainder: dividend % divisor,
    })
    if (answer.kind === 'quotient-remainder') {
      expect(answer.remainder).toBeLessThan(divisor)
      if (templateId === 'remainder-div-v1') expect(answer.remainder).toBeGreaterThan(0)
    }
    return
  }

  if (templateId === 'oral-div-tens-v1') {
    const match = question.prompt.match(/^(\d+) ÷ (\d+) = \?$/)
    const dividend = Number(match?.[1])
    const divisor = Number(match?.[2])
    expect(match).not.toBeNull()
    expect(divisor % 10).toBe(0)
    expect(answer).toEqual({ kind: 'number', value: dividend / divisor })
    return
  }

  if (templateId === 'product-rule-v1') {
    const match = question.prompt.match(/^(\d+) × (\d+) = (\d+)，(\d+) × (\d+) = \?$/)
    expect(match).not.toBeNull()
    expect(Number(match?.[1]) * Number(match?.[2])).toBe(Number(match?.[3]))
    expect(answer).toEqual({ kind: 'number', value: Number(match?.[4]) * Number(match?.[5]) })
    return
  }

  if (templateId === 'quotient-rule-v1') {
    const match = question.prompt.match(/^(\d+) ÷ (\d+) = (\d+)，(\d+) ÷ (\d+) = \?$/)
    expect(match).not.toBeNull()
    expect(Number(match?.[1]) / Number(match?.[2])).toBe(Number(match?.[3]))
    expect(answer).toEqual({ kind: 'number', value: Number(match?.[4]) / Number(match?.[5]) })
    return
  }

  if (templateId === 'mul-estimate-v1') {
    const match = question.prompt.match(/把 (\d+) 看作 (\d+)，把 (\d+) 看作 (\d+)/)
    expect(match).not.toBeNull()
    expect(question.acceptedAnswerRule.values).toHaveLength(1)
    expect(answer).toEqual({ kind: 'number', value: Number(match?.[2]) * Number(match?.[4]) })
    return
  }

  if (templateId === 'div-estimate-v1') {
    const match = question.prompt.match(/把 (\d+) 看作 (\d+)，除数是 (\d+)/)
    expect(match).not.toBeNull()
    expect(question.acceptedAnswerRule.values).toHaveLength(1)
    expect(Number(match?.[2]) % Number(match?.[3])).toBe(0)
    expect(answer).toEqual({ kind: 'number', value: Number(match?.[2]) / Number(match?.[3]) })
    return
  }

  if (templateId === 'div-verify-v1') {
    const match = question.prompt.match(/除数是 (\d+)，商是 (\d+)，余数是 (\d+)/)
    expect(match).not.toBeNull()
    expect(answer).toEqual({
      kind: 'number',
      value: Number(match?.[1]) * Number(match?.[2]) + Number(match?.[3]),
    })
    return
  }

  if (templateId === 'prior-review-v1') {
    const multiplication = question.prompt.match(/^(\d+) × (\d+) = \?$/)
    const division = question.prompt.match(/^(\d+) ÷ (\d+) = \?$/)
    expect(multiplication ?? division).not.toBeNull()
    expect(answer).toEqual({
      kind: 'number',
      value: multiplication
        ? Number(multiplication[1]) * Number(multiplication[2])
        : Number(division?.[1]) / Number(division?.[2]),
    })
  }
}

describe('math template catalogue', () => {
  it('covers every course knowledge point and supports difficulty and unit filters', () => {
    expect(
      new Set(MATH_TEMPLATES.map((template) => template.classification.knowledgePointId)),
    ).toEqual(new Set(GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.map((point) => point.id)))
    for (const difficulty of ['L1', 'L2', 'L3'] as const) {
      expect(filterMathTemplates({ difficulty }).length).toBeGreaterThan(0)
    }
    expect(filterMathTemplates({ unitId: 'written-division' })).toHaveLength(3)
    expect(
      filterMathTemplates({ knowledgePointId: 'division-with-remainder', difficulty: 'L3' }).map(
        (template) => template.id,
      ),
    ).toEqual(['remainder-div-v1'])
    expect(filterMathTemplates({ includeReview: false }).some((template) => template.review)).toBe(
      false,
    )
    expect(filterMathTemplates({ includeReview: true }).some((template) => template.review)).toBe(
      true,
    )
    expect(getMathTemplate('written-div-v1').generator).toBe('written-division')
    expect(() => getMathTemplate('missing')).toThrow('未知数学题目模板')
  })
})

describe('seeded math generation and bulk content quality', () => {
  it.each(MATH_TEMPLATES.map((template) => [template.id, template.supportedDifficulties] as const))(
    '%s generates valid unique-answer questions at every supported difficulty',
    (templateId, difficulties) => {
      for (const difficulty of difficulties) {
        for (let seed = 0; seed < 200; seed += 1) {
          const question = generateMathQuestion(templateId, seed, `instance-${seed}`, difficulty)
          expectCommonInvariants(question)
          expectTemplateArithmetic(templateId, question)
          if (templateId === 'prior-review-v1') {
            expect(question.source).toBe('review')
            expect(question.countsTowardNewKnowledge).toBe(false)
          } else {
            expect(question.countsTowardNewKnowledge).toBe(true)
          }
        }
      }
    },
  )

  it('is reproducible and changes only the instance when the instance ID changes', () => {
    const first = generateMathQuestion('written-div-v1', 12345, 'first', 'L3')
    expect(generateMathQuestion('written-div-v1', 12345, 'first', 'L3')).toEqual(first)
    expect(generateMathQuestion('written-div-v1', 12345, 'second', 'L3')).toEqual({
      ...first,
      instanceId: 'second',
    })
  })

  it('makes every specialized multiplication and division error cause reachable', () => {
    const matched = new Set<string>()
    for (const templateId of [
      'oral-mul-one-v1',
      'oral-mul-tens-v1',
      'written-mul-two-v1',
      'written-mul-three-v1',
      'written-mul-zero-v1',
      'written-div-v1',
      'trial-div-v1',
      'remainder-div-v1',
    ]) {
      for (let seed = 0; seed < 200; seed += 1) {
        const question = generateMathQuestion(templateId, seed, `cause-${seed}`, 'L2')
        for (const rule of question.errorCauseRules) {
          for (const answer of rule.answers) {
            const judgement = judgeAnswer(question, answer)
            expect(judgement.correct).toBe(false)
            expect(judgement.cause?.id).toBe(rule.id)
            matched.add(rule.id)
          }
        }
      }
    }
    expect(matched).toEqual(
      new Set([
        'missing-carry',
        'trailing-zero-omitted',
        'middle-zero-skipped',
        'partial-product-misalignment',
        'trial-quotient-too-small',
        'trial-quotient-too-large',
        'remainder-not-smaller',
      ]),
    )
  })

  it('matches a fixed multiplication golden sample', () => {
    expect(generateMathQuestion('written-mul-three-v1', 42, 'golden', 'L2')).toEqual({
      templateId: 'written-mul-three-v1',
      templateVersion: 1,
      instanceId: 'golden',
      seed: 42,
      classification: {
        courseId: 'pep-grade4-autumn-integrated-math',
        subject: 'math',
        grade: 4,
        semester: 'autumn',
        textbook: '人教版新旧融合',
        unitId: 'written-multiplication',
        knowledgePointId: 'written-multiplication-three-by-two',
      },
      source: 'new-pep',
      countsTowardNewKnowledge: true,
      type: 'number',
      difficulty: 'L2',
      prompt: '680 × 50 = ?',
      resources: [],
      standardAnswer: { kind: 'number', value: 34000 },
      acceptedAnswerRule: { kind: 'number', values: [34000] },
      errorCauseRules: [
        {
          id: 'trailing-zero-omitted',
          label: '末尾 0 遗漏',
          feedback: '先检查乘数末尾的 0 是否已计入积',
          answers: [{ kind: 'number', value: 3400 }],
        },
      ],
      hints: {
        level1: '先按数位检查每一次相乘和部分积的位置',
        level2: '先算 680 乘个位，再算 680 乘十位；第二层积要与十位对齐',
      },
      explanationSteps: [
        '个位部分：680 × 0 = 0',
        '十位部分：680 × 5 = 3400，表示 34000',
        '相加得到 34000',
      ],
      retestKnowledgePointIds: ['written-multiplication-three-by-two'],
      participatesInTask: true,
      rewardEligible: true,
    })
  })

  it('rejects invalid seeds, blank IDs and unsupported template difficulties', () => {
    for (const seed of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => generateMathQuestion('oral-mul-one-v1', seed, 'invalid')).toThrow('题目种子')
    }
    expect(() => generateMathQuestion('oral-mul-one-v1', 1, '  ')).toThrow('实例 ID')
    expect(() => generateMathQuestion('missing', 1, 'invalid')).toThrow('未知数学题目模板')
    expect(() => generateMathQuestion('oral-mul-one-v1', 1, 'invalid', 'L3')).toThrow('不支持难度')
  })
})

describe('retest variants', () => {
  it('creates a new same-knowledge-point instance with different numbers for every template', () => {
    for (const template of MATH_TEMPLATES) {
      const difficulty = template.supportedDifficulties.at(-1)
      expect(difficulty).toBeDefined()
      const original = generateMathQuestion(template.id, 19, 'original', difficulty)
      const retest = createRetestQuestion(original, 1000, 'retest')
      expect(retest.instanceId).toBe('retest')
      expect(retest.templateId).toBe(original.templateId)
      expect(retest.classification.knowledgePointId).toBe(original.classification.knowledgePointId)
      expect(retest.prompt).not.toBe(original.prompt)
      expect(retest.difficulty).toBe(original.difficulty)
    }
  })

  it('requires a different question instance ID', () => {
    const original = generateMathQuestion('oral-mul-one-v1', 1, 'same')
    expect(() => createRetestQuestion(original, 2, 'same')).toThrow('新的题目实例 ID')
  })
})
