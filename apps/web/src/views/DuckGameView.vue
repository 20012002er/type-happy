<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import DuckGame from '../components/games/DuckGame.vue'
import { useGamesStore } from '../stores/games'

const games = useGamesStore()
const best = computed(() => games.bestOf('duck'))
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <RouterLink
      to="/games"
      class="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-indigo-600"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      打字游戏
    </RouterLink>

    <div class="mt-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">🦆 打字打鸭子</h1>
        <p class="mt-1 max-w-xl text-sm text-slate-500">
          鸭子从草丛中飞出,按下鸭子身上的键位,让猎人开枪击落它。飞出屏幕会扣分并损失一颗心。
        </p>
      </div>
      <div
        v-if="best"
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm"
      >
        历史最佳
        <span class="ml-1 font-semibold tabular-nums text-indigo-600">{{ best.bestScore }}</span>
        <span class="mx-1 text-slate-300">|</span>
        最高连击
        <span class="ml-1 font-semibold tabular-nums">{{ best.bestCombo }}</span>
      </div>
    </div>

    <div class="mt-5">
      <DuckGame />
    </div>

    <p class="mt-3 text-center text-xs text-slate-400">
      点击页面后直接按键开始;空格/回车 开始或重开,Esc 暂停。支持字母与数字键位。
    </p>
  </div>
</template>
