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

function acceptedMatchesStandard(question: QuestionSnapshot): boolean {
  const rule = question.acceptedAnswerRule
  const standard = question.standardAnswer
  if (rule.kind !== standard.kind) return false
  switch (standard.kind) {
    case 'number':
      return rule.kind === 'number' && rule.values.length === 1 && rule.values[0] === standard.value
    case 'quotient-remainder':
      return (
        rule.kind === 'quotient-remainder' &&
        rule.values.length === 1 &&
        rule.values[0].quotient === standard.quotient &&
        rule.values[0].remainder === standard.remainder
      )
    case 'fill-blanks':
      return (
        rule.kind === 'fill-blanks' &&
        rule.values.length === standard.values.length &&
        standard.values.every((value, index) => rule.values[index].includes(value))
      )
    case 'single-choice':
      return (
        rule.kind === 'single-choice' &&
        rule.values.length === 1 &&
        rule.values[0] === standard.optionId
      )
    case 'word-problem':
      return (
        rule.kind === 'word-problem' &&
        rule.values.length === 1 &&
        rule.values[0].value === standard.value &&
        rule.values[0].unit === standard.unit
      )
    case 'fraction':
      return (
        rule.kind === 'fraction' &&
        rule.values.length === 1 &&
        rule.values[0].numerator === standard.numerator &&
        rule.values[0].denominator === standard.denominator
      )
    case 'english-spelling':
      return (
        rule.kind === 'english-spelling' &&
        rule.values.length === 1 &&
        rule.values[0] === standard.value
      )
    case 'sentence-completion':
      return (
        rule.kind === 'sentence-completion' &&
        rule.values.length === standard.values.length &&
        standard.values.every((value, index) => rule.values[index].includes(value))
      )
  }
}

function answerLeakTokens(question: QuestionSnapshot): string[] {
  const answer = question.standardAnswer
  switch (answer.kind) {
    case 'number':
      return [String(answer.value)]
    case 'quotient-remainder':
      return [String(answer.quotient)]
    case 'fill-blanks':
    case 'sentence-completion':
      return [...answer.values]
    case 'single-choice': {
      const option = question.options?.find((item) => item.id === answer.optionId)
      return option ? [option.text] : []
    }
    case 'word-problem':
      return [String(answer.value)]
    case 'fraction':
      return [`${answer.numerator}/${answer.denominator}`]
    case 'english-spelling':
      return [answer.value]
  }
}

function expectCommonInvariants(question: QuestionSnapshot): void {
  expect(question.instanceId).toBe(`instance-${question.seed}`)
  expect(question.acceptedAnswerRule.kind).toBe(question.standardAnswer.kind)
  expect(acceptedMatchesStandard(question)).toBe(true)
  if (question.type === 'single-choice') expect(question.options).toHaveLength(4)
  expect(question.retestKnowledgePointIds).toEqual([question.classification.knowledgePointId])
  expect(question.participatesInTask).toBe(true)
  expect(question.rewardEligible).toBe(true)
  for (const token of answerLeakTokens(question)) {
    expect(question.hints.level1).not.toContain(token)
  }
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

  if (templateId === 'product-rule-choice-v1') {
    const match = question.prompt.match(
      /^(\d+) × (\d+) = (\d+)。如果 \d+ (乘|除以) (\d+) 变成 (\d+)，\d+ 不变，积会怎样变化？$/,
    )
    expect(match).not.toBeNull()
    const a = Number(match?.[1])
    const factor = Number(match?.[5])
    expect(a * Number(match?.[2])).toBe(Number(match?.[3]))
    expect(Number(match?.[6])).toBe(match?.[4] === '乘' ? a * factor : a / factor)
    expect(answer).toEqual({ kind: 'single-choice', optionId: 'opt-a' })
    expect(question.options?.find((option) => option.id === 'opt-a')?.text).toBe(
      `也${match?.[4]} ${factor}`,
    )
    return
  }

  if (templateId === 'quotient-rule-choice-v1') {
    const both = question.prompt.match(
      /^(\d+) ÷ (\d+) = (\d+)。如果被除数和除数同时乘 (\d+)，商会怎样变化？$/,
    )
    const single = question.prompt.match(
      /^(\d+) ÷ (\d+) = (\d+)。如果被除数乘 (\d+)，除数不变，商会怎样变化？$/,
    )
    const match = both ?? single
    expect(match).not.toBeNull()
    expect(Number(match?.[1]) / Number(match?.[2])).toBe(Number(match?.[3]))
    expect(answer).toEqual({ kind: 'single-choice', optionId: 'opt-a' })
    expect(question.options?.find((option) => option.id === 'opt-a')?.text).toBe(
      both ? '不变' : `也乘 ${Number(match?.[4])}`,
    )
    return
  }

  if (templateId === 'estimate-method-choice-v1') {
    const match = question.prompt.match(
      /^估算 (\d+) × (\d+) 时，按四舍五入到整百、整十数，下面哪种估法最合适？$/,
    )
    expect(match).not.toBeNull()
    const roundedA = Math.round(Number(match?.[1]) / 100) * 100
    const roundedB = Math.round(Number(match?.[2]) / 10) * 10
    expect(answer).toEqual({ kind: 'single-choice', optionId: 'opt-a' })
    expect(question.options?.find((option) => option.id === 'opt-a')?.text).toBe(
      `${roundedA} × ${roundedB}`,
    )
    expect(new Set(question.options?.map((option) => option.text)).size).toBe(4)
    return
  }

  if (templateId === 'product-rule-blank-v1') {
    const match = question.prompt.match(
      /^一个乘数乘 (\d+)，另一个乘数不变，积就（____）；两个乘数分别乘 (\d+) 和乘 (\d+)，积就（____）。$/,
    )
    expect(match).not.toBeNull()
    const k = Number(match?.[1])
    const m = Number(match?.[3])
    expect(Number(match?.[2])).toBe(k)
    expect(k * m).not.toBe(k + m)
    expect(answer).toEqual({ kind: 'fill-blanks', values: [`乘 ${k}`, `乘 ${k * m}`] })
    return
  }

  if (templateId === 'quotient-rule-blank-v1') {
    const match = question.prompt.match(
      /^被除数乘 (\d+)，除数不变，商就（____）；被除数和除数同时除以 (\d+)，商就（____）。$/,
    )
    expect(match).not.toBeNull()
    const k = Number(match?.[1])
    expect(Number(match?.[2])).toBe(k)
    expect(answer).toEqual({ kind: 'fill-blanks', values: [`乘 ${k}`, '不变'] })
    return
  }

  if (templateId === 'shopping-estimate-word-v1') {
    const match = question.prompt.match(
      /^学校买 (\d+) 个篮球，每个 (\d+) 元。把 (\d+) 看作 (\d+)，把 (\d+) 看作 (\d+) 估算，大约一共要多少元？$/,
    )
    expect(match).not.toBeNull()
    const count = Number(match?.[1])
    const price = Number(match?.[2])
    const roundedCount = Number(match?.[4])
    const roundedPrice = Number(match?.[6])
    expect(Number(match?.[3])).toBe(count)
    expect(Number(match?.[5])).toBe(price)
    expect(Math.abs(count - roundedCount)).toBeLessThanOrEqual(4)
    expect(Math.abs(price - roundedPrice)).toBeLessThanOrEqual(4)
    expect(roundedCount % 10).toBe(0)
    expect(roundedPrice % 10).toBe(0)
    expect(answer).toEqual({ kind: 'word-problem', value: roundedCount * roundedPrice, unit: '元' })
    expect(question.acceptedAnswerRule.kind).toBe('word-problem')
    if (question.acceptedAnswerRule.kind === 'word-problem') {
      expect(question.acceptedAnswerRule.unitRequired).toBe(true)
    }
    return
  }

  if (templateId === 'shopping-multiplication-word-v1') {
    const match = question.prompt.match(/^一套科普书 (\d+) 元，学校买 (\d+) 套。一共要多少元？$/)
    expect(match).not.toBeNull()
    const price = Number(match?.[1])
    const count = Number(match?.[2])
    expect(price).toBeGreaterThanOrEqual(105)
    expect(price).toBeLessThanOrEqual(399)
    expect(count).toBeGreaterThanOrEqual(11)
    expect(count).toBeLessThanOrEqual(24)
    expect(answer).toEqual({ kind: 'word-problem', value: price * count, unit: '元' })
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
    const grade4Templates = filterMathTemplates({ courseId: GRADE4_AUTUMN_MATH_COURSE.id })
    expect(
      new Set(grade4Templates.map((template) => template.classification.knowledgePointId)),
    ).toEqual(new Set(GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.map((point) => point.id)))
    expect(filterMathTemplates({ courseId: 'missing-course' })).toHaveLength(0)
    for (const difficulty of ['L1', 'L2', 'L3'] as const) {
      expect(filterMathTemplates({ difficulty }).length).toBeGreaterThan(0)
    }
    expect(filterMathTemplates({ unitId: 'written-division' })).toHaveLength(3)
    expect(
      filterMathTemplates({ knowledgePointId: 'division-with-remainder', difficulty: 'L3' }).map(
        (template) => template.id,
      ),
    ).toEqual(['remainder-div-v1'])
    const choiceTemplates = filterMathTemplates({ questionType: 'single-choice' })
    expect(choiceTemplates.length).toBeGreaterThan(0)
    expect(choiceTemplates.every((template) => template.type === 'single-choice')).toBe(true)
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
