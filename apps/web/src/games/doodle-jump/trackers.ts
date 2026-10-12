import type { GameEvent } from './constants'
import type { GameResult } from './game'
import { emptyThemeStats, type DoodleSave } from './save'

export interface MissionDef {
  id: string
  type: string
  data: Record<string, unknown>
}

const EVENT_MAP: Record<string, GameEvent['type']> = {
  Kill: 'kill',
  Bounce: 'bounce-monster',
  Avoid: 'avoid-monster',
  HitMissing: 'hit-missing',
  FlyIntoWithPropeller: 'propeller-kill',
  BouncePlatform: 'bounce-platform',
  JumpSpring: 'jump-spring',
  BreakPlatform: 'break-platform',
  UfoAbducted: 'ufo-abducted',
  UfoBounced: 'ufo-bounced',
}

const ITEM_MAP: Record<string, string> = {
  'Original.JetPack': 'jetpack',
  'Original.Propeller': 'propeller',
  'Original.SpringShoes': 'springshoes',
  'Original.Trampoline': 'trampoline',
  'Any.JetPack': 'jetpack',
  'Any.Propeller': 'propeller',
  'Any.SpringShoes': 'springshoes',
  'Any.Trampoline': 'trampoline',
}

function missionApplicable(m: MissionDef): boolean {
  const d = m.data
  if (m.type === 'get-score') return true
  if (m.type === 'monster-action' || m.type === 'custom-action') {
    const events = String(d['allowed-events'] ?? '').split(',')
    return events.every((e) => EVENT_MAP[e.trim()] !== undefined) && events.length > 0
  }
  if (m.type === 'use-powerup' || m.type === 'use-bonus') {
    const items = String(d['item-id'] ?? '').split(',')
    return items.some((i) => ITEM_MAP[i.trim()] !== undefined)
  }
  if (m.type === 'platform-action') return String(d['allowed-events'] ?? '') === 'BouncePlatform'
  return false
}

function missionTarget(m: MissionDef): string | null {
  const d = m.data
  if (m.type === 'monster-action' || m.type === 'custom-action') {
    const ev = String(d['allowed-events'] ?? '').split(',')[0]?.trim()
    return ev ? (EVENT_MAP[ev] ?? null) : null
  }
  if (m.type === 'use-powerup' || m.type === 'use-bonus') {
    const item = String(d['item-id'] ?? '').split(',').map((s) => s.trim()).find((i) => ITEM_MAP[i])
    return item ? ITEM_MAP[item] : null
  }
  if (m.type === 'platform-action') return 'bounce-platform'
  if (m.type === 'get-score') return 'score'
  return null
}

function missionRequired(m: MissionDef): number {
  const d = m.data
  const v = d['required-actions'] ?? d['required-use'] ?? d['required-completions'] ?? d['required-actions']
  return typeof v === 'number' ? v : 1
}

export function selectMissions(all: MissionDef[], save: DoodleSave, count = 3): string[] {
  const pool = all.filter((m) => missionApplicable(m) && !save.missions[m.id]?.done)
  const chosen = [...save.activeMissions.filter((id) => pool.some((p) => p.id === id))]
  for (const m of pool) {
    if (chosen.length >= count) break
    if (!chosen.includes(m.id)) chosen.push(m.id)
  }
  return chosen.slice(0, count)
}

export class RunTracker {
  private run = {
    kills: 0,
    killStreak: 0,
    bounces: 0,
    avoids: 0,
    springStreak: 0,
    springs: 0,
    breaks: 0,
    jetpacks: 0,
    propellers: 0,
    springshoes: 0,
    trampolines: 0,
    movingJumps: 0,
    staticJumps: 0,
    missed: 0,
    propellerKills: 0,
    ufoAbducted: 0,
    ufoBounced: 0,
    jetpackSeenUntaken: 0,
  }

  constructor(
    private save: DoodleSave,
    private missions: MissionDef[],
    private onChanged: () => void,
  ) {}

  event(e: GameEvent, score: number): void {
    const r = this.run
    switch (e.type) {
      case 'kill':
        r.kills += 1
        r.killStreak += 1
        break
      case 'propeller-kill':
        r.propellerKills += 1
        r.kills += 1
        r.killStreak += 1
        break
      case 'bounce-monster':
        r.bounces += 1
        break
      case 'avoid-monster':
        r.avoids += 1
        break
      case 'hit-missing':
        r.missed += 1
        r.killStreak = 0
        break
      case 'jump-spring':
        r.springs += 1
        r.springStreak += 1
        break
      case 'bounce-platform':
        if (e.moving) r.movingJumps += 1
        else r.staticJumps += 1
        r.springStreak = 0
        break
      case 'break-platform':
        r.breaks += 1
        break
      case 'use-powerup':
        if (e.powerup === 'jetpack') r.jetpacks += 1
        if (e.powerup === 'propeller') r.propellers += 1
        if (e.powerup === 'shield') void 0
        break
      case 'use-bonus':
        if (e.powerup === 'springshoes') r.springshoes += 1
        if (e.powerup === 'trampoline') r.trampolines += 1
        break
      case 'ufo-abducted':
        r.ufoAbducted += 1
        break
      case 'ufo-bounced':
        r.ufoBounced += 1
        break
      default:
        break
    }
    this.evalMissions(score)
    this.evalAchievements()
  }

  private missionCount(m: MissionDef): number | null {
    const t = missionTarget(m)
    const r = this.run
    switch (t) {
      case 'kill':
        return r.kills
      case 'bounce-monster':
        return r.bounces
      case 'avoid-monster':
        return r.avoids
      case 'hit-missing':
        return r.missed
      case 'propeller-kill':
        return r.propellerKills
      case 'bounce-platform':
        return r.movingJumps
      case 'jump-spring':
        return r.springs
      case 'break-platform':
        return r.breaks
      case 'jetpack':
        return r.jetpacks
      case 'propeller':
        return r.propellers
      case 'springshoes':
        return r.springshoes
      case 'trampoline':
        return r.trampolines
      case 'ufo-abducted':
        return r.ufoAbducted
      case 'ufo-bounced':
        return r.ufoBounced
      default:
        return null
    }
  }

  private evalMissions(score: number): void {
    let changed = false
    for (const id of this.save.activeMissions) {
      const m = this.missions.find((x) => x.id === id)
      if (!m || this.save.missions[id]?.done) continue
      const st = (this.save.missions[id] ??= { progress: 0, done: false })
      const reset = m.data['reset-between-games'] === true
      if (reset && st.progress === -1) continue
      let cur: number
      if (m.type === 'get-score') cur = score >= (m.data['required-score'] as number) ? 1 : 0
      else cur = this.missionCount(m) ?? 0
      if (cur > st.progress) {
        st.progress = cur
        changed = true
      }
      if (cur >= missionRequired(m)) {
        st.done = true
        st.progress = missionRequired(m)
        changed = true
      }
    }
    if (changed) this.onChanged()
  }

  private evalAchievements(): void {
    const r = this.run
    const unlock = (id: string, cond: boolean): void => {
      if (cond && !this.save.achievements[id]) {
        this.save.achievements[id] = true
        this.onChanged()
      }
    }
    unlock('achspring', r.springshoes > 0)
    unlock('achspringer', r.springStreak >= 3)
    unlock('achsuperspringer', r.springStreak >= 5)
    unlock('achbouncer', r.bounces >= 10)
    unlock('achsuperbouncer', r.bounces >= 30)
    unlock('achconflict', r.avoids >= 10)
    unlock('achsuperconflict', r.avoids >= 30)
    unlock('achsharp', r.killStreak >= 5)
    unlock('achsupersharp', r.killStreak >= 10)
    unlock('achpropeller', r.propellers >= 3)
    unlock('achjetpack', r.jetpacks >= 3)
    unlock('achufo', r.ufoAbducted >= 1)
    unlock('achufobouncer', r.ufoBounced >= 1)
    unlock('achmonsterchopper', r.propellerKills >= 1)
    unlock('achendurancejumper', r.staticJumps >= 200)
    unlock('achfocusedendurancejumper', r.movingJumps >= 100)
    unlock('achepicfail', r.breaks >= 50)
  }

  endRun(res: GameResult): void {
    const s = (this.save.stats.original ??= emptyThemeStats())
    const r = this.run
    s.plays += 1
    s.lastScore = res.score
    s.highScore = Math.max(s.highScore, res.score)
    s.totalScore += res.score
    s.totalTime += res.time
    s.longestTime = Math.max(s.longestTime, res.time)
    s.lastTime = res.time
    s.lastJumps = res.jumps
    s.totalJumps += res.jumps
    s.maxJumps = Math.max(s.maxJumps, res.jumps)
    s.monstersShot += res.monstersShot
    s.monstersJumped += res.monstersJumped
    s.jetpackFlights += r.jetpacks
    s.propellerFlights += r.propellers
    s.deaths[res.cause] += 1
    if (res.score >= 100000 && !this.save.achievements.achhundredthousand) {
      this.save.achievements.achhundredthousand = true
    }
    this.onChanged()
  }
}
