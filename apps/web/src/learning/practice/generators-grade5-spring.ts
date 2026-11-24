import type { AcceptedAnswerRule, ErrorCauseRule } from '../types'
import {
  buildMathSnapshot,
  cause,
  DIAGRAM_NOTE,
  decimalValue,
  gcd,
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

function reduceFraction(numerator: number, denominator: number): [number, number] {
  const divisor = gcd(numerator, denominator)
  return [numerator / divisor, denominator / divisor]
}

function fractionRule(numerator: number, denominator: number): AcceptedAnswerRule {
  return {
    kind: 'fraction',
    values: [{ numerator, denominator }],
    requireSimplest: true,
  }
}

function fractionsEquivalent(
  left: { numerator: number; denominator: number },
  right: { numerator: number; denominator: number },
): boolean {
  return left.numerator * right.denominator === right.numerator * left.denominator
}

function distinctNumbers(
  context: MathGeneratorContext,
  count: number,
  min: number,
  max: number,
  exclude: readonly number[] = [],
  predicate: (value: number) => boolean = () => true,
): number[] {
  const values = new Set<number>()
  while (values.size < count) {
    const value = context.random.int(min, max)
    if (!exclude.includes(value) && predicate(value)) values.add(value)
  }
  return [...values]
}

// 模块一：因数与倍数
registerMathGenerator('g5s-factors-multiples-choice', (context) => {
  const a = context.random.int(2, 9)
  const b = context.random.int(2, 9)
  const options = choiceOptions(context, ['因数', '倍数', '质数', '合数'])
  return buildMathSnapshot(context, {
    prompt: `因为 ${a} × ${b} = ${a * b}，所以 ${a} 是 ${a * b} 的（）。`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想乘法算式中各部分之间的整除关系',
      level2: '如果 a × b = c，那么 a 和 b 是 c 的因数，c 是 a 和 b 的倍数',
    },
    explanationSteps: [`${a} 能整除 ${a * b}，所以 ${a} 是 ${a * b} 的因数`],
    errorCauseRules: [
      cause(
        'factors-multiples-reversed',
        '因数倍数说反了',
        '较小的数是较大数的因数，较大数是较小数的倍数',
        [{ kind: 'single-choice', optionId: 'opt-b' }],
      ),
    ],
  })
})

registerMathGenerator('g5s-divisibility-choice', (context) => {
  const target = context.random.pick([2, 3, 5] as const)
  const correct = target * context.random.int(3, 15)
  const distractors = distinctNumbers(context, 3, 10, 99, [correct], (n) => n % target !== 0)
  const options = choiceOptions(context, [String(correct), ...distractors.map(String)])
  return buildMathSnapshot(context, {
    prompt: `下面哪个数是 ${target} 的倍数？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想这个数的倍数有什么特征',
      level2: '2 的倍数个位是偶数，5 的倍数个位是 0 或 5，3 的倍数各位数字之和是 3 的倍数',
    },
    explanationSteps: [`${correct} ÷ ${target} = ${correct / target}，能整除，是 ${target} 的倍数`],
    errorCauseRules: [
      cause('divisibility-misjudged', '倍数特征判断错误', '先按倍数特征逐一检验每个数', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-prime-composite-choice', (context) => {
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]
  const composites = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25]
  const correct = context.random.pick(primes)
  const distractors = shuffleOptions(
    context.random,
    composites.map((text, index) => ({ id: `c-${index}`, text: String(text) })),
  )
    .slice(0, 3)
    .map((item) => item.text)
  const options = choiceOptions(context, [String(correct), ...distractors])
  // 题面须随种子变化，否则 createRetestQuestion 无法生成不同题面的复测变式
  const prompt = context.random.pick([
    '下面哪个数是质数？',
    '下面四个数中，是质数的是哪一个？',
    '根据质数的意义判断，下面哪个数是质数？',
  ])
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想质数只有哪几个因数',
      level2: '质数只有 1 和它本身两个因数，合数除了 1 和本身还有别的因数',
    },
    explanationSteps: [`${correct} 只有 1 和 ${correct} 两个因数，是质数`],
    errorCauseRules: [
      cause('prime-composite-confused', '质数合数混淆', '先数一数每个数的因数个数', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-odd-even-choice', (context) => {
  const askOdd = context.random.next() < 0.5
  const parity = askOdd ? 1 : 0
  const correct = 2 * context.random.int(5, 49) + parity
  const distractors = distinctNumbers(context, 3, 10, 99, [correct], (n) => n % 2 !== parity)
  const options = choiceOptions(context, [String(correct), ...distractors.map(String)])
  return buildMathSnapshot(context, {
    prompt: `下面哪个数是${askOdd ? '奇' : '偶'}数？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先看每个数能不能被 2 整除',
      level2: '能被 2 整除的是偶数，不能被 2 整除的是奇数',
    },
    explanationSteps: [
      `${correct} ${askOdd ? '不能' : '能'}被 2 整除，是${askOdd ? '奇' : '偶'}数`,
    ],
    errorCauseRules: [
      cause('odd-even-confused', '奇数偶数混淆', '看个位是否是 0、2、4、6、8 来判断偶数', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

// 模块二：长方体和正方体
registerMathGenerator('g5s-cuboid-features-choice', (context) => {
  const shape = context.random.pick(['长方体', '正方体'] as const)
  const aspect = context.random.pick(['面', '棱', '顶点'] as const)
  const count = aspect === '面' ? 6 : aspect === '棱' ? 12 : 8
  const others = [6, 12, 8, 4].filter((value) => value !== count)
  const options = choiceOptions(context, [String(count), ...others.map(String)])
  return buildMathSnapshot(context, {
    prompt: `${shape}有（）个${aspect}。`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先在脑海中数一数长方体的面、棱和顶点',
      level2: '长方体和正方体都有 6 个面、12 条棱、8 个顶点',
    },
    explanationSteps: [`${shape}有 ${count} 个${aspect}`],
    errorCauseRules: [
      cause('cuboid-features-miscount', '面棱顶点数量记错', '面、棱、顶点的数量要分别记清', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-cuboid-nets-choice', (context) => {
  const mode = context.random.int(0, 1)
  const correct = mode === 0 ? 6 : 11
  const distractors = mode === 0 ? [4, 8, 12] : [10, 12, 8]
  const options = choiceOptions(context, [String(correct), ...distractors.map(String)])
  const prompt =
    mode === 0
      ? '正方体的表面展开图是由几个完全相同的正方形组成的？'
      : '正方体的表面展开图一共有多少种？'
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    resources: [
      textResource('cube-net', `正方体展开图示意：由 6 个完全相同的正方形拼成。${DIAGRAM_NOTE}`),
    ],
    hints: {
      level1: '先想正方体有几个面，展开后就是几个正方形',
      level2: '正方体有 6 个面，展开图由 6 个正方形组成，共有 11 种不同展开图',
    },
    explanationSteps: [
      mode === 0 ? '正方体有 6 个面，展开图由 6 个正方形组成' : '正方体的表面展开图共有 11 种',
    ],
    errorCauseRules: [
      cause('cuboid-nets-miscount', '展开图认识错误', '展开图的面数与立体图形的面数一致', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-surface-area-calc', (context) => {
  const scale = context.difficulty === 'L2' ? 1 : 2
  const cube = context.random.next() < 0.5
  let prompt: string
  let answer: number
  let wrong: number
  let resource: string
  if (cube) {
    const a = context.random.int(2, 6 * scale)
    prompt = `一个正方体的棱长是 ${a} 厘米，它的表面积是多少平方厘米？`
    answer = 6 * a * a
    wrong = a * a
    resource = `正方体示意图：棱长标注 ${a} 厘米。${DIAGRAM_NOTE}`
  } else {
    const l = context.random.int(2, 6 * scale)
    const w = context.random.int(2, 6 * scale)
    const h = context.random.int(2, 6 * scale)
    prompt = `一个长方体长 ${l} 厘米、宽 ${w} 厘米、高 ${h} 厘米，它的表面积是多少平方厘米？`
    answer = 2 * (l * w + w * h + l * h)
    wrong = l * w + w * h + l * h
    resource = `长方体示意图：长 ${l} 厘米、宽 ${w} 厘米、高 ${h} 厘米。${DIAGRAM_NOTE}`
  }
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    resources: [textResource('surface-area', resource)],
    hints: {
      level1: '先想表面积是哪些面的面积之和',
      level2: '表面积是 6 个面的面积总和，相对的面面积相等',
    },
    explanationSteps: [`把各个面的面积相加，得到表面积 ${answer} 平方厘米`],
    errorCauseRules: [
      cause('surface-area-partial', '只算了部分面', '表面积要算全部 6 个面，相对的面成对出现', [
        { kind: 'number', value: wrong },
      ]),
    ],
  })
})

registerMathGenerator('g5s-volume-calc', (context) => {
  const scale = context.difficulty === 'L1' ? 1 : context.difficulty === 'L2' ? 2 : 3
  const cube = context.random.next() < 0.5
  let prompt: string
  let answer: number
  let wrong: number
  let resource: string
  if (cube) {
    const a = context.random.int(2, 5 * scale)
    prompt = `一个正方体的棱长是 ${a} 厘米，它的体积是多少立方厘米？`
    answer = a * a * a
    wrong = a * a
    resource = `正方体示意图：棱长标注 ${a} 厘米。${DIAGRAM_NOTE}`
  } else {
    const l = context.random.int(2, 5 * scale)
    const w = context.random.int(2, 5 * scale)
    const h = context.random.int(2, 5 * scale)
    prompt = `一个长方体长 ${l} 厘米、宽 ${w} 厘米、高 ${h} 厘米，它的体积是多少立方厘米？`
    answer = l * w * h
    wrong = l * w
    resource = `长方体示意图：长 ${l} 厘米、宽 ${w} 厘米、高 ${h} 厘米。${DIAGRAM_NOTE}`
  }
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    resources: [textResource('volume', resource)],
    hints: {
      level1: '先想体积与长、宽、高的关系',
      level2: '长方体体积 = 长 × 宽 × 高，正方体体积 = 棱长 × 棱长 × 棱长',
    },
    explanationSteps: [`长、宽、高相乘，得到体积 ${answer} 立方厘米`],
    errorCauseRules: [
      cause('volume-forgot-dimension', '漏乘一个维度', '体积要把长、宽、高三个维度都乘上', [
        { kind: 'number', value: wrong },
      ]),
    ],
  })
})

registerMathGenerator('g5s-volume-units-blank', (context) => {
  const mode = context.random.int(0, 3)
  const n = context.random.int(1, 9)
  const forward = mode < 2
  const answer = forward ? n * 1000 : n
  const prompt = [
    `${n} 立方米 =（____）立方分米`,
    `${n} 升 =（____）毫升`,
    `${n * 1000} 立方厘米 =（____）立方分米`,
    `${n * 1000} 毫升 =（____）升`,
  ][mode]
  const wrong = forward ? n * 100 : n * 10
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'fill-blanks', values: [String(answer)] },
    acceptedAnswerRule: { kind: 'fill-blanks', values: [[String(answer)]], trimWhitespace: true },
    hints: {
      level1: '先想相邻两个单位之间的进率是多少',
      level2: '相邻体积单位进率是 1000，1 升 = 1000 毫升，1 立方分米 = 1 升',
    },
    explanationSteps: [`按进率 1000 换算，得到 ${answer}`],
    errorCauseRules: [
      cause('volume-unit-rate', '单位进率用错', '相邻体积、容积单位之间的进率是 1000', [
        { kind: 'fill-blanks', values: [String(wrong)] },
      ]),
    ],
  })
})

registerMathGenerator('g5s-cuboid-application-word', (context) => {
  const l = context.random.int(2, 9)
  const w = context.random.int(2, 9)
  const h = context.random.int(2, 9)
  const answer = l * w * h
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    l * w,
    cause('cuboid-app-base-only', '只算了底面积', '装水的多少要看体积，不是底面积', [
      { kind: 'word-problem', value: l * w, unit: '升' },
    ]),
  )
  pushDistinct(
    causes,
    used,
    2 * (l * w + w * h + l * h),
    cause('cuboid-app-surface', '混淆表面积与容积', '求装水多少升是求容积，不是表面积', [
      { kind: 'word-problem', value: 2 * (l * w + w * h + l * h), unit: '升' },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `一个长方体水箱，从里面量长 ${l} 分米、宽 ${w} 分米、高 ${h} 分米，最多能装水多少升？`,
    answer: { kind: 'word-problem', value: answer, unit: '升' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '升' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想装水的多少与哪个量有关',
      level2: '容积 = 长 × 宽 × 高，1 立方分米 = 1 升',
    },
    explanationSteps: [
      `容积：${l} × ${w} × ${h} = ${answer}（立方分米）`,
      `${answer} 立方分米 = ${answer} 升`,
    ],
    errorCauseRules: causes,
  })
})

// 模块三：分数的意义和性质
registerMathGenerator('g5s-fraction-meaning-choice', (context) => {
  const den = context.random.int(2, 8)
  const num = context.random.int(1, den - 1)
  const options = choiceOptions(context, [
    `${num}/${den}`,
    `${den}/${num}`,
    `${num}/${den + 1}`,
    `${num + 1}/${den + 1}`,
  ])
  return buildMathSnapshot(context, {
    prompt: `把单位“1”平均分成 ${den} 份，表示这样 ${num} 份的分数是（）。`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想分母和分子分别表示什么',
      level2: '分母表示平均分的份数，分子表示取的份数',
    },
    explanationSteps: [`平均分成 ${den} 份取 ${num} 份，写作 ${num}/${den}`],
    errorCauseRules: [
      cause('fraction-meaning-reversed', '分子分母写反', '分母是总份数，分子是取的份数', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-fraction-division-blank', (context) => {
  const a = context.random.int(1, 9)
  let b = context.random.int(2, 9)
  if (b === a) b += 1
  return buildMathSnapshot(context, {
    prompt: `${a} ÷ ${b} =（____）（填分数）`,
    answer: { kind: 'fill-blanks', values: [`${a}/${b}`] },
    acceptedAnswerRule: { kind: 'fill-blanks', values: [[`${a}/${b}`]], trimWhitespace: true },
    hints: {
      level1: '先想除法算式怎样写成分数',
      level2: '被除数作分子，除数作分母',
    },
    explanationSteps: [`${a} ÷ ${b} 写成分数是 ${a}/${b}`],
    errorCauseRules: [
      cause('fraction-division-reversed', '分子分母颠倒', '被除数是分子，除数是分母', [
        { kind: 'fill-blanks', values: [`${b}/${a}`] },
      ]),
    ],
  })
})

registerMathGenerator('g5s-proper-improper-choice', (context) => {
  const askProper = context.random.next() < 0.5
  const makeProper = () => {
    const d = context.random.int(3, 9)
    return `${context.random.int(1, d - 1)}/${d}`
  }
  const makeImproper = () => {
    const d = context.random.int(2, 9)
    return `${context.random.int(d, d + 5)}/${d}`
  }
  const correct = askProper ? makeProper() : makeImproper()
  const makeOpposite = askProper ? makeImproper : makeProper
  const distractors = new Set<string>()
  while (distractors.size < 3) {
    const value = makeOpposite()
    if (value !== correct) distractors.add(value)
  }
  const options = choiceOptions(context, [correct, ...distractors])
  return buildMathSnapshot(context, {
    prompt: `下面哪个是${askProper ? '真' : '假'}分数？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先比较每个分数的分子和分母',
      level2: '分子比分母小的是真分数，分子大于或等于分母的是假分数',
    },
    explanationSteps: [
      `${correct} 的分子${askProper ? '小于' : '大于或等于'}分母，是${askProper ? '真' : '假'}分数`,
    ],
    errorCauseRules: [
      cause('proper-improper-confused', '真分数假分数混淆', '先比较分子与分母的大小', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-fraction-property-blank', (context) => {
  const b = context.random.int(2, 9)
  const a = context.random.int(1, b - 1)
  const k = context.random.int(2, 5)
  const answer = a * k
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    a + k,
    cause('fraction-property-added', '分子用加法变化', '分母乘几，分子也要乘几，不是加几', [
      { kind: 'fill-blanks', values: [String(a + k)] },
    ]),
  )
  pushDistinct(
    causes,
    used,
    a * (k + 1),
    cause('fraction-property-over', '分子多乘了一个', '分子分母要乘相同的数', [
      { kind: 'fill-blanks', values: [String(a * (k + 1))] },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `${a}/${b} =（____）/${b * k}`,
    answer: { kind: 'fill-blanks', values: [String(answer)] },
    acceptedAnswerRule: { kind: 'fill-blanks', values: [[String(answer)]], trimWhitespace: true },
    hints: {
      level1: '先看分母扩大了几倍',
      level2: '分数的分子和分母同时乘相同的数，分数大小不变',
    },
    explanationSteps: [`分母 ${b} 乘 ${k} 变成 ${b * k}，分子 ${a} 也要乘 ${k} 得 ${answer}`],
    errorCauseRules: causes,
  })
})

registerMathGenerator('g5s-reducing-calc', (context) => {
  const rawNum = context.random.int(1, 8)
  const rawDen = context.random.int(2, 9)
  const [baseNum, baseDen] = reduceFraction(rawNum, rawDen)
  const k = context.random.int(2, 5)
  const num = baseNum * k
  const den = baseDen * k
  const [simpleNum, simpleDen] = reduceFraction(num, den)
  const causes: ErrorCauseRule[] = [
    cause('reducing-not-done', '没有约分', '约分要把分子分母同时除以它们的公因数', [
      { kind: 'fraction', numerator: num, denominator: den },
    ]),
  ]
  const partial = { numerator: baseNum, denominator: baseDen * k }
  if (!fractionsEquivalent(partial, { numerator: simpleNum, denominator: simpleDen })) {
    causes.push(
      cause('reducing-partial', '只约了分子', '分子和分母要同时除以相同的数', [
        { kind: 'fraction', numerator: partial.numerator, denominator: partial.denominator },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `把 ${num}/${den} 约分成最简分数。`,
    answer: { kind: 'fraction', numerator: simpleNum, denominator: simpleDen },
    acceptedAnswerRule: fractionRule(simpleNum, simpleDen),
    hints: {
      level1: '先找分子和分母的公因数',
      level2: '分子分母同时除以最大公因数，得到最简分数',
    },
    explanationSteps: [`${num} 和 ${den} 同时除以 ${k}，得到 ${simpleNum}/${simpleDen}`],
    errorCauseRules: causes,
  })
})

registerMathGenerator('g5s-fraction-decimal-calc', (context) => {
  const [num, den] = context.random.pick([
    [1, 2],
    [1, 4],
    [3, 4],
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [1, 8],
    [3, 8],
    [5, 8],
    [7, 8],
    [3, 10],
    [7, 10],
    [9, 10],
    [1, 20],
    [3, 20],
    [2, 25],
  ] as const)
  const answer = decimalValue(num * (1000 / den), 3)
  return buildMathSnapshot(context, {
    prompt: `把 ${num}/${den} 化成小数。`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer, true),
    hints: {
      level1: '先想分数怎样化成小数',
      level2: '用分子除以分母，或把分母化成 10、100、1000',
    },
    explanationSteps: [`${num} ÷ ${den} = ${answer}`],
    errorCauseRules: [
      cause('fraction-decimal-forgot-divide', '忘记用分子除以分母', '分数化小数要用分子除以分母', [
        { kind: 'number', value: num },
      ]),
    ],
  })
})

// 模块四：分数加法和减法
registerMathGenerator('g5s-same-denominator-calc', (context) => {
  const den = context.random.int(3, 9)
  const subtract = context.random.next() < 0.5
  let a: number
  let b: number
  if (subtract) {
    a = context.random.int(2, den - 1)
    b = context.random.int(1, a - 1)
  } else {
    a = context.random.int(1, den - 1)
    b = context.random.int(1, den - 1)
  }
  const resultNum = subtract ? a - b : a + b
  const [simpleNum, simpleDen] = reduceFraction(resultNum, den)
  return buildMathSnapshot(context, {
    prompt: `${a}/${den} ${subtract ? '-' : '+'} ${b}/${den} = ?`,
    answer: { kind: 'fraction', numerator: simpleNum, denominator: simpleDen },
    acceptedAnswerRule: fractionRule(simpleNum, simpleDen),
    hints: {
      level1: '先想同分母分数加减法的法则',
      level2: '同分母分数相加减，分母不变，分子相加减，结果要化成最简分数',
    },
    explanationSteps: [
      `分母不变，分子 ${subtract ? `${a} - ${b}` : `${a} + ${b}`} = ${resultNum}`,
      `约分得到 ${simpleNum}/${simpleDen}`,
    ],
    errorCauseRules: [
      cause('same-den-den-changed', '分母也跟着加减', '同分母分数加减，分母保持不变', [
        { kind: 'fraction', numerator: resultNum, denominator: den * 2 },
      ]),
    ],
  })
})

registerMathGenerator('g5s-different-denominator-calc', (context) => {
  const den1 = context.random.int(2, 6)
  const den2 = den1 + context.random.int(1, 4)
  const num1 = context.random.int(1, den1)
  const num2 = context.random.int(1, den2)
  const resultNum = num1 * den2 + num2 * den1
  const resultDen = den1 * den2
  const [simpleNum, simpleDen] = reduceFraction(resultNum, resultDen)
  const standard = { numerator: simpleNum, denominator: simpleDen }
  const causes: ErrorCauseRule[] = []
  const across = { numerator: num1 + num2, denominator: den1 + den2 }
  if (!fractionsEquivalent(across, standard)) {
    causes.push(
      cause('diff-den-add-across', '分子分母分别相加', '异分母分数要先通分，再相加', [
        { kind: 'fraction', numerator: across.numerator, denominator: across.denominator },
      ]),
    )
  }
  const noCommon = { numerator: num1 + num2, denominator: resultDen }
  if (!fractionsEquivalent(noCommon, standard)) {
    causes.push(
      cause('diff-den-no-common', '通分后分子算错', '通分后分子要按扩大的倍数相应变化', [
        { kind: 'fraction', numerator: noCommon.numerator, denominator: noCommon.denominator },
      ]),
    )
  }
  return buildMathSnapshot(context, {
    prompt: `${num1}/${den1} + ${num2}/${den2} = ?`,
    answer: { kind: 'fraction', numerator: simpleNum, denominator: simpleDen },
    acceptedAnswerRule: fractionRule(simpleNum, simpleDen),
    hints: {
      level1: '先想分母不同该怎么办',
      level2: '异分母分数先通分化成同分母，再相加，结果化成最简分数',
    },
    explanationSteps: [
      `通分成分母 ${resultDen}`,
      `分子相加得 ${resultNum}，约分得 ${simpleNum}/${simpleDen}`,
    ],
    errorCauseRules: causes,
  })
})

registerMathGenerator('g5s-fraction-simplify-calc', (context) => {
  const den = context.random.int(3, 8)
  const a = context.random.int(1, den - 1)
  const c = den - a
  const den2 = context.random.int(2, 6)
  const [simpleNum, simpleDen] = reduceFraction(den2 + 1, den2)
  return buildMathSnapshot(context, {
    prompt: `${a}/${den} + 1/${den2} + ${c}/${den} = ?`,
    answer: { kind: 'fraction', numerator: simpleNum, denominator: simpleDen },
    acceptedAnswerRule: fractionRule(simpleNum, simpleDen),
    hints: {
      level1: '先观察哪两个分数能凑成整数',
      level2: '运用加法交换律和结合律，先把同分母且能凑整的分数相加',
    },
    explanationSteps: [
      `${a}/${den} + ${c}/${den} = 1`,
      `1 + 1/${den2} = ${simpleNum}/${simpleDen}`,
    ],
    errorCauseRules: [
      cause('fraction-simplify-forgot-term', '漏加一个分数', '简便计算后每个加数都要计入', [
        { kind: 'fraction', numerator: 1, denominator: den2 },
      ]),
    ],
  })
})

registerMathGenerator('g5s-fraction-application-word', (context) => {
  const [num1, den1] = context.random.pick([
    [1, 4],
    [1, 2],
    [3, 4],
    [1, 5],
    [2, 5],
  ] as const)
  const [num2, den2] = context.random.pick([
    [1, 4],
    [1, 2],
    [3, 4],
    [1, 5],
    [2, 5],
  ] as const)
  const first = num1 / den1
  const second = num2 / den2
  const answer = decimalValue(Math.round((first + second) * 1000), 3)
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    decimalValue(Math.round(Math.abs(first - second) * 1000), 3),
    cause('fraction-app-subtracted', '用减法求一共', '求一共用去多少要用加法', [
      {
        kind: 'word-problem',
        value: decimalValue(Math.round(Math.abs(first - second) * 1000), 3),
        unit: '米',
      },
    ]),
  )
  pushDistinct(
    causes,
    used,
    decimalValue(Math.round(first * 1000), 3),
    cause('fraction-app-one-only', '只算了一次用去的', '要把两次用去的都合起来', [
      { kind: 'word-problem', value: decimalValue(Math.round(first * 1000), 3), unit: '米' },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `一根绳子，第一次用去 ${num1}/${den1} 米，第二次用去 ${num2}/${den2} 米，两次一共用去多少米？`,
    answer: { kind: 'word-problem', value: answer, unit: '米' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '米' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想“一共”用什么运算',
      level2: '把两次用去的长度相加，异分母先通分',
    },
    explanationSteps: [`${num1}/${den1} + ${num2}/${den2} = ${answer}（米）`],
    errorCauseRules: causes,
  })
})

// 模块五：图形运动
registerMathGenerator('g5s-rotation-direction-choice', (context) => {
  const start = context.random.int(1, 12)
  const clockwise = context.random.next() < 0.5
  const end = clockwise ? ((start - 1 + 3) % 12) + 1 : ((start - 1 - 3 + 12) % 12) + 1
  const correct = clockwise ? '顺时针' : '逆时针'
  const opposite = clockwise ? '逆时针' : '顺时针'
  const options = choiceOptions(context, [correct, opposite, '平移', '轴对称'])
  return buildMathSnapshot(context, {
    prompt: `钟面上指针从“${start}”绕中心旋转 90° 到“${end}”，旋转方向是（）。`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想钟面上数字增大的方向是什么方向',
      level2: '与钟表指针走动方向相同的是顺时针，相反的是逆时针',
    },
    explanationSteps: [`从 ${start} 到 ${end} 旋转 90°，方向是${correct}`],
    errorCauseRules: [
      cause('rotation-direction-reversed', '旋转方向判断反', '先确定钟表指针正常走动的方向', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-rotation-features-choice', (context) => {
  const options = choiceOptions(context, ['形状和大小不变', '位置不变', '方向不变', '大小改变'])
  const prompt = context.random.pick([
    '图形旋转后，下面说法正确的是（）。',
    '把一个图形绕某点旋转，旋转前后（）。',
    '关于旋转的特征，下面正确的是（）。',
  ] as const)
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    hints: {
      level1: '先想旋转改变了什么、没改变什么',
      level2: '旋转只改变图形的位置和方向，形状和大小都不变',
    },
    explanationSteps: ['旋转不改变图形的形状和大小，只改变位置和方向'],
    errorCauseRules: [
      cause('rotation-features-confused', '旋转特征混淆', '旋转后位置和方向会变，形状大小不变', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

// 模块六：折线统计图
registerMathGenerator('g5s-single-line-chart-choice', (context) => {
  const values = distinctNumbers(context, 4, 5, 35)
  const days = ['星期一', '星期二', '星期三', '星期四']
  const askMax = context.random.next() < 0.5
  const target = askMax ? Math.max(...values) : Math.min(...values)
  const correctDay = days[values.indexOf(target)]
  const options = choiceOptions(context, [correctDay, ...days.filter((day) => day !== correctDay)])
  const resource = textResource(
    'single-line-chart',
    `单式折线统计图（示意）：${days.map((day, index) => `${day} ${values[index]}℃`).join('、')}。${DIAGRAM_NOTE}`,
  )
  return buildMathSnapshot(context, {
    prompt: `根据折线统计图，星期几的气温最${askMax ? '高' : '低'}？`,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    resources: [resource],
    hints: {
      level1: '先看清每个点对应的气温再比较',
      level2: '折线上的点越高表示气温越高，逐一对应读数',
    },
    explanationSteps: [`${correctDay}对应的点最${askMax ? '高' : '低'}，气温是 ${target}℃`],
    errorCauseRules: [
      cause('single-line-misread', '读错折线对应数据', '先对齐横轴与数据点，再比较高低', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-double-line-chart-choice', (context) => {
  const days = ['星期一', '星期二', '星期三', '星期四']
  const correctIndex = context.random.int(0, 3)
  const seriesA: number[] = []
  const seriesB: number[] = []
  for (let index = 0; index < 4; index += 1) {
    const b = context.random.int(12, 25)
    const a = index === correctIndex ? b + context.random.int(1, 5) : b - context.random.int(1, 5)
    seriesA.push(a)
    seriesB.push(b)
  }
  const options = choiceOptions(context, days)
  const resource = textResource(
    'double-line-chart',
    `复式折线统计图（示意）：甲城 ${days.map((day, i) => `${day} ${seriesA[i]}℃`).join('、')}；乙城 ${days.map((day, i) => `${day} ${seriesB[i]}℃`).join('、')}。${DIAGRAM_NOTE}`,
  )
  // 题面须随种子变化，否则 createRetestQuestion 无法生成不同题面的复测变式
  const prompt = context.random.pick([
    '根据复式折线统计图，哪一天甲城的气温比乙城高？',
    '观察复式折线统计图，甲城气温高于乙城的是哪一天？',
    '看复式折线统计图，哪一天甲城的折线在乙城折线的上方？',
  ])
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'single-choice', optionId: 'opt-a' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-a'] },
    options,
    resources: [resource],
    hints: {
      level1: '先分清两条折线分别代表哪个城市',
      level2: '逐天比较两条折线的高低，甲城折线在乙城上方时气温更高',
    },
    explanationSteps: [
      `${days[correctIndex]}甲城 ${seriesA[correctIndex]}℃ 高于乙城 ${seriesB[correctIndex]}℃`,
    ],
    errorCauseRules: [
      cause('double-line-confused', '两条折线看混', '先按图例分清甲城和乙城的折线', [
        { kind: 'single-choice', optionId: 'opt-b' },
      ]),
    ],
  })
})

registerMathGenerator('g5s-line-chart-trends-word', (context) => {
  const days = ['星期一', '星期二', '星期三', '星期四', '星期五']
  const values: number[] = [context.random.int(5, 15)]
  for (let index = 1; index < 5; index += 1) {
    values.push(values[index - 1] + context.random.int(1, 5))
  }
  const answer = values[4] - values[0]
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    values[4],
    cause('trends-last-only', '只读了最后的气温', '求升高多少要用最后减最初', [
      { kind: 'word-problem', value: values[4], unit: '摄氏度' },
    ]),
  )
  pushDistinct(
    causes,
    used,
    values[0],
    cause('trends-first-only', '只读了最初的气温', '升高的度数是最初与最后的差', [
      { kind: 'word-problem', value: values[0], unit: '摄氏度' },
    ]),
  )
  const resource = textResource(
    'trends-line-chart',
    `折线统计图（示意）：${days.map((day, index) => `${day} ${values[index]}℃`).join('、')}。${DIAGRAM_NOTE}`,
  )
  // 题面须随种子变化，否则 createRetestQuestion 无法生成不同题面的复测变式
  const prompt = context.random.pick([
    '根据折线统计图，从星期一到星期五气温一共升高了多少摄氏度？',
    '看折线统计图，星期五的气温比星期一升高了多少摄氏度？',
    '根据折线统计图算一算，这一周从星期一到星期五气温升高了多少摄氏度？',
  ])
  return buildMathSnapshot(context, {
    prompt,
    answer: { kind: 'word-problem', value: answer, unit: '摄氏度' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '摄氏度' }],
      unitRequired: true,
    },
    resources: [resource],
    hints: {
      level1: '先读出最初和最后的气温',
      level2: '升高的度数 = 最后气温 - 最初气温',
    },
    explanationSteps: [`${values[4]} - ${values[0]} = ${answer}（摄氏度）`],
    errorCauseRules: causes,
  })
})

// 模块七：找次品
registerMathGenerator('g5s-defective-strategy-calc', (context) => {
  const [n, answer] = context.random.pick([
    [3, 1],
    [9, 2],
    [27, 3],
  ] as const)
  const wrong = Math.ceil(Math.log2(n))
  return buildMathSnapshot(context, {
    prompt: `有 ${n} 个同样的零件，其中 1 个是次品（轻一些）。用天平称，至少称几次能保证找出次品？`,
    answer: { kind: 'number', value: answer },
    acceptedAnswerRule: numberRule(answer),
    hints: {
      level1: '先想怎样分组能让每次称量排除最多的零件',
      level2: '把零件尽量平均分成 3 份，每次称量能把范围缩小到原来的三分之一',
    },
    explanationSteps: [`把 ${n} 个零件平均分成 3 份，逐次称量，至少 ${answer} 次能保证找出`],
    errorCauseRules: [
      cause(
        'defective-strategy-two-groups',
        '按分成两份来称',
        '分成 3 份比分成 2 份更能减少称量次数',
        [{ kind: 'number', value: wrong }],
      ),
    ],
  })
})

registerMathGenerator('g5s-defective-reasoning-word', (context) => {
  const n = context.random.pick([5, 6, 7, 8] as const)
  const k = context.random.int(1, Math.floor((n - 1) / 2))
  const answer = n - 2 * k
  const causes: ErrorCauseRule[] = []
  const used = new Set<number>([answer])
  pushDistinct(
    causes,
    used,
    2 * k,
    cause('defective-reasoning-weighed', '算成已称的个数', '天平平衡说明次品在没称的剩下部分里', [
      { kind: 'word-problem', value: 2 * k, unit: '个' },
    ]),
  )
  pushDistinct(
    causes,
    used,
    k,
    cause('defective-reasoning-one-side', '只算了一边的个数', '剩下的是总数减去两边已称的个数', [
      { kind: 'word-problem', value: k, unit: '个' },
    ]),
  )
  return buildMathSnapshot(context, {
    prompt: `有 ${n} 个球，其中 1 个次品轻一些。天平两边各放 ${k} 个，若天平平衡，次品在剩下的几个球里？`,
    answer: { kind: 'word-problem', value: answer, unit: '个' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: answer, unit: '个' }],
      unitRequired: true,
    },
    hints: {
      level1: '先想天平平衡说明了什么',
      level2: '天平平衡说明次品不在已称的球里，而在剩下的球里',
    },
    explanationSteps: [`已称 ${k} + ${k} = ${2 * k} 个，剩下 ${n} - ${2 * k} = ${answer} 个`],
    errorCauseRules: causes,
  })
})
