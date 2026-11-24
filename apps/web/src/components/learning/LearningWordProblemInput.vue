<script setup lang="ts">
import { computed } from 'vue'
import { parseWordProblemAnswer } from '../../learning/practice/answer'
import type { Answer } from '../../learning/types'
import LearningAnswerFooter from './LearningAnswerFooter.vue'

interface WordProblemRule {
  values: readonly { value: number; unit?: string }[]
  unitRequired: boolean
  decimalPlaces?: number
}

const props = defineProps<{
  value: string
  unit: string
  rule: WordProblemRule
  correcting: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:value': [value: string]
  'update:unit': [value: string]
  submit: [answer: Answer]
}>()

const parsed = computed(() =>
  parseWordProblemAnswer({ value: props.value, unit: props.unit }, props.rule),
)
const valid = computed(() => parsed.value.ok)
const note = computed(() => {
  if (parsed.value.ok) return '数量和单位已填写，可以提交'
  if (parsed.value.field === 'unit') return '请写上题目要求的单位'
  if (parsed.value.reason === 'empty') return '请先输入数量'
  return '请输入正确的数量，注意小数位数'
})

function update(field: 'value' | 'unit', event: Event): void {
  const next = (event.target as HTMLInputElement).value
  if (field === 'value') emit('update:value', next)
  else emit('update:unit', next)
}

function submit(): void {
  if (props.disabled || !parsed.value.ok) return
  emit('submit', parsed.value.answer)
}
</script>

<template>
  <form class="learn-answer-form" novalidate @submit.prevent="submit">
    <div class="learn-form-grid">
      <label class="learn-field">
        数量
        <input
          :value="value"
          name="word-problem-value"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="列式计算后的结果"
          aria-describedby="answer-input-note"
          :disabled="disabled"
          @input="update('value', $event)"
        />
      </label>
      <label class="learn-field">
        单位{{ rule.unitRequired ? '' : '（可选）' }}
        <input
          :value="unit"
          name="word-problem-unit"
          type="text"
          autocomplete="off"
          placeholder="如：元、米"
          aria-describedby="answer-input-note"
          :disabled="disabled"
          @input="update('unit', $event)"
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

.learn-answer-form input {
  min-height: 58px;
  font-family: 'Avenir Next', 'Trebuchet MS', 'PingFang SC', sans-serif;
  font-size: 22px;
  font-weight: 700;
}

/* 数量宽、单位窄；首页筛选网格改为等宽两列后在此保留原比例 */
.learn-form-grid {
  grid-template-columns: minmax(0, 1.4fr) minmax(140px, 0.6fr);
}

@media (max-width: 480px) {
  .learn-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
