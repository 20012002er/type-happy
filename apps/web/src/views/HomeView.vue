<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Course } from '@type-happy/shared'
import { fetchCourses } from '../api/client'
import { GAMES } from '../games/list'
import { useGamesStore } from '../stores/games'

const courses = ref<Course[]>([])
const games = useGamesStore()

onMounted(async () => {
  try {
    courses.value = await fetchCourses()
  } catch {
    courses.value = []
  }
})

const features = [
  {
    no: '01',
    title: '指法图解',
    desc: 'SVG 虚拟键盘按手指分色,实时高亮目标键与 Shift 提示,错键红闪,养成规范盲打习惯。',
  },
  {
    no: '02',
    title: '拼音智能判分',
    desc: '中文练习监听输入法组合状态,拼音逐音节比对,同音字不误判,错字不阻塞,流畅练习。',
  },
  {
    no: '03',
    title: '成绩本地追踪',
    desc: 'WPM/字每分、准确率、用时自动结算,历史最佳与最近 20 次记录保存在浏览器本地。',
  },
]

/* hero 插画:一段正在输入的英文(示意练习界面,状态色与真实 TypingArea 一致) */
const heroTyped = 'practice ma'
const heroCurrent = 'k'
const heroRest = 'es perfect'
const heroRowTop = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']
const heroRowHome = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l']

const gameCards = computed(() => GAMES.map((g) => ({ ...g, best: games.bestOf(g.id) })))
</script>

<template>
  <div>
    <!-- Hero:左文案 + 右「打字练习」产品插画 -->
    <section class="relative overflow-hidden">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <div class="absolute -top-36 -right-24 h-96 w-96 rounded-full bg-brand-200/35 blur-3xl" />
        <div class="absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-amber-200/35 blur-3xl" />
      </div>
      <div
        class="relative mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24"
      >
        <div>
          <div
            class="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-stone-600 shadow-sm ring-1 ring-stone-200/80 backdrop-blur"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-brand-500" />
            免费开源 · 无需注册 · 成绩保存在本地
          </div>
          <h1
            class="mt-6 text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl lg:leading-[1.15]"
          >
            每天十分钟,
            <br />
            <span
              class="bg-[linear-gradient(to_top,rgba(252,211,77,0.55)_0%,rgba(252,211,77,0.55)_26%,transparent_26%)] pb-1 text-brand-700"
            >
              练出好指法
            </span>
          </h1>
          <p class="mt-5 max-w-md text-base leading-relaxed text-stone-500">
            指法、英文文章、中文拼音三大课程循序渐进,再配上六款打字小游戏。虚拟键盘实时引导指法,打开浏览器就能练。
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <RouterLink
              to="/courses"
              class="rounded-xl bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-500"
            >
              开始练习
            </RouterLink>
            <RouterLink
              to="/games"
              class="rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 transition hover:-translate-y-0.5 hover:bg-stone-50 hover:ring-stone-400"
            >
              玩玩打字游戏
            </RouterLink>
          </div>
        </div>

        <!-- 打字练习插画卡 -->
        <div class="mx-auto w-full max-w-md lg:max-w-none">
          <div
            class="rounded-3xl bg-white p-5 shadow-2xl shadow-stone-900/10 ring-1 ring-stone-900/5 sm:p-7"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-medium text-stone-400">
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4 text-brand-500"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M3 5h18a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Zm2 3v2h2V8H5Zm3.5 0v2h2V8h-2Zm3.5 0v2h2V8h-2Zm3.5 0v2h2V8h-2ZM5 11.5v2h2v-2H5Zm3.5 0v2h2v-2h-2Zm3.5 0v2h2v-2h-2Zm3.5 0v2h2v-2h-2ZM7 15v2h10v-2H7Z"
                  />
                </svg>
                英文文章 · 第 12 关
              </div>
              <div class="flex items-baseline gap-1.5 font-mono tabular-nums">
                <span class="text-xl font-bold text-brand-600">68</span>
                <span class="text-xs text-stone-400">WPM · 准确率 98%</span>
              </div>
            </div>

            <div class="mt-6 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70 sm:p-5">
              <p class="font-mono text-xl leading-relaxed tracking-wide sm:text-2xl">
                <span class="text-emerald-600">{{ heroTyped }}</span>
                <span class="caret-blink -ml-0.5 border-l-2 border-brand-500 text-stone-900">{{
                  heroCurrent
                }}</span>
                <span class="text-stone-300">{{ heroRest }}</span>
              </p>
            </div>

            <div class="mt-5 flex flex-col items-center gap-1.5">
              <div class="flex gap-1.5">
                <kbd
                  v-for="k in heroRowTop"
                  :key="k"
                  class="flex h-8 w-7 items-center justify-center rounded-lg bg-stone-100 font-mono text-[10px] font-medium text-stone-500 ring-1 ring-stone-200 sm:h-9 sm:w-9 sm:text-xs"
                >
                  {{ k.toUpperCase() }}
                </kbd>
              </div>
              <div class="flex gap-1.5">
                <kbd
                  v-for="k in heroRowHome"
                  :key="k"
                  class="relative flex h-8 w-7 items-center justify-center rounded-lg font-mono text-[10px] font-medium ring-1 transition sm:h-9 sm:w-9 sm:text-xs"
                  :class="
                    k === heroCurrent
                      ? 'scale-110 bg-brand-600 text-white shadow-lg shadow-brand-600/40 ring-brand-600'
                      : 'bg-stone-100 text-stone-500 ring-stone-200'
                  "
                >
                  {{ k.toUpperCase() }}
                  <span
                    v-if="k === 'f' || k === 'j'"
                    class="absolute bottom-1.5 h-0.5 w-2.5 rounded-full bg-stone-300"
                  />
                </kbd>
              </div>
            </div>

            <div class="mt-5 flex justify-center">
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200/80"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-amber-400" />
                下一个键 K · 右手中指
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 特性 -->
    <section class="mx-auto max-w-5xl px-4 py-14">
      <div class="grid gap-5 sm:grid-cols-3">
        <div
          v-for="f in features"
          :key="f.no"
          class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/80"
        >
          <div class="font-mono text-xs font-semibold tracking-[0.2em] text-brand-500">
            {{ f.no }}
          </div>
          <h3 class="mt-3 font-semibold text-stone-900">{{ f.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-stone-500">{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 三大课程 -->
    <section v-if="courses.length" class="mx-auto max-w-5xl px-4 pb-16">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-stone-900">三大课程,循序渐进</h2>
          <p class="mt-1.5 text-sm text-stone-500">关卡线性解锁,每关结束自动结算速度与准确率。</p>
        </div>
        <RouterLink
          to="/courses"
          class="mb-1 inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition hover:text-brand-500"
        >
          全部课程
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </RouterLink>
      </div>
      <div class="mt-6 grid gap-5 sm:grid-cols-3">
        <RouterLink
          v-for="c in courses"
          :key="c.id"
          :to="`/courses/${c.id}`"
          class="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/80 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-900/5 hover:ring-brand-300"
        >
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold text-stone-900 transition group-hover:text-brand-700">
              {{ c.title }}
            </h3>
            <span
              class="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100"
            >
              {{ c.lessonCount }} 关
            </span>
          </div>
          <p class="mt-2.5 line-clamp-2 text-sm leading-relaxed text-stone-500">
            {{ c.description }}
          </p>
          <span class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
            开始学习
            <svg
              viewBox="0 0 24 24"
              class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </RouterLink>
      </div>
    </section>

    <!-- 打字游戏宣传区(深色街机氛围)+ 实验室入口 -->
    <section class="bg-stone-900 py-16 text-stone-100">
      <div class="mx-auto max-w-5xl px-4">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="font-mono text-xs font-semibold tracking-[0.25em] text-brand-300">
              GAMES
            </div>
            <h2 class="mt-2 text-2xl font-bold tracking-tight text-white">打字游戏,边玩边练</h2>
            <p class="mt-2 max-w-xl text-sm leading-relaxed text-stone-400">
              扎气球、打野鸭、街霸对战、放置挂机、涂鸦跳跃、水墨武林——六款免费小游戏,把键位练成条件反射。最高分与存档都保存在本机浏览器。
            </p>
          </div>
          <RouterLink
            to="/games"
            class="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
          >
            全部游戏
            <svg
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </RouterLink>
        </div>

        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="g in gameCards"
            :key="g.id"
            :to="g.to"
            class="group overflow-hidden rounded-2xl bg-stone-800/50 ring-1 ring-white/10 transition hover:-translate-y-1 hover:bg-stone-800 hover:shadow-xl hover:shadow-black/30 hover:ring-brand-400/40"
          >
            <div
              class="relative flex h-28 items-center justify-center bg-gradient-to-br"
              :class="g.gradient"
            >
              <span
                class="text-5xl drop-shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
              >
                {{ g.badge }}
              </span>
              <span
                v-if="g.best"
                class="absolute top-2.5 right-2.5 rounded-full bg-stone-950/45 px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm"
              >
                {{ g.stats?.scoreLabel ?? '最高分' }} {{ g.best.bestScore }}
              </span>
            </div>
            <div class="p-4">
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-white transition group-hover:text-brand-300">
                  {{ g.title }}
                </h3>
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4 text-stone-500 transition group-hover:translate-x-0.5 group-hover:text-brand-300"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
              <p class="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-stone-400">
                {{ g.desc }}
              </p>
            </div>
          </RouterLink>
        </div>

        <RouterLink
          to="/labs/boids"
          class="group mt-4 flex items-center justify-between gap-4 rounded-2xl px-5 py-4 ring-1 ring-white/10 transition hover:bg-white/5 hover:ring-brand-400/30"
        >
          <div class="flex items-center gap-4">
            <span class="font-mono text-xs font-semibold tracking-[0.25em] text-brand-300">
              LABS
            </span>
            <div>
              <div class="text-sm font-semibold text-white">实验室 · 群鸟算法(Boids)</div>
              <div class="mt-0.5 text-xs text-stone-400">
                分离、对齐、聚合——上千只发光粒子鸟从混乱飞成一个整体。
              </div>
            </div>
          </div>
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4 shrink-0 text-stone-500 transition group-hover:translate-x-0.5 group-hover:text-brand-300"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
