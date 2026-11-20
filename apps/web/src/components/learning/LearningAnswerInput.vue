<script setup lang="ts">
import { computed } from 'vue'
import { parseNumberAnswer, parseQuotientRemainderAnswer } from '../../learning/practice/answer'
import type { Answer, QuestionType } from '../../learning/types'

interface AnswerInputValue {
  answer: string
  quotient: string
  remainder: string
}

const props = defineProps<{
  modelValue: AnswerInputValue
  questionType: QuestionType
  correcting: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnswerInputValue]
  submit: [answer: Answer]
}>()

const parsed = computed(() =>
  props.questionType === 'number'
    ? parseNumberAnswer(props.modelValue.answer)
    : parseQuotientRemainderAnswer(props.modelValue),
)
const valid = computed(() => parsed.value.ok)

function update(field: keyof AnswerInputValue, event: Event): void {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: (event.target as HTMLInputElement).value,
  })
}

function submit(): void {
  if (props.disabled || !parsed.value.ok) return
  emit('submit', parsed.value.answer)
}
</script>

<template>
  <form class="learn-answer-form" novalidate @submit.prevent="submit">
    <label v-if="questionType === 'number'" class="learn-field">
      答案
      <input
        :value="modelValue.answer"
        name="answer"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="输入非负整数"
        aria-describedby="answer-input-note"
        :disabled="disabled"
        @input="update('answer', $event)"
      />
    </label>
    <div v-else class="learn-answer-form__pair">
      <label class="learn-field">
        商
        <input
          :value="modelValue.quotient"
          name="quotient"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="商"
          aria-describedby="answer-input-note"
          :disabled="disabled"
          @input="update('quotient', $event)"
        />
      </label>
      <label class="learn-field">
        余数
        <input
          :value="modelValue.remainder"
          name="remainder"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="余数"
          aria-describedby="answer-input-note"
          :disabled="disabled"
          @input="update('remainder', $event)"
        />
      </label>
    </div>
    <div class="learn-answer-form__footer">
      <small id="answer-input-note">
        {{ valid ? '答案已填写，可以提交' : '请输入非负整数；无效或空白答案不能提交' }}
      </small>
      <button type="submit" class="learn-button" :disabled="disabled || !valid">
        {{ correcting ? '提交订正' : '提交答案' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.learn-answer-form {
  display: grid;
  gap: 18px;
  margin-top: 24px;
}

.learn-answer-form__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.learn-answer-form input {
  min-height: 58px;
  font-family: 'Avenir Next', 'Trebuchet MS', sans-serif;
  font-size: 25px;
  font-weight: 700;
}

.learn-answer-form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.learn-answer-form__footer small {
  color: var(--learn-muted);
  line-height: 1.5;
}

@media (max-width: 480px) {
  .learn-answer-form__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
