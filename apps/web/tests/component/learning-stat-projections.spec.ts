import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import PracticeCompletion from '../../src/components/learning/PracticeCompletion.vue'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
} from '../../src/learning/persistence/snapshot'
import { useLearningStore } from '../../src/stores/learning'
import LearningHomeView from '../../src/views/LearningHomeView.vue'
import LearningTasksView from '../../src/views/LearningTasksView.vue'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'
import { createSeededRandom } from '../helpers/seeded-random'

const NOW = new Date(2026, 10, 20, 12).getTime()

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const storage = new MemoryStorage({
    [LEARNING_STORAGE_KEY]: JSON.stringify(createEmptyLearningSnapshot()),
  })
  const learning = useLearningStore()
  let id = 0
  expect(
    learning.initialize({
      storage,
      clock: createManualClock(NOW),
      random: createSeededRandom(7),
      ids: { next: () => `stats-${++id}` },
    }),
  ).toBe(true)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/learning/practice/:sessionId',
        name: 'learning-practice',
        component: { template: '<div />' },
      },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  return { learning, pinia, router }
}

function current(learning: ReturnType<typeof useLearningStore>, sessionId: string) {
  const session = learning.getSession(sessionId)
  if (!session) throw new Error('练习组不存在')
  return session.questions[session.currentIndex]
}

function settledSession(learning: ReturnType<typeof useLearningStore>): string {
  expect(learning.selectCourse({ grade: 4, semester: 'autumn' })).toBe(true)
  const sessionId = learning.startPractice({
    mode: 'special',
    subject: 'math',
    unitId: 'written-multiplication',
    difficulty: 'L1',
  })
  if (!sessionId) throw new Error('练习组创建失败')

  const first = current(learning, sessionId)
  if (first.question.standardAnswer.kind !== 'number') throw new Error('预期数字题')
  expect(learning.submitAnswer(sessionId, first.question.standardAnswer)).toBe('submitted')
  expect(learning.advanceSession(sessionId)).toBe(true)

  const second = current(learning, sessionId)
  if (second.question.standardAnswer.kind !== 'number') throw new Error('预期数字题')
  const secondWrong = { kind: 'number' as const, value: second.question.standardAnswer.value + 1 }
  expect(learning.submitAnswer(sessionId, secondWrong)).toBe('submitted')
  expect(learning.submitAnswer(sessionId, secondWrong)).toBe('submitted')
  expect(learning.submitAnswer(sessionId, second.question.standardAnswer)).toBe('submitted')
  expect(learning.advanceSession(sessionId)).toBe(true)

  const third = current(learning, sessionId)
  if (third.question.standardAnswer.kind !== 'number') throw new Error('预期数字题')
  const thirdWrong = { kind: 'number' as const, value: third.question.standardAnswer.value + 1 }
  expect(learning.submitAnswer(sessionId, thirdWrong)).toBe('submitted')
  expect(learning.submitAnswer(sessionId, third.question.standardAnswer)).toBe('submitted')
  expect(learning.advanceSession(sessionId)).toBe(true)

  expect(learning.abandonSession(sessionId)).toBe(true)
  return sessionId
}

function statRows(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.findAll(`${selector} > div`).map((row) => ({
    label: row.find('dt').text(),
    value: row.find('dd').text(),
  }))
}

const EXPECTED_ROWS = [
  { label: '有效完成', value: '3' },
  { label: '首次答对', value: '1' },
  { label: '提示后订正', value: '1' },
  { label: '讲解后订正', value: '1' },
  { label: '待复测', value: '1' },
]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('WP07 five-category stat projections', () => {
  it('renders all five categories on the practice completion page', () => {
    const { learning, pinia, router } = setup()
    const sessionId = settledSession(learning)
    const wrapper = mount(PracticeCompletion, {
      props: { sessionId },
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    })
    expect(statRows(wrapper, '.learn-stats--five')).toEqual(EXPECTED_ROWS)
    wrapper.unmount()
  })

  it('renders today five-category breakdown on the tasks page', () => {
    const { learning, pinia, router } = setup()
    settledSession(learning)
    const wrapper = mount(LearningTasksView, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    })
    expect(statRows(wrapper, 'dl[aria-label="今日有效完成构成"]')).toEqual(EXPECTED_ROWS)
    wrapper.unmount()
  })

  it('renders today five-category breakdown on the home page', () => {
    const { learning, pinia, router } = setup()
    settledSession(learning)
    const wrapper = mount(LearningHomeView, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    })
    expect(statRows(wrapper, 'dl[aria-label="今日有效完成构成"]')).toEqual(EXPECTED_ROWS)
    wrapper.unmount()
  })
})
