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

console.log('== load & menu ==')
await page.goto(BASE + '/games/doodle')
await page.waitForSelector('canvas')
ok('menu play button visible', await page.getByRole('button', { name: 'play', exact: true }).isVisible())

console.log('== first run (tutorial) ==')
await page.getByRole('button', { name: 'play', exact: true }).click()
await page.waitForFunction(() => window.__doodle?.game?.running === true)
ok('tutorial overlay shown on first run', await page.locator('span', { hasText: 'tilt to move' }).isVisible().catch(() => false))
await page.waitForTimeout(1500)
const st1 = await page.evaluate(() => {
  const g = window.__doodle.game
  return { platforms: g.platforms.length, score: g.score, py: g.py, running: g.running }
})
ok('platforms spawned', st1.platforms > 5, JSON.stringify(st1))
ok('game running', st1.running)

console.log('== input ==')
const pxBefore = await page.evaluate(() => window.__doodle.game.px)
await page.keyboard.down('ArrowRight')
await page.waitForTimeout(600)
await page.keyboard.up('ArrowRight')
const pxAfter = await page.evaluate(() => window.__doodle.game.px)
ok('keyboard moves doodler', Math.abs(pxAfter - pxBefore) > 10, `${pxBefore} -> ${pxAfter}`)
await page.keyboard.press('Space')
await page.waitForTimeout(100)
const proj = await page.evaluate(() => window.__doodle.game.projectiles.length)
ok('space shoots projectile', proj >= 1, String(proj))
const box = await page.locator('canvas').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 5 })
await page.mouse.up()
await page.waitForTimeout(200)
const axis = await page.evaluate(() => window.__doodle.game.axis)
ok('pointer axis cleared after release', axis === 0, String(axis))

console.log('== game over & persistence ==')
await page.evaluate(() => {
  window.__doodle.game.py = window.__doodle.game.cameraY + 1200
})
await page.waitForFunction(() => window.__doodle.screen.value === 'over', null, { timeout: 15000 })
ok('game over overlay shown', await page.locator('h3', { hasText: 'your score:' }).isVisible())
const save1 = await page.evaluate(() => JSON.parse(localStorage.getItem('type-happy:doodle-jump:v1')))
ok('save written', !!save1 && save1.stats.original.plays === 1, JSON.stringify(save1?.stats?.original?.plays))
ok('death cause miss recorded', save1?.stats?.original?.deaths?.miss === 1)
ok('tutorialSeen persisted', save1?.tutorialSeen === true)
const store = await page.evaluate(() => JSON.parse(localStorage.getItem('type-happy:games:v1')))
ok('games store recorded', typeof store?.doodle?.bestScore === 'number')
ok('active missions selected', Array.isArray(save1?.activeMissions) && save1.activeMissions.length > 0)

console.log('== restart ==')
await page.getByRole('button', { name: 'play again' }).click()
await page.waitForFunction(() => window.__doodle?.game?.running === true)
const ax2 = await page.evaluate(() => window.__doodle.game.axis)
ok('axis reset on restart', ax2 === 0, String(ax2))
await page.evaluate(() => {
  window.__doodle.game.py = window.__doodle.game.cameraY + 1200
})
await page.waitForFunction(() => window.__doodle.screen.value === 'over', null, { timeout: 15000 })
const save2 = await page.evaluate(() => JSON.parse(localStorage.getItem('type-happy:doodle-jump:v1')))
ok('second run persisted', save2.stats.original.plays === 2, String(save2.stats.original.plays))

console.log('== meta screens ==')
await page.getByRole('button', { name: 'menu', exact: true }).click()
await page.getByRole('button', { name: 'missions' }).click()
const labels = await page.locator('p.font-semibold').allTextContents()
ok('mission labels non-empty', labels.length > 0 && labels.every((t) => t.trim().length > 4 && !t.includes('.')), JSON.stringify(labels))
await page.getByRole('button', { name: 'close' }).click()
await page.getByRole('button', { name: /scores/ }).click()
const scoresText = await page.locator('div.grid').first().textContent()
ok('scores screen shows high score', /high score/i.test(scoresText) && /\d/.test(scoresText))
await page.getByRole('button', { name: 'close' }).click()
await page.getByRole('button', { name: 'options' }).click()
await page.locator('input[type=checkbox]').first().click()
const save3 = await page.evaluate(() => JSON.parse(localStorage.getItem('type-happy:doodle-jump:v1')))
ok('sound toggle persisted', save3.settings.sound === false, String(save3.settings.sound))
await page.getByRole('button', { name: 'close' }).click()

console.log('== reload persistence ==')
await page.reload()
await page.waitForSelector('canvas')
await page.getByRole('button', { name: 'play', exact: true }).waitFor()
const save4 = await page.evaluate(() => JSON.parse(localStorage.getItem('type-happy:doodle-jump:v1')))
ok('save survives reload', save4.stats.original.plays === 2 && save4.settings.sound === false)
ok('no tutorial on returning player', !(await page.locator('span', { hasText: 'tilt to move' }).isVisible().catch(() => false)))

console.log('== console cleanliness ==')
ok('no console/page errors', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 5)))

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} FAILURES: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nALL E2E CHECKS PASSED')
