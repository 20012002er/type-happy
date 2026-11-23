import { pathToFileURL } from 'node:url'
import { LEARNING_RULES } from '../src/learning/config/rules'
import { GRADE4_AUTUMN_MATH_COURSE } from '../src/learning/content/grade4-math'
import {
  parseCourse,
  parseQuestionSnapshot,
  parseQuestionTemplate,
} from '../src/learning/contracts'
import { generateMathQuestion } from '../src/learning/practice/math-generator'
import { MATH_TEMPLATES } from '../src/learning/practice/math-templates'

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
    english: [],
    courseAvailability: [
      {
        courseId: GRADE4_AUTUMN_MATH_COURSE.id,
        subject: 'math',
        available: true,
      },
    ],
    recipes: [],
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

export function validateCurrentMathContent(): void {
  const course = parseCourse(GRADE4_AUTUMN_MATH_COURSE)
  for (const template of MATH_TEMPLATES) {
    parseQuestionTemplate(template, course)
    for (const difficulty of template.supportedDifficulties) {
      const question = generateMathQuestion(
        template.id,
        42,
        `content-check-${template.id}-${difficulty}`,
        difficulty,
      )
      parseQuestionSnapshot(question, course)
    }
  }
}

export function validateLearningContent(
  manifest: LearningContentManifest = createCurrentContentManifest(),
): ContentQualityReport {
  validateCurrentMathContent()
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
