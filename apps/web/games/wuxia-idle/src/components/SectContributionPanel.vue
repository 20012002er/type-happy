<template>
  <div
    class="sect-contribution-panel"
    :class="{ embedded }"
  >
    <header
      v-if="!embedded"
      class="panel-header"
    >
      <div class="panel-title">
        <h1>门派贡献</h1>
        <p>通过完成门派任务和活动获得贡献，兑换门派奖励</p>
      </div>
      <div
        class="panel-summary"
        v-if="currentContribution"
      >
        <div class="summary-item">
          <span class="summary-label">当前贡献</span>
          <span class="summary-value">{{ currentContribution.totalContribution }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">贡献等级</span>
          <span class="summary-value">{{ contributionLevel?.name || '暂无' }}</span>
        </div>
      </div>
    </header>

    <div
      v-if="feedbackMessage"
      class="feedback-banner"
      :class="feedbackType"
    >
      {{ feedbackMessage }}
    </div>

    <section
      v-if="!hasJoinedSect"
      class="empty-state"
    >
      <Lamp class="empty-icon" />
      <h2 class="empty-title">尚未加入门派</h2>
      <p class="empty-text">加入门派后，才能累积贡献、兑换奖励和查看贡献记录。</p>
    </section>

    <template v-else>
    <!-- 贡献等级进度 -->
    <section
      class="level-progress-section"
      v-if="contributionLevel"
    >
      <div class="level-info">
        <span class="level-title">{{ contributionLevel.title }}</span>
        <span class="level-name">{{ contributionLevel.name }}</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-bar-fill"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
      <div class="progress-text">
        <span>{{ currentContribution?.totalContribution || 0 }} 贡献值</span>
        <span v-if="pointsToNextLevel > 0">距离下一级还需 {{ pointsToNextLevel }} 点</span>
        <span v-else>已达最高等级</span>
      </div>
    </section>

    <!-- 等级福利 -->
    <section
      class="benefits-section"
      v-if="contributionLevel"
    >
      <h2 class="section-title">等级福利</h2>
      <div class="benefits-list">
        <div
          v-for="(benefit, index) in contributionLevel.benefits"
          :key="index"
          class="benefit-item"
        >
          <span class="benefit-icon">✓</span>
          <span class="benefit-text">{{ benefit }}</span>
        </div>
      </div>
    </section>

    <!-- 贡献获取 -->
    <section class="gains-section">
      <h2 class="section-title">贡献获取</h2>
      <div class="gains-grid">
        <button
          v-for="gain in availableGains"
          :key="gain.type"
          class="gain-card"
          @click="handleGainClick(gain.type)"
          :disabled="!canPerformGain(gain.type)"
        >
          <div class="gain-header">
            <span class="gain-name">{{ gain.name }}</span>
            <span
              class="gain-cooldown"
              :class="gain.cooldown"
            >
              {{ getCooldownText(gain.cooldown) }}
            </span>
          </div>
          <div class="gain-reward">+{{ gain.baseContribution }} 贡献</div>
          <div class="gain-desc">{{ gain.description }}</div>
        </button>
      </div>
    </section>

    <!-- 兑换商店 -->
    <section class="shop-section">
      <h2 class="section-title">贡献商店</h2>
      <div class="shop-grid">
        <div
          v-for="reward in availableRewards"
          :key="reward.id"
          class="reward-card"
        >
          <div class="reward-header">
            <span class="reward-name">{{ reward.name }}</span>
            <span class="reward-cost">{{ reward.contributionCost }} 贡献</span>
          </div>
          <div class="reward-desc">{{ reward.description }}</div>
          <button
            class="redeem-btn"
            :disabled="!canRedeem(reward)"
            @click="handleRedeem(reward)"
          >
            兑换
          </button>
        </div>
      </div>
    </section>

    <!-- 贡献记录 -->
    <section class="logs-section">
      <h2 class="section-title">贡献记录</h2>
      <div class="logs-list">
        <div
          v-for="log in recentLogs"
          :key="log.timestamp"
          class="log-item"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span
            class="log-change"
            :class="log.change >= 0 ? 'positive' : 'negative'"
          >
            {{ log.change >= 0 ? '+' : '' }}{{ log.change }}
          </span>
          <span class="log-reason">{{ log.reason }}</span>
        </div>
        <div
          v-if="recentLogs.length === 0"
          class="empty-logs"
        >
          暂无贡献记录
        </div>
      </div>
    </section>
    </template>

    <CommonModal
      v-model="showDonateModal"
      title="捐赠银两"
      :icon="Coins"
      :width="420"
      confirm-text="确认捐赠"
      :confirm-disabled="!canSubmitDonation"
      @confirm="confirmDonateGold"
      @close="resetDonateModal"
    >
      <template #default>
        <div class="modal-form">
          <p class="modal-copy">请输入要向当前门派捐赠的银两数量。</p>
          <input
            v-model="donationGoldInput"
            class="modal-input"
            type="number"
            min="1"
            step="1"
            placeholder="例如：100"
          />
          <p class="modal-hint">当前持有：{{ playerGold }} 银两</p>
        </div>
      </template>
    </CommonModal>

    <CommonModal
      v-model="showRedeemModal"
      title="确认兑换"
      :icon="Gift"
      :width="420"
      confirm-text="确认兑换"
      :confirm-disabled="!selectedReward || !canRedeem(selectedReward)"
      @confirm="confirmRedeem"
      @close="selectedReward = null"
    >
      <template #default>
        <div
          v-if="selectedReward"
          class="modal-form"
        >
          <p class="modal-copy">{{ selectedReward.description }}</p>
          <p class="modal-hint">消耗：{{ selectedReward.contributionCost }} 贡献</p>
          <p class="modal-hint">
            当前剩余：{{ currentContribution?.totalContribution || 0 }} 贡献
          </p>
        </div>
      </template>
    </CommonModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Coins, Gift, Lamp } from 'lucide-vue-next';
import { useSectContributionStore } from '@/stores/sectContributionStore';
import { useSectStore } from '@/stores/sectStore';
import { usePlayerStore } from '@/stores/playerStore';
import { sectContributionConfig } from '@/config/sectContributionConfig';
import { sectContributionService } from '@/services/sectContributionService';
import { SectReputationService } from '@/services/sectReputationService';
import CommonModal from '@/components/common/CommonModal.vue';
import type {
  RedemptionReward,
} from '@/types/sectContribution';

interface Props {
  embedded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  embedded: false,
});

const store = useSectContributionStore();
const sectStore = useSectStore();
const playerStore = usePlayerStore();

const hasJoinedSect = computed(() => !!sectStore.sectType);
const sectType = computed(() => sectStore.sectType);
const playerGold = computed(() => playerStore.player.resources.gold);
const showDonateModal = ref(false);
const showRedeemModal = ref(false);
const donationGoldInput = ref('');
const selectedReward = ref<RedemptionReward | null>(null);
const feedbackMessage = ref('');
const feedbackType = ref<'success' | 'warning'>('success');
const embedded = computed(() => props.embedded);

const currentContribution = computed(() => {
  if (!sectType.value) return null;
  return store.getContribution(sectType.value);
});

const sectReputationLevel = computed(() => {
  if (!sectType.value) return 0;
  return SectReputationService.getSectLevelByPoints(sectType.value, sectStore.sectReputation);
});

const contributionLevel = computed(() => {
  if (!currentContribution.value) return undefined;
  const points = currentContribution.value.totalContribution;
  return sectContributionConfig.getLevelByContribution(points);
});

const pointsToNextLevel = computed(() => {
  if (!currentContribution.value) return 0;
  const points = currentContribution.value.totalContribution;
  return sectContributionConfig.getPointsToNextLevel(points);
});

const progressPercent = computed(() => {
  if (!currentContribution.value) return 0;
  const points = currentContribution.value.totalContribution;
  return sectContributionConfig.getProgressPercent(points);
});

const availableGains = computed(() => {
  if (!sectType.value) return [];
  return sectContributionConfig.getAvailableGains(sectReputationLevel.value || 1);
});

const availableRewards = computed(() => {
  if (!sectType.value) return [];
  return sectContributionConfig.getAvailableRewards(sectType.value);
});

const recentLogs = computed(() => store.logs.slice(0, 10));
const canSubmitDonation = computed(() => {
  const amount = Number.parseInt(donationGoldInput.value, 10);
  return Number.isFinite(amount) && amount > 0 && amount <= playerGold.value;
});

function setFeedback(message: string, type: 'success' | 'warning' = 'success') {
  feedbackMessage.value = message;
  feedbackType.value = type;
}

function getCooldownText(cooldown: string): string {
  const texts: Record<string, string> = {
    none: '无限制',
    daily: '每日',
    weekly: '每周',
  };
  return texts[cooldown] || cooldown;
}

function canPerformGain(type: string): boolean {
  if (!currentContribution.value) return false;
  const contribution = currentContribution.value;
  if (type === 'sect_task' && contribution.todayTaskCount >= 1) return false;
  if (type === 'sect_battle' && contribution.todayBattleCount >= 3) return false;
  return true;
}

function canRedeem(reward: RedemptionReward): boolean {
  if (!currentContribution.value) return false;
  if (currentContribution.value.totalContribution < reward.contributionCost) return false;
  if (reward.requirements) {
    return sectReputationLevel.value >= reward.requirements.minReputationLevel;
  }
  return true;
}

async function handleGainClick(type: string) {
  if (!sectType.value) {
    setFeedback('请先加入门派。', 'warning');
    return;
  }

  const currentSectType = sectType.value;
  let result:
    | { success: boolean; contribution: number; message: string }
    | undefined;

  switch (type) {
    case 'daily_prayer':
      result = await sectContributionService.performDailyPrayer(currentSectType);
      break;
    case 'sect_task':
      result = await sectContributionService.completeSectTask(currentSectType);
      break;
    case 'sect_battle':
      result = await sectContributionService.participateSectBattle(currentSectType);
      break;
    case 'teach_disciple':
      result = await sectContributionService.teachDisciple(currentSectType);
      break;
    case 'clear_territory':
      result = await sectContributionService.clearTerritory(currentSectType);
      break;
    case 'donate_gold':
      donationGoldInput.value = '';
      showDonateModal.value = true;
      break;
  }

  if (result) {
    setFeedback(result.message, result.success ? 'success' : 'warning');
  }
}

function handleRedeem(reward: RedemptionReward) {
  selectedReward.value = reward;
  showRedeemModal.value = true;
}

async function confirmDonateGold() {
  if (!sectType.value) return;

  const amount = Number.parseInt(donationGoldInput.value, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    setFeedback('请输入有效的捐赠数量。', 'warning');
    return;
  }

  const result = await sectContributionService.donateGold(sectType.value, amount);
  setFeedback(result.message, result.success ? 'success' : 'warning');
  if (result.success) {
    resetDonateModal();
  }
}

function resetDonateModal() {
  donationGoldInput.value = '';
  showDonateModal.value = false;
}

function confirmRedeem() {
  if (!sectType.value || !selectedReward.value) return;

  if (store.spendContribution(sectType.value, selectedReward.value.contributionCost)) {
    setFeedback(`成功兑换：${selectedReward.value.name}`);
  } else {
    setFeedback('贡献不足，无法兑换。', 'warning');
  }

  selectedReward.value = null;
  showRedeemModal.value = false;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

onMounted(async () => {
  await sectContributionConfig.load();

  if (!store.initialized) {
    await store.init();
  }

  if (sectStore.sectType) {
    store.setPlayerSectType(sectStore.sectType);
  }
});
</script>

<style scoped>
.sect-contribution-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.sect-contribution-panel.embedded {
  padding: 0;
  max-width: none;
  margin: 0;
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.panel-title h1 {
  margin: 0 0 6px 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
}

.feedback-banner {
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
}

.feedback-banner.success {
  background: rgba(22, 163, 74, 0.08);
  color: #166534;
}

.feedback-banner.warning {
  background: rgba(217, 119, 6, 0.08);
  color: #92400e;
}

.empty-state {
  padding: 32px 24px;
  border: 1px dashed rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  text-align: center;
  background: rgba(17, 17, 17, 0.02);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.empty-title {
  margin: 0 0 8px;
  font-size: 18px;
}

.empty-text {
  margin: 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.55);
}

.panel-title p {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.panel-summary {
  display: flex;
  gap: 20px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: right;
}

.summary-label {
  font-size: 10px;
  color: rgba(17, 17, 17, 0.45);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #0f0f0f;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modal-copy {
  margin: 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.72);
  line-height: 1.6;
}

.modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  font-size: 14px;
}

.modal-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.52);
}

/* Section Title */
.section-title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
}

/* Level Progress */
.level-progress-section {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
}

.level-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.level-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f0f0f;
}

.level-name {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(17, 17, 17, 0.08);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(135deg, #101010, #3d3d3d);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
}

/* Benefits */
.benefits-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 8px;
}

.benefit-icon {
  color: #10b981;
  font-weight: 600;
}

.benefit-text {
  font-size: 13px;
  color: #0f0f0f;
}

/* Gains */
.gains-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.gain-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.gain-card:hover:not(:disabled) {
  border-color: rgba(17, 17, 17, 0.3);
  background: rgba(17, 17, 17, 0.02);
}

.gain-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gain-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gain-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
}

.gain-cooldown {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.06);
  color: rgba(17, 17, 17, 0.55);
}

.gain-cooldown.daily {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.gain-reward {
  font-size: 16px;
  font-weight: 700;
  color: #10b981;
}

.gain-desc {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
}

/* Shop */
.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.reward-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
}

.reward-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reward-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
}

.reward-cost {
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
}

.reward-desc {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.55);
}

.redeem-btn {
  width: 100%;
  padding: 8px;
  background: #0f0f0f;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.redeem-btn:hover:not(:disabled) {
  background: #333;
}

.redeem-btn:disabled {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
  cursor: not-allowed;
}

/* Logs */
.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.06);
  border-radius: 8px;
  font-size: 12px;
}

.log-time {
  color: rgba(17, 17, 17, 0.45);
  font-family: 'SF Mono', 'Courier New', monospace;
}

.log-change {
  font-weight: 600;
  min-width: 50px;
}

.log-change.positive {
  color: #10b981;
}

.log-change.negative {
  color: #ef4444;
}

.log-reason {
  color: rgba(17, 17, 17, 0.7);
}

.empty-logs {
  padding: 20px;
  text-align: center;
  color: rgba(17, 17, 17, 0.4);
  font-size: 12px;
}
</style>
