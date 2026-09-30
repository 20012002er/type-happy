<script setup lang="ts">
import type { GameStatus } from '../../composables/useKeyGame'
import type { GameBest } from '../../stores/games'
import { formatDuration } from '../../utils/format'

interface Props {
  status: GameStatus
  title: string
  accent?: string
  howTo: string[]
  score: number
  popped: number
  missed: number
  bestCombo: number
  elapsed: number
  best: GameBest | null
  isNewBest?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  accent: 'indigo',
  isNewBest: false,
})
const emit = defineEmits<{ start: []; resume: []; restart: [] }>()

const total = () => props.popped + props.missed
const accuracy = () => (total() === 0 ? 0 : Math.round((props.popped / total()) * 100))
</script>

<template>
  <div
    v-if="status !== 'running'"
    class="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-sm rounded-2xl border border-white/60 bg-white/95 p-6 text-center shadow-2xl"
    >
      <!-- 开始 -->
      <template v-if="status === 'idle'">
        <h2 class="text-xl font-bold text-slate-900">{{ title }}</h2>
        <p class="mt-1 text-xs text-slate-400">按对应键位,别让它们逃掉!</p>
        <ul class="mx-auto mt-4 space-y-1.5 text-left text-sm text-slate-600">
          <li v-for="(line, i) in howTo" :key="i" class="flex gap-2">
            <span class="mt-0.5 text-slate-300">•</span>
            <span>{{ line }}</span>
          </li>
        </ul>
        <button
          type="button"
          class="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 active:scale-[0.99]"
          @click="emit('start')"
        >
          开始游戏
        </button>
        <p class="mt-2 text-[11px] text-slate-400">或按 空格 / 回车 开始</p>
      </template>

      <!-- 暂停 -->
      <template v-else-if="status === 'paused'">
        <h2 class="text-xl font-bold text-slate-900">已暂停</h2>
        <p class="mt-1 text-sm text-slate-500">当前分数 {{ score }}</p>
        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-500"
            @click="emit('resume')"
          >
            继续
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            @click="emit('restart')"
          >
            重开
          </button>
        </div>
        <p class="mt-2 text-[11px] text-slate-400">按 Esc 继续 / 空格 继续</p>
      </template>

      <!-- 结束 -->
      <template v-else>
        <div
          v-if="isNewBest"
          class="mx-auto mb-2 w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
        >
          🎉 新纪录!
        </div>
        <h2 class="text-xl font-bold text-slate-900">游戏结束</h2>
        <div class="mt-4 rounded-xl bg-slate-50 p-4">
          <div class="text-xs text-slate-400">本局得分</div>
          <div class="text-4xl font-black tabular-nums text-indigo-600">{{ score }}</div>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-slate-50 py-2">
            <div class="text-lg font-bold tabular-nums text-emerald-600">{{ popped }}</div>
            <div class="text-[11px] text-slate-400">命中</div>
          </div>
          <div class="rounded-lg bg-slate-50 py-2">
            <div class="text-lg font-bold tabular-nums text-amber-600">{{ bestCombo }}</div>
            <div class="text-[11px] text-slate-400">最高连击</div>
          </div>
          <div class="rounded-lg bg-slate-50 py-2">
            <div class="text-lg font-bold tabular-nums text-slate-600">{{ accuracy() }}%</div>
            <div class="text-[11px] text-slate-400">命中率</div>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
          <span>用时 {{ formatDuration(elapsed * 1000) }}</span>
          <span class="text-slate-300">|</span>
          <span>漏掉 {{ missed }}</span>
          <span v-if="best" class="text-slate-300">|</span>
          <span v-if="best">历史最佳 {{ best.bestScore }}</span>
        </div>
        <button
          type="button"
          class="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 active:scale-[0.99]"
          @click="emit('restart')"
        >
          再玩一次
        </button>
        <p class="mt-2 text-[11px] text-slate-400">或按 空格 / 回车 重新开始</p>
      </template>
    </div>
  </div>
</template>
