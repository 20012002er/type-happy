import { BATTLE, IDLE_BASE, OFFLINE_CAP_H, REBIRTH_IDLE_BONUS } from '../constants'
import { chapter } from '../data'
import type { WulinSave } from '../types'
import { evaluation, spiritMax, spiritMaxOf } from './character'
import { settleSeclusion, settleTraining, type SimCtx } from './training'

export interface IdleRate {
  exp: number
  silver: number
  potential: number
}

/** 挂机时薪(已含评价/福缘/传承/节奏倍率) */
export function idleRate(ctx: SimCtx, chapterId: string): IdleRate {
  const ch = chapter(chapterId)
  const char = ctx.char
  const evalMult = 1 + evaluation(char) / 800
  const fortuneMult = 1 + char.fortune * BATTLE.fortuneIdle
  const rebirthMult = 1 + char.rebirths * REBIRTH_IDLE_BONUS
  const m = evalMult * fortuneMult * rebirthMult * ctx.rate()
  const idx = Math.max(1, ch.index)
  return {
    exp: IDLE_BASE.exp * Math.pow(idx, 1.8) * m,
    silver: IDLE_BASE.silver * Math.pow(idx, 1.6) * m,
    potential: IDLE_BASE.potential * idx * m,
  }
}

export interface IdleGain {
  hours: number
  exp: number
  silver: number
  potential: number
}

/** 懒结算挂机收益;capHours 用于离线结算封顶 */
export function settleIdle(ctx: SimCtx, capHours?: number): IdleGain | null {
  const { save, char } = ctx
  if (!save.idle.chapter) return null
  const now = ctx.now()
  let dtH = Math.max(0, (now - save.idle.since) / 3600e3)
  if (capHours !== undefined) dtH = Math.min(dtH, capHours)
  save.idle.since = now
  if (dtH <= 0) return null
  const rate = idleRate(ctx, save.idle.chapter)
  const gain = {
    hours: dtH,
    exp: Math.round(rate.exp * dtH),
    silver: Math.round(rate.silver * dtH),
    potential: Math.round(rate.potential * dtH),
  }
  char.exp += gain.exp
  char.silver += gain.silver
  char.potential += gain.potential
  return gain
}

export function startIdle(ctx: SimCtx, chapterId: string): string | null {
  const { save } = ctx
  if (!save.progress.unlocked.includes(chapterId)) return '尚未游历到该地'
  settleIdle(ctx)
  save.idle = { chapter: chapterId, since: ctx.now() }
  ctx.log(`开始在「${chapter(chapterId).title}」挂机闯荡。`)
  return null
}

export function stopIdle(ctx: SimCtx): void {
  settleIdle(ctx)
  ctx.save.idle.chapter = null
}

export interface OfflineReport {
  minutes: number
  spirit: number
  idle: IdleGain | null
  trainedSkill: string | null
  trainedLevels: number
  seclusionText: string | null
}

/** 离线结算:精神恢复 → 挂机 → 练功 → 闭关 */
export function settleOffline(ctx: SimCtx): OfflineReport | null {
  const { save, char } = ctx
  const now = ctx.now()
  const awayMs = now - save.lastSeen
  if (awayMs < 60e3) {
    save.lastSeen = now
    return null
  }
  const minutes = Math.floor(awayMs / 60e3)
  const capH = OFFLINE_CAP_H[save.settings.pace]

  // 精神恢复 =(离线分钟/3)²;气血随时间缓慢回复
  const spiritBefore = char.spirit
  const recover = Math.min(spiritMax(char), Math.pow(minutes / 3, 2))
  char.spirit = Math.min(spiritMaxOf(char.rebirths), char.spirit + recover)
  const spiritGained = Math.round(char.spirit - spiritBefore)
  char.hp = Math.min(1, char.hp + minutes * 0.02)

  const idle = settleIdle(ctx, capH)

  const trainSkill = save.training.skill
  const trainLvBefore = trainSkill ? (char.skills[trainSkill]?.level ?? 0) : 0
  settleTraining(ctx)
  const trainedLevels = trainSkill ? (char.skills[trainSkill]?.level ?? trainLvBefore) - trainLvBefore : 0

  let seclusionText: string | null = null
  if (save.seclusion.skill) {
    const before2 = save.seclusion.skill
    settleSeclusion(ctx)
    if (before2 && !save.seclusion.skill) seclusionText = before2
  }

  save.lastSeen = now
  return { minutes, spirit: spiritGained, idle, trainedSkill: trainSkill, trainedLevels, seclusionText }
}

export function formatAway(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return `${h} 小时${m > 0 ? ` ${m} 分` : ''}`
  return `${Math.floor(h / 24)} 天 ${h % 24} 小时`
}

/** 周期性在线结算(由 UI ticker 调用) */
export function settleAll(ctx: SimCtx): void {
  settleIdle(ctx)
  settleTraining(ctx)
  settleSeclusion(ctx)
  const save: WulinSave = ctx.save
  save.lastSeen = ctx.now()
}
