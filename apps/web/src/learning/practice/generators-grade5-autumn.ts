import type { ErrorCauseRule } from '../types'
import {
  buildMathSnapshot,
  cause,
  DIAGRAM_NOTE,
  decimalText,
  decimalValue,
  numberRule,
  registerMathGenerator,
  shuffleOptions,
  textResource,
  type MathGeneratorContext,
} from './math-gen-shared'

function choiceOptions(context: MathGeneratorContext, texts: readonly string[]) {
  return shuffleOptions(
    context.random,
    texts.map((text, index) => ({ id: `opt-${'abcd'[index]}`, text })),
  )
}

/** 错因答案值必须互不相同且都不等于标准答案，否则 judgeAnswer 归因会错位。 */
function pushDistinct(
  causes: ErrorCauseRule[],
  used: Set<number>,
  value: number,
  rule: ErrorCauseRule,
): void {
  if (!used.has(value)) {
    causes.push(rule)
    used.add(value)
  }
}

// 模块一：小数乘法
registerMathGenerator('g5a-decimal-times-integer', (context) => {
  const scale = context.difficulty === 'L1' ? 1 : context.difficulty === 'L2' ? 2 : 3
  const a = context.random.int(1, 9) * 10 + context.random.int(1, 9)
  const c = context.random.int(2, 9 * scale)
  const answer = decimalValue(a * c, 1)
  return buildMathSnapshot(context, {
    prompt: `${decimalText(a, 1)} × ${c} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先按整数乘法算出积，再想小数点应该点在哪里',
      level2: '因数里有几位小数，积就有几位小数',
    },
    explanationSteps: [
      `先按整数乘法计算：${a} × ${c} = ${a * c}`,
      `因数中有一位小数，从积的右边起数出一位点上小数点，得到 ${answer}`,
    ],
    errorCauseRules: [
      cause(
        'times-integer-point-missing',
        '忘记点小数点',
        '小数乘整数，积的小数位数与因数中的小数位数相同',
        [{ kind: 'number', value: a * c }],
      ),
    ],
  })
})

registerMathGenerator('g5a-decimal-times-decimal', (context) => {
  const a = context.random.int(1, 9) * 10 + context.random.int(1, 9)
  const b = context.random.int(1, 9) * 10 + context.random.int(1, 9)
  const answer = decimalValue(a * b, 2)
  return buildMathSnapshot(context, {
    prompt: `${decimalText(a, 1)} × ${decimalText(b, 1)} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先按整数乘法算出积，再数两个因数一共有几位小数',
      level2: '两个因数的小数位数合起来，就是积的小数位数',
    },
    explanationSteps: [
      `先按整数乘法计算：${a} × ${b} = ${a * b}`,
      `两个因数各有一位小数，共两位，积点出两位小数得到 ${answer}`,
    ],
    errorCauseRules: [
      cause(
        'times-decimal-extra-place',
        '积的小数位数点错',
        '积的小数位数等于两个因数小数位数之和',
        [{ kind: 'number', value: decimalValue(a * b, 3) }],
      ),
    ],
  })
})

registerMathGenerator('g5a-product-approximation', (context) => {
  const a = context.random.int(1, 9) * 10 + context.random.int(1, 9)
  let b = context.random.int(1, 9) * 10 + context.random.int(1, 9)
  while ((a * b) % 10 === 0) b += 1
  const product = a * b
  const answer = decimalValue(Math.round(product / 10), 1)
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    decimalValue(Math.floor(product / 10), 1),
    cause('product-round-truncated', '直接舍去尾数', '取近似数要四舍五入，看省略部分的最高位', [
      { kind: 'number', value: decimalValue(Math.floor(product / 10), 1) },
    ]),
  )
  pushDistinct(
    causes,
    used,
    decimalValue(product, 2),
    cause('product-not-rounded', '忘记取近似数', '题目要求保留一位小数，要对积四舍五入', [
      { kind: 'number', value: decimalValue(product, 2) },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `先计算 ${decimalText(a, 1)} × ${decimalText(b, 1)}，再把积保留一位小数，结果是多少？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先算出准确的积，再想怎样按要求取近似数',
      level2: '保留一位小数时，看百分位上的数决定舍还是入',
    },
    explanationSteps: [
      `准确的积是 ${decimalText(product, 2)}`,
      `百分位四舍五入后保留一位小数约是 ${answer}`,
    ],
    errorCauseRules: causes,
  })
})

registerMathGenerator('g5a-laws-extension-choice', (context) => {
  const form = context.random.int(0, 2)
  const correct = ['乘法交换律', '乘法结合律', '乘法分配律'][form]
  const distractor = ['乘法结合律', '乘法分配律', '乘法交换律'][form]
  let prompt: string
  if (form === 0) {
    const [a, b] = context.random.pick([
      ['0.8', '1.25'],
      ['2.5', '0.4'],
      ['1.5', '0.6'],
    ] as const)
    prompt = `${a} × ${b} = ${b} × ${a} 运用了什么运算定律？`
  } else if (form === 1) {
    const [a, b, c] = context.random.pick([
      ['0.25', '0.4', '7'],
      ['1.25', '0.8', '3'],
      ['0.5', '0.2', '9'],
    ] as const)
    prompt = `(${a} × ${b}) × ${c} = ${a} × (${b} × ${c}) 运用了什么运算定律？`
  } else {
    const [a, b, c] = context.random.pick([
      ['2.5', '0.4', '4'],
      ['1.25', '0.75', '8'],
      ['0.6', '0.4', '5'],
    ] as const)
    prompt = `(${a} + ${b}) × ${c} = ${a} × ${c} + ${b} × ${c} 运用了什么运算定律？`
  }
  const options = choiceOptions(context, [correct, distractor, '加法结合律', '加法交换律'])
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先观察算式两边的运算和位置发生了什么变化',
      level2: '交换位置是交换律，改变相乘顺序是结合律，拆开相加再乘是分配律',
    },
    explanationSteps: [`整数乘法的运算定律同样适用于小数，算式的变化符合${correct}的特征`],
    errorCauseRules: [
      cause('laws-extension-confused', '乘法定律混淆', '先分清交换位置、改变顺序与展开相乘的区别', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5a-multiplication-shopping-word', (context) => {
  const a = context.random.int(1, 9) * 10 + context.random.int(1, 9)
  const c = context.random.int(2, 9)
  const answer = decimalValue(a * c, 1)
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    decimalValue(a + c * 10, 1),
    cause('shopping-added', '把单价和数量相加', '求总价要用单价乘数量', [
      { kind: 'word-problem', value: decimalValue(a + c * 10, 1), unit: '元' },
    ]),
  )
  pushDistinct(
    causes,
    used,
    a * c,
    cause('shopping-point-missing', '忘记点小数点', '单价是一位小数，总价也要点出相应的小数位数', [
      { kind: 'word-problem', value: a * c, unit: '元' },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `每千克苹果 ${decimalText(a, 1)} 元，买 ${c} 千克，一共要付多少元？`,
    answer: { kind: 'word-problem', value: answer, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '元' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想总价、单价和数量之间的关系',
      level2: '总价 = 单价 × 数量，按小数乘法计算',
    },
    explanationSteps: [`总价：${decimalText(a, 1)} × ${c} = ${answer}（元）`],
    errorCauseRules: causes,
  })
})

// 模块二：小数除法
registerMathGenerator('g5a-decimal-divided-by-integer', (context) => {
  const scale = context.difficulty === 'L1' ? 1 : context.difficulty === 'L2' ? 2 : 3
  const q = context.random.int(1, 9 * scale) * 10 + context.random.int(1, 9)
  const d = context.random.int(2, 9)
  const dividend = q * d
  const answer = decimalValue(q, 1)
  return buildMathSnapshot(context, {
    prompt: `${decimalText(dividend, 1)} ÷ ${d} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先按整数除法来算，再想商的小数点位置',
      level2: '商的小数点要和被除数的小数点对齐',
    },
    explanationSteps: [
      `按整数除法计算 ${dividend} ÷ ${d} = ${q}`,
      `商的小数点与被除数对齐，得到 ${answer}`,
    ],
    errorCauseRules: [
      cause('divided-integer-point-missing', '商忘记点小数点', '商的小数点要和被除数的小数点对齐', [
        { kind: 'number', value: q },
      ]),
    ],
  })
})

registerMathGenerator('g5a-divide-by-decimal', (context) => {
  const dScaled = context.random.int(2, 9)
  const k = context.random.int(2, 20)
  const dividend = k * dScaled
  return buildMathSnapshot(context, {
    prompt: `${decimalText(dividend, 1)} ÷ ${decimalText(dScaled, 1)} = ?`,
    answer: { kind: 'number', value: k },
    acceptedAnswerRule: numberRule(k),
    hints: {
      level1: '先想怎样把除数变成整数',
      level2: '除数扩大几倍，被除数也要扩大相同的倍，商不变',
    },
    explanationSteps: [
      `把除数 ${decimalText(dScaled, 1)} 扩大 10 倍变成 ${dScaled}`,
      `被除数也扩大 10 倍，商不变，结果是 ${k}`,
    ],
    errorCauseRules: [
      cause('divide-decimal-shift', '除数转化后商跟着缩小', '被除数和除数扩大相同倍数，商不变', [
        { kind: 'number', value: decimalValue(k, 1) },
      ]),
    ],
  })
})

registerMathGenerator('g5a-quotient-approximation', (context) => {
  const d = context.random.pick([3, 6, 7, 9] as const)
  let n = context.random.int(2, 9)
  while ((n * 100) % d === 0) n += 1
  const answer = decimalValue(Math.round((n * 100) / d), 2)
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    decimalValue(Math.floor((n * 100) / d), 2),
    cause('quotient-round-truncated', '直接舍去尾数', '取商的近似数要四舍五入', [
      { kind: 'number', value: decimalValue(Math.floor((n * 100) / d), 2) },
    ]),
  )
  pushDistinct(
    causes,
    used,
    decimalValue(Math.round((n * 10) / d), 1),
    cause('quotient-wrong-place', '保留位数错误', '题目要求保留两位小数，不是保留一位', [
      { kind: 'number', value: decimalValue(Math.round((n * 10) / d), 1) },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `把 ${n} ÷ ${d} 的商保留两位小数，结果是多少？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先除到比要保留的位数多一位，再取近似数',
      level2: '保留两位小数时，看千分位上的数决定舍还是入',
    },
    explanationSteps: [`计算 ${n} ÷ ${d}，除到千分位`, `四舍五入保留两位小数约是 ${answer}`],
    errorCauseRules: causes,
  })
})

registerMathGenerator('g5a-repeating-choice', (context) => {
  const correct = context.random.pick(['1÷3', '2÷3', '1÷6', '5÷6'] as const)
  const distractors = shuffleOptions(
    context.random,
    ['1÷2', '1÷4', '1÷5', '3÷4', '7÷8'].map((text, index) => ({ id: `d-${index}`, text })),
  )
    .slice(0, 3)
    .map((item) => item.text)
  const options = choiceOptions(context, [correct, ...distractors])
  const phrasing = context.random.pick([
    '下面哪个算式的商是循环小数？',
    '不计算，判断下面哪个算式的商是循环小数？',
    '下面四个算式中，商是循环小数的是哪一个？',
  ] as const)
  return buildMathSnapshot(context, {
    prompt: phrasing,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想哪些除法除不尽，商的小数部分会不断重复',
      level2: '除不尽且小数部分依次不断重复出现的商是循环小数',
    },
    explanationSteps: [`${correct} 除不尽，商的小数部分依次不断重复，是循环小数`],
    errorCauseRules: [
      cause('repeating-confused', '循环小数判断错误', '能除尽的商是有限小数，不是循环小数', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5a-division-application-word', (context) => {
  const k = context.random.int(4, 16)
  const total = k * 5
  return buildMathSnapshot(context, {
    prompt: `把 ${decimalText(total, 1)} 米长的绳子剪成每段 0.5 米的小段，可以剪成多少段？`,
    answer: { kind: 'word-problem', value: k, unit: '段' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: k, unit: '段' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想总长度里包含几个每段的长度',
      level2: '段数 = 总长度 ÷ 每段长度，用小数除法计算',
    },
    explanationSteps: [`${decimalText(total, 1)} ÷ 0.5 = ${k}（段）`],
    errorCauseRules: [
      cause(
        'division-application-total-only',
        '只写了总长度',
        '题目求的是段数，要用总长度除以每段长度',
        [{ kind: 'word-problem', value: decimalValue(total, 1), unit: '段' }],
      ),
    ],
  })
})

// 模块三：位置
registerMathGenerator('g5a-position-pairs-blank', (context) => {
  const column = context.random.int(1, 5)
  let row = context.random.int(1, 5)
  if (row === column) row = (column % 5) + 1
  return buildMathSnapshot(context, {
    prompt: `教室里小明的位置是第 ${column} 列第 ${row} 行，用数对表示是（____，____）。`,
    answer: { kind: 'fill-blanks', values: [String(column), String(row)] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [[String(column)], [String(row)]],
      trimWhitespace: true,
    },
    hints: {
      level1: '先想数对里两个数分别表示什么',
      level2: '数对先写列数，再写行数',
    },
    explanationSteps: [`数对先列后行，第 ${column} 列第 ${row} 行写作（${column}，${row}）`],
    errorCauseRules: [
      cause('position-pairs-swapped', '列行顺序颠倒', '数对要先写列数，再写行数', [
        { kind: 'fill-blanks', values: [String(row), String(column)] },
      ]),
      cause('position-pairs-column-off', '列数多数了一', '数对中的列数要与题目一致', [
        { kind: 'fill-blanks', values: [String(column + 1), String(row)] },
      ]),
    ],
  })
})

registerMathGenerator('g5a-position-from-pairs-blank', (context) => {
  const column = context.random.int(1, 5)
  let row = context.random.int(1, 5)
  if (row === column) row = (column % 5) + 1
  return buildMathSnapshot(context, {
    prompt: `数对（${column}，${row}）表示一个位置，它在第 ____ 列第 ____ 行。`,
    answer: { kind: 'fill-blanks', values: [String(column), String(row)] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [[String(column)], [String(row)]],
      trimWhitespace: true,
    },
    hints: {
      level1: '先想数对中哪个数表示列、哪个数表示行',
      level2: '数对的第一个数表示列，第二个数表示行',
    },
    explanationSteps: [`数对（${column}，${row}）的第一个数是列，第二个数是行`],
    errorCauseRules: [
      cause('position-from-swapped', '把列行读反了', '数对第一个数是列，第二个数是行', [
        { kind: 'fill-blanks', values: [String(row), String(column)] },
      ]),
      cause('position-from-row-off', '行数多数了一', '行数要与数对中的第二个数一致', [
        { kind: 'fill-blanks', values: [String(column), String(row + 1)] },
      ]),
    ],
  })
})

// 模块四：可能性
registerMathGenerator('g5a-possibility-size-choice', (context) => {
  const red = context.random.int(1, 8)
  let yellow = context.random.int(1, 8)
  if (yellow === red) yellow += 1
  const more = red > yellow ? '红球' : '黄球'
  const less = red > yellow ? '黄球' : '红球'
  const options = choiceOptions(context, [more, less, '一样大', '无法确定'])
  return buildMathSnapshot(context, {
    prompt: `盒子里有 ${red} 个红球和 ${yellow} 个黄球，任意摸出一个，摸到哪种球的可能性大？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先比较两种球的数量谁多谁少',
      level2: '数量越多，摸到的可能性越大',
    },
    explanationSteps: [`${more}的数量多，所以摸到${more}的可能性大`],
    errorCauseRules: [
      cause('possibility-size-reversed', '可能性大小判断反了', '数量多的那种球摸到的可能性才大', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5a-possibility-description-choice', (context) => {
  const mode = context.random.int(0, 2)
  const red = mode === 1 ? 0 : context.random.int(3, 6)
  const yellow = mode === 0 ? 0 : context.random.int(3, 6)
  const correct = ['一定', '不可能', '可能'][mode]
  const others = ['一定', '可能', '不可能'].filter((item) => item !== correct)
  const options = choiceOptions(context, [correct, ...others, '无法确定'])
  return buildMathSnapshot(context, {
    prompt: `盒子里有 ${red} 个红球和 ${yellow} 个黄球，任意摸出一个，摸到红球这件事是（）的。`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先看盒子里有没有红球、是不是只有红球',
      level2: '只有红球是一定，没有红球是不可能，既有红球又有其他球是可能',
    },
    explanationSteps: [
      mode === 0
        ? '盒子里全是红球，摸到红球是一定的'
        : mode === 1
          ? '盒子里没有红球，摸到红球是不可能的'
          : '盒子里既有红球又有黄球，摸到红球是可能的',
    ],
    errorCauseRules: [
      cause(
        'possibility-description-confused',
        '一定可能不可能混淆',
        '先判断事件是否必然发生或必然不发生',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

// 模块五：简易方程
registerMathGenerator('g5a-algebraic-expression-blank', (context) => {
  const letter = context.random.pick(['a', 'x', 'm'] as const)
  const k = context.random.int(2, 9)
  return buildMathSnapshot(context, {
    prompt: `${letter} 的 ${k} 倍是（____）。`,
    answer: { kind: 'fill-blanks', values: [`${k}${letter}`] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [[`${k}${letter}`, `${letter}×${k}`, `${letter}*${k}`]],
      trimWhitespace: true,
    },
    hints: {
      level1: '先想“几倍”用什么运算表示',
      level2: '求一个数的几倍用乘法，数字与字母相乘可以省略乘号',
    },
    explanationSteps: [`${letter} 的 ${k} 倍用乘法表示，写作 ${k}${letter}`],
    errorCauseRules: [
      cause('algebra-added', '把几倍当成加几', '“几倍”是乘法，不是加法', [
        { kind: 'fill-blanks', values: [`${letter}+${k}`] },
      ]),
    ],
  })
})

registerMathGenerator('g5a-equation-properties-choice', (context) => {
  const c = context.random.int(2, 9)
  const [left, right] = context.random.pick([
    ['a', 'b'],
    ['m', 'n'],
    ['x', 'y'],
    ['p', 'q'],
  ] as const)
  const multiply = context.random.next() < 0.5
  const correct = multiply ? `${left} × ${c} = ${right} × ${c}` : `${left} + ${c} = ${right} + ${c}`
  const distractors = multiply
    ? [
        `${left} × ${c} = ${right} ÷ ${c}`,
        `${left} ÷ ${c} = ${right} × ${c}`,
        `${left} × ${c} = ${right}`,
      ]
    : [
        `${left} + ${c} = ${right} - ${c}`,
        `${left} - ${c} = ${right} + ${c}`,
        `${left} + ${c} = ${right}`,
      ]
  const options = choiceOptions(context, [correct, ...distractors])
  return buildMathSnapshot(context, {
    prompt: `如果 ${left} = ${right}，下面哪个式子一定成立？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想等式两边要怎样变化才能保持相等',
      level2: '等式两边同时加上或乘同一个数，等式仍然成立',
    },
    explanationSteps: ['等式两边同时加上（或乘）同一个数，左右两边仍然相等'],
    errorCauseRules: [
      cause('equation-properties-asymmetric', '两边变化不一致', '等式两边必须同时做相同的运算', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5a-solve-equation', (context) => {
  const difficulty = context.difficulty
  let prompt: string
  let answer: number
  let wrong: number
  let wrongLabel: string
  let wrongFeedback: string
  let steps: string[]
  if (difficulty === 'L3') {
    const a = context.random.int(2, 9)
    const x = context.random.int(2, 12)
    const b = context.random.int(2, 20)
    const c = a * x + b
    prompt = `解方程 ${a}x + ${b} = ${c}，x 等于多少？`
    answer = x
    wrong = c - b
    wrongLabel = 'solve-forgot-divide'
    wrongFeedback = '先把常数项移到右边，再除以未知数的系数'
    steps = [`两边同时减 ${b}：${a}x = ${c - b}`, `两边同时除以 ${a}：x = ${x}`]
  } else if (difficulty === 'L2') {
    const a = context.random.int(2, 9)
    const x = context.random.int(2, 12)
    const b = a * x
    prompt = `解方程 ${a}x = ${b}，x 等于多少？`
    answer = x
    wrong = b * a
    wrongLabel = 'solve-multiplied-instead'
    wrongFeedback = '求未知数要用除法，不是乘法'
    steps = [`两边同时除以 ${a}：x = ${b} ÷ ${a} = ${x}`]
  } else {
    const subtract = context.random.next() < 0.5
    const a = context.random.int(2, 9)
    const x = context.random.int(2, 20)
    if (subtract) {
      const b = x - a > 0 ? x - a : x + a
      const actualX = b + a
      prompt = `解方程 x - ${a} = ${b}，x 等于多少？`
      answer = actualX
      wrong = b - a
      wrongLabel = 'solve-subtracted-instead'
      wrongFeedback = '被减数 = 差 + 减数，要用加法'
      steps = [`两边同时加 ${a}：x = ${b} + ${a} = ${actualX}`]
    } else {
      const b = x + a
      prompt = `解方程 x + ${a} = ${b}，x 等于多少？`
      answer = x
      wrong = b + a
      wrongLabel = 'solve-added-instead'
      wrongFeedback = '求加数要用和减另一个加数'
      steps = [`两边同时减 ${a}：x = ${b} - ${a} = ${x}`]
    }
  }
  const causes: ErrorCauseRule[] = []
  if (wrong >= 0 && wrong !== answer) {
    causes.push(
      cause(wrongLabel, '解方程运算方向错误', wrongFeedback, [{ kind: 'number', value: wrong }]),
    )
  }
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先想怎样把含有未知数的一边单独留下',
      level2: '利用等式的性质，两边同时做相同的运算',
    },
    explanationSteps: steps,
    errorCauseRules: causes,
  })
})

registerMathGenerator('g5a-equation-application-word', (context) => {
  const spent = context.random.int(20, 50)
  const left = context.random.int(5, 15)
  const answer = spent + left
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    spent - left,
    cause('equation-app-subtracted', '用减法求原来的钱', '原来的钱 = 花掉的 + 剩下的，要用加法', [
      { kind: 'word-problem', value: spent - left, unit: '元' },
    ]),
  )
  pushDistinct(
    causes,
    used,
    left,
    cause('equation-app-left-only', '只写了剩下的钱', '题目求的是原来一共有的钱', [
      { kind: 'word-problem', value: left, unit: '元' },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `小明买文具花了 ${spent} 元，还剩 ${left} 元。他原来有多少元？（列方程解答）`,
    answer: { kind: 'word-problem', value: answer, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '元' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想原来的钱、花掉的钱和剩下的钱之间的关系',
      level2: '设原来有 x 元，列方程 x - 花掉的 = 剩下的',
    },
    explanationSteps: [
      `设原来有 x 元：x - ${spent} = ${left}`,
      `解得 x = ${spent} + ${left} = ${answer}（元）`,
    ],
    errorCauseRules: causes,
  })
})

// 模块六：多边形面积
registerMathGenerator('g5a-parallelogram-area', (context) => {
  const scale = context.difficulty === 'L1' ? 1 : context.difficulty === 'L2' ? 2 : 3
  const base = context.random.int(3, 6 * scale)
  const height = context.random.int(3, 6 * scale)
  const answer = base * height
  return buildMathSnapshot(context, {
    prompt: `一个平行四边形的底是 ${base} 厘米，高是 ${height} 厘米，它的面积是多少平方厘米？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    resources: [
      textResource(
        'parallelogram',
        `平行四边形示意图：底标注 ${base} 厘米，对应的高标注 ${height} 厘米。${DIAGRAM_NOTE}`,
      ),
    ],
    hints: {
      level1: '先想平行四边形面积与底和高的关系',
      level2: '平行四边形面积 = 底 × 高',
    },
    explanationSteps: [`面积 = ${base} × ${height} = ${answer}（平方厘米）`],
    errorCauseRules: [
      cause('parallelogram-added', '把底和高相加', '面积要用底乘高，不是相加', [
        { kind: 'number', value: base + height },
      ]),
    ],
  })
})

registerMathGenerator('g5a-triangle-area', (context) => {
  const base = context.random.int(3, 12)
  let height = context.random.int(3, 12)
  if ((base * height) % 2 !== 0) height += 1
  const answer = (base * height) / 2
  return buildMathSnapshot(context, {
    prompt: `一个三角形的底是 ${base} 厘米，高是 ${height} 厘米，它的面积是多少平方厘米？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    resources: [
      textResource(
        'triangle-area',
        `三角形示意图：底标注 ${base} 厘米，对应的高标注 ${height} 厘米。${DIAGRAM_NOTE}`,
      ),
    ],
    hints: {
      level1: '先想三角形面积与等底等高平行四边形的关系',
      level2: '三角形面积 = 底 × 高 ÷ 2',
    },
    explanationSteps: [`面积 = ${base} × ${height} ÷ 2 = ${answer}（平方厘米）`],
    errorCauseRules: [
      cause('triangle-forgot-half', '忘记除以 2', '三角形面积是等底等高平行四边形的一半', [
        { kind: 'number', value: base * height },
      ]),
    ],
  })
})

registerMathGenerator('g5a-trapezoid-area', (context) => {
  const top = context.random.int(2, 8)
  const bottom = top + context.random.int(2, 8)
  let height = context.random.int(3, 10)
  if (((top + bottom) * height) % 2 !== 0) height += 1
  const answer = ((top + bottom) * height) / 2
  return buildMathSnapshot(context, {
    prompt: `一个梯形的上底是 ${top} 厘米，下底是 ${bottom} 厘米，高是 ${height} 厘米，它的面积是多少平方厘米？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    resources: [
      textResource(
        'trapezoid',
        `梯形示意图：上底标注 ${top} 厘米，下底标注 ${bottom} 厘米，高标注 ${height} 厘米。${DIAGRAM_NOTE}`,
      ),
    ],
    hints: {
      level1: '先想梯形面积与上底、下底和高的关系',
      level2: '梯形面积 =（上底 + 下底）× 高 ÷ 2',
    },
    explanationSteps: [`面积 =（${top} + ${bottom}）× ${height} ÷ 2 = ${answer}（平方厘米）`],
    errorCauseRules: [
      cause(
        'trapezoid-forgot-half',
        '忘记除以 2',
        '两个完全相同的梯形拼成平行四边形，梯形面积要除以 2',
        [{ kind: 'number', value: (top + bottom) * height }],
      ),
    ],
  })
})

registerMathGenerator('g5a-composite-area-word', (context) => {
  const width = context.random.int(3, 10)
  const rectHeight = context.random.int(3, 8)
  let triHeight = context.random.int(2, 8)
  if ((width * triHeight) % 2 !== 0) triHeight += 1
  const rectArea = width * rectHeight
  const triArea = (width * triHeight) / 2
  const answer = rectArea + triArea
  return buildMathSnapshot(context, {
    prompt: `一面墙由下面的长方形和上面的三角形组成：长方形宽 ${width} 米、高 ${rectHeight} 米，三角形底 ${width} 米、高 ${triHeight} 米。这面墙的面积是多少平方米？`,
    answer: { kind: 'word-problem', value: answer, unit: '平方米' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '平方米' }],
      unitRequired: true,
    },
    resources: [
      textResource(
        'composite-wall',
        `组合图形示意图：下方长方形宽 ${width} 米、高 ${rectHeight} 米，上方三角形底 ${width} 米、高 ${triHeight} 米。${DIAGRAM_NOTE}`,
      ),
    ],
    hints: {
      level1: '先把组合图形拆成学过的图形',
      level2: '分别求长方形和三角形的面积，再相加',
    },
    explanationSteps: [
      `长方形面积：${width} × ${rectHeight} = ${rectArea}（平方米）`,
      `三角形面积：${width} × ${triHeight} ÷ 2 = ${triArea}（平方米）`,
      `合计：${rectArea} + ${triArea} = ${answer}（平方米）`,
    ],
    errorCauseRules: [
      cause('composite-forgot-triangle', '漏算三角形部分', '组合图形要把每一部分的面积都算上', [
        { kind: 'word-problem', value: rectArea, unit: '平方米' },
      ]),
      cause('composite-forgot-half', '三角形忘记除以 2', '三角形面积是底乘高的一半', [
        { kind: 'word-problem', value: rectArea + width * triHeight, unit: '平方米' },
      ]),
    ],
  })
})

// 模块七：植树问题
function plantingSetup(context: MathGeneratorContext) {
  const spacing = context.random.pick([3, 4, 5] as const)
  const intervals = context.random.int(4, 12)
  return { spacing, intervals, length: spacing * intervals }
}

registerMathGenerator('g5a-planting-both-ends-word', (context) => {
  const { spacing, intervals, length } = plantingSetup(context)
  const answer = intervals + 1
  return buildMathSnapshot(context, {
    prompt: `在一条长 ${length} 米的小路一边植树，每隔 ${spacing} 米栽一棵（两端都栽），一共要栽多少棵？`,
    answer: { kind: 'word-problem', value: answer, unit: '棵' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '棵' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想一共有几个间隔，再想棵数和间隔数的关系',
      level2: '两端都栽时，棵数 = 间隔数 + 1',
    },
    explanationSteps: [
      `间隔数：${length} ÷ ${spacing} = ${intervals}`,
      `两端都栽：棵数 = ${intervals} + 1 = ${answer}（棵）`,
    ],
    errorCauseRules: [
      cause('planting-both-forgot-plus', '忘记加 1', '两端都栽时，棵数比间隔数多 1', [
        { kind: 'word-problem', value: intervals, unit: '棵' },
      ]),
    ],
  })
})

registerMathGenerator('g5a-planting-one-end-word', (context) => {
  const { spacing, intervals, length } = plantingSetup(context)
  const answer = intervals
  return buildMathSnapshot(context, {
    prompt: `在一条长 ${length} 米的小路一边植树，每隔 ${spacing} 米栽一棵（只栽一端），一共要栽多少棵？`,
    answer: { kind: 'word-problem', value: answer, unit: '棵' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '棵' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想一共有几个间隔，再想棵数和间隔数的关系',
      level2: '只栽一端时，棵数 = 间隔数',
    },
    explanationSteps: [
      `间隔数：${length} ÷ ${spacing} = ${intervals}`,
      `只栽一端：棵数 = 间隔数 = ${answer}（棵）`,
    ],
    errorCauseRules: [
      cause('planting-one-added', '多算了 1 棵', '只栽一端时棵数与间隔数相等，不用加 1', [
        { kind: 'word-problem', value: intervals + 1, unit: '棵' },
      ]),
    ],
  })
})

registerMathGenerator('g5a-planting-no-ends-word', (context) => {
  const { spacing, intervals, length } = plantingSetup(context)
  const answer = intervals - 1
  return buildMathSnapshot(context, {
    prompt: `在一条长 ${length} 米的小路一边植树，每隔 ${spacing} 米栽一棵（两端都不栽），一共要栽多少棵？`,
    answer: { kind: 'word-problem', value: answer, unit: '棵' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '棵' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想一共有几个间隔，再想棵数和间隔数的关系',
      level2: '两端都不栽时，棵数 = 间隔数 - 1',
    },
    explanationSteps: [
      `间隔数：${length} ÷ ${spacing} = ${intervals}`,
      `两端都不栽：棵数 = ${intervals} - 1 = ${answer}（棵）`,
    ],
    errorCauseRules: [
      cause('planting-no-ends-forgot-minus', '忘记减 1', '两端都不栽时，棵数比间隔数少 1', [
        { kind: 'word-problem', value: intervals, unit: '棵' },
      ]),
    ],
  })
})
