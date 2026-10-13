<template>
  <CommonModal
    v-model="modalVisible"
    title="欢迎回来"
    :icon="Home"
    :width="520"
    :show-footer="true"
    confirm-text="继续游戏"
    :show-cancel="false"
    @confirm="close"
    @close="close"
  >
    <template #default>
      <!-- 离线时长 -->
      <div class="offline-time">
        <p class="time-info">{{ formatOfflineTime(reward.offlineTimeMs) }}</p>
        <p v-if="isCapped" class="time-warning">
          （已达到离线收益上限：{{ formatOfflineTime(reward.cappedTimeMs) }}）
        </p>
      </div>

      <!-- 总结消息 -->
      <div class="summary">
        <p class="summary-text">{{ reward.message }}</p>
      </div>

      <!-- 详细收益 -->
      <div v-if="hasRewards" class="rewards-section">
        <h3 class="section-title">离线收益</h3>

        <!-- 采集物品 -->
        <div v-if="reward.rewards.gatheredItems && reward.rewards.gatheredItems.length > 0" class="reward-group">
          <div class="reward-title">采集物品</div>
          <div
            v-for="item in reward.rewards.gatheredItems"
            :key="item.resourceId"
            class="reward-item"
          >
            <span class="item-name">{{ item.resourceName }}</span>
            <span class="item-quantity">+{{ item.quantity }}</span>
          </div>
        </div>

        <!-- 技能经验 -->
        <div v-if="reward.rewards.skillExp && reward.rewards.skillExp.length > 0" class="reward-group">
          <div class="reward-title">技能经验</div>
          <div
            v-for="skill in reward.rewards.skillExp"
            :key="skill.skillType"
            class="reward-item"
          >
            <span class="item-name">{{ getSkillName(skill.skillType) }}</span>
            <span class="item-quantity">+{{ skill.exp }}</span>
          </div>
        </div>

        <!-- 角色总经验 -->
        <div v-if="reward.rewards.totalExp" class="reward-group">
          <div class="reward-title">角色经验</div>
          <div class="reward-item">
            <span class="item-name">总经验</span>
            <span class="item-quantity">+{{ reward.rewards.totalExp }}</span>
          </div>
        </div>

        <!-- 金币 -->
        <div v-if="reward.rewards.gold" class="reward-group">
          <div class="reward-item">
            <span class="item-name">金币</span>
            <span class="item-quantity">+{{ reward.rewards.gold }}</span>
          </div>
        </div>
      </div>

      <!-- 详细日志 -->
      <div v-if="reward.detailedMessages.length > 0" class="details-section">
        <h3 class="section-title">详细信息</h3>
        <div class="details-list">
          <p
            v-for="(msg, index) in reward.detailedMessages"
            :key="index"
            class="detail-msg"
          >
            {{ msg }}
          </p>
        </div>
      </div>

      <!-- 离线效率说明 -->
      <div class="efficiency-info">
        <p class="info-text">
          离线效率：{{ (reward.efficiency * 100).toFixed(0) }}%
          <span class="info-hint">（离线时自动进行的活动效率会有所降低）</span>
        </p>
      </div>
    </template>
  </CommonModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Home } from 'lucide-vue-next';
import CommonModal from './common/CommonModal.vue';
import type { OfflineReward } from '@/types/offline';

interface Props {
  visible: boolean;
  reward: OfflineReward;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 计算属性：控制CommonModal显示
const modalVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:modelValue', value),
});

// 计算属性
const isCapped = computed(() => {
  return props.reward.offlineTimeMs > props.reward.cappedTimeMs;
});

const hasRewards = computed(() => {
  const r = props.reward.rewards;
  return (
    (r.gatheredItems && r.gatheredItems.length > 0) ||
    (r.skillExp && r.skillExp.length > 0) ||
    r.totalExp ||
    r.gold
  );
});

// 方法
function close() {
  emit('close');
}

function formatOfflineTime(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    if (minutes > 0) {
      return `离线了${hours}小时${minutes}分钟`;
    }
    return `离线了${hours}小时`;
  }
  return `离线了${minutes}分钟`;
}

function getSkillName(skillType: string): string {
  const nameMap: Record<string, string> = {
    herb_gathering: '采药',
    woodcutting: '伐木',
    fishing: '钓鱼',
    mining: '采矿'
  };
  return nameMap[skillType] || skillType;
}
</script>

<style scoped>
.offline-time {
  text-align: center;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(17, 17, 17, 0.03);
  border-radius: 10px;
}

.time-info {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #111;
}

.time-warning {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
  margin: 0;
}

.summary {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(17, 17, 17, 0.02);
  border-left: 3px solid #111;
}

.summary-text {
  margin: 0;
  font-size: 15px;
  color: #111;
  line-height: 1.6;
}

.rewards-section {
  margin-bottom: 16px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 700;
  color: #111;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.reward-group {
  margin-bottom: 12px;
}

.reward-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.6);
  margin-bottom: 4px;
}

.reward-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(17, 17, 17, 0.02);
  border: 1px solid rgba(17, 17, 17, 0.06);
  margin-bottom: 4px;
}

.item-name {
  font-size: 14px;
  color: #111;
}

.item-quantity {
  font-size: 14px;
  font-weight: 700;
  color: #111;
}

.details-section {
  margin-bottom: 16px;
}

.details-list {
  background: rgba(17, 17, 17, 0.02);
  border: 1px solid rgba(17, 17, 17, 0.06);
  padding: 12px;
}

.detail-msg {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.7);
  line-height: 1.5;
}

.detail-msg:last-child {
  margin-bottom: 0;
}

.efficiency-info {
  padding: 8px;
  background: rgba(17, 17, 17, 0.02);
  border: 1px solid rgba(17, 17, 17, 0.06);
}

.info-text {
  margin: 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.7);
}

.info-hint {
  font-style: italic;
}
</style>

