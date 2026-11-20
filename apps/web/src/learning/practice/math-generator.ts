import { GRADE4_AUTUMN_MATH_COURSE } from '../content/grade4-math'
import { parseQuestionSnapshot } from '../contracts'
import type { Random } from '../ports'
import type { Difficulty, ErrorCauseRule, QuestionSnapshot } from '../types'
import { getMathTemplate, type MathQuestionTemplate } from './math-templates'

function seededRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const int = (minimum: number, maximum: number) =>
    minimum + Math.floor(next() * (maximum - minimum + 1))
  return {
    next,
    int,
    pick: (values) => {
      if (values.length === 0) throw new Error('Cannot pick from an empty collection')
      return values[int(0, values.length - 1)]
    },
  }
}

function cause(
  id: string,
  label: string,
  feedback: string,
  answers: ErrorCauseRule['answers'],
): ErrorCauseRule {
  return { id, label, feedback, answers }
}

function baseSnapshot(
  template: MathQuestionTemplate,
  difficulty: Difficulty,
  seed: number,
  instanceId: string,
  prompt: string,
  answer: QuestionSnapshot['standardAnswer'],
  hints: QuestionSnapshot['hints'],
  explanationSteps: readonly string[],
  errorCauseRules: readonly ErrorCauseRule[],
): QuestionSnapshot {
  const point = GRADE4_AUTUMN_MATH_COURSE.knowledgePoints.find(
    (item) => item.id === template.classification.knowledgePointId,
  )
  if (!point) throw new Error(`模板知识点不存在：${template.classification.knowledgePointId}`)
  return {
    templateId: template.id,
    templateVersion: template.version,
    instanceId,
    seed,
    classification: template.classification,
    source: point.source,
    countsTowardNewKnowledge: point.source !== 'review',
    type: answer.kind,
    difficulty,
    prompt,
    resources: [],
    standardAnswer: answer,
    acceptedAnswerRule:
      answer.kind === 'number'
        ? { kind: 'number', values: [answer.value] }
        : {
            kind: 'quotient-remainder',
            values: [{ quotient: answer.quotient, remainder: answer.remainder }],
          },
    errorCauseRules,
    hints,
    explanationSteps,
    retestKnowledgePointIds: [point.id],
    participatesInTask: true,
    rewardEligible: true,
  }
}

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

function multiplication(
  template: MathQuestionTemplate,
  difficulty: Difficulty,
  seed: number,
  instanceId: string,
  a: number,
  b: number,
): QuestionSnapshot {
  const answer = a * b
  const lower = a * (b % 10)
  const upper = a * Math.floor(b / 10)
  return baseSnapshot(
    template,
    difficulty,
    seed,
    instanceId,
    `${a} × ${b} = ?`,
    { kind: 'number', value: answer },
    {
      level1: '先按数位检查每一次相乘和部分积的位置',
      level2: `先算 ${a} 乘个位，再算 ${a} 乘十位；第二层积要与十位对齐`,
    },
    [
      `个位部分：${a} × ${b % 10} = ${lower}`,
      `十位部分：${a} × ${Math.floor(b / 10)} = ${upper}，表示 ${upper * 10}`,
      `相加得到 ${answer}`,
    ],
    multiplicationCauses(a, b, answer),
  )
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
  template: MathQuestionTemplate,
  difficulty: Difficulty,
  seed: number,
  instanceId: string,
  dividend: number,
  divisor: number,
): QuestionSnapshot {
  const quotient = Math.floor(dividend / divisor)
  const remainder = dividend % divisor
  return baseSnapshot(
    template,
    difficulty,
    seed,
    instanceId,
    `${dividend} ÷ ${divisor}，商和余数分别是多少？`,
    { kind: 'quotient-remainder', quotient, remainder },
    {
      level1: '先检查试商乘除数的结果，以及余数与除数的大小关系',
      level2: `用商乘 ${divisor}，再加上余数，应该等于 ${dividend}`,
    },
    [
      `试商 ${quotient}：${divisor} × ${quotient} = ${divisor * quotient}`,
      `${dividend} - ${divisor * quotient} = ${remainder}`,
      `余数 ${remainder} 小于除数 ${divisor}，所以商是 ${quotient}，余数是 ${remainder}`,
    ],
    divisionCauses(quotient, remainder, divisor),
  )
}

function generateWithRandom(
  template: MathQuestionTemplate,
  difficulty: Difficulty,
  seed: number,
  instanceId: string,
  random: Random,
): QuestionSnapshot {
  switch (template.generator) {
    case 'oral-multiplication-one': {
      const a = difficulty === 'L1' ? random.int(12, 99) : random.int(12, 99) * 10
      return multiplication(template, difficulty, seed, instanceId, a, random.int(2, 9))
    }
    case 'oral-multiplication-tens': {
      const a = difficulty === 'L1' ? random.int(11, 99) : random.int(12, 99) * 10
      return multiplication(template, difficulty, seed, instanceId, a, random.int(2, 9) * 10)
    }
    case 'written-multiplication-two': {
      const minimum = difficulty === 'L1' ? 10 : difficulty === 'L2' ? 15 : 50
      return multiplication(
        template,
        difficulty,
        seed,
        instanceId,
        random.int(minimum, 99),
        random.int(11, 99),
      )
    }
    case 'written-multiplication-three': {
      const minimum = difficulty === 'L1' ? 100 : difficulty === 'L2' ? 200 : 700
      return multiplication(
        template,
        difficulty,
        seed,
        instanceId,
        random.int(minimum, 999),
        random.int(10, 99),
      )
    }
    case 'written-multiplication-zero': {
      const a =
        random.next() < 0.5 ? random.int(1, 9) * 100 + random.int(1, 9) : random.int(10, 99) * 10
      return multiplication(template, difficulty, seed, instanceId, a, random.int(10, 99))
    }
    case 'oral-division-tens': {
      const divisor = random.int(2, 9) * 10
      const quotient = random.int(2, difficulty === 'L1' ? 6 : 9)
      return baseSnapshot(
        template,
        difficulty,
        seed,
        instanceId,
        `${divisor * quotient} ÷ ${divisor} = ?`,
        { kind: 'number', value: quotient },
        {
          level1: '先想除数乘几能得到被除数',
          level2: `把被除数和除数末尾相同个数的 0 同时去掉再口算`,
        },
        [`${divisor} × ${quotient} = ${divisor * quotient}`, `所以商是 ${quotient}`],
        [],
      )
    }
    case 'written-division':
    case 'trial-division':
    case 'remainder-division': {
      const divisor = difficulty === 'L1' ? random.int(2, 9) * 10 : random.int(10, 99)
      const requiresRemainder = template.generator === 'remainder-division'
      const maximumDividend = requiresRemainder ? 998 : 999
      const maximumQuotient = Math.max(
        1,
        Math.min(difficulty === 'L1' ? 9 : 20, Math.floor(maximumDividend / divisor)),
      )
      const quotient = random.int(1, maximumQuotient)
      const maximumRemainder = Math.min(divisor - 1, 999 - divisor * quotient)
      const remainder = random.int(requiresRemainder ? 1 : 0, maximumRemainder)
      return division(
        template,
        difficulty,
        seed,
        instanceId,
        divisor * quotient + remainder,
        divisor,
      )
    }
    case 'product-rule': {
      const factor = random.pick([2, 5, 10] as const)
      const divide = random.next() < 0.5
      const a = divide ? factor * random.int(2, 12) : random.int(2, 20)
      const b = random.int(3, 15)
      const changed = divide ? a / factor : a * factor
      const answer = divide ? (a * b) / factor : a * b * factor
      return baseSnapshot(
        template,
        difficulty,
        seed,
        instanceId,
        `${a} × ${b} = ${a * b}，${changed} × ${b} = ?`,
        { kind: 'number', value: answer },
        {
          level1: '先比较两个乘数，判断积应按相同倍数怎样变化',
          level2: `一个乘数${divide ? '除以' : '乘'} ${factor}，另一个不变，积也${divide ? '除以' : '乘'} ${factor}`,
        },
        [`原积是 ${a * b}`, `积${divide ? '除以' : '乘'} ${factor}，得到 ${answer}`],
        [
          cause('product-not-changed', '积没有随乘数变化', '先比较两个乘数的变化倍数', [
            { kind: 'number', value: a * b },
          ]),
        ],
      )
    }
    case 'quotient-rule': {
      const divisor = random.int(3, 12)
      const quotient = random.int(3, 12)
      const dividend = divisor * quotient
      const factor = random.pick([2, 5, 10] as const)
      const both = difficulty === 'L3' && random.next() < 0.5
      const changedDividend = dividend * factor
      const changedDivisor = both ? divisor * factor : divisor
      const answer = both ? quotient : quotient * factor
      return baseSnapshot(
        template,
        difficulty,
        seed,
        instanceId,
        `${dividend} ÷ ${divisor} = ${quotient}，${changedDividend} ÷ ${changedDivisor} = ?`,
        { kind: 'number', value: answer },
        {
          level1: '先分别比较被除数和除数的变化，再判断商',
          level2: both
            ? `被除数和除数同时乘 ${factor}，商不变`
            : `除数不变，被除数乘 ${factor}，商也乘 ${factor}`,
        },
        [
          `根据变化规律，商为 ${answer}`,
          `用 ${changedDivisor} × ${answer} = ${changedDividend} 验算`,
        ],
        [
          cause(
            'quotient-change-misapplied',
            '商的变化判断错误',
            '先确认被除数和除数是否同时变化',
            [{ kind: 'number', value: both ? quotient * factor : quotient }],
          ),
        ],
      )
    }
    case 'multiplication-estimation': {
      const roundedA = random.int(2, 9) * 100
      const roundedB = random.int(2, 9) * 10
      const a = roundedA - random.int(1, 9)
      const b = roundedB + random.int(1, 9)
      const answer = roundedA * roundedB
      return baseSnapshot(
        template,
        difficulty,
        seed,
        instanceId,
        `把 ${a} 看作 ${roundedA}，把 ${b} 看作 ${roundedB}，积约是多少？`,
        { kind: 'number', value: answer },
        {
          level1: '只使用题目给出的两个近似数计算',
          level2: `按估法应计算 ${roundedA} × ${roundedB}`,
        },
        [`${roundedA} × ${roundedB} = ${answer}`, `估算结果是 ${answer}`],
        [
          cause(
            'not-using-estimate',
            '未按指定估法',
            '不要计算原数的准确积，使用题目给出的近似数',
            [{ kind: 'number', value: a * b }],
          ),
        ],
      )
    }
    case 'division-estimation': {
      const divisor = random.int(2, 9) * 10
      const quotient = random.int(2, 9)
      const roundedDividend = divisor * quotient
      const dividend = roundedDividend - random.int(1, 9)
      return baseSnapshot(
        template,
        difficulty,
        seed,
        instanceId,
        `把 ${dividend} 看作 ${roundedDividend}，除数是 ${divisor}，商约是多少？`,
        { kind: 'number', value: quotient },
        {
          level1: '用题目给出的近似被除数除以除数',
          level2: `按估法应计算 ${roundedDividend} ÷ ${divisor}`,
        },
        [`${divisor} × ${quotient} = ${roundedDividend}`, `所以估算商是 ${quotient}`],
        [],
      )
    }
    case 'division-verification': {
      const divisor = random.int(10, 30)
      const quotient = random.int(2, 9)
      const remainder = random.int(1, divisor - 1)
      const dividend = divisor * quotient + remainder
      return baseSnapshot(
        template,
        difficulty,
        seed,
        instanceId,
        `一道除法的除数是 ${divisor}，商是 ${quotient}，余数是 ${remainder}。用乘法验算，被除数是多少？`,
        { kind: 'number', value: dividend },
        {
          level1: '验算时把商乘除数，再加上余数',
          level2: `先算 ${divisor} × ${quotient}，不要忘记加余数`,
        },
        [
          `${divisor} × ${quotient} = ${divisor * quotient}`,
          `${divisor * quotient} + ${remainder} = ${dividend}`,
        ],
        [
          cause('verification-forgot-remainder', '验算时漏加余数', '商乘除数后还要加上余数', [
            { kind: 'number', value: divisor * quotient },
          ]),
        ],
      )
    }
    case 'prior-review': {
      const a = random.int(2, 9)
      const b = random.int(2, 9)
      if (random.next() < 0.5) return multiplication(template, difficulty, seed, instanceId, a, b)
      return baseSnapshot(
        template,
        difficulty,
        seed,
        instanceId,
        `${a * b} ÷ ${a} = ?`,
        { kind: 'number', value: b },
        { level1: '先想对应的乘法口诀', level2: `想 ${a} 乘几等于 ${a * b}` },
        [`${a} × ${b} = ${a * b}`, `所以商是 ${b}`],
        [],
      )
    }
  }
}

export function generateMathQuestion(
  templateId: string,
  seed: number,
  instanceId: string,
  difficulty?: Difficulty,
): QuestionSnapshot {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('题目种子必须是非负安全整数')
  if (instanceId.trim().length === 0) throw new Error('题目实例 ID 不能为空')
  const template = getMathTemplate(templateId)
  const selectedDifficulty = difficulty ?? template.difficulty
  if (!template.supportedDifficulties.includes(selectedDifficulty)) {
    throw new Error(`模板 ${templateId} 不支持难度 ${selectedDifficulty}`)
  }
  return parseQuestionSnapshot(
    generateWithRandom(template, selectedDifficulty, seed, instanceId, seededRandom(seed)),
    GRADE4_AUTUMN_MATH_COURSE,
  )
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
