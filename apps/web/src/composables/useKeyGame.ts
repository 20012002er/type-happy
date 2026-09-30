import { onBeforeUnmount, onMounted, ref } from 'vue'

export type GameStatus = 'idle' | 'running' | 'paused' | 'over'

export interface GameTarget {
  id: number
  /** 命中该目标所需的按键(单字符,小写) */
  key: string
  /** 当前中心坐标(px,相对游戏区域左上角) */
  x: number
  y: number
  /** 未叠加摆动时的基准 x,用于水平漂移 */
  baseX: number
  /** 摆动初相 */
  phase: number
  /** 是否已被击中(进入爆破/掉落动画) */
  hit: boolean
  hitAt: number
  /** 颜色/形态变体索引 */
  variant: number
}

export interface GameEffect {
  id: number
  kind: 'pop' | 'miss' | 'wrong'
  x: number
  y: number
  key: string
}

export interface GameOverStats {
  score: number
  popped: number
  missed: number
  bestCombo: number
  wrong: number
  elapsed: number
}

/** 主键盘可打印键位:小写字母 + 数字 */
const DEFAULT_KEYS = [...'abcdefghijklmnopqrstuvwxyz0123456789']

export interface KeyGameOptions {
  keys?: string[]
  /** 生命数,漏掉一个目标 -1,归零则结束(默认 5) */
  maxLives?: number
  /** 击中后目标保留多久用于播放爆破动画(ms,默认 340) */
  hitAnimMs?: number
  /** 目标中心 y 小于等于该值视为逃出顶部(默认 0) */
  escapeTop?: number
  /** 生成时的水平安全边距(px,默认 44) */
  spawnMargin?: number
  /** 同屏最大活跃目标数(默认 7) */
  maxConcurrent?: number
  /** 颜色/形态变体数量(默认 1) */
  variants?: number
  /** 读取游戏区域尺寸 */
  getSize: () => { width: number; height: number }
  /** 目标生成的初始 y(默认贴底) */
  getSpawnY?: (height: number) => number
  /** 生成间隔 ms,可随已用时间变化 */
  spawnDelay: (elapsed: number) => number
  /** 上升速度 px/s,可随已用时间变化 */
  riseSpeed: (elapsed: number) => number
  /** 水平摆动幅度 px(默认 0,即直上直下) */
  swayAmp?: (elapsed: number) => number
  /** 摆动角频率 rad/s(默认 2) */
  swayFreq?: number
  /** 一局结束回调 */
  onGameOver?: (stats: GameOverStats) => void
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * 打字小游戏通用引擎:目标自底部升起,按对应键位击中得分,
 * 逃出顶部扣分并损失生命;生命归零结束。气球/鸭子等玩法共用此逻辑,
 * 仅在视图层定制外观与生成/运动参数。
 */
export function useKeyGame(opts: KeyGameOptions) {
  const keys = opts.keys ?? DEFAULT_KEYS
  const maxLives = opts.maxLives ?? 5
  const hitAnimMs = opts.hitAnimMs ?? 340
  const escapeTop = opts.escapeTop ?? 0
  const spawnMargin = opts.spawnMargin ?? 44
  const maxConcurrent = opts.maxConcurrent ?? 7
  const variants = opts.variants ?? 1
  const swayFreq = opts.swayFreq ?? 2
  const getSpawnY = opts.getSpawnY ?? ((h: number) => h + 30)

  const status = ref<GameStatus>('idle')
  const score = ref(0)
  const combo = ref(0)
  const bestCombo = ref(0)
  const popped = ref(0)
  const missed = ref(0)
  const wrong = ref(0)
  const lives = ref(maxLives)
  const elapsed = ref(0)

  const targets = ref<GameTarget[]>([])
  const effects = ref<GameEffect[]>([])
  /** 最近一次按键反馈(用于 HUD/音效提示) */
  const lastPress = ref<{ key: string; hit: boolean; id: number } | null>(null)
  /** 漏掉目标时触发的一次性抖动信号 */
  const missSignal = ref(0)

  let raf = 0
  let lastTs = 0
  let spawnTimer = 0
  let idSeq = 0
  let effectSeq = 0
  let pressSeq = 0
  const effectTimers = new Set<ReturnType<typeof setTimeout>>()

  function pickKey(): string {
    const active = new Set(targets.value.filter((t) => !t.hit).map((t) => t.key))
    // 尽量避免与在屏目标重复,减少歧义;若全部占用则随机
    for (let i = 0; i < 6; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)]
      if (!active.has(k)) return k
    }
    return keys[Math.floor(Math.random() * keys.length)]
  }

  function spawn(): void {
    const { width, height } = opts.getSize()
    if (width <= 0 || height <= 0) return
    const active = targets.value.filter((t) => !t.hit).length
    if (active >= maxConcurrent) return
    const span = Math.max(1, width - spawnMargin * 2)
    const x = spawnMargin + Math.random() * span
    targets.value.push({
      id: ++idSeq,
      key: pickKey(),
      x,
      baseX: x,
      y: getSpawnY(height),
      phase: Math.random() * Math.PI * 2,
      hit: false,
      hitAt: 0,
      variant: Math.floor(Math.random() * variants),
    })
  }

  function pushEffect(kind: GameEffect['kind'], x: number, y: number, key: string): void {
    const id = ++effectSeq
    effects.value.push({ id, kind, x, y, key })
    const timer = setTimeout(
      () => {
        effects.value = effects.value.filter((e) => e.id !== id)
        effectTimers.delete(timer)
      },
      kind === 'miss' ? 620 : 520,
    )
    effectTimers.add(timer)
  }

  function registerMiss(t: GameTarget): boolean {
    score.value = Math.max(0, score.value - 1)
    missed.value += 1
    combo.value = 0
    lives.value -= 1
    missSignal.value += 1
    pushEffect('miss', t.x, clamp(t.y, 12, opts.getSize().height - 12), t.key)
    if (lives.value <= 0) {
      gameOver()
      return true
    }
    return false
  }

  function gameOver(): void {
    if (status.value === 'over') return
    status.value = 'over'
    cancelAnimationFrame(raf)
    raf = 0
    opts.onGameOver?.({
      score: score.value,
      popped: popped.value,
      missed: missed.value,
      bestCombo: bestCombo.value,
      wrong: wrong.value,
      elapsed: elapsed.value,
    })
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

    spawnTimer -= dt * 1000
    if (spawnTimer <= 0) {
      spawn()
      spawnTimer = opts.spawnDelay(elapsed.value)
    }

    const { width } = opts.getSize()
    const speed = opts.riseSpeed(elapsed.value)
    const amp = opts.swayAmp ? opts.swayAmp(elapsed.value) : 0
    const now = ts
    const removals: number[] = []

    for (const t of targets.value) {
      if (t.hit) {
        if (now - t.hitAt >= hitAnimMs) removals.push(t.id)
        continue
      }
      t.y -= speed * dt
      if (amp > 0) {
        t.x = clamp(
          t.baseX + Math.sin(elapsed.value * swayFreq + t.phase) * amp,
          spawnMargin * 0.5,
          width - spawnMargin * 0.5,
        )
      } else {
        t.x = t.baseX
      }
      if (t.y <= escapeTop) {
        removals.push(t.id)
        const over = registerMiss(t)
        if (over) break
      }
    }
    if (removals.length) {
      const set = new Set(removals)
      targets.value = targets.value.filter((t) => !set.has(t.id))
    }
  }

  function pressKey(rawKey: string): void {
    const key = rawKey.toLowerCase()
    let best: GameTarget | null = null
    for (const t of targets.value) {
      if (t.hit || t.key !== key) continue
      if (!best || t.y < best.y) best = t
    }
    if (best) {
      best.hit = true
      best.hitAt = performance.now()
      score.value += 1
      popped.value += 1
      combo.value += 1
      bestCombo.value = Math.max(bestCombo.value, combo.value)
      lastPress.value = { key, hit: true, id: ++pressSeq }
      pushEffect('pop', best.x, best.y, key)
    } else {
      wrong.value += 1
      combo.value = 0
      lastPress.value = { key, hit: false, id: ++pressSeq }
    }
  }

  function reset(): void {
    score.value = 0
    combo.value = 0
    bestCombo.value = 0
    popped.value = 0
    missed.value = 0
    wrong.value = 0
    lives.value = maxLives
    elapsed.value = 0
    targets.value = []
    effects.value = []
    lastPress.value = null
    spawnTimer = 0
  }

  function start(): void {
    reset()
    status.value = 'running'
    spawnTimer = 350
    lastTs = performance.now()
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(frame)
  }

  function pause(): void {
    if (status.value !== 'running') return
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
    pressKey(e.key)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    cancelAnimationFrame(raf)
    for (const t of effectTimers) clearTimeout(t)
    effectTimers.clear()
  })

  return {
    // state
    status,
    score,
    combo,
    bestCombo,
    popped,
    missed,
    wrong,
    lives,
    elapsed,
    maxLives,
    targets,
    effects,
    lastPress,
    missSignal,
    // actions
    start,
    pause,
    resume,
    togglePause,
    restart: start,
  }
}
