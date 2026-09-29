export type CourseId = 'fingering' | 'english' | 'chinese'

export interface Course {
  id: CourseId
  title: string
  description: string
  lessonCount: number
}

export interface LessonMeta {
  id: string
  courseId: CourseId
  index: number
  title: string
  description?: string
}

export interface TextContent {
  kind: 'text'
  text: string
  showKeyboard: boolean
}

export interface PinyinChar {
  char: string
  pinyin: string
}

export interface PinyinContent {
  kind: 'pinyin'
  chars: PinyinChar[]
}

export type LessonContent = TextContent | PinyinContent

export interface Lesson extends LessonMeta {
  content: LessonContent
}

export interface CourseDetail {
  course: Course
  lessons: LessonMeta[]
}

export interface PracticeResult {
  lessonId: string
  wpm: number
  cpm: number
  accuracy: number
  durationMs: number
  completedAt: string
}
