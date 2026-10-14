<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useGamesStore } from '../stores/games'
import { GAMES } from '../games/list'
import { useItemListSeo } from '../composables/useSeo'

const games = useGamesStore()

const records = computed(() => GAMES.map((g) => ({ ...g, best: games.bestOf(g.id) })))

useItemListSeo(
  '打字游戏',
  computed(() => GAMES.map((g) => ({ name: g.title, path: g.to }))),
)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <h1 class="text-2xl font-bold text-stone-900">打字游戏</h1>
    <p class="mt-1 text-sm text-stone-500">
      边玩边练指法。看准键位、快速敲击,挑战你的最高分。成绩仅保存在本机浏览器中。
    </p>

    <div class="mt-6 grid gap-5 sm:grid-cols-2">
      <RouterLink
        v-for="g in records"
        :key="g.id"
        :to="g.to"
        class="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
      >
        <div
          class="relative flex h-36 items-center justify-center bg-gradient-to-br"
          :class="g.gradient"
        >
          <span class="text-6xl drop-shadow-sm transition group-hover:scale-110">{{
            g.badge
          }}</span>
          <span
            v-if="g.best"
            class="absolute right-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
          >
            {{ g.stats?.scoreLabel ?? '最高分' }} {{ g.best.bestScore }}
          </span>
        </div>
        <div class="flex flex-1 flex-col p-5">
          <h2 class="font-semibold text-stone-900 group-hover:text-brand-600">{{ g.title }}</h2>
          <p class="mt-1.5 flex-1 text-sm leading-relaxed text-stone-500">{{ g.desc }}</p>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-xs text-stone-400">
              {{
                g.best
                  ? `已玩 ${g.best.plays} ${g.stats?.playsUnit ?? '局'}${g.stats?.hideCombo ? '' : ` · 最高连击 ${g.best.bestCombo}`}`
                  : '还没玩过'
              }}
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition group-hover:bg-brand-500"
            >
              开始游戏
              <svg
                viewBox="0 0 24 24"
                class="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
