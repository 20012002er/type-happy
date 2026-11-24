import { GRADE4_AUTUMN_MATH_COURSE } from '../../src/learning/content/grade4-math'
import { getCourseById } from '../../src/learning/content/course-registry'
import { parseQuestionSnapshot } from '../../src/learning/contracts'
import type {
  AcceptedAnswerRule,
  Answer,
  Course,
  Difficulty,
  ErrorCauseRule,
  QuestionOption,
  QuestionSnapshot,
} from '../../src/learning/types'

export interface QuestionFixtureOptions {
  courseId?: string
  knowledgePointId?: string
  templateId?: string
  instanceId?: string
  seed?: number
  difficulty?: Difficulty
  prompt?: string
  standardAnswer: Answer
  acceptedAnswerRule: AcceptedAnswerRule
  options?: readonly QuestionOption[]
  errorCauseRules?: readonly ErrorCauseRule[]
  hints?: { level1: string; level2: string }
  explanationSteps?: readonly string[]
}

const ENGLISH_COURSE_ID = 'pep-grade4-spring-english'

function fixtureCourse(type: Answer['kind'], courseId?: string): Course {
  if (courseId) {
    const course = getCourseById(courseId)
    if (!course) throw new Error(`未知课程：${courseId}`)
    return course
  }
  if (type === 'english-spelling' || type === 'sentence-completion') {
    const course = getCourseById(ENGLISH_COURSE_ID)
    if (!course) throw new Error('英语课程未注册')
    return course
  }
  return GRADE4_AUTUMN_MATH_COURSE
}

export function buildQuestionFixture(options: QuestionFixtureOptions): QuestionSnapshot {
  const course = fixtureCourse(options.standardAnswer.kind, options.courseId)
  const point = options.knowledgePointId
    ? course.knowledgePoints.find((item) => item.id === options.knowledgePointId)
    : course.knowledgePoints[0]
  if (!point) throw new Error('夹具知识点不存在')
  const snapshot: QuestionSnapshot = {
    templateId: options.templateId ?? `fixture-${options.standardAnswer.kind}-v1`,
    templateVersion: 1,
    instanceId: options.instanceId ?? `fixture-${options.standardAnswer.kind}-instance`,
    seed: options.seed ?? 42,
    classification: {
      courseId: course.id,
      subject: course.subject,
      grade: course.grade,
      semester: course.semester,
      textbook: course.textbook,
      unitId: point.unitId,
      knowledgePointId: point.id,
      ability: point.ability,
    },
    source: point.source,
    countsTowardNewKnowledge: point.source !== 'review',
    type: options.standardAnswer.kind,
    difficulty: options.difficulty ?? 'L1',
    prompt: options.prompt ?? '夹具题目',
    resources: [],
    options: options.options,
    standardAnswer: options.standardAnswer,
    acceptedAnswerRule: options.acceptedAnswerRule,
    errorCauseRules: options.errorCauseRules ?? [],
    hints: options.hints ?? {
      level1: '先回顾题目中的已知条件和数量关系',
      level2: '先确定先求什么，再检查每一步计算和单位',
    },
    explanationSteps: options.explanationSteps ?? ['找出已知条件', '列式计算并检查结果'],
    retestKnowledgePointIds: [point.id],
    participatesInTask: true,
    rewardEligible: true,
  }
  return parseQuestionSnapshot(snapshot, course)
}

export const CHOICE_OPTIONS: readonly QuestionOption[] = [
  { id: 'opt-a', text: '选项甲' },
  { id: 'opt-b', text: '选项乙' },
  { id: 'opt-c', text: '选项丙' },
  { id: 'opt-d', text: '选项丁' },
]

export function buildChoiceFixture(
  overrides: Partial<QuestionFixtureOptions> = {},
): QuestionSnapshot {
  return buildQuestionFixture({
    templateId: 'fixture-choice-v1',
    instanceId: 'fixture-choice-instance',
    prompt: '下面关于乘法交换律的说法，哪一个是正确的？',
    standardAnswer: { kind: 'single-choice', optionId: 'opt-b' },
    acceptedAnswerRule: { kind: 'single-choice', values: ['opt-b'] },
    options: CHOICE_OPTIONS,
    ...overrides,
  })
}
