import { onBeforeUnmount, onMounted, ref } from 'vue'
import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from '../components/games/fighterWords'

export type Move = 'hadouken' | 'tatsumaki' | 'shoryuken'
/** 角色精灵姿势:idle/三招式/受击/倒地 */
export type FighterPose = 'idle' | Move | 'hurt' | 'ko'
export type FighterID = 'ryu' | 'ken'
export type FightPhase = 'intro' | 'word' | 'attack' | 'ko'
export type FightStatus = 'idle' | 'running' | 'paused' | 'over'

export interface AttackEvent {
  id: number
  /** 出招方 */
  by: FighterID
  move: Move
  /** 本次伤害(含连击加成) */
  dmg: number
  /** 关联单词 */
  word: string
  /** true=玩家打对出招,false=打错/超时被反击 */
  success: boolean
}

export interface HurtEvent {
  id: number
  who: FighterID
  dmg: number
}

export interface BannerEvent {
  id: number
  text: string
}

export interface FightResult {
  /** 总输出伤害 */
  score: number
  /** 总承受伤害 */
  taken: number
  cleared: number
  failed: number
  bestCombo: number
  elapsed: number
  winner: FighterID | null
}

export const MAX_HP = 100

/** 招式对照表(名称用于画面提示) */
export const MOVE_LABEL: Record<Move, { zh: string; en: string }> = {
  hadouken: { zh: '波动拳', en: 'HADOUKEN' },
  tatsumaki: { zh: '龙卷旋风脚', en: 'TATSUMAKI SENPUKYAKU' },
  shoryuken: { zh: '升龙拳', en: 'SHORYUKEN' },
}

/** 难度档 → 玩家招式 */
export const PLAYER_MOVES: Move[] = ['hadouken', 'tatsumaki', 'shoryuken']
/** 招式基础伤害:单词越长越难,伤害越高 */
export const PLAYER_DMG: Record<Move, number> = { hadouken: 8, tatsumaki: 12, shoryuken: 16 }
/** 肯反击伤害(按单词难度档) */
const KEN_DMG = [7, 9, 11]
/** 连击加成上限 */
const COMBO_BONUS_CAP = 4

export interface FightGameOptions {
  onGameOver?: (result: FightResult) => void
}

/**
 * 打字街霸引擎:随机出现英文单词,限时正确输入则隆出招击中肯;
 * 打错或超时则被肯反击。任一方血量归零即 K.O. 结束。
 * 单词难度决定招式与伤害,连续成功有连击加成。
 */
export function useFightGame(opts: FightGameOptions = {}) {
  const status = ref<FightStatus>('idle')
  const phase = ref<FightPhase>('intro')
  const hpRyu = ref(MAX_HP)
  const hpKen = ref(MAX_HP)
  const word = ref('')
  /** 当前单词难度档:0=easy 1=medium 2=hard */
  const tier = ref(0)
  const typed = ref(0)
  const timeLeft = ref(0)
  const timeLimit = ref(1)
  const combo = ref(0)
  const bestCombo = ref(0)
  const score = ref(0)
  const taken = ref(0)
  const cleared = ref(0)
  const failed = ref(0)
  const elapsed = ref(0)
  const attack = ref<AttackEvent | null>(null)
  const hurt = ref<HurtEvent | null>(null)
  const banner = ref<BannerEvent | null>(null)
  /** 打错时的一次性信号(值递增),wrongChar 为按错的键 */
  const wrongSignal = ref(0)
  const wrongChar = ref('')
  const koWinner = ref<FighterID | null>(null)

  let raf = 0
  let lastTs = 0
  let seq = 0
  let lastWord = ''
  const timers = new Set<ReturnType<typeof setTimeout>>()

  function addTimer(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      timers.delete(t)
      fn()
    }, ms)
    timers.add(t)
  }

  function clearTimers(): void {
    for (const t of timers) clearTimeout(t)
    timers.clear()
  }

  function showBanner(text: string): void {
    banner.value = { id: ++seq, text }
  }

  function pickWord(): { w: string; t: number } {
    // 随战斗进行提高难词比例
    const hardW = Math.min(0.34, 0.16 + elapsed.value * 0.0025)
    const medW = 0.36
    const r = Math.random()
    const t = r < hardW ? 2 : r < hardW + medW ? 1 : 0
    const bank = t === 0 ? EASY_WORDS : t === 1 ? MEDIUM_WORDS : HARD_WORDS
    let w = bank[Math.floor(Math.random() * bank.length)]
    if (w === lastWord) w = bank[(bank.indexOf(w) + 1) % bank.length]
    lastWord = w
    return { w, t }
  }

  function nextWord(): void {
    const { w, t } = pickWord()
    word.value = w
    tier.value = t
    typed.value = 0
    timeLimit.value = 1.5 + 0.55 * w.length
    timeLeft.value = timeLimit.value
    attack.value = null
    hurt.value = null
    phase.value = 'word'
  }

  function koSequence(winner: FighterID): void {
    if (phase.value === 'ko') return
    phase.value = 'ko'
    koWinner.value = winner
    showBanner('K.O.')
    addTimer(2600, gameOver)
  }

  function gameOver(): void {
    if (status.value === 'over') return
    status.value = 'over'
    cancelAnimationFrame(raf)
    raf = 0
    opts.onGameOver?.({
      score: score.value,
      taken: taken.value,
      cleared: cleared.value,
      failed: failed.value,
      bestCombo: bestCombo.value,
      elapsed: elapsed.value,
      winner: koWinner.value,
    })
  }

  function launchAttack(by: FighterID, move: Move, dmg: number, success: boolean): void {
    phase.value = 'attack'
    attack.value = { id: ++seq, by, move, dmg, word: word.value, success }
    // 出招到命中的间隔(与动画前摇/气功弹飞行时间对齐)
    const hitDelay = move === 'hadouken' ? 470 : move === 'shoryuken' ? 420 : 540
    addTimer(hitDelay, () => {
      if (by === 'ryu') {
        hpKen.value = Math.max(0, hpKen.value - dmg)
        score.value += dmg
      } else {
        hpRyu.value = Math.max(0, hpRyu.value - dmg)
        taken.value += dmg
      }
      hurt.value = { id: ++seq, who: by === 'ryu' ? 'ken' : 'ryu', dmg }
      const winner: FighterID | null = hpKen.value <= 0 ? 'ryu' : hpRyu.value <= 0 ? 'ken' : null
      if (winner) addTimer(550, () => koSequence(winner))
      else addTimer(780, () => nextWord())
    })
  }

  function succeed(): void {
    combo.value += 1
    bestCombo.value = Math.max(bestCombo.value, combo.value)
    cleared.value += 1
    const move = PLAYER_MOVES[tier.value]
    const dmg = PLAYER_DMG[move] + Math.min(combo.value - 1, COMBO_BONUS_CAP)
    launchAttack('ryu', move, dmg, true)
  }

  function failWord(): void {
    combo.value = 0
    failed.value += 1
    const move = PLAYER_MOVES[Math.floor(Math.random() * PLAYER_MOVES.length)]
    launchAttack('ken', move, KEN_DMG[tier.value], false)
  }

  function press(raw: string): void {
    if (status.value !== 'running' || phase.value !== 'word') return
    const key = raw.toLowerCase()
    const expect = word.value[typed.value]?.toLowerCase()
    if (key === expect) {
      typed.value += 1
      if (typed.value >= word.value.length) succeed()
    } else {
      wrongChar.value = raw
      wrongSignal.value = ++seq
      failWord()
    }
  }

  function frame(ts: number): void {
    raf = requestAnimationFrame(frame)
    if (status.value !== 'running') {
      lastTs = ts
      return
    }
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000))
    lastTs = ts
    elapsed.value += dt
    if (phase.value === 'word') {
      timeLeft.value -= dt
      if (timeLeft.value <= 0) {
        timeLeft.value = 0
        wrongChar.value = ''
        failWord()
      }
    }
  }

  function reset(): void {
    // K.O. 动画窗口期内重开:先冲刷已定胜负的一局,避免丢失成绩记录
    if (phase.value === 'ko' && status.value !== 'over') gameOver()
    clearTimers()
    cancelAnimationFrame(raf)
    raf = 0
    hpRyu.value = MAX_HP
    hpKen.value = MAX_HP
    combo.value = 0
    bestCombo.value = 0
    score.value = 0
    taken.value = 0
    cleared.value = 0
    failed.value = 0
    elapsed.value = 0
    attack.value = null
    hurt.value = null
    banner.value = null
    koWinner.value = null
    word.value = ''
    tier.value = 0
    typed.value = 0
    timeLeft.value = 0
    timeLimit.value = 1
    wrongChar.value = ''
    lastWord = ''
  }

  function start(): void {
    reset()
    status.value = 'running'
    phase.value = 'intro'
    showBanner('ROUND 1')
    addTimer(900, () => showBanner('FIGHT!'))
    addTimer(1650, nextWord)
    lastTs = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function pause(): void {
    // 仅在单词输入阶段可暂停,避免打断出招动画序列
    if (status.value !== 'running' || phase.value !== 'word') return
    status.value = 'paused'
    cancelAnimationFrame(raf)
    raf = 0
  }

  function resume(): void {
    if (status.value !== 'paused') return
    status.value = 'running'
    lastTs = performance.now()
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(frame)
  }

  function togglePause(): void {
    if (status.value === 'running') pause()
    else if (status.value === 'paused') resume()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // 输入法组合期间挂起(229 为 IME 兜底信号)
    if (e.isComposing || e.keyCode === 229) return

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (status.value === 'idle' || status.value === 'over') start()
      else if (status.value === 'paused') resume()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      togglePause()
      return
    }
    if (status.value !== 'running') return
    if (e.key.length !== 1) return
    e.preventDefault()
    press(e.key)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    cancelAnimationFrame(raf)
    clearTimers()
  })

  return {
    MAX_HP,
    status,
    phase,
    hpRyu,
    hpKen,
    word,
    tier,
    typed,
    timeLeft,
    timeLimit,
    combo,
    bestCombo,
    score,
    taken,
    cleared,
    failed,
    elapsed,
    attack,
    hurt,
    banner,
    wrongChar,
    wrongSignal,
    koWinner,
    start,
    pause,
    resume,
    togglePause,
    restart: start,
  }
}
