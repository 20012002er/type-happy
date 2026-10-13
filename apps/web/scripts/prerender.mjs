/**
 * 预渲染脚本:用 Playwright 把全部路由渲染成静态 HTML 快照写入 dist/,
 * 供搜索引擎(尤其不执行 JS 的 Baiduspider)直接抓取正文与 meta。
 *
 * 前置:已执行 pnpm build(shared/server/web 均需构建产物)。
 * 运行:pnpm --filter @type-happy/web prerender
 *
 * 流程:启动 server(随机高位端口)→ 启动 vite preview(代理 /api)→ 逐路由快照。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { collectRoutes, repoRoot, webRoot } from './seo-routes.mjs'

const PREVIEW_PORT = Number(process.env.PRERENDER_PORT ?? 4173)
const API_PORT = Number(process.env.PRERENDER_API_PORT ?? 3101)
const CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY ?? 4)
const PREVIEW_BASE = `http://127.0.0.1:${PREVIEW_PORT}`
const distDir = path.join(webRoot, 'dist')

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('[prerender] dist/index.html 不存在,请先执行 pnpm build')
  process.exit(1)
}
if (!fs.existsSync(path.join(repoRoot, 'apps/server/dist/index.js'))) {
  console.error('[prerender] apps/server/dist/index.js 不存在,请先构建 server')
  process.exit(1)
}

// 用构建时缓存的干净入口壳还原 dist/index.html(首页快照最后写入,重复运行不互相污染)
const shellCache = path.join(webRoot, 'node_modules', '.cache', 'prerender-shell.html')
if (fs.existsSync(shellCache)) {
  fs.copyFileSync(shellCache, path.join(distDir, 'index.html'))
  console.log('[prerender] 入口壳已从构建缓存还原')
} else {
  console.warn(
    '[prerender] 警告:未找到入口壳缓存,若 dist/index.html 已被上次预渲染覆盖请先重新 pnpm build',
  )
}

const children = []

function start(name, cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
  child.stdout.on('data', (d) => {
    const text = String(d).trim()
    if (text) console.log(`[${name}] ${text}`)
  })
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`))
  child.on('error', (e) => {
    console.error(`[prerender] ${name} 启动失败:`, e.message)
    cleanup(1)
  })
  child.on('exit', (code) => {
    if (code !== 0 && code !== null && !shuttingDown) {
      console.error(`[prerender] ${name} 意外退出 (code=${code})`)
      cleanup(1)
    }
  })
  children.push(child)
  return child
}

let shuttingDown = false
function cleanup(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(exitCode), 300).unref()
}

async function waitForUrl(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // 未就绪,继续等待
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`等待 ${url} 超时`)
}

const routes = collectRoutes()
// '/' 的快照会覆盖 dist/index.html,而它同时是其余路由的 SPA fallback 壳;
// 最后渲染首页,避免其他路由抓到已写入首页内容的壳(残留首页的 JSON-LD/preload)。
const homeRoute = routes.find((r) => r.path === '/')
const renderOrder = [...routes.filter((r) => r.path !== '/'), ...(homeRoute ? [homeRoute] : [])]
const failures = []

async function snapshot(context, route) {
  const page = await context.newPage()
  try {
    const url = PREVIEW_BASE + route.path
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
    } catch {
      // 个别页面(如 iframe 游戏)可能长连接不断,退化为 load + 固定等待
      await page.goto(url, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(3_000)
    }
    await page.waitForSelector('#app > *', { state: 'attached', timeout: 15_000 })
    await page.waitForTimeout(150)
    // 运行时注入的 modulepreload 链接会带上预渲染机的绝对地址,归一为相对路径
    const html = `<!doctype html>\n${(await page.content()).replaceAll(PREVIEW_BASE, '')}`
    const rel = route.path === '/' ? 'index.html' : path.join(route.path.slice(1), 'index.html')
    const file = path.join(distDir, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, html)
    console.log(`[prerender] OK   ${route.path}`)
  } catch (e) {
    failures.push(`${route.path}: ${e.message}`)
    console.error(`[prerender] FAIL ${route.path}: ${e.message}`)
  } finally {
    await page.close().catch(() => {})
  }
}

async function main() {
  start('server', process.execPath, [path.join(repoRoot, 'apps/server/dist/index.js')], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(API_PORT), NODE_ENV: 'production', LOG_LEVEL: 'silent' },
  })
  await waitForUrl(`http://127.0.0.1:${API_PORT}/health`)
  console.log(`[prerender] server 就绪 (:${API_PORT})`)

  const viteBin = path.join(webRoot, 'node_modules', '.bin', 'vite')
  start(
    'preview',
    viteBin,
    ['preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
    {
      cwd: webRoot,
      env: { ...process.env, PRERENDER_API: `http://127.0.0.1:${API_PORT}` },
    },
  )
  await waitForUrl(PREVIEW_BASE + '/')
  console.log(`[prerender] preview 就绪 (:${PREVIEW_PORT}),共 ${routes.length} 个路由`)

  // PRERENDER_CHANNEL 可指定浏览器通道(如 Docker 内用更小的 chromium-headless-shell)
  const browser = await chromium.launch({
    channel: process.env.PRERENDER_CHANNEL || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const context = await browser.newContext()
    const queue = [...renderOrder]
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length > 0) await snapshot(context, queue.shift())
      }),
    )
    await context.close()
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    console.error(`[prerender] ${failures.length} 个路由失败:\n${failures.join('\n')}`)
    cleanup(1)
    return
  }
  console.log(`[prerender] 全部 ${routes.length} 个路由预渲染完成`)
  cleanup(0)
}

main().catch((e) => {
  console.error('[prerender] 失败:', e)
  cleanup(1)
})
