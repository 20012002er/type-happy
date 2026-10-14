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
  <div class="flex min-h-screen flex-col bg-stone-50 text-stone-800">
    <header class="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <RouterLink to="/" class="flex items-center gap-2 text-lg font-bold text-stone-900">
          <svg
            viewBox="0 0 24 24"
            class="h-6 w-6 text-brand-600"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M3 5h18a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Zm2 3v2h2V8H5Zm3.5 0v2h2V8h-2Zm3.5 0v2h2V8h-2Zm3.5 0v2h2V8h-2ZM5 11.5v2h2v-2H5Zm3.5 0v2h2v-2h-2Zm3.5 0v2h2v-2h-2Zm3.5 0v2h2v-2h-2ZM7 15v2h10v-2H7Z"
            />
          </svg>
          打字乐园
        </RouterLink>
        <nav class="flex items-center gap-0.5 text-sm font-medium sm:gap-1">
          <RouterLink
            to="/"
            class="rounded-md px-2 py-1.5 text-[13px] text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:px-3 sm:text-sm"
            active-class="!text-brand-600"
            :exact-active-class="'!text-brand-600'"
          >
            首页
          </RouterLink>
          <RouterLink
            to="/courses"
            class="rounded-md px-2 py-1.5 text-[13px] text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:px-3 sm:text-sm"
            active-class="!text-brand-600"
          >
            全部课程
          </RouterLink>
          <RouterLink
            to="/games"
            class="rounded-md px-2 py-1.5 text-[13px] text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:px-3 sm:text-sm"
            active-class="!text-brand-600"
          >
            打字游戏
          </RouterLink>
          <RouterLink
            to="/labs"
            class="rounded-md px-2 py-1.5 text-[13px] text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:px-3 sm:text-sm"
            active-class="!text-brand-600"
          >
            实验室
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <RouterView />
    </main>

    <footer class="border-t border-stone-200 bg-white py-7">
      <div class="mx-auto max-w-5xl space-y-2.5 px-4 text-center text-xs text-stone-400">
        <p>打字乐园 · 每天十分钟,练出好指法。练习成绩仅保存在本机浏览器中。</p>
        <p>
          <a
            href="https://github.com/20012002er/type-happy"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 font-medium text-stone-500 transition hover:text-brand-600"
          >
            <svg viewBox="0 0 16 16" class="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path
                d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
              />
            </svg>
            本站完全开源 · github.com/20012002er/type-happy
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
