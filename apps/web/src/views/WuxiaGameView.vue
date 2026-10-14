<script setup lang="ts">
import { RouterLink } from 'vue-router'

const features = [
  { icon: '🏯', title: '五大门派', desc: '少林、武当、峨眉、华山、丐帮,武学风格与门派克制各不相同' },
  { icon: '📜', title: '真相之路', desc: '二十年前沈百万暴毙的惊天阴谋,五个阶段的主线剧情与多结局' },
  { icon: '⚒️', title: '生活技能', desc: '采药、锻造、炼丹、烹饪自给自足,兵器谱与随机词缀装备打造' },
  { icon: '🧘', title: '闭关护镖', desc: '打坐修炼内功突破境界,护镖闯荡江湖,离线也在自动成长' },
]
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
      <h1 class="text-2xl font-bold text-slate-900">🗡️ 武侠放置</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-500">
        古典武侠题材的文字放置游戏:你是一名被老拳师养大的孤儿,十八岁踏入明朝中叶的江湖,追查父亲死于「沈百万之死」的真相。加入门派、修炼武功绝学、锻造装备、护镖闯荡,挂机也在成长。进度自动保存在本机浏览器中,免费无需注册。
      </p>
    </div>

    <div class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <iframe
        src="/games/wuxia/game.html"
        title="武侠放置"
        class="block h-[calc(100vh-16rem)] min-h-[560px] w-full border-0"
      />
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <div
        v-for="f in features"
        :key="f.title"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span aria-hidden="true">{{ f.icon }}</span>
          {{ f.title }}
        </h2>
        <p class="mt-1 text-xs leading-relaxed text-slate-500">{{ f.desc }}</p>
      </div>
    </div>

    <p class="mt-4 text-center text-xs text-slate-400">
      游戏在独立框架中运行,与打字练习互不影响。源自开源项目
      <a
        href="https://github.com/wuuJiawei/WuXiaIdle"
        target="_blank"
        rel="noopener noreferrer"
        class="text-slate-500 underline decoration-dotted underline-offset-2 transition hover:text-indigo-600"
        >WuXiaIdle</a
      >(仅供学习与个人使用)。
    </p>
  </div>
</template>
