import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import LearningParentView from '../../src/views/LearningParentView.vue'
import LearningRecordsView from '../../src/views/LearningRecordsView.vue'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
  type LearningSnapshot,
} from '../../src/learning/persistence/snapshot'
import type { LearningRecord, LearningResult } from '../../src/learning/types'
import { settleWallet } from '../../src/learning/wallet/wallet'
import { useLearningStore } from '../../src/stores/learning'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'

const NOW = new Date(2026, 10, 20, 12).getTime()
const PREFERENCES_KEY = 'type-happy:learning:preferences:v1'

function makeRecord(
  id: string,
  result: LearningResult = 'first-correct',
  patch: Partial<LearningRecord> = {},
): LearningRecord {
  return {
    id,
    questionInstanceId: `instance-${id}`,
    templateId: 'template-1',
    templateVersion: 1,
    courseId: 'pep-grade4-autumn-integrated-math',
    knowledgePointId: 'written-division-by-two-digits',
    result,
    attempts: result === 'first-correct' ? 1 : 2,
    highestHintLevel: result === 'first-correct' ? 0 : 1,
    explanationViewed: result === 'corrected-awaiting-retest',
    errorCauses: [],
    startedAt: NOW - 1_000,
    settledAt: NOW,
    ...patch,
  }
}

function richSnapshot(): LearningSnapshot {
  const snapshot = createEmptyLearningSnapshot()
  snapshot.learning.records = [
    makeRecord('first'),
    makeRecord('hint', 'mastered-after-hint', {
      errorCauses: [{ id: 'trial-quotient', label: '试商偏差' }],
    }),
    makeRecord('explanation', 'corrected-awaiting-retest', {
      attempts: 3,
      highestHintLevel: 2,
      errorCauses: [{ id: 'trial-quotient', label: '试商偏差' }],
    }),
  ]
  snapshot.tasks = {
    daily: { '2026-11-20': { goal: 30, completed: 3, rewarded: false } },
    streak: { current: 2, longest: 5, lastCompletedDateKey: '2026-11-19' },
  }
  snapshot.wallet = settleWallet(snapshot.wallet, {
    settlementId: 'practice-income',
    occurredAt: NOW,
    source: 'practice',
    referenceId: 'practice-income',
    direction: 'earn',
    amount: 10,
  })
  snapshot.wallet = settleWallet(snapshot.wallet, {
    settlementId: 'farm-income',
    occurredAt: NOW,
    source: 'farm-sale',
    referenceId: 'farm-income',
    direction: 'earn',
    amount: 6,
  })
  snapshot.wallet = settleWallet(snapshot.wallet, {
    settlementId: 'farm-spend',
    occurredAt: NOW,
    source: 'farm-purchase',
    referenceId: 'farm-spend',
    direction: 'spend',
    amount: 4,
  })
  return snapshot
}

function setup(snapshot = createEmptyLearningSnapshot()) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const storage = new MemoryStorage({ [LEARNING_STORAGE_KEY]: JSON.stringify(snapshot) })
  const learning = useLearningStore()
  learning.initialize({ storage, clock: createManualClock(NOW) })
  return { pinia, storage, learning }
}

function mountView(
  component: typeof LearningParentView | typeof LearningRecordsView,
  pinia = createPinia(),
) {
  return mount(component, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('parent settings and summary view', () => {
  it('shows real counts, causes and wallet totals and schedules a goal for tomorrow', async () => {
    const { pinia, learning } = setup(richSnapshot())
    const wrapper = mountView(LearningParentView, pinia)

    expect(wrapper.text()).toContain('当前连续 2 天')
    expect(wrapper.text()).toContain('最长连续 / 天')
    expect(wrapper.text()).toContain('试商偏差')
    expect(wrapper.text()).toContain('2 次')
    expect(wrapper.text()).toContain('农产品出售')
    expect(wrapper.text()).toContain('农场购买')
    expect(wrapper.text()).toContain('余额 12')
    expect(wrapper.text()).toContain('多位数乘两位数')
    expect(wrapper.text()).toContain('不生成排名或能力标签')

    await wrapper.find('#daily-goal').setValue('35')
    await wrapper.find('.parent-goal + .parent-help + .learn-actions button').trigger('click')
    expect(learning.preferences).toMatchObject({
      dailyGoal: 30,
      pendingDailyGoal: 35,
      pendingDailyGoalEffectiveFrom: '2026-11-21',
    })
    expect(learning.today.goal).toBe(30)
    expect(learning.snapshot.tasks.daily['2026-11-20']).toEqual({
      goal: 30,
      completed: 3,
      rewarded: false,
    })
    expect(wrapper.text()).toContain('从 2026-11-21 起调整为 35 题')
    wrapper.unmount()
  })

  it('shows useful empty states instead of fabricating learning labels', () => {
    const { pinia } = setup()
    const wrapper = mountView(LearningParentView, pinia)
    expect(wrapper.text()).toContain('还没有学习记录')
    expect(wrapper.text()).toContain('暂无可归类的错因记录')
    expect(wrapper.text()).toContain('还没有金币来源或消耗记录')
    expect(wrapper.text()).toContain('没有账号或多设备同步')
    wrapper.unmount()
  })

  it('cancels with Escape, traps focus, restores focus and clears only learning data', async () => {
    const { pinia, storage, learning } = setup()
    storage.setItem('typing-progress', 'keep-typing')
    storage.setItem('taoyuan-save', 'keep-taoyuan')
    learning.updatePreferences({ soundEnabled: false })
    const wrapper = mountView(LearningParentView, pinia)
    const invoker = wrapper.find<HTMLButtonElement>('.parent-danger__button')
    invoker.element.focus()
    await invoker.trigger('click')
    await nextTick()

    const dialog = document.body.querySelector<HTMLElement>('.farm-dialog')!
    const cancel = document.body.querySelector<HTMLButtonElement>('.farm-dialog__cancel')!
    const confirm = document.body.querySelector<HTMLButtonElement>('.farm-dialog__confirm')!
    expect(document.activeElement).toBe(cancel)
    cancel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    expect(document.activeElement).toBe(confirm)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.body.querySelector('.farm-dialog')).toBeNull()
    expect(document.activeElement).toBe(invoker.element)
    expect(storage.getItem(LEARNING_STORAGE_KEY)).not.toBeNull()

    await invoker.trigger('click')
    await nextTick()
    document.body.querySelector<HTMLButtonElement>('.farm-dialog__confirm')!.click()
    await nextTick()
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(PREFERENCES_KEY)).not.toBeNull()
    expect(storage.getItem('typing-progress')).toBe('keep-typing')
    expect(storage.getItem('taoyuan-save')).toBe('keep-taoyuan')
    expect(learning.snapshot.wallet.balance).toBe(0)
    expect(wrapper.text()).toContain('学习、金币和农场记录已清除')
    wrapper.unmount()
  })
})

describe('long history pagination view', () => {
  it('renders only one page of records and ledger entries at a time', async () => {
    const snapshot = createEmptyLearningSnapshot()
    snapshot.learning.records = Array.from({ length: 45 }, (_, index) =>
      makeRecord(`record-${String(index).padStart(3, '0')}`),
    )
    for (let index = 0; index < 25; index += 1) {
      snapshot.wallet = settleWallet(snapshot.wallet, {
        settlementId: `entry-${String(index).padStart(3, '0')}`,
        occurredAt: NOW + index,
        source: 'practice',
        referenceId: `entry-${index}`,
        direction: 'earn',
        amount: 1,
      })
    }
    const { pinia } = setup(snapshot)
    const wrapper = mountView(LearningRecordsView, pinia)

    expect(wrapper.findAll('.learn-record-list')[0].findAll('li')).toHaveLength(20)
    expect(wrapper.findAll('.learn-record-list')[1].findAll('li')).toHaveLength(20)
    expect(wrapper.text()).toContain('第 1 / 3 页 · 共 45 条')
    expect(wrapper.text()).toContain('第 1 / 2 页 · 共 25 条')

    await wrapper.find('nav[aria-label="学习记录分页"] button:last-child').trigger('click')
    expect(wrapper.text()).toContain('第 2 / 3 页 · 共 45 条')
    expect(wrapper.findAll('.learn-record-list')[0].findAll('li')).toHaveLength(20)
    await wrapper.find('nav[aria-label="学习记录分页"] button:last-child').trigger('click')
    expect(wrapper.findAll('.learn-record-list')[0].findAll('li')).toHaveLength(5)
    expect(
      wrapper.find('nav[aria-label="学习记录分页"] button:last-child').attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })
})

describe('WP08 parent course scope, motion settings and filters', () => {
  it('shows all course scopes, question types, the legacy marker and the unavailable english note', () => {
    const { pinia } = setup()
    const wrapper = mountView(LearningParentView, pinia)
    const text = wrapper.text()
    expect(text).toContain('查看全部课程范围与题型说明')
    expect(text).toContain('不代表地区统一教材目录')
    expect(text).toContain('保留旧课程')
    expect(text).toContain('该学期暂未开放英语')
    expect(text).toContain('人教版 PEP 五年级下册英语')
    expect(text).toContain('人教版 PEP 四年级下册英语')
    expect(text).toContain('题型：')
    expect(text).toContain('单词拼写')
    expect(text).toContain('商和余数')
    wrapper.unmount()
  })

  it('toggles motion switches and applies farm-no-motion / learn-no-motion classes', async () => {
    const { pinia, learning } = setup()
    const wrapper = mountView(LearningParentView, pinia)
    const switches = wrapper.findAll('.learn-switch input')
    expect(switches).toHaveLength(3)

    await switches[2].setValue(true)
    expect(learning.preferences.reduceFarmMotion).toBe(true)
    expect(wrapper.find('.learn-page').classes()).toContain('farm-no-motion')
    expect(wrapper.find('.learn-page').classes()).not.toContain('learn-no-motion')

    await switches[1].setValue(false)
    expect(learning.preferences.animationsEnabled).toBe(false)
    expect(wrapper.find('.learn-page').classes()).toContain('learn-no-motion')
    wrapper.unmount()
  })

  it('shows the system reduced-motion note and reduces motion regardless of switches', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => {},
      }),
    )
    const { pinia } = setup()
    const wrapper = mountView(LearningParentView, pinia)
    expect(wrapper.text()).toContain('系统已开启“减少动态效果”')
    expect(wrapper.find('.learn-page').classes()).toContain('learn-no-motion')
    expect(wrapper.find('.learn-page').classes()).toContain('farm-no-motion')
    wrapper.unmount()
  })

  it('filters by period, subject, course and knowledge point with ability distribution', async () => {
    const snapshot = richSnapshot()
    snapshot.learning.records = [
      makeRecord('math-1', 'first-correct', {
        subject: 'math',
        grade: 4,
        semester: 'autumn',
        ability: 'math-calculation',
      }),
      makeRecord('english-1', 'first-correct', {
        courseId: 'pep-grade4-spring-english',
        knowledgePointId: 'g4s-english-weather-vocabulary',
        subject: 'english',
        grade: 4,
        semester: 'spring',
        ability: 'english-vocabulary',
      }),
    ]
    const { pinia } = setup(snapshot)
    const wrapper = mountView(LearningParentView, pinia)
    const section = wrapper.find('section[aria-labelledby="filter-summary-title"]')
    expect(section.find('.parent-metrics dd').text()).toBe('2')

    await wrapper.find('#summary-subject').setValue('english')
    expect(section.find('.parent-metrics dd').text()).toBe('1')
    expect(section.text()).toContain('英语词汇')
    expect(section.text()).toContain('4 年级下学期英语')
    expect(section.text()).not.toContain('数学计算')

    await wrapper.find('#summary-course').setValue('pep-grade4-spring-english')
    await wrapper.find('#summary-knowledge-point').setValue('g4s-english-weather-vocabulary')
    expect(section.find('.parent-metrics dd').text()).toBe('1')

    await wrapper.find('#summary-period').setValue('recent-7-days')
    expect(section.find('.parent-metrics dd').text()).toBe('1')

    // 知识点摘要按记录原课程解析名称与归属
    const knowledge = wrapper.find('section[aria-labelledby="knowledge-summary-title"]')
    expect(knowledge.text()).toContain('天气词汇')
    expect(knowledge.text()).toContain('4 年级下学期英语')
    wrapper.unmount()
  })

  it('shows an empty filter state instead of fabricating counts', () => {
    const { pinia } = setup()
    const wrapper = mountView(LearningParentView, pinia)
    expect(wrapper.text()).toContain('当前筛选范围内还没有学习记录')
    wrapper.unmount()
  })
})
