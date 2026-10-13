<!--
  地牢结算弹窗
  显示奖励明细和战绩统计
-->
<template>
  <CommonModal
    v-model="modalVisible"
    :title="resultTitle"
    :icon="resultIcon"
    :width="440"
    :show-footer="true"
    confirm-text="确认"
    :show-cancel="false"
    :show-header="false"
    @confirm="handleClose"
    @close="handleClose"
  >
    <template #default>
      <!-- 自定义头部 - 渐变背景 -->
      <div class="custom-header" :class="resultClass">
        <component :is="resultIcon" class="result-icon" />
        <span class="result-title">{{ resultTitle }}</span>
      </div>

      <!-- 战绩统计 -->
      <div class="stats-section">
        <div class="section-title">战绩统计</div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">地牢</span>
            <span class="stat-value">{{ dungeonName }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">波次</span>
            <span class="stat-value">{{ wavesCleared }} / {{ totalWaves }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">用时</span>
            <span class="stat-value">{{ formatDuration(duration) }}</span>
          </div>
        </div>
      </div>

      <!-- 奖励明细 -->
      <div class="rewards-section">
        <div class="section-title">获得奖励</div>
        <div class="rewards-list">
          <div class="reward-row">
            <Coins class="reward-icon" />
            <span class="reward-name">金币</span>
            <span class="reward-value">+{{ rewards.gold }}</span>
          </div>
          <div class="reward-row">
            <Sparkles class="reward-icon" />
            <span class="reward-name">经验</span>
            <span class="reward-value">+{{ rewards.exp }}</span>
          </div>
          <div v-for="(drop, idx) in rewards.drops" :key="idx" class="reward-row">
            <Package class="reward-icon" />
            <span class="reward-name">{{ drop.name }}</span>
            <span class="reward-value">×{{ drop.qty }}</span>
          </div>
        </div>
      </div>
    </template>
  </CommonModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PartyPopper, Skull, DoorOpen, Coins, Sparkles, Package } from 'lucide-vue-next';
import CommonModal from '../common/CommonModal.vue';
import type { RewardPool, DungeonResult } from '@/types/dungeon';

const props = defineProps<{
  visible: boolean;
  result: DungeonResult;
  dungeonName: string;
  wavesCleared: number;
  totalWaves: number;
  duration: number; // 毫秒
  rewards: RewardPool;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}>();

// 计算属性：控制CommonModal显示
const modalVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:modelValue', value),
});

const resultClass = computed(() => {
  switch (props.result) {
    case 'cleared': return 'result-success';
    case 'failed': return 'result-failed';
    case 'aborted': return 'result-aborted';
    default: return '';
  }
});

const resultIcon = computed(() => {
  switch (props.result) {
    case 'cleared': return PartyPopper;
    case 'failed': return Skull;
    case 'aborted': return DoorOpen;
    default: return PartyPopper;
  }
});

const resultTitle = computed(() => {
  switch (props.result) {
    case 'cleared': return '挑战成功！';
    case 'failed': return '挑战失败';
    case 'aborted': return '已撤退';
    default: return '';
  }
});

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  return `${remainingSeconds}秒`;
};

const handleClose = () => {
  emit('close');
};
</script>

<style scoped>
/* 自定义头部 - 渐变背景 */
.custom-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: #fff;
  margin: -28px -28px 20px -28px;
  border-radius: 20px 20px 0 0;
}

.custom-header.result-success {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

.custom-header.result-failed {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.custom-header.result-aborted {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

.result-icon {
  font-size: 32px;
}

.result-title {
  font-size: 22px;
  font-weight: 700;
}

.stats-section,
.rewards-section {
  padding: 0 0 20px 0;
}

.stats-section {
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  padding-bottom: 20px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.5);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  color: #111;
}

.rewards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reward-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(17, 17, 17, 0.02);
  border-radius: 8px;
}

.reward-icon {
  width: 18px;
  height: 18px;
  color: rgba(17, 17, 17, 0.6);
}

.reward-name {
  flex: 1;
  font-size: 14px;
  color: #111;
}

.reward-value {
  font-size: 14px;
  font-weight: 600;
  color: #16a34a;
}
</style>
