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

function distinctInts(context: MathGeneratorContext, count: number, min: number, max: number) {
  const values = new Set<number>()
  while (values.size < count) values.add(context.random.int(min, max))
  return [...values]
}

// 模块一：四则运算
registerMathGenerator('g4s-mixed-order', (context) => {
  const scale = context.difficulty === 'L1' ? 1 : context.difficulty === 'L2' ? 2 : 3
  const form = context.random.int(0, 2)
  let prompt: string
  let answer: number
  let wrong: number
  let steps: string[]
  if (form === 0) {
    const a = context.random.int(10, 30 * scale)
    const b = context.random.int(2, 9)
    const c = context.random.int(2, 9)
    prompt = `${a} + ${b} × ${c} = ?`
    answer = a + b * c
    wrong = (a + b) * c
    steps = [`先算乘法：${b} × ${c} = ${b * c}`, `再算加法：${a} + ${b * c} = ${answer}`]
  } else if (form === 1) {
    const b = context.random.int(2, 9)
    const c = context.random.int(2, 9)
    const a = b * c + context.random.int(5, 30 * scale)
    prompt = `${a} - ${b} × ${c} = ?`
    answer = a - b * c
    wrong = (a - b) * c
    steps = [`先算乘法：${b} × ${c} = ${b * c}`, `再算减法：${a} - ${b * c} = ${answer}`]
  } else {
    const divisor = context.random.int(2, 9)
    const quotient = context.random.int(2, 9)
    const dividend = divisor * quotient
    const a = quotient + context.random.int(10, 30 * scale)
    prompt = `${a} - ${dividend} ÷ ${divisor} = ?`
    answer = a - quotient
    wrong = a - dividend
    steps = [
      `先算除法：${dividend} ÷ ${divisor} = ${quotient}`,
      `再算减法：${a} - ${quotient} = ${answer}`,
    ]
  }
  const causes: ErrorCauseRule[] = []
  if (wrong >= 0 && wrong !== answer) {
    causes.push(
      cause('order-left-to-right', '一律从左往右算', '有乘除又有加减时，要先算乘除', [
        { kind: 'number', value: wrong },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先想清楚哪一步要先算，再按顺序计算',
      level2: '乘除在前、加减在后，同级运算从左往右',
    },
    explanationSteps: steps,
    errorCauseRules: causes,
  })
})

registerMathGenerator('g4s-parentheses', (context) => {
  const scale = context.difficulty === 'L1' ? 1 : context.difficulty === 'L2' ? 2 : 3
  const form = context.random.int(0, 2)
  const a = context.random.int(5, 20 * scale)
  const b = context.random.int(2, 9)
  const c = context.random.int(2, 9)
  let prompt: string
  let answer: number
  let wrong: number
  if (form === 0) {
    prompt = `(${a} + ${b}) × ${c} = ?`
    answer = (a + b) * c
    wrong = a + b * c
  } else if (form === 1) {
    const big = a + b
    prompt = `(${big} - ${b}) × ${c} = ?`
    answer = a * c
    wrong = big - b * c
  } else {
    prompt = `${a} × (${b} + ${c}) = ?`
    answer = a * (b + c)
    wrong = a * b + c
  }
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先找小括号，想清楚括号里要先算什么',
      level2: '有小括号时，先算括号里面的，再算括号外面的',
    },
    explanationSteps: ['先算小括号里面的部分', `再算括号外面的部分，得到 ${answer}`],
    errorCauseRules:
      wrong >= 0 && wrong !== answer
        ? [
            cause('parentheses-ignored', '忽略小括号', '小括号会改变运算顺序，必须先算括号里面', [
              { kind: 'number', value: wrong },
            ]),
          ]
        : [],
  })
})

registerMathGenerator('g4s-operations-word', (context) => {
  const count = context.random.int(3, 9)
  const price = context.random.int(4, 15)
  const paid = count * price + context.random.int(5, 30)
  const answer = paid - count * price
  const causes: ErrorCauseRule[] = []
  if (count * price !== answer) {
    causes.push(
      cause(
        'operations-word-forgot-subtract',
        '只算总价没算找回',
        '题目问的是找回多少元，要用付出的钱减总价',
        [{ kind: 'word-problem', value: count * price, unit: '元' }],
      ),
    )
  }
  // 错因值必须互不相同，否则 judgeAnswer 会归因到先匹配的规则
  if (paid - price !== count * price) {
    causes.push(
      cause('operations-word-one-item', '只减了一本的钱', '要减去全部笔记本的总价', [
        { kind: 'word-problem', value: paid - price, unit: '元' },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `学校买 ${count} 本笔记本，每本 ${price} 元，付 ${paid} 元，应找回多少元？`,
    answer: { kind: 'word-problem', value: answer, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '元' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想一共花了多少元，再想找回多少元',
      level2: '先算单价乘数量得到总价，再用付出的钱减去总价',
    },
    explanationSteps: [
      `总价：${count} × ${price} = ${count * price}（元）`,
      `找回：${paid} - ${count * price} = ${answer}（元）`,
    ],
    errorCauseRules: causes,
  })
})

// 模块二：运算定律
registerMathGenerator('g4s-addition-law-choice', (context) => {
  const a = context.random.int(10, 60)
  const b = context.random.int(10, 60)
  const c = context.random.int(10, 60)
  const associative = context.random.next() < 0.5
  const correct = associative ? '加法结合律' : '加法交换律'
  const options = choiceOptions(context, [
    correct,
    associative ? '加法交换律' : '加法结合律',
    '乘法分配律',
    '乘法结合律',
  ])
  return buildMathSnapshot(context, {
    prompt: associative
      ? `${a} + ${b} + ${c} = ${a} + (${b} + ${c}) 运用了什么运算定律？`
      : `${a} + ${b} = ${b} + ${a} 运用了什么运算定律？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先观察算式两边什么变了、什么没变',
      level2: '交换加数位置是交换律，改变相加顺序是结合律',
    },
    explanationSteps: [
      associative
        ? '三个数相加，先把后两个数相加，和不变，这是加法结合律'
        : '两个数相加，交换加数的位置，和不变，这是加法交换律',
    ],
    errorCauseRules: [
      cause('addition-law-confused', '加法定律混淆', '先分清是交换位置还是改变相加顺序', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g4s-multiplication-law-choice', (context) => {
  const a = context.random.int(2, 20)
  const b = context.random.int(2, 20)
  const c = context.random.int(2, 9)
  const form = context.random.int(0, 2)
  const correct = ['乘法交换律', '乘法结合律', '乘法分配律'][form]
  const distractor = ['乘法结合律', '乘法分配律', '乘法交换律'][form]
  const options = choiceOptions(context, [correct, distractor, '加法结合律', '加法交换律'])
  const prompt =
    form === 0
      ? `${a} × ${b} = ${b} × ${a} 运用了什么运算定律？`
      : form === 1
        ? `(${a} × ${b}) × ${c} = ${a} × (${b} × ${c}) 运用了什么运算定律？`
        : `(${a} + ${b}) × ${c} = ${a} × ${c} + ${b} × ${c} 运用了什么运算定律？`
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先观察算式两边的运算和位置发生了什么变化',
      level2: '交换位置是交换律，改变相乘顺序是结合律，拆开相加再乘是分配律',
    },
    explanationSteps: [`算式的变化符合${correct}的特征`],
    errorCauseRules: [
      cause(
        'multiplication-law-confused',
        '乘法定律混淆',
        '先分清交换位置、改变顺序与展开相乘的区别',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

registerMathGenerator('g4s-simplify-calc', (context) => {
  const [base, partner] = context.random.pick([
    [25, 4],
    [125, 8],
  ] as const)
  const a = context.random.int(2, 40)
  const answer = base * partner * a
  return buildMathSnapshot(context, {
    prompt: `${base} × ${a} × ${partner} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先观察哪两个数相乘能凑成整百、整千数',
      level2: '运用乘法交换律和结合律，先把能凑整的两个数相乘',
    },
    explanationSteps: [
      `先算 ${base} × ${partner} = ${base * partner}`,
      `再算 ${base * partner} × ${a} = ${answer}`,
    ],
    errorCauseRules: [
      cause('simplify-forgot-factor', '漏乘一个数', '简便计算后每个乘数都要参与相乘', [
        { kind: 'number', value: base * a },
      ]),
    ],
  })
})

registerMathGenerator('g4s-law-application-blank', (context) => {
  const a = context.random.int(2, 20)
  const b = context.random.int(2, 9)
  let c = context.random.int(2, 9)
  if (c === b) c = b + 1
  return buildMathSnapshot(context, {
    prompt: `${a} × ${b} + ${a} × ${c} = ${a} ×（____ + ____）`,
    answer: { kind: 'fill-blanks', values: [String(b), String(c)] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [[String(b)], [String(c)]],
      trimWhitespace: true,
    },
    hints: {
      level1: '观察两个乘法算式有没有相同的乘数',
      level2: '乘法分配律反过来用：相同的乘数提出来，剩下两个数相加',
    },
    explanationSteps: [
      `两个乘法算式都有乘数 ${a}`,
      `按乘法分配律：${a} × ${b} + ${a} × ${c} = ${a} × (${b} + ${c})`,
    ],
    errorCauseRules: [
      cause('distributive-blank-swapped', '两空顺序颠倒', '按算式中出现的顺序填写', [
        { kind: 'fill-blanks', values: [String(c), String(b)] },
      ]),
      cause('distributive-blank-added', '把两个数相加填进两空', '括号里是两个加数，不是它们的和', [
        { kind: 'fill-blanks', values: [String(b + c), String(b + c)] },
      ]),
    ],
  })
})

// 模块三：小数的意义和性质
registerMathGenerator('g4s-decimal-digit-choice', (context) => {
  const integer = context.random.int(1, 9)
  const tenths = context.random.int(1, 9)
  const askHundredths = context.random.next() < 0.5
  const hundredths = askHundredths ? context.random.int(1, 9) : context.random.int(0, 9)
  const scaled = integer * 100 + tenths * 10 + hundredths
  const digit = askHundredths ? hundredths : tenths
  const placeName = askHundredths ? '百分' : '十分'
  const unit = askHundredths ? '0.01' : '0.1'
  const options = choiceOptions(context, [unit, askHundredths ? '0.1' : '0.01', '1', '10'])
  return buildMathSnapshot(context, {
    prompt: `在 ${decimalText(scaled, 2)} 中，${placeName}位上的“${digit}”表示 ${digit} 个多少？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想清楚每个数位的计数单位',
      level2: '小数点右边第一位是十分位，第二位是百分位',
    },
    explanationSteps: [
      `${placeName}位的计数单位是 ${unit}`,
      `所以该位上的 ${digit} 表示 ${digit} 个 ${unit}`,
    ],
    errorCauseRules: [
      cause(
        'decimal-digit-unit-confused',
        '数位计数单位混淆',
        '先分清十分位与百分位对应的计数单位',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

registerMathGenerator('g4s-decimal-compare-choice', (context) => {
  const integer = context.random.int(1, 9)
  const tenths = context.random.int(1, 9)
  const scaled = integer * 10 + tenths
  const original = decimalText(scaled, 1)
  const options = choiceOptions(context, [
    decimalText(scaled * 10, 2),
    decimalText(scaled, 0),
    decimalText(scaled + 10, 1),
    decimalText(scaled, 2),
  ])
  return buildMathSnapshot(context, {
    prompt: `下面哪个数与 ${original} 相等？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想小数末尾添上 0 或去掉 0，大小会不会变',
      level2: '小数的末尾添上 0 或去掉 0，小数的大小不变',
    },
    explanationSteps: [
      `${original} 的末尾添上一个 0 得到 ${decimalText(scaled * 10, 2)}，大小不变`,
    ],
    errorCauseRules: [
      cause(
        'decimal-property-misused',
        '小数性质误用',
        '只有末尾的 0 可以去掉，小数点位置不能移动',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

registerMathGenerator('g4s-decimal-point-move', (context) => {
  const integer = context.random.int(1, 9)
  const tenths = context.random.int(1, 9)
  const scaled = integer * 10 + tenths
  const original = decimalText(scaled, 1)
  const form = context.random.int(0, 2)
  const prompt =
    form === 0
      ? `${original} × 10 = ?`
      : form === 1
        ? `${original} × 100 = ?`
        : `${original} ÷ 10 = ?`
  const answer = form === 0 ? scaled : form === 1 ? scaled * 10 : decimalValue(scaled, 2)
  const wrong = form === 0 ? decimalValue(scaled, 2) : form === 1 ? scaled : scaled
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, form === 2),
    hints: {
      level1: '先数清小数点移动了几位、朝哪个方向移动',
      level2: '乘 10、100 小数点向右移，除以 10 小数点向左移',
    },
    explanationSteps: [
      '小数点按题目要求移动相应位数',
      `移动后得到 ${form === 2 ? decimalText(scaled, 2) : String(answer)}`,
    ],
    errorCauseRules: [
      cause('point-move-direction', '移动方向或位数错误', '先确认是扩大还是缩小，再数移动的位数', [
        { kind: 'number', value: wrong },
      ]),
    ],
  })
})

registerMathGenerator('g4s-unit-conversion-blank', (context) => {
  const meters = context.random.int(1, 9)
  const centimeters = context.random.int(1, 9)
  const answer = decimalText(meters * 100 + centimeters, 2)
  return buildMathSnapshot(context, {
    prompt: `${meters} 米 ${centimeters} 厘米 =（____）米`,
    answer: { kind: 'fill-blanks', values: [answer] },
    acceptedAnswerRule: { kind: 'fill-blanks', values: [[answer]], trimWhitespace: true },
    hints: {
      level1: '先想米和厘米之间的进率，再确定小数部分怎么写',
      level2: '1 米 = 100 厘米，几厘米就是百分之几米',
    },
    explanationSteps: [
      `${centimeters} 厘米 = ${decimalText(centimeters, 2)} 米`,
      `${meters} 米 ${centimeters} 厘米 = ${answer} 米`,
    ],
    errorCauseRules: [
      cause('unit-conversion-place', '厘米写错数位', '厘米要写到百分位，不是十分位', [
        { kind: 'fill-blanks', values: [`${meters}.${centimeters}`] },
      ]),
    ],
  })
})

registerMathGenerator('g4s-decimal-round', (context) => {
  const integer = context.random.int(1, 9)
  const tenths = context.random.int(0, 9)
  const hundredths = context.random.int(1, 9)
  const scaled = integer * 100 + tenths * 10 + hundredths
  const rounded = Math.round(scaled / 10)
  const answer = decimalValue(rounded, 1)
  const causes: ErrorCauseRule[] = []
  // 错因值必须互不相同（如 3.04 截尾与保留整数都得 3），否则归因会错位
  const usedValues = new Set<number>([answer])
  const truncated = decimalValue(Math.floor(scaled / 10), 1)
  if (!usedValues.has(truncated)) {
    causes.push(
      cause('round-truncated', '直接舍去尾数', '四舍五入要看省略部分最高位，满 5 要向前一位进 1', [
        { kind: 'number', value: truncated },
      ]),
    )
    usedValues.add(truncated)
  }
  const toInteger = Math.round(scaled / 100)
  if (!usedValues.has(toInteger)) {
    causes.push(
      cause('round-wrong-place', '保留位数错误', '题目要求保留一位小数，不是保留整数', [
        { kind: 'number', value: toInteger },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `把 ${decimalText(scaled, 2)} 四舍五入保留一位小数，结果是多少？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先看要保留到哪一位，再看它后面一位上的数',
      level2: '保留一位小数时，看百分位上的数决定舍还是入',
    },
    explanationSteps: [
      `百分位上是 ${hundredths}，${hundredths >= 5 ? '满 5 向前一位进 1' : '不满 5 舍去'}`,
      `保留一位小数约是 ${answer}`,
    ],
    errorCauseRules: causes,
  })
})

// 模块四：小数加法和减法
registerMathGenerator('g4s-decimal-add', (context) => {
  const scale = context.difficulty === 'L1' ? 1 : context.difficulty === 'L2' ? 2 : 3
  const a = context.random.int(1, 10 * scale) * 10 + context.random.int(1, 9)
  const b = context.random.int(1, 10 * scale) * 10 + context.random.int(1, 9)
  const answer = decimalValue(a + b, 1)
  return buildMathSnapshot(context, {
    prompt: `${decimalText(a, 1)} + ${decimalText(b, 1)} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先把小数点对齐，也就是相同数位对齐',
      level2: '小数点对齐后，按整数加法计算，再点上小数点',
    },
    explanationSteps: [
      `十分位：${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}`,
      `整数部分与十分位合起来得到 ${answer}`,
    ],
    errorCauseRules: [
      cause('decimal-add-misaligned', '末位对齐导致数位错', '小数加法要小数点对齐，不是末位对齐', [
        { kind: 'number', value: decimalValue(a + b, 2) },
      ]),
    ],
  })
})

registerMathGenerator('g4s-decimal-simplify', (context) => {
  const fraction = context.random.int(1, 9)
  const x = context.random.int(1, 9)
  const y = context.random.int(1, 9)
  const b = context.random.int(2, 20)
  const a = x * 10 + fraction
  const c = y * 10 + (10 - fraction)
  const answer = x + y + b + 1
  return buildMathSnapshot(context, {
    prompt: `${decimalText(a, 1)} + ${b} + ${decimalText(c, 1)} = ?`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先观察哪两个小数能凑成整数',
      level2: '运用加法交换律和结合律，先把能凑整的小数相加',
    },
    explanationSteps: [
      `${decimalText(a, 1)} + ${decimalText(c, 1)} = ${x + y + 1}`,
      `${x + y + 1} + ${b} = ${answer}`,
    ],
    errorCauseRules: [
      cause('decimal-simplify-forgot-term', '漏加一个数', '凑整后原来的每个加数都要计入', [
        { kind: 'number', value: decimalValue(a + b * 10, 1) },
      ]),
    ],
  })
})

registerMathGenerator('g4s-decimal-shopping-word', (context) => {
  const a = context.random.int(1, 30) * 10 + context.random.int(1, 9)
  const b = context.random.int(1, 30) * 10 + context.random.int(1, 9)
  const total = a + b
  const paid = Math.ceil(total / 10) + context.random.int(1, 5)
  const answer = decimalValue(paid * 10 - total, 1)
  const causes: ErrorCauseRule[] = []
  if (decimalValue(total, 1) !== answer) {
    causes.push(
      cause('decimal-shopping-total-only', '只算总价没算找回', '题目问的是找回多少元', [
        { kind: 'word-problem', value: decimalValue(total, 1), unit: '元' },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `一个文具盒 ${decimalText(a, 1)} 元，一本笔记本 ${decimalText(b, 1)} 元。付 ${paid} 元，应找回多少元？`,
    answer: { kind: 'word-problem', value: answer, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '元' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想清楚付出的钱、花掉的钱和找回的钱之间的关系',
      level2: '先把两样物品的价钱相加，再用付出的钱减去总价',
    },
    explanationSteps: [
      `总价：${decimalText(a, 1)} + ${decimalText(b, 1)} = ${decimalText(total, 1)}（元）`,
      `找回：${paid} - ${decimalText(total, 1)} = ${answer}（元）`,
    ],
    errorCauseRules: causes,
  })
})

// 模块五：三角形
registerMathGenerator('g4s-triangle-stability-choice', (context) => {
  const object = context.random.pick([
    '自行车车架',
    '篮球架的支架',
    '电线杆的支架',
    '屋顶的桁架',
  ] as const)
  const options = choiceOptions(context, ['稳定性', '容易变形', '美观大方', '节省材料'])
  return buildMathSnapshot(context, {
    prompt: `${object}做成三角形，主要是运用了三角形的什么特性？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想三角形和其他图形在受力时有什么不同',
      level2: '三角形三条边确定后，形状就不会改变',
    },
    explanationSteps: ['三角形具有稳定性，受力后不易变形，所以常用在支架结构中'],
    errorCauseRules: [
      cause(
        'triangle-stability-confused',
        '与四边形特性混淆',
        '容易变形是四边形的特点，不是三角形',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

registerMathGenerator('g4s-triangle-sides-choice', (context) => {
  const a = context.random.int(2, 8)
  const b = context.random.int(a, a + 6)
  const c = context.random.int(b, a + b - 1)
  const extra = context.random.int(1, 3)
  const format = (x: number, y: number, z: number) => `${x} 厘米、${y} 厘米、${z} 厘米`
  const sets = [
    format(a, b, c),
    format(a, b, a + b),
    format(a, b, a + b + extra),
    format(a, b + 1, a + b + 2),
  ]
  const options = choiceOptions(context, sets)
  const displaySets = shuffleOptions(
    context.random,
    sets.map((text, index) => ({ id: `set-${index}`, text })),
  ).map((item) => item.text)
  return buildMathSnapshot(context, {
    prompt: `有四组小棒：${displaySets.join('；')}。哪一组能围成三角形？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想任意两边之和与第三边的关系',
      level2: '三角形任意两边之和大于第三边，等于或小于都围不成',
    },
    explanationSteps: [
      `${a} + ${b} = ${a + b} > ${c}，满足任意两边之和大于第三边`,
      '其余各组都有两边之和等于或小于第三边，围不成三角形',
    ],
    errorCauseRules: [
      cause(
        'triangle-sides-degenerate',
        '把两边之和等于第三边当成可以',
        '两边之和等于第三边时只能拼成一条线段',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

registerMathGenerator('g4s-triangle-angle-sum-blank', (context) => {
  const sum = context.random.int(60, 150)
  const answer = 180 - sum
  const causes = [
    cause(
      'angle-sum-filled-total',
      '直接填内角和',
      '题目求的是第三个角，要用内角和减去已知两角之和',
      [{ kind: 'fill-blanks', values: ['180'] }],
    ),
  ]
  if (sum !== answer) {
    causes.push(
      cause('angle-sum-copied-known', '把已知两角之和当成第三角', '第三角 = 180° - 已知两角之和', [
        { kind: 'fill-blanks', values: [String(sum)] },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `三角形内角和是 180°。已知 ∠1 + ∠2 = ${sum}°，∠3 =（____）°`,
    answer: { kind: 'fill-blanks', values: [String(answer)] },
    acceptedAnswerRule: { kind: 'fill-blanks', values: [[String(answer)]], trimWhitespace: true },
    hints: {
      level1: '先想三个内角合起来是多少度',
      level2: '用三角形内角和减去已知两个角的和',
    },
    explanationSteps: [`∠3 = 180° - ${sum}° = ${answer}°`],
    errorCauseRules: causes,
  })
})

registerMathGenerator('g4s-triangle-angle-calc', (context) => {
  const a = context.random.int(20, 80)
  const b = context.random.int(20, 150 - a)
  const answer = 180 - a - b
  const causes = [
    cause('angle-calc-forgot-one', '只减去一个已知角', '要减去两个已知角的度数', [
      { kind: 'number', value: 180 - a },
    ]),
  ]
  // 2a + b = 180 时两条错因值相同，只保留第一条
  if (a + b !== answer && a + b !== 180 - a) {
    causes.push(
      cause('angle-calc-added-known', '把已知两角相加', '求第三角要用 180° 减去两角之和', [
        { kind: 'number', value: a + b },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `一个三角形中，∠1 = ${a}°，∠2 = ${b}°，∠3 是多少度？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    resources: [
      textResource(
        'triangle-angles',
        `三角形示意图：三个内角分别标注 ∠1 = ${a}°、∠2 = ${b}°、∠3 未知。${DIAGRAM_NOTE}`,
      ),
    ],
    hints: {
      level1: '先想三角形三个内角之间的关系',
      level2: '三角形内角和是 180°，用 180° 连续减去两个已知角',
    },
    explanationSteps: [`∠3 = 180° - ${a}° - ${b}° = ${answer}°`],
    errorCauseRules: causes,
  })
})

registerMathGenerator('g4s-triangle-classify-choice', (context) => {
  const mode = context.random.int(0, 2)
  let angles: [number, number, number]
  if (mode === 0) {
    const a = context.random.int(50, 80)
    const b = context.random.int(50, 80)
    angles = [a, b, 180 - a - b]
  } else if (mode === 1) {
    const a = context.random.int(20, 70)
    angles = [a, 90, 90 - a]
  } else {
    const obtuse = context.random.int(100, 150)
    const a = context.random.int(10, 170 - obtuse)
    angles = [obtuse, a, 180 - obtuse - a]
  }
  const correct = ['锐角三角形', '直角三角形', '钝角三角形'][mode]
  const distractor = ['直角三角形', '钝角三角形', '锐角三角形'][mode]
  const remaining = ['锐角三角形', '直角三角形', '钝角三角形'].find(
    (item) => item !== correct && item !== distractor,
  ) as string
  const options = choiceOptions(context, [correct, distractor, remaining, '无法确定'])
  const shuffledAngles = shuffleOptions(
    context.random,
    angles.map((value, index) => ({ id: `angle-${index}`, text: String(value) })),
  ).map((item) => Number(item.text))
  const [x, y, z] = shuffledAngles
  return buildMathSnapshot(context, {
    prompt: `一个三角形三个内角分别是 ${x}°、${y}°、${z}°，按角分类它是什么三角形？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先看三个角中最大的角是什么角',
      level2: '最大角是锐角、直角还是钝角，决定三角形的类别',
    },
    explanationSteps: [`三个角中最大的角决定按角分类的结果`, `该三角形是${correct}`],
    errorCauseRules: [
      cause('triangle-classify-confused', '按角分类判断错误', '先找最大角，再按最大角的类型分类', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

// 模块六：观察物体与图形运动
registerMathGenerator('g4s-observe-choice', (context) => {
  const [object, shape] = context.random.pick([
    ['圆柱', '长方形'],
    ['球', '圆'],
    ['正方体', '正方形'],
    ['圆锥', '三角形'],
  ] as const)
  const shapes = ['长方形', '圆', '正方形', '三角形']
  const options = choiceOptions(context, [shape, ...shapes.filter((item) => item !== shape)])
  return buildMathSnapshot(context, {
    prompt: `从正面观察${object}，看到的形状是什么？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    resources: [
      textResource('observe-object', `${object}的立体示意图，从正面平视观察。${DIAGRAM_NOTE}`),
    ],
    hints: {
      level1: '先想物体正对着我们的面是什么形状',
      level2: '从正面看，只能看到正对方向投影出的平面形状',
    },
    explanationSteps: [`从正面观察${object}，看到的形状是${shape}`],
    errorCauseRules: [
      cause('observe-direction-confused', '观察方向混淆', '从正面看与从上面看可能得到不同形状', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g4s-symmetry-choice', (context) => {
  const correct = context.random.pick(['长方形', '圆', '等腰三角形', '正方形'] as const)
  const distractors = shuffleOptions(
    context.random,
    ['平行四边形', '一般三角形', '直角梯形', '任意四边形'].map((text, index) => ({
      id: `d-${index}`,
      text,
    })),
  )
    .slice(0, 3)
    .map((item) => item.text)
  const texts = [correct, ...distractors]
  const options = choiceOptions(context, texts)
  const displayTexts = shuffleOptions(
    context.random,
    texts.map((text, index) => ({ id: `figure-${index}`, text })),
  ).map((item) => item.text)
  return buildMathSnapshot(context, {
    prompt: `在${displayTexts.join('、')}这四个图形中，哪一个是轴对称图形？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想哪个图形能沿一条直线对折后完全重合',
      level2: '轴对称图形沿对称轴对折，两侧能够完全重合',
    },
    explanationSteps: [`${correct}能找到一条直线，使图形对折后两侧完全重合，是轴对称图形`],
    errorCauseRules: [
      cause('symmetry-confused', '轴对称判断错误', '一般平行四边形对折后不能完全重合', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g4s-translation-choice', (context) => {
  const correct = context.random.pick(['电梯上下运动', '拉开抽屉', '升国旗', '推拉窗移动'] as const)
  const distractors = shuffleOptions(
    context.random,
    ['风扇叶片转动', '钟表指针走动', '摩天轮转动', '拧瓶盖'].map((text, index) => ({
      id: `d-${index}`,
      text,
    })),
  )
    .slice(0, 3)
    .map((item) => item.text)
  const texts = [correct, ...distractors]
  const options = choiceOptions(context, texts)
  const displayTexts = shuffleOptions(
    context.random,
    texts.map((text, index) => ({ id: `motion-${index}`, text })),
  ).map((item) => item.text)
  return buildMathSnapshot(context, {
    prompt: `在${displayTexts.join('、')}这四种运动中，哪一种属于平移？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想物体是沿直线移动，还是绕一个点转动',
      level2: '平移时物体沿直线移动，方向和形状都不变',
    },
    explanationSteps: [`${correct}是沿直线移动，属于平移；其余都是绕点或轴转动`],
    errorCauseRules: [
      cause(
        'translation-rotation-confused',
        '平移与旋转混淆',
        '绕着一个点或轴转动的是旋转，不是平移',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

// 模块七：平均数与条形统计图
registerMathGenerator('g4s-average-calc', (context) => {
  const count = context.random.pick([3, 4] as const)
  const mean = context.random.int(6, 30)
  const d = context.random.int(1, 5)
  const e = context.random.int(1, 5)
  const deviations = count === 3 ? [d, -d, 0] : [d, -d, e, -e]
  const values = shuffleOptions(
    context.random,
    deviations.map((value, index) => ({ id: `v-${index}`, text: String(mean + value) })),
  ).map((item) => Number(item.text))
  const answer = mean
  return buildMathSnapshot(context, {
    prompt: `${values.join('、')} 的平均数是多少？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先想平均数表示什么，再想怎样求',
      level2: '平均数 = 总数量 ÷ 总份数',
    },
    explanationSteps: [
      `总和：${values.join(' + ')} = ${mean * count}`,
      `平均数：${mean * count} ÷ ${count} = ${answer}`,
    ],
    errorCauseRules: [
      cause('average-forgot-divide', '只算总和没除以份数', '求平均数要把总和平均分成相应份数', [
        { kind: 'number', value: mean * count },
      ]),
      cause('average-used-max', '把最大值当平均数', '平均数反映整体水平，不是最大的那个数', [
        { kind: 'number', value: Math.max(...values) },
      ]),
    ],
  })
})

function barChartData(context: MathGeneratorContext) {
  const values = distinctInts(context, 4, 5, 40)
  const days = ['星期一', '星期二', '星期三', '星期四']
  const resource = textResource(
    'bar-chart',
    `条形统计图（示意）：星期一 ${values[0]} 本、星期二 ${values[1]} 本、星期三 ${values[2]} 本、星期四 ${values[3]} 本。${DIAGRAM_NOTE}`,
  )
  return { values, days, resource }
}

registerMathGenerator('g4s-bar-chart-read', (context) => {
  const { values, days, resource } = barChartData(context)
  const askMax = context.random.next() < 0.5
  const target = askMax ? Math.max(...values) : Math.min(...values)
  const correctDay = days[values.indexOf(target)]
  const options = choiceOptions(context, [correctDay, ...days.filter((day) => day !== correctDay)])
  return buildMathSnapshot(context, {
    prompt: `根据条形统计图，哪天卖出的图书最${askMax ? '多' : '少'}？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    resources: [resource],
    hints: {
      level1: '先看清每个直条对应的数量再比较',
      level2: '直条越长表示数量越多，逐一对应图例读数',
    },
    explanationSteps: [`${correctDay}对应的直条最${askMax ? '长' : '短'}，数量是 ${target} 本`],
    errorCauseRules: [
      cause('bar-chart-read-misread', '读错直条对应数量', '先对齐图例与直条，再比较长短', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g4s-bar-chart-compare-word', (context) => {
  const { values, resource } = barChartData(context)
  const total = values.reduce((sum, value) => sum + value, 0)
  const askTotal = context.random.next() < 0.5
  const max = Math.max(...values)
  const min = Math.min(...values)
  const answer = askTotal ? total : max - min
  return buildMathSnapshot(context, {
    prompt: askTotal
      ? '根据条形统计图，四天一共卖出多少本图书？'
      : '根据条形统计图，卖得最多的一天比最少的一天多多少本？',
    answer: { kind: 'word-problem', value: answer, unit: '本' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '本' }],
      unitRequired: true,
    },
    resources: [resource],
    hints: {
      level1: '先从统计图中读出需要的数据再计算',
      level2: askTotal ? '把四天的数量合起来用加法' : '先找最多和最少的数量，再相减',
    },
    explanationSteps: askTotal
      ? [`${values.join(' + ')} = ${total}（本）`]
      : [`${max} - ${min} = ${answer}（本）`],
    errorCauseRules: [
      cause(
        'bar-chart-compare-partial',
        askTotal ? '只读了最大的直条' : '只用最大值没相减',
        askTotal ? '要把四天的数量都加起来' : '求相差多少要用减法',
        [{ kind: 'word-problem', value: max, unit: '本' }],
      ),
    ],
  })
})

// 模块八：综合应用
registerMathGenerator('g4s-rental-word', (context) => {
  const cap = context.random.pick([4, 6, 8] as const)
  let people = context.random.int(20, 50)
  if (people % cap === 0) people += 1
  const answer = Math.ceil(people / cap)
  return buildMathSnapshot(context, {
    prompt: `${people} 名同学去划船，每条船限乘 ${cap} 人，至少需要多少条船？`,
    answer: { kind: 'word-problem', value: answer, unit: '条' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '条' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想剩下的人还需要不需要一条船',
      level2: '有余数时，剩下的人也要再租一条船，用进一法',
    },
    explanationSteps: [
      `${people} ÷ ${cap} = ${Math.floor(people / cap)}（条）……${people % cap}（人）`,
      `剩下 ${people % cap} 人也要一条船，共 ${answer} 条`,
    ],
    errorCauseRules: [
      cause('rental-forgot-remainder', '余下的人没算船', '剩下的人也需要一条船，不能直接舍去余数', [
        { kind: 'word-problem', value: Math.floor(people / cap), unit: '条' },
      ]),
    ],
  })
})

registerMathGenerator('g4s-travel-word', (context) => {
  const speed = context.random.int(40, 90)
  const hours = context.random.int(2, 5)
  const rest = context.random.int(10, 80)
  const answer = speed * hours + rest
  return buildMathSnapshot(context, {
    prompt: `汽车每小时行 ${speed} 千米，行了 ${hours} 小时，离目的地还有 ${rest} 千米。全程是多少千米？`,
    answer: { kind: 'word-problem', value: answer, unit: '千米' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '千米' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想全程由哪几部分组成',
      level2: '全程 = 已行的路程 + 剩下的路程，已行路程用速度乘时间',
    },
    explanationSteps: [
      `已行：${speed} × ${hours} = ${speed * hours}（千米）`,
      `全程：${speed * hours} + ${rest} = ${answer}（千米）`,
    ],
    errorCauseRules: [
      cause('travel-forgot-rest', '漏加剩下的路程', '全程还要加上离目的地剩下的路程', [
        { kind: 'word-problem', value: speed * hours, unit: '千米' },
      ]),
    ],
  })
})

registerMathGenerator('g4s-chicken-rabbit', (context) => {
  const chickens = context.random.int(3, 12)
  let rabbits = context.random.int(2, 8)
  if (rabbits === chickens) rabbits += 1
  const heads = chickens + rabbits
  const feet = 2 * chickens + 4 * rabbits
  const causes = [
    cause(
      'chicken-rabbit-solved-rabbit',
      '求成了兔的只数',
      '题目问的是鸡有多少只，注意假设后求出的是哪种动物',
      [{ kind: 'word-problem', value: rabbits, unit: '只' }],
    ),
  ]
  const extraFeet = feet - 2 * heads
  if (extraFeet !== chickens) {
    causes.push(
      cause(
        'chicken-rabbit-forgot-divide',
        '脚数差忘记除以 2',
        '每把一只鸡换成兔会增加 2 只脚，脚数差要除以 2',
        [{ kind: 'word-problem', value: extraFeet, unit: '只' }],
      ),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `笼子里有鸡和兔共 ${heads} 只，脚共 ${feet} 只。鸡有多少只？`,
    answer: { kind: 'word-problem', value: chickens, unit: '只' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: chickens, unit: '只' }],
      unitRequired: true,
    },
    hints: {
      level1: '先假设笼子里全是同一种动物，再比较脚数差',
      level2: '假设全是鸡，算出脚数差，每只差 2 只脚对应一只兔',
    },
    explanationSteps: [
      `假设全是鸡：${heads} × 2 = ${2 * heads}（只脚）`,
      `脚数差：${feet} - ${2 * heads} = ${extraFeet}，兔有 ${extraFeet} ÷ 2 = ${rabbits}（只）`,
      `鸡有 ${heads} - ${rabbits} = ${chickens}（只）`,
    ],
    errorCauseRules: causes,
  })
})
