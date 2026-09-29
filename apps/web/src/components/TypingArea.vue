<script setup lang="ts">
import { nextTick, watch, ref } from 'vue'
import type { EngineChar } from '../composables/useTypingEngine'

interface Props {
  chars: EngineChar[]
  pos: number
}

const props = defineProps<Props>()
const container = ref<HTMLElement | null>(null)

watch(
  () => props.pos,
  async () => {
    await nextTick()
    const el = container.value?.querySelector<HTMLElement>(`[data-idx="${props.pos}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  },
)

function charClass(c: EngineChar, i: number): string {
  const base = 'rounded-sm px-px transition-colors duration-75'
  const isCurrent = i === props.pos
  const caret = isCurrent ? 'caret-blink border-l-2 border-indigo-500 -ml-0.5' : ''
  if (c.status === 'correct') return `${base} text-emerald-600 ${caret}`
  if (c.status === 'wrong') return `${base} bg-red-100 text-red-600 ${caret}`
  return `${base} text-slate-400 ${caret}`
}
</script>

<template>
  <div
    ref="container"
    class="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
  >
    <p class="whitespace-pre-wrap font-mono text-2xl leading-relaxed tracking-wide">
      <span v-for="(c, i) in chars" :key="i" :data-idx="i" :class="charClass(c, i)">{{
        c.expected
      }}</span>
    </p>
  </div>
</template>
