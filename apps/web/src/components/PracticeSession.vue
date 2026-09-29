<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Lesson, PracticeResult } from '@type-happy/shared'
import { useTypingEngine } from '../composables/useTypingEngine'
import { useChineseEngine } from '../composables/useChineseEngine'
import TypingArea from './TypingArea.vue'
import PinyinTypingArea from './PinyinTypingArea.vue'
import StatsBar from './StatsBar.vue'
import VirtualKeyboard from './VirtualKeyboard.vue'

const props = defineProps<{ lesson: Lesson }>()
const emit = defineEmits<{ finished: [result: PracticeResult] }>()

const content = props.lesson.content
const isPinyin = content.kind === 'pinyin'
const isEmptyText = content.kind === 'text' && content.text.trim().length === 0

const cnEngine = content.kind === 'pinyin' ? useChineseEngine(content.chars, props.lesson.id) : null
const textEngine =
  content.kind === 'text' && content.text.trim().length > 0
    ? useTypingEngine(content.text, { lessonId: props.lesson.id })
    : null

const stats = cnEngine?.stats ?? textEngine?.stats
const result = computed(() => cnEngine?.result.value ?? textEngine?.result.value ?? null)

watch(result, (r) => {
  if (r) emit('finished', r)
})

const showKeyboard = computed(() => {
  if (content.kind === 'pinyin') return true
  return content.showKeyboard
})

const targetChar = computed(() =>
  cnEngine ? cnEngine.targetKey.value : (textEngine?.targetChar.value ?? null),
)
const feedback = computed(() => cnEngine?.feedback.value ?? textEngine?.feedback.value ?? null)
const progress = computed(
  () => cnEngine?.progress.value ?? textEngine?.progress.value ?? { done: 0, total: 0 },
)
</script>

<template>
  <div
    v-if="isEmptyText"
    class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700"
  >
    该关卡暂无练习内容,请返回关卡列表选择其他关卡。
  </div>

  <div v-else class="flex flex-col gap-4">
    <StatsBar
      v-if="stats"
      :wpm="stats.wpm.value"
      :cpm="stats.cpm.value"
      :accuracy="stats.accuracy.value"
      :elapsed-ms="stats.elapsedMs.value"
      :done="progress.done"
      :total="progress.total"
      :primary="isPinyin ? 'cpm' : 'wpm'"
    />

    <TypingArea v-if="textEngine" :chars="textEngine.chars.value" :pos="textEngine.pos.value" />

    <PinyinTypingArea
      v-else-if="cnEngine"
      :chars="cnEngine.chars.value"
      :pos="cnEngine.pos.value"
      :composing="cnEngine.composing.value"
      :composition-text="cnEngine.compositionText.value"
      :finished="cnEngine.status.value === 'finished'"
    />

    <VirtualKeyboard
      v-if="showKeyboard"
      :target-char="targetChar"
      :feedback="feedback"
      :show-fingers="true"
    />

    <p v-if="!isPinyin" class="text-center text-xs text-slate-400">
      点击页面任意位置后直接开始输入,退格键可修正;最后一个字符输入正确后自动结算。
    </p>
  </div>
</template>
