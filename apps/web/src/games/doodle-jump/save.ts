const STORAGE_KEY = 'type-happy:doodle-jump:v1'

export interface ThemeStats {
  highScore: number
  lastScore: number
  plays: number
  totalScore: number
  totalTime: number
  longestTime: number
  lastTime: number
  totalJumps: number
  maxJumps: number
  lastJumps: number
  monstersShot: number
  monstersJumped: number
  ufoShot: number
  ufoJumped: number
  jetpackFlights: number
  propellerFlights: number
  rocketFlights: number
  deaths: { miss: number; monster: number; ufo: number; blackhole: number }
}

export interface DoodleSave {
  version: 1
  name: string
  settings: {
    sound: boolean
    directionalShooting: boolean
  }
  unlockedThemes: string[]
  activeTheme: string
  stats: Record<string, ThemeStats>
  achievements: Record<string, boolean>
  missions: Record<string, { progress: number; done: boolean }>
  activeMissions: string[]
  tutorialSeen: boolean
}

export function emptyThemeStats(): ThemeStats {
  return {
    highScore: 0,
    lastScore: 0,
    plays: 0,
    totalScore: 0,
    totalTime: 0,
    longestTime: 0,
    lastTime: 0,
    totalJumps: 0,
    maxJumps: 0,
    lastJumps: 0,
    monstersShot: 0,
    monstersJumped: 0,
    ufoShot: 0,
    ufoJumped: 0,
    jetpackFlights: 0,
    propellerFlights: 0,
    rocketFlights: 0,
    deaths: { miss: 0, monster: 0, ufo: 0, blackhole: 0 },
  }
}

export function defaultSave(): DoodleSave {
  return {
    version: 1,
    name: 'doodler',
    settings: { sound: true, directionalShooting: false },
    unlockedThemes: ['original'],
    activeTheme: 'original',
    stats: { original: emptyThemeStats() },
    achievements: {},
    missions: {},
    activeMissions: [],
    tutorialSeen: false,
  }
}

export function loadSave(): DoodleSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSave()
    const parsed = JSON.parse(raw) as Partial<DoodleSave>
    const base = defaultSave()
    const stats: Record<string, ThemeStats> = {}
    for (const key of new Set([...Object.keys(base.stats), ...Object.keys(parsed.stats ?? {})])) {
      stats[key] = { ...emptyThemeStats(), ...(parsed.stats?.[key] ?? {}) }
    }
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      stats,
      achievements: { ...(parsed.achievements ?? {}) },
      missions: { ...(parsed.missions ?? {}) },
      activeMissions: parsed.activeMissions ?? [],
    }
  } catch {
    return defaultSave()
  }
}

export function persistSave(save: DoodleSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    // 配额或隐私模式错误,忽略
  }
}
