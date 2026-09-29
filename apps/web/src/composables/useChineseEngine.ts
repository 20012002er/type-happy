import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PinyinChar, PracticeResult } from '@type-happy/shared'
import { useStats } from './useStats'

export type CnCharStatus = 'pending' | 'correct' | 'wrong'
export type LetterStatus = 'idle' | 'match' | 'wrong'
export type CnEngineStatus = 'idle' | 'running' | 'finished'

export interface CnCharState extends PinyinChar {
  status: CnCharStatus
  /** 与 pinyin(去声调小写)等长,组合输入时逐字母着色 */
  letters: LetterStatus[]
}

export interface CommitFeedback {
  key: string
  correct: boolean
  id: number
}

const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

export function normalizePinyin(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, '')
}

function buildChars(source: PinyinChar[]): CnCharState[] {
  return source.map((c) => {
    const pinyin = normalizePinyin(c.pinyin)
    return {
      char: c.char,
      pinyin,
      status: 'pending' as const,
      letters: pinyin.split('').map(() => 'idle' as const),
    }
  })
}

/**
 * 中文 IME 拼音比对引擎。
 * - 监听 window 上的 composition/input 事件(隐藏 input 只需保持焦点)。
 * - 组合中:将 event.data 的拼音与当前起连续汉字的 pinyin 逐字母比对并着色。
 * - 上屏后:按音节切片比对,匹配标正确,不匹配标错误并前进(不阻塞)。
 * - 兼容 Chrome(compositionend 后触发 input)与 Safari(input 先于 compositionend)
 *   两种事件顺序,通过 session 标记去重,避免同一次上屏判定两次。
 * - 输入法关闭时退化为手动拼音缓冲比对;空格作为音节分隔兜底。
 */
export function useChineseEngine(source: PinyinChar[], lessonId: string) {
  const chars = ref(buildChars(source))
  const pos = ref(0)
  const status = ref<CnEngineStatus>(chars.value.length === 0 ? 'finished' : 'idle')
  const result = ref<PracticeResult | null>(null)
  const feedback = ref<CommitFeedback | null>(null)
  const composing = ref(false)
  const compositionRaw = ref('')
  const manualBuffer = ref('')
  const stats = useStats(lessonId)

  let feedbackId = 0
  let sessionId = 0
  let committedSession = -1
  let pendingCompositionCommit = false
  let lastCompositionPinyin = ''

  const targetChar = computed(() => chars.value[pos.value]?.char ?? null)
  const targetKey = computed(() => chars.value[pos.value]?.pinyin[0] ?? null)
  const progress = computed(() => ({ done: pos.value, total: chars.value.length }))
  const compositionText = computed(() =>
    composing.value ? normalizePinyin(compositionRaw.value) : manualBuffer.value,
  )

  function countCorrect(): number {
    let n = 0
    for (const c of chars.value) if (c.status === 'correct') n += 1
    return n
  }

  function markStartIfNeeded(): void {
    if (status.value === 'idle') {
      status.value = 'running'
      stats.markStart()
    }
  }

  /** 组合拼音与后续汉字音节逐字母比对,实时着色(仅视觉,不判定) */
  function updateLiveLetters(): void {
    for (let i = pos.value; i < chars.value.length; i++) {
      const c = chars.value[i]
      if (c) c.letters = c.letters.map(() => 'idle')
    }
    const buf = compositionText.value
    if (!buf || status.value === 'finished') return
    let bi = 0
    for (let i = pos.value; i < chars.value.length && bi < buf.length; i++) {
      const c = chars.value[i]
      if (!c) break
      if (!HAN_RE.test(c.char)) continue
      const letters: LetterStatus[] = []
      let mismatch = false
      for (let j = 0; j < c.pinyin.length; j++) {
        const typed = buf[bi]
        if (typed === undefined) {
          letters.push('idle')
          continue
        }
        const ok = typed === c.pinyin[j]
        if (!ok) mismatch = true
        letters.push(ok ? 'match' : 'wrong')
        bi++
      }
      c.letters = letters
      if (mismatch) break
    }
  }

  function finish(): void {
    if (status.value === 'finished') return
    status.value = 'finished'
    result.value = stats.finish()
  }

  function applyJudgment(correct: boolean): void {
    const c = chars.value[pos.value]
    if (!c) return
    c.status = correct ? 'correct' : 'wrong'
    c.letters = c.letters.map(() => (correct ? ('match' as const) : ('wrong' as const)))
    pos.value += 1
    stats.recordKey(correct)
    feedback.value = { key: c.pinyin[0] ?? c.char, correct, id: ++feedbackId }
    stats.setCorrectChars(countCorrect())
    manualBuffer.value = ''
    updateLiveLetters()
    if (pos.value >= chars.value.length) finish()
  }

  /** 输入法关闭时的手动拼音缓冲:完整匹配判对,前缀继续等待,冲突判错前进 */
  function resolveManualBuffer(): void {
    const target = chars.value[pos.value]
    if (!target || !HAN_RE.test(target.char)) return
    const buf = manualBuffer.value
    if (!buf) return
    if (buf === target.pinyin) {
      applyJudgment(true)
      return
    }
    if (target.pinyin.startsWith(buf)) {
      updateLiveLetters()
      return
    }
    applyJudgment(false)
  }

  /** IME 上屏:按上屏文本逐字前进,汉字用组合拼音按音节切片判定 */
  function handleImeCommit(text: string, pinyinSource: string): void {
    if (status.value === 'finished' || !text) return
    markStartIfNeeded()
    let buf = normalizePinyin(pinyinSource)
    for (const ch of text) {
      if (pos.value >= chars.value.length) break
      const target = chars.value[pos.value]
      if (!target) break
      if (HAN_RE.test(target.char) && HAN_RE.test(ch)) {
        const take = target.pinyin.length
        const syllable = buf.slice(0, take)
        buf = buf.slice(take)
        applyJudgment(take > 0 && syllable === target.pinyin)
      } else if (HAN_RE.test(target.char) && /^[a-zA-Z]$/.test(ch)) {
        manualBuffer.value += ch.toLowerCase()
        resolveManualBuffer()
      } else {
        applyJudgment(ch === target.char)
      }
    }
  }

  /** 非组合的直接输入:标点/数字直接比对;英文字母进手动拼音缓冲 */
  function handleDirectInput(data: string): void {
    if (status.value === 'finished') return
    for (const ch of data) {
      if (pos.value >= chars.value.length) break
      if (/^[a-zA-Z]$/.test(ch)) {
        markStartIfNeeded()
        const target = chars.value[pos.value]
        if (target && HAN_RE.test(target.char)) {
          manualBuffer.value += ch.toLowerCase()
          resolveManualBuffer()
        } else if (target) {
          applyJudgment(ch === target.char)
        }
        continue
      }
      if (ch === ' ') {
        // 空格作为音节分隔兜底:缓冲恰好完整则判定,否则清空
        if (manualBuffer.value) {
          const target = chars.value[pos.value]
          if (target && HAN_RE.test(target.char) && manualBuffer.value === target.pinyin) {
            markStartIfNeeded()
            applyJudgment(true)
          } else {
            manualBuffer.value = ''
            updateLiveLetters()
          }
        }
        continue
      }
      markStartIfNeeded()
      const target = chars.value[pos.value]
      if (!target) break
      applyJudgment(ch === target.char)
    }
  }

  function handleCompositionStart(): void {
    composing.value = true
    sessionId += 1
    lastCompositionPinyin = ''
    compositionRaw.value = ''
  }

  function handleCompositionUpdate(e: CompositionEvent): void {
    compositionRaw.value = typeof e.data === 'string' ? e.data : ''
    lastCompositionPinyin = compositionRaw.value
    updateLiveLetters()
  }

  function handleCompositionEnd(e: CompositionEvent): void {
    composing.value = false
    compositionRaw.value = ''
    // Safari 场景:input(isComposing=false) 先于 compositionend,已完成判定
    if (committedSession === sessionId) return
    handleImeCommit(typeof e.data === 'string' ? e.data : '', lastCompositionPinyin)
    committedSession = sessionId
    // Chrome 场景:compositionend 后还会触发一次 input,需跳过避免重复判定
    pendingCompositionCommit = true
    setTimeout(() => {
      pendingCompositionCommit = false
    }, 0)
    updateLiveLetters()
  }

  function handleInput(ev: Event): void {
    const e = ev as InputEvent
    if (e.isComposing) return
    const data = typeof e.data === 'string' ? e.data : ''
    if (pendingCompositionCommit) {
      pendingCompositionCommit = false
      return
    }
    if (composing.value) {
      // Safari:上屏 input 先于 compositionend 到达
      if (!data) return
      handleImeCommit(data, lastCompositionPinyin)
      committedSession = sessionId
      return
    }
    if (!data) return
    handleDirectInput(data)
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.isComposing || composing.value || e.keyCode === 229) return
    if (status.value === 'finished') return
    if (e.key !== 'Backspace') return
    e.preventDefault()
    if (manualBuffer.value) {
      manualBuffer.value = manualBuffer.value.slice(0, -1)
      updateLiveLetters()
      return
    }
    if (status.value !== 'running' || pos.value === 0) return
    pos.value -= 1
    const c = chars.value[pos.value]
    if (c) {
      c.status = 'pending'
      c.letters = c.letters.map(() => 'idle')
    }
    stats.setCorrectChars(countCorrect())
  }

  function restart(): void {
    chars.value = buildChars(source)
    pos.value = 0
    status.value = chars.value.length === 0 ? 'finished' : 'idle'
    result.value = null
    feedback.value = null
    composing.value = false
    compositionRaw.value = ''
    manualBuffer.value = ''
    committedSession = -1
    pendingCompositionCommit = false
    lastCompositionPinyin = ''
    stats.reset()
  }

  onMounted(() => {
    window.addEventListener('compositionstart', handleCompositionStart)
    window.addEventListener('compositionupdate', handleCompositionUpdate)
    window.addEventListener('compositionend', handleCompositionEnd)
    window.addEventListener('input', handleInput)
    window.addEventListener('keydown', handleKeydown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('compositionstart', handleCompositionStart)
    window.removeEventListener('compositionupdate', handleCompositionUpdate)
    window.removeEventListener('compositionend', handleCompositionEnd)
    window.removeEventListener('input', handleInput)
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    chars,
    pos,
    status,
    result,
    feedback,
    composing,
    compositionText,
    manualBuffer,
    targetChar,
    targetKey,
    progress,
    restart,
    stats,
    // 仅用于自动化冒烟测试:在组件外模拟浏览器事件序列
    _test: {
      handleCompositionStart,
      handleCompositionUpdate,
      handleCompositionEnd,
      handleInput,
      handleKeydown,
    },
  }
}
