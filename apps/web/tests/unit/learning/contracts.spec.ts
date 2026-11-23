import { describe, expect, it } from 'vitest'
import {
  ContentValidationError,
  parseCourse,
  parseKnowledgePoint,
  parseLearningRecord,
  parseQuestionSnapshot,
  parseQuestionTemplate,
} from '../../../src/learning/contracts'
import {
  LEARNING_RESULTS,
  QUESTION_TYPES,
  type Course,
  type LearningRecord,
  type QuestionSnapshot,
  type QuestionTemplate,
  type QuestionType,
} from '../../../src/learning/types'

function makeCourse(): Course {
  return {
    id: 'course-1',
    version: 1,
    title: '四年级数学',
    subject: 'math',
    grade: 4,
    semester: 'autumn',
    textbook: '人教版新旧融合',
    units: [
      { id: 'unit-1', title: '乘法', order: 1 },
      { id: 'unit-2', title: '规律', order: 2 },
    ],
    knowledgePoints: [
      {
        id: 'kp-1',
        courseId: 'course-1',
        unitId: 'unit-1',
        name: '两位数乘两位数',
        source: 'new-pep',
      },
      {
        id: 'kp-2',
        courseId: 'course-1',
        unitId: 'unit-2',
        name: '积的变化规律',
        source: 'old-pep',
      },
    ],
  }
}

function makeSnapshot(): QuestionSnapshot {
  return {
    templateId: 'template-1',
    templateVersion: 2,
    instanceId: 'instance-1',
    seed: 42,
    classification: {
      courseId: 'course-1',
      subject: 'math',
      grade: 4,
      semester: 'autumn',
      textbook: '人教版新旧融合',
      unitId: 'unit-1',
      knowledgePointId: 'kp-1',
    },
    source: 'new-pep',
    countsTowardNewKnowledge: true,
    type: 'number',
    difficulty: 'L2',
    prompt: '15 × 12 = ?',
    resources: [{ id: 'resource-1', type: 'text', uri: 'inline:question', altText: '乘法算式' }],
    standardAnswer: { kind: 'number', value: 180 },
    acceptedAnswerRule: { kind: 'number', values: [180] },
    errorCauseRules: [
      {
        id: 'place-value',
        label: '部分积错位',
        feedback: '检查第二层积的位置',
        answers: [{ kind: 'number', value: 90 }],
      },
    ],
    hints: { level1: '先检查第二层积', level2: '第二层积表示 15 个十' },
    explanationSteps: ['先算 15 × 2', '再算 15 × 10', '把两部分相加'],
    retestKnowledgePointIds: ['kp-1'],
    participatesInTask: true,
    rewardEligible: true,
  }
}

function makeTemplate(): QuestionTemplate {
  const snapshot = makeSnapshot()
  return {
    id: snapshot.templateId,
    version: snapshot.templateVersion,
    classification: snapshot.classification,
    type: snapshot.type,
    difficulty: snapshot.difficulty,
    promptTemplate: '{a} × {b} = ?',
  }
}

const QUESTION_FIXTURES: Record<
  QuestionType,
  Pick<QuestionSnapshot, 'standardAnswer' | 'acceptedAnswerRule'> & {
    options?: QuestionSnapshot['options']
  }
> = {
  number: {
    standardAnswer: { kind: 'number', value: 180 },
    acceptedAnswerRule: { kind: 'number', values: [180] },
  },
  'quotient-remainder': {
    standardAnswer: { kind: 'quotient-remainder', quotient: 7, remainder: 3 },
    acceptedAnswerRule: {
      kind: 'quotient-remainder',
      values: [{ quotient: 7, remainder: 3 }],
    },
  },
  'fill-blanks': {
    standardAnswer: { kind: 'fill-blanks', values: ['12', '20'] },
    acceptedAnswerRule: {
      kind: 'fill-blanks',
      values: [['12'], ['20', '二十']],
      trimWhitespace: true,
    },
  },
  'single-choice': {
    options: [
      { id: 'a', text: '12' },
      { id: 'b', text: '14' },
      { id: 'c', text: '16' },
      { id: 'd', text: '18' },
    ],
    standardAnswer: { kind: 'single-choice', optionId: 'c' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['c'] },
  },
  'word-problem': {
    standardAnswer: { kind: 'word-problem', value: 12.5, unit: '元' },
    acceptedAnswerRule: {
      kind: 'word-problem',
      values: [{ value: 12.5, unit: '元' }],
      unitRequired: true,
      decimalPlaces: 1,
    },
  },
  fraction: {
    standardAnswer: { kind: 'fraction', numerator: 1, denominator: 2 },
    acceptedAnswerRule: {
      kind: 'fraction',
      values: [{ numerator: 1, denominator: 2 }],
      requireSimplest: true,
    },
  },
  'english-spelling': {
    standardAnswer: { kind: 'english-spelling', value: 'apple' },
    acceptedAnswerRule: {
      kind: 'english-spelling',
      values: ['apple'],
      caseSensitive: false,
    },
  },
  'sentence-completion': {
    standardAnswer: { kind: 'sentence-completion', values: ['I can swim.'] },
    acceptedAnswerRule: {
      kind: 'sentence-completion',
      values: [['I can swim']],
      caseSensitive: false,
      ignoreTerminalPunctuation: true,
    },
  },
}

function makeTypedSnapshot(type: QuestionType): QuestionSnapshot {
  return {
    ...makeSnapshot(),
    ...QUESTION_FIXTURES[type],
    type,
    errorCauseRules: [],
  }
}

function makeRecord(): LearningRecord {
  return {
    id: 'record-1',
    questionInstanceId: 'instance-1',
    templateId: 'template-1',
    templateVersion: 2,
    courseId: 'course-1',
    knowledgePointId: 'kp-1',
    result: 'first-correct',
    answer: { kind: 'number', value: 180 },
    attempts: 1,
    highestHintLevel: 0,
    explanationViewed: false,
    startedAt: 100,
    settledAt: 200,
  }
}

describe('course and knowledge point contracts', () => {
  it('accepts a complete course and validates unit references', () => {
    const course = makeCourse()
    expect(parseCourse(course)).toEqual(course)
    expect(parseKnowledgePoint(course.knowledgePoints[0], course)).toEqual(
      course.knowledgePoints[0],
    )
    expect(parseQuestionTemplate(makeTemplate(), course)).toEqual(makeTemplate())
  })

  it('rejects malformed courses and duplicate identifiers', () => {
    expect(() => parseCourse(null)).toThrow(ContentValidationError)
    expect(() => parseCourse({ ...makeCourse(), semester: 'summer' })).toThrow('semester')
    expect(() => parseCourse({ ...makeCourse(), units: [] })).toThrow('至少包含 1 项')
    expect(() =>
      parseCourse({ ...makeCourse(), units: [makeCourse().units[0], makeCourse().units[0]] }),
    ).toThrow('单元 ID 重复')
    expect(() =>
      parseCourse({
        ...makeCourse(),
        knowledgePoints: [makeCourse().knowledgePoints[0], makeCourse().knowledgePoints[0]],
      }),
    ).toThrow('知识点 ID 重复')
  })

  it('rejects unknown sources and foreign course references', () => {
    const course = makeCourse()
    const point = course.knowledgePoints[0]
    expect(() => parseKnowledgePoint({ ...point, source: 'unknown' })).toThrow('未知来源标签')
    expect(() => parseKnowledgePoint({ ...point, courseId: 'other' }, course)).toThrow(
      '不属于指定课程',
    )
    expect(() => parseKnowledgePoint({ ...point, unitId: 'other' }, course)).toThrow(
      '不属于指定课程',
    )
  })
})

describe('question content contract', () => {
  it('expresses every PRD 8.2 field in a validated snapshot', () => {
    const snapshot = makeSnapshot()
    expect(parseQuestionSnapshot(snapshot, makeCourse())).toEqual(snapshot)
    expect(snapshot).toMatchObject({
      templateId: expect.any(String),
      templateVersion: expect.any(Number),
      instanceId: expect.any(String),
      seed: expect.any(Number),
      classification: expect.any(Object),
      source: expect.any(String),
      countsTowardNewKnowledge: expect.any(Boolean),
      type: expect.any(String),
      difficulty: expect.any(String),
      prompt: expect.any(String),
      resources: expect.any(Array),
      standardAnswer: expect.any(Object),
      acceptedAnswerRule: expect.any(Object),
      errorCauseRules: expect.any(Array),
      hints: { level1: expect.any(String), level2: expect.any(String) },
      explanationSteps: expect.any(Array),
      retestKnowledgePointIds: expect.any(Array),
      participatesInTask: expect.any(Boolean),
      rewardEligible: expect.any(Boolean),
    })
  })

  it('supports quotient and remainder answers and all resource types', () => {
    const snapshot = makeSnapshot()
    const quotientSnapshot: QuestionSnapshot = {
      ...snapshot,
      type: 'quotient-remainder',
      resources: [
        { id: 'image', type: 'image', uri: '/question.png', altText: '竖式' },
        { id: 'audio', type: 'audio', uri: '/question.mp3' },
        { id: 'text', type: 'text', uri: 'inline:text' },
      ],
      standardAnswer: { kind: 'quotient-remainder', quotient: 7, remainder: 3 },
      acceptedAnswerRule: {
        kind: 'quotient-remainder',
        values: [{ quotient: 7, remainder: 3 }],
      },
      errorCauseRules: [
        {
          id: 'remainder-too-large',
          label: '余数过大',
          feedback: '余数要小于除数',
          answers: [{ kind: 'quotient-remainder', quotient: 6, remainder: 15 }],
        },
      ],
    }
    expect(parseQuestionSnapshot(quotientSnapshot, makeCourse())).toEqual(quotientSnapshot)
  })

  it.each(QUESTION_TYPES)('accepts the %s question and answer contract', (type) => {
    const snapshot = makeTypedSnapshot(type)
    expect(parseQuestionSnapshot(snapshot, makeCourse())).toEqual(snapshot)
  })

  it('requires four unique choice options and valid answer references', () => {
    const snapshot = makeTypedSnapshot('single-choice')
    const template: QuestionTemplate = {
      ...makeTemplate(),
      type: 'single-choice',
      options: snapshot.options,
    }
    expect(parseQuestionTemplate(template, makeCourse())).toEqual(template)
    expect(() =>
      parseQuestionSnapshot({ ...snapshot, options: snapshot.options?.slice(0, 3) }),
    ).toThrow('恰好包含四个选项')
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        options: snapshot.options?.map((option, index) =>
          index === 1 ? { ...option, id: 'a' } : option,
        ),
      }),
    ).toThrow('选项 ID 重复')
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        standardAnswer: { kind: 'single-choice', optionId: 'unknown' },
        acceptedAnswerRule: { kind: 'single-choice', values: ['unknown'] },
      }),
    ).toThrow('答案引用了未知选项')
    expect(() => parseQuestionTemplate({ ...template, options: undefined })).toThrow('options')
  })

  it('requires alternative text for every image resource', () => {
    const snapshot = makeSnapshot()
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        resources: [{ id: 'image', type: 'image', uri: '/diagram.png' }],
      }),
    ).toThrow('altText')
  })

  it('enforces numeric sign, decimal and precision rules', () => {
    const negative = {
      ...makeSnapshot(),
      standardAnswer: { kind: 'number', value: -2 },
      acceptedAnswerRule: { kind: 'number', values: [-2], allowNegative: true },
      errorCauseRules: [],
    }
    const decimal = {
      ...makeSnapshot(),
      standardAnswer: { kind: 'number', value: 1.25 },
      acceptedAnswerRule: {
        kind: 'number',
        values: [1.25],
        allowDecimal: true,
        decimalPlaces: 2,
      },
      errorCauseRules: [],
    }
    expect(parseQuestionSnapshot(negative)).toEqual(negative)
    expect(parseQuestionSnapshot(decimal)).toEqual(decimal)
    expect(() =>
      parseQuestionSnapshot({
        ...negative,
        acceptedAnswerRule: { kind: 'number', values: [-2] },
      }),
    ).toThrow('不能为负数')
    expect(() =>
      parseQuestionSnapshot({
        ...decimal,
        acceptedAnswerRule: { kind: 'number', values: [1.25] },
      }),
    ).toThrow('必须为整数')
    expect(() =>
      parseQuestionSnapshot({
        ...decimal,
        acceptedAnswerRule: {
          kind: 'number',
          values: [1.25],
          allowDecimal: true,
          decimalPlaces: 1,
        },
      }),
    ).toThrow('最多保留 1 位小数')
  })

  it('validates word-problem units and decimal precision', () => {
    const snapshot = makeTypedSnapshot('word-problem')
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        acceptedAnswerRule: {
          kind: 'word-problem',
          values: [{ value: 12.5 }],
          unitRequired: true,
          decimalPlaces: 1,
        },
      }),
    ).toThrow('必须包含单位')
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        standardAnswer: { kind: 'word-problem', value: 12.5 },
      }),
    ).toThrow('标准答案不在可接受答案中')
  })

  it('distinguishes simplest fractions from equivalent fractions', () => {
    const equivalent: QuestionSnapshot = {
      ...makeSnapshot(),
      type: 'fraction',
      standardAnswer: { kind: 'fraction', numerator: 2, denominator: 4 },
      acceptedAnswerRule: {
        kind: 'fraction',
        values: [{ numerator: 1, denominator: 2 }],
        requireSimplest: false,
      },
      errorCauseRules: [],
    }
    expect(parseQuestionSnapshot(equivalent)).toEqual(equivalent)
    expect(() =>
      parseQuestionSnapshot({
        ...equivalent,
        acceptedAnswerRule: {
          kind: 'fraction',
          values: [{ numerator: 2, denominator: 4 }],
          requireSimplest: true,
        },
      }),
    ).toThrow('最简分数')
    expect(() =>
      parseQuestionSnapshot({
        ...equivalent,
        standardAnswer: { kind: 'fraction', numerator: 1, denominator: 0 },
      }),
    ).toThrow('分母不能为 0')
  })

  it('validates blank trimming and English answer normalization specifications', () => {
    const blanks = makeTypedSnapshot('fill-blanks')
    const trimmed = {
      ...blanks,
      standardAnswer: { kind: 'fill-blanks', values: [' 12 ', ' 二十 '] },
    }
    expect(parseQuestionSnapshot(trimmed)).toEqual(trimmed)
    expect(() =>
      parseQuestionSnapshot({
        ...trimmed,
        acceptedAnswerRule: { ...blanks.acceptedAnswerRule, trimWhitespace: false },
      }),
    ).toThrow('标准答案不在可接受答案中')

    const spelling = {
      ...makeTypedSnapshot('english-spelling'),
      standardAnswer: { kind: 'english-spelling', value: "  Can't  " },
      acceptedAnswerRule: {
        kind: 'english-spelling',
        values: ["can't"],
        caseSensitive: false,
      },
    }
    expect(parseQuestionSnapshot(spelling)).toEqual(spelling)
    expect(() =>
      parseQuestionSnapshot({
        ...spelling,
        acceptedAnswerRule: { ...spelling.acceptedAnswerRule, caseSensitive: true },
      }),
    ).toThrow('标准答案不在可接受答案中')

    const sentence = {
      ...makeTypedSnapshot('sentence-completion'),
      standardAnswer: {
        kind: 'sentence-completion',
        values: ['  I   can’t   swim!  ', 'He  likes  it.'],
      },
      acceptedAnswerRule: {
        kind: 'sentence-completion',
        values: [["I can't swim"], ['he likes it']],
        caseSensitive: false,
        ignoreTerminalPunctuation: true,
      },
    }
    expect(parseQuestionSnapshot(sentence)).toEqual(sentence)
    expect(() =>
      parseQuestionSnapshot({
        ...sentence,
        acceptedAnswerRule: { ...sentence.acceptedAnswerRule, caseSensitive: true },
      }),
    ).toThrow('标准答案不在可接受答案中')
    expect(() =>
      parseQuestionSnapshot({
        ...sentence,
        acceptedAnswerRule: { ...sentence.acceptedAnswerRule, ignoreTerminalPunctuation: false },
      }),
    ).toThrow('标准答案不在可接受答案中')
  })

  it('validates template variant groups and snapshot variant references', () => {
    const template = { ...makeTemplate(), variantGroupId: 'multiplication-variant-a' }
    const snapshot = {
      ...makeSnapshot(),
      variantOf: { templateId: 'template-original', instanceId: 'instance-original' },
    }
    expect(parseQuestionTemplate(template)).toEqual(template)
    expect(parseQuestionSnapshot(snapshot)).toEqual(snapshot)
    expect(() => parseQuestionTemplate({ ...template, variantGroupId: '' })).toThrow(
      'variantGroupId',
    )
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        variantOf: { templateId: '', instanceId: 'instance-original' },
      }),
    ).toThrow('variantOf.templateId')
  })

  it.each([
    ['templateId', 'templateId'],
    ['templateVersion', 'templateVersion'],
    ['instanceId', 'instanceId'],
    ['seed', 'seed'],
    ['classification', 'classification'],
    ['source', 'source'],
    ['countsTowardNewKnowledge', 'countsTowardNewKnowledge'],
    ['type', 'type'],
    ['difficulty', 'difficulty'],
    ['prompt', 'prompt'],
    ['resources', 'resources'],
    ['standardAnswer', 'standardAnswer'],
    ['acceptedAnswerRule', 'acceptedAnswerRule'],
    ['errorCauseRules', 'errorCauseRules'],
    ['hints', 'hints'],
    ['explanationSteps', 'explanationSteps'],
    ['retestKnowledgePointIds', 'retestKnowledgePointIds'],
    ['participatesInTask', 'participatesInTask'],
    ['rewardEligible', 'rewardEligible'],
  ])('rejects a missing required field: %s', (field) => {
    const snapshot = makeSnapshot() as unknown as Record<string, unknown>
    delete snapshot[field]
    expect(() => parseQuestionSnapshot(snapshot)).toThrow(ContentValidationError)
  })

  it('rejects inconsistent answers, resources and correction content', () => {
    const snapshot = makeSnapshot()
    expect(() => parseQuestionSnapshot({ ...snapshot, standardAnswer: { kind: 'other' } })).toThrow(
      '未知答案类型',
    )
    expect(() =>
      parseQuestionSnapshot({ ...snapshot, acceptedAnswerRule: { kind: 'other' } }),
    ).toThrow('未知可接受答案规则')
    expect(() =>
      parseQuestionSnapshot({ ...snapshot, acceptedAnswerRule: { kind: 'number', values: [179] } }),
    ).toThrow('标准答案不在可接受答案中')
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        acceptedAnswerRule: {
          kind: 'quotient-remainder',
          values: [{ quotient: 180, remainder: 0 }],
        },
      }),
    ).toThrow('题型与答案类型不一致')
    expect(() =>
      parseQuestionSnapshot({ ...snapshot, resources: [{ id: 'r', type: 'video', uri: '/v' }] }),
    ).toThrow('未知资源类型')
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        resources: [{ id: 'r', type: 'text', uri: '/r', altText: '' }],
      }),
    ).toThrow('altText')
    expect(() =>
      parseQuestionSnapshot({ ...snapshot, hints: { level1: '', level2: '提示' } }),
    ).toThrow('level1')
    expect(() => parseQuestionSnapshot({ ...snapshot, explanationSteps: [] })).toThrow(
      'explanationSteps',
    )
    expect(() =>
      parseQuestionSnapshot({
        ...snapshot,
        errorCauseRules: [{ id: 'x', label: 'x', feedback: 'x', answers: [] }],
      }),
    ).toThrow('answers')
  })

  it('rejects unknown sources and review questions counted as new knowledge', () => {
    const snapshot = makeSnapshot()
    expect(() => parseQuestionSnapshot({ ...snapshot, source: 'unknown' })).toThrow('未知来源标签')
    expect(() =>
      parseQuestionSnapshot({ ...snapshot, source: 'review', countsTowardNewKnowledge: true }),
    ).toThrow('复习题不计作新知识掌握')
  })

  it('identifies unknown or inconsistent course, unit and knowledge point references', () => {
    const course = makeCourse()
    const snapshot = makeSnapshot()
    const classification = snapshot.classification
    expect(() =>
      parseQuestionSnapshot(
        { ...snapshot, classification: { ...classification, courseId: 'unknown' } },
        course,
      ),
    ).toThrow('课程分类与课程内容不一致')
    expect(() =>
      parseQuestionSnapshot(
        { ...snapshot, classification: { ...classification, unitId: 'unknown' } },
        course,
      ),
    ).toThrow('未知单元')
    expect(() =>
      parseQuestionSnapshot(
        { ...snapshot, classification: { ...classification, knowledgePointId: 'unknown' } },
        course,
      ),
    ).toThrow('未知或不匹配的知识点')
    expect(() =>
      parseQuestionSnapshot(
        { ...snapshot, classification: { ...classification, knowledgePointId: 'kp-2' } },
        course,
      ),
    ).toThrow('未知或不匹配的知识点')
    expect(() =>
      parseQuestionSnapshot({ ...snapshot, retestKnowledgePointIds: ['unknown'] }, course),
    ).toThrow('未知复测知识点')
    expect(() => parseQuestionTemplate({ ...makeTemplate(), difficulty: 'L4' }, course)).toThrow(
      'difficulty',
    )
  })
})

describe('learning record contract', () => {
  it('accepts every shared learning result and optional answer and error cause fields', () => {
    for (const result of LEARNING_RESULTS) {
      const record = { ...makeRecord(), result }
      expect(parseLearningRecord(record)).toEqual(record)
    }
    const withErrorCauses = {
      ...makeRecord(),
      result: 'mastered-after-hint' as const,
      attempts: 2,
      errorCauses: [{ id: 'place-value', label: '部分积错位' }],
    }
    expect(parseLearningRecord(withErrorCauses)).toEqual(withErrorCauses)
    const withoutOptionals = makeRecord()
    delete withoutOptionals.answer
    delete withoutOptionals.settledAt
    expect(parseLearningRecord(withoutOptionals)).toEqual(withoutOptionals)
  })

  it('accepts optional cross-subject classification fields', () => {
    const record: LearningRecord = {
      ...makeRecord(),
      unitId: 'unit-1',
      subject: 'english',
      grade: 5,
      semester: 'spring',
      ability: 'english-vocabulary',
      questionType: 'english-spelling',
      answer: { kind: 'english-spelling', value: 'apple' },
    }
    expect(parseLearningRecord(record)).toEqual(record)
  })

  it.each([
    [{ unitId: '' }, 'unitId'],
    [{ subject: 'science' }, 'subject'],
    [{ grade: 0 }, 'grade'],
    [{ semester: 'summer' }, 'semester'],
    [{ ability: 'unknown' }, 'ability'],
    [{ questionType: 'unknown' }, 'questionType'],
  ])('rejects malformed optional classification fields: %s', (fields, path) => {
    expect(() => parseLearningRecord({ ...makeRecord(), ...fields })).toThrow(path)
  })

  it('rejects unknown results and malformed attempt metadata', () => {
    expect(() => parseLearningRecord({ ...makeRecord(), result: 'unknown' })).toThrow(
      '未知学习结果',
    )
    expect(() => parseLearningRecord({ ...makeRecord(), highestHintLevel: 3 })).toThrow('提示等级')
    expect(() => parseLearningRecord({ ...makeRecord(), attempts: -1 })).toThrow('attempts')
    expect(() =>
      parseLearningRecord({ ...makeRecord(), answer: { kind: 'number', value: Number.NaN } }),
    ).toThrow('answer.value')
    expect(() => parseLearningRecord({ ...makeRecord(), settledAt: Number.NaN })).toThrow(
      'settledAt',
    )
    expect(() => parseLearningRecord({ ...makeRecord(), errorCauses: {} })).toThrow('errorCauses')
    expect(() => parseLearningRecord({ ...makeRecord(), errorCauses: [null] })).toThrow(
      'errorCauses[0]',
    )
    expect(() =>
      parseLearningRecord({ ...makeRecord(), errorCauses: [{ id: 'cause', label: '' }] }),
    ).toThrow('errorCauses[0].label')
  })
})
