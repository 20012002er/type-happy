<script setup lang="ts">
import { computed } from 'vue'
import { parseNumberAnswer, parseQuotientRemainderAnswer } from '../../learning/practice/answer'
import type { Answer, QuestionSnapshot, QuestionType } from '../../learning/types'
import type { AnswerFormValue } from './answer-form'
import LearningAnswerFooter from './LearningAnswerFooter.vue'
import LearningBlanksInput from './LearningBlanksInput.vue'
import LearningChoiceInput from './LearningChoiceInput.vue'
import LearningFractionInput from './LearningFractionInput.vue'
import LearningSpellingInput from './LearningSpellingInput.vue'
import LearningWordProblemInput from './LearningWordProblemInput.vue'

const props = defineProps<{
  modelValue: AnswerFormValue
  questionType: QuestionType
  correcting: boolean
  disabled: boolean
  question?: QuestionSnapshot
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnswerFormValue]
  submit: [answer: Answer]
}>()

function patch(part: Partial<AnswerFormValue>): void {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

const parsed = computed(() =>
  props.questionType === 'number'
    ? parseNumberAnswer(props.modelValue.answer)
    : parseQuotientRemainderAnswer(props.modelValue),
)
const valid = computed(() => parsed.value.ok)

const blankCount = computed(() => {
  const rule = props.question?.acceptedAnswerRule
  if (rule && (rule.kind === 'fill-blanks' || rule.kind === 'sentence-completion')) {
    return rule.values.length
  }
  return props.modelValue.blanks?.length ?? 0
})
const wordRule = computed(() => {
  const rule = props.question?.acceptedAnswerRule
  return rule?.kind === 'word-problem'
    ? { values: rule.values, unitRequired: rule.unitRequired, decimalPlaces: rule.decimalPlaces }
    : { values: [], unitRequired: false }
})

function update(field: 'answer' | 'quotient' | 'remainder', event: Event): void {
  patch({ [field]: (event.target as HTMLInputElement).value })
}

function submit(): void {
  if (props.disabled || !parsed.value.ok) return
  emit('submit', parsed.value.answer)
}
</script>

<template>
  <LearningChoiceInput
    v-if="questionType === 'single-choice'"
    :model-value="modelValue.optionId ?? ''"
    :options="question?.options ?? []"
    :correcting="correcting"
    :disabled="disabled"
    @update:model-value="patch({ optionId: $event })"
    @submit="emit('submit', $event)"
  />
  <LearningBlanksInput
    v-else-if="questionType === 'fill-blanks' || questionType === 'sentence-completion'"
    :model-value="modelValue.blanks ?? []"
    :kind="questionType"
    :count="blankCount"
    :correcting="correcting"
    :disabled="disabled"
    @update:model-value="patch({ blanks: $event })"
    @submit="emit('submit', $event)"
  />
  <LearningFractionInput
    v-else-if="questionType === 'fraction'"
    :numerator="modelValue.numerator ?? ''"
    :denominator="modelValue.denominator ?? ''"
    :correcting="correcting"
    :disabled="disabled"
    @update:numerator="patch({ numerator: $event })"
    @update:denominator="patch({ denominator: $event })"
    @submit="emit('submit', $event)"
  />
  <LearningWordProblemInput
    v-else-if="questionType === 'word-problem'"
    :value="modelValue.answer"
    :unit="modelValue.unit ?? ''"
    :rule="wordRule"
    :correcting="correcting"
    :disabled="disabled"
    @update:value="patch({ answer: $event })"
    @update:unit="patch({ unit: $event })"
    @submit="emit('submit', $event)"
  />
  <LearningSpellingInput
    v-else-if="questionType === 'english-spelling'"
    :model-value="modelValue.answer"
    :correcting="correcting"
    :disabled="disabled"
    @update:model-value="patch({ answer: $event })"
    @submit="emit('submit', $event)"
  />
  <form v-else class="learn-answer-form" novalidate @submit.prevent="submit">
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
    <LearningAnswerFooter
      :valid="valid"
      :correcting="correcting"
      :disabled="disabled"
      :note="valid ? '答案已填写，可以提交' : '请输入非负整数；无效或空白答案不能提交'"
    />
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
</style>
