import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/useGameStore'
import { PASSOUT_HOUR, MIDNIGHT_HOUR } from '@/data/timeConstants'
import { addLog } from './useGameLog'

// === 常量 ===
/** 星露谷速率：0.7 真实秒 = 1 游戏分钟 */
const REAL_MS_PER_GAME_MINUTE = 700
/** tick 间隔（ms），越小显示越平滑 */
const TICK_MS = 200

/**
 * 时钟阻塞原因。
 * 每个来源独立登记/注销，避免「A 暂停后 B 恢复」造成时间永久停滞或意外流逝。
 */
export type ClockBlocker = 'modal' | 'panel' | 'hidden' | 'endday' | 'bedtime'

// === 模块级单例状态 ===
const gameSpeed = ref(1)
/** 玩家在设置里手动暂停 */
const manualPaused = ref(false)
/** 当前生效的阻塞原因集合 */
const blockers = ref<Set<ClockBlocker>>(new Set())
/** 时钟是否已启动（interval 存在） */
let timerId: ReturnType<typeof setInterval> | null = null

/** 时钟是否处于暂停状态（手动暂停或存在任一阻塞） */
const isPaused = computed(() => manualPaused.value || blockers.value.size > 0)

/** 登记/注销一个阻塞原因 */
export const setClockBlocker = (reason: ClockBlocker, active: boolean) => {
  const had = blockers.value.has(reason)
  // 状态未变化则跳过，避免无谓重新赋值触发响应式传播
  if (active === had) return
  if (active) blockers.value.add(reason)
  else blockers.value.delete(reason)
  // Set 的增删不会触发 ref 的深层响应，重新赋值确保 computed 更新
  blockers.value = new Set(blockers.value)
}

/** 每个 tick 推进的游戏小时数 */
const getHoursPerTick = (): number => {
  const minutesPerTick = (TICK_MS / REAL_MS_PER_GAME_MINUTE) * gameSpeed.value
  return minutesPerTick / 60
}

/**
 * 时钟 tick。
 * 只负责推进时间；就寝提醒与昏倒结算由 GameLayout 监听 `gameStore.hour` 统一处理，
 * 这样实时流逝和玩家操作推进（advanceTime）走同一套提示逻辑。
 */
const tick = () => {
  if (isPaused.value) return

  const gameStore = useGameStore()
  const prevHour = gameStore.hour
  const newHour = prevHour + getHoursPerTick()

  // 到达昏倒时间：停在该时刻，交由 GameLayout 弹窗告知并结算
  if (newHour >= PASSOUT_HOUR) {
    gameStore.hour = PASSOUT_HOUR
    return
  }

  gameStore.hour = newHour

  // 跨午夜提示（仅一次，与 advanceTime 共享标志）
  if (!gameStore.midnightWarned && prevHour < MIDNIGHT_HOUR && newHour >= MIDNIGHT_HOUR) {
    gameStore.midnightWarned = true
    addLog('已经过了午夜，你开始感到困倦……')
  }
}

export const useGameClock = () => {
  /** 启动实时时钟 */
  const startClock = () => {
    if (timerId) return
    manualPaused.value = false
    blockers.value = new Set()
    timerId = setInterval(tick, TICK_MS)
  }

  /** 停止实时时钟（销毁 interval） */
  const stopClock = () => {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  }

  /** 暂停时钟（等价于登记 misc 阻塞，保留给旧调用点） */
  const pauseClock = (reason: ClockBlocker = 'modal') => {
    setClockBlocker(reason, true)
  }

  /** 恢复时钟（注销对应阻塞） */
  const resumeClock = (reason: ClockBlocker = 'modal') => {
    setClockBlocker(reason, false)
  }

  /** 设置速度倍率 */
  const setSpeed = (speed: number) => {
    gameSpeed.value = speed
  }

  /** 循环切换速度 1→2→3→1 */
  const cycleSpeed = () => {
    gameSpeed.value = gameSpeed.value >= 3 ? 1 : gameSpeed.value + 1
  }

  /** 切换手动暂停/恢复 */
  const togglePause = () => {
    manualPaused.value = !manualPaused.value
  }

  return {
    gameSpeed,
    isPaused,
    manualPaused,
    blockers,
    startClock,
    stopClock,
    pauseClock,
    resumeClock,
    setClockBlocker,
    setSpeed,
    cycleSpeed,
    togglePause
  }
}

// === 页面可见性处理（切标签页时暂停时钟，防止后台累积时间跳跃） ===
document.addEventListener('visibilitychange', () => {
  setClockBlocker('hidden', document.hidden)
})
