<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useItemListSeo } from '../composables/useSeo'

interface LabMeta {
  id: string
  title: string
  desc: string
  to: string
  gradient: string
  badge: string
}

const list: LabMeta[] = [
  {
    id: 'boids',
    title: '群鸟算法',
    desc: '经典 Boids 集群模拟:100~1000 只白色发光粒子鸟,从混乱个体逐渐合并为一个整体。移动鼠标引导鸟群,点击惊散它们。基于 PixiJS 渲染。',
    to: '/labs/boids',
    gradient: 'from-stone-700 via-stone-900 to-black',
    badge: '🐦',
  },
]

useItemListSeo(
  '实验室',
  computed(() => list.map((g) => ({ name: g.title, path: g.to }))),
)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold text-stone-900">实验室</h1>
      <span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        开发中
      </span>
    </div>
    <p class="mt-1 text-sm text-stone-500">
      这里展示正在开发中的实验性功能,验证成熟后会完全融入网站。欢迎抢先体验。
    </p>

    <div class="mt-6 grid gap-5 sm:grid-cols-2">
      <RouterLink
        v-for="g in list"
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
            class="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm"
          >
            实验中
          </span>
        </div>
        <div class="flex flex-1 flex-col p-5">
          <h2 class="font-semibold text-stone-900 group-hover:text-brand-600">{{ g.title }}</h2>
          <p class="mt-1.5 flex-1 text-sm leading-relaxed text-stone-500">{{ g.desc }}</p>
          <div class="mt-4 flex items-center justify-end">
            <span
              class="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition group-hover:bg-brand-500"
            >
              进入实验
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
