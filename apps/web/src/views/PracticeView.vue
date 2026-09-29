<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { Lesson, LessonMeta, PracticeResult } from '@type-happy/shared'
import { ApiError, fetchCourse, fetchLesson } from '../api/client'
import { isBetterResult, useProgressStore } from '../stores/progress'
import PracticeSession from '../components/PracticeSession.vue'
import ResultPanel from '../components/ResultPanel.vue'

const props = defineProps<{ courseId: string; lessonId: string }>()
const router = useRouter()
const progress = useProgressStore()

const lesson = ref<Lesson | null>(null)
const courseLessons = ref<LessonMeta[]>([])
const courseTitle = ref('')
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

const sessionKey = ref(0)
const currentResult = ref<PracticeResult | null>(null)
const prevBest = ref<PracticeResult | null>(null)
const isNewBest = ref(false)

const isPinyin = computed(() => lesson.value?.content.kind === 'pinyin')
const currentIndex = computed(() => courseLessons.value.findIndex((l) => l.id === props.lessonId))
const nextLesson = computed<LessonMeta | null>(() => {
  if (currentIndex.value < 0) return null
  return courseLessons.value[currentIndex.value + 1] ?? null
})

async function load(courseId: string, lessonId: string): Promise<void> {
  loading.value = true
  error.value = null
  notFound.value = false
  currentResult.value = null
  prevBest.value = null
  isNewBest.value = false
  sessionKey.value += 1
  try {
    const [lessonData, courseData] = await Promise.all([
      fetchLesson(courseId, lessonId),
      fetchCourse(courseId).catch(() => null),
    ])
    lesson.value = lessonData
    courseTitle.value = courseData?.course.title ?? ''
    courseLessons.value = courseData?.lessons ?? []
    document.title = `${lessonData.title} · 打字乐园`
  } catch (e) {
    lesson.value = null
    if (e instanceof ApiError && e.status === 404) notFound.value = true
    else error.value = e instanceof Error ? e.message : '关卡加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => load(props.courseId, props.lessonId))
watch(
  () => [props.courseId, props.lessonId],
  ([courseId, lessonId]) => load(courseId, lessonId),
)

function onFinished(result: PracticeResult): void {
  const prev = progress.bestOf(result.lessonId)
  prevBest.value = prev ? { ...prev } : null
  isNewBest.value = prev === null || isBetterResult(result, prev)
  progress.saveResult(result)
  currentResult.value = result
}

function restart(): void {
  currentResult.value = null
  prevBest.value = null
  isNewBest.value = false
  sessionKey.value += 1
}

function goNext(): void {
  const next = nextLesson.value
  if (!next) return
  currentResult.value = null
  router.push({
    name: 'practice',
    params: { courseId: props.courseId, lessonId: next.id },
  })
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <div class="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <RouterLink to="/courses" class="transition hover:text-indigo-600">全部课程</RouterLink>
      <span class="text-slate-300">/</span>
      <RouterLink :to="`/courses/${courseId}`" class="transition hover:text-indigo-600">
        {{ courseTitle || courseId }}
      </RouterLink>
      <span class="text-slate-300">/</span>
      <span class="text-slate-700">{{ lesson?.title ?? lessonId }}</span>
    </div>

    <div v-if="loading" class="mt-6 space-y-4">
      <div class="h-24 animate-pulse rounded-xl bg-slate-100" />
      <div class="h-40 animate-pulse rounded-xl bg-slate-100" />
    </div>

    <div
      v-else-if="notFound"
      class="mt-10 rounded-xl border border-slate-200 bg-white p-10 text-center"
    >
      <p class="font-medium text-slate-700">关卡不存在</p>
      <RouterLink
        :to="`/courses/${courseId}`"
        class="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
      >
        返回关卡列表
      </RouterLink>
    </div>

    <div
      v-else-if="error"
      class="mt-10 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ error }}
    </div>

    <template v-else-if="lesson">
      <div class="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-900">
            <span
              v-if="currentIndex >= 0"
              class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600"
            >
              {{ lesson.index }}
            </span>
            {{ lesson.title }}
          </h1>
          <p v-if="lesson.description" class="mt-1.5 text-sm text-slate-500">
            {{ lesson.description }}
          </p>
        </div>
        <div
          v-if="progress.progressOf(lesson.id)"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm"
        >
          历史最佳
          <span class="ml-1 font-semibold tabular-nums text-indigo-600">
            {{ progress.bestOf(lesson.id)?.wpm }} WPM
          </span>
          <span class="mx-1 text-slate-300">|</span>
          练习
          <span class="ml-1 font-semibold tabular-nums">{{
            progress.progressOf(lesson.id)?.attempts
          }}</span>
          次
        </div>
      </div>

      <div class="mt-5">
        <PracticeSession :key="sessionKey" :lesson="lesson" @finished="onFinished" />
      </div>
    </template>

    <ResultPanel
      v-if="currentResult && !loading"
      :result="currentResult"
      :prev-best="prevBest"
      :is-new-best="isNewBest"
      :primary="isPinyin ? 'cpm' : 'wpm'"
      :has-next="nextLesson !== null"
      @restart="restart"
      @next="goNext"
      @back="router.push(`/courses/${courseId}`)"
    />
  </div>
</template>
