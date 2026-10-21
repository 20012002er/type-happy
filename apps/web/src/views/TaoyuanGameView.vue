<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <RouterLink
      to="/games"
      class="inline-flex items-center gap-1 text-sm text-stone-500 transition hover:text-brand-600"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      打字游戏
    </RouterLink>

    <div class="mt-3">
      <h1 class="text-2xl font-bold text-stone-900">🌸 桃源乡</h1>
      <p class="mt-1 max-w-2xl text-sm text-stone-500">
        像素中国风田园模拟经营:春耕夏种秋收冬藏,38种作物、19种动物、120层矿洞、34位村民、钓鱼育种烹饪加工,四季轮回中经营你的世外桃源。进度保存在本地浏览器中。
      </p>
    </div>

    <div class="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <iframe
        src="/games/taoyuan/index.html"
        title="桃源乡"
        class="block h-[calc(100vh-14rem)] min-h-[640px] w-full border-0"
        allow="autoplay"
      />
    </div>

    <p class="mt-3 text-center text-xs text-stone-400">
      游戏在独立框架中运行,与打字练习互不影响。首次加载可能需要几秒钟。
    </p>
  </div>
</template>
