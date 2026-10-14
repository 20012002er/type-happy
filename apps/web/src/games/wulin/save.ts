import type { WulinSave } from './types'

const STORAGE_KEY = 'type-happy:wulin:v1'

export function defaultProgress(): WulinSave['progress'] {
  return {
    chapter: 'c1',
    room: 'c1-dock',
    questByChapter: {},
    unlocked: ['c1'],
    defeated: [],
    picked: [],
    trains: {},
    flags: {},
    chaptersDone: [],
  }
}

export function defaultSave(): WulinSave {
  const now = Date.now()
  return {
    version: 1,
    createdAt: now,
    lastSeen: now,
    settings: { sound: true, pace: 'fast' },
    char: null,
    progress: defaultProgress(),
    training: { skill: null, since: 0 },
    seclusion: { skill: null, since: 0, totalSec: 0, guard: false },
    idle: { chapter: null, since: 0 },
    harvest: {},
    daily: { date: '', done: {}, signin: 0, signinDate: '', sectTasks: {} },
    rebirth: { stage: 0, disciple: null, trainedAt: 0 },
    seenIntro: false,
    log: [],
  }
}

function sanitize(parsed: Partial<WulinSave>): WulinSave {
  const base = defaultSave()
  const rawQb = parsed.progress?.questByChapter
  const questByChapter: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(rawQb ?? {})) {
    // 兼容旧档:数字(已完成步数)→ 连续下标数组
    questByChapter[k] = typeof v === 'number' ? Array.from({ length: v }, (_, i) => i) : Array.isArray(v) ? v : []
  }
  return {
    ...base,
    ...parsed,
    version: 1,
    settings: { ...base.settings, ...(parsed.settings ?? {}) },
    progress: { ...base.progress, ...(parsed.progress ?? {}), questByChapter },
    training: { ...base.training, ...(parsed.training ?? {}) },
    seclusion: { ...base.seclusion, ...(parsed.seclusion ?? {}) },
    idle: { ...base.idle, ...(parsed.idle ?? {}) },
    harvest: { ...(parsed.harvest ?? {}) },
    daily: { ...base.daily, ...(parsed.daily ?? {}) },
    rebirth: { ...base.rebirth, ...(parsed.rebirth ?? {}) },
    log: Array.isArray(parsed.log) ? parsed.log.slice(0, 60) : [],
  }
}

export function loadSave(): WulinSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSave()
    const parsed = JSON.parse(raw) as Partial<WulinSave>
    if (typeof parsed !== 'object' || parsed === null) return defaultSave()
    return sanitize(parsed)
  } catch {
    return defaultSave()
  }
}

export function persistSave(save: WulinSave): void {
  try {
    save.lastSeen = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    // 配额或隐私模式错误,忽略
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略
  }
}

/** 导出存档为可分享文本(base64) */
export function exportSave(save: WulinSave): string {
  const json = JSON.stringify(save)
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
}

/** 导入存档文本;失败返回 null */
export function importSave(text: string): WulinSave | null {
  try {
    const bin = atob(text.trim())
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json) as Partial<WulinSave>
    if (typeof parsed !== 'object' || parsed === null || parsed.version !== 1) return null
    return sanitize(parsed)
  } catch {
    return null
  }
}
