import { expect, test } from '@playwright/test'
import { claimStarterGift } from '../src/learning/farm/farm'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
} from '../src/learning/persistence/snapshot'
import { settleWallet } from '../src/learning/wallet/wallet'

test('主站首页与游戏路由可访问', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/打字乐园/)
  await expect(page.getByRole('heading', { name: /每天十分钟/ })).toBeVisible()

  await page.getByRole('link', { name: '打字游戏', exact: true }).click()
  await expect(page).toHaveURL(/\/games$/)
  await expect(page.getByRole('heading', { name: '打字游戏', exact: true })).toBeVisible()
})

test('E2E-27 学习后进入桃源与原游戏，学习金币与存档互相隔离', async ({ page }) => {
  const NOW = new Date(2026, 10, 20, 12).getTime()
  const initial = createEmptyLearningSnapshot()
  initial.farm = claimStarterGift(initial.farm, { actionId: 'starter-gift', now: NOW })
  initial.wallet = settleWallet(initial.wallet, {
    settlementId: 'isolation-fund',
    occurredAt: NOW,
    source: 'practice',
    referenceId: 'isolation-fund',
    direction: 'earn',
    amount: 123,
  })
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value)
    },
    { key: LEARNING_STORAGE_KEY, value: JSON.stringify(initial) },
  )
  await page.goto('/learning')
  await expect(page.locator('.learn-local-nav__coin')).toContainText('123 金币')
  const before = await page.evaluate((key) => localStorage.getItem(key), LEARNING_STORAGE_KEY)

  // 原打字课程入口正常
  await page.goto('/courses')
  await expect(page.getByRole('heading', { name: '全部课程', exact: true })).toBeVisible()

  // 桃源独立 iframe 运行，不触碰学习存档
  await page.goto('/games/taoyuan')
  const taoyuan = page.locator('iframe[title="桃源乡"]')
  await expect(taoyuan).toBeVisible()
  await expect(taoyuan).toHaveAttribute('src', '/games/taoyuan/index.html')
  await expect(page.frameLocator('iframe[title="桃源乡"]').locator('body')).toBeVisible()

  // 原放置游戏入口正常
  await page.goto('/games/idle')
  await expect(page.getByRole('heading', { name: '⚔️ 放置刷装备', exact: true })).toBeVisible()
  await page.goto('/games/wulin')
  await expect(page.getByRole('heading', { name: '🏯 放置武林', exact: true })).toBeVisible()

  // 学习存档逐字不变，余额不被串用
  const after = await page.evaluate((key) => localStorage.getItem(key), LEARNING_STORAGE_KEY)
  expect(after).toBe(before)
  await page.goto('/learning')
  await expect(page.locator('.learn-local-nav__coin')).toContainText('123 金币')
})
