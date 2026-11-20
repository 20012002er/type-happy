<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import LearningPage from '../components/learning/LearningPage.vue'
import { LEARNING_RULES } from '../learning/config/rules'
import { useLearningStore } from '../stores/learning'

const learning = useLearningStore()
const progress = computed(() =>
  Math.min(100, Math.round((learning.today.taskCompleted / learning.today.goal) * 100)),
)

onMounted(() => {
  learning.initialize()
  window.addEventListener('storage', learning.handleStorageEvent)
})
onUnmounted(() => window.removeEventListener('storage', learning.handleStorageEvent))
</script>

<template>
  <LearningPage
    eyebrow="TODAY & STREAK"
    title="完成目标，奖励自动到账"
    description="每日任务按设备所在地的自然日计算。不需要手动领取，也不会因为刷新或返回页面重复发放。"
  >
    <div class="learn-grid learn-reveal learn-reveal--late">
      <div class="learn-stack">
        <section class="learn-paper learn-section" aria-labelledby="daily-task-title">
          <p class="learn-kicker">每日任务</p>
          <div class="learn-section__heading">
            <h2 id="daily-task-title">有效完成 {{ learning.today.goal }} 题</h2>
            <span class="learn-tag">完成奖励 {{ LEARNING_RULES.dailyTask.completionReward }} 金币</span>
          </div>
          <div class="learn-big-number">
            {{ learning.today.taskCompleted }}<small> / {{ learning.today.goal }} 题</small>
          </div>
          <div
            class="learn-progress"
            role="progressbar"
            aria-label="每日任务进度"
            :aria-valuenow="learning.today.taskCompleted"
            aria-valuemin="0"
            :aria-valuemax="learning.today.goal"
          >
            <span :style="{ '--progress': `${progress}%` }" />
          </div>
          <p v-if="learning.today.dailyRewarded" class="learn-note">
            今日目标已完成，{{ LEARNING_RULES.dailyTask.completionReward }} 金币每日奖励已经到账。
            今天可以继续休息或主动加练。
          </p>
          <p v-else class="learn-note">
            再有效完成 {{ learning.today.taskRemaining }} 题即可达成今日目标。首次答对、提示后订正和讲解后订正都属于有效完成。
          </p>
          <div class="learn-actions">
            <RouterLink class="learn-button" to="/learning">
              {{ learning.activeSession ? '继续本组练习' : '去练习' }}
            </RouterLink>
          </div>
        </section>

        <section class="learn-paper learn-section" aria-labelledby="streak-task-title">
          <p class="learn-kicker">连续任务</p>
          <h2 id="streak-task-title">当前连续 {{ learning.today.currentStreak }} 天</h2>
          <p>只有完成当日全部目标才增加连续天数；历史最长纪录为 {{ learning.today.longestStreak }} 天。</p>
          <ol class="learn-milestones">
            <li
              v-for="milestone in LEARNING_RULES.streak.milestones"
              :key="milestone.days"
              :class="{ 'is-reached': learning.today.currentStreak >= milestone.days }"
            >
              <strong>{{ milestone.days }} 天</strong>
              <span>+{{ milestone.reward }} 金币</span>
              <span>{{ learning.today.currentStreak >= milestone.days ? '已达到' : '未达成' }}</span>
            </li>
          </ol>
          <p>
            30 天后，每再连续 7 天奖励 {{ LEARNING_RULES.streak.recurringReward }} 金币。
            下一个目标：{{ learning.today.nextMilestone.days }} 天，奖励 {{ learning.today.nextMilestone.reward }} 金币。
          </p>
        </section>
      </div>

      <aside class="learn-stack">
        <section class="learn-ticket" aria-labelledby="income-title">
          <p class="learn-kicker">今日收入摘要</p>
          <h2 id="income-title">金币从哪里来</h2>
          <dl class="learn-income-list">
            <div><dt>单题练习</dt><dd>+{{ learning.today.practiceReward }}</dd></div>
            <div><dt>每日任务</dt><dd>+{{ learning.today.dailyReward }}</dd></div>
            <div><dt>连续任务</dt><dd>+{{ learning.today.streakReward }}</dd></div>
            <div><dt>当前余额</dt><dd>{{ learning.today.walletBalance }}</dd></div>
          </dl>
          <RouterLink to="/learning/records" class="learn-text-button">查看学习与金币记录</RouterLink>
        </section>

        <section v-if="learning.today.taskRemaining === 0" class="learn-note">
          <strong>加练奖励标准</strong>
          首次答对 {{ LEARNING_RULES.practiceRewards.extraPractice.firstCorrect }} 金币；
          提示后订正 {{ LEARNING_RULES.practiceRewards.extraPractice.correctedAfterHint }} 金币；
          讲解后订正 {{ LEARNING_RULES.practiceRewards.extraPractice.correctedAfterExplanation }} 金币。
          加练不重复增加每日进度，也不重复发放每日奖励。
        </section>

        <button type="button" class="learn-button learn-button--secondary" disabled title="学习农场将在下一阶段开放">
          学习农场 · 下一阶段开放
        </button>
      </aside>
    </div>
  </LearningPage>
</template>

<style scoped>
.learn-income-list {
  margin: 18px 0;
}

.learn-income-list > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px dashed #c8b98f;
}

.learn-income-list dt {
  color: #695b3b;
}

.learn-income-list dd {
  margin: 0;
  font-weight: 800;
}
</style>
