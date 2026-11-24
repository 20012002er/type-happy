import { pathToFileURL } from 'node:url'
import { LEARNING_RULES } from '../src/learning/config/rules'
import {
  COURSE_AVAILABILITY,
  COURSE_REGISTRY,
  getCourseById,
} from '../src/learning/content/course-registry'
import {
  parseCourse,
  parseQuestionSnapshot,
  parseQuestionTemplate,
} from '../src/learning/contracts'
import { generateMathQuestion } from '../src/learning/practice/math-generator'
import { judgeAnswer } from '../src/learning/practice/answer'
import { MATH_TEMPLATES } from '../src/learning/practice/math-templates'
import { generateEnglishQuestion } from '../src/learning/practice/english-generator'
import { getEnglishUnitContent } from '../src/learning/practice/english-gen-shared'
import { ENGLISH_TEMPLATES } from '../src/learning/practice/english-templates'
import { PROCESSING_RECIPES } from '../src/learning/processing/recipes'
import type { QuestionSnapshot } from '../src/learning/types'

export interface VersionedContent {
  id: string
  version: number
}

export interface CourseAvailabilityContent {
  courseId: string
  subject: 'math' | 'english'
  available: boolean
  unavailableReason?: string
}

export interface RecipeContent extends VersionedContent {
  inputs: Readonly<Record<string, number>>
  durationMinutes: number
  output: { itemId: string; quantity: number }
  unitPrice: number
}

export interface LearningContentManifest {
  math: readonly VersionedContent[]
  english: readonly VersionedContent[]
  courseAvailability: readonly CourseAvailabilityContent[]
  recipes: readonly RecipeContent[]
}

export interface ContentQualityReport {
  math: number
  english: number
  courseAvailability: number
  recipes: number
}

export interface ReleaseReviewGates {
  contentReviewRef?: string
  economyReviewRef?: string
}

export function createCurrentContentManifest(): LearningContentManifest {
  return {
    math: MATH_TEMPLATES.map(({ id, version }) => ({ id, version })),
    english: ENGLISH_TEMPLATES.map(({ id, version }) => ({ id, version })),
    courseAvailability: COURSE_AVAILABILITY.map(
      ({ courseId, subject, available, unavailableReason }) => ({
        courseId,
        subject,
        available,
        unavailableReason,
      }),
    ),
    recipes: PROCESSING_RECIPES,
  }
}

function expectPositiveInteger(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${path} 必须是正整数`)
  }
}

function validateVersionedContent(items: readonly VersionedContent[], label: string): void {
  const ids = new Set<string>()
  for (const item of items) {
    if (!item.id.trim()) throw new Error(`${label} 内容 ID 不能为空`)
    if (ids.has(item.id)) throw new Error(`${label} 内容 ID 重复：${item.id}`)
    ids.add(item.id)
    expectPositiveInteger(item.version, `${label}.${item.id}.version`)
  }
}

function validateCourseAvailability(items: readonly CourseAvailabilityContent[]): void {
  const keys = new Set<string>()
  for (const item of items) {
    if (!item.courseId.trim()) throw new Error('课程可用性中的课程 ID 不能为空')
    const key = `${item.courseId}:${item.subject}`
    if (keys.has(key)) throw new Error(`课程可用性重复：${key}`)
    keys.add(key)
    if (!item.available && !item.unavailableReason?.trim()) {
      throw new Error(`不可用课程必须说明原因：${key}`)
    }
  }
}

function validateRecipes(recipes: readonly RecipeContent[]): void {
  validateVersionedContent(recipes, 'recipes')
  for (const recipe of recipes) {
    const inputs = Object.entries(recipe.inputs)
    if (inputs.length === 0) throw new Error(`配方 ${recipe.id} 至少包含一种原料`)
    for (const [itemId, quantity] of inputs) {
      if (!itemId.trim()) throw new Error(`配方 ${recipe.id} 存在空原料 ID`)
      expectPositiveInteger(quantity, `recipes.${recipe.id}.inputs.${itemId}`)
    }
    expectPositiveInteger(recipe.durationMinutes, `recipes.${recipe.id}.durationMinutes`)
    if (!recipe.output.itemId.trim()) throw new Error(`配方 ${recipe.id} 产出 ID 不能为空`)
    expectPositiveInteger(recipe.output.quantity, `recipes.${recipe.id}.output.quantity`)
    expectPositiveInteger(recipe.unitPrice, `recipes.${recipe.id}.unitPrice`)
    if (recipe.unitPrice > LEARNING_RULES.farm.dailySaleIncomeCap) {
      throw new Error(`配方 ${recipe.id} 单价不能超过每日出售上限`)
    }
  }
}

/** 逐学期批量质检的语义守卫：除数 0、多解选择和不现实应用结果在发布前拦截。 */
const CONTENT_CHECK_SEEDS = [42, 7, 11, 99, 2026] as const

export function validateCurrentMathContent(): void {
  for (const template of MATH_TEMPLATES) {
    const course = getCourseById(template.classification.courseId)
    if (!course) throw new Error(`模板课程不存在：${template.classification.courseId}`)
    parseQuestionTemplate(template, course)
    for (const difficulty of template.supportedDifficulties) {
      for (const seed of CONTENT_CHECK_SEEDS) {
        const question = generateMathQuestion(
          template.id,
          seed,
          `content-check-${template.id}-${difficulty}-${seed}`,
          difficulty,
        )
        parseQuestionSnapshot(question, course)
        validateMathQuestionSemantics(question)
      }
    }
  }
}

function validateMathQuestionSemantics(question: QuestionSnapshot): void {
  const label = `${question.templateId}/${question.instanceId}`
  if (/÷\s*0(?![\d.])/.test(question.prompt)) throw new Error(`${label} 存在除数 0`)
  if (question.type === 'single-choice') {
    const correctCount = (question.options ?? []).filter(
      (option) => judgeAnswer(question, { kind: 'single-choice', optionId: option.id }).correct,
    ).length
    if (correctCount !== 1) throw new Error(`${label} 选择题必须有唯一正确答案`)
  }
  const answer = question.standardAnswer
  if (answer.kind === 'number' && !Number.isFinite(answer.value)) {
    throw new Error(`${label} 数字答案必须是有限数`)
  }
  if (answer.kind === 'word-problem' && (!Number.isFinite(answer.value) || answer.value < 0)) {
    throw new Error(`${label} 应用题结果不符合现实语义`)
  }
}

/** 按英文单词边界判断提示是否泄露答案（大小写不敏感）。 */
function containsEnglishWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i').test(text)
}

/** 静态内容守卫：拼写字符集、选项唯一、错因不等于标准答案、提示不泄露完整答案。 */
function validateEnglishUnitContents(): void {
  const seen = new Set<string>()
  for (const template of ENGLISH_TEMPLATES) {
    const { courseId, unitId } = template.classification
    const key = `${courseId}:${unitId}`
    if (seen.has(key)) continue
    seen.add(key)
    const content = getEnglishUnitContent(courseId, unitId)
    for (const item of content.words) {
      if (!/^[A-Za-z'’\- ]+$/.test(item.word))
        throw new Error(`${key} 单词拼写字符集非法：${item.word}`)
      if (!item.meaning.trim()) throw new Error(`${key} 单词缺少中文释义：${item.word}`)
      if (!item.context.includes('____')) throw new Error(`${key} 单词语境缺少空位：${item.word}`)
      for (const misspelling of item.misspellings ?? []) {
        if (misspelling.value.toLowerCase() === item.word.toLowerCase()) {
          throw new Error(`${key} 错拼与正确拼写相同：${item.word}`)
        }
      }
    }
    for (const item of content.grammar) {
      if (new Set(item.options).size !== 4) throw new Error(`${key} 语法选项重复：${item.prompt}`)
      if (containsEnglishWord(`${item.hint1}\n${item.hint2}`, item.options[0])) {
        throw new Error(`${key} 语法提示泄露答案：${item.prompt}`)
      }
    }
    for (const item of content.completions) {
      if (item.answers.length === 0 || item.answers.some((group) => group.length === 0)) {
        throw new Error(`${key} 补全题缺少可接受答案：${item.prompt}`)
      }
      const standard = item.answers
        .map((group) => group[0])
        .join(' ')
        .toLowerCase()
      for (const error of item.commonErrors ?? []) {
        if (error.values.join(' ').toLowerCase() === standard) {
          throw new Error(`${key} 错因答案与标准答案相同：${item.prompt}`)
        }
      }
      const hints = `${item.hint1}\n${item.hint2}`
      for (const group of item.answers) {
        for (const value of group) {
          if (containsEnglishWord(hints, value)) {
            throw new Error(`${key} 补全提示泄露答案：${item.prompt}`)
          }
        }
      }
    }
    for (const item of content.situations) {
      if (new Set(item.options).size !== 4)
        throw new Error(`${key} 情境选项重复：${item.situation}`)
    }
  }
}

export function validateCurrentEnglishContent(): void {
  validateEnglishUnitContents()
  for (const template of ENGLISH_TEMPLATES) {
    const course = getCourseById(template.classification.courseId)
    if (!course) throw new Error(`模板课程不存在：${template.classification.courseId}`)
    parseQuestionTemplate(template, course)
    for (const difficulty of template.supportedDifficulties) {
      for (const seed of CONTENT_CHECK_SEEDS) {
        const question = generateEnglishQuestion(
          template.id,
          seed,
          `content-check-${template.id}-${difficulty}-${seed}`,
          difficulty,
        )
        parseQuestionSnapshot(question, course)
        validateEnglishQuestionSemantics(question)
      }
    }
  }
}

function validateEnglishQuestionSemantics(question: QuestionSnapshot): void {
  const label = `${question.templateId}/${question.instanceId}`
  // T06-08：P0 英语课程包无音频依赖，不得携带任何资源或听力入口
  if (question.resources.length > 0) throw new Error(`${label} 英语题目不得携带音频等资源`)
  if (!question.hints.level1.trim() || !question.hints.level2.trim()) {
    throw new Error(`${label} 英语题目必须提供两级提示`)
  }
  if (question.explanationSteps.length === 0) throw new Error(`${label} 英语题目缺少讲解`)
  const optionText = (question.options ?? []).map((option) => option.text).join('\n')
  if (!/[A-Za-z]/.test(`${question.prompt}\n${optionText}`)) {
    throw new Error(`${label} 题目必须包含英文理解内容，不能只靠中文提示`)
  }
  if (!judgeAnswer(question, question.standardAnswer).correct) {
    throw new Error(`${label} 标准答案必须判对`)
  }
  for (const rule of question.errorCauseRules) {
    for (const wrong of rule.answers) {
      const judgement = judgeAnswer(question, wrong)
      if (judgement.correct) throw new Error(`${label} 错因 ${rule.id} 的答案被判对`)
      if (judgement.cause?.id !== rule.id) throw new Error(`${label} 错因 ${rule.id} 归因错位`)
    }
  }
  const hints = `${question.hints.level1}\n${question.hints.level2}`
  if (question.type === 'single-choice') {
    const options = question.options ?? []
    if (new Set(options.map((option) => option.text)).size !== 4) {
      throw new Error(`${label} 选项文本重复`)
    }
    const correct = options.filter(
      (option) => judgeAnswer(question, { kind: 'single-choice', optionId: option.id }).correct,
    )
    if (correct.length !== 1) throw new Error(`${label} 选择题必须有唯一正确答案`)
    if (containsEnglishWord(hints, correct[0].text)) throw new Error(`${label} 提示泄露正确选项`)
  }
  if (question.standardAnswer.kind === 'english-spelling') {
    const value = question.standardAnswer.value
    if (!/^[A-Za-z'’\- ]+$/.test(value)) throw new Error(`${label} 拼写答案字符集非法`)
    if (containsEnglishWord(hints, value)) throw new Error(`${label} 提示泄露拼写答案`)
  }
  if (question.acceptedAnswerRule.kind === 'sentence-completion') {
    for (const group of question.acceptedAnswerRule.values) {
      for (const value of group) {
        if (containsEnglishWord(hints, value)) throw new Error(`${label} 提示泄露补全答案`)
      }
    }
  }
}

export function validateLearningContent(
  manifest: LearningContentManifest = createCurrentContentManifest(),
): ContentQualityReport {
  for (const course of COURSE_REGISTRY) parseCourse(course)
  validateCurrentMathContent()
  validateCurrentEnglishContent()
  validateVersionedContent(manifest.math, 'math')
  validateVersionedContent(manifest.english, 'english')
  validateCourseAvailability(manifest.courseAvailability)
  validateRecipes(manifest.recipes)
  return {
    math: manifest.math.length,
    english: manifest.english.length,
    courseAvailability: manifest.courseAvailability.length,
    recipes: manifest.recipes.length,
  }
}

export function assertReleaseReviewGates(gates: ReleaseReviewGates): void {
  if (!gates.contentReviewRef?.trim()) {
    throw new Error('发布内容校验需要 CONTENT_REVIEW_REF（PRD Q1 教学审校记录）')
  }
  if (!gates.economyReviewRef?.trim()) {
    throw new Error('发布内容校验需要 ECONOMY_REVIEW_REF（PRD Q2 经济验收记录）')
  }
}

export function runContentValidationCli(
  args: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ContentQualityReport {
  const report = validateLearningContent()
  if (args.includes('--release')) {
    assertReleaseReviewGates({
      contentReviewRef: env.CONTENT_REVIEW_REF,
      economyReviewRef: env.ECONOMY_REVIEW_REF,
    })
  }
  console.log(
    `学习内容校验通过：math=${report.math}, english=${report.english}, ` +
      `availability=${report.courseAvailability}, recipes=${report.recipes}`,
  )
  return report
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null
if (entryUrl === import.meta.url) runContentValidationCli()
