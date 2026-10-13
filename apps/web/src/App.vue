<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { SITE_NAME, SITE_ORIGIN, withSite } from './composables/useSeo'

const route = useRoute()

const title = computed(() =>
  route.name === 'home'
    ? `${SITE_NAME} - 免费在线打字练习与打字游戏`
    : withSite(route.meta.title ?? ''),
)
const description = computed(
  () =>
    route.meta.description ?? '免费在线打字练习网站:指法、英文、中文拼音课程与打字游戏,无需注册。',
)
const canonical = computed(() => SITE_ORIGIN + route.path)

const jsonLd = computed<object[]>(() => {
  const list: object[] = []
  if (route.name === 'home') {
    list.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: 'type-happy',
      url: `${SITE_ORIGIN}/`,
      description: description.value,
      inLanguage: 'zh-CN',
    })
  }
  if (route.meta.ld === 'VideoGame') {
    list.push({
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: route.meta.title ?? '',
      description: description.value,
      url: canonical.value,
      inLanguage: 'zh-CN',
      applicationCategory: 'Game',
      gamePlatform: 'Web Browser',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
    })
  }
  return list
})

useHead({
  title,
  meta: [
    { name: 'description', content: description },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'zh_CN' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonical },
    { property: 'og:image', content: `${SITE_ORIGIN}/og-cover.svg` },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  link: [{ rel: 'canonical', href: canonical }],
  script: computed(() =>
    jsonLd.value.map((ld) => ({ type: 'application/ld+json', textContent: JSON.stringify(ld) })),
  ),
})
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
