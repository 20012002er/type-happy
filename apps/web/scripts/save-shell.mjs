/**
 * vite build 后缓存一份干净的入口壳(dist/index.html 原始产物)。
 * prerender.mjs 启动时用它还原入口壳:首页快照最后写入 dist/index.html,
 * 若重复运行 prerender,残留的首页快照会污染其余路由的 SPA fallback 壳。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const shell = path.join(webRoot, 'dist', 'index.html')
const cacheDir = path.join(webRoot, 'node_modules', '.cache')

if (!fs.existsSync(shell)) {
  console.error('[save-shell] dist/index.html 不存在,跳过')
  process.exit(0)
}
fs.mkdirSync(cacheDir, { recursive: true })
fs.copyFileSync(shell, path.join(cacheDir, 'prerender-shell.html'))
console.log('[save-shell] 干净入口壳已缓存到 node_modules/.cache/prerender-shell.html')
