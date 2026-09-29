<script setup lang="ts">
import type { PracticeResult } from '@type-happy/shared'
import { formatAccuracy, formatDuration } from '../utils/format'

interface Props {
  result: PracticeResult
  prevBest: PracticeResult | null
  isNewBest: boolean
  primary?: 'wpm' | 'cpm'
  hasNext: boolean
}

const props = withDefaults(defineProps<Props>(), { primary: 'wpm' })

const emit = defineEmits<{
  restart: []
  next: []
  back: []
}>()

function deltaText(current: number, prev: number): string {
  const diff = current - prev
  if (diff === 0) return '持平'
  return diff > 0 ? `+${diff}` : `${diff}`
}
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <div class="text-center">
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          :class="isNewBest ? 'bg-amber-100' : 'bg-emerald-100'"
        >
          <svg
            v-if="isNewBest"
            viewBox="0 0 24 24"
            class="h-6 w-6 text-amber-500"
            fill="currentColor"
          >
            <path
              d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4 1.25 6.55L12 17.1l-6 3.15 1.25-6.55L2.5 9.3l6.6-1.04L12 2z"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" class="h-6 w-6 text-emerald-500" fill="currentColor">
            <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-slate-900">
          {{ isNewBest ? '新纪录!' : '练习完成' }}
        </h2>
      </div>

      <div class="mt-5 text-center">
        <div class="text-6xl font-bold tabular-nums text-indigo-600">
          {{ props.primary === 'cpm' ? result.cpm : result.wpm }}
        </div>
        <div class="mt-1 text-sm text-slate-400">
          {{ props.primary === 'cpm' ? '字/分钟' : 'WPM(词/分钟)' }}
        </div>
      </div>

      <div class="mt-5 grid grid-cols-3 gap-3 text-center">
        <div class="rounded-lg bg-slate-50 p-3">
          <div class="text-lg font-semibold tabular-nums text-slate-700">
            {{ props.primary === 'cpm' ? result.wpm : result.cpm }}
          </div>
          <div class="text-xs text-slate-400">{{ props.primary === 'cpm' ? 'WPM' : '字/分' }}</div>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
          <div class="text-lg font-semibold tabular-nums text-slate-700">
            {{ formatAccuracy(result.accuracy) }}
          </div>
          <div class="text-xs text-slate-400">准确率</div>
        </div>
        <div class="rounded-lg bg-slate-50 p-3">
          <div class="text-lg font-semibold tabular-nums text-slate-700">
            {{ formatDuration(result.durationMs) }}
          </div>
          <div class="text-xs text-slate-400">用时</div>
        </div>
      </div>

      <div v-if="prevBest" class="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>历史最佳</span>
          <span class="tabular-nums">
            {{ props.primary === 'cpm' ? prevBest.cpm : prevBest.wpm }}
            {{ props.primary === 'cpm' ? '字/分' : 'WPM' }} ·
            {{ formatAccuracy(prevBest.accuracy) }}
          </span>
        </div>
        <div class="mt-1.5 flex items-center justify-between text-xs">
          <span class="text-slate-500">本次对比</span>
          <span
            class="font-semibold tabular-nums"
            :class="
              (props.primary === 'cpm' ? result.cpm - prevBest.cpm : result.wpm - prevBest.wpm) >= 0
                ? 'text-emerald-600'
                : 'text-red-500'
            "
          >
            {{
              deltaText(
                props.primary === 'cpm' ? result.cpm : result.wpm,
                props.primary === 'cpm' ? prevBest.cpm : prevBest.wpm,
              )
            }}
          </span>
        </div>
      </div>

      <div class="mt-6 flex flex-col gap-2">
        <div class="flex gap-2">
          <button
            class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
            @click="emit('restart')"
          >
            再练一次
          </button>
          <button
            v-if="hasNext"
            class="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
            @click="emit('next')"
          >
            下一关
          </button>
        </div>
        <button
          class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          @click="emit('back')"
        >
          返回关卡列表
        </button>
      </div>
    </div>
  </div>
</template>
