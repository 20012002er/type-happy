import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { claimStarterGift } from '../../src/learning/farm/farm'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../../src/learning/persistence/snapshot'
import { settleWallet } from '../../src/learning/wallet/wallet'
import { useLearningStore } from '../../src/stores/learning'
import LearningFarmView from '../../src/views/LearningFarmView.vue'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'
import { createSeededRandom } from '../helpers/seeded-random'

const NOW = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000

interface SnapshotOptions {
  balance?: number
  cropHarvests?: number
  eggHarvests?: number
  milkHarvests?: number
  inventory?: Record<string, number>
  purchased?: boolean
}

function snapshotWith(options: SnapshotOptions = {}): LearningSnapshot {
  const snapshot = createEmptyLearningSnapshot()
  snapshot.farm = claimStarterGift(snapshot.farm, { actionId: 'starter-gift', now: NOW })
  const actions: Record<string, string> = { ...snapshot.farm.actions }
  const animals = [...snapshot.farm.animals]
  const buildings = { ...snapshot.farm.buildings }
  for (let index = 0; index < (options.cropHarvests ?? 0); index += 1) {
    actions[`harvest-crop-${index}`] = JSON.stringify({
      type: 'harvest-crop',
      now: NOW,
      plotId: 'plot-1',
    })
  }
  if (options.milkHarvests) {
    buildings.cowshed = { level: 1 }
    animals.push({ id: 'cow-1', kind: 'cow', production: null, productPending: false })
  }
  for (let index = 0; index < (options.eggHarvests ?? 0); index += 1) {
    actions[`collect-egg-${index}`] = JSON.stringify({
      type: 'collect-animal-product',
      now: NOW,
      animalId: 'chicken-1',
    })
  }
  for (let index = 0; index < (options.milkHarvests ?? 0); index += 1) {
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
  const balance = options.balance ?? 500
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

function setup(snapshot: LearningSnapshot) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const storage = new MemoryStorage({ [LEARNING_STORAGE_KEY]: JSON.stringify(snapshot) })
  const learning = useLearningStore()
  const clock = createManualClock(NOW)
  let id = 0
  expect(
    learning.initialize({
      storage,
      clock,
      random: createSeededRandom(42),
      ids: { next: () => `proc-ui-${++id}` },
    }),
  ).toBe(true)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  return { learning, storage, clock, pinia, router }
}

const wrappers: VueWrapper[] = []

function mountView(context: ReturnType<typeof setup>) {
  const wrapper = mount(LearningFarmView, {
    global: { plugins: [context.pinia, context.router] },
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  while (wrappers.length > 0) wrappers.pop()!.unmount()
})

async function openTab(wrapper: VueWrapper, name: string): Promise<void> {
  const button = wrapper
    .findAll('.farm-tabs button')
    .find((candidate) => candidate.text().startsWith(name))
  if (!button) throw new Error(`找不到功能页：${name}`)
  await button.trigger('click')
}

function dialog(): HTMLElement {
  const element = document.body.querySelector<HTMLElement>('.farm-dialog')
  if (!element) throw new Error('确认弹层未打开')
  return element
}

async function clickDialog(selector: string): Promise<void> {
  const button = document.body.querySelector<HTMLButtonElement>(selector)
  if (!button) throw new Error(`弹层按钮不存在：${selector}`)
  button.click()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function refreshDisplayNow(): Promise<void> {
  document.dispatchEvent(new Event('visibilitychange'))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('processing workshop entry and purchase (T11-01/02)', () => {
  it('shows unlock progress in scene and nav, purchase stays gated', async () => {
    const context = setup(snapshotWith({ cropHarvests: 1 }))
    const wrapper = mountView(context)
    expect(wrapper.find('.farm-building--processing').text()).toContain(
      '累计手动收获 1 / 3 份后解锁购买',
    )
    expect(wrapper.find('.farm-processing-entry').text()).toBe('查看解锁条件')
    await wrapper.find('.farm-processing-entry').trigger('click')
    expect(wrapper.find('.farm-processing').exists()).toBe(true)
    expect(wrapper.find('#farm-workshop-buy-title').text()).toBe('加工坊')
    expect(wrapper.find('.farm-shop-card__price').text()).toContain('240')
    expect(wrapper.text()).toContain('累计手动收获 3 份后解锁购买（当前 1 份）')
    const buy = wrapper.findAll('button').find((button) => button.text() === '购买加工坊')!
    expect(buy.attributes('disabled')).toBeDefined()
  })

  it('offers a learning entry when the balance is short by an exact amount', async () => {
    const context = setup(snapshotWith({ cropHarvests: 3, balance: 239 }))
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    expect(wrapper.text()).toContain('学习金币不足，还差 1 金币')
    const link = wrapper.findAll('a').find((anchor) => anchor.text() === '去学习赚金币')!
    expect(link.attributes('href')).toBe('/learning')
    const buy = wrapper.findAll('button').find((button) => button.text() === '购买加工坊')!
    expect(buy.attributes('disabled')).toBeDefined()
  })

  it('confirms price, balance, purpose and single slot; cancel has no side effects', async () => {
    const context = setup(snapshotWith({ cropHarvests: 3 }))
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '购买加工坊')!
      .trigger('click')
    expect(dialog().textContent).toContain('总价：240 学习金币')
    expect(dialog().textContent).toContain('购买后余额：260 金币')
    expect(dialog().textContent).toContain('只有 1 个加工位')
    await clickDialog('.farm-dialog__cancel')
    expect(context.learning.snapshot.wallet.balance).toBe(500)
    expect(context.learning.snapshot.processing.workshop.purchased).toBe(false)

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '购买加工坊')!
      .trigger('click')
    await clickDialog('.farm-dialog__confirm')
    expect(context.learning.snapshot.wallet.balance).toBe(260)
    expect(context.learning.snapshot.processing.workshop.purchased).toBe(true)
    expect(document.body.querySelector('.farm-dialog')).toBeNull()
    // 建成后只自动开放一次配方页与三步引导
    expect(wrapper.text()).toContain('加工坊三步上手')
    expect(wrapper.find('#farm-recipe-flour').text()).toBe('面粉')
    expect(wrapper.find('#farm-recipe-cream').text()).toBe('奶油')
    expect(wrapper.find('#farm-recipe-egg-milk-pudding').text()).toBe('蛋奶布丁')
    expect(context.learning.preferences.processingGuideSeen).toBe(true)
  })
})

describe('recipe cards and processing progress (T11-03/04)', () => {
  it('explains every unavailable recipe with a specific reason', async () => {
    const context = setup(snapshotWith({ cropHarvests: 3, purchased: true }))
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    expect(wrapper.text()).toContain('原料不足：小麦还差 2 件')
    expect(wrapper.text()).toContain('解锁条件：还需手动收获牛奶 × 1')
    expect(wrapper.text()).toContain('解锁条件：还需手动收获鸡蛋 × 1、还需手动收获牛奶 × 1')
    const flourCard = wrapper.find('section[aria-labelledby="farm-recipe-flour"]')
    expect(flourCard.find('button').attributes('disabled')).toBeDefined()
    expect(flourCard.find('button').text()).toBe('开始加工面粉')
  })

  it('confirms non-refundable inputs and waiting time before starting', async () => {
    const context = setup(
      snapshotWith({ cropHarvests: 3, purchased: true, inventory: { wheat: 2 } }),
    )
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    const flourCard = wrapper.find('section[aria-labelledby="farm-recipe-flour"]')
    expect(flourCard.find('button').attributes('disabled')).toBeUndefined()
    await flourCard.find('button').trigger('click')
    expect(dialog().textContent).toContain('原料不可退回')
    expect(dialog().textContent).toContain('投入：小麦 × 2（库存 2 → 0）')
    expect(dialog().textContent).toContain('加工时长：20 分钟')
    expect(dialog().textContent).toContain('预计完成：12:20')
    await clickDialog('.farm-dialog__confirm')
    expect(context.learning.snapshot.farm.inventory.wheat).toBe(0)
    expect(context.learning.snapshot.processing.workshop.activeTask?.recipeId).toBe('flour')
    expect(wrapper.text()).toContain('加工位正在使用中')
  })

  it('shows start/finish/remaining time and blocks early collection', async () => {
    const context = setup(
      snapshotWith({ cropHarvests: 3, purchased: true, inventory: { wheat: 2 } }),
    )
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    await wrapper
      .find('section[aria-labelledby="farm-recipe-flour"]')
      .find('button')
      .trigger('click')
    await clickDialog('.farm-dialog__confirm')
    const status = wrapper.find('section[aria-labelledby="farm-processing-status-title"]')
    expect(status.text()).toContain('面粉 · 加工中')
    expect(status.text()).toContain('开始时间：12:00')
    expect(status.text()).toContain('预计完成：12:20')
    expect(status.text()).toContain('剩余时间：20 分钟')
    const early = status.find('button[disabled]')
    expect(early.text()).toBe('加工尚未完成，不能提前收取')
    expect(status.text()).toContain('加工开始后不可取消')
  })

  it('settles offline completion, celebrates once and collects into the warehouse', async () => {
    const context = setup(
      snapshotWith({ cropHarvests: 3, purchased: true, inventory: { wheat: 2 } }),
    )
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    await wrapper
      .find('section[aria-labelledby="farm-recipe-flour"]')
      .find('button')
      .trigger('click')
    await clickDialog('.farm-dialog__confirm')

    context.clock.advance(20 * MINUTE)
    expect(context.learning.performFarmOperation({ type: 'advance' })).toBe(true)
    await refreshDisplayNow()
    expect(wrapper.text()).toContain('加工完成：面粉 × 1 待收取。')
    const status = wrapper.find('section[aria-labelledby="farm-processing-status-title"]')
    expect(status.text()).toContain('加工完成 · 可收取')
    await status
      .findAll('button')
      .find((button) => button.text() === '收取加工品入仓')!
      .trigger('click')
    expect(context.learning.snapshot.farm.inventory.flour).toBe(1)
    expect(context.learning.snapshot.processing.workshop.pendingOutput).toBeNull()
    expect(wrapper.text()).not.toContain('加工完成：面粉 × 1 待收取。')
    expect(
      wrapper.find('section[aria-labelledby="farm-processing-status-title"]').text(),
    ).toContain('空闲 · 可开始加工')
  })

  it('keeps the dialog open on save failure and retries without duplicating inputs', async () => {
    const context = setup(
      snapshotWith({ cropHarvests: 3, purchased: true, inventory: { wheat: 2 } }),
    )
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    await wrapper
      .find('section[aria-labelledby="farm-recipe-flour"]')
      .find('button')
      .trigger('click')
    context.storage.failNext('setItem')
    await clickDialog('.farm-dialog__confirm')
    expect(dialog().textContent).toContain('本次进度暂未保存，请重试')
    expect(context.learning.snapshot.farm.inventory.wheat).toBe(2)
    expect(context.learning.snapshot.processing.workshop.activeTask).toBeNull()
    await clickDialog('.farm-dialog__confirm')
    expect(document.body.querySelector('.farm-dialog')).toBeNull()
    expect(context.learning.snapshot.farm.inventory.wheat).toBe(0)
    expect(context.learning.snapshot.processing.workshop.activeTask?.recipeId).toBe('flour')
  })

  it('warns on a rolled-back device clock and starts tasks on recorded time', async () => {
    const snapshot = snapshotWith({ cropHarvests: 3, purchased: true, inventory: { wheat: 2 } })
    snapshot.farm = { ...snapshot.farm, lastAdvancedAt: NOW + 10 * MINUTE }
    const context = setup(snapshot)
    const wrapper = mountView(context)
    expect(wrapper.text()).toContain('检测到设备时间被调早了')
    await openTab(wrapper, '加工坊')
    await wrapper
      .find('section[aria-labelledby="farm-recipe-flour"]')
      .find('button')
      .trigger('click')
    await clickDialog('.farm-dialog__confirm')
    // 完成时间基于已记录时间（NOW+10min）而非回拨后的设备时间
    expect(context.learning.snapshot.processing.workshop.activeTask?.completesAt).toBe(
      NOW + 30 * MINUTE,
    )
    expect(
      wrapper.find('section[aria-labelledby="farm-processing-status-title"]').text(),
    ).toContain('剩余时间：20 分钟')
  })
})

describe('warehouse processed products and shared sale cap (T11-05)', () => {
  it('sells processed items and lists both categories in the all-sale confirmation', async () => {
    const context = setup(
      snapshotWith({ purchased: true, inventory: { flour: 1, radish: 1 }, balance: 0 }),
    )
    const wrapper = mountView(context)
    await openTab(wrapper, '仓库与出售')
    const flourRow = wrapper
      .findAll('.farm-inventory-item')
      .find((row) => row.text().includes('面粉'))!
    expect(flourRow.text()).toContain('加工品 · 单价 42 金币')
    expect(flourRow.text()).toContain('本单 1 件，共 42 金币')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '出售全部可售物品')!
      .trigger('click')
    expect(dialog().textContent).toContain('萝卜 × 1，单价 9，小计 9 金币')
    expect(dialog().textContent).toContain('面粉 × 1，单价 42，小计 42 金币')
    expect(dialog().textContent).toContain('合计：2 件，51 学习金币')
    expect(dialog().textContent).toContain('出售后今日剩余可售收入：9 金币')
    await clickDialog('.farm-dialog__confirm')
    expect(context.learning.snapshot.wallet.balance).toBe(51)
    expect(context.learning.snapshot.farm.inventory.flour).toBe(0)
    expect(context.learning.snapshot.farm.inventory.radish).toBe(0)
    expect(context.learning.snapshot.farm.saleIncomeByDate['2026-11-20']).toBe(51)
  })

  it('blocks the combined all-sale over the cap and keeps processed quotes consistent', async () => {
    const context = setup(
      snapshotWith({ purchased: true, inventory: { flour: 1, radish: 10 }, balance: 0 }),
    )
    const wrapper = mountView(context)
    await openTab(wrapper, '仓库与出售')
    expect(wrapper.text()).toContain(
      '全部可售物品合计 132 金币，超出今日剩余可售额度 60 金币，请分类或分项出售',
    )
    const allButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '出售全部可售物品')!
    expect(allButton.attributes('disabled')).toBeDefined()

    const radishRow = wrapper
      .findAll('.farm-inventory-item')
      .find((row) => row.text().includes('萝卜'))!
    await radishRow.find('input').setValue('6')
    await radishRow
      .findAll('button')
      .find((button) => button.text() === '出售')!
      .trigger('click')
    await clickDialog('.farm-dialog__confirm')
    expect(context.learning.snapshot.wallet.balance).toBe(54)
    const flourRow = wrapper
      .findAll('.farm-inventory-item')
      .find((row) => row.text().includes('面粉'))!
    expect(flourRow.text()).toContain('超出今日出售收入上限，当前最多可出售 0 件')
    expect(flourRow.find('button').attributes('disabled')).toBeDefined()
  })
})

describe('guides, badges and one-time notices (T11-06)', () => {
  it('shows the unlock notice once and persists the dismissal', async () => {
    const context = setup(snapshotWith({ cropHarvests: 3 }))
    const wrapper = mountView(context)
    expect(wrapper.find('.farm-unlock-notice').text()).toContain('新设施可以建造了：加工坊')
    await wrapper
      .findAll('.farm-unlock-notice button')
      .find((button) => button.text() === '知道了')!
      .trigger('click')
    expect(wrapper.find('.farm-unlock-notice').exists()).toBe(false)
    expect(context.learning.preferences.processingUnlockSeen).toBe(true)
    wrapper.unmount()
    wrappers.pop()
    const reopened = mountView(context)
    expect(reopened.find('.farm-unlock-notice').exists()).toBe(false)
  })

  it('allows skipping and re-opening the three-step guide without replaying on refresh', async () => {
    const context = setup(snapshotWith({ cropHarvests: 3, purchased: true }))
    const wrapper = mountView(context)
    await openTab(wrapper, '加工坊')
    expect(wrapper.find('.farm-processing__guide').exists()).toBe(true)
    await wrapper
      .findAll('.farm-processing__guide button')
      .find((button) => button.text() === '跳过引导')!
      .trigger('click')
    expect(wrapper.find('.farm-processing__guide').exists()).toBe(false)
    expect(context.learning.preferences.processingGuideSeen).toBe(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '查看使用引导')!
      .trigger('click')
    expect(wrapper.find('.farm-processing__guide').exists()).toBe(true)
    wrapper.unmount()
    wrappers.pop()
    const reopened = mountView(context)
    await openTab(reopened, '加工坊')
    expect(reopened.find('.farm-processing__guide').exists()).toBe(false)
  })

  it('marks processable raw materials with a static badge and recipe entry', async () => {
    const context = setup(snapshotWith({ inventory: { wheat: 2, milk: 1 } }))
    const wrapper = mountView(context)
    await openTab(wrapper, '仓库与出售')
    const wheatRow = wrapper
      .findAll('.farm-inventory-item')
      .find((row) => row.text().includes('小麦'))!
    expect(wheatRow.find('.farm-inventory-item__tag').text()).toBe('可用于加工')
    const radishRow = wrapper
      .findAll('.farm-inventory-item')
      .find((row) => row.text().includes('萝卜'))!
    expect(radishRow.find('.farm-inventory-item__tag').exists()).toBe(false)
    await wheatRow
      .findAll('button')
      .find((button) => button.text() === '查看配方')!
      .trigger('click')
    expect(wrapper.find('.farm-processing').exists()).toBe(true)
  })
})
