import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LearningAnswerInput from '../../src/components/learning/LearningAnswerInput.vue'
import LearningFeedback from '../../src/components/learning/LearningFeedback.vue'
import { generateMathQuestion } from '../../src/learning/practice/math-generator'
import {
  createPracticeSession,
  submitPracticeAnswer,
} from '../../src/learning/practice/practice-session'

describe('LearningAnswerInput', () => {
  it('rejects empty and invalid numbers and submits a trimmed non-negative integer', async () => {
    const wrapper = mount(LearningAnswerInput, {
      props: {
        modelValue: { answer: '', quotient: '', remainder: '' },
        questionType: 'number',
        correcting: false,
        disabled: false,
      },
    })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ modelValue: { answer: '-1', quotient: '', remainder: '' } })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.setProps({ modelValue: { answer: ' 42 ', quotient: '', remainder: '' } })
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ kind: 'number', value: 42 }]])
  })

  it('submits quotient and remainder as separate values', async () => {
    const wrapper = mount(LearningAnswerInput, {
      props: {
        modelValue: { answer: '', quotient: '7', remainder: '3' },
        questionType: 'quotient-remainder',
        correcting: true,
        disabled: false,
      },
    })
    expect(wrapper.get('button').text()).toBe('提交订正')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([
      [{ kind: 'quotient-remainder', quotient: 7, remainder: 3 }],
    ])
  })
})

describe('LearningFeedback', () => {
  it('uses text for success and shows full steps plus zero-reward guidance after explanation', () => {
    const question = generateMathQuestion('written-mul-two-v1', 42, 'feedback-question', 'L1')
    if (question.standardAnswer.kind !== 'number') throw new Error('预期数字题')
    let session = createPracticeSession({
      id: 'feedback-session',
      mode: 'special',
      questions: [{ question }],
      createdAt: 100,
    })
    const wrong = { kind: 'number' as const, value: question.standardAnswer.value + 1 }
    session = submitPracticeAnswer(session, wrong, 110)
    session = submitPracticeAnswer(session, wrong, 120)
    const wrapper = mount(LearningFeedback, {
      props: { entry: session.questions[0], practiceReward: 0 },
    })
    expect(wrapper.text()).toContain('提示 2')
    expect(wrapper.text()).toContain('分步讲解')
    expect(wrapper.text()).toContain('正确答案')
    expect(wrapper.text()).toContain('请重新输入正确答案')

    session = submitPracticeAnswer(session, question.standardAnswer, 130)
    const corrected = mount(LearningFeedback, {
      props: { entry: session.questions[0], practiceReward: 0 },
    })
    expect(corrected.text()).toContain('已完成订正')
    expect(corrected.text()).toContain('本题不发放金币')
    expect(corrected.text()).toContain('同类题再练一次')
  })
})
