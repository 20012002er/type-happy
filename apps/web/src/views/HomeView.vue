<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Course } from '@type-happy/shared'
import { fetchCourses } from '../api/client'

const courses = ref<Course[]>([])

onMounted(async () => {
  try {
    courses.value = await fetchCourses()
  } catch {
    courses.value = []
  }
})

const features = [
  {
    title: '指法图解',
    desc: 'SVG 虚拟键盘按手指分色,实时高亮目标键与 Shift 提示,错键红闪,养成规范盲打习惯。',
  },
  {
    title: '拼音智能判分',
    desc: '中文练习监听输入法组合状态,拼音逐音节比对,同音字不误判,错字不阻塞,流畅练习。',
  },
  {
    title: '成绩本地追踪',
    desc: 'WPM/字每分、准确率、用时自动结算,历史最佳与最近 20 次记录保存在浏览器本地。',
  },
]
</script>

<template>
  <div>
    <section class="bg-gradient-to-b from-indigo-50 to-slate-50">
      <div class="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 class="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          每天十分钟
          <span class="text-indigo-600">练出好指法</span>
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-base text-slate-500">
          标准指法、英文文章、中文拼音三大课程,虚拟键盘实时引导,无需注册,打开即练。
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <RouterLink
            to="/courses"
            class="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-indigo-500"
          >
            开始练习
          </RouterLink>
          <RouterLink
            to="/courses/fingering"
            class="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            从指法练起
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-5xl px-4 py-14">
      <div class="grid gap-4 sm:grid-cols-3">
        <div
          v-for="f in features"
          :key="f.title"
          class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 class="font-semibold text-slate-900">{{ f.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-500">{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <section v-if="courses.length" class="mx-auto max-w-5xl px-4 pb-16">
      <h2 class="text-lg font-semibold text-slate-900">三大课程</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <RouterLink
          v-for="c in courses"
          :key="c.id"
          :to="`/courses/${c.id}`"
          class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-slate-900 group-hover:text-indigo-600">{{ c.title }}</h3>
            <span class="text-xs text-slate-400">{{ c.lessonCount }} 关</span>
          </div>
          <p class="mt-2 line-clamp-2 text-sm text-slate-500">{{ c.description }}</p>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
