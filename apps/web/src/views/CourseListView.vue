<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Course, LessonMeta } from '@type-happy/shared'
import { fetchCourse, fetchCourses } from '../api/client'
import { useProgressStore } from '../stores/progress'

interface CourseCard {
  course: Course
  lessons: LessonMeta[]
}

const progress = useProgressStore()
const cards = ref<CourseCard[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const courses = await fetchCourses()
    const details = await Promise.all(
      courses.map(async (course) => {
        try {
          const detail = await fetchCourse(course.id)
          return { course, lessons: detail.lessons }
        } catch {
          return { course, lessons: [] }
        }
      }),
    )
    cards.value = details
  } catch (e) {
    error.value = e instanceof Error ? e.message : '课程加载失败'
  } finally {
    loading.value = false
  }
})

const courseIcons: Record<string, string> = {
  fingering: 'M3 5h18v13H3z M6 8h2v2H6z',
  english: 'M4 6h16M4 6v12h16V6 M8 10h8M8 14h5',
  chinese: 'M6 8h12M12 5v14M8 12l8 6M16 12l-8 6',
}

function completedOf(card: CourseCard): number {
  return progress.completedCount(card.lessons.map((l) => l.id))
}

function percentOf(card: CourseCard): number {
  if (card.lessons.length === 0) return 0
  return Math.round((completedOf(card) / card.lessons.length) * 100)
}

const loadingCards = computed(() => [0, 1, 2])
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <h1 class="text-2xl font-bold text-slate-900">全部课程</h1>
    <p class="mt-1 text-sm text-slate-500">选择一个课程开始练习,关卡按顺序逐步解锁。</p>

    <div
      v-if="error"
      class="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ error }}
    </div>

    <div v-else-if="loading" class="mt-6 grid gap-4 sm:grid-cols-3">
      <div
        v-for="i in loadingCards"
        :key="i"
        class="h-44 animate-pulse rounded-xl border border-slate-200 bg-white"
      />
    </div>

    <div v-else class="mt-6 grid gap-4 sm:grid-cols-3">
      <RouterLink
        v-for="card in cards"
        :key="card.course.id"
        :to="`/courses/${card.course.id}`"
        class="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
      >
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path :d="courseIcons[card.course.id]" />
          </svg>
        </div>
        <h2 class="mt-3 font-semibold text-slate-900 group-hover:text-indigo-600">
          {{ card.course.title }}
        </h2>
        <p class="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">
          {{ card.course.description }}
        </p>
        <div class="mt-4">
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>{{ card.course.lessonCount }} 关</span>
            <span v-if="card.lessons.length">
              已完成 {{ completedOf(card) }}/{{ card.lessons.length }}
            </span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-emerald-500 transition-all"
              :style="{ width: `${percentOf(card)}%` }"
            />
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
