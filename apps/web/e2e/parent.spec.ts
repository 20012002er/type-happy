import { expect, test, type Page } from '@playwright/test'
import { claimStarterGift } from '../src/learning/farm/farm'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../src/learning/persistence/snapshot'
import type { QuestionSnapshot } from '../src/learning/types'

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

async function useFixedClock(page: Page): Promise<void> {
  await page.clock.install({ time: new Date(NOW) })
  await page.clock.pauseAt(new Date(NOW))
}

async function snapshot(page: Page): Promise<LearningSnapshot> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), LEARNING_STORAGE_KEY)
}

async function submitFirstCorrect(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/learning\/practice\/practice-/)
  const sessionId = page.url().split('/').pop()
  if (!sessionId) throw new Error('练习组 URL 缺少 ID')
  const question = (await page.evaluate(
    ({ key, id }) => {
      const value = JSON.parse(localStorage.getItem(key)!)
      const session = value.practice.sessions[id]
      return session.questions[session.currentIndex].question
    },
    { key: LEARNING_STORAGE_KEY, id: sessionId },
  )) as QuestionSnapshot
  const answer = question.standardAnswer
  if (answer.kind === 'number') {
    await page.getByLabel('答案', { exact: true }).fill(String(answer.value))
  } else if (answer.kind === 'quotient-remainder') {
    await page.getByLabel('商', { exact: true }).fill(String(answer.quotient))
    await page.getByLabel('余数', { exact: true }).fill(String(answer.remainder))
  } else if (answer.kind === 'word-problem') {
    await page.locator('input[name="word-problem-value"]').fill(String(answer.value))
    await page.locator('input[name="word-problem-unit"]').fill(answer.unit ?? '')
  } else {
    throw new Error('当前练习仅支持数值、商余数和应用题')
  }
  await page.getByRole('button', { name: '提交答案', exact: true }).click()
}

test('E2E-07 每日目标次日生效，不改写当日任务、历史记录或已发奖励', async ({ page }) => {
  await useFixedClock(page)
  await page.goto('/learning/parent')
  await page.getByLabel('次日起每日目标').selectOption('35')
  await page.getByRole('button', { name: '保存每日目标', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('从 2026-11-21 起调整为 35 题')
  await expect(page.locator('.parent-goal__facts')).toContainText('今日目标 30 题')
  await expect(page.locator('.parent-goal__facts')).toContainText('次日目标 35 题')

  await page.goto('/learning')
  await expect(page.locator('.learn-course-option').first()).toBeEnabled()
  await page.locator('.learn-course-option').filter({ hasText: '四年级上学期' }).click()
  await page.getByRole('button', { name: '开始四年级上学期数学综合练习', exact: true }).click()
  await expect(page).toHaveURL(/\/learning\/practice\/practice-/)
  expect(
    (await snapshot(page)).practice.sessions[page.url().split('/').pop()!].questions,
  ).toHaveLength(30)
  await submitFirstCorrect(page)
  await expect(page.getByText('+3 学习金币已到账')).toBeVisible()
  await page.getByRole('button', { name: '结束本组', exact: true }).click()
  await page.getByRole('button', { name: '确认结束本组', exact: true }).click()

  const beforeNextDay = await snapshot(page)
  expect(beforeNextDay.tasks.daily['2026-11-20']).toEqual({
    goal: 30,
    completed: 1,
    rewarded: false,
  })
  const oldRecords = beforeNextDay.learning.records
  const oldLedger = beforeNextDay.wallet.ledger

  await page.clock.fastForward(DAY)
  await page.goto('/learning/parent')
  await expect(page.locator('.parent-goal__facts')).toContainText('今日目标 35 题')
  await expect(page.locator('.parent-goal__facts')).toContainText('次日目标 35 题')
  await page.goto('/learning')
  await page.getByRole('button', { name: '开始四年级上学期数学综合练习', exact: true }).click()
  await expect(page).toHaveURL(/\/learning\/practice\/practice-/)
  const afterNextDay = await snapshot(page)
  expect(afterNextDay.practice.sessions[page.url().split('/').pop()!].questions).toHaveLength(35)
  expect(afterNextDay.tasks.daily['2026-11-20']).toEqual({
    goal: 30,
    completed: 1,
    rewarded: false,
  })
  expect(afterNextDay.learning.records).toEqual(oldRecords)
  expect(afterNextDay.wallet.ledger).toEqual(oldLedger)
})

test('E2E-14 清档取消、删除失败重试、损坏存档恢复与原模块隔离', async ({ page }) => {
  await seed(page, createEmptyLearningSnapshot())
  await page.addInitScript(() => {
    localStorage.setItem('typing-progress', 'keep-typing')
    localStorage.setItem('game-save', 'keep-game')
    localStorage.setItem('taoyuan-save', 'keep-taoyuan')
  })
  await page.goto('/learning/parent')
  await expect(page.getByText('没有账号或多设备同步', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '清除学习数据', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('清除后无法恢复')
  await page.getByRole('button', { name: '取消，不执行', exact: true }).click()
  expect(
    await page.evaluate((key) => localStorage.getItem(key), LEARNING_STORAGE_KEY),
  ).not.toBeNull()

  await page.evaluate(() => {
    const original = Storage.prototype.removeItem
    let failOnce = true
    Storage.prototype.removeItem = function (key) {
      if (failOnce && key === 'type-happy:learning:snapshot') {
        failOnce = false
        throw new DOMException('Injected remove failure', 'SecurityError')
      }
      return original.call(this, key)
    }
  })
  await page.getByRole('button', { name: '清除学习数据', exact: true }).click()
  await page.getByRole('button', { name: '确认清除，不可撤销', exact: true }).click()
  await expect(page.locator('.farm-dialog__error')).toContainText('学习数据暂未清除')
  expect(
    await page.evaluate((key) => localStorage.getItem(key), LEARNING_STORAGE_KEY),
  ).not.toBeNull()
  await page.getByRole('button', { name: '确认清除，不可撤销', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), LEARNING_STORAGE_KEY)).toBeNull()

  await page.evaluate((key) => localStorage.setItem(key, '{broken-json'), LEARNING_STORAGE_KEY)
  await page.reload()
  await expect(page.getByText('学习存档已损坏', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '清除学习数据', exact: true }).click()
  await page.getByRole('button', { name: '确认清除，不可撤销', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('学习、金币和农场记录已清除')
  expect(await page.evaluate((key) => localStorage.getItem(key), LEARNING_STORAGE_KEY)).toBeNull()
  for (const [key, value] of [
    ['typing-progress', 'keep-typing'],
    ['game-save', 'keep-game'],
    ['taoyuan-save', 'keep-taoyuan'],
  ]) {
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(value)
  }
})

test('E2E-16 练习和农场出售后的知识点、任务与金币流水保持一致', async ({ page }) => {
  const initial = createEmptyLearningSnapshot()
  initial.farm = claimStarterGift(initial.farm, { actionId: 'starter-gift', now: NOW })
  initial.farm = { ...initial.farm, inventory: { ...initial.farm.inventory, egg: 1 } }
  await seed(page, initial)
  await useFixedClock(page)
  await page.goto('/learning')
  const specialButton = page.getByRole('button', { name: '开始专项练习', exact: true })
  await expect(specialButton).toBeEnabled()
  await specialButton.click()
  await submitFirstCorrect(page)
  await expect(page.getByText('+3 学习金币已到账')).toBeVisible()

  await page.getByRole('link', { name: '学习农场', exact: true }).click()
  await page.getByRole('button', { name: '仓库与出售', exact: true }).click()
  const eggRow = page.locator('.farm-inventory-item').filter({ hasText: '鸡蛋' })
  await eggRow.getByRole('button', { name: '出售', exact: true }).click()
  await page.getByRole('button', { name: /确认出售并获得/ }).click()
  const afterSale = await snapshot(page)
  const sale = afterSale.wallet.ledger.find((entry) => entry.source === 'farm-sale')
  expect(sale).toBeDefined()
  expect(afterSale.tasks.daily['2026-11-20'].completed).toBe(1)

  await page.getByRole('link', { name: '家长设置', exact: true }).click()
  await expect(page.locator('.parent-metrics')).toContainText(/有效完成\s*1/)
  await expect(page.locator('.parent-metrics')).toContainText(/首次答对\s*1/)
  await expect(page.locator('.parent-metrics')).toContainText(/提示后订正\s*0/)
  await expect(page.locator('.parent-metrics')).toContainText(/讲解后订正\s*0/)
  await expect(page.locator('#today-summary-title').locator('../..')).toContainText(
    '任务 1 / 30 题',
  )
  const practiceRow = page.locator('.parent-table tbody tr').filter({ hasText: '练习奖励' })
  await expect(practiceRow).toContainText('+3')
  const saleRow = page.locator('.parent-table tbody tr').filter({ hasText: '农产品出售' })
  await expect(saleRow).toContainText(`+${sale!.amount}`)
  await expect(page.locator('.parent-recent-ledger')).toContainText('练习奖励')
  await expect(page.locator('.parent-recent-ledger')).toContainText('农产品出售')

  await page.getByRole('link', { name: '金币流水', exact: true }).click()
  await expect(page.locator('.learn-record-list').first()).toContainText('首次答对')
  await expect(page.locator('.learn-record-list').nth(1)).toContainText('农产品出售')
  expect((await snapshot(page)).tasks.daily['2026-11-20'].completed).toBe(1)
})
