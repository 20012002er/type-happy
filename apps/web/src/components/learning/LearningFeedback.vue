<script setup lang="ts">
import { computed } from 'vue'
import type { PracticeQuestionEntry } from '../../learning/practice/practice-session'
import type { Answer } from '../../learning/types'

const props = defineProps<{
  entry: PracticeQuestionEntry
  practiceReward: number
}>()

const settled = computed(() =>
  ['first-correct', 'mastered-after-hint', 'corrected-awaiting-retest'].includes(
    props.entry.status,
  ),
)
const title = computed(() => {
  if (props.entry.status === 'first-correct') return '首次答对，做得很好'
  if (props.entry.status === 'mastered-after-hint') return '订正成功，这次掌握了'
  if (props.entry.status === 'corrected-awaiting-retest') return '已完成订正，之后再来复测'
  if (props.entry.status === 'needs-explanation') return '看看步骤，再完成订正'
  return '先根据提示检查一下'
})

function answerText(answer: Answer): string {
  switch (answer.kind) {
    case 'number':
      return String(answer.value)
    case 'quotient-remainder':
      return `商 ${answer.quotient}，余数 ${answer.remainder}`
    case 'fill-blanks':
    case 'sentence-completion':
      return answer.values.join('；')
    case 'single-choice':
      return answer.optionId
    case 'word-problem':
      return `${answer.value}${answer.unit ?? ''}`
    case 'fraction':
      return `${answer.numerator}/${answer.denominator}`
    case 'english-spelling':
      return answer.value
  }
}

const revealedText = computed(() => {
  const answer = props.entry.feedback?.revealedAnswer
  if (!answer) return ''
  if (answer.kind === 'single-choice') {
    const option = props.entry.question.options?.find((item) => item.id === answer.optionId)
    return option ? option.text : answer.optionId
  }
  return answerText(answer)
})
</script>

<template>
  <section
    class="learn-feedback"
    :class="settled ? 'learn-feedback--success' : 'learn-feedback--guidance'"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="learn-feedback__mark" aria-hidden="true">{{ settled ? '✓' : '→' }}</div>
    <div>
      <h3>{{ title }}</h3>
      <template v-if="settled">
        <p v-if="entry.status === 'corrected-awaiting-retest'">
          本题不发放金币；稍后会用不同情境或数字的同类题再练一次。
        </p>
        <p v-else class="learn-feedback__reward">+{{ practiceReward }} 学习金币已到账</p>
      </template>
      <template v-else-if="entry.feedback">
        <p>
          <strong>{{ entry.feedback.message }}</strong>
        </p>
        <p>提示 {{ entry.feedback.hintLevel }}：{{ entry.feedback.hint }}</p>
        <div v-if="entry.feedback.hintLevel === 2" class="learn-feedback__explanation">
          <h4>分步讲解</h4>
          <ol>
            <li v-for="step in entry.feedback.explanationSteps" :key="step">{{ step }}</li>
          </ol>
          <p v-if="entry.feedback.revealedAnswer">
            正确答案：<strong>{{ revealedText }}</strong>
          </p>
          <p>请重新输入正确答案，完成这道题。</p>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.learn-feedback {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  margin-top: 24px;
  padding: 18px;
  border: 1px solid #d6bb82;
  border-radius: 10px;
  background: #fff5dc;
}

.learn-feedback--success {
  border-color: #9dbca5;
  background: #edf6ea;
}

.learn-feedback__mark {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  color: white;
  background: var(--learn-jade);
  font-weight: 900;
}

.learn-feedback--guidance .learn-feedback__mark {
  color: #674b16;
  background: #f0c35c;
}

.learn-feedback h3,
.learn-feedback h4,
.learn-feedback p {
  margin: 0;
}

.learn-feedback h3 {
  margin-bottom: 8px;
  font-size: 18px;
}

.learn-feedback p,
.learn-feedback li {
  margin-top: 7px;
  line-height: 1.7;
}

.learn-feedback__reward {
  color: var(--learn-jade-dark);
  font-weight: 800;
}

.learn-feedback__explanation {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #c9aa6a;
}

.learn-feedback__explanation ol {
  margin: 8px 0;
  padding-left: 22px;
}
</style>
