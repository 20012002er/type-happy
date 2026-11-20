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
  type Course,
  type LearningRecord,
  type QuestionSnapshot,
  type QuestionTemplate,
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
  it('accepts every shared learning result and optional answer fields', () => {
    for (const result of LEARNING_RESULTS) {
      const record = { ...makeRecord(), result }
      expect(parseLearningRecord(record)).toEqual(record)
    }
    const withoutOptionals = makeRecord()
    delete withoutOptionals.answer
    delete withoutOptionals.settledAt
    expect(parseLearningRecord(withoutOptionals)).toEqual(withoutOptionals)
  })

  it('rejects unknown results and malformed attempt metadata', () => {
    expect(() => parseLearningRecord({ ...makeRecord(), result: 'unknown' })).toThrow(
      '未知学习结果',
    )
    expect(() => parseLearningRecord({ ...makeRecord(), highestHintLevel: 3 })).toThrow('提示等级')
    expect(() => parseLearningRecord({ ...makeRecord(), attempts: -1 })).toThrow('attempts')
    expect(() =>
      parseLearningRecord({ ...makeRecord(), answer: { kind: 'number', value: -1 } }),
    ).toThrow('answer.value')
    expect(() => parseLearningRecord({ ...makeRecord(), settledAt: Number.NaN })).toThrow(
      'settledAt',
    )
  })
})
