<script setup lang="ts">
import { computed } from 'vue'
import {
  parseFillBlanksAnswer,
  parseSentenceCompletionAnswer,
} from '../../learning/practice/answer'
import type { Answer } from '../../learning/types'
import LearningAnswerFooter from './LearningAnswerFooter.vue'

const props = defineProps<{
  modelValue: readonly string[]
  kind: 'fill-blanks' | 'sentence-completion'
  count: number
  correcting: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: readonly string[]]
  submit: [answer: Answer]
}>()

const english = computed(() => props.kind === 'sentence-completion')
const inputs = computed(() =>
  Array.from({ length: props.count }, (_, index) => props.modelValue[index] ?? ''),
)
const parsed = computed(() =>
  props.kind === 'fill-blanks'
    ? parseFillBlanksAnswer(inputs.value, props.count)
    : parseSentenceCompletionAnswer(inputs.value, props.count),
)
const valid = computed(() => parsed.value.ok)
const note = computed(() =>
  valid.value
    ? '每一空都已填写，可以提交'
    : english.value
      ? '请补全每一空，空白不能提交'
      : '请填写每一空，空白不能提交',
)

function update(index: number, event: Event): void {
  const next = [...inputs.value]
  next[index] = (event.target as HTMLInputElement).value
  emit('update:modelValue', next)
}

function submit(): void {
  if (props.disabled || !parsed.value.ok) return
  emit('submit', parsed.value.answer)
}
</script>

<template>
  <form class="learn-answer-form" novalidate @submit.prevent="submit">
    <div class="learn-blanks">
      <label v-for="(value, index) in inputs" :key="index" class="learn-field">
        第 {{ index + 1 }} 空
        <input
          :value="value"
          :name="`blank-${index}`"
          type="text"
          :lang="english ? 'en' : undefined"
          :inputmode="english ? 'text' : undefined"
          autocomplete="off"
          :autocapitalize="english ? 'off' : undefined"
          :spellcheck="english ? false : undefined"
          :placeholder="english ? '填写单词或短语' : '填写答案'"
          aria-describedby="answer-input-note"
          :disabled="disabled"
          @input="update(index, $event)"
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

.learn-blanks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.learn-blanks input {
  min-height: 58px;
  font-family: 'Avenir Next', 'Trebuchet MS', 'PingFang SC', sans-serif;
  font-size: 22px;
  font-weight: 700;
}
</style>
