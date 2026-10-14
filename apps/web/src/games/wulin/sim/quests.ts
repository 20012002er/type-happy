import { DAILY_TASKS, HARVEST_TASKS, SIGNIN_CYCLE } from '../constants'
import { sect as sectById } from '../data'
import type { DailyTask, HarvestTask } from '../constants'
import { charLevel } from './character'
import type { SimCtx } from './training'

export function todayStr(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 跨天重置每日计数 */
export function rollDaily(ctx: SimCtx): void {
  const today = todayStr(ctx.now())
  if (ctx.save.daily.date !== today) {
    ctx.save.daily.date = today
    ctx.save.daily.done = {}
  }
}

export function harvestUnlocked(ctx: SimCtx, t: HarvestTask): boolean {
  const { char, save } = ctx
  if (char.exp < t.req.exp) return false
  if (t.req.chapter <= 1) return true
  return save.progress.chaptersDone.some((id) => chapterIndexOf(id) >= t.req.chapter)
}

function chapterIndexOf(id: string): number {
  const n = Number(id.replace('c', ''))
  return Number.isFinite(n) ? n : 0
}

export function harvestReady(ctx: SimCtx, t: HarvestTask): boolean {
  return (ctx.save.harvest[t.id] ?? 0) <= ctx.now()
}

/** 收菜任务 */
export function doHarvest(ctx: SimCtx, id: string): string | null {
  const t = HARVEST_TASKS.find((x) => x.id === id)
  if (!t) return '无此任务'
  if (!harvestUnlocked(ctx, t)) return '尚未解锁'
  if (!harvestReady(ctx, t)) return '还没到时间'
  const rate = ctx.rate()
  const fortuneMult = 1 + ctx.char.fortune * 0.02
  const exp = Math.round(t.exp * rate * fortuneMult)
  ctx.char.exp += exp
  ctx.save.harvest[t.id] = ctx.now() + (t.cdHours * 3600e3) / rate
  ctx.log(`${t.name}:一番忙碌,经验 +${exp}。`)
  return null
}

export function dailyUnlocked(ctx: SimCtx, t: DailyTask): boolean {
  if (t.req.chapter <= 1) return true
  return ctx.save.progress.chaptersDone.some((id) => chapterIndexOf(id) >= t.req.chapter)
}

export function dailyCount(ctx: SimCtx, id: string): number {
  rollDaily(ctx)
  return ctx.save.daily.done[id] ?? 0
}

export function dailyReady(ctx: SimCtx, id: string): boolean {
  return (ctx.save.harvest[`d-${id}`] ?? 0) <= ctx.now()
}

/** 每日历练任务 */
export function doDaily(ctx: SimCtx, id: string): string | null {
  const t = DAILY_TASKS.find((x) => x.id === id)
  if (!t) return '无此任务'
  rollDaily(ctx)
  if (!dailyUnlocked(ctx, t)) return '尚未解锁'
  if (dailyCount(ctx, id) >= t.limit) return '今日次数已用完'
  if (!dailyReady(ctx, id)) return '还没到时间'
  const rate = ctx.rate()
  const fortuneMult = 1 + ctx.char.fortune * 0.02
  const exp = Math.round(t.reward.exp * rate * fortuneMult)
  const potential = Math.round(t.reward.potential * rate)
  const silver = Math.round(t.reward.silver * rate * fortuneMult)
  ctx.char.exp += exp
  ctx.char.potential += potential
  ctx.char.silver += silver
  ctx.save.daily.done[id] = dailyCount(ctx, id) + 1
  ctx.save.harvest[`d-${id}`] = ctx.now() + (t.cdSec * 1000) / rate
  let extra = ''
  if (id === 'thief' && Math.random() < 0.4) {
    addItem(ctx, 'mat-pouch', 1)
    extra = ',搜出【贼赃】×1'
  }
  if (id === 'bandit' && Math.random() < 0.5) {
    addItem(ctx, 'mat-token', 1)
    extra = ',搜出【匪牌】×1'
  }
  ctx.log(`${t.name}:经验 +${exp},潜能 +${potential},碎银 +${silver}${extra}。`)
  return null
}

function addItem(ctx: SimCtx, itemId: string, count: number): void {
  ctx.char.bag[itemId] = (ctx.char.bag[itemId] ?? 0) + count
}

export function canSignin(ctx: SimCtx): boolean {
  return ctx.save.daily.signinDate !== todayStr(ctx.now())
}

/** 每日签到 */
export function doSignin(ctx: SimCtx): string | null {
  if (!canSignin(ctx)) return '今日已签到'
  const idx = ctx.save.daily.signin % SIGNIN_CYCLE.length
  const r = SIGNIN_CYCLE[idx].reward
  const rate = ctx.rate()
  if (r.exp) ctx.char.exp += Math.round(r.exp * rate)
  if (r.silver) ctx.char.silver += Math.round(r.silver * rate)
  if (r.potential) ctx.char.potential += Math.round(r.potential * rate)
  if (r.item) addItem(ctx, r.item, r.count ?? 1)
  ctx.save.daily.signin++
  ctx.save.daily.signinDate = todayStr(ctx.now())
  ctx.log(`签到第 ${ctx.save.daily.signin} 天:${SIGNIN_CYCLE[idx].label}。`)
  return null
}

export function sectTaskReady(ctx: SimCtx, index: number): boolean {
  const s = sectById(ctx.char.sect)
  if (!s) return false
  return (ctx.save.daily.sectTasks[`${s.id}-${index}`] ?? 0) <= ctx.now()
}

/** 师门任务 */
export function doSectTask(ctx: SimCtx, index: number): string | null {
  const s = sectById(ctx.char.sect)
  if (!s) return '尚未入门'
  const t = s.tasks[index]
  if (!t) return '无此任务'
  if (charLevel(ctx.char) < t.level) return `人物等级不足(${t.level} 级)`
  const key = `${s.id}-${index}`
  if ((ctx.save.daily.sectTasks[key] ?? 0) > ctx.now()) return '还没到时间'
  const rate = ctx.rate()
  ctx.char.contribution += t.reward.contribution
  ctx.char.prestige += t.reward.prestige
  ctx.char.exp += Math.round(t.reward.exp * rate)
  ctx.char.experience += 10
  if (t.reward.page && Math.random() < 0.5) addItem(ctx, t.reward.page, 1)
  ctx.save.daily.sectTasks[key] = ctx.now() + (t.cdHours * 3600e3) / rate
  ctx.log(`完成师门任务「${t.name}」:贡献 +${t.reward.contribution},威望 +${t.reward.prestige},经验 +${Math.round(t.reward.exp * rate)}。`)
  return null
}

/** 磕头拜师:每次 +5 潜能,每日 100 次上限(致敬原作彩蛋) */
export function kowtow(ctx: SimCtx): string | null {
  if (!ctx.char.sect) return '尚未入门'
  const today = todayStr(ctx.now())
  const key = 'kowtow'
  if (ctx.save.daily.date !== today) {
    ctx.save.daily.date = today
    ctx.save.daily.done = {}
  }
  if ((ctx.save.daily.done[key] ?? 0) >= 100) return '今天磕得够多了,师傅都心疼了'
  ctx.save.daily.done[key] = (ctx.save.daily.done[key] ?? 0) + 1
  ctx.char.potential += 5
  return null
}
