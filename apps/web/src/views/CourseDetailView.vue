<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { CourseDetail } from '@type-happy/shared'
import { ApiError, fetchCourse } from '../api/client'
import { useProgressStore } from '../stores/progress'

const props = defineProps<{ courseId: string }>()
const router = useRouter()
const progress = useProgressStore()

const detail = ref<CourseDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

async function load(courseId: string): Promise<void> {
  loading.value = true
  error.value = null
  notFound.value = false
  try {
    detail.value = await fetchCourse(courseId)
  } catch (e) {
    detail.value = null
    if (e instanceof ApiError && e.status === 404) notFound.value = true
    else error.value = e instanceof Error ? e.message : '课程加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => load(props.courseId))
watch(
  () => props.courseId,
  (id) => load(id),
)

const lessonIds = computed(() => detail.value?.lessons.map((l) => l.id) ?? [])
const completedCount = computed(() => progress.completedCount(lessonIds.value))

function unlocked(index: number): boolean {
  return progress.isLessonUnlocked(lessonIds.value, index)
}

function openLesson(index: number): void {
  const lesson = detail.value?.lessons[index]
  if (!lesson || !unlocked(index)) return
  router.push({
    name: 'practice',
    params: { courseId: props.courseId, lessonId: lesson.id },
  })
}

function statusOf(index: number): 'done' | 'open' | 'locked' {
  const lesson = detail.value?.lessons[index]
  if (!lesson) return 'locked'
  if (progress.isCompleted(lesson.id)) return 'done'
  return unlocked(index) ? 'open' : 'locked'
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <RouterLink
      to="/courses"
      class="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-indigo-600"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      全部课程
    </RouterLink>

    <div v-if="loading" class="mt-6 space-y-3">
      <div class="h-10 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div v-for="i in 5" :key="i" class="h-16 animate-pulse rounded-xl bg-slate-100" />
    </div>

    <div
      v-else-if="notFound"
      class="mt-10 rounded-xl border border-slate-200 bg-white p-10 text-center"
    >
      <p class="font-medium text-slate-700">课程不存在</p>
      <RouterLink
        to="/courses"
        class="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
      >
        返回课程列表
      </RouterLink>
    </div>

    <div
      v-else-if="error"
      class="mt-10 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ error }}
    </div>

    <template v-else-if="detail">
      <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ detail.course.title }}</h1>
          <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
            {{ detail.course.description }}
          </p>
        </div>
        <div class="text-right">
          <div class="text-sm font-semibold tabular-nums text-slate-700">
            {{ completedCount }} / {{ detail.lessons.length }}
          </div>
          <div class="text-xs text-slate-400">已完成</div>
        </div>
      </div>

      <div class="mt-6 space-y-2.5">
        <button
          v-for="(lesson, i) in detail.lessons"
          :key="lesson.id"
          class="flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition"
          :class="
            statusOf(i) === 'locked'
              ? 'cursor-not-allowed border-slate-100 opacity-60'
              : 'cursor-pointer border-slate-200 hover:border-indigo-300 hover:shadow-md'
          "
          :disabled="statusOf(i) === 'locked'"
          @click="openLesson(i)"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            :class="{
              'bg-emerald-100 text-emerald-600': statusOf(i) === 'done',
              'bg-indigo-100 text-indigo-600': statusOf(i) === 'open',
              'bg-slate-100 text-slate-400': statusOf(i) === 'locked',
            }"
          >
            <svg
              v-if="statusOf(i) === 'done'"
              viewBox="0 0 24 24"
              class="h-4.5 w-4.5"
              fill="currentColor"
            >
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
            </svg>
            <svg
              v-else-if="statusOf(i) === 'locked'"
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="currentColor"
            >
              <path
                d="M17 9V7a5 5 0 0 0-10 0v2H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-1ZM9 7a3 3 0 0 1 6 0v2H9V7Z"
              />
            </svg>
            <span v-else>{{ lesson.index }}</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="font-medium text-slate-900">{{ lesson.title }}</div>
            <div v-if="lesson.description" class="mt-0.5 truncate text-xs text-slate-400">
              {{ lesson.description }}
            </div>
          </div>

          <div v-if="statusOf(i) === 'done'" class="shrink-0 text-right">
            <div class="text-sm font-semibold tabular-nums text-emerald-600">
              {{ progress.bestOf(lesson.id)?.wpm ?? 0 }} WPM
            </div>
            <div class="text-xs tabular-nums text-slate-400">
              准确率 {{ progress.bestOf(lesson.id)?.accuracy ?? 0 }}%
            </div>
          </div>
          <span
            v-else-if="statusOf(i) === 'open'"
            class="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600"
          >
            开始练习
          </span>
          <span v-else class="shrink-0 text-xs text-slate-400">未解锁</span>
        </button>
      </div>

      <p v-if="detail.lessons.length === 0" class="mt-10 text-center text-sm text-slate-400">
        该课程内容制作中,敬请期待。
      </p>
    </template>
  </div>
</template>
