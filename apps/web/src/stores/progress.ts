import { defineStore } from 'pinia'
import type { PracticeResult } from '@type-happy/shared'

const STORAGE_KEY = 'type-happy:progress:v1'
const HISTORY_LIMIT = 20

export interface LessonProgress {
  best: PracticeResult
  attempts: number
  history: PracticeResult[]
}

export type ProgressRecords = Record<string, LessonProgress>

export function isBetterResult(a: PracticeResult, b: PracticeResult): boolean {
  if (a.wpm !== b.wpm) return a.wpm > b.wpm
  return a.accuracy > b.accuracy
}

function isPracticeResult(value: unknown): value is PracticeResult {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.lessonId === 'string' &&
    typeof v.wpm === 'number' &&
    typeof v.cpm === 'number' &&
    typeof v.accuracy === 'number' &&
    typeof v.durationMs === 'number' &&
    typeof v.completedAt === 'string'
  )
}

function isLessonProgress(value: unknown): value is LessonProgress {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return isPracticeResult(v.best) && typeof v.attempts === 'number' && Array.isArray(v.history)
}

function load(): ProgressRecords {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const result: ProgressRecords = {}
    for (const [key, value] of Object.entries(parsed)) {
      // 损坏的条目直接丢弃,不影响其余记录
      if (isLessonProgress(value)) result[key] = value
    }
    return result
  } catch {
    // localStorage 损坏或不可用时重置
    return {}
  }
}

function persist(records: ProgressRecords): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 配额或隐私模式错误,忽略
  }
}

export const useProgressStore = defineStore('progress', {
  state: () => ({
    records: load() as ProgressRecords,
  }),

  getters: {
    progressOf(state) {
      return (lessonId: string): LessonProgress | null => state.records[lessonId] ?? null
    },
    bestOf(state) {
      return (lessonId: string): PracticeResult | null => state.records[lessonId]?.best ?? null
    },
  },

  actions: {
    saveResult(result: PracticeResult) {
      const existing = this.records[result.lessonId]
      if (existing) {
        existing.attempts += 1
        existing.history = [result, ...existing.history].slice(0, HISTORY_LIMIT)
        if (isBetterResult(result, existing.best)) existing.best = result
      } else {
        this.records[result.lessonId] = { best: result, attempts: 1, history: [result] }
      }
      persist(this.records)
    },
    /** 课程内线性解锁:完成第 N 关解锁第 N+1 关 */
    isLessonUnlocked(lessonIds: string[], index: number): boolean {
      if (index <= 0) return true
      const prev = lessonIds[index - 1]
      return prev !== undefined && prev in this.records
    },
    isCompleted(lessonId: string): boolean {
      return lessonId in this.records
    },
    completedCount(lessonIds: string[]): number {
      return lessonIds.filter((id) => id in this.records).length
    },
  },
})
