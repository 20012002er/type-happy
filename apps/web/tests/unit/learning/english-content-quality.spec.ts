import { describe, it } from 'vitest'
import { getCourseById } from '../../../src/learning/content/course-registry'
import { parseQuestionSnapshot } from '../../../src/learning/contracts'
import { judgeAnswer } from '../../../src/learning/practice/answer'
import { generateEnglishQuestion } from '../../../src/learning/practice/english-generator'
import {
  ENGLISH_TEMPLATES,
  getEnglishTemplate,
} from '../../../src/learning/practice/english-templates'

const PROPERTY_SEED_COUNT = 10000

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function containsEnglishWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i').test(text)
}

describe('UT-ENGLISH-PROP ten-thousand-seed property checks', () => {
  it.each(ENGLISH_TEMPLATES.map((template) => [template.id] as const))(
    '%s passes structure, judging, attribution and hint-leak checks across 10000 seeds',
    (templateId) => {
      const template = getEnglishTemplate(templateId)
      const course = getCourseById(template.classification.courseId)
      assert(course !== undefined, `模板课程不存在：${template.classification.courseId}`)
      for (let seed = 0; seed < PROPERTY_SEED_COUNT; seed += 1) {
        const difficulty =
          template.supportedDifficulties[seed % template.supportedDifficulties.length]
        const question = generateEnglishQuestion(templateId, seed, `prop-${seed}`, difficulty)
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
        // T06-08：无音频守卫
        assert(question.resources.length === 0, `${label} 不得携带音频等资源`)
        const optionText = (question.options ?? []).map((option) => option.text).join('\n')
        assert(
          /[A-Za-z]/.test(`${question.prompt}\n${optionText}`),
          `${label} 必须包含英文理解内容`,
        )
        const hints = `${question.hints.level1}\n${question.hints.level2}`
        assert(hints.trim().length > 0, `${label} 提示不能为空`)
        if (question.type === 'single-choice') {
          const options = question.options ?? []
          assert(options.length === 4, `${label} 选择题必须恰好四个选项`)
          assert(new Set(options.map((option) => option.text)).size === 4, `${label} 选项文本重复`)
          const correct = options.filter(
            (option) =>
              judgeAnswer(question, { kind: 'single-choice', optionId: option.id }).correct,
          )
          assert(correct.length === 1, `${label} 选择题必须有唯一正确答案`)
          assert(!containsEnglishWord(hints, correct[0].text), `${label} 提示泄露正确选项`)
        }
        if (question.standardAnswer.kind === 'english-spelling') {
          const value = question.standardAnswer.value
          assert(/^[A-Za-z'’\- ]+$/.test(value), `${label} 拼写答案字符集非法`)
          assert(!containsEnglishWord(hints, value), `${label} 提示泄露拼写答案`)
        }
        if (question.acceptedAnswerRule.kind === 'sentence-completion') {
          for (const group of question.acceptedAnswerRule.values) {
            for (const value of group) {
              assert(!containsEnglishWord(hints, value), `${label} 提示泄露补全答案`)
            }
          }
        }
      }
    },
    60000,
  )
})
