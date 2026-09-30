<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50 text-slate-800">
    <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <RouterLink to="/" class="flex items-center gap-2 text-lg font-bold text-slate-900">
          <svg
            viewBox="0 0 24 24"
            class="h-6 w-6 text-indigo-600"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M3 5h18a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Zm2 3v2h2V8H5Zm3.5 0v2h2V8h-2Zm3.5 0v2h2V8h-2Zm3.5 0v2h2V8h-2ZM5 11.5v2h2v-2H5Zm3.5 0v2h2v-2h-2Zm3.5 0v2h2v-2h-2Zm3.5 0v2h2v-2h-2ZM7 15v2h10v-2H7Z"
            />
          </svg>
          打字乐园
        </RouterLink>
        <nav class="flex items-center gap-1 text-sm font-medium">
          <RouterLink
            to="/"
            class="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="!text-indigo-600"
            :exact-active-class="'!text-indigo-600'"
          >
            首页
          </RouterLink>
          <RouterLink
            to="/courses"
            class="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="!text-indigo-600"
          >
            全部课程
          </RouterLink>
          <RouterLink
            to="/games"
            class="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="!text-indigo-600"
          >
            打字游戏
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <RouterView />
    </main>

    <footer class="border-t border-slate-200 bg-white py-6">
      <div class="mx-auto max-w-5xl px-4 text-center text-xs text-slate-400">
        打字乐园 · 每天十分钟,练出好指法。练习成绩仅保存在本机浏览器中。
      </div>
    </footer>
  </div>
</template>
