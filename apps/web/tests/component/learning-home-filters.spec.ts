import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
} from '../../src/learning/persistence/snapshot'
import { useLearningStore } from '../../src/stores/learning'
import LearningHomeView from '../../src/views/LearningHomeView.vue'
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
      ids: { next: () => `home-${++id}` },
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
  const wrapper = mount(LearningHomeView, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  })
  return { learning, router, wrapper }
}

function selects(wrapper: ReturnType<typeof mount>) {
  const all = wrapper.findAll('.learn-form-grid select')
  return { unit: all[0], knowledgePoint: all[1], questionType: all[2], difficulty: all[3] }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('learning home special practice filters', () => {
  it('filters by knowledge point and question type and starts a matching session', async () => {
    const { learning, router, wrapper } = setup()
    expect(learning.selectCourse({ grade: 5, semester: 'spring' })).toBe(true)
    await wrapper.vm.$nextTick()

    const fields = selects(wrapper)
    await fields.unit.setValue('g5s-fraction-addition-subtraction')
    const pointOptions = fields.knowledgePoint.findAll('option').map((option) => option.text())
    expect(pointOptions).toContain('全部知识点')
    expect(pointOptions.length).toBeGreaterThan(2)

    await fields.knowledgePoint.setValue('g5s-different-denominator-add-sub')
    const typeOptions = fields.questionType.findAll('option').map((option) => option.element.value)
    expect(typeOptions).toEqual(['', 'fraction'])

    await fields.questionType.setValue('fraction')
    await fields.difficulty.setValue('L2')
    const startButton = wrapper.findAll('button').find((button) => button.text() === '开始专项练习')
    await startButton?.trigger('click')
    await flushPromises()

    const session = learning.activeSession
    expect(session).not.toBeNull()
    expect(session?.mode).toBe('special')
    expect(session?.questions).toHaveLength(10)
    expect(
      session?.questions.every(
        (entry) =>
          entry.question.classification.knowledgePointId === 'g5s-different-denominator-add-sub' &&
          entry.question.type === 'fraction',
      ),
    ).toBe(true)
    expect(router.currentRoute.value.name).toBe('learning-practice')
    wrapper.unmount()
  })

  it('resets knowledge point and type when the unit changes and limits difficulties', async () => {
    const { learning, wrapper } = setup()
    expect(learning.selectCourse({ grade: 5, semester: 'spring' })).toBe(true)
    await wrapper.vm.$nextTick()

    const fields = selects(wrapper)
    await fields.unit.setValue('g5s-fraction-addition-subtraction')
    await fields.knowledgePoint.setValue('g5s-different-denominator-add-sub')
    await fields.questionType.setValue('fraction')
    await fields.unit.setValue('g5s-factors-multiples')
    expect((fields.knowledgePoint.element as HTMLSelectElement).value).toBe('')
    expect((fields.questionType.element as HTMLSelectElement).value).toBe('')

    await fields.knowledgePoint.setValue('g5s-factors-and-multiples')
    const typeOptions = fields.questionType.findAll('option').map((option) => option.element.value)
    expect(typeOptions).toEqual(['', 'single-choice'])
    const difficultyOptions = fields.difficulty.findAll('option')
    const disabled = difficultyOptions
      .filter((option) => option.element.disabled)
      .map((option) => option.element.value)
    expect(disabled).toEqual(['L3'])
    wrapper.unmount()
  })
})
