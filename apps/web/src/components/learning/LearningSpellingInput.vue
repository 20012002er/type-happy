<script setup lang="ts">
import { computed } from 'vue'
import { parseEnglishSpellingAnswer } from '../../learning/practice/answer'
import type { Answer } from '../../learning/types'
import LearningAnswerFooter from './LearningAnswerFooter.vue'

const props = defineProps<{
  modelValue: string
  correcting: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [answer: Answer]
}>()

const parsed = computed(() => parseEnglishSpellingAnswer(props.modelValue))
const valid = computed(() => parsed.value.ok)
const note = computed(() => {
  if (parsed.value.ok) return '拼写已填写，可以提交'
  if (parsed.value.reason === 'empty') return '请输入单词'
  return '只输入英文字母、撇号或连字符'
})

function update(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function submit(): void {
  if (props.disabled || !parsed.value.ok) return
  emit('submit', parsed.value.answer)
}
</script>

<template>
  <form class="learn-answer-form" novalidate @submit.prevent="submit">
    <label class="learn-field">
      单词拼写
      <input
        :value="modelValue"
        name="spelling"
        type="text"
        lang="en"
        autocomplete="off"
        autocapitalize="off"
        :spellcheck="false"
        placeholder="输入英文单词"
        aria-describedby="answer-input-note"
        :disabled="disabled"
        @input="update"
      />
    </label>
    <LearningAnswerFooter
      :valid="valid"
      :correcting="correcting"
      :disabled="disabled"
      :note="note"
    />
  </form>
</template>

<style scoped>
.learn-answer-form {
  display: grid;
  gap: 18px;
  margin-top: 24px;
}

.learn-answer-form input {
  min-height: 58px;
  font-family: 'Avenir Next', 'Trebuchet MS', sans-serif;
  font-size: 25px;
  font-weight: 700;
}
</style>
