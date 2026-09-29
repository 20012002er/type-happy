import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { Course, CourseId, Lesson } from '@type-happy/shared'

const CourseIdSchema = z.enum(['fingering', 'english', 'chinese'])

const CourseFileSchema = z.object({
  id: CourseIdSchema,
  title: z.string().min(1),
  description: z.string(),
})

const TextContentSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
  showKeyboard: z.boolean(),
})

const PinyinContentSchema = z.object({
  kind: z.literal('pinyin'),
  chars: z.array(z.object({ char: z.string().min(1), pinyin: z.string().min(1) })).min(1),
})

const LessonSchema = z.object({
  id: z.string().min(1),
  courseId: CourseIdSchema,
  index: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.discriminatedUnion('kind', [TextContentSchema, PinyinContentSchema]),
})

export interface DataStore {
  courses: Course[]
  lessons: Map<CourseId, Lesson[]>
}

export function isCourseId(value: string): value is CourseId {
  return CourseIdSchema.safeParse(value).success
}

export function toMeta(lesson: Lesson) {
  const { id, courseId, index, title, description } = lesson
  return { id, courseId, index, title, ...(description !== undefined ? { description } : {}) }
}

export function loadData(): DataStore {
  const dataDir = path.join(import.meta.dirname, 'data')
  const coursesFile = path.join(dataDir, 'courses.json')
  if (!existsSync(coursesFile)) {
    throw new Error(`课程数据缺失: ${coursesFile}`)
  }
  const courseDefs = z.array(CourseFileSchema).parse(JSON.parse(readFileSync(coursesFile, 'utf8')))

  const courses: Course[] = []
  const lessons = new Map<CourseId, Lesson[]>()

  for (const def of courseDefs) {
    const dir = path.join(dataDir, def.id)
    const files = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .sort()
      : []
    const list: Lesson[] = []
    const seenIds = new Set<string>()
    const seenIndexes = new Set<number>()
    for (const file of files) {
      const lesson = LessonSchema.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')))
      if (lesson.courseId !== def.id) {
        throw new Error(`关卡 ${file} 的 courseId(${lesson.courseId})与目录 ${def.id} 不一致`)
      }
      if (seenIds.has(lesson.id)) throw new Error(`关卡 id 重复: ${lesson.id}`)
      if (seenIndexes.has(lesson.index)) {
        throw new Error(`课程 ${def.id} 关卡 index 重复: ${lesson.index}`)
      }
      seenIds.add(lesson.id)
      seenIndexes.add(lesson.index)
      list.push(lesson)
    }
    list.sort((a, b) => a.index - b.index)
    courses.push({ ...def, lessonCount: list.length })
    lessons.set(def.id, list)
  }

  return { courses, lessons }
}
