<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { CnCharState, LetterStatus } from '../composables/useChineseEngine'

interface Props {
  chars: CnCharState[]
  pos: number
  composing: boolean
  compositionText: string
  finished: boolean
}

const props = defineProps<Props>()

const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const focused = ref(false)

function focusInput(): void {
  inputEl.value?.focus()
}

async function syncInputPosition(): Promise<void> {
  await nextTick()
  const charEl = rootEl.value?.querySelector<HTMLElement>(`[data-idx="${props.pos}"]`)
  const input = inputEl.value
  if (charEl && input) {
    input.style.left = `${charEl.offsetLeft}px`
    input.style.top = `${charEl.offsetTop + charEl.offsetHeight}px`
  }
  charEl?.scrollIntoView({ block: 'nearest' })
}

watch(() => props.pos, syncInputPosition)

onMounted(() => {
  syncInputPosition()
  focusInput()
})

function clearInputValue(e: Event): void {
  // 非组合状态下及时清空,避免隐藏 input 中残留上屏文本
  const input = e.target as HTMLInputElement
  if (!input.value) return
  requestAnimationFrame(() => {
    input.value = ''
  })
}

function clearAfterComposition(): void {
  const input = inputEl.value
  if (!input) return
  requestAnimationFrame(() => {
    input.value = ''
  })
}

function charClass(i: number, status: CnCharState['status']): string {
  const base =
    'flex h-11 w-11 items-center justify-center rounded-lg border text-2xl transition-colors duration-75'
  const isCurrent = i === props.pos
  if (status === 'correct') return `${base} border-emerald-200 bg-emerald-50 text-emerald-600`
  if (status === 'wrong') return `${base} border-red-200 bg-red-50 text-red-500`
  if (isCurrent)
    return `${base} border-indigo-400 bg-indigo-50 text-slate-900 ring-2 ring-indigo-200`
  return `${base} border-slate-200 bg-white text-slate-700`
}

function letterClass(st: LetterStatus): string {
  if (st === 'match') return 'text-emerald-600 font-semibold'
  if (st === 'wrong') return 'text-red-500 font-semibold'
  return 'text-slate-400'
}
</script>

<template>
  <div>
    <div
      ref="rootEl"
      class="relative max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      @click="focusInput"
    >
      <div class="flex flex-wrap gap-x-2.5 gap-y-3">
        <div
          v-for="(c, i) in chars"
          :key="i"
          :data-idx="i"
          class="flex w-11 flex-col items-center gap-0.5"
        >
          <div class="flex h-4 items-end font-mono text-xs leading-none">
            <span v-for="(st, j) in c.letters" :key="j" :class="letterClass(st)">
              {{ c.pinyin[j] }}
            </span>
          </div>
          <div :class="charClass(i, c.status)">{{ c.char }}</div>
        </div>
      </div>

      <input
        ref="inputEl"
        class="absolute h-px w-px opacity-0"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="中文输入捕获框,请保持焦点并使用拼音输入法"
        @input="clearInputValue"
        @compositionend="clearAfterComposition"
        @focus="focused = true"
        @blur="focused = false"
      />

      <div
        v-if="!focused && !finished"
        class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]"
        @click="focusInput"
      >
        <span class="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow">
          点击此处,使用拼音输入法开始输入
        </span>
      </div>
    </div>

    <div class="mt-3 flex h-8 items-center gap-2 px-1 font-mono text-sm">
      <template v-if="composing || compositionText">
        <span class="text-slate-400">正在输入</span>
        <span class="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-600">
          {{ compositionText }}
        </span>
      </template>
      <span v-else class="text-xs text-slate-400">
        提示:使用系统拼音输入法,按汉字上方拼音输入;拼音完全匹配即判正确。
      </span>
    </div>
  </div>
</template>
