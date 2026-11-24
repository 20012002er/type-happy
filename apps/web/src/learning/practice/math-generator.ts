import { getCourseById } from '../content/course-registry'
import { parseQuestionSnapshot } from '../contracts'
import type { Difficulty, ErrorCauseRule, QuestionSnapshot } from '../types'
import { isMathTemplateDisabled } from './content-health'
import {
  buildMathSnapshot,
  cause,
  getMathGenerator,
  numberRule,
  registerMathGenerator,
  seededRandom,
  shuffleOptions,
  type MathGeneratorContext,
} from './math-gen-shared'
import { getMathTemplate } from './math-templates'
import './generators-grade4-spring'
import './generators-grade5-autumn'
import './generators-grade5-spring'

function multiplicationCauses(a: number, b: number, correct: number): ErrorCauseRule[] {
  const rules: ErrorCauseRule[] = []
  const usedAnswers = new Set<number>()
  const add = (id: string, label: string, feedback: string, value: number) => {
    if (value >= 0 && value !== correct && !usedAnswers.has(value)) {
      rules.push(cause(id, label, feedback, [{ kind: 'number', value }]))
      usedAnswers.add(value)
    }
  }
  if (a % 10 === 0 || b % 10 === 0) {
    add('trailing-zero-omitted', '末尾 0 遗漏', '先检查乘数末尾的 0 是否已计入积', correct / 10)
  }
  if (a < 1000 && Math.floor(a / 10) % 10 === 0 && a >= 100) {
    add(
      'middle-zero-skipped',
      '中间 0 被跳过',
      '先检查中间有 0 的数位是否仍按数位相乘',
      (Math.floor(a / 100) * 10 + (a % 10)) * b,
    )
  }
  const carry = Math.floor(((a % 10) * (b % 10)) / 10)
  add('missing-carry', '进位遗漏', '先检查每一位相乘后的进位是否加入下一层积', correct - carry * 10)
  add(
    'partial-product-misalignment',
    '部分积错位',
    '先检查第二层积是否与十位对齐',
    a * (b % 10) + a * Math.floor(b / 10),
  )
  return rules
}

function multiplication(context: MathGeneratorContext, a: number, b: number): QuestionSnapshot {
  const answer = a * b
  const lower = a * (b % 10)
  const upper = a * Math.floor(b / 10)
  return buildMathSnapshot(context, {
    prompt: `${a} × ${b} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先按数位检查每一次相乘和部分积的位置',
      level2: `先算 ${a} 乘个位，再算 ${a} 乘十位；第二层积要与十位对齐`,
    },
    explanationSteps: [
      `个位部分：${a} × ${b % 10} = ${lower}`,
      `十位部分：${a} × ${Math.floor(b / 10)} = ${upper}，表示 ${upper * 10}`,
      `相加得到 ${answer}`,
    ],
    errorCauseRules: multiplicationCauses(a, b, answer),
  })
}

function divisionCauses(quotient: number, remainder: number, divisor: number): ErrorCauseRule[] {
  const rules: ErrorCauseRule[] = []
  if (quotient > 1) {
    rules.push(
      cause('trial-quotient-too-small', '初商偏小', '检查当前余数是否还够再分一次', [
        { kind: 'quotient-remainder', quotient: quotient - 1, remainder },
      ]),
    )
  }
  rules.push(
    cause('trial-quotient-too-large', '初商偏大', '检查商与除数的乘积是否超过被除数', [
      { kind: 'quotient-remainder', quotient: quotient + 1, remainder },
    ]),
    cause('remainder-not-smaller', '余数不小于除数', '余数必须小于除数，需要继续调商', [
      { kind: 'quotient-remainder', quotient, remainder: remainder + divisor },
    ]),
  )
  return rules
}

function division(
  context: MathGeneratorContext,
  dividend: number,
  divisor: number,
): QuestionSnapshot {
  const quotient = Math.floor(dividend / divisor)
  const remainder = dividend % divisor
  return buildMathSnapshot(context, {
    prompt: `${dividend} ÷ ${divisor}，商和余数分别是多少？`,
    answer: { kind: 'quotient-remainder', quotient, remainder },
    acceptedAnswerRule: {
      kind: 'quotient-remainder',
      values: [{ quotient, remainder }],
    },
    hints: {
      level1: '先检查试商乘除数的结果，以及余数与除数的大小关系',
      level2: `用商乘 ${divisor}，再加上余数，应该等于 ${dividend}`,
    },
    explanationSteps: [
      `试商 ${quotient}：${divisor} × ${quotient} = ${divisor * quotient}`,
      `${dividend} - ${divisor * quotient} = ${remainder}`,
      `余数 ${remainder} 小于除数 ${divisor}，所以商是 ${quotient}，余数是 ${remainder}`,
    ],
    errorCauseRules: divisionCauses(quotient, remainder, divisor),
  })
}

registerMathGenerator('oral-multiplication-one', (context) => {
  const a =
    context.difficulty === 'L1' ? context.random.int(12, 99) : context.random.int(12, 99) * 10
  return multiplication(context, a, context.random.int(2, 9))
})

registerMathGenerator('oral-multiplication-tens', (context) => {
  const a =
    context.difficulty === 'L1' ? context.random.int(11, 99) : context.random.int(12, 99) * 10
  return multiplication(context, a, context.random.int(2, 9) * 10)
})

registerMathGenerator('written-multiplication-two', (context) => {
  const minimum = context.difficulty === 'L1' ? 10 : context.difficulty === 'L2' ? 15 : 50
  return multiplication(context, context.random.int(minimum, 99), context.random.int(11, 99))
})

registerMathGenerator('written-multiplication-three', (context) => {
  const minimum = context.difficulty === 'L1' ? 100 : context.difficulty === 'L2' ? 200 : 700
  return multiplication(context, context.random.int(minimum, 999), context.random.int(10, 99))
})

registerMathGenerator('written-multiplication-zero', (context) => {
  const a =
    context.random.next() < 0.5
      ? context.random.int(1, 9) * 100 + context.random.int(1, 9)
      : context.random.int(10, 99) * 10
  return multiplication(context, a, context.random.int(10, 99))
})

registerMathGenerator('oral-division-tens', (context) => {
  const divisor = context.random.int(2, 9) * 10
  const quotient = context.random.int(2, context.difficulty === 'L1' ? 6 : 9)
  return buildMathSnapshot(context, {
    prompt: `${divisor * quotient} ÷ ${divisor} = ?`,
    answer: { kind: 'number', value: quotient },
    acceptedAnswerRule: numberRule(quotient),
    hints: {
      level1: '先想除数乘几能得到被除数',
      level2: `把被除数和除数末尾相同个数的 0 同时去掉再口算`,
    },
    explanationSteps: [`${divisor} × ${quotient} = ${divisor * quotient}`, `所以商是 ${quotient}`],
  })
})

function generateDivision(
  context: MathGeneratorContext,
  requiresRemainder: boolean,
): QuestionSnapshot {
  const divisor =
    context.difficulty === 'L1' ? context.random.int(2, 9) * 10 : context.random.int(10, 99)
  const maximumDividend = requiresRemainder ? 998 : 999
  const maximumQuotient = Math.max(
    1,
    Math.min(context.difficulty === 'L1' ? 9 : 20, Math.floor(maximumDividend / divisor)),
  )
  const quotient = context.random.int(1, maximumQuotient)
  const maximumRemainder = Math.min(divisor - 1, 999 - divisor * quotient)
  const remainder = context.random.int(requiresRemainder ? 1 : 0, maximumRemainder)
  return division(context, divisor * quotient + remainder, divisor)
}

registerMathGenerator('written-division', (context) => generateDivision(context, false))
registerMathGenerator('trial-division', (context) => generateDivision(context, false))
registerMathGenerator('remainder-division', (context) => generateDivision(context, true))

registerMathGenerator('product-rule', (context) => {
  const factor = context.random.pick([2, 5, 10] as const)
  const divide = context.random.next() < 0.5
  const a = divide ? factor * context.random.int(2, 12) : context.random.int(2, 20)
  const b = context.random.int(3, 15)
  const changed = divide ? a / factor : a * factor
  const answer = divide ? (a * b) / factor : a * b * factor
  return buildMathSnapshot(context, {
    prompt: `${a} × ${b} = ${a * b}，${changed} × ${b} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先比较两个乘数，判断积应按相同倍数怎样变化',
      level2: `一个乘数${divide ? '除以' : '乘'} ${factor}，另一个不变，积也${divide ? '除以' : '乘'} ${factor}`,
    },
    explanationSteps: [`原积是 ${a * b}`, `积${divide ? '除以' : '乘'} ${factor}，得到 ${answer}`],
    errorCauseRules: [
      cause('product-not-changed', '积没有随乘数变化', '先比较两个乘数的变化倍数', [
        { kind: 'number', value: a * b },
      ]),
    ],
  })
})

registerMathGenerator('quotient-rule', (context) => {
  const divisor = context.random.int(3, 12)
  const quotient = context.random.int(3, 12)
  const dividend = divisor * quotient
  const factor = context.random.pick([2, 5, 10] as const)
  const both = context.difficulty === 'L3' && context.random.next() < 0.5
  const changedDividend = dividend * factor
  const changedDivisor = both ? divisor * factor : divisor
  const answer = both ? quotient : quotient * factor
  return buildMathSnapshot(context, {
    prompt: `${dividend} ÷ ${divisor} = ${quotient}，${changedDividend} ÷ ${changedDivisor} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先分别比较被除数和除数的变化，再判断商',
      level2: both
        ? `被除数和除数同时乘 ${factor}，商不变`
        : `除数不变，被除数乘 ${factor}，商也乘 ${factor}`,
    },
    explanationSteps: [
      `根据变化规律，商为 ${answer}`,
      `用 ${changedDivisor} × ${answer} = ${changedDividend} 验算`,
    ],
    errorCauseRules: [
      cause('quotient-change-misapplied', '商的变化判断错误', '先确认被除数和除数是否同时变化', [
        { kind: 'number', value: both ? quotient * factor : quotient },
      ]),
    ],
  })
})

registerMathGenerator('multiplication-estimation', (context) => {
  const roundedA = context.random.int(2, 9) * 100
  const roundedB = context.random.int(2, 9) * 10
  const a = roundedA - context.random.int(1, 9)
  const b = roundedB + context.random.int(1, 9)
  const answer = roundedA * roundedB
  return buildMathSnapshot(context, {
    prompt: `把 ${a} 看作 ${roundedA}，把 ${b} 看作 ${roundedB}，积约是多少？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '只使用题目给出的两个近似数计算',
      level2: `按估法应计算 ${roundedA} × ${roundedB}`,
    },
    explanationSteps: [`${roundedA} × ${roundedB} = ${answer}`, `估算结果是 ${answer}`],
    errorCauseRules: [
      cause('not-using-estimate', '未按指定估法', '不要计算原数的准确积，使用题目给出的近似数', [
        { kind: 'number', value: a * b },
      ]),
    ],
  })
})

registerMathGenerator('division-estimation', (context) => {
  const divisor = context.random.int(2, 9) * 10
  const quotient = context.random.int(2, 9)
  const roundedDividend = divisor * quotient
  const dividend = roundedDividend - context.random.int(1, 9)
  return buildMathSnapshot(context, {
    prompt: `把 ${dividend} 看作 ${roundedDividend}，除数是 ${divisor}，商约是多少？`,
    answer: { kind: 'number', value: quotient },
    acceptedAnswerRule: numberRule(quotient),
    hints: {
      level1: '用题目给出的近似被除数除以除数',
      level2: `按估法应计算 ${roundedDividend} ÷ ${divisor}`,
    },
    explanationSteps: [`${divisor} × ${quotient} = ${roundedDividend}`, `所以估算商是 ${quotient}`],
  })
})

registerMathGenerator('division-verification', (context) => {
  const divisor = context.random.int(10, 30)
  const quotient = context.random.int(2, 9)
  const remainder = context.random.int(1, divisor - 1)
  const dividend = divisor * quotient + remainder
  return buildMathSnapshot(context, {
    prompt: `一道除法的除数是 ${divisor}，商是 ${quotient}，余数是 ${remainder}。用乘法验算，被除数是多少？`,
    answer: { kind: 'number', value: dividend },
    acceptedAnswerRule: numberRule(dividend),
    hints: {
      level1: '验算时把商乘除数，再加上余数',
      level2: `先算 ${divisor} × ${quotient}，不要忘记加余数`,
    },
    explanationSteps: [
      `${divisor} × ${quotient} = ${divisor * quotient}`,
      `${divisor * quotient} + ${remainder} = ${dividend}`,
    ],
    errorCauseRules: [
      cause('verification-forgot-remainder', '验算时漏加余数', '商乘除数后还要加上余数', [
        { kind: 'number', value: divisor * quotient },
      ]),
    ],
  })
})

registerMathGenerator('prior-review', (context) => {
  const a = context.random.int(2, 9)
  const b = context.random.int(2, 9)
  if (context.random.next() < 0.5) return multiplication(context, a, b)
  return buildMathSnapshot(context, {
    prompt: `${a * b} ÷ ${a} = ?`,
    answer: { kind: 'number', value: b },
    acceptedAnswerRule: numberRule(b),
    hints: { level1: '先想对应的乘法口诀', level2: `想 ${a} 乘几等于 ${a * b}` },
    explanationSteps: [`${a} × ${b} = ${a * b}`, `所以商是 ${b}`],
  })
})

registerMathGenerator('product-rule-choice', (context) => {
  const factor = context.random.pick([2, 3, 5] as const)
  const divide = context.random.next() < 0.5
  const a = divide ? factor * context.random.int(2, 12) : context.random.int(2, 20)
  const b = context.random.int(3, 15)
  const changed = divide ? a / factor : a * factor
  const verb = divide ? '除以' : '乘'
  const options = shuffleOptions(context.random, [
    { id: 'opt-a', text: `也${verb} ${factor}` },
    { id: 'opt-b', text: `也${divide ? '乘' : '除以'} ${factor}` },
    { id: 'opt-c', text: '不变' },
    { id: 'opt-d', text: '无法确定' },
  ])
  return buildMathSnapshot(context, {
    prompt: `${a} × ${b} = ${a * b}。如果 ${a} ${verb} ${factor} 变成 ${changed}，${b} 不变，积会怎样变化？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先比较变化前后的两个乘数，另一个乘数有没有变',
      level2: `一个乘数${verb} ${factor}，另一个不变，积按相同倍数跟着变化`,
    },
    explanationSteps: [
      `原积是 ${a * b}`,
      `一个乘数${verb} ${factor}，积也${verb} ${factor}`,
      `变化后的积是 ${divide ? (a * b) / factor : a * b * factor}`,
    ],
    errorCauseRules: [
      cause('rule-direction-confused', '变化方向判断错误', '先确认乘数是乘还是除以同一个数', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
      cause('product-unchanged-misconception', '认为积不变', '一个乘数变化，积会按相同倍数变化', [
        { kind: 'single-choice', optionId: 'opt-c' },
      ]),
    ],
  })
})

registerMathGenerator('quotient-rule-choice', (context) => {
  const divisor = context.random.int(3, 12)
  const quotient = context.random.int(3, 12)
  const dividend = divisor * quotient
  const factor = context.random.pick([2, 3, 5] as const)
  const both = context.difficulty === 'L3' && context.random.next() < 0.5
  const options = shuffleOptions(
    context.random,
    both
      ? [
          { id: 'opt-a', text: '不变' },
          { id: 'opt-b', text: `也乘 ${factor}` },
          { id: 'opt-c', text: `也除以 ${factor}` },
          { id: 'opt-d', text: '无法确定' },
        ]
      : [
          { id: 'opt-a', text: `也乘 ${factor}` },
          { id: 'opt-b', text: `也除以 ${factor}` },
          { id: 'opt-c', text: '不变' },
          { id: 'opt-d', text: '无法确定' },
        ],
  )
  return buildMathSnapshot(context, {
    prompt: both
      ? `${dividend} ÷ ${divisor} = ${quotient}。如果被除数和除数同时乘 ${factor}，商会怎样变化？`
      : `${dividend} ÷ ${divisor} = ${quotient}。如果被除数乘 ${factor}，除数不变，商会怎样变化？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先分别看被除数和除数有没有变化，再想商怎样变',
      level2: both
        ? `被除数和除数同时乘相同的数（0 除外），商保持原来的值`
        : `除数不变，被除数乘 ${factor}，商随被除数按相同倍数变化`,
    },
    explanationSteps: both
      ? ['被除数和除数同时乘相同的数（0 除外），商不变', `所以商仍是 ${quotient}`]
      : [`除数不变，被除数乘 ${factor}，商也乘 ${factor}`, `变化后的商是 ${quotient * factor}`],
    errorCauseRules: [
      cause(
        'quotient-rule-direction-confused',
        '商的变化方向判断错误',
        both ? '同时乘相同的数，商不变' : '先确认除数是否变化',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

registerMathGenerator('estimate-method-choice', (context) => {
  const roundedA = context.random.int(2, 9) * 100
  const roundedB = context.random.int(2, 9) * 10
  const a = roundedA - context.random.int(1, 4)
  const b = roundedB + context.random.int(1, 4)
  const options = shuffleOptions(context.random, [
    { id: 'opt-a', text: `${roundedA} × ${roundedB}` },
    { id: 'opt-b', text: `${roundedA - 100} × ${roundedB}` },
    { id: 'opt-c', text: `${roundedA} × ${roundedB + 10}` },
    { id: 'opt-d', text: `${a} × ${b}` },
  ])
  return buildMathSnapshot(context, {
    prompt: `估算 ${a} × ${b} 时，按四舍五入到整百、整十数，下面哪种估法最合适？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先把两个乘数分别四舍五入到整百数和整十数',
      level2: `${a} 接近 ${roundedA}，${b} 接近 ${roundedB}`,
    },
    explanationSteps: [
      `${a} ≈ ${roundedA}，${b} ≈ ${roundedB}`,
      `用 ${roundedA} × ${roundedB} 估算`,
      `估算结果是 ${roundedA * roundedB}`,
    ],
    errorCauseRules: [
      cause('estimate-not-rounded', '未使用近似数', '估算要用四舍五入后的整百、整十数', [
        { kind: 'single-choice', optionId: 'opt-d' },
      ]),
      cause('estimate-wrong-rounding', '近似数取值错误', '四舍五入时看省略部分的最高位', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('product-rule-blank', (context) => {
  const k = context.random.pick([2, 3, 5] as const)
  // k=2 且 m=2 时 k+m 与 k×m 相等，会让错因答案与正确答案重合，需避开
  const m = k === 2 ? 3 : context.random.pick([2, 3] as const)
  const first = `乘 ${k}`
  const second = `乘 ${k * m}`
  return buildMathSnapshot(context, {
    prompt: `一个乘数乘 ${k}，另一个乘数不变，积就（____）；两个乘数分别乘 ${k} 和乘 ${m}，积就（____）。`,
    answer: { kind: 'fill-blanks', values: [first, second] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [
        [first, `乘${k}`],
        [second, `乘${k * m}`],
      ],
      trimWhitespace: true,
    },
    hints: {
      level1: '先想一个乘数变化时积怎样变，再想两个乘数都变化时积怎样变',
      level2: '一个乘数乘几，积就跟着乘几；两个乘数都变化时，把两次变化倍数相乘',
    },
    explanationSteps: [
      `一个乘数乘 ${k}，另一个不变，积乘 ${k}`,
      `两个乘数分别乘 ${k} 和 ${m}，积乘 ${k} × ${m} = ${k * m}`,
      `所以两空分别填“${first}”和“${second}”`,
    ],
    errorCauseRules: [
      cause(
        'product-rule-add-factors',
        '积的变化倍数相加',
        '两个乘数分别乘几，积要乘它们的积，而不是相加',
        [{ kind: 'fill-blanks', values: [first, `乘 ${k + m}`] }],
      ),
      cause('product-rule-blank-swapped', '两空顺序颠倒', '按题目顺序分别判断两种变化', [
        { kind: 'fill-blanks', values: [second, first] },
      ]),
    ],
  })
})

registerMathGenerator('quotient-rule-blank', (context) => {
  const k = context.random.pick([2, 4, 5] as const)
  const first = `乘 ${k}`
  return buildMathSnapshot(context, {
    prompt: `被除数乘 ${k}，除数不变，商就（____）；被除数和除数同时除以 ${k}，商就（____）。`,
    answer: { kind: 'fill-blanks', values: [first, '不变'] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [[first, `乘${k}`], ['不变']],
      trimWhitespace: true,
    },
    hints: {
      level1: '先分别看被除数和除数有没有变化，再想商怎样变',
      level2:
        '除数不变时，商随被除数按相同倍数变化；被除数和除数同时除以相同的数（0 除外），商保持原来的值',
    },
    explanationSteps: [
      `除数不变，被除数乘 ${k}，商也乘 ${k}`,
      `被除数和除数同时除以 ${k}，商不变`,
      `所以两空分别填“${first}”和“不变”`,
    ],
    errorCauseRules: [
      cause(
        'quotient-invariant-misused',
        '商不变性质误用',
        '只有被除数和除数同时乘或除以相同的数（0 除外），商才不变',
        [{ kind: 'fill-blanks', values: [first, first] }],
      ),
    ],
  })
})

registerMathGenerator('shopping-estimate-word', (context) => {
  const roundedCount = context.random.int(2, 4) * 10
  const roundedPrice = context.random.int(2, 9) * 10
  const count = roundedCount + context.random.pick([-1, 1] as const) * context.random.int(1, 4)
  const price = roundedPrice + context.random.pick([-1, 1] as const) * context.random.int(1, 4)
  const value = roundedCount * roundedPrice
  const exact = count * price
  const causes: ErrorCauseRule[] = [
    cause('shopping-estimate-wrong-unit', '单位写错', '题目问的是多少元，单位应写“元”', [
      { kind: 'word-problem', value, unit: '角' },
    ]),
  ]
  if (exact !== value) {
    causes.unshift(
      cause('shopping-estimate-not-rounded', '未按指定估法计算', '要使用题目给出的两个近似数相乘', [
        { kind: 'word-problem', value: exact, unit: '元' },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `学校买 ${count} 个篮球，每个 ${price} 元。把 ${count} 看作 ${roundedCount}，把 ${price} 看作 ${roundedPrice} 估算，大约一共要多少元？`,
    answer: { kind: 'word-problem', value, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value, unit: '元' }],
      unitRequired: true,
    },
    hints: {
      level1: '只使用题目给出的两个近似数相乘，别忘了写单位',
      level2: `按估法计算 ${roundedCount} × ${roundedPrice}，结果单位是元`,
    },
    explanationSteps: [`${roundedCount} × ${roundedPrice} = ${value}`, `大约一共要 ${value} 元`],
    errorCauseRules: causes,
  })
})

registerMathGenerator('shopping-multiplication-word', (context) => {
  const price = context.random.int(105, 399)
  const count = context.random.int(11, 24)
  const value = price * count
  return buildMathSnapshot(context, {
    prompt: `一套科普书 ${price} 元，学校买 ${count} 套。一共要多少元？`,
    answer: { kind: 'word-problem', value, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value, unit: '元' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想“单价 × 数量 = 总价”这个数量关系',
      level2: `每套 ${price} 元，买 ${count} 套，用 ${price} × ${count}`,
    },
    explanationSteps: [
      '单价 × 数量 = 总价',
      `${price} × ${count} = ${value}`,
      `一共要 ${value} 元`,
    ],
    errorCauseRules: [
      cause('shopping-add-instead-multiply', '把乘法做成加法', '求几个相同加数的和用乘法', [
        { kind: 'word-problem', value: price + count, unit: '元' },
      ]),
      cause('shopping-forgot-count', '漏乘套数', '总价要乘购买的套数', [
        { kind: 'word-problem', value: price, unit: '元' },
      ]),
    ],
  })
})

export function generateMathQuestion(
  templateId: string,
  seed: number,
  instanceId: string,
  difficulty?: Difficulty,
): QuestionSnapshot {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('题目种子必须是非负安全整数')
  if (instanceId.trim().length === 0) throw new Error('题目实例 ID 不能为空')
  const template = getMathTemplate(templateId)
  if (isMathTemplateDisabled(templateId)) throw new Error(`模板已停用：${templateId}`)
  const course = getCourseById(template.classification.courseId)
  if (!course) throw new Error(`模板课程不存在：${template.classification.courseId}`)
  const selectedDifficulty = difficulty ?? template.difficulty
  if (!template.supportedDifficulties.includes(selectedDifficulty)) {
    throw new Error(`模板 ${templateId} 不支持难度 ${selectedDifficulty}`)
  }
  const context: MathGeneratorContext = {
    template,
    course,
    difficulty: selectedDifficulty,
    seed,
    instanceId,
    random: seededRandom(seed),
  }
  return parseQuestionSnapshot(getMathGenerator(template.generator)(context), course)
}

export function createRetestQuestion(
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
): QuestionSnapshot {
  if (instanceId === original.instanceId) throw new Error('复测题必须使用新的题目实例 ID')
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateMathQuestion(
      original.templateId,
      seed + attempt,
      instanceId,
      original.difficulty,
    )
    if (candidate.prompt !== original.prompt) return candidate
  }
  throw new Error('无法生成不同数字的复测变式')
}
