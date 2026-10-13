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

console.log('== 集成页(/games/wuxia)==')
await page.goto(BASE + '/games/wuxia')
await page.waitForSelector('h1')
ok('h1 显示游戏名', (await page.locator('h1').textContent())?.includes('武侠放置'))
const iframe = page.locator('iframe[title="武侠放置"]')
ok('iframe 存在且指向构建产物', (await iframe.getAttribute('src')) === '/games/wuxia/index.html')
ok('页面含 SEO 特性介绍文案', await page.locator('text=五大门派').first().isVisible())

console.log('== iframe 内游戏挂载 ==')
const game = page.frameLocator('iframe[title="武侠放置"]')
await game.locator('.game-layout').waitFor({ state: 'visible', timeout: 20_000 })
ok('游戏主界面挂载(.game-layout)', true)
const menuCount = await game.locator('.left-sidebar .menu-item').count()
ok('侧边栏菜单渲染', menuCount > 5, `menuCount=${menuCount}`)

console.log('== 视图切换与本地持久化 ==')
await game.locator('.menu-item', { hasText: '主线剧情' }).click()
await page.waitForFunction(() => localStorage.getItem('wuxia-idle-last-view') === 'mainStory')
ok('点击菜单写入 last-view 存档', true)
await page.waitForFunction(() => !!localStorage.getItem('wuxia-idle-save-v1'), null, {
  timeout: 15_000,
})
ok('自动存档写入 wuxia-idle-save-v1', true)

console.log('== 刷新恢复 ==')
await page.reload()
const game2 = page.frameLocator('iframe[title="武侠放置"]')
await game2.locator('.game-layout').waitFor({ state: 'visible', timeout: 20_000 })
await game2.locator('.menu-item.active', { hasText: '主线剧情' }).waitFor({ timeout: 10_000 })
ok('刷新后恢复上次视图(主线剧情高亮)', true)

console.log('== 游戏列表入口 ==')
await page.goto(BASE + '/games')
const card = page.locator('a[href="/games/wuxia"]')
await card.waitFor({ state: 'visible', timeout: 15_000 })
ok('/games 列表含武侠放置卡片', true)
ok('卡片文案完整', (await card.textContent())?.includes('武侠放置'))

console.log('== 控制台清洁 ==')
ok('无 console/page 错误', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 5)))

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} FAILURES: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nALL E2E CHECKS PASSED')
