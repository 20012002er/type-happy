import { afterEach, describe, expect, it } from 'vitest'
import { getCourseById } from '../../../src/learning/content/course-registry'
import { parseQuestionSnapshot } from '../../../src/learning/contracts'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import {
  disableMathTemplate,
  getDisabledMathTemplates,
  reenableMathTemplate,
} from '../../../src/learning/practice/content-health'
import { generateMathQuestion } from '../../../src/learning/practice/math-generator'
import {
  filterMathTemplates,
  getMathTemplate,
  MATH_TEMPLATES,
} from '../../../src/learning/practice/math-templates'
import { generateComprehensivePaper } from '../../../src/learning/practice/paper'
import { createQuestionVariant } from '../../../src/learning/practice/question-variants'

const PROPERTY_SEED_COUNT = 10000

/** 超纲守卫：低学期题面、提示与讲解不得出现高学期必要概念（UT-MATH-SCOPE）。 */
const SCOPE_GUARDS: Record<string, readonly RegExp[]> = {
  'pep-grade4-autumn-integrated-math': [/方程/, /\d+\s*\/\s*\d+/, /负数/],
  'pep-grade4-spring-math': [/方程/, /\d+\s*\/\s*\d+/, /负数/],
  'pep-grade5-autumn-math': [/\d+\s*\/\s*\d+/, /正比例|反比例|比例尺/, /圆柱|圆锥/, /百分数/],
  'pep-grade5-spring-math': [/正比例|反比例|比例尺/, /圆柱|圆锥/, /百分数/],
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

describe('UT-MATH-PROP ten-thousand-seed property checks', () => {
  it.each(MATH_TEMPLATES.map((template) => [template.id] as const))(
    '%s passes structure, range, unique answer and solvability across 10000 seeds',
    (templateId) => {
      const template = getMathTemplate(templateId)
      const course = getCourseById(template.classification.courseId)
      assert(course !== undefined, `模板课程不存在：${template.classification.courseId}`)
      const guards = SCOPE_GUARDS[template.classification.courseId] ?? []
      for (let seed = 0; seed < PROPERTY_SEED_COUNT; seed += 1) {
        const difficulty =
          template.supportedDifficulties[seed % template.supportedDifficulties.length]
        const question = generateMathQuestion(templateId, seed, `prop-${seed}`, difficulty)
        const label = `${templateId} seed=${seed} difficulty=${difficulty}`
        parseQuestionSnapshot(question, course)
        assert(judgeAnswer(question, question.standardAnswer).correct, `${label} 标准答案必须判对`)
        for (const rule of question.errorCauseRules) {
          for (const wrong of rule.answers) {
            const judgement = judgeAnswer(question, wrong)
            assert(!judgement.correct, `${label} 错因 ${rule.id} 的答案必须判错`)
            assert(judgement.cause?.id === rule.id, `${label} 错因 ${rule.id} 归因错位`)
          }
        }
        if (question.type === 'single-choice') {
          const options = question.options ?? []
          assert(options.length === 4, `${label} 选择题必须恰好四个选项`)
          assert(new Set(options.map((option) => option.text)).size === 4, `${label} 选项文本重复`)
          const correctCount = options.filter(
            (option) =>
              judgeAnswer(question, { kind: 'single-choice', optionId: option.id }).correct,
          ).length
          assert(correctCount === 1, `${label} 选择题必须有唯一正确答案`)
        }
        const answer = question.standardAnswer
        if (answer.kind === 'number') {
          assert(Number.isFinite(answer.value), `${label} 数字答案必须是有限数`)
        }
        if (answer.kind === 'word-problem') {
          assert(Number.isFinite(answer.value) && answer.value >= 0, `${label} 应用题结果不现实`)
        }
        assert(!/÷\s*0(?![\d.])/.test(question.prompt), `${label} 存在除数 0`)
        const text = [
          question.prompt,
          question.hints.level1,
          question.hints.level2,
          ...question.explanationSteps,
        ].join('\n')
        for (const guard of guards) {
          assert(!guard.test(text), `${label} 出现超纲内容：${guard}`)
        }
      }
    },
    60000,
  )
})

describe('content anomaly disabling', () => {
  afterEach(() => {
    for (const entry of getDisabledMathTemplates()) reenableMathTemplate(entry.templateId)
  })

  it('records a traceable reason, excludes the template from filters and blocks generation', () => {
    const templateId = 'g5s-same-denominator-calc-v1'
    const course = getCourseById('pep-grade5-spring-math')
    const historical = generateMathQuestion(templateId, 5, 'historical', 'L2')
    disableMathTemplate(templateId, '选择题存在两个合理答案')
    expect(getDisabledMathTemplates()).toEqual([{ templateId, reason: '选择题存在两个合理答案' }])
    expect(
      filterMathTemplates({ courseId: 'pep-grade5-spring-math' }).some(
        (template) => template.id === templateId,
      ),
    ).toBe(false)
    expect(() => generateMathQuestion(templateId, 1, 'blocked')).toThrow('模板已停用')
    expect(() => disableMathTemplate(templateId, '重复停用')).toThrow('已停用')
    expect(() => disableMathTemplate('g5s-volume-calc-v1', '  ')).toThrow('停用原因不能为空')
    // 历史快照不受停用影响，仍可无损解析，不追溯扣回历史奖励
    expect(parseQuestionSnapshot(historical, course)).toEqual(historical)
  })

  it('replaces a disabled-template question with a same-unit sibling keeping course, difficulty and type', () => {
    const original = generateMathQuestion('g5s-same-denominator-calc-v1', 5, 'orig', 'L2')
    disableMathTemplate('g5s-same-denominator-calc-v1', '内容异常')
    const variant = createQuestionVariant(original, 9, 'replacement')
    expect(variant.templateId).not.toBe(original.templateId)
    expect(variant.classification.courseId).toBe(original.classification.courseId)
    expect(variant.classification.unitId).toBe(original.classification.unitId)
    expect(variant.difficulty).toBe(original.difficulty)
    expect(variant.type).toBe(original.type)
    expect(variant.variantOf).toEqual({
      templateId: original.templateId,
      instanceId: original.instanceId,
    })
    expect(judgeAnswer(variant, variant.standardAnswer).correct).toBe(true)
  })

  it('skips disabled templates when composing papers and restores them after reenable', () => {
    const templateId = 'g5s-same-denominator-calc-v1'
    disableMathTemplate(templateId, '内容异常')
    const paper = generateComprehensivePaper({
      courseId: 'pep-grade5-spring-math',
      seed: 7,
      idPrefix: 'health',
    })
    expect(paper.questions).toHaveLength(30)
    expect(paper.questions.every((input) => input.question.templateId !== templateId)).toBe(true)
    reenableMathTemplate(templateId)
    expect(getDisabledMathTemplates()).toEqual([])
    expect(
      filterMathTemplates({ courseId: 'pep-grade5-spring-math' }).some(
        (template) => template.id === templateId,
      ),
    ).toBe(true)
    expect(generateMathQuestion(templateId, 1, 'restored').templateId).toBe(templateId)
    expect(() => reenableMathTemplate(templateId)).toThrow('并未停用')
  })
})
