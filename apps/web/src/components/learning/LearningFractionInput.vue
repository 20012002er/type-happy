<script setup lang="ts">
import { computed } from 'vue'
import { parseFractionAnswer } from '../../learning/practice/answer'
import type { Answer } from '../../learning/types'
import LearningAnswerFooter from './LearningAnswerFooter.vue'

const props = defineProps<{
  numerator: string
  denominator: string
  correcting: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:numerator': [value: string]
  'update:denominator': [value: string]
  submit: [answer: Answer]
}>()

const parsed = computed(() =>
  parseFractionAnswer({ numerator: props.numerator, denominator: props.denominator }),
)
const valid = computed(() => parsed.value.ok)
const note = computed(() => {
  if (parsed.value.ok) return '分数已填写，可以提交'
  if (parsed.value.reason === 'zero-denominator') return '分母不能为 0，请换一个分母'
  if (parsed.value.reason === 'empty') return '请分别输入分子和分母'
  return '分子可以是整数，分母必须是正整数'
})

function update(field: 'numerator' | 'denominator', event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (field === 'numerator') emit('update:numerator', value)
  else emit('update:denominator', value)
}

function submit(): void {
  if (props.disabled || !parsed.value.ok) return
  emit('submit', parsed.value.answer)
}
</script>

<template>
  <form class="learn-answer-form" novalidate @submit.prevent="submit">
    <div class="learn-fraction" role="group" aria-label="分数输入">
      <label class="learn-field">
        分子
        <input
          :value="numerator"
          name="numerator"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="分子"
          aria-describedby="answer-input-note"
          :disabled="disabled"
          @input="update('numerator', $event)"
        />
      </label>
      <span class="learn-fraction__bar" aria-hidden="true"></span>
      <label class="learn-field">
        分母
        <input
          :value="denominator"
          name="denominator"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="分母（不能为 0）"
          aria-describedby="answer-input-note"
          :disabled="disabled"
          @input="update('denominator', $event)"
        />
      </label>
    </div>
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

.learn-fraction {
  display: grid;
  max-width: 320px;
  gap: 8px;
}

.learn-fraction__bar {
  height: 3px;
  border-radius: 2px;
  background: var(--learn-ink);
}

.learn-fraction input {
  min-height: 58px;
  font-family: 'Avenir Next', 'Trebuchet MS', sans-serif;
  font-size: 25px;
  font-weight: 700;
  text-align: center;
}
</style>
