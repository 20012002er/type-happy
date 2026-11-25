// 生产 preview 验证：全部收录路由可刷新（HTTP 200 + HTML）、引用资源可达、无意外超大 chunk。
// 用法：先 pnpm build && pnpm prerender，再启动 pnpm preview，最后运行本脚本。
import fs from 'node:fs'
import path from 'node:path'
import { collectRoutes, webRoot } from './seo-routes.mjs'

const baseUrl = (process.env.PREVIEW_BASE_URL ?? 'http://localhost:4173').replace(/\/+$/, '')
// 6.11 工程门槛：无意外超大 chunk（当前最大为 Pixi 核心与题库，均 < 336KB）
const CHUNK_BUDGET_BYTES = 400 * 1024

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

// 1. 构建产物 chunk 预算
const assetsDir = path.join(webRoot, 'dist', 'assets')
const jsFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith('.js'))
let largest = { file: '', size: 0 }
for (const file of jsFiles) {
  const size = fs.statSync(path.join(assetsDir, file)).size
  if (size > largest.size) largest = { file, size }
  check(size <= CHUNK_BUDGET_BYTES, `chunk 超出预算：${file} ${size}B > ${CHUNK_BUDGET_BYTES}B`)
}

// 2. 全部收录路由刷新可达，且为预渲染 HTML
const routes = collectRoutes()
const assetUrls = new Set()
for (const route of routes) {
  const url = `${baseUrl}${route.path}`
  try {
    const response = await fetch(url)
    check(response.status === 200, `路由 ${route.path} 返回 ${response.status}`)
    const html = await response.text()
    check(html.includes('id="app"'), `路由 ${route.path} 缺少应用挂载 HTML`)
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)) {
      assetUrls.add(match[1])
    }
  } catch (error) {
    failures.push(`路由 ${route.path} 请求失败：${error.message}`)
  }
}

// 3. SEO 文件与页面引用资源可达
for (const seoPath of ['/sitemap.xml', '/robots.txt']) {
  const response = await fetch(`${baseUrl}${seoPath}`)
  check(response.status === 200, `${seoPath} 返回 ${response.status}`)
}
for (const assetPath of assetUrls) {
  const response = await fetch(`${baseUrl}${assetPath}`)
  check(response.status === 200, `资源 ${assetPath} 返回 ${response.status}`)
}

if (failures.length > 0) {
  console.error(`preview 验证失败（${failures.length} 项）：`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(
  `preview 验证通过：routes=${routes.length}, assets=${assetUrls.size}, ` +
    `largestChunk=${largest.file}(${largest.size}B)`,
)
