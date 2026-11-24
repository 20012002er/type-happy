<script setup lang="ts">
defineProps<{
  valid: boolean
  correcting: boolean
  disabled: boolean
  note: string
  noteId?: string
}>()
</script>

<template>
  <div class="learn-answer-form__footer">
    <small :id="noteId ?? 'answer-input-note'">{{ note }}</small>
    <button type="submit" class="learn-button" :disabled="disabled || !valid">
      {{ correcting ? '提交订正' : '提交答案' }}
    </button>
  </div>
</template>

<style scoped>
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
