export type Semester = 'autumn' | 'spring'
export type Difficulty = 'L1' | 'L2' | 'L3'
export type ContentSource = 'new-pep' | 'old-pep' | 'review'
export type QuestionType = 'number' | 'quotient-remainder'

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
}

export interface Course {
  id: string
  version: number
  title: string
  subject: string
  grade: number
  semester: Semester
  textbook: string
  units: readonly CourseUnit[]
  knowledgePoints: readonly KnowledgePoint[]
}

export interface ContentClassification {
  courseId: string
  subject: string
  grade: number
  semester: Semester
  textbook: string
  unitId: string
  knowledgePointId: string
}

export interface QuestionTemplate {
  id: string
  version: number
  classification: ContentClassification
  type: QuestionType
  difficulty: Difficulty
  promptTemplate: string
}

export type Answer =
  | { kind: 'number'; value: number }
  | { kind: 'quotient-remainder'; quotient: number; remainder: number }

export type AcceptedAnswerRule =
  | { kind: 'number'; values: readonly number[] }
  | {
      kind: 'quotient-remainder'
      values: readonly { quotient: number; remainder: number }[]
    }

export interface QuestionResource {
  id: string
  type: 'image' | 'audio' | 'text'
  uri: string
  altText?: string
}

export interface ErrorCauseRule {
  id: string
  label: string
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
  type: QuestionType
  difficulty: Difficulty
  prompt: string
  resources: readonly QuestionResource[]
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
  knowledgePointId: string
  result: LearningResult
  answer?: Answer
  attempts: number
  highestHintLevel: 0 | 1 | 2
  explanationViewed: boolean
  startedAt: number
  settledAt?: number
}
