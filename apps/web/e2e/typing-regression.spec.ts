import { expect, test, type Page } from '@playwright/test'
import {
  createEmptyLearningSnapshot,
  LEARNING_STORAGE_KEY,
} from '../src/learning/persistence/snapshot'

const PROGRESS_KEY = 'type-happy:progress:v1'
const RESULT_HEADING = /新纪录!|练习完成/

interface LessonPayload {
  id: string
  title: string
  content:
    { kind: 'text'; text: string } | { kind: 'pinyin'; chars: { char: string; pinyin: string }[] }
}

interface CoursePayload {
  course: { id: string; title: string }
  lessons: { id: string; title: string }[]
}

async function fetchJson<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api${path}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as T
}

async function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

test('T13-03 指法与英语课程输入、退格修正、成绩保存、历史与线性解锁', async ({ page }) => {
  const fingering = await fetchJson<LessonPayload>(page, '/courses/fingering/lessons/f-01')
  if (fingering.content.kind !== 'text') throw new Error('f-01 应为文本关卡')

  await page.goto('/courses/fingering/lessons/f-01')
  await expect(page.getByRole('heading', { name: fingering.title, exact: false })).toBeVisible()
  // 错键计错后退格修正，不阻塞后续输入
  await page.keyboard.press('x')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(fingering.content.text, { delay: 2 })
  await expect(page.getByText(RESULT_HEADING)).toBeVisible()

  const records = JSON.parse((await readStorage(page, PROGRESS_KEY))!) as Record<
    string,
    { best: { lessonId: string; accuracy: number }; attempts: number; history: unknown[] }
  >
  expect(records['f-01']?.attempts).toBe(1)
  expect(records['f-01']?.history).toHaveLength(1)
  expect(records['f-01']?.best.lessonId).toBe('f-01')
  // 错键保留计错，退格不回滚准确率
  expect(records['f-01']?.best.accuracy).toBeLessThan(100)

  // 课程内线性解锁：完成第 1 关解锁第 2 关，第 3 关仍锁定
  const course = await fetchJson<CoursePayload>(page, '/courses/fingering')
  await page.goto('/courses/fingering')
  await expect(page.getByText(`1 / ${course.lessons.length}`, { exact: true })).toBeVisible()
  await expect(page.locator('button', { hasText: course.lessons[1]!.title })).toBeEnabled()
  await expect(page.locator('button', { hasText: course.lessons[2]!.title })).toBeDisabled()

  // 英语课程同引擎回归
  const english = await fetchJson<LessonPayload>(page, '/courses/english/lessons/e-01')
  if (english.content.kind !== 'text') throw new Error('e-01 应为文本关卡')
  await page.goto('/courses/english/lessons/e-01')
  await expect(page.getByRole('heading', { name: english.title, exact: false })).toBeVisible()
  await page.keyboard.type(english.content.text, { delay: 2 })
  await expect(page.getByText(RESULT_HEADING)).toBeVisible()
  const afterEnglish = JSON.parse((await readStorage(page, PROGRESS_KEY))!) as typeof records
  expect(afterEnglish['e-01']?.attempts).toBe(1)
  expect(afterEnglish['f-01']?.attempts).toBe(1)
})

test('T13-03 中文课程 IME 组合上屏与手动拼音兜底', async ({ page }) => {
  const lesson = await fetchJson<LessonPayload>(page, '/courses/chinese/lessons/c-01')
  if (lesson.content.kind !== 'pinyin') throw new Error('c-01 应为拼音关卡')
  const chars = lesson.content.chars

  await page.goto('/courses/chinese/lessons/c-01')
  await expect(page.getByRole('heading', { name: lesson.title, exact: false })).toBeVisible()

  // Chrome 事件顺序：compositionstart/update/end 后跟一次 input，引擎须去重不重复判定
  for (const { char, pinyin } of chars) {
    await page.evaluate(
      ({ char: ch, pinyin: py }) => {
        window.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
        window.dispatchEvent(new CompositionEvent('compositionupdate', { data: py }))
        window.dispatchEvent(new CompositionEvent('compositionend', { data: ch }))
        window.dispatchEvent(new InputEvent('input', { data: ch, isComposing: false }))
      },
      { char, pinyin },
    )
  }
  await expect(page.getByText(RESULT_HEADING)).toBeVisible()
  const first = JSON.parse((await readStorage(page, PROGRESS_KEY))!) as Record<
    string,
    { attempts: number; history: unknown[] }
  >
  expect(first['c-01']?.attempts).toBe(1)
  expect(first['c-01']?.history).toHaveLength(1)

  // 输入法关闭时退化为手动拼音缓冲：隐藏输入框聚焦后逐字母输入完整音节
  await page.getByRole('button', { name: '再练一次', exact: true }).click()
  await expect(page.getByText(RESULT_HEADING)).toHaveCount(0)
  await page.keyboard.type(chars.map((c) => c.pinyin).join(''), { delay: 2 })
  await expect(page.getByText(RESULT_HEADING)).toBeVisible()
  const second = JSON.parse((await readStorage(page, PROGRESS_KEY))!) as typeof first
  expect(second['c-01']?.attempts).toBe(2)
  expect(second['c-01']?.history).toHaveLength(2)
})

test('WP13 回退演练：原模块不触碰学习存档，清档不越界且原模块不重建学习键', async ({ page }) => {
  const learningSeed = JSON.stringify(createEmptyLearningSnapshot())
  const originalSentinels: Record<string, string> = {
    'type-happy:games:v1': '{"balloon":{"best":12,"attempts":2,"history":[]}}',
    'type-happy:wulin:v1': 'wulin-rollback-sentinel',
    'type-happy:doodle-jump:v1': 'doodle-rollback-sentinel',
  }
  await page.addInitScript(
    ({ learningKey, learningValue, sentinels }) => {
      // 只种一次：清档后再次导航不得重新注入，才能验证原模块不重建学习键
      if (sessionStorage.getItem('rollback-seeded')) return
      sessionStorage.setItem('rollback-seeded', '1')
      if (!localStorage.getItem(learningKey)) localStorage.setItem(learningKey, learningValue)
      for (const [key, value] of Object.entries(sentinels)) {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value)
      }
    },
    {
      learningKey: LEARNING_STORAGE_KEY,
      learningValue: learningSeed,
      sentinels: originalSentinels,
    },
  )

  // 1) 原打字模块完整练习一次：只写自己的进度键，学习存档逐字节不变
  const fingering = await fetchJson<LessonPayload>(page, '/courses/fingering/lessons/f-01')
  if (fingering.content.kind !== 'text') throw new Error('f-01 应为文本关卡')
  await page.goto('/courses/fingering/lessons/f-01')
  await expect(page.getByRole('heading', { name: fingering.title, exact: false })).toBeVisible()
  await page.keyboard.type(fingering.content.text, { delay: 2 })
  await expect(page.getByText(RESULT_HEADING)).toBeVisible()
  expect(await readStorage(page, LEARNING_STORAGE_KEY)).toBe(learningSeed)
  const progressAfterTyping = await readStorage(page, PROGRESS_KEY)
  expect(progressAfterTyping).toContain('f-01')

  // 2) 清档只删除学习键，全部原模块真实键逐字节保留
  await page.goto('/learning/parent')
  await page.getByRole('button', { name: '清除学习数据', exact: true }).click()
  await page.getByRole('button', { name: '确认清除，不可撤销', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('学习、金币和农场记录已清除')
  expect(await readStorage(page, LEARNING_STORAGE_KEY)).toBeNull()
  expect(await readStorage(page, PROGRESS_KEY)).toBe(progressAfterTyping)
  for (const [key, value] of Object.entries(originalSentinels)) {
    expect(await readStorage(page, key)).toBe(value)
  }

  // 3) 回退到原模块独立运行：不重建学习键，加载不重写原存档
  await page.goto('/courses/fingering/lessons/f-01')
  await expect(page.getByRole('heading', { name: fingering.title, exact: false })).toBeVisible()
  await expect(page.getByText('历史最佳', { exact: false })).toBeVisible()
  expect(await readStorage(page, LEARNING_STORAGE_KEY)).toBeNull()
  expect(await readStorage(page, PROGRESS_KEY)).toBe(progressAfterTyping)
})
