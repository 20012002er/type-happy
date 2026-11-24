import {
  LEARNING_ABILITIES,
  LEARNING_RESULTS,
  QUESTION_TYPES,
  SUBJECTS,
  type AcceptedAnswerRule,
  type Answer,
  type ContentClassification,
  type Course,
  type KnowledgePoint,
  type LearningAbility,
  type LearningRecord,
  type QuestionOption,
  type QuestionSnapshot,
  type QuestionTemplate,
  type QuestionType,
  type Subject,
} from './types'
import { normalizeEnglishSentence, normalizeEnglishSpelling } from './normalize-text'

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
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new ContentValidationError(path, `必须是大于等于 ${minimum} 的整数`)
  }
  return value
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContentValidationError(path, '必须是有限数字')
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

function expectSubject(value: unknown, path: string): Subject {
  if (!SUBJECTS.includes(value as Subject)) {
    throw new ContentValidationError(path, '未知学科')
  }
  return value as Subject
}

function expectAbility(value: unknown, path: string): LearningAbility {
  if (!LEARNING_ABILITIES.includes(value as LearningAbility)) {
    throw new ContentValidationError(path, '未知学习能力')
  }
  return value as LearningAbility
}

function expectQuestionType(value: unknown, path: string): QuestionType {
  if (!QUESTION_TYPES.includes(value as QuestionType)) {
    throw new ContentValidationError(path, '未知题型')
  }
  return value as QuestionType
}

function expectClassification(value: unknown, path: string): ContentClassification {
  const classification = expectRecord(value, path)
  expectString(classification.courseId, `${path}.courseId`)
  expectSubject(classification.subject, `${path}.subject`)
  expectInteger(classification.grade, `${path}.grade`, 1)
  expectSemester(classification.semester, `${path}.semester`)
  expectString(classification.textbook, `${path}.textbook`)
  expectString(classification.unitId, `${path}.unitId`)
  expectString(classification.knowledgePointId, `${path}.knowledgePointId`)
  if (classification.ability !== undefined) {
    expectAbility(classification.ability, `${path}.ability`)
  }
  return classification as unknown as ContentClassification
}

function expectSignedInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ContentValidationError(path, '必须是安全整数')
  }
  return value
}

function expectStringValues(value: unknown, path: string, minimumLength = 1): string[] {
  return expectArray(value, path, minimumLength).map((item, index) =>
    expectString(item, `${path}[${index}]`),
  )
}

function expectBlankRule(value: unknown, path: string): void {
  expectArray(value, path, 1).forEach((blank, blankIndex) => {
    expectStringValues(blank, `${path}[${blankIndex}]`)
  })
}

function expectFractionValue(value: unknown, path: string): void {
  const fraction = expectRecord(value, path)
  expectSignedInteger(fraction.numerator, `${path}.numerator`)
  const denominator = expectSignedInteger(fraction.denominator, `${path}.denominator`)
  if (denominator === 0) throw new ContentValidationError(`${path}.denominator`, '分母不能为 0')
}

function expectAnswer(value: unknown, path: string): Answer {
  const answer = expectRecord(value, path)
  if (answer.kind === 'number') {
    expectNumber(answer.value, `${path}.value`)
    return answer as Answer
  }
  if (answer.kind === 'quotient-remainder') {
    expectInteger(answer.quotient, `${path}.quotient`)
    expectInteger(answer.remainder, `${path}.remainder`)
    return answer as Answer
  }
  if (answer.kind === 'fill-blanks' || answer.kind === 'sentence-completion') {
    expectStringValues(answer.values, `${path}.values`)
    return answer as Answer
  }
  if (answer.kind === 'single-choice') {
    expectString(answer.optionId, `${path}.optionId`)
    return answer as Answer
  }
  if (answer.kind === 'word-problem') {
    expectNumber(answer.value, `${path}.value`)
    if (answer.unit !== undefined) expectString(answer.unit, `${path}.unit`)
    return answer as Answer
  }
  if (answer.kind === 'fraction') {
    expectFractionValue(answer, path)
    return answer as Answer
  }
  if (answer.kind === 'english-spelling') {
    expectString(answer.value, `${path}.value`)
    return answer as Answer
  }
  throw new ContentValidationError(`${path}.kind`, '未知答案类型')
}

export function parseAnswer(value: unknown): Answer {
  return expectAnswer(value, 'answer')
}

function expectAnswerRule(value: unknown, path: string): AcceptedAnswerRule {
  const rule = expectRecord(value, path)
  if (rule.kind === 'number') {
    expectArray(rule.values, `${path}.values`, 1).forEach((item, index) =>
      expectNumber(item, `${path}.values[${index}]`),
    )
    if (rule.allowNegative !== undefined) {
      expectBoolean(rule.allowNegative, `${path}.allowNegative`)
    }
    if (rule.allowDecimal !== undefined) expectBoolean(rule.allowDecimal, `${path}.allowDecimal`)
    if (rule.decimalPlaces !== undefined) {
      expectInteger(rule.decimalPlaces, `${path}.decimalPlaces`)
    }
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'quotient-remainder') {
    expectArray(rule.values, `${path}.values`, 1).forEach((item, index) => {
      const candidate = expectRecord(item, `${path}.values[${index}]`)
      expectInteger(candidate.quotient, `${path}.values[${index}].quotient`)
      expectInteger(candidate.remainder, `${path}.values[${index}].remainder`)
    })
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'fill-blanks') {
    expectBlankRule(rule.values, `${path}.values`)
    expectBoolean(rule.trimWhitespace, `${path}.trimWhitespace`)
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'single-choice') {
    const values = expectStringValues(rule.values, `${path}.values`)
    if (values.length !== 1) {
      throw new ContentValidationError(`${path}.values`, '单项选择必须有且只有一个可接受答案')
    }
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'word-problem') {
    expectArray(rule.values, `${path}.values`, 1).forEach((item, index) => {
      const candidate = expectRecord(item, `${path}.values[${index}]`)
      expectNumber(candidate.value, `${path}.values[${index}].value`)
      if (candidate.unit !== undefined)
        expectString(candidate.unit, `${path}.values[${index}].unit`)
    })
    expectBoolean(rule.unitRequired, `${path}.unitRequired`)
    if (rule.decimalPlaces !== undefined) expectInteger(rule.decimalPlaces, `${path}.decimalPlaces`)
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'fraction') {
    expectArray(rule.values, `${path}.values`, 1).forEach((item, index) =>
      expectFractionValue(item, `${path}.values[${index}]`),
    )
    expectBoolean(rule.requireSimplest, `${path}.requireSimplest`)
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'english-spelling') {
    expectStringValues(rule.values, `${path}.values`)
    expectBoolean(rule.caseSensitive, `${path}.caseSensitive`)
    return rule as AcceptedAnswerRule
  }
  if (rule.kind === 'sentence-completion') {
    expectBlankRule(rule.values, `${path}.values`)
    expectBoolean(rule.caseSensitive, `${path}.caseSensitive`)
    expectBoolean(rule.ignoreTerminalPunctuation, `${path}.ignoreTerminalPunctuation`)
    return rule as AcceptedAnswerRule
  }
  throw new ContentValidationError(`${path}.kind`, '未知可接受答案规则')
}

function assertDecimalPlaces(value: number, decimalPlaces: number | undefined, path: string): void {
  if (decimalPlaces !== undefined && Number(value.toFixed(decimalPlaces)) !== value) {
    throw new ContentValidationError(path, `最多保留 ${decimalPlaces} 位小数`)
  }
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function assertStandardAnswerAccepted(answer: Answer, rule: AcceptedAnswerRule): void {
  let accepted = false
  if (rule.kind === 'number' && answer.kind === 'number') {
    for (const value of rule.values) {
      if (!rule.allowNegative && value < 0) {
        throw new ContentValidationError(
          'questionSnapshot.acceptedAnswerRule.values',
          '数值答案不能为负数',
        )
      }
      if (!rule.allowDecimal && !Number.isInteger(value)) {
        throw new ContentValidationError(
          'questionSnapshot.acceptedAnswerRule.values',
          '数值答案必须为整数',
        )
      }
      assertDecimalPlaces(value, rule.decimalPlaces, 'questionSnapshot.acceptedAnswerRule.values')
    }
    accepted = rule.values.includes(answer.value)
  } else if (rule.kind === 'quotient-remainder' && answer.kind === 'quotient-remainder') {
    accepted = rule.values.some(
      (value) => value.quotient === answer.quotient && value.remainder === answer.remainder,
    )
  } else if (rule.kind === 'fill-blanks' && answer.kind === 'fill-blanks') {
    const normalize = (value: string) => (rule.trimWhitespace ? value.trim() : value)
    accepted =
      answer.values.length === rule.values.length &&
      answer.values.every((value, index) =>
        rule.values[index].some((candidate) => normalize(candidate) === normalize(value)),
      )
  } else if (rule.kind === 'single-choice' && answer.kind === 'single-choice') {
    accepted = rule.values.includes(answer.optionId)
  } else if (rule.kind === 'word-problem' && answer.kind === 'word-problem') {
    for (const value of rule.values) {
      if (rule.unitRequired && !value.unit) {
        throw new ContentValidationError(
          'questionSnapshot.acceptedAnswerRule.values',
          '应用题答案必须包含单位',
        )
      }
      assertDecimalPlaces(
        value.value,
        rule.decimalPlaces,
        'questionSnapshot.acceptedAnswerRule.values',
      )
    }
    accepted = rule.values.some(
      (value) => value.value === answer.value && value.unit === answer.unit,
    )
  } else if (rule.kind === 'fraction' && answer.kind === 'fraction') {
    if (rule.requireSimplest) {
      for (const value of rule.values) {
        if (
          value.denominator < 1 ||
          greatestCommonDivisor(value.numerator, value.denominator) !== 1
        ) {
          throw new ContentValidationError(
            'questionSnapshot.acceptedAnswerRule.values',
            '分数答案必须使用正分母的最简分数',
          )
        }
      }
    }
    accepted = rule.values.some((value) =>
      rule.requireSimplest
        ? value.numerator === answer.numerator && value.denominator === answer.denominator
        : value.numerator * answer.denominator === answer.numerator * value.denominator,
    )
  } else if (rule.kind === 'english-spelling' && answer.kind === 'english-spelling') {
    const normalize = (value: string) => normalizeEnglishSpelling(value, rule.caseSensitive)
    accepted = rule.values.some((value) => normalize(value) === normalize(answer.value))
  } else if (rule.kind === 'sentence-completion' && answer.kind === 'sentence-completion') {
    accepted =
      answer.values.length === rule.values.length &&
      answer.values.every((value, index) => {
        const normalized = normalizeEnglishSentence(
          value,
          rule.caseSensitive,
          rule.ignoreTerminalPunctuation,
        )
        return rule.values[index].some(
          (candidate) =>
            normalizeEnglishSentence(
              candidate,
              rule.caseSensitive,
              rule.ignoreTerminalPunctuation,
            ) === normalized,
        )
      })
  }
  if (!accepted) {
    throw new ContentValidationError('questionSnapshot.standardAnswer', '标准答案不在可接受答案中')
  }
}

function expectOptions(value: unknown, path: string, required: boolean): QuestionOption[] {
  const options = expectArray(value, path)
  if (required && options.length !== 4) {
    throw new ContentValidationError(path, '单项选择必须恰好包含四个选项')
  }
  const ids = new Set<string>()
  options.forEach((item, index) => {
    const option = expectRecord(item, `${path}[${index}]`)
    const id = expectString(option.id, `${path}[${index}].id`)
    expectString(option.text, `${path}[${index}].text`)
    if (ids.has(id)) throw new ContentValidationError(`${path}[${index}].id`, '选项 ID 重复')
    ids.add(id)
  })
  return options as QuestionOption[]
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
  if (point.ability !== undefined) expectAbility(point.ability, 'knowledgePoint.ability')
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
  expectSubject(course.subject, 'course.subject')
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
  const type = expectQuestionType(template.type, 'questionTemplate.type')
  expectDifficulty(template.difficulty, 'questionTemplate.difficulty')
  expectString(template.promptTemplate, 'questionTemplate.promptTemplate')
  if (template.options !== undefined || type === 'single-choice') {
    expectOptions(template.options, 'questionTemplate.options', type === 'single-choice')
  }
  if (template.variantGroupId !== undefined) {
    expectString(template.variantGroupId, 'questionTemplate.variantGroupId')
  }
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
    if (resource.type === 'image' || resource.altText !== undefined) {
      expectString(resource.altText, `questionSnapshot.resources[${index}].altText`)
    }
  })
  const options =
    snapshot.options !== undefined || snapshot.type === 'single-choice'
      ? expectOptions(
          snapshot.options,
          'questionSnapshot.options',
          snapshot.type === 'single-choice',
        )
      : undefined
  if (snapshot.variantOf !== undefined) {
    const variant = expectRecord(snapshot.variantOf, 'questionSnapshot.variantOf')
    expectString(variant.templateId, 'questionSnapshot.variantOf.templateId')
    expectString(variant.instanceId, 'questionSnapshot.variantOf.instanceId')
  }

  const answer = expectAnswer(snapshot.standardAnswer, 'questionSnapshot.standardAnswer')
  const answerRule = expectAnswerRule(
    snapshot.acceptedAnswerRule,
    'questionSnapshot.acceptedAnswerRule',
  )
  if (answer.kind !== snapshot.type || answerRule.kind !== snapshot.type) {
    throw new ContentValidationError('questionSnapshot.type', '题型与答案类型不一致')
  }
  assertStandardAnswerAccepted(answer, answerRule)
  if (answerRule.kind === 'single-choice' && answer.kind === 'single-choice') {
    const optionIds = new Set(options?.map((option) => option.id))
    if (!optionIds.has(answer.optionId) || answerRule.values.some((id) => !optionIds.has(id))) {
      throw new ContentValidationError(
        'questionSnapshot.standardAnswer.optionId',
        '答案引用了未知选项',
      )
    }
  }

  const causes = expectArray(snapshot.errorCauseRules, 'questionSnapshot.errorCauseRules')
  causes.forEach((item, index) => {
    const cause = expectRecord(item, `questionSnapshot.errorCauseRules[${index}]`)
    expectString(cause.id, `questionSnapshot.errorCauseRules[${index}].id`)
    expectString(cause.label, `questionSnapshot.errorCauseRules[${index}].label`)
    expectString(cause.feedback, `questionSnapshot.errorCauseRules[${index}].feedback`)
    expectArray(cause.answers, `questionSnapshot.errorCauseRules[${index}].answers`, 1).forEach(
      (candidate, answerIndex) => {
        const causeAnswer = expectAnswer(
          candidate,
          `questionSnapshot.errorCauseRules[${index}].answers[${answerIndex}]`,
        )
        if (causeAnswer.kind !== snapshot.type) {
          throw new ContentValidationError(
            `questionSnapshot.errorCauseRules[${index}].answers[${answerIndex}].kind`,
            '错因答案与题型不一致',
          )
        }
      },
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
  if (record.unitId !== undefined) expectString(record.unitId, 'learningRecord.unitId')
  expectString(record.knowledgePointId, 'learningRecord.knowledgePointId')
  if (record.subject !== undefined) expectSubject(record.subject, 'learningRecord.subject')
  if (record.grade !== undefined) expectInteger(record.grade, 'learningRecord.grade', 1)
  if (record.semester !== undefined) expectSemester(record.semester, 'learningRecord.semester')
  if (record.ability !== undefined) expectAbility(record.ability, 'learningRecord.ability')
  if (record.questionType !== undefined) {
    expectQuestionType(record.questionType, 'learningRecord.questionType')
  }
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
