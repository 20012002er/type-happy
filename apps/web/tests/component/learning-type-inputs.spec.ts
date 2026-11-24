import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { emptyAnswerForm } from '../../src/components/learning/answer-form'
import LearningAnswerInput from '../../src/components/learning/LearningAnswerInput.vue'
import LearningBlanksInput from '../../src/components/learning/LearningBlanksInput.vue'
import LearningChoiceInput from '../../src/components/learning/LearningChoiceInput.vue'
import LearningFeedback from '../../src/components/learning/LearningFeedback.vue'
import LearningFractionInput from '../../src/components/learning/LearningFractionInput.vue'
import LearningSpellingInput from '../../src/components/learning/LearningSpellingInput.vue'
import LearningWordProblemInput from '../../src/components/learning/LearningWordProblemInput.vue'
import PracticeCompletion from '../../src/components/learning/PracticeCompletion.vue'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
} from '../../src/learning/persistence/snapshot'
import {
  advancePracticeSession,
  createPracticeSession,
  submitPracticeAnswer,
} from '../../src/learning/practice/practice-session'
import { settleLearningRecord } from '../../src/learning/tasks/learning-settlement'
import { useLearningStore } from '../../src/stores/learning'
import { createManualClock } from '../helpers/manual-clock'
import { MemoryStorage } from '../helpers/memory-storage'
import {
  buildChoiceFixture,
  buildQuestionFixture,
  CHOICE_OPTIONS,
} from '../helpers/question-fixtures'
import { createSeededRandom } from '../helpers/seeded-random'

const base = { correcting: false, disabled: false }

describe('LearningChoiceInput', () => {
  it('blocks submission until an option is selected and never hints correctness', async () => {
    const wrapper = mount(LearningChoiceInput, {
      props: { ...base, modelValue: '', options: CHOICE_OPTIONS },
    })
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(4)
    for (const option of CHOICE_OPTIONS) expect(wrapper.text()).toContain(option.text)
    for (const label of wrapper.findAll('.learn-choice__option')) {
      expect(label.classes()).toEqual(['learn-choice__option'])
    }
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await radios[1].setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([['opt-b']])
    await wrapper.setProps({ modelValue: 'opt-b' })
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ kind: 'single-choice', optionId: 'opt-b' }]])
  })

  it('disables every option while saving', () => {
    const wrapper = mount(LearningChoiceInput, {
      props: { ...base, disabled: true, modelValue: 'opt-a', options: CHOICE_OPTIONS },
    })
    for (const radio of wrapper.findAll('input[type="radio"]')) {
      expect(radio.attributes('disabled')).toBeDefined()
    }
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
})

describe('LearningBlanksInput', () => {
  it('requires every blank and keeps other inputs when one changes', async () => {
    const wrapper = mount(LearningBlanksInput, {
      props: { ...base, modelValue: [], kind: 'fill-blanks', count: 2 },
    })
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(2)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await inputs[0].setValue('交换')
    expect(wrapper.emitted('update:modelValue')).toEqual([[['交换', '']]])
    await wrapper.setProps({ modelValue: ['交换', ''] })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ modelValue: ['交换', '结合'] })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ kind: 'fill-blanks', values: ['交换', '结合'] }]])
  })

  it('marks sentence completion inputs as english', () => {
    const wrapper = mount(LearningBlanksInput, {
      props: { ...base, modelValue: ['am'], kind: 'sentence-completion', count: 2 },
    })
    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('lang')).toBe('en')
      expect(input.attributes('spellcheck')).toBe('false')
    }
    expect(wrapper.text()).toContain('第 2 空')
  })
})

describe('LearningFractionInput', () => {
  it('blocks a zero denominator with a clear note and submits valid fractions', async () => {
    const wrapper = mount(LearningFractionInput, {
      props: { ...base, numerator: '3', denominator: '0' },
    })
    expect(wrapper.text()).toContain('分母不能为 0')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.setProps({ denominator: '4' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([
      [{ kind: 'fraction', numerator: 3, denominator: 4 }],
    ])
  })
})

describe('LearningWordProblemInput', () => {
  const rule = { values: [{ value: 12, unit: '元' }], unitRequired: true }

  it('requires the declared unit and submits quantity with unit', async () => {
    const wrapper = mount(LearningWordProblemInput, {
      props: { ...base, value: '12', unit: '', rule },
    })
    expect(wrapper.text()).toContain('请写上题目要求的单位')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ unit: '元' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ kind: 'word-problem', value: 12, unit: '元' }]])
  })
})

describe('LearningSpellingInput', () => {
  it('accepts english letters and rejects non-english input', async () => {
    const wrapper = mount(LearningSpellingInput, {
      props: { ...base, modelValue: '苹果123' },
    })
    expect(wrapper.text()).toContain('只输入英文字母')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ modelValue: 'apple' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ kind: 'english-spelling', value: 'apple' }]])
  })
})

describe('LearningAnswerInput dispatch', () => {
  it('renders the choice component from the question snapshot and patches the form', async () => {
    const question = buildChoiceFixture()
    const wrapper = mount(LearningAnswerInput, {
      props: { ...base, modelValue: emptyAnswerForm(), questionType: 'single-choice', question },
    })
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(4)
    await radios[1].setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      { ...emptyAnswerForm(), optionId: 'opt-b' },
    ])
    await wrapper.setProps({ modelValue: { ...emptyAnswerForm(), optionId: 'opt-b' } })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ kind: 'single-choice', optionId: 'opt-b' }]])
  })

  it('derives the blank count from the accepted answer rule', () => {
    const question = buildQuestionFixture({
      standardAnswer: { kind: 'fill-blanks', values: ['交换', '结合'] },
      acceptedAnswerRule: {
        kind: 'fill-blanks',
        values: [['交换'], ['结合']],
        trimWhitespace: true,
      },
    })
    const wrapper = mount(LearningAnswerInput, {
      props: { ...base, modelValue: emptyAnswerForm(), questionType: 'fill-blanks', question },
    })
    expect(wrapper.findAll('input')).toHaveLength(2)
  })
})

describe('LearningFeedback for choice variants', () => {
  it('reveals the option text instead of the raw option id', () => {
    const question = {
      ...buildChoiceFixture(),
      variantOf: { templateId: 'fixture-choice-v1', instanceId: 'origin-instance' },
    }
    let session = createPracticeSession({
      id: 'choice-feedback',
      mode: 'special',
      questions: [{ question }],
      createdAt: 100,
    })
    session = submitPracticeAnswer(session, { kind: 'single-choice', optionId: 'opt-a' }, 110)
    session = submitPracticeAnswer(session, { kind: 'single-choice', optionId: 'opt-c' }, 120)
    const wrapper = mount(LearningFeedback, {
      props: { entry: session.questions[0], practiceReward: 0 },
    })
    expect(wrapper.text()).toContain('正确答案')
    expect(wrapper.text()).toContain('选项乙')
    expect(wrapper.text()).not.toContain('opt-b')
  })
})

describe('PracticeCompletion question-type statistics', () => {
  it('shows the effective completion breakdown for mixed question types', () => {
    const numberQuestion = buildQuestionFixture({
      instanceId: 'completion-number',
      standardAnswer: { kind: 'number', value: 24 },
      acceptedAnswerRule: { kind: 'number', values: [24] },
    })
    const blanksQuestion = buildQuestionFixture({
      instanceId: 'completion-blanks',
      standardAnswer: { kind: 'fill-blanks', values: ['交换', '结合'] },
      acceptedAnswerRule: {
        kind: 'fill-blanks',
        values: [['交换'], ['结合']],
        trimWhitespace: true,
      },
    })
    let session = createPracticeSession({
      id: 'mixed-completion',
      mode: 'special',
      questions: [{ question: numberQuestion }, { question: blanksQuestion }],
      createdAt: 100,
    })
    session = submitPracticeAnswer(session, numberQuestion.standardAnswer, 110)
    session = advancePracticeSession(session, 120)
    session = submitPracticeAnswer(session, blanksQuestion.standardAnswer, 130)
    session = advancePracticeSession(session, 140)
    expect(session.status).toBe('completed')

    const snapshot = createEmptyLearningSnapshot()
    snapshot.practice.sessions = { ...snapshot.practice.sessions, [session.id]: session }
    for (const record of session.records) settleLearningRecord(snapshot, session, record)

    const storage = new MemoryStorage()
    storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(snapshot))
    setActivePinia(createPinia())
    const learning = useLearningStore()
    let id = 0
    expect(
      learning.initialize({
        storage,
        clock: createManualClock(new Date(2026, 10, 20, 12).getTime()),
        random: createSeededRandom(42),
        ids: { next: () => `completion-${++id}` },
      }),
    ).toBe(true)

    const wrapper = mount(PracticeCompletion, {
      props: { sessionId: session.id },
      global: { stubs: { RouterLink: true } },
    })
    expect(wrapper.text()).toContain('按题型有效完成')
    expect(wrapper.text()).toContain('数值计算 1 题')
    expect(wrapper.text()).toContain('填空 1 题')
  })
})
