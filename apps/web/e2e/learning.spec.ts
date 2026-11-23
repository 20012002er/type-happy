import { expect, test, type Page } from '@playwright/test'
import type { Answer, QuestionSnapshot } from '../src/learning/types'

async function startSpecial(page: Page): Promise<void> {
  await page.goto('/learning')
  const courseSetup = page.getByRole('button', { name: '按默认课程设置' })
  if (await courseSetup.isVisible()) await courseSetup.click()
  await page.getByRole('button', { name: '开始专项练习', exact: true }).click()
  await expect(page).toHaveURL(/\/learning\/practice\/practice-/)
}

function currentSessionId(page: Page): string {
  const id = page.url().split('/').pop()
  if (!id) throw new Error('练习组 URL 缺少 ID')
  return id
}

async function currentQuestion(page: Page): Promise<QuestionSnapshot> {
  const id = currentSessionId(page)
  return page.evaluate((sessionId) => {
    const raw = localStorage.getItem('type-happy:learning:snapshot')
    if (!raw) throw new Error('学习快照不存在')
    const snapshot = JSON.parse(raw)
    const session = snapshot.practice.sessions[sessionId]
    return session.questions[session.currentIndex].question
  }, id) as Promise<QuestionSnapshot>
}

function wrongAnswer(answer: Answer): Answer {
  if (answer.kind === 'number') return { kind: 'number', value: answer.value + 1 }
  if (answer.kind !== 'quotient-remainder') throw new Error('当前练习仅支持数值题和商余数题')
  return {
    kind: 'quotient-remainder',
    quotient: answer.quotient + 1,
    remainder: answer.remainder,
  }
}

async function fillAnswer(page: Page, answer: Answer): Promise<void> {
  if (answer.kind === 'number') {
    await page.getByLabel('答案', { exact: true }).fill(String(answer.value))
  } else if (answer.kind === 'quotient-remainder') {
    await page.getByLabel('商', { exact: true }).fill(String(answer.quotient))
    await page.getByLabel('余数', { exact: true }).fill(String(answer.remainder))
  } else {
    throw new Error('当前练习仅支持数值题和商余数题')
  }
}

async function submitCurrent(page: Page, answer?: Answer): Promise<void> {
  const value = answer ?? (await currentQuestion(page)).standardAnswer
  await fillAnswer(page, value)
  await page.getByRole('button', { name: /提交答案|提交订正/ }).click()
}

async function advance(page: Page): Promise<void> {
  await page.getByRole('button', { name: /保存并进入下一题|查看本组结果/ }).click()
}

test('学习首访显示默认课程，体验设置与任务导航可用', async ({ page }) => {
  await page.goto('/learning')
  await expect(page).toHaveTitle(/学习 · 打字乐园/)
  await expect(page.getByText('给家长：首次课程设置')).toBeVisible()
  await expect(page.getByText('每日 30 题', { exact: false })).toBeVisible()
  await expect(page.getByText('包含两位数除法', { exact: false }).first()).toBeVisible()

  await page.getByRole('button', { name: '按默认课程设置' }).click()
  await expect(page.getByText('给家长：首次课程设置')).toHaveCount(0)
  await page.getByLabel('正反馈音效').uncheck()
  await page.getByLabel('页面动画').uncheck()
  await page.reload()
  await expect(page.getByLabel('正反馈音效')).not.toBeChecked()
  await expect(page.getByLabel('页面动画')).not.toBeChecked()

  await page.getByRole('link', { name: '今日任务', exact: true }).click()
  await expect(page).toHaveURL(/\/learning\/tasks$/)
  await expect(page.getByRole('heading', { name: '有效完成 30 题' })).toBeVisible()
  await expect(page.getByText('当前连续 0 天')).toBeVisible()
})

test('首次答错、二级讲解、订正和整组完成形成可读结果', async ({ page }) => {
  test.setTimeout(60_000)
  await startSpecial(page)
  const first = await currentQuestion(page)
  const wrong = wrongAnswer(first.standardAnswer)
  await submitCurrent(page, wrong)
  await expect(page.getByText('提示 1：', { exact: false })).toBeVisible()
  if (first.standardAnswer.kind === 'number') {
    await expect(page.getByLabel('答案', { exact: true })).toHaveValue(
      String(wrong.kind === 'number' ? wrong.value : ''),
    )
  }

  await page.getByRole('button', { name: '提交订正', exact: true }).click()
  await expect(page.getByText('提示 2：', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: '分步讲解' })).toBeVisible()
  await expect(page.getByText('正确答案：', { exact: false })).toBeVisible()

  await fillAnswer(page, first.standardAnswer)
  await page.getByRole('button', { name: '提交订正', exact: true }).click()
  await expect(page.getByText('本题不发放金币；', { exact: false })).toBeVisible()
  await advance(page)

  await submitCurrent(page)
  await expect(page.getByText('+3 学习金币已到账')).toBeVisible()
  await advance(page)

  for (let index = 2; index < 10; index += 1) {
    await submitCurrent(page)
    await advance(page)
  }

  await expect(page.getByRole('heading', { name: '这一组完成了' })).toBeVisible()
  await expect(page.getByText('完成 10 题，订正 1 题。', { exact: false })).toBeVisible()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('27 金币')
  await expect(page.getByRole('heading', { name: '第 11 / 10 题' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { name: '这一组完成了' })).toBeVisible()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('27 金币')
})

test('保存失败不伪造到账，重试与刷新续做保留正确状态', async ({ page }) => {
  await startSpecial(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    let failOnce = true
    Storage.prototype.setItem = function (key, value) {
      if (failOnce && key === 'type-happy:learning:snapshot') {
        failOnce = false
        throw new DOMException('Injected quota failure', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }
  })

  const first = await currentQuestion(page)
  await submitCurrent(page)
  await expect(page.getByRole('alert').filter({ hasText: '本次进度暂未保存' })).toBeVisible()
  await expect(page.getByText('+3 学习金币已到账')).toHaveCount(0)
  await expect(page.locator('.learn-local-nav__coin')).toContainText('0 金币')

  await page.getByRole('button', { name: '提交答案', exact: true }).click()
  await expect(page.getByText('+3 学习金币已到账')).toBeVisible()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('3 金币')
  await advance(page)

  const second = await currentQuestion(page)
  const wrong = wrongAnswer(second.standardAnswer)
  await submitCurrent(page, wrong)
  await expect(page.getByText('提示 1：', { exact: false })).toBeVisible()
  await page.reload()
  await expect(page.getByText('提示 1：', { exact: false })).toBeVisible()
  if (wrong.kind === 'number') {
    await expect(page.getByLabel('答案', { exact: true })).toHaveValue(String(wrong.value))
  }

  await fillAnswer(page, second.standardAnswer)
  await page.getByRole('button', { name: '提交订正', exact: true }).click()
  await expect(page.getByText('+1 学习金币已到账')).toBeVisible()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('4 金币')
  expect(first.instanceId).not.toBe(second.instanceId)
})

test('同一组跨过每日达标点自动切换为加练标准', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const snapshot = {
      schemaVersion: 2,
      revision: 0,
      learning: { records: [] },
      practice: { sessions: {}, retestPool: [] },
      tasks: {
        daily: { [dateKey]: { goal: 30, completed: 29, rewarded: false } },
        streak: { current: 0, longest: 0, lastCompletedDateKey: null },
      },
      wallet: { balance: 0, ledger: [] },
      farm: { starterGiftClaimed: false, inventory: {} },
    }
    if (!localStorage.getItem('type-happy:learning:snapshot')) {
      localStorage.setItem('type-happy:learning:snapshot', JSON.stringify(snapshot))
    }
  })
  await startSpecial(page)

  await submitCurrent(page)
  await expect(page.getByText('+3 学习金币已到账')).toBeVisible()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('23 金币')
  await advance(page)

  await submitCurrent(page)
  await expect(page.getByText('+2 学习金币已到账')).toBeVisible()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('25 金币')
  await expect(page.getByText('现在是加练')).toBeVisible()
  await page.reload()
  await expect(page.getByText('第 3 / 10 题', { exact: true })).toBeVisible()
  await expect(page.locator('.learn-local-nav__coin')).toContainText('25 金币')

  await page.getByRole('link', { name: '今日任务', exact: true }).click()
  await expect(page.getByText('30 金币每日奖励已经到账', { exact: false })).toHaveCount(0)
  await expect(page.getByText('20 金币每日奖励已经到账', { exact: false })).toBeVisible()
  await expect(page.getByText('加练不重复增加每日进度', { exact: false })).toBeVisible()
})
