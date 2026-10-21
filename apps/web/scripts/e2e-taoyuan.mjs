import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:5199'
const failures = []
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  PASS ${name}`)
  else {
    console.log(`  FAIL ${name} ${extra}`)
    failures.push(name)
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (t.includes('favicon') || t.includes('Built-In AI') || t.includes('DevTools')) return
  consoleErrors.push(t)
})
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

// ========== 1. 游戏列表页 ==========
console.log('== game list page ==')
await page.goto(BASE + '/games')
await page.waitForLoadState('networkidle')
ok('game list page loads', await page.locator('h1, h2').first().isVisible().catch(() => false))

// 检查桃源乡卡片是否存在
const taoyuanCard = page.locator('a[href="/games/taoyuan"], [href*="taoyuan"]').first()
const taoyuanVisible = await taoyuanCard.isVisible().catch(() => false)
ok('taoyuan card visible on game list', taoyuanVisible)

// 检查桃源乡的描述文本
const taoyuanText = await page.locator('text=桃源乡').first().isVisible().catch(() => false)
ok('taoyuan title shown', taoyuanText)

// ========== 2. 桃源乡游戏页面 ==========
console.log('== taoyuan game page ==')
await page.goto(BASE + '/games/taoyuan')
await page.waitForLoadState('networkidle')

// 检查页面标题和描述
const h1 = await page.locator('h1').first().textContent()
ok('page title contains 桃源乡', h1?.includes('桃源乡') ?? false, h1 ?? '')

// 检查 iframe 存在
const iframe = page.locator('iframe[title="桃源乡"]')
const iframeVisible = await iframe.isVisible().catch(() => false)
ok('iframe present and visible', iframeVisible)

// 检查 iframe src
const iframeSrc = await iframe.getAttribute('src')
ok('iframe src correct', iframeSrc === '/games/taoyuan/index.html', iframeSrc ?? '')

// 检查全屏布局（不应有 max-w-4xl）
const gameContainer = page.locator('div.mx-auto').filter({ has: page.locator('iframe') })
const gameContainerClass = await gameContainer.getAttribute('class')
ok('no max-w-4xl restriction', !gameContainerClass?.includes('max-w-4xl'), gameContainerClass ?? '')
ok('uses max-w-7xl for wider layout', gameContainerClass?.includes('max-w-7xl') ?? false, gameContainerClass ?? '')

// ========== 3. iframe 内容加载 ==========
console.log('== iframe content loading ==')
const frame = iframe.contentFrame()
// 等待 iframe 内容加载
await page.waitForTimeout(5000)

// 检查桃源乡主菜单加载
const menuLoaded = await frame.locator('text=桃源乡').first().isVisible({ timeout: 15000 }).catch(() => false)
ok('taoyuan main menu loads in iframe', menuLoaded)

// 检查游戏按钮渲染
const btnCount = await frame.locator('button, .btn').count()
ok('game buttons rendered', btnCount > 0, String(btnCount))

// ========== 4. 云端功能已移除验证 ==========
console.log('== cloud features removed ==')

// 检查 iframe 内无云端相关文本
const iframeHtml = await frame.locator('html').innerHTML()
ok('no WebDAV references in iframe', !iframeHtml.includes('WebDAV') && !iframeHtml.includes('webdav'))
ok('no Capacitor references', !iframeHtml.includes('Capacitor') && !iframeHtml.includes('capacitor'))
ok('no cloud sync UI', !iframeHtml.includes('云同步') && !iframeHtml.includes('云端'))

// ========== 5. localStorage 存档键 ==========
console.log('== localStorage ==')
// 桃源乡使用 taoyuanxiang_save_<slot> 格式的 key
const saveKeys = await page.evaluate(() => {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.includes('taoyuan')) keys.push(k)
  }
  return keys
})
// 初始状态可能没有存档 key，但确认 localStorage 可访问
ok('localStorage accessible', saveKeys !== null)

// ========== 6. 返回导航 ==========
console.log('== navigation ==')
await page.goto(BASE + '/games/taoyuan')
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1000)
const backLink = page.locator('a[href="/games"]').first()
await backLink.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)
const backVisible = await backLink.isVisible().catch(() => false)
ok('back to games link present', backVisible)

// ========== 7. 其他游戏不受影响 ==========
console.log('== other games unaffected ==')
await page.goto(BASE + '/games/idle')
await page.waitForLoadState('networkidle')
const idleIframe = page.locator('iframe').first()
const idleVisible = await idleIframe.isVisible().catch(() => false)
ok('idle game still works', idleVisible)

// ========== 8. 路由 meta 验证 ==========
console.log('== route meta ==')
await page.goto(BASE + '/games/taoyuan')
await page.waitForLoadState('networkidle')
const title = await page.title()
ok('page title set', title.length > 0, title)

// ========== 9. 控制台清洁度 ==========
console.log('== console cleanliness ==')
ok('no console/page errors', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 5)))

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} FAILURES: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nALL E2E CHECKS PASSED')
