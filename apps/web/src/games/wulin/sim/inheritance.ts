import { DISCIPLE_MAX, DISCIPLE_STEP, DISCIPLE_TRAIN_SEC, DISCIPLE_TRAIN_SPIRIT, REBIRTH_LEVELS, REBIRTH_POINTS, expForLevel } from '../constants'
import type { AttrKey, WulinSave } from '../types'
import { charLevel, spiritMax } from './character'
import type { SimCtx } from './training'

export function rebirthCount(save: WulinSave): number {
  return save.char?.rebirths ?? 0
}

/** 是否可开启下一次传承(等级达标且未满 3 转) */
export function rebirthAvailable(ctx: SimCtx): boolean {
  const { char } = ctx
  if (char.rebirths >= REBIRTH_LEVELS.length) return false
  return charLevel(char) >= (REBIRTH_LEVELS[char.rebirths] as number)
}

export function nextRebirthLevel(ctx: SimCtx): number | null {
  const r = ctx.char.rebirths
  return r < REBIRTH_LEVELS.length ? (REBIRTH_LEVELS[r] as number) : null
}

/** 开启传承任务:stage 0 → 1,前往荒谷 */
export function startRebirthQuest(ctx: SimCtx): string | null {
  if (!rebirthAvailable(ctx)) return `人物等级需达到 ${nextRebirthLevel(ctx)} 级`
  if (ctx.save.rebirth.stage !== 0) return '传承已在进行中'
  ctx.save.rebirth.stage = 1
  ctx.save.progress.unlocked = Array.from(new Set([...ctx.save.progress.unlocked, 'rb']))
  ctx.log('听闻城北荒谷有孩童被掳,你动身前往——传承之途,自此而始。')
  return null
}

/** 击败判官潘夔后调用:stage 1 → 2,解救孩童 */
export function rescueChild(ctx: SimCtx): void {
  if (ctx.save.rebirth.stage !== 1) return
  ctx.save.rebirth.stage = 2
  ctx.save.rebirth.disciple = {
    name: '',
    attrs: { arm: 20, agi: 20, bone: 20, ins: 20 },
  }
  ctx.log('你打碎牢笼,救出孩童。孩子抓着你的衣角不放——收为传人,悉心培养。')
}

export function discipleReady(ctx: SimCtx): boolean {
  const d = ctx.save.rebirth.disciple
  if (!d) return false
  return (Object.keys(d.attrs) as AttrKey[]).every((k) => d.attrs[k] >= DISCIPLE_MAX)
}

/** 培养弟子:单次耗时 + 精神,四维之一 +5 */
export function trainDisciple(ctx: SimCtx, attr: AttrKey): string | null {
  const { save, char } = ctx
  const d = save.rebirth.disciple
  if (!d || save.rebirth.stage !== 2) return '尚未解救出孩童'
  if (d.attrs[attr] >= DISCIPLE_MAX) return '这一维已经圆满'
  const waitMs = (DISCIPLE_TRAIN_SEC / ctx.rate()) * 1000
  if (ctx.now() < save.rebirth.trainedAt + waitMs) return '孩子累了,让他歇一会儿'
  if (char.spirit < DISCIPLE_TRAIN_SPIRIT) return `精神不足(需 ${DISCIPLE_TRAIN_SPIRIT})`
  char.spirit -= DISCIPLE_TRAIN_SPIRIT
  d.attrs[attr] = Math.min(DISCIPLE_MAX, d.attrs[attr] + DISCIPLE_STEP)
  save.rebirth.trainedAt = ctx.now()
  const names: Record<AttrKey, string> = { arm: '臂力', agi: '身法', bone: '根骨', ins: '悟性' }
  ctx.log(`悉心教导,孩子${names[attr]}精进 +${DISCIPLE_STEP}(现 ${d.attrs[attr]})。`)
  return null
}

export function discipleWaitRemaining(ctx: SimCtx): number {
  const waitMs = (DISCIPLE_TRAIN_SEC / ctx.rate()) * 1000
  return Math.max(0, ctx.save.rebirth.trainedAt + waitMs - ctx.now())
}

/** 确认传承:旧身归隐,以弟子之身重入江湖 */
export function doRebirth(ctx: SimCtx, discipleName: string): string | null {
  const { save, char } = ctx
  if (save.rebirth.stage !== 2) return '传承尚未就绪'
  if (!discipleReady(ctx)) return '弟子四维未圆满,不堪传承大任'
  const name = discipleName.trim() || `${char.name}之徒`

  const oldLevel = charLevel(char)
  const threshold = REBIRTH_LEVELS[char.rebirths] ?? oldLevel
  const overflowExp = Math.max(0, char.exp - expForLevel(threshold))
  const overflowPotential = Math.floor(overflowExp * 0.08333)

  // 卸下装备回背包
  if (char.weapon) {
    char.bag[char.weapon] = (char.bag[char.weapon] ?? 0) + 1
    char.weapon = null
  }
  for (const [slot, id] of Object.entries(char.armor)) {
    if (id) {
      char.bag[id] = (char.bag[id] ?? 0) + 1
      delete char.armor[slot as keyof typeof char.armor]
    }
  }

  const points = REBIRTH_POINTS[char.rebirths] ?? 0
  const keep = {
    innate: { ...char.innate },
    appearance: char.appearance,
    fortune: char.fortune,
    experience: char.experience,
    prestige: char.prestige,
    bag: { ...char.bag },
    pages: { ...char.pages },
    bank: char.bank,
    bagCap: char.bagCap,
  }
  void keep.innate

  // 新身:弟子长大成人(14 岁出师),先天 = 弟子培养值
  const disciple = save.rebirth.disciple!
  char.name = name
  char.innate = { ...disciple.attrs }
  char.appearance = keep.appearance
  char.fortune = keep.fortune
  char.experience = keep.experience
  char.prestige = keep.prestige
  char.bag = keep.bag
  char.pages = keep.pages
  char.bank = keep.bank
  char.bagCap = keep.bagCap
  char.attrPoints += points

  char.exp = 0
  char.potential = char.potential + overflowPotential
  char.spirit = spiritMax(char)
  char.mpGrown = 0
  char.injury = 0
  char.hp = 1
  char.silver = Math.floor(char.silver / 2)
  char.contribution = 0
  char.sect = null
  char.rebirths += 1

  // 武学清空,保留四项基本功 50 级
  char.skills = {
    'bs-fist': { level: 50, exp: 0, activeUnlocked: false },
    'bs-parry': { level: 50, exp: 0, activeUnlocked: false },
    'bs-internal': { level: 50, exp: 0, activeUnlocked: false },
    'bs-light': { level: 50, exp: 0, activeUnlocked: false },
  }
  char.equipped = { output: 'bs-fist', internal: 'bs-internal', lightness: 'bs-light', parry: 'bs-parry' }

  // 剧情:章节保留解锁,头目可再战
  save.progress.room = 'c1-dock'
  save.progress.chapter = 'c1'
  save.progress.questStep = 0
  save.progress.questByChapter = {}
  save.progress.defeated = []
  save.progress.picked = []
  save.progress.trains = {}
  save.progress.unlocked = save.progress.unlocked.filter((id) => id !== 'rb')
  save.training = { skill: null, since: 0 }
  save.seclusion = { skill: null, since: 0, totalSec: 0, guard: false }
  save.idle = { chapter: null, since: 0 }
  save.rebirth = { stage: 0, disciple: null, trainedAt: 0 }

  ctx.log(
    `你为旧身选了一处青山归隐。${char.rebirths} 世传承已成:新身「${name}」自十四岁出师,获先天属性点 ${points} 点${overflowPotential > 0 ? `,溢出经验化为潜能 +${overflowPotential}` : ''}。`,
  )
  return null
}
