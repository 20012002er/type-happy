import { describe, expect, it } from 'vitest'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import {
  createChoiceVariant,
  createQuestionVariant,
  hasVariantGenerator,
  registerVariantGenerator,
} from '../../../src/learning/practice/question-variants'
import type { QuestionSnapshot } from '../../../src/learning/types'
import {
  buildChoiceFixture,
  buildQuestionFixture,
  CHOICE_OPTIONS,
} from '../../helpers/question-fixtures'

function choiceVariantGenerator(prompt: string) {
  return (original: QuestionSnapshot, seed: number, instanceId: string): QuestionSnapshot =>
    buildChoiceFixture({
      templateId: original.templateId,
      instanceId,
      seed,
      prompt,
    })
}

describe('variant generator registry', () => {
  it('registers generators once and reports availability for math templates', () => {
    expect(hasVariantGenerator('oral-mul-one-v1')).toBe(true)
    expect(hasVariantGenerator('no-such-template')).toBe(false)
    expect(() => registerVariantGenerator(' ', choiceVariantGenerator('变式题干'))).toThrow(
      '不能为空',
    )
    registerVariantGenerator('registry-once-v1', choiceVariantGenerator('变式题干'))
    expect(hasVariantGenerator('registry-once-v1')).toBe(true)
    expect(() =>
      registerVariantGenerator('registry-once-v1', choiceVariantGenerator('再注册')),
    ).toThrow('已注册变式生成器')
  })
})

describe('choice variant correction', () => {
  it('only applies to single-choice questions with a registered generator', () => {
    const numberQuestion = buildQuestionFixture({
      standardAnswer: { kind: 'number', value: 24 },
      acceptedAnswerRule: { kind: 'number', values: [24] },
    })
    expect(() => createChoiceVariant(numberQuestion, 1, 'variant-1')).toThrow(
      '只有选择题使用变式订正',
    )
    const unregistered = buildChoiceFixture({ templateId: 'choice-unregistered-v1' })
    expect(() => createChoiceVariant(unregistered, 1, 'variant-1')).toThrow('没有可用的变式生成器')
  })

  it('validates seed and instance id before generating', () => {
    registerVariantGenerator('choice-seed-v1', choiceVariantGenerator('新的情境题干'))
    const original = buildChoiceFixture({ templateId: 'choice-seed-v1' })
    expect(() => createChoiceVariant(original, -1, 'variant-1')).toThrow('非负安全整数')
    expect(() => createChoiceVariant(original, 1.5, 'variant-1')).toThrow('非负安全整数')
    expect(() => createChoiceVariant(original, 1, ' ')).toThrow('不能为空')
  })

  it('produces a different prompt with the same classification and records the origin', () => {
    registerVariantGenerator('choice-valid-v1', choiceVariantGenerator('果园里一共有多少棵果树？'))
    const original = buildChoiceFixture({ templateId: 'choice-valid-v1' })
    const variant = createChoiceVariant(original, 7, 'variant-valid')
    expect(variant.prompt).not.toBe(original.prompt)
    expect(variant.instanceId).toBe('variant-valid')
    expect(variant.templateId).toBe(original.templateId)
    expect(variant.classification).toEqual(original.classification)
    expect(variant.difficulty).toBe(original.difficulty)
    expect(variant.type).toBe('single-choice')
    expect(variant.variantOf).toEqual({
      templateId: original.templateId,
      instanceId: original.instanceId,
    })
  })

  it('rejects variants that break identity, classification, difficulty or type', () => {
    const original = buildChoiceFixture({ templateId: 'choice-guard-v1' })
    registerVariantGenerator('choice-guard-v1', (source, _seed, instanceId) => ({
      ...source,
      instanceId,
    }))
    expect(() => createChoiceVariant(original, 1, original.instanceId)).toThrow('新的题目实例 ID')

    registerVariantGenerator('choice-course-v1', (_source, seed, instanceId) =>
      buildChoiceFixture({
        templateId: 'choice-course-v1',
        instanceId,
        seed,
        courseId: 'pep-grade4-spring-math',
        prompt: '不同课程的题干',
      }),
    )
    const courseOriginal = buildChoiceFixture({ templateId: 'choice-course-v1' })
    expect(() => createChoiceVariant(courseOriginal, 1, 'variant-course')).toThrow(
      '相同课程与知识点',
    )

    registerVariantGenerator('choice-difficulty-v1', (_source, seed, instanceId) =>
      buildChoiceFixture({
        templateId: 'choice-difficulty-v1',
        instanceId,
        seed,
        difficulty: 'L3',
        prompt: '不同难度的题干',
      }),
    )
    const difficultyOriginal = buildChoiceFixture({ templateId: 'choice-difficulty-v1' })
    expect(() => createChoiceVariant(difficultyOriginal, 1, 'variant-difficulty')).toThrow(
      '相同难度',
    )

    registerVariantGenerator('choice-type-v1', (_source, seed, instanceId) =>
      buildQuestionFixture({
        templateId: 'choice-type-v1',
        instanceId,
        seed,
        prompt: '不同题型的题干',
        standardAnswer: { kind: 'number', value: 24 },
        acceptedAnswerRule: { kind: 'number', values: [24] },
      }),
    )
    const typeOriginal = buildChoiceFixture({ templateId: 'choice-type-v1' })
    expect(() => createChoiceVariant(typeOriginal, 1, 'variant-type')).toThrow('相同题型')
  })

  it('does not accept option shuffling as a variant', () => {
    const original = buildChoiceFixture({ templateId: 'choice-shuffle-v1' })
    registerVariantGenerator('choice-shuffle-v1', (source, _seed, instanceId) => ({
      ...source,
      instanceId,
      options: [...CHOICE_OPTIONS].reverse(),
    }))
    expect(() => createChoiceVariant(original, 1, 'variant-shuffle')).toThrow(
      '无法生成不同题干或情境的变式',
    )
  })
})

describe('generic question variants for retest and replacement', () => {
  it('routes math templates through the numeric retest generator', () => {
    const original = generateMathQuestion('oral-mul-one-v1', 11, 'math-original', 'L1')
    const variant = createQuestionVariant(original, 22, 'math-variant')
    expect(variant.templateId).toBe(original.templateId)
    expect(variant.instanceId).toBe('math-variant')
    expect(variant.prompt).not.toBe(original.prompt)
    expect(variant.classification).toEqual(original.classification)
  })

  it('routes other templates through the registry and fails without one', () => {
    registerVariantGenerator('choice-retest-v1', choiceVariantGenerator('复测用的新情境'))
    const original = buildChoiceFixture({ templateId: 'choice-retest-v1' })
    const variant = createQuestionVariant(original, 5, 'choice-retest-variant')
    expect(variant.prompt).not.toBe(original.prompt)
    expect(variant.variantOf?.instanceId).toBe(original.instanceId)

    const missing = buildChoiceFixture({ templateId: 'choice-missing-v1' })
    expect(() => createQuestionVariant(missing, 5, 'missing-variant')).toThrow(
      '没有可用的变式生成器',
    )
  })
})
