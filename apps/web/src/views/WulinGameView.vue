<script setup lang="ts">
import { RouterLink } from 'vue-router'
import WulinGame from '../components/games/WulinGame.vue'
</script>

<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-6">
    <RouterLink
      to="/games"
      class="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-brand-600"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      打字游戏
    </RouterLink>

    <div class="mt-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold text-stone-900">🏯 放置武林</h1>
        <p class="mt-1 max-w-xl text-sm text-stone-500">
          水墨武侠放置 RPG(玩法致敬《放置江湖》,内容原创):闯十章节、拜七门派、修五十余式武学、挂机历练、三世传承。进度自动保存在本机浏览器中。
        </p>
      </div>
    </div>

    <div class="mt-4">
      <WulinGame />
    </div>

    <p class="mt-3 text-center text-xs text-stone-400">
      战斗全自动,点击地图中的出口、人物与事务即可闯荡江湖。数值双档节奏可在「人物 → 设置」中切换。
    </p>
  </div>
</template>
