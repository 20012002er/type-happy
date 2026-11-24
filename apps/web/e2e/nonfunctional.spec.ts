import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { claimStarterGift, plantCrop } from '../src/learning/farm/farm'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../src/learning/persistence/snapshot'
import type { LearningRecord, QuestionSnapshot } from '../src/learning/types'
import { settleWallet } from '../src/learning/wallet/wallet'

const NOW = new Date(2026, 10, 20, 12).getTime()
const DAY = 24 * 60 * 60 * 1000

async function seed(page: Page, snapshot: LearningSnapshot): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value)
    },
    { key: LEARNING_STORAGE_KEY, value: JSON.stringify(snapshot) },
  )
}

async function scan(page: Page, name: string): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze()
  expect(
    result.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ),
    `${name} 不应有 critical/serious 可访问性违规`,
  ).toEqual([])
}

async function currentQuestion(page: Page): Promise<QuestionSnapshot> {
  const sessionId = page.url().split('/').pop()
  if (!sessionId) throw new Error('当前路由缺少练习组 ID')
  return page.evaluate(
    ({ key, id }) => {
      const snapshot = JSON.parse(localStorage.getItem(key)!)
      const session = snapshot.practice.sessions[id]
      if (!session) throw new Error(`练习组不存在: ${id}`)
      return session.questions[session.currentIndex].question
    },
    { key: LEARNING_STORAGE_KEY, id: sessionId },
  )
}

async function submitCurrent(page: Page, keyboard = false): Promise<void> {
  const question = await currentQuestion(page)
  const answer = question.standardAnswer
  if (answer.kind === 'number') {
    const input = page.getByLabel('答案', { exact: true })
    await input.focus()
    if (keyboard) await page.keyboard.type(String(answer.value))
    else await input.fill(String(answer.value))
  } else if (answer.kind === 'quotient-remainder') {
    for (const [label, value] of [
      ['商', answer.quotient],
      ['余数', answer.remainder],
    ] as const) {
      const input = page.getByLabel(label, { exact: true })
      await input.focus()
      if (keyboard) await page.keyboard.type(String(value))
      else await input.fill(String(value))
    }
  } else if (answer.kind === 'word-problem') {
    const valueInput = page.locator('input[name="word-problem-value"]')
    await valueInput.focus()
    if (keyboard) await page.keyboard.type(String(answer.value))
    else await valueInput.fill(String(answer.value))
    const unitInput = page.locator('input[name="word-problem-unit"]')
    await unitInput.focus()
    if (keyboard) await page.keyboard.type(answer.unit ?? '')
    else await unitInput.fill(answer.unit ?? '')
  } else {
    throw new Error('当前练习仅支持数值、商余数和应用题')
  }
  const submit = page.getByRole('button', { name: /提交答案|提交订正/ })
  if (keyboard) {
    await submit.focus()
    await page.keyboard.press('Enter')
  } else {
    await submit.click()
  }
}

test('T10-04 学习首页、练习、完成、农场、商店、仓库和家长页通过 axe 严重级扫描', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const initial = createEmptyLearningSnapshot()
  initial.farm = claimStarterGift(initial.farm, { actionId: 'starter-gift', now: NOW })
  initial.farm = { ...initial.farm, inventory: { ...initial.farm.inventory, egg: 1 } }
  await seed(page, initial)

  for (const [path, name] of [
    ['/learning', '学习首页'],
    ['/learning/tasks', '任务页'],
    ['/learning/parent', '家长页'],
    ['/learning/records', '记录页'],
  ] as const) {
    await page.goto(path)
    await scan(page, name)
  }

  await page.goto('/learning/farm')
  await scan(page, '农场')
  await page.getByRole('button', { name: '商店与建筑', exact: true }).click()
  await scan(page, '商店')
  await page.getByRole('button', { name: '仓库与出售', exact: true }).click()
  await scan(page, '仓库')

  await page.goto('/learning')
  await page.getByRole('button', { name: '开始专项练习', exact: true }).click()
  await scan(page, '练习页')
  for (let index = 0; index < 10; index += 1) {
    await submitCurrent(page)
    await page.getByRole('button', { name: /保存并进入下一题|查看本组结果/ }).click()
  }
  await expect(page.getByRole('heading', { name: '这一组完成了' })).toBeVisible()
  await scan(page, '完成页')
})

test('T10-04 指定宽度、横竖屏和 200% 缩放下无页面级横向溢出，主要触控目标不小于 44px', async ({
  page,
}) => {
  const initial = createEmptyLearningSnapshot()
  initial.farm = claimStarterGift(initial.farm, { actionId: 'starter-gift', now: NOW })
  await seed(page, initial)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [
    [360, 740],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [740, 360],
  ] as const) {
    await page.setViewportSize({ width, height })
    for (const path of ['/learning', '/learning/farm', '/learning/parent']) {
      await page.goto(path)
      const layout = await page.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        offenders: [...document.querySelectorAll('body *')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            return rect.right > window.innerWidth && !element.closest('.learn-local-nav')
          })
          .slice(0, 12)
          .map((element) => ({
            tag: element.tagName,
            className: element.getAttribute('class'),
            right: Math.round(element.getBoundingClientRect().right),
            width: Math.round(element.getBoundingClientRect().width),
          })),
      }))
      expect(
        layout.fits,
        `${path} 在 ${width}×${height} 下不应横向溢出：${JSON.stringify(layout)}`,
      ).toBe(true)
    }
    await page.goto('/learning/farm')
    const targets = page.locator(
      '.farm-tabs button:not([disabled]), .farm-plot:not([disabled]), .farm-animal:not([disabled]), .farm-context .learn-button:not([disabled])',
    )
    for (const target of await targets.all()) {
      const box = await target.boundingBox()
      expect(box?.width, `${width}px 下触控目标宽度`).toBeGreaterThanOrEqual(44)
      expect(box?.height, `${width}px 下触控目标高度`).toBeGreaterThanOrEqual(44)
    }
  }
  await page.setViewportSize({ width: 720, height: 900 })
  await page.goto('/learning/parent')
  await page.getByRole('button', { name: '清除学习数据', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const dialog = await page.getByRole('dialog').boundingBox()
  expect(dialog!.width).toBeLessThanOrEqual(720)
  expect(dialog!.height).toBeLessThanOrEqual(900)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('T10-04 仅用键盘可答题、打开和取消确认框，系统与应用内减少动态均生效', async ({ page }) => {
  const initial = createEmptyLearningSnapshot()
  initial.farm = claimStarterGift(initial.farm, {
    actionId: 'starter-gift',
    now: NOW - 5 * 60_000,
  })
  initial.farm = plantCrop(initial.farm, {
    actionId: 'plant',
    now: NOW - 5 * 60_000,
    plotId: 'plot-1',
    cropId: 'radish',
  })
  initial.wallet = settleWallet(initial.wallet, {
    settlementId: 'keyboard-fund',
    occurredAt: NOW,
    source: 'practice',
    referenceId: 'keyboard-fund',
    direction: 'earn',
    amount: 100,
  })
  await seed(page, initial)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date(NOW) })
  await page.clock.pauseAt(new Date(NOW + 1000))
  await page.goto('/learning')
  await page.getByLabel('页面动画').uncheck()
  expect(
    await page
      .locator('.learn-reveal')
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('none')

  await page.getByRole('button', { name: '开始专项练习', exact: true }).click()
  await expect(page).toHaveURL(/\/learning\/practice\/practice-/)
  await submitCurrent(page, true)
  await expect(page.getByText('+3 学习金币已到账')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: '学习金币已到账' })).toHaveCount(0)

  await page.goto('/learning/farm')
  expect(
    await page
      .locator('.farm-crop.is-ready')
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe('none')
  await page.getByRole('button', { name: '商店与建筑', exact: true }).click()
  const buy = page.getByRole('button', { name: '购买第 5 块土地', exact: true })
  await buy.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(buy).toBeFocused()
  await page.keyboard.press('Enter')
  const confirm = page.getByRole('button', { name: '确认支付 100 金币', exact: true })
  await confirm.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.learn-local-nav__coin')).toContainText('3 金币')
})

test('T10-01/T10-02 多标签刷新、revision 冲突恢复和跨页投影保持唯一结果', async ({
  page,
  context,
}) => {
  const initial = createEmptyLearningSnapshot()
  initial.farm = claimStarterGift(initial.farm, { actionId: 'starter-gift', now: NOW })
  initial.farm = { ...initial.farm, inventory: { ...initial.farm.inventory, egg: 1 } }
  await seed(page, initial)
  await page.goto('/learning/farm')
  const other = await context.newPage()
  await other.goto('/learning')

  await page.getByRole('button', { name: '仓库与出售', exact: true }).click()
  await page
    .locator('.farm-inventory-item')
    .filter({ hasText: '鸡蛋' })
    .getByRole('button', { name: '出售', exact: true })
    .click()
  await page.getByRole('button', { name: /确认出售并获得/ }).click()
  await expect(other.locator('.learn-local-nav__coin')).toContainText('14 金币')
  await expect(other.getByText('0 / 30 题', { exact: true })).toBeVisible()

  await page.evaluate((key) => {
    const snapshot = JSON.parse(localStorage.getItem(key)!)
    snapshot.revision += 1
    snapshot.wallet.balance += 100
    snapshot.wallet.ledger.push({
      settlementId: 'external-update',
      occurredAt: Date.now(),
      source: 'activity',
      referenceId: 'external-update',
      direction: 'earn',
      amount: 100,
      balanceAfter: snapshot.wallet.balance,
    })
    localStorage.setItem(key, JSON.stringify(snapshot))
  }, LEARNING_STORAGE_KEY)
  await page.getByRole('button', { name: '商店与建筑', exact: true }).click()
  const radishCard = page.locator('section[aria-labelledby="farm-supply-radish-seed"]')
  await radishCard.getByRole('button', { name: '购买 1 件', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '其他页面更新' })).toBeVisible()
  const conflicted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    LEARNING_STORAGE_KEY,
  )
  expect(conflicted.farm.inventory['radish-seed']).toBe(4)
  expect(conflicted.wallet.balance).toBe(114)

  await page.getByRole('button', { name: '重新读取', exact: true }).click()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('114 金币')
  await radishCard.getByRole('button', { name: '购买 1 件', exact: true }).click()
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    LEARNING_STORAGE_KEY,
  )
  expect(saved.farm.inventory['radish-seed']).toBe(5)
  expect(saved.wallet.balance).toBe(108)
  expect(
    saved.wallet.ledger.filter(
      (entry: { referenceId: string }) => entry.referenceId === 'radish-seed',
    ),
  ).toHaveLength(1)
  await other.close()
})

function populateYear(snapshot: LearningSnapshot): void {
  const records: LearningRecord[] = []
  for (let day = 0; day < 365; day += 1) {
    for (let question = 0; question < 30; question += 1) {
      const id = `${day}-${question}`
      const occurredAt = NOW - day * DAY + question * 1000
      records.push({
        id,
        questionInstanceId: id,
        templateId: 't',
        templateVersion: 1,
        courseId: 'c',
        knowledgePointId: 'written-division-by-two-digits',
        result: 'first-correct',
        attempts: 1,
        highestHintLevel: 0,
        explanationViewed: false,
        errorCauses: [],
        startedAt: occurredAt,
        settledAt: occurredAt,
      })
      snapshot.wallet = settleWallet(snapshot.wallet, {
        settlementId: id,
        occurredAt,
        source: 'practice',
        referenceId: id,
        direction: 'earn',
        amount: 1,
      })
    }
  }
  snapshot.learning.records = records
}

test('T10-05 365 天长历史可打开且只渲染分页，核心交互响应低于 200ms', async ({ page }) => {
  const initial = createEmptyLearningSnapshot()
  initial.farm = claimStarterGift(initial.farm, { actionId: 'starter-gift', now: NOW })
  populateYear(initial)
  await seed(page, initial)
  await page.clock.install({ time: new Date(NOW) })
  await page.clock.pauseAt(new Date(NOW))

  for (const path of ['/learning', '/learning/parent', '/learning/farm']) {
    const startedAt = Date.now()
    await page.goto(path)
    await expect(page.locator('.learn-page')).toBeVisible()
    expect(Date.now() - startedAt, `${path} 长历史打开耗时`).toBeLessThan(2_500)
  }
  await page.goto('/learning/records')
  await expect(page.locator('.learn-record-list').first().locator('li')).toHaveCount(20)
  await expect(page.locator('.learn-record-list').nth(1).locator('li')).toHaveCount(20)
  expect(await page.locator('.learn-record-list li').count()).toBe(40)

  const next = page.getByRole('button', { name: '下一页', exact: true }).first()
  const elapsed = await next.evaluate((button: HTMLButtonElement) => {
    const start = performance.now()
    button.click()
    return performance.now() - start
  })
  await expect(page.getByText('第 2 / 548 页', { exact: false }).first()).toBeVisible()
  expect(elapsed).toBeLessThan(200)
})

test('T10-05 反复进入农场不累积定时器或监听器，后台页面停止刷新', async ({ page }) => {
  await page.addInitScript(() => {
    const active = new Set<number>()
    const storageListeners = new Set<EventListenerOrEventListenerObject>()
    const visibilityListeners = new Set<EventListenerOrEventListenerObject>()
    const nativeTimeout = window.setTimeout.bind(window)
    const nativeClear = window.clearTimeout.bind(window)
    const nativeWindowAdd = window.addEventListener.bind(window)
    const nativeWindowRemove = window.removeEventListener.bind(window)
    const nativeDocumentAdd = document.addEventListener.bind(document)
    const nativeDocumentRemove = document.removeEventListener.bind(document)
    const state = { active, storageListeners, visibilityListeners, hidden: false }
    Object.assign(window, { __farmTimerTest: state })
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const onFarm = location.pathname === '/learning/farm' && timeout === 60_000
      let id = 0
      id = nativeTimeout(() => {
        active.delete(id)
        if (typeof handler === 'function') handler(...args)
        else eval(String(handler))
      }, timeout)
      if (onFarm) active.add(id)
      return id
    }) as typeof window.setTimeout
    window.clearTimeout = ((id?: number) => {
      if (id !== undefined) active.delete(id)
      nativeClear(id)
    }) as typeof window.clearTimeout
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'storage' && location.pathname === '/learning/farm') {
        storageListeners.add(listener)
      }
      nativeWindowAdd(type, listener, options)
    }) as typeof window.addEventListener
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      if (type === 'storage') storageListeners.delete(listener)
      nativeWindowRemove(type, listener, options)
    }) as typeof window.removeEventListener
    document.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'visibilitychange' && location.pathname === '/learning/farm') {
        visibilityListeners.add(listener)
      }
      nativeDocumentAdd(type, listener, options)
    }) as typeof document.addEventListener
    document.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      if (type === 'visibilitychange') visibilityListeners.delete(listener)
      nativeDocumentRemove(type, listener, options)
    }) as typeof document.removeEventListener
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => state.hidden,
    })
  })
  await page.goto('/learning/farm')
  await expect(page.locator('.farm-workspace')).toBeVisible()
  const lifecycleCounts = () =>
    page.evaluate(() => {
      const state = (
        window as unknown as {
          __farmTimerTest: {
            active: Set<number>
            storageListeners: Set<EventListenerOrEventListenerObject>
            visibilityListeners: Set<EventListenerOrEventListenerObject>
          }
        }
      ).__farmTimerTest
      return {
        timers: state.active.size,
        storageListeners: state.storageListeners.size,
        visibilityListeners: state.visibilityListeners.size,
      }
    })
  expect(await lifecycleCounts()).toEqual({
    timers: 1,
    storageListeners: 1,
    visibilityListeners: 1,
  })
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('link', { name: '学习首页', exact: true }).click()
    await expect(page).toHaveURL(/\/learning$/)
    await expect(page.locator('.farm-workspace')).toHaveCount(0)
    expect(await lifecycleCounts()).toEqual({
      timers: 0,
      storageListeners: 0,
      visibilityListeners: 0,
    })
    await page.getByRole('link', { name: '学习农场', exact: true }).click()
    await expect(page).toHaveURL(/\/learning\/farm$/)
    await expect(page.locator('.farm-workspace')).toBeVisible()
    expect(await lifecycleCounts()).toEqual({
      timers: 1,
      storageListeners: 1,
      visibilityListeners: 1,
    })
  }
  await page.evaluate(() => {
    const state = (window as unknown as { __farmTimerTest: { hidden: boolean } }).__farmTimerTest
    state.hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect((await lifecycleCounts()).timers).toBe(0)
  await page.evaluate(() => {
    const state = (window as unknown as { __farmTimerTest: { hidden: boolean } }).__farmTimerTest
    state.hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect((await lifecycleCounts()).timers).toBe(1)
})
