import { defineStore } from 'pinia'

const STORAGE_KEY = 'type-happy:games:v1'

export interface GameBest {
  /** 历史最高分 */
  bestScore: number
  /** 历史最高连击 */
  bestCombo: number
  /** 累计游玩局数 */
  plays: number
}

export type GameRecords = Record<string, GameBest>

function isGameBest(value: unknown): value is GameBest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.bestScore === 'number' &&
    typeof v.bestCombo === 'number' &&
    typeof v.plays === 'number'
  )
}

function load(): GameRecords {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const result: GameRecords = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (isGameBest(value)) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

function persist(records: GameRecords): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 配额或隐私模式错误,忽略
  }
}

export const useGamesStore = defineStore('games', {
  state: () => ({
    records: load() as GameRecords,
  }),

  getters: {
    bestOf(state) {
      return (gameId: string): GameBest | null => state.records[gameId] ?? null
    },
  },

  actions: {
    /** 记录一局成绩,返回是否刷新最高分 */
    recordScore(gameId: string, score: number, bestCombo: number): boolean {
      const existing = this.records[gameId]
      const isNewBest = !existing || score > existing.bestScore
      if (existing) {
        existing.plays += 1
        existing.bestScore = Math.max(existing.bestScore, score)
        existing.bestCombo = Math.max(existing.bestCombo, bestCombo)
      } else {
        this.records[gameId] = { bestScore: score, bestCombo, plays: 1 }
      }
      persist(this.records)
      return isNewBest
    },
  },
})
