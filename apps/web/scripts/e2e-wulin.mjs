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

const SAVE_KEY = 'type-happy:wulin:v1'
const readSave = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), SAVE_KEY)

console.log('== load & character creation ==')
await page.goto(BASE + '/games/wulin')
await page.waitForFunction(() => !!window.__wulin, null, { timeout: 20000 })
ok('create screen shown', await page.getByRole('button', { name: '踏入江湖' }).isVisible())
await page.getByPlaceholder('输入名号').fill('测试侠')
await page.getByRole('button', { name: '武学世家' }).click()
await page.getByRole('button', { name: '重新投掷' }).click()
await page.getByRole('button', { name: '踏入江湖' }).click()
await page.waitForFunction(() => !!window.__wulin.save.char, null, { timeout: 5000 })
const s1 = await readSave()
ok('character persisted', s1?.char?.name === '测试侠', JSON.stringify(s1?.char?.name))
ok('martial origin grants basic skills', (s1?.char?.skills?.['bs-fist']?.level ?? 0) === 20)
ok('default equipment slots set', s1?.char?.equipped?.output === 'bs-fist')

console.log('== map & npc interaction ==')
await page.waitForSelector('canvas')
const roomName = await page.evaluate(() => window.__wulin.save.progress.room)
ok('starts at c1-dock', roomName === 'c1-dock', roomName)
// 与老周交谈推进主线第一步
await page.getByRole('button', { name: /摆渡老周/ }).first().click()
await page.waitForSelector('text=摆渡老周')
await page.getByRole('button', { name: '交谈', exact: true }).click()
await page.waitForTimeout(300)
const step1 = await page.evaluate(() => (window.__wulin.save.progress.questByChapter?.c1 ?? []).length)
ok('quest step advanced after talk', step1 === 1, String(step1))
await page.locator('button', { hasText: '✕' }).first().click()

console.log('== train spot ==')
const expBefore = await page.evaluate(() => window.__wulin.save.char.exp)
await page.getByRole('button', { name: /挑水/ }).first().click()
await page.waitForTimeout(200)
const trains = await page.evaluate(() => Object.values(window.__wulin.save.progress.trains).reduce((a, b) => a + b, 0))
ok('train spot used', trains >= 1, String(trains))
void expBefore

console.log('== combat: walk to 芦苇荡 & defeat 王五 ==')
await page.getByRole('button', { name: /河畔竹径/ }).first().click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: /土地庙/ }).first().click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: /芦苇荡/ }).first().click()
await page.waitForTimeout(700)
const roomNow = await page.evaluate(() => window.__wulin.save.progress.room)
ok('walked to c1-reed', roomNow === 'c1-reed', roomNow)
await page.getByRole('button', { name: /恶霸王五/ }).first().click()
await page.getByRole('button', { name: '决斗', exact: true }).click()
await page.waitForFunction(() => !!window.__wulin.sim.combat, null, { timeout: 5000 })
ok('combat started', true)
await page.waitForFunction(() => window.__wulin.sim.combat?.state.over === true, null, { timeout: 60000 })
const winner = await page.evaluate(() => window.__wulin.sim.combat?.state.winner)
ok('player wins vs lv3 thug', winner === 'player', String(winner))
await page.getByRole('button', { name: '离开战场' }).click()
await page.waitForFunction(() => !window.__wulin.sim.combat, null, { timeout: 5000 })
const step2 = await page.evaluate(() => (window.__wulin.save.progress.questByChapter?.c1 ?? []).length)
ok('quest step advanced after defeat', step2 === 2, String(step2))
const expGained = await page.evaluate(() => window.__wulin.save.char.exp)
ok('combat exp gained', expGained > 0, String(expGained))

console.log('== pickup & chapter 1 finale ==')
await page.getByRole('button', { name: /翻找此处/ }).first().click()
await page.waitForTimeout(300)
const step3 = await page.evaluate(() => (window.__wulin.save.progress.questByChapter?.c1 ?? []).length)
ok('hairpin picked, step 3', step3 === 3, String(step3))
await page.getByRole('button', { name: /张家大院/ }).first().click()
await page.waitForTimeout(700)
await page.evaluate(() => {
  const c = window.__wulin.save.char
  c.hp = 1
  c.injury = 0
  c.spirit = 120
})
await page.getByRole('button', { name: /渡霸张无良/ }).first().click()
await page.getByRole('button', { name: '决斗', exact: true }).click()
await page.waitForFunction(() => window.__wulin.sim.combat?.state.over === true, null, { timeout: 90000 })
const winner2 = await page.evaluate(() => window.__wulin.sim.combat?.state.winner)
ok('player wins vs chapter boss', winner2 === 'player', String(winner2))
await page.getByRole('button', { name: '离开战场' }).click()
await page.waitForFunction(() => !window.__wulin.sim.combat, null, { timeout: 5000 })
const c1done = await page.evaluate(() => window.__wulin.save.progress.chaptersDone.includes('c1'))
const c2unlocked = await page.evaluate(() => window.__wulin.save.progress.unlocked.includes('c2'))
ok('chapter 1 completed & c2 unlocked', c1done && c2unlocked, `${c1done}/${c2unlocked}`)
await page.evaluate(() => window.__wulin.sim.travelTo('c1'))
await page.waitForTimeout(400)

console.log('== idle & fast-forward ==')
await page.getByRole('button', { name: '柳叶渡', exact: true }).first().click()
await page.waitForTimeout(200)
const idleCh = await page.evaluate(() => window.__wulin.save.idle.chapter)
ok('idle started at c1', idleCh === 'c1', String(idleCh))
const expPre = await page.evaluate(() => window.__wulin.save.char.exp)
await page.evaluate(() => window.__wulin.fastForward(3600))
await page.waitForTimeout(300)
const expPost = await page.evaluate(() => window.__wulin.save.char.exp)
ok('idle grants exp over 1h', expPost > expPre, `${expPre} -> ${expPost}`)

console.log('== harvest & signin ==')
await page.getByRole('button', { name: '领取' }).first().click()
await page.waitForTimeout(200)
const pondCd = await page.evaluate(() => window.__wulin.save.harvest.pond ?? 0)
ok('harvest pond on cooldown', pondCd > Date.now() - 60e3, String(pondCd))
await page.getByRole('button', { name: /签到/ }).first().click()
await page.waitForTimeout(200)
const signin = await page.evaluate(() => window.__wulin.save.daily.signin)
ok('signin done', signin === 1, String(signin))

console.log('== tabs render ==')
for (const [tabName, probe] of [
  ['武学', '临敌准备'],
  ['背包', '穿戴'],
  ['门派', '拜入门派'],
  ['人物', '传承'],
]) {
  await page.locator(`nav button`, { hasText: tabName }).first().click()
  await page.waitForTimeout(150)
  ok(`${tabName} tab renders`, await page.locator(`text=${probe}`).first().isVisible().catch(() => false))
}
await page.locator('nav button', { hasText: '江湖' }).first().click()

console.log('== skills: equip & meditate ==')
await page.locator('nav button', { hasText: '人物' }).first().click()
await page.locator('nav button', { hasText: '武学' }).first().click()
await page.getByRole('button', { name: /打坐/ }).first().click()
await page.waitForTimeout(200)
const mpGrown = await page.evaluate(() => window.__wulin.save.char.mpGrown)
ok('meditate grows mp cap', mpGrown >= 1, String(mpGrown))
await page.locator('nav button', { hasText: '江湖' }).first().click()

console.log('== reload persistence ==')
await page.reload()
await page.waitForFunction(() => !!window.__wulin?.save?.char, null, { timeout: 20000 })
const s2 = await readSave()
ok('save survives reload', s2?.char?.name === '测试侠' && (s2?.daily?.signin ?? 0) === 1)
ok('no offline modal for short absence', !(await page.locator('text=江湖快报').isVisible().catch(() => false)))

console.log('== rebirth flow (debug-accelerated) ==')
// 拉满等级到一转阈值,开启传承任务
await page.evaluate(async () => {
  const { expForLevel } = await import('/src/games/wulin/constants.ts')
  const w = window.__wulin
  w.save.char.exp = expForLevel(320)
  w.save.char.skills['bs-fist'] = { level: 400, exp: 0, activeUnlocked: false }
  w.save.char.skills['bs-parry'] = { level: 400, exp: 0, activeUnlocked: false }
  w.save.char.skills['bs-light'] = { level: 400, exp: 0, activeUnlocked: false }
  w.save.char.skills['bs-internal'] = { level: 400, exp: 0, activeUnlocked: false }
})
await page.locator('nav button', { hasText: '人物' }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /动身前往荒谷/ }).click()
await page.waitForTimeout(300)
const rbStage = await page.evaluate(() => window.__wulin.save.rebirth.stage)
ok('rebirth quest started', rbStage === 1, String(rbStage))
const rbChapter = await page.evaluate(() => window.__wulin.save.progress.chapter)
ok('traveled to rebirth dungeon', rbChapter === 'rb', rbChapter)
// 击败判官
await page.evaluate(() => {
  const c = window.__wulin.save.char
  c.hp = 1
  c.injury = 0
  c.spirit = 500
  window.__wulin.startFight('rb-judge', 'duel')
})
await page.waitForFunction(() => window.__wulin.sim.combat?.state.over === true, null, { timeout: 120000 })
const rbWin = await page.evaluate(() => window.__wulin.sim.combat?.state.winner)
ok('wins rebirth boss when overleveled', rbWin === 'player', String(rbWin))
await page.getByRole('button', { name: '离开战场' }).click()
await page.waitForTimeout(300)
const stage2 = await page.evaluate(() => window.__wulin.save.rebirth.stage)
ok('child rescued (stage 2)', stage2 === 2, String(stage2))
// 培养弟子:反复快进+教导
for (let i = 0; i < 80; i++) {
  const done = await page.evaluate(() => {
    const w = window.__wulin
    w.save.char.spirit = 500
    for (const k of ['arm', 'agi', 'bone', 'ins']) {
      if (w.save.rebirth.disciple.attrs[k] < 100) {
        w.sim.trainDisciple(k)
        w.fastForward(3600)
        return false
      }
    }
    return true
  })
  if (done) break
}
const ready = await page.evaluate(() => window.__wulin.sim.discipleReady())
ok('disciple fully trained', ready === true, String(ready))
await page.locator('nav button', { hasText: '人物' }).first().click()
await page.waitForTimeout(200)
await page.getByPlaceholder(/传人姓名/).fill('小侠')
await page.getByRole('button', { name: '确认传承' }).click()
await page.waitForTimeout(400)
const s3 = await page.evaluate(() => {
  const c = window.__wulin.save.char
  return { name: c.name, rebirths: c.rebirths, points: c.attrPoints, level: window.__wulin.sim.level(), sect: c.sect }
})
ok('rebirth completed', s3.rebirths === 1 && s3.name === '小侠' && s3.points === 30 && s3.level < 50 && s3.sect === null, JSON.stringify(s3))

console.log('== regression: out-of-order boss & save reset ==')
const ctx2 = await browser.newContext()
const page2 = await ctx2.newPage()
const errs2 = []
page2.on('pageerror', (e) => errs2.push(e.message))
await page2.goto(BASE + '/games/wulin')
await page2.waitForFunction(() => !!window.__wulin, null, { timeout: 20000 })
await page2.evaluate(() => window.__wulin.createTest('乱序侠', 'martial'))
await page2.waitForTimeout(400)
// 跳过前置步骤,直奔张家大院先杀张无良
await page2.evaluate(() => {
  const w = window.__wulin
  w.sim.moveTo('c1-yard')
  w.sim.moveTo('c1-wood')
  w.sim.moveTo('c1-manor')
  const c = w.save.char
  c.exp = 20000
  for (const k of ['bs-fist', 'bs-parry', 'bs-light', 'bs-internal']) c.skills[k].level = 60
  w.startFight('zhang-bully', 'duel')
})
await page2.waitForFunction(() => window.__wulin.sim.combat?.state.over === true, null, { timeout: 90000 })
await page2.getByRole('button', { name: '离开战场' }).click()
await page2.waitForTimeout(300)
// 回头补齐其余步骤
await page2.evaluate(() => window.__wulin.sim.travelTo('c1'))
await page2.waitForTimeout(300)
await page2.getByRole('button', { name: /摆渡老周/ }).first().click()
await page2.getByRole('button', { name: '交谈', exact: true }).click()
await page2.locator('button', { hasText: '✕' }).first().click()
await page2.evaluate(() => {
  const w = window.__wulin
  w.sim.moveTo('c1-path')
  w.sim.moveTo('c1-shrine')
  w.sim.moveTo('c1-reed')
})
await page2.waitForTimeout(300)
await page2.getByRole('button', { name: /恶霸王五/ }).first().click()
await page2.getByRole('button', { name: '决斗', exact: true }).click()
await page2.waitForFunction(() => window.__wulin.sim.combat?.state.over === true, null, { timeout: 90000 })
await page2.getByRole('button', { name: '离开战场' }).click()
await page2.waitForTimeout(200)
await page2.getByRole('button', { name: /翻找此处/ }).first().click()
await page2.waitForTimeout(300)
const c1done2 = await page2.evaluate(() => window.__wulin.save.progress.chaptersDone.includes('c1'))
ok('out-of-order boss still completes chapter', c1done2 === true, String(c1done2))
const canRefight = await page2.evaluate(() => {
  window.__wulin.sim.travelTo('c1')
  window.__wulin.sim.moveTo('c1-yard')
  window.__wulin.sim.moveTo('c1-wood')
  window.__wulin.sim.moveTo('c1-manor')
  return window.__wulin.sim.canFight('zhang-bully')
})
ok('defeated boss re-fightable', canRefight === true, String(canRefight))
// 重置存档:确认弹窗后应回到建角页且 localStorage 清空
page2.on('dialog', (d) => void d.accept())
await page2.locator('nav button', { hasText: '人物' }).first().click()
await page2.waitForTimeout(300)
await page2.getByRole('button', { name: '重置存档' }).click()
await page2.waitForFunction(() => localStorage.getItem('type-happy:wulin:v1') === null, null, {
  timeout: 15000,
})
await page2.getByRole('button', { name: '踏入江湖' }).waitFor({ timeout: 15000 })
ok('reset clears save & returns to creation', true)
ok('regression page no errors', errs2.length === 0, JSON.stringify(errs2.slice(0, 3)))
await ctx2.close()

console.log('== console cleanliness ==')
ok('no console/page errors', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 5)))

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} FAILURES: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nALL E2E CHECKS PASSED')
