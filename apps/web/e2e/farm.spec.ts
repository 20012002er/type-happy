import { expect, test, type Page } from '@playwright/test'
import { claimStarterGift, plantCrop } from '../src/learning/farm/farm'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../src/learning/persistence/snapshot'
import { settleWallet } from '../src/learning/wallet/wallet'

const NOW = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE

function fundedFarm(balance = 2_000): LearningSnapshot {
  const snapshot = createEmptyLearningSnapshot()
  snapshot.farm = claimStarterGift(snapshot.farm, { actionId: 'starter-gift', now: NOW })
  if (balance > 0) {
    snapshot.wallet = settleWallet(snapshot.wallet, {
      settlementId: 'initial-fund',
      occurredAt: NOW,
      source: 'practice',
      referenceId: 'initial-fund',
      direction: 'earn',
      amount: balance,
    })
  }
  return snapshot
}

async function seed(page: Page, snapshot: LearningSnapshot): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value)
    },
    { key: LEARNING_STORAGE_KEY, value: JSON.stringify(snapshot) },
  )
}

async function openFarm(page: Page, snapshot: LearningSnapshot): Promise<void> {
  await seed(page, snapshot)
  await page.clock.install({ time: new Date(NOW) })
  await page.clock.pauseAt(new Date(NOW))
  await page.goto('/learning/farm')
}

async function snapshot(page: Page): Promise<LearningSnapshot> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), LEARNING_STORAGE_KEY)
}

async function switchTab(
  page: Page,
  name: '农场' | '加工坊' | '商店与建筑' | '仓库与出售',
): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click()
}

interface ProcessingFarmOptions {
  balance?: number
  purchased?: boolean
  inventory?: Record<string, number>
  harvests?: { crops?: number; eggs?: number; milk?: number }
}

function processingFarm(options: ProcessingFarmOptions = {}): LearningSnapshot {
  const snapshot = fundedFarm(options.balance ?? 0)
  const actions: Record<string, string> = { ...snapshot.farm.actions }
  const animals = [...snapshot.farm.animals]
  const buildings = { ...snapshot.farm.buildings }
  for (let index = 0; index < (options.harvests?.crops ?? 0); index += 1) {
    actions[`harvest-crop-${index}`] = JSON.stringify({
      type: 'harvest-crop',
      now: NOW,
      plotId: 'plot-1',
    })
  }
  if (options.harvests?.milk) {
    buildings.cowshed = { level: 1 }
    animals.push({ id: 'cow-1', kind: 'cow', production: null, productPending: false })
  }
  for (let index = 0; index < (options.harvests?.eggs ?? 0); index += 1) {
    actions[`collect-egg-${index}`] = JSON.stringify({
      type: 'collect-animal-product',
      now: NOW,
      animalId: 'chicken-1',
    })
  }
  for (let index = 0; index < (options.harvests?.milk ?? 0); index += 1) {
    actions[`collect-milk-${index}`] = JSON.stringify({
      type: 'collect-animal-product',
      now: NOW,
      animalId: 'cow-1',
    })
  }
  snapshot.farm = {
    ...snapshot.farm,
    animals,
    buildings,
    actions,
    inventory: { ...snapshot.farm.inventory, ...options.inventory },
  }
  if (options.purchased) {
    snapshot.processing = {
      workshop: { purchased: true, activeTask: null, pendingOutput: null },
      actions: {},
    }
  }
  return snapshot
}

async function openProcessing(page: Page): Promise<void> {
  await page.locator('.farm-tabs button').filter({ hasText: '加工坊' }).click()
}

function processingStatus(page: Page) {
  return page.locator('section[aria-labelledby="farm-processing-status-title"]')
}

function recipeCard(page: Page, recipeId: string) {
  return page.locator(`section[aria-labelledby="farm-recipe-${recipeId}"]`)
}

test('E2E-09 礼包、四种作物、化肥、顺序购地与建筑确认', async ({ page }) => {
  const initial = createEmptyLearningSnapshot()
  initial.wallet = settleWallet(initial.wallet, {
    settlementId: 'initial-fund',
    occurredAt: NOW,
    source: 'practice',
    referenceId: 'initial-fund',
    direction: 'earn',
    amount: 2_000,
  })
  await openFarm(page, initial)
  await page.getByRole('button', { name: '领取新手礼包', exact: true }).click()
  await expect(page.locator('.farm-plot')).toHaveCount(8)
  await expect(page.locator('.farm-plot:disabled')).toHaveCount(4)
  expect((await snapshot(page)).farm.starterGiftClaimed).toBe(true)

  for (const [index, crop, label] of [
    [1, 'radish', '萝卜'],
    [2, 'wheat', '小麦'],
    [3, 'corn', '玉米'],
    [4, 'pumpkin', '南瓜'],
  ] as const) {
    if (index > 1) {
      await page.evaluate(
        ({ crop }) => {
          const key = 'type-happy:learning:snapshot'
          const value = JSON.parse(localStorage.getItem(key)!)
          value.farm.inventory[`${crop}-seed`] = 1
          localStorage.setItem(key, JSON.stringify(value))
        },
        { crop },
      )
      await page.reload()
    }
    await page
      .locator('.farm-plot')
      .nth(index - 1)
      .click()
    await page.getByLabel('选择种子').selectOption(crop)
    await page.getByRole('button', { name: `播种${label}`, exact: true }).click()
  }
  const planted = await snapshot(page)
  expect(planted.farm.plots.map((plot) => plot.crop?.cropId)).toEqual([
    'radish',
    'wheat',
    'corn',
    'pumpkin',
  ])
  expect(planted.farm.plots.map((plot) => plot.crop!.readyAt - plot.crop!.plantedAt)).toEqual([
    5 * MINUTE,
    30 * MINUTE,
    2 * HOUR,
    8 * HOUR,
  ])

  await switchTab(page, '商店与建筑')
  await page
    .locator('.farm-shop-card')
    .filter({ has: page.locator('#farm-supply-fertilizer') })
    .getByRole('button', { name: '购买 1 件' })
    .click()
  await switchTab(page, '农场')
  await page.locator('.farm-plot').first().click()
  await page.getByRole('button', { name: '使用 1 袋化肥', exact: true }).click()
  expect((await snapshot(page)).farm.plots[0].crop?.readyAt).toBe(NOW + 150_000)

  await switchTab(page, '商店与建筑')
  const balance = (await snapshot(page)).wallet.balance
  await page.getByRole('button', { name: '购买第 5 块土地', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('总价：100 学习金币')
  await page.getByRole('button', { name: '取消，不执行', exact: true }).click()
  expect((await snapshot(page)).wallet.balance).toBe(balance)
  expect((await snapshot(page)).farm.plots).toHaveLength(4)
  await page.getByRole('button', { name: '购买第 5 块土地', exact: true }).click()
  await page.getByRole('button', { name: '确认支付 100 金币', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await snapshot(page)).farm.plots).toHaveLength(5)

  await page.getByRole('button', { name: '升级鸡舍', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('动物容量：2 → 4 个栏位')
  await page.getByRole('button', { name: '确认支付 300 金币', exact: true }).click()
  await expect(page.getByText('购买第 6 块土地后解锁', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '购买第 6 块土地', exact: true }).click()
  await page.getByRole('button', { name: '确认支付 160 金币', exact: true }).click()
  await page.getByRole('button', { name: '购买牛棚', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('动物容量：0 → 1 个栏位')
  await page.getByRole('button', { name: '确认支付 500 金币', exact: true }).click()
  expect((await snapshot(page)).farm.buildings).toEqual({
    chickenCoop: { level: 2 },
    cowshed: { level: 1 },
  })
})

test('E2E-10 鸡牛栏位、喂食、离线生产与单份产品收取', async ({ page }) => {
  const initial = fundedFarm()
  initial.farm = {
    ...initial.farm,
    plots: [...initial.farm.plots, { id: 'plot-5', crop: null }, { id: 'plot-6', crop: null }],
    buildings: { ...initial.farm.buildings, cowshed: { level: 1 } },
    inventory: { ...initial.farm.inventory, 'cow-feed': 2 },
  }
  await openFarm(page, initial)
  await switchTab(page, '商店与建筑')
  await page.getByRole('button', { name: '购买小鸡', exact: true }).click()
  await page.getByRole('button', { name: '购买奶牛', exact: true }).click()
  await expect(page.getByText('栏位已满，请先升级建筑', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('栏位：1 / 1', { exact: true })).toBeVisible()

  await switchTab(page, '农场')
  for (const name of [/鸡 1/, /鸡 2/, /牛 1/]) {
    await page.locator('.farm-animal').filter({ hasText: name }).click()
    await page.getByRole('button', { name: '喂食并开始生产', exact: true }).click()
  }
  await page.clock.fastForward(HOUR)
  await expect(page.locator('.farm-animal').filter({ hasText: /鸡 1/ })).toContainText('可收取')
  await expect(page.locator('.farm-animal').filter({ hasText: /牛 1/ })).toContainText('生产中')
  await page.locator('.farm-animal').filter({ hasText: /鸡 1/ }).click()
  await page.getByRole('button', { name: '收取产品', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.egg).toBe(1)
  await expect(page.locator('.farm-animal').filter({ hasText: /鸡 1/ })).toContainText('待喂食')

  await page.clock.fastForward(HOUR)
  await expect(page.locator('.farm-animal').filter({ hasText: /鸡 1/ })).toContainText('待喂食')
  expect((await snapshot(page)).farm.inventory.egg).toBe(1)
  await page.locator('.farm-animal').filter({ hasText: /牛 1/ }).click()
  await page.getByRole('button', { name: '收取产品', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.milk).toBe(1)
  expect((await snapshot(page)).farm.animals).toHaveLength(3)
})

test('E2E-11 离线成熟入仓、单项与全部出售、上限和次日恢复', async ({ page }) => {
  const initial = fundedFarm(0)
  initial.farm = {
    ...initial.farm,
    inventory: { ...initial.farm.inventory, radish: 10 },
  }
  initial.farm = plantCrop(initial.farm, {
    actionId: 'offline-radish',
    now: NOW,
    plotId: 'plot-1',
    cropId: 'radish',
  })
  await openFarm(page, initial)
  await page.clock.fastForward(5 * MINUTE)
  await page.locator('.farm-plot').first().click()
  await page.getByRole('button', { name: '收获入仓', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.radish).toBe(11)
  expect((await snapshot(page)).wallet.balance).toBe(0)

  await switchTab(page, '仓库与出售')
  const radishQuantity = page.getByLabel('出售萝卜数量', { exact: true })
  await expect(radishQuantity).toHaveValue('1')
  await radishQuantity.fill('7')
  await expect(
    page.getByText('超出今日出售收入上限，当前最多可出售 6 件', { exact: true }).first(),
  ).toBeVisible()
  await radishQuantity.fill('6')
  await page
    .locator('.farm-inventory-item')
    .filter({ hasText: '萝卜' })
    .getByRole('button', { name: '出售', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('萝卜 × 6，单价 9，小计 54 金币')
  await page.getByRole('button', { name: '取消，不执行', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.radish).toBe(11)
  await page
    .locator('.farm-inventory-item')
    .filter({ hasText: '萝卜' })
    .getByRole('button', { name: '出售', exact: true })
    .click()
  await page.getByRole('button', { name: '确认出售并获得 54 金币', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.radish).toBe(5)
  expect((await snapshot(page)).wallet.balance).toBe(54)
  await expect(page.getByRole('button', { name: '出售全部可售物品', exact: true })).toBeDisabled()

  await page.clock.fastForward(24 * HOUR)
  await expect(page.getByRole('button', { name: '出售全部可售物品', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '出售全部可售物品', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('合计：5 件，45 学习金币')
  await page.getByRole('button', { name: '确认出售并获得 45 金币', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.radish).toBe(0)
  expect((await snapshot(page)).wallet.balance).toBe(99)
})

test('E2E-12 无资产补给每日一次且不直接发金币', async ({ page }) => {
  const initial = fundedFarm(0)
  initial.farm = { ...initial.farm, inventory: {} }
  await openFarm(page, initial)
  await page.getByRole('button', { name: '领取恢复补给', exact: true }).click()
  expect((await snapshot(page)).farm.inventory['radish-seed']).toBe(2)
  expect((await snapshot(page)).wallet.balance).toBe(0)
  await expect(page.getByRole('button', { name: '领取恢复补给', exact: true })).toHaveCount(0)

  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key)!)
    value.farm.inventory = {}
    localStorage.setItem(key, JSON.stringify(value))
  }, LEARNING_STORAGE_KEY)
  await page.clock.fastForward(24 * HOUR)
  await page.reload()
  await page.getByRole('button', { name: '领取恢复补给', exact: true }).click()
  expect((await snapshot(page)).farm.inventory['radish-seed']).toBe(2)
  expect((await snapshot(page)).farm.recoveryClaimDates).toHaveLength(2)
  expect((await snapshot(page)).wallet.ledger).toHaveLength(0)
})

test('E2E-13 余额差额、重复确认、保存失败刷新与重试只结算一次', async ({ page }) => {
  await openFarm(page, fundedFarm(106))
  await switchTab(page, '商店与建筑')
  await page.getByRole('button', { name: '购买第 5 块土地', exact: true }).click()
  await page
    .getByRole('button', { name: '确认支付 100 金币', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await snapshot(page)).farm.plots).toHaveLength(5)
  expect((await snapshot(page)).wallet.balance).toBe(6)
  expect(
    (await snapshot(page)).wallet.ledger.filter((entry) => entry.referenceId === 'plot-5'),
  ).toHaveLength(1)
  await expect(page.getByText('学习金币不足，还差 2 金币', { exact: true }).first()).toBeVisible()

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
  await page
    .locator('.farm-shop-card')
    .filter({ has: page.locator('#farm-supply-radish-seed') })
    .getByRole('button', { name: '购买 1 件' })
    .click()
  await expect(page.getByRole('alert').filter({ hasText: '本次进度暂未保存' })).toBeVisible()
  expect((await snapshot(page)).wallet.balance).toBe(6)
  await page.reload()
  await switchTab(page, '商店与建筑')
  await page
    .locator('.farm-shop-card')
    .filter({ has: page.locator('#farm-supply-radish-seed') })
    .getByRole('button', { name: '购买 1 件' })
    .click()
  const result = await snapshot(page)
  expect(result.wallet.balance).toBe(0)
  expect(result.farm.inventory['radish-seed']).toBe(5)
  expect(result.wallet.ledger.filter((entry) => entry.referenceId === 'radish-seed')).toHaveLength(
    1,
  )
})

test('WP09 动态画布装饰层、减动效静态降级与 360px 可操作', async ({ page }) => {
  await openFarm(page, fundedFarm())

  // Pixi 画布只作装饰层：aria-hidden，DOM 文字与按钮保持完整
  await expect(page.locator('.farm-scene__canvas canvas')).toBeVisible()
  await expect(page.locator('.farm-scene')).toHaveClass(/farm-scene--pixi/)
  await expect(page.locator('.farm-scene__canvas')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.farm-plot')).toHaveCount(8)
  await expect(page.locator('.farm-building--processing')).toContainText(
    '累计手动收获 0 / 3 份后解锁购买',
  )

  // 播种后文字状态立即更新，画布不拦截点击
  await page.locator('.farm-plot').first().click()
  await page.getByRole('button', { name: '播种萝卜', exact: true }).click()
  await expect(page.locator('.farm-plot').first()).toContainText('萝卜 · 生长中')

  // 路由离开无残留画布，返回后重建
  await page.goto('/learning')
  await expect(page.locator('.farm-scene__canvas canvas')).toHaveCount(0)
  await page.goto('/learning/farm')
  await expect(page.locator('.farm-scene__canvas canvas')).toBeVisible()

  // 系统减少动态效果优先：画布静态降级，核心操作与文字反馈完整
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learning/farm')
  await expect(page.locator('.learn-page')).toHaveClass(/farm-no-motion/)
  await expect(page.locator('.farm-scene__canvas canvas')).toBeVisible()
  await page.locator('.farm-plot').nth(1).click()
  await page.getByRole('button', { name: '播种萝卜', exact: true }).click()
  await expect(page.locator('.farm-plot').nth(1)).toContainText('萝卜 · 生长中')

  // 360px 视口仍可完成选择与播种
  await page.setViewportSize({ width: 360, height: 740 })
  await page.locator('.farm-plot').nth(2).click()
  await page.getByRole('button', { name: '播种萝卜', exact: true }).click()
  await expect(page.locator('.farm-plot').nth(2)).toContainText('萝卜 · 生长中')

  const stored = await snapshot(page)
  expect(stored.farm.plots.filter((plot) => plot.crop !== null)).toHaveLength(3)
  expect(stored.farm.inventory['radish-seed']).toBe(1)
})

test('E2E-17 老用户满足收获条件购买加工坊，余额不足不扣款', async ({ page }) => {
  await openFarm(page, processingFarm({ balance: 239, harvests: { crops: 3 } }))
  await expect(page.locator('.farm-building--processing')).toContainText(
    '已解锁购买资格，售价 240 学习金币',
  )
  await openProcessing(page)
  await expect(page.getByText('学习金币不足，还差 1 金币', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '去学习赚金币', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '购买加工坊', exact: true })).toBeDisabled()

  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: LEARNING_STORAGE_KEY,
    value: JSON.stringify(processingFarm({ balance: 500, harvests: { crops: 3 } })),
  })
  await page.reload()
  await openProcessing(page)
  await page.getByRole('button', { name: '购买加工坊', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('总价：240 学习金币')
  await expect(page.getByRole('dialog')).toContainText('购买后余额：260 金币')
  await expect(page.getByRole('dialog')).toContainText('只有 1 个加工位')
  await page.getByRole('button', { name: '取消，不执行', exact: true }).click()
  expect((await snapshot(page)).wallet.balance).toBe(500)
  expect((await snapshot(page)).processing.workshop.purchased).toBe(false)

  await page.getByRole('button', { name: '购买加工坊', exact: true }).click()
  await page.getByRole('button', { name: '确认支付 240 金币', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const bought = await snapshot(page)
  expect(bought.wallet.balance).toBe(260)
  expect(bought.processing.workshop.purchased).toBe(true)
  expect(
    bought.wallet.ledger.filter((entry) => entry.source === 'processing-purchase'),
  ).toHaveLength(1)
  // 建成后只自动开放一次配方页与三步引导
  await expect(page.getByText('加工坊三步上手', { exact: true })).toBeVisible()
  await expect(recipeCard(page, 'flour')).toBeVisible()
  await page.getByRole('button', { name: '跳过引导', exact: true }).click()
  await page.reload()
  await openProcessing(page)
  await expect(page.getByText('加工坊三步上手', { exact: true })).toHaveCount(0)
})

test('E2E-18 小麦加工面粉：扣料、虚拟时间 20 分钟与手动收取', async ({ page }) => {
  await openFarm(
    page,
    processingFarm({ purchased: true, inventory: { wheat: 2 }, harvests: { crops: 3 } }),
  )
  await openProcessing(page)
  await recipeCard(page, 'flour').getByRole('button', { name: '开始加工面粉' }).click()
  await expect(page.getByRole('dialog')).toContainText('投入：小麦 × 2（库存 2 → 0）')
  await expect(page.getByRole('dialog')).toContainText('原料不可退回')
  await page.getByRole('button', { name: '确认投入并开始加工', exact: true }).click()
  const started = await snapshot(page)
  expect(started.farm.inventory.wheat).toBe(0)
  expect(started.processing.workshop.activeTask?.completesAt).toBe(NOW + 20 * MINUTE)
  await expect(processingStatus(page)).toContainText('剩余时间：20 分钟')
  await expect(
    processingStatus(page).getByRole('button', { name: '加工尚未完成，不能提前收取' }),
  ).toBeDisabled()

  await page.clock.fastForward(20 * MINUTE)
  await expect(processingStatus(page)).toContainText('加工完成 · 可收取')
  await processingStatus(page).getByRole('button', { name: '收取加工品入仓', exact: true }).click()
  const collected = await snapshot(page)
  expect(collected.farm.inventory.flour).toBe(1)
  expect(collected.processing.workshop.activeTask).toBeNull()
  expect(collected.processing.workshop.pendingOutput).toBeNull()
  await expect(processingStatus(page)).toContainText('空闲 · 可开始加工')
})

test('E2E-19 牛奶奶油与蛋奶布丁：解锁、时长、售价与共享上限', async ({ page }) => {
  await openFarm(
    page,
    processingFarm({
      purchased: true,
      inventory: { milk: 2, egg: 1 },
      harvests: { crops: 1, eggs: 1, milk: 1 },
    }),
  )
  await openProcessing(page)
  await expect(recipeCard(page, 'cream')).toContainText('已解锁')
  await expect(recipeCard(page, 'egg-milk-pudding')).toContainText('已解锁')

  await recipeCard(page, 'cream').getByRole('button', { name: '开始加工奶油' }).click()
  await page.getByRole('button', { name: '确认投入并开始加工', exact: true }).click()
  expect((await snapshot(page)).processing.workshop.activeTask?.completesAt).toBe(NOW + 30 * MINUTE)
  await page.clock.fastForward(30 * MINUTE)
  await processingStatus(page).getByRole('button', { name: '收取加工品入仓', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.cream).toBe(1)

  await recipeCard(page, 'egg-milk-pudding')
    .getByRole('button', { name: '开始加工蛋奶布丁' })
    .click()
  await page.getByRole('button', { name: '确认投入并开始加工', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.egg).toBe(0)
  expect((await snapshot(page)).farm.inventory.milk).toBe(0)
  await page.clock.fastForward(45 * MINUTE)
  await processingStatus(page).getByRole('button', { name: '收取加工品入仓', exact: true }).click()
  const collected = await snapshot(page)
  expect(collected.farm.inventory['egg-milk-pudding']).toBe(1)
  expect(collected.farm.inventory.cream).toBe(1)

  await switchTab(page, '仓库与出售')
  await page
    .locator('.farm-inventory-item')
    .filter({ hasText: '奶油' })
    .getByRole('button', { name: '出售', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('奶油 × 1，单价 48，小计 48 金币')
  await page.getByRole('button', { name: '确认出售并获得 48 金币', exact: true }).click()
  expect((await snapshot(page)).wallet.balance).toBe(48)
  // 剩余额度 12 金币：布丁 60 金币单项被拒，不扣库存
  await expect(
    page
      .locator('.farm-inventory-item')
      .filter({ hasText: '蛋奶布丁' })
      .getByText('超出今日出售收入上限，当前最多可出售 0 件', { exact: true }),
  ).toBeVisible()
  expect((await snapshot(page)).farm.inventory['egg-milk-pudding']).toBe(1)
  await page.clock.fastForward(24 * HOUR)
  await page
    .locator('.farm-inventory-item')
    .filter({ hasText: '蛋奶布丁' })
    .getByRole('button', { name: '出售', exact: true })
    .click()
  await page.getByRole('button', { name: '确认出售并获得 60 金币', exact: true }).click()
  const sold = await snapshot(page)
  expect(sold.wallet.balance).toBe(108)
  expect(sold.farm.inventory['egg-milk-pudding']).toBe(0)
  expect(sold.farm.inventory.cream).toBe(0)
})

test('E2E-20 加工中离开刷新与离线返回：不重复扣料不自动下一轮', async ({ page }) => {
  await openFarm(
    page,
    processingFarm({ purchased: true, inventory: { wheat: 2 }, harvests: { crops: 3 } }),
  )
  await openProcessing(page)
  await recipeCard(page, 'flour').getByRole('button', { name: '开始加工面粉' }).click()
  await page.getByRole('button', { name: '确认投入并开始加工', exact: true }).click()
  const taskId = (await snapshot(page)).processing.workshop.activeTask?.id

  await page.clock.fastForward(10 * MINUTE)
  await page.reload()
  await openProcessing(page)
  const mid = await snapshot(page)
  expect(mid.farm.inventory.wheat).toBe(0)
  expect(mid.processing.workshop.activeTask?.id).toBe(taskId)
  await expect(processingStatus(page)).toContainText('剩余时间：10 分钟')

  await page.clock.fastForward(15 * MINUTE)
  await page.reload()
  await openProcessing(page)
  const settled = await snapshot(page)
  expect(settled.processing.workshop.pendingOutput).toMatchObject({
    productId: 'flour',
    quantity: 1,
  })
  expect(settled.processing.workshop.activeTask).toBeNull()
  await expect(processingStatus(page)).toContainText('加工完成 · 可收取')

  // 完成后无限期待收，不自动开始第二轮
  await page.clock.fastForward(24 * HOUR)
  await page.reload()
  await openProcessing(page)
  const later = await snapshot(page)
  expect(later.processing.workshop.pendingOutput?.quantity).toBe(1)
  expect(later.processing.workshop.activeTask).toBeNull()
  expect(later.farm.inventory.wheat).toBe(0)
  await processingStatus(page).getByRole('button', { name: '收取加工品入仓', exact: true }).click()
  expect((await snapshot(page)).farm.inventory.flour).toBe(1)
})

test('E2E-21 双击开始与收取、保存失败重试只结算一次', async ({ page }) => {
  await openFarm(
    page,
    processingFarm({ purchased: true, inventory: { wheat: 4 }, harvests: { crops: 3 } }),
  )
  await openProcessing(page)
  await recipeCard(page, 'flour').getByRole('button', { name: '开始加工面粉' }).click()
  await page
    .getByRole('button', { name: '确认投入并开始加工', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const started = await snapshot(page)
  expect(started.farm.inventory.wheat).toBe(2)
  expect(started.processing.workshop.activeTask?.recipeId).toBe('flour')
  expect(Object.keys(started.processing.actions)).toHaveLength(1)

  await page.clock.fastForward(20 * MINUTE)
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
  await processingStatus(page).getByRole('button', { name: '收取加工品入仓', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '本次进度暂未保存' })).toBeVisible()
  const failed = await snapshot(page)
  expect(failed.farm.inventory.flour ?? 0).toBe(0)
  expect(failed.farm.inventory.wheat).toBe(2)
  // 保存失败时结算未落盘：任务原样保留，不重复生成产出
  expect(failed.processing.workshop.activeTask?.id).toBe(started.processing.workshop.activeTask?.id)
  expect(Object.keys(failed.processing.actions)).toHaveLength(1)

  await processingStatus(page)
    .getByRole('button', { name: '收取加工品入仓', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  const retried = await snapshot(page)
  expect(retried.farm.inventory.flour).toBe(1)
  expect(retried.processing.workshop.pendingOutput).toBeNull()
  expect(retried.wallet.ledger).toHaveLength(0)
  await expect(processingStatus(page)).toContainText('空闲 · 可开始加工')
})
