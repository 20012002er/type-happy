export type Semester = 'autumn' | 'spring'
export type Difficulty = 'L1' | 'L2' | 'L3'
export type ContentSource = 'new-pep' | 'old-pep' | 'review'

export const SUBJECTS = ['math', 'english'] as const
export type Subject = (typeof SUBJECTS)[number]

export const LEARNING_ABILITIES = [
  'math-calculation',
  'math-concept',
  'math-application',
  'english-vocabulary',
  'english-sentence-grammar',
  'english-situational',
] as const
export type LearningAbility = (typeof LEARNING_ABILITIES)[number]

export const QUESTION_TYPES = [
  'number',
  'quotient-remainder',
  'fill-blanks',
  'single-choice',
  'word-problem',
  'fraction',
  'english-spelling',
  'sentence-completion',
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export interface CourseUnit {
  id: string
  title: string
  order: number
}

export interface KnowledgePoint {
  id: string
  courseId: string
  unitId: string
  name: string
  source: ContentSource
  ability?: LearningAbility
}

export interface Course {
  id: string
  version: number
  title: string
  subject: Subject
  grade: number
  semester: Semester
  textbook: string
  units: readonly CourseUnit[]
  knowledgePoints: readonly KnowledgePoint[]
}

export interface ContentClassification {
  courseId: string
  subject: Subject
  grade: number
  semester: Semester
  textbook: string
  unitId: string
  knowledgePointId: string
  ability?: LearningAbility
}

export interface QuestionOption {
  id: string
  text: string
}

export interface QuestionTemplate {
  id: string
  version: number
  classification: ContentClassification
  type: QuestionType
  difficulty: Difficulty
  promptTemplate: string
  options?: readonly QuestionOption[]
  variantGroupId?: string
}

export type Answer =
  | { kind: 'number'; value: number }
  | { kind: 'quotient-remainder'; quotient: number; remainder: number }
  | { kind: 'fill-blanks'; values: readonly string[] }
  | { kind: 'single-choice'; optionId: string }
  | { kind: 'word-problem'; value: number; unit?: string }
  | { kind: 'fraction'; numerator: number; denominator: number }
  | { kind: 'english-spelling'; value: string }
  | { kind: 'sentence-completion'; values: readonly string[] }

export type AcceptedAnswerRule =
  | {
      kind: 'number'
      values: readonly number[]
      allowNegative?: boolean
      allowDecimal?: boolean
      decimalPlaces?: number
    }
  | {
      kind: 'quotient-remainder'
      values: readonly { quotient: number; remainder: number }[]
    }
  | {
      kind: 'fill-blanks'
      values: readonly (readonly string[])[]
      trimWhitespace: boolean
    }
  | { kind: 'single-choice'; values: readonly string[] }
  | {
      kind: 'word-problem'
      values: readonly { value: number; unit?: string }[]
      unitRequired: boolean
      decimalPlaces?: number
    }
  | {
      kind: 'fraction'
      values: readonly { numerator: number; denominator: number }[]
      requireSimplest: boolean
    }
  | { kind: 'english-spelling'; values: readonly string[]; caseSensitive: boolean }
  | {
      kind: 'sentence-completion'
      values: readonly (readonly string[])[]
      caseSensitive: boolean
      ignoreTerminalPunctuation: boolean
    }

export interface QuestionResource {
  id: string
  type: 'image' | 'audio' | 'text'
  uri: string
  altText?: string
}

export interface ErrorCause {
  id: string
  label: string
}

export interface ErrorCauseRule extends ErrorCause {
  feedback: string
  answers: readonly Answer[]
}

export interface QuestionHints {
  level1: string
  level2: string
}

export interface QuestionSnapshot {
  templateId: string
  templateVersion: number
  instanceId: string
  seed: number
  classification: ContentClassification
  source: ContentSource
  countsTowardNewKnowledge: boolean
  type: QuestionType
  difficulty: Difficulty
  prompt: string
  resources: readonly QuestionResource[]
  options?: readonly QuestionOption[]
  variantOf?: { templateId: string; instanceId: string }
  standardAnswer: Answer
  acceptedAnswerRule: AcceptedAnswerRule
  errorCauseRules: readonly ErrorCauseRule[]
  hints: QuestionHints
  explanationSteps: readonly string[]
  retestKnowledgePointIds: readonly string[]
  participatesInTask: boolean
  rewardEligible: boolean
}

export const LEARNING_RESULTS = [
  'first-correct',
  'awaiting-correction',
  'mastered-after-hint',
  'corrected-awaiting-retest',
  'abandoned',
  'content-error',
] as const

export type LearningResult = (typeof LEARNING_RESULTS)[number]

export interface LearningRecord {
  id: string
  questionInstanceId: string
  templateId: string
  templateVersion: number
  courseId: string
  unitId?: string
  knowledgePointId: string
  subject?: Subject
  grade?: number
  semester?: Semester
  ability?: LearningAbility
  questionType?: QuestionType
  result: LearningResult
  answer?: Answer
  errorCauses?: readonly ErrorCause[]
  attempts: number
  highestHintLevel: 0 | 1 | 2
  explanationViewed: boolean
  startedAt: number
  settledAt?: number
}
