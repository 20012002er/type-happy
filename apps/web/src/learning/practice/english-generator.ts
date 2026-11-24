import { getCourseById } from '../content/course-registry'
import { parseQuestionSnapshot } from '../contracts'
import type { Difficulty, ErrorCauseRule, QuestionSnapshot } from '../types'
import {
  buildChoiceSnapshot,
  buildEnglishSnapshot,
  cause,
  getEnglishGenerator,
  getEnglishUnitContent,
  registerEnglishGenerator,
  seededRandom,
  sentenceRule,
  spellingRule,
  type EnglishGeneratorContext,
  type EnglishWordItem,
} from './english-gen-shared'
import { getEnglishTemplate } from './english-templates'
import './english-content-grade4-spring'
import './english-content-grade5-autumn'
import './english-content-grade5-spring'

function unitContent(context: EnglishGeneratorContext) {
  return getEnglishUnitContent(context.course.id, context.template.classification.unitId)
}

registerEnglishGenerator('english-vocab-spelling', (context) => {
  const item = context.random.pick(unitContent(context).words)
  const used = new Set<string>([item.word.toLowerCase()])
  const causes: ErrorCauseRule[] = []
  for (const [index, misspelling] of (item.misspellings ?? []).entries()) {
    const key = misspelling.value.toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    causes.push(
      cause(`misspelling-${index}`, '拼写混淆', misspelling.feedback, [
        { kind: 'english-spelling', value: misspelling.value },
      ]),
    )
  }
  return buildEnglishSnapshot(context, {
    prompt: `根据中文释义和语境写出单词：${item.meaning}。语境：${item.context}`,
    answer: { kind: 'english-spelling', value: item.word },
    acceptedAnswerRule: spellingRule([item.word]),
    hints: {
      level1: '先读英语语境，想一想缺的单词表示什么意思，再回忆它的拼写',
      level2: `这个单词以字母 ${item.word[0]} 开头，一共 ${item.word.length} 个字母`,
    },
    explanationSteps: [
      `要写的单词是 ${item.word}`,
      `它的中文释义是「${item.meaning}」`,
      `放进语境读一读：${item.context.replace('____', item.word)}`,
    ],
    errorCauseRules: causes,
  })
})

registerEnglishGenerator('english-vocab-choice', (context) => {
  const content = unitContent(context)
  const item = context.random.pick(content.words)
  const pool = content.words.filter((word) => word.word !== item.word)
  const picked: EnglishWordItem[] = []
  while (picked.length < 3 && pool.length > 0) {
    picked.push(pool.splice(context.random.int(0, pool.length - 1), 1)[0])
  }
  return buildChoiceSnapshot(context, {
    prompt: `选出与中文释义「${item.meaning}」对应的英语单词。`,
    options: [item.word, picked[0].word, picked[1].word, picked[2].word],
    distractorFeedback: [
      `这个选项的意思是「${picked[0].meaning}」，和题目要求的释义不一样`,
      `这个选项的意思是「${picked[1].meaning}」，和题目要求的释义不一样`,
      `这个选项的意思是「${picked[2].meaning}」，和题目要求的释义不一样`,
    ],
    hints: {
      level1: '先读懂中文释义，再逐个核对选项单词的意思',
      level2: `正确单词以字母 ${item.word[0]} 开头，一共 ${item.word.length} 个字母`,
    },
    explanationSteps: [
      `正确单词是 ${item.word}`,
      `它的中文释义是「${item.meaning}」`,
      `语境示例：${item.context.replace('____', item.word)}`,
    ],
  })
})

registerEnglishGenerator('english-grammar-choice', (context) => {
  const item = context.random.pick(unitContent(context).grammar)
  return buildChoiceSnapshot(context, {
    prompt: item.prompt,
    options: item.options,
    distractorFeedback: item.distractorFeedback,
    hints: { level1: item.hint1, level2: item.hint2 },
    explanationSteps: item.explanation,
  })
})

registerEnglishGenerator('english-sentence-completion', (context) => {
  const item = context.random.pick(unitContent(context).completions)
  const standard = item.answers.map((accepted) => accepted[0])
  const used = new Set<string>([standard.join(' ').toLowerCase()])
  const causes: ErrorCauseRule[] = []
  for (const [index, error] of (item.commonErrors ?? []).entries()) {
    const key = error.values.join(' ').toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    causes.push(
      cause(`common-error-${index}`, '句型搭配混淆', error.feedback, [
        { kind: 'sentence-completion', values: error.values },
      ]),
    )
  }
  return buildEnglishSnapshot(context, {
    prompt: item.prompt,
    answer: { kind: 'sentence-completion', values: standard },
    acceptedAnswerRule: sentenceRule(item.answers),
    hints: { level1: item.hint1, level2: item.hint2 },
    explanationSteps: item.explanation,
    errorCauseRules: causes,
  })
})

registerEnglishGenerator('english-situational-choice', (context) => {
  const item = context.random.pick(unitContent(context).situations)
  return buildChoiceSnapshot(context, {
    prompt: `${item.situation} 请选择恰当的英语表达。`,
    options: item.options,
    distractorFeedback: item.distractorFeedback,
    hints: { level1: item.hint1, level2: item.hint2 },
    explanationSteps: item.explanation,
  })
})

export function generateEnglishQuestion(
  templateId: string,
  seed: number,
  instanceId: string,
  difficulty?: Difficulty,
): QuestionSnapshot {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('题目种子必须是非负安全整数')
  if (instanceId.trim().length === 0) throw new Error('题目实例 ID 不能为空')
  const template = getEnglishTemplate(templateId)
  const course = getCourseById(template.classification.courseId)
  if (!course) throw new Error(`模板课程不存在：${template.classification.courseId}`)
  const selectedDifficulty = difficulty ?? template.difficulty
  if (!template.supportedDifficulties.includes(selectedDifficulty)) {
    throw new Error(`模板 ${templateId} 不支持难度 ${selectedDifficulty}`)
  }
  const context: EnglishGeneratorContext = {
    template,
    course,
    difficulty: selectedDifficulty,
    seed,
    instanceId,
    random: seededRandom(seed),
  }
  return parseQuestionSnapshot(getEnglishGenerator(template.generator)(context), course)
}

export function createEnglishRetestQuestion(
  original: QuestionSnapshot,
  seed: number,
  instanceId: string,
): QuestionSnapshot {
  if (instanceId === original.instanceId) throw new Error('复测题必须使用新的题目实例 ID')
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateEnglishQuestion(
      original.templateId,
      seed + attempt,
      instanceId,
      original.difficulty,
    )
    if (candidate.prompt !== original.prompt) return candidate
  }
  throw new Error('无法生成不同语境的复测变式')
}