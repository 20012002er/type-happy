<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import LearningPage from '../components/learning/LearningPage.vue'
import { getLearningRecordsPage, getWalletLedgerPage } from '../learning/tasks/learning-summary'
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
const recordPage = ref(1)
const ledgerPage = ref(1)
const records = computed(() => getLearningRecordsPage(learning.snapshot, recordPage.value, 20))
const ledger = computed(() => getWalletLedgerPage(learning.snapshot, ledgerPage.value, 20))

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
          <span class="learn-tag">每页 20 条</span>
        </div>
        <div v-if="records.items.length === 0" class="learn-empty">
          还没有学习记录。完成第一道题后，这里会显示结果和订正过程。
        </div>
        <ul v-else class="learn-record-list">
          <li v-for="record in records.items" :key="record.id">
            <div>
              <strong>{{ knowledgeName(record.knowledgePointId) }}</strong>
              <time
                :datetime="record.settledAt ? new Date(record.settledAt).toISOString() : undefined"
              >
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
        <nav v-if="records.total > 0" class="record-pagination" aria-label="学习记录分页">
          <button
            type="button"
            :disabled="records.page <= 1"
            @click="recordPage = records.page - 1"
          >
            上一页
          </button>
          <span aria-live="polite"
            >第 {{ records.page }} / {{ records.pageCount }} 页 · 共 {{ records.total }} 条</span
          >
          <button
            type="button"
            :disabled="records.page >= records.pageCount"
            @click="recordPage = records.page + 1"
          >
            下一页
          </button>
        </nav>
      </section>

      <section class="learn-ticket" aria-labelledby="ledger-title">
        <p class="learn-kicker">统一学习钱包</p>
        <h2 id="ledger-title">最近金币流水</h2>
        <p>
          当前余额 <strong>{{ learning.today.walletBalance }}</strong> 金币
        </p>
        <div v-if="ledger.items.length === 0" class="learn-empty">还没有金币变动。</div>
        <ul v-else class="learn-record-list">
          <li v-for="entry in ledger.items" :key="entry.settlementId">
            <div>
              <strong>{{ sourceLabels[entry.source] }}</strong>
              <time :datetime="new Date(entry.occurredAt).toISOString()">{{
                formatTime(entry.occurredAt)
              }}</time>
            </div>
            <span class="learn-result"
              >{{ entry.direction === 'earn' ? '+' : '-' }}{{ entry.amount }}</span
            >
            <small>变动后余额 {{ entry.balanceAfter }} · {{ entry.referenceId }}</small>
          </li>
        </ul>
        <nav v-if="ledger.total > 0" class="record-pagination" aria-label="金币流水分页">
          <button type="button" :disabled="ledger.page <= 1" @click="ledgerPage = ledger.page - 1">
            上一页
          </button>
          <span aria-live="polite"
            >第 {{ ledger.page }} / {{ ledger.pageCount }} 页 · 共 {{ ledger.total }} 条</span
          >
          <button
            type="button"
            :disabled="ledger.page >= ledger.pageCount"
            @click="ledgerPage = ledger.page + 1"
          >
            下一页
          </button>
        </nav>
      </section>
    </div>
  </LearningPage>
</template>

<style scoped>
.record-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  color: var(--learn-muted);
  font-size: 12px;
}

.record-pagination button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--learn-line);
  border-radius: 8px;
  color: var(--learn-jade-dark);
  background: var(--learn-paper);
  font-weight: 700;
  cursor: pointer;
}

.record-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

time {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

small {
  overflow-wrap: anywhere;
}
</style>
