<script setup lang="ts">
import { computed } from 'vue'
import { formatAccuracy, formatDuration } from '../utils/format'

interface Props {
  wpm: number
  cpm: number
  accuracy: number
  elapsedMs: number
  done: number
  total: number
  /** 中文课程以 CPM 为主指标 */
  primary?: 'wpm' | 'cpm'
}

const props = withDefaults(defineProps<Props>(), { primary: 'wpm' })

const percent = computed(() =>
  props.total > 0 ? Math.min(100, Math.round((props.done / props.total) * 100)) : 0,
)

const primaryLabel = computed(() => (props.primary === 'cpm' ? '字/分' : 'WPM'))
const primaryValue = computed(() => (props.primary === 'cpm' ? props.cpm : props.wpm))
const secondaryLabel = computed(() => (props.primary === 'cpm' ? 'WPM' : '字/分'))
const secondaryValue = computed(() => (props.primary === 'cpm' ? props.wpm : props.cpm))
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-baseline gap-2">
        <span class="text-4xl font-bold tabular-nums text-indigo-600">{{ primaryValue }}</span>
        <span class="text-sm text-slate-400">{{ primaryLabel }}</span>
      </div>
      <div class="flex items-center gap-6 text-sm">
        <div class="text-center">
          <div class="text-lg font-semibold tabular-nums text-slate-700">{{ secondaryValue }}</div>
          <div class="text-xs text-slate-400">{{ secondaryLabel }}</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-semibold tabular-nums text-slate-700">
            {{ formatAccuracy(accuracy) }}
          </div>
          <div class="text-xs text-slate-400">准确率</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-semibold tabular-nums text-slate-700">
            {{ formatDuration(elapsedMs) }}
          </div>
          <div class="text-xs text-slate-400">用时</div>
        </div>
      </div>
    </div>
    <div class="mt-3 flex items-center gap-3">
      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full bg-indigo-500 transition-all duration-200"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <span class="text-xs tabular-nums text-slate-400">{{ done }}/{{ total }}</span>
    </div>
  </div>
</template>
