import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PracticeResult } from '@type-happy/shared'
import { useStats } from './useStats'

export type CharStatus = 'pending' | 'correct' | 'wrong'
export type EngineStatus = 'idle' | 'running' | 'finished'

export interface EngineChar {
  expected: string
  typed: string | null
  status: CharStatus
}

export interface KeyFeedback {
  key: string
  correct: boolean
  id: number
}

function buildChars(text: string): EngineChar[] {
  return [...text].map((ch) => ({ expected: ch, typed: null, status: 'pending' as const }))
}

/**
 * 字符级打字引擎(指法/英文课程)。
 * 监听全局 keydown,首次按键启动计时,支持退格修正;
 * 最后一个字符输入正确时结算(此前错误保留计错);
 * 输入法组合(composition)期间挂起,避免干扰。
 */
export function useTypingEngine(
  text: string,
  opts: { lessonId: string; allowBackspace?: boolean },
) {
  const allowBackspace = opts.allowBackspace ?? true
  const chars = ref(buildChars(text))
  const pos = ref(0)
  const status = ref<EngineStatus>(chars.value.length === 0 ? 'finished' : 'idle')
  const result = ref<PracticeResult | null>(null)
  const feedback = ref<KeyFeedback | null>(null)
  const stats = useStats(opts.lessonId)
  let feedbackId = 0
  let composing = false

  const targetChar = computed(() => chars.value[pos.value]?.expected ?? null)
  const progress = computed(() => ({ done: pos.value, total: chars.value.length }))

  function countCorrect(): number {
    let n = 0
    for (const c of chars.value) if (c.status === 'correct') n += 1
    return n
  }

  function finish(): void {
    if (status.value === 'finished') return
    status.value = 'finished'
    result.value = stats.finish()
  }

  function restart(): void {
    chars.value = buildChars(text)
    pos.value = 0
    status.value = chars.value.length === 0 ? 'finished' : 'idle'
    result.value = null
    feedback.value = null
    stats.reset()
  }

  function typeChar(key: string): void {
    if (status.value === 'idle') {
      status.value = 'running'
      stats.markStart()
    }
    const target = chars.value[pos.value]
    if (!target) return
    const correct = key === target.expected
    target.typed = key
    target.status = correct ? 'correct' : 'wrong'
    stats.recordKey(correct)
    feedback.value = { key, correct, id: ++feedbackId }
    pos.value += 1
    stats.setCorrectChars(countCorrect())
    const last = chars.value[chars.value.length - 1]
    if (pos.value >= chars.value.length && last?.status === 'correct') finish()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (status.value === 'finished') return
    // 输入法组合期间挂起(keyCode 229 为 IME 处理的兜底信号)
    if (e.isComposing || composing || e.keyCode === 229) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (!allowBackspace || status.value !== 'running' || pos.value === 0) return
      pos.value -= 1
      const c = chars.value[pos.value]
      if (c) {
        c.status = 'pending'
        c.typed = null
      }
      stats.setCorrectChars(countCorrect())
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const target = chars.value[pos.value]
      if (target?.expected === '\n') typeChar('\n')
      return
    }
    if (e.key.length !== 1) return
    e.preventDefault()
    typeChar(e.key)
  }

  function handleCompositionStart(): void {
    composing = true
  }
  function handleCompositionEnd(): void {
    composing = false
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('compositionstart', handleCompositionStart)
    window.addEventListener('compositionend', handleCompositionEnd)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('compositionstart', handleCompositionStart)
    window.removeEventListener('compositionend', handleCompositionEnd)
  })

  return {
    chars,
    pos,
    status,
    result,
    feedback,
    targetChar,
    progress,
    restart,
    stats,
    _test: { handleKeydown, handleCompositionStart, handleCompositionEnd },
  }
}
