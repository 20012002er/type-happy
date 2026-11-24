<script setup lang="ts">
import { computed } from 'vue'
import type { QuestionType } from '../../learning/types'
import { useLearningStore } from '../../stores/learning'

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  number: '数值计算',
  'quotient-remainder': '商和余数',
  'fill-blanks': '填空',
  'single-choice': '单选',
  'word-problem': '应用题',
  fraction: '分数',
  'english-spelling': '英语拼写',
  'sentence-completion': '句子补全',
}

const props = defineProps<{ sessionId: string }>()
const emit = defineEmits<{ startComprehensive: [] }>()
const learning = useLearningStore()
const summary = computed(() => learning.getSessionSummary(props.sessionId))
</script>

<template>
  <section
    v-if="summary"
    class="learn-paper learn-section learn-reveal"
    aria-labelledby="completion-title"
  >
    <p class="learn-kicker">练习结果已保存在本机</p>
    <h2 id="completion-title">
      {{ summary.status === 'completed' ? '这一组完成了' : '本组练习已结束' }}
    </h2>
    <p>
      完成 {{ summary.effectiveCompleted }} 题，订正 {{ summary.corrected }} 题。
      每一次检查和订正都已经记录。
    </p>

    <dl class="learn-stats">
      <div>
        <dt>首次答对</dt>
        <dd>{{ summary.firstCorrect }}</dd>
      </div>
      <div>
        <dt>提示后订正</dt>
        <dd>{{ summary.correctedAfterHint }}</dd>
      </div>
      <div>
        <dt>待复测</dt>
        <dd>{{ summary.pendingRetest }}</dd>
      </div>
    </dl>

    <p v-if="summary.questionTypes.length > 1" class="learn-completion-types">
      <span>按题型有效完成</span>
      <span v-for="item in summary.questionTypes" :key="item.questionType" class="learn-tag">
        {{ QUESTION_TYPE_LABELS[item.questionType] }} {{ item.effectiveCompleted }} 题
      </span>
    </p>

    <div class="learn-completion-grid">
      <div>
        <span>本组单题金币</span>
        <strong>+{{ summary.practiceReward }}</strong>
      </div>
      <div>
        <span>今日任务奖励</span>
        <strong>+{{ learning.today.dailyReward }}</strong>
      </div>
      <div>
        <span>今日连续奖励</span>
        <strong>+{{ learning.today.streakReward }}</strong>
      </div>
      <div>
        <span>当前连续</span>
        <strong>{{ learning.today.currentStreak }} 天</strong>
      </div>
    </div>

    <div v-if="learning.today.taskRemaining === 0" class="learn-note">
      <strong>今日学习已完成，可以休息，也可以去农场看看。</strong>
      如果主动继续，加练新题按首次答对 2 金币、提示后订正 1 金币、讲解后订正 0 金币计算，
      不重复增加今日任务进度或每日奖励。
    </div>
    <div v-else class="learn-note">
      今日还差 {{ learning.today.taskRemaining }} 题完成目标。可以开始新一组，不会重复结算本组题目。
    </div>

    <div class="learn-actions">
      <button type="button" class="learn-button" @click="emit('startComprehensive')">
        {{ learning.today.taskRemaining === 0 ? '再做一组加练' : '继续今日练习' }}
      </button>
      <RouterLink class="learn-button learn-button--secondary" to="/learning"
        >返回学习首页</RouterLink
      >
      <RouterLink class="learn-button learn-button--quiet" to="/learning/farm"
        >去学习农场</RouterLink
      >
    </div>
  </section>
</template>

<style scoped>
.learn-completion-types {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 16px 0 0;
  color: var(--learn-muted);
  font-size: 13px;
}

.learn-completion-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 24px 0;
}

.learn-completion-grid > div {
  padding: 14px;
  border-bottom: 3px solid #d8d6c5;
  background: #f5f3e9;
}

.learn-completion-grid span,
.learn-completion-grid strong {
  display: block;
}

.learn-completion-grid span {
  color: var(--learn-muted);
  font-size: 12px;
}

.learn-completion-grid strong {
  margin-top: 6px;
  font-size: 22px;
}

@media (max-width: 600px) {
  .learn-completion-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
