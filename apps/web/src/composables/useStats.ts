import { computed, ref } from 'vue'
import type { PracticeResult } from '@type-happy/shared'

/**
 * WPM/CPM/准确率/用时统计。
 * WPM 采用 5 字符 = 1 词 的标准换算;CPM 为每分钟正确字符数。
 */
export function useStats(lessonId: string) {
  const startTime = ref<number | null>(null)
  const endTime = ref<number | null>(null)
  const now = ref(Date.now())
  const correctChars = ref(0)
  const totalKeys = ref(0)
  const wrongKeys = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  const elapsedMs = computed(() => {
    if (startTime.value === null) return 0
    return Math.max(0, (endTime.value ?? now.value) - startTime.value)
  })

  const minutes = computed(() => elapsedMs.value / 60000)
  const wpm = computed(() =>
    minutes.value > 0 ? Math.round(correctChars.value / 5 / minutes.value) : 0,
  )
  const cpm = computed(() =>
    minutes.value > 0 ? Math.round(correctChars.value / minutes.value) : 0,
  )
  const accuracy = computed(() =>
    totalKeys.value > 0
      ? Math.round(((totalKeys.value - wrongKeys.value) / totalKeys.value) * 1000) / 10
      : 100,
  )

  function markStart(): void {
    if (startTime.value !== null) return
    startTime.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, 200)
  }

  function recordKey(correct: boolean): void {
    totalKeys.value += 1
    if (!correct) wrongKeys.value += 1
  }

  function setCorrectChars(n: number): void {
    correctChars.value = Math.max(0, n)
  }

  function finish(): PracticeResult | null {
    if (startTime.value === null) return null
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    endTime.value = Date.now()
    now.value = endTime.value
    const mins = Math.max(elapsedMs.value, 1) / 60000
    return {
      lessonId,
      wpm: Math.round(correctChars.value / 5 / mins),
      cpm: Math.round(correctChars.value / mins),
      accuracy:
        totalKeys.value > 0
          ? Math.round(((totalKeys.value - wrongKeys.value) / totalKeys.value) * 1000) / 10
          : 100,
      durationMs: Math.round(elapsedMs.value),
      completedAt: new Date().toISOString(),
    }
  }

  function reset(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    startTime.value = null
    endTime.value = null
    correctChars.value = 0
    totalKeys.value = 0
    wrongKeys.value = 0
    now.value = Date.now()
  }

  return { elapsedMs, wpm, cpm, accuracy, markStart, recordKey, setCorrectChars, finish, reset }
}
