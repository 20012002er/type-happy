<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import LearningPage from '../components/learning/LearningPage.vue'
import type { LearningResult } from '../learning/types'
import type { WalletSource } from '../learning/wallet/wallet'
import { useLearningStore } from '../stores/learning'

const learning = useLearningStore()
const resultLabels: Record<LearningResult, string> = {
  'first-correct': '首次答对',
  'awaiting-correction': '待订正',
  'mastered-after-hint': '提示后掌握',
  'corrected-awaiting-retest': '已订正待复测',
  abandoned: '未完成',
  'content-error': '已换题',
}
const sourceLabels: Record<WalletSource, string> = {
  practice: '练习奖励',
  'daily-task': '每日任务',
  streak: '连续任务',
  'farm-sale': '农产品出售',
  'farm-purchase': '农场购买',
  'farm-building': '农场建筑',
  recovery: '恢复补给',
  activity: '活动奖励',
}
const records = computed(() =>
  [...learning.snapshot.learning.records]
    .sort((left, right) => (right.settledAt ?? 0) - (left.settledAt ?? 0))
    .slice(0, 50),
)
const ledger = computed(() => [...learning.snapshot.wallet.ledger].reverse().slice(0, 20))

function knowledgeName(id: string): string {
  return learning.course.knowledgePoints.find((point) => point.id === id)?.name ?? '综合计算'
}

function formatTime(timestamp?: number): string {
  if (timestamp === undefined) return '尚未结算'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

onMounted(() => {
  learning.initialize()
  window.addEventListener('storage', learning.handleStorageEvent)
})
onUnmounted(() => window.removeEventListener('storage', learning.handleStorageEvent))
</script>

<template>
  <LearningPage
    eyebrow="LEARNING LOG"
    title="每一次完成和订正，都有记录"
    description="记录保存在当前浏览器中。有效完成、待复测和内容换题分别呈现，不把完成题数直接等同于掌握程度。"
  >
    <div class="learn-grid learn-reveal learn-reveal--late">
      <section class="learn-paper learn-section" aria-labelledby="records-title">
        <div class="learn-section__heading">
          <h2 id="records-title">最近学习记录</h2>
          <span class="learn-tag">最多显示 50 条</span>
        </div>
        <div v-if="records.length === 0" class="learn-empty">
          还没有学习记录。完成第一道题后，这里会显示结果和订正过程。
        </div>
        <ul v-else class="learn-record-list">
          <li v-for="record in records" :key="record.id">
            <div>
              <strong>{{ knowledgeName(record.knowledgePointId) }}</strong>
              <time :datetime="record.settledAt ? new Date(record.settledAt).toISOString() : undefined">
                {{ formatTime(record.settledAt) }}
              </time>
            </div>
            <span class="learn-result">{{ resultLabels[record.result] }}</span>
            <small>
              提交 {{ record.attempts }} 次 · 最高提示 {{ record.highestHintLevel }} 级
              <template v-if="record.explanationViewed"> · 已查看分步讲解</template>
            </small>
          </li>
        </ul>
      </section>

      <section class="learn-ticket" aria-labelledby="ledger-title">
        <p class="learn-kicker">统一学习钱包</p>
        <h2 id="ledger-title">最近金币流水</h2>
        <p>当前余额 <strong>{{ learning.today.walletBalance }}</strong> 金币</p>
        <div v-if="ledger.length === 0" class="learn-empty">还没有金币变动。</div>
        <ul v-else class="learn-record-list">
          <li v-for="entry in ledger" :key="entry.settlementId">
            <div>
              <strong>{{ sourceLabels[entry.source] }}</strong>
              <time :datetime="new Date(entry.occurredAt).toISOString()">{{ formatTime(entry.occurredAt) }}</time>
            </div>
            <span class="learn-result">{{ entry.direction === 'earn' ? '+' : '-' }}{{ entry.amount }}</span>
            <small>变动后余额 {{ entry.balanceAfter }} · {{ entry.referenceId }}</small>
          </li>
        </ul>
      </section>
    </div>
  </LearningPage>
</template>

<style scoped>
time {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

small {
  overflow-wrap: anywhere;
}
</style>
