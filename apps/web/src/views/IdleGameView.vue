<script setup lang="ts">
import { RouterLink } from 'vue-router'
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

    <div class="mt-3">
      <h1 class="text-2xl font-bold text-slate-900">⚔️ 放置刷装备</h1>
      <p class="mt-1 max-w-xl text-sm text-slate-500">
        全随机的放置类刷装备小游戏(MIT 开源,来自 vue-idle-game)。挂机打怪、刷词条、强化装备,进度自动保存在本机浏览器中。
      </p>
    </div>

    <div class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <iframe
        src="/games/idle/index.html"
        title="放置刷装备"
        class="block h-[calc(100vh-16rem)] min-h-[560px] w-full border-0"
      />
    </div>

    <p class="mt-3 text-center text-xs text-slate-400">
      游戏在独立框架中运行,与打字练习互不影响。
    </p>
  </div>
</template>
