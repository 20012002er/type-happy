import type { FastifyInstance } from 'fastify'
import type { DataStore } from '../data-loader.js'
import { isCourseId, toMeta } from '../data-loader.js'

interface RouteOpts {
  store: DataStore
}

export async function courseRoutes(app: FastifyInstance, opts: RouteOpts): Promise<void> {
  const { store } = opts

  app.get('/api/courses', async () => store.courses)

  app.get('/api/courses/:courseId', async (req, reply) => {
    const { courseId } = req.params as { courseId: string }
    if (!isCourseId(courseId)) {
      return reply.code(404).send({ message: `课程不存在: ${courseId}` })
    }
    const course = store.courses.find((c) => c.id === courseId)
    if (!course) {
      return reply.code(404).send({ message: `课程不存在: ${courseId}` })
    }
    const lessons = (store.lessons.get(courseId) ?? []).map(toMeta)
    return { course, lessons }
  })

  app.get('/api/courses/:courseId/lessons/:lessonId', async (req, reply) => {
    const { courseId, lessonId } = req.params as { courseId: string; lessonId: string }
    if (!isCourseId(courseId)) {
      return reply.code(404).send({ message: `课程不存在: ${courseId}` })
    }
    const lesson = (store.lessons.get(courseId) ?? []).find((l) => l.id === lessonId)
    if (!lesson) {
      return reply.code(404).send({ message: `关卡不存在: ${lessonId}` })
    }
    return lesson
  })
}
