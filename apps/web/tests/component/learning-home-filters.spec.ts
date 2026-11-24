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

function englishSelects(wrapper: ReturnType<typeof mount>) {
  const all = wrapper.findAll('section[aria-labelledby="english-special-title"] select')
  return { ability: all[0], unit: all[1], questionType: all[2], difficulty: all[3] }
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

describe('learning home english special practice filters', () => {
  it('filters by ability, unit and question type and starts a matching session', async () => {
    const { learning, router, wrapper } = setup()
    expect(learning.selectCourse({ grade: 4, semester: 'spring' })).toBe(true)
    await wrapper.vm.$nextTick()

    const fields = englishSelects(wrapper)
    expect(wrapper.findAll('section[aria-labelledby="english-special-title"] select')).toHaveLength(
      4,
    )
    const defaultTypes = fields.questionType.findAll('option').map((option) => option.element.value)
    expect(defaultTypes).toEqual(['', 'single-choice', 'english-spelling'])
    const defaultDisabled = fields.difficulty
      .findAll('option')
      .filter((option) => option.element.disabled)
      .map((option) => option.element.value)
    expect(defaultDisabled).toEqual(['L3'])

    await fields.ability.setValue('english-sentence-grammar')
    await fields.unit.setValue('g4s-english-weather')
    await fields.questionType.setValue('sentence-completion')
    await fields.difficulty.setValue('L2')
    const startButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '开始英语专项练习')
    await startButton?.trigger('click')
    await flushPromises()

    const session = learning.activeSession
    expect(session).not.toBeNull()
    expect(session?.mode).toBe('special')
    expect(session?.questions).toHaveLength(10)
    expect(
      session?.questions.every(
        (entry) =>
          entry.question.type === 'sentence-completion' &&
          entry.question.classification.unitId === 'g4s-english-weather' &&
          entry.question.classification.ability === 'english-sentence-grammar',
      ),
    ).toBe(true)
    expect(router.currentRoute.value.name).toBe('learning-practice')
    wrapper.unmount()
  })

  it('resets invalid type and difficulty when the ability changes', async () => {
    const { learning, wrapper } = setup()
    expect(learning.selectCourse({ grade: 4, semester: 'spring' })).toBe(true)
    await wrapper.vm.$nextTick()

    const fields = englishSelects(wrapper)
    await fields.ability.setValue('english-sentence-grammar')
    await fields.questionType.setValue('sentence-completion')
    await fields.difficulty.setValue('L3')
    await fields.ability.setValue('english-vocabulary')
    expect((fields.questionType.element as HTMLSelectElement).value).toBe('')
    expect((fields.difficulty.element as HTMLSelectElement).value).toBe('L2')

    await fields.ability.setValue('english-situational')
    const typeOptions = fields.questionType.findAll('option').map((option) => option.element.value)
    expect(typeOptions).toEqual(['', 'single-choice'])
    const disabled = fields.difficulty
      .findAll('option')
      .filter((option) => option.element.disabled)
      .map((option) => option.element.value)
    expect(disabled).toEqual(['L1'])
    wrapper.unmount()
  })

  it('hides the english section for unavailable terms and resets filters on course switch', async () => {
    const { learning, wrapper } = setup()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('section[aria-labelledby="english-special-title"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('该学期暂未开放英语，不提供听力或跟读入口。')

    expect(learning.selectCourse({ grade: 4, semester: 'spring' })).toBe(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('section[aria-labelledby="english-special-title"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('词汇拼写、句型语法与情境表达综合练习')

    const fields = englishSelects(wrapper)
    await fields.ability.setValue('english-situational')
    await fields.unit.setValue('g4s-english-weather')
    expect(learning.selectCourse({ grade: 5, semester: 'autumn' })).toBe(true)
    await wrapper.vm.$nextTick()
    expect((fields.ability.element as HTMLSelectElement).value).toBe('english-vocabulary')
    expect((fields.unit.element as HTMLSelectElement).value).toBe('')
    expect((fields.questionType.element as HTMLSelectElement).value).toBe('')
    expect((fields.difficulty.element as HTMLSelectElement).value).toBe('L2')
    wrapper.unmount()
  })
})
