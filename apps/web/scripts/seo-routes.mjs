import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const webRoot = path.resolve(__dirname, '..')
export const repoRoot = path.resolve(webRoot, '../..')

/** 站点对外地址(sitemap/robots 使用),构建时可用 SITE_URL 环境变量覆盖 */
export const SITE_URL = (process.env.SITE_URL ?? 'https://type.toby-blog.com').replace(/\/+$/, '')

export const gamePaths = [
  '/games/balloon',
  '/games/duck',
  '/games/fighter',
  '/games/idle',
  '/games/doodle',
]

/** 全站需要收录/预渲染的路由(sitemap 与 prerender 共用一份清单) */
export function collectRoutes() {
  const routes = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/courses', priority: '0.9', changefreq: 'weekly' },
    { path: '/games', priority: '0.9', changefreq: 'weekly' },
    ...gamePaths.map((p) => ({ path: p, priority: '0.7', changefreq: 'monthly' })),
  ]
  const dataDir = path.join(repoRoot, 'apps/server/src/data')
  for (const courseId of ['fingering', 'english', 'chinese']) {
    routes.push({ path: `/courses/${courseId}`, priority: '0.8', changefreq: 'weekly' })
    const dir = path.join(dataDir, courseId)
    for (const file of fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()) {
      const lesson = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
      routes.push({
        path: `/courses/${courseId}/lessons/${lesson.id}`,
        priority: '0.6',
        changefreq: 'monthly',
      })
    }
  }
  return routes
}
