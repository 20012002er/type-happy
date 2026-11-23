import {
  LEARNING_RESULTS,
  type AcceptedAnswerRule,
  type Answer,
  type ContentClassification,
  type Course,
  type KnowledgePoint,
  type LearningRecord,
  type QuestionSnapshot,
  type QuestionTemplate,
} from './types'

export class ContentValidationError extends Error {
  readonly path: string

  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`)
    this.name = 'ContentValidationError'
    this.path = path
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContentValidationError(path, '必须是对象')
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContentValidationError(path, '必须是非空字符串')
  }
  return value
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ContentValidationError(path, '必须是布尔值')
  }
  return value
}

function expectInteger(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw new ContentValidationError(path, `必须是大于等于 ${minimum} 的整数`)
  }
  return value
}

function expectArray(value: unknown, path: string, minimumLength = 0): unknown[] {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new ContentValidationError(path, `必须是至少包含 ${minimumLength} 项的数组`)
  }
  return value
}

function expectSemester(value: unknown, path: string): void {
  if (value !== 'autumn' && value !== 'spring') {
    throw new ContentValidationError(path, '必须是 autumn 或 spring')
  }
}

function expectDifficulty(value: unknown, path: string): void {
  if (value !== 'L1' && value !== 'L2' && value !== 'L3') {
    throw new ContentValidationError(path, '必须是 L1、L2 或 L3')
  }
}

function expectQuestionType(value: unknown, path: string): void {
  if (value !== 'number' && value !== 'quotient-remainder') {
    throw new ContentValidationError(path, '未知题型')
  }
}

function expectClassification(value: unknown, path: string): ContentClassification {
  const classification = expectRecord(value, path)
  expectString(classification.courseId, `${path}.courseId`)
  expectString(classification.subject, `${path}.subject`)
  expectInteger(classification.grade, `${path}.grade`, 1)
  expectSemester(classification.semester, `${path}.semester`)
  expectString(classification.textbook, `${path}.textbook`)
  expectString(classification.unitId, `${path}.unitId`)
  expectString(classification.knowledgePointId, `${path}.knowledgePointId`)
  return classification as unknown as ContentClassification
}

function expectAnswer(value: unknown, path: string): Answer {
  const answer = expectRecord(value, path)
  if (answer.kind === 'number') {
    expectInteger(answer.value, `${path}.value`)
    return answer as Answer
  }
  if (answer.kind === 'quotient-remainder') {
    expectInteger(answer.quotient, `${path}.quotient`)
    expectInteger(answer.remainder, `${path}.remainder`)
    return answer as Answer
  }
  throw new ContentValidationError(`${path}.kind`, '未知答案类型')
}

export function parseAnswer(value: unknown): Answer {
  return expectAnswer(value, 'answer')
}

function answersEqual(left: Answer, right: Answer): boolean {
  if (left.kind === 'number' && right.kind === 'number') return left.value === right.value
  if (left.kind === 'quotient-remainder' && right.kind === 'quotient-remainder') {
    return left.quotient === right.quotient && left.remainder === right.remainder
  }
  return false
}

function expectAnswerRule(value: unknown, path: string): AcceptedAnswerRule {
  const rule = expectRecord(value, path)
  if (rule.kind === 'number') {
    const values = expectArray(rule.values, `${path}.values`, 1)
    values.forEach((item, index) => expectInteger(item, `${path}.values[${index}]`))
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'quotient-remainder') {
    const values = expectArray(rule.values, `${path}.values`, 1)
    values.forEach((item, index) => {
      const candidate = expectRecord(item, `${path}.values[${index}]`)
      expectInteger(candidate.quotient, `${path}.values[${index}].quotient`)
      expectInteger(candidate.remainder, `${path}.values[${index}].remainder`)
    })
    return rule as AcceptedAnswerRule
  }
  throw new ContentValidationError(`${path}.kind`, '未知可接受答案规则')
}

function assertCourseReference(classification: ContentClassification, course: Course): void {
  if (
    classification.courseId !== course.id ||
    classification.subject !== course.subject ||
    classification.grade !== course.grade ||
    classification.semester !== course.semester ||
    classification.textbook !== course.textbook
  ) {
    throw new ContentValidationError('classification', '课程分类与课程内容不一致')
  }
  if (!course.units.some((unit) => unit.id === classification.unitId)) {
    throw new ContentValidationError('classification.unitId', '未知单元')
  }
  const knowledgePoint = course.knowledgePoints.find(
    (item) => item.id === classification.knowledgePointId,
  )
  if (!knowledgePoint || knowledgePoint.unitId !== classification.unitId) {
    throw new ContentValidationError('classification.knowledgePointId', '未知或不匹配的知识点')
  }
}

export function parseKnowledgePoint(value: unknown, course?: Course): KnowledgePoint {
  const point = expectRecord(value, 'knowledgePoint')
  expectString(point.id, 'knowledgePoint.id')
  expectString(point.courseId, 'knowledgePoint.courseId')
  expectString(point.unitId, 'knowledgePoint.unitId')
  expectString(point.name, 'knowledgePoint.name')
  if (point.source !== 'new-pep' && point.source !== 'old-pep' && point.source !== 'review') {
    throw new ContentValidationError('knowledgePoint.source', '未知来源标签')
  }
  if (course) {
    if (point.courseId !== course.id || !course.units.some((unit) => unit.id === point.unitId)) {
      throw new ContentValidationError('knowledgePoint', '知识点不属于指定课程或单元')
    }
  }
  return point as unknown as KnowledgePoint
}

export function parseCourse(value: unknown): Course {
  const course = expectRecord(value, 'course')
  expectString(course.id, 'course.id')
  expectInteger(course.version, 'course.version', 1)
  expectString(course.title, 'course.title')
  expectString(course.subject, 'course.subject')
  expectInteger(course.grade, 'course.grade', 1)
  expectSemester(course.semester, 'course.semester')
  expectString(course.textbook, 'course.textbook')
  const units = expectArray(course.units, 'course.units', 1)
  const unitIds = new Set<string>()
  units.forEach((item, index) => {
    const unit = expectRecord(item, `course.units[${index}]`)
    const id = expectString(unit.id, `course.units[${index}].id`)
    expectString(unit.title, `course.units[${index}].title`)
    expectInteger(unit.order, `course.units[${index}].order`, 1)
    if (unitIds.has(id))
      throw new ContentValidationError(`course.units[${index}].id`, '单元 ID 重复')
    unitIds.add(id)
  })
  const points = expectArray(course.knowledgePoints, 'course.knowledgePoints', 1)
  const pointIds = new Set<string>()
  const parsed = course as unknown as Course
  points.forEach((item, index) => {
    const point = parseKnowledgePoint(item, parsed)
    if (pointIds.has(point.id)) {
      throw new ContentValidationError(`course.knowledgePoints[${index}].id`, '知识点 ID 重复')
    }
    pointIds.add(point.id)
  })
  return parsed
}

export function parseQuestionTemplate(value: unknown, course?: Course): QuestionTemplate {
  const template = expectRecord(value, 'questionTemplate')
  expectString(template.id, 'questionTemplate.id')
  expectInteger(template.version, 'questionTemplate.version', 1)
  const classification = expectClassification(
    template.classification,
    'questionTemplate.classification',
  )
  expectQuestionType(template.type, 'questionTemplate.type')
  expectDifficulty(template.difficulty, 'questionTemplate.difficulty')
  expectString(template.promptTemplate, 'questionTemplate.promptTemplate')
  if (course) assertCourseReference(classification, course)
  return template as unknown as QuestionTemplate
}

export function parseQuestionSnapshot(value: unknown, course?: Course): QuestionSnapshot {
  const snapshot = expectRecord(value, 'questionSnapshot')
  expectString(snapshot.templateId, 'questionSnapshot.templateId')
  expectInteger(snapshot.templateVersion, 'questionSnapshot.templateVersion', 1)
  expectString(snapshot.instanceId, 'questionSnapshot.instanceId')
  expectInteger(snapshot.seed, 'questionSnapshot.seed')
  const classification = expectClassification(
    snapshot.classification,
    'questionSnapshot.classification',
  )
  if (
    snapshot.source !== 'new-pep' &&
    snapshot.source !== 'old-pep' &&
    snapshot.source !== 'review'
  ) {
    throw new ContentValidationError('questionSnapshot.source', '未知来源标签')
  }
  expectBoolean(snapshot.countsTowardNewKnowledge, 'questionSnapshot.countsTowardNewKnowledge')
  if (snapshot.source === 'review' && snapshot.countsTowardNewKnowledge) {
    throw new ContentValidationError(
      'questionSnapshot.countsTowardNewKnowledge',
      '复习题不计作新知识掌握',
    )
  }
  expectQuestionType(snapshot.type, 'questionSnapshot.type')
  expectDifficulty(snapshot.difficulty, 'questionSnapshot.difficulty')
  expectString(snapshot.prompt, 'questionSnapshot.prompt')

  const resources = expectArray(snapshot.resources, 'questionSnapshot.resources')
  resources.forEach((item, index) => {
    const resource = expectRecord(item, `questionSnapshot.resources[${index}]`)
    expectString(resource.id, `questionSnapshot.resources[${index}].id`)
    if (resource.type !== 'image' && resource.type !== 'audio' && resource.type !== 'text') {
      throw new ContentValidationError(`questionSnapshot.resources[${index}].type`, '未知资源类型')
    }
    expectString(resource.uri, `questionSnapshot.resources[${index}].uri`)
    if (resource.altText !== undefined)
      expectString(resource.altText, `questionSnapshot.resources[${index}].altText`)
  })

  const answer = expectAnswer(snapshot.standardAnswer, 'questionSnapshot.standardAnswer')
  const answerRule = expectAnswerRule(
    snapshot.acceptedAnswerRule,
    'questionSnapshot.acceptedAnswerRule',
  )
  if (answer.kind !== snapshot.type || answerRule.kind !== snapshot.type) {
    throw new ContentValidationError('questionSnapshot.type', '题型与答案类型不一致')
  }
  const acceptedAnswers: readonly Answer[] =
    answerRule.kind === 'number'
      ? answerRule.values.map((value) => ({ kind: 'number', value }))
      : answerRule.values.map((value) => ({ kind: 'quotient-remainder', ...value }))
  if (!acceptedAnswers.some((candidate) => answersEqual(candidate, answer))) {
    throw new ContentValidationError('questionSnapshot.standardAnswer', '标准答案不在可接受答案中')
  }

  const causes = expectArray(snapshot.errorCauseRules, 'questionSnapshot.errorCauseRules')
  causes.forEach((item, index) => {
    const cause = expectRecord(item, `questionSnapshot.errorCauseRules[${index}]`)
    expectString(cause.id, `questionSnapshot.errorCauseRules[${index}].id`)
    expectString(cause.label, `questionSnapshot.errorCauseRules[${index}].label`)
    expectString(cause.feedback, `questionSnapshot.errorCauseRules[${index}].feedback`)
    expectArray(cause.answers, `questionSnapshot.errorCauseRules[${index}].answers`, 1).forEach(
      (candidate, answerIndex) =>
        expectAnswer(
          candidate,
          `questionSnapshot.errorCauseRules[${index}].answers[${answerIndex}]`,
        ),
    )
  })

  const hints = expectRecord(snapshot.hints, 'questionSnapshot.hints')
  expectString(hints.level1, 'questionSnapshot.hints.level1')
  expectString(hints.level2, 'questionSnapshot.hints.level2')
  expectArray(snapshot.explanationSteps, 'questionSnapshot.explanationSteps', 1).forEach(
    (step, index) => expectString(step, `questionSnapshot.explanationSteps[${index}]`),
  )
  const retestIds = expectArray(
    snapshot.retestKnowledgePointIds,
    'questionSnapshot.retestKnowledgePointIds',
    1,
  )
  retestIds.forEach((id, index) =>
    expectString(id, `questionSnapshot.retestKnowledgePointIds[${index}]`),
  )
  expectBoolean(snapshot.participatesInTask, 'questionSnapshot.participatesInTask')
  expectBoolean(snapshot.rewardEligible, 'questionSnapshot.rewardEligible')

  if (course) {
    assertCourseReference(classification, course)
    for (const id of retestIds) {
      if (!course.knowledgePoints.some((point) => point.id === id)) {
        throw new ContentValidationError(
          'questionSnapshot.retestKnowledgePointIds',
          '包含未知复测知识点',
        )
      }
    }
  }
  return snapshot as unknown as QuestionSnapshot
}

function expectErrorCauses(value: unknown, path: string): void {
  const causes = expectArray(value, path)
  causes.forEach((item, index) => {
    const cause = expectRecord(item, `${path}[${index}]`)
    expectString(cause.id, `${path}[${index}].id`)
    expectString(cause.label, `${path}[${index}].label`)
  })
}

export function parseLearningRecord(value: unknown): LearningRecord {
  const record = expectRecord(value, 'learningRecord')
  expectString(record.id, 'learningRecord.id')
  expectString(record.questionInstanceId, 'learningRecord.questionInstanceId')
  expectString(record.templateId, 'learningRecord.templateId')
  expectInteger(record.templateVersion, 'learningRecord.templateVersion', 1)
  expectString(record.courseId, 'learningRecord.courseId')
  expectString(record.knowledgePointId, 'learningRecord.knowledgePointId')
  if (!LEARNING_RESULTS.includes(record.result as (typeof LEARNING_RESULTS)[number])) {
    throw new ContentValidationError('learningRecord.result', '未知学习结果')
  }
  if (record.answer !== undefined) expectAnswer(record.answer, 'learningRecord.answer')
  if (record.errorCauses !== undefined) {
    expectErrorCauses(record.errorCauses, 'learningRecord.errorCauses')
  }
  expectInteger(record.attempts, 'learningRecord.attempts')
  if (
    record.highestHintLevel !== 0 &&
    record.highestHintLevel !== 1 &&
    record.highestHintLevel !== 2
  ) {
    throw new ContentValidationError('learningRecord.highestHintLevel', '提示等级必须是 0、1 或 2')
  }
  expectBoolean(record.explanationViewed, 'learningRecord.explanationViewed')
  expectInteger(record.startedAt, 'learningRecord.startedAt')
  if (record.settledAt !== undefined) expectInteger(record.settledAt, 'learningRecord.settledAt')
  return record as unknown as LearningRecord
}
