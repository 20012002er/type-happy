import Fastify from 'fastify'
import cors from '@fastify/cors'
import { loadData } from './data-loader.js'
import { courseRoutes } from './routes/courses.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

const store = loadData()
app.log.info(
  `课程数据加载完成: ${store.courses.map((c) => `${c.id}(${c.lessonCount}关)`).join(', ')}`,
)

app.get('/health', async () => ({
  status: 'ok',
  courses: store.courses.length,
}))

await app.register(courseRoutes, { store })

const port = Number(process.env.PORT ?? 3001)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0))
  })
}

await app.listen({ port, host: '0.0.0.0' })
