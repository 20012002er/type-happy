<script setup lang="ts">
import type { GameStatus } from '../../composables/useKeyGame'

interface Props {
  score: number
  combo: number
  bestCombo: number
  lives: number
  maxLives: number
  popped: number
  missed: number
  status: GameStatus
}

defineProps<Props>()
const emit = defineEmits<{ pause: []; restart: [] }>()
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3"
  >
    <!-- 左上:操作 + 生命 + 连击 -->
    <div class="flex flex-col gap-2">
      <div class="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          class="rounded-lg border border-white/40 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-40"
          :disabled="status !== 'running' && status !== 'paused'"
          @click="emit('pause')"
        >
          {{ status === 'paused' ? '继续' : '暂停' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-white/40 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
          @click="emit('restart')"
        >
          重开
        </button>
      </div>

      <div class="flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 backdrop-blur-sm">
        <svg
          v-for="i in maxLives"
          :key="i"
          viewBox="0 0 24 24"
          class="h-4 w-4 transition"
          :class="i <= lives ? 'text-rose-500' : 'text-white/30'"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 21s-7.5-4.7-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12c-1.8 4.3-9.3 9-9.3 9Z"
          />
        </svg>
      </div>

      <div
        v-if="combo > 1"
        class="w-fit rounded-full bg-amber-400/90 px-2.5 py-0.5 text-xs font-bold text-amber-950 shadow"
      >
        连击 ×{{ combo }}
      </div>
    </div>

    <!-- 右上:分数 -->
    <div class="flex flex-col items-end gap-1">
      <div class="rounded-xl bg-black/30 px-4 py-2 text-right backdrop-blur-sm">
        <div class="text-[10px] font-medium uppercase tracking-wider text-white/70">分数</div>
        <div class="text-3xl font-black leading-none tabular-nums text-white drop-shadow">
          {{ score }}
        </div>
      </div>
      <div
        class="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm"
      >
        <span class="text-emerald-300">命中 {{ popped }}</span>
        <span class="text-white/40">|</span>
        <span class="text-rose-300">漏掉 {{ missed }}</span>
        <span v-if="bestCombo > 1" class="text-white/40">|</span>
        <span v-if="bestCombo > 1" class="text-amber-300">最高连击 {{ bestCombo }}</span>
      </div>
    </div>
  </div>
</template>
