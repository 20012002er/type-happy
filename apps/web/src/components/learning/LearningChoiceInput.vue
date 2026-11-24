<script setup lang="ts">
import { computed } from 'vue'
import type { Answer, QuestionOption } from '../../learning/types'
import LearningAnswerFooter from './LearningAnswerFooter.vue'

const props = defineProps<{
  modelValue: string
  options: readonly QuestionOption[]
  correcting: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [answer: Answer]
}>()

const valid = computed(
  () => props.modelValue !== '' && props.options.some((option) => option.id === props.modelValue),
)
const note = computed(() =>
  valid.value ? '已选择答案，可以提交' : '请先选择一个选项，未选择不能提交',
)

function choose(optionId: string): void {
  if (props.disabled) return
  emit('update:modelValue', optionId)
}

function submit(): void {
  if (props.disabled || !valid.value) return
  emit('submit', { kind: 'single-choice', optionId: props.modelValue })
}
</script>

<template>
  <form class="learn-answer-form" novalidate @submit.prevent="submit">
    <fieldset class="learn-choice" :disabled="disabled">
      <legend>选择一个答案</legend>
      <div class="learn-choice__options">
        <label
          v-for="option in options"
          :key="option.id"
          class="learn-choice__option"
          :class="{ 'learn-choice__option--selected': modelValue === option.id }"
        >
          <input
            type="radio"
            name="choice-option"
            :value="option.id"
            :checked="modelValue === option.id"
            :disabled="disabled"
            @change="choose(option.id)"
          />
          <span>{{ option.text }}</span>
        </label>
      </div>
    </fieldset>
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

.learn-choice {
  margin: 0;
  padding: 0;
  border: none;
}

.learn-choice legend {
  margin-bottom: 10px;
  color: var(--learn-muted);
  font-size: 13px;
  font-weight: 700;
}

.learn-choice__options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.learn-choice__option {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 12px 16px;
  border: 1px solid #bfc6b7;
  border-radius: 10px;
  background: #fffef9;
  color: var(--learn-ink);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
}

.learn-choice__option--selected {
  border-color: var(--learn-jade);
  box-shadow: inset 0 0 0 1px var(--learn-jade);
}

.learn-choice__option input {
  flex: none;
  width: 20px;
  height: 20px;
  accent-color: var(--learn-jade);
}

.learn-choice__option input:focus-visible {
  outline: 3px solid var(--learn-jade);
  outline-offset: 2px;
}

.learn-choice__option span {
  overflow-wrap: anywhere;
}
</style>
