<template>
  <CommonModal
    v-model="modalVisible"
    title="闭关收益"
    :icon="Sparkles"
    :width="420"
    :show-footer="true"
    confirm-text="领取奖励"
    :show-cancel="false"
    @confirm="handleClaim"
    @close="handleClose"
  >
    <template #default>
      <div class="offline-info">
        <p>你离开了 <strong>{{ formatDuration(offlineDurationMs) }}</strong></p>
        <p class="sub-info" v-if="cappedDurationMs < offlineDurationMs">
          （最多计算 {{ formatDuration(cappedDurationMs) }}）
        </p>
      </div>

      <div class="rewards-section">
        <div class="reward-row">
          <span class="reward-label">经验值</span>
          <span class="reward-value">+{{ rewards.exp }}</span>
        </div>
        <div class="reward-row">
          <span class="reward-label">金币</span>
          <span class="reward-value">+{{ rewards.gold }}</span>
        </div>
        <div v-if="hasAttributeGains" class="reward-row">
          <span class="reward-label">属性</span>
          <span class="reward-value">{{ attributeGainsText }}</span>
        </div>
      </div>

      <div v-if="events.length > 0" class="events-section">
        <div class="section-title">闭关期间发生的事件</div>
        <ul class="event-list">
          <li v-for="event in events" :key="event.timestamp" :class="['event-item', event.type]">
            {{ event.message }}
          </li>
        </ul>
      </div>

      <div v-if="breakthroughs.length > 0" class="breakthroughs-section">
        <div class="section-title"><PartyPopper class="title-icon" /> 突破成功！</div>
        <div v-for="bt in breakthroughs" :key="bt.newLevel" class="breakthrough-item">
          升至 {{ bt.newLevel }} 级
          <span v-if="bt.rewards">
            （攻击+{{ bt.rewards.attackIncrease }}，防御+{{ bt.rewards.defenseIncrease }}，生命+{{ bt.rewards.hpIncrease }}）
          </span>
        </div>
      </div>
    </template>
  </CommonModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles, PartyPopper } from 'lucide-vue-next';
import CommonModal from './common/CommonModal.vue';
import type { OfflineRewardResult, SeclusionEventLog, BreakthroughResult, AttributeGains } from '@/types/seclusion';

interface Props {
  visible: boolean;
  offlineDurationMs: number;
  cappedDurationMs: number;
  rewards: {
    exp: number;
    gold: number;
    attributes: AttributeGains;
  };
  events: SeclusionEventLog[];
  breakthroughs: BreakthroughResult[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
  (e: 'claim'): void;
}>();

// 计算属性：控制CommonModal显示
const modalVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:modelValue', value),
});

const hasAttributeGains = computed(() => {
  const attrs = props.rewards.attributes;
  return Object.values(attrs).some(v => v && v !== 0);
});

const attributeGainsText = computed(() => {
  const attrs = props.rewards.attributes;
  const parts: string[] = [];
  
  if (attrs.strength) parts.push(`力量+${attrs.strength}`);
  if (attrs.agility) parts.push(`敏捷+${attrs.agility}`);
  if (attrs.vitality) parts.push(`体质+${attrs.vitality}`);
  if (attrs.spirit) parts.push(`精神+${attrs.spirit}`);
  if (attrs.maxHp) parts.push(`生命上限+${attrs.maxHp}`);
  if (attrs.attack) parts.push(`攻击+${attrs.attack}`);
  if (attrs.defense) parts.push(`防御+${attrs.defense}`);
  
  return parts.join('，') || '无';
});

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} 小时`;
  }
  return `${hours} 小时 ${minutes} 分钟`;
}

function handleClose() {
  emit('close');
}

function handleClaim() {
  emit('claim');
}
</script>

<style scoped>
.offline-info {
  text-align: center;
  color: #111;
}

.offline-info p {
  margin: 0;
}

.offline-info strong {
  color: #111;
  font-weight: 700;
}

.sub-info {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
  margin-top: 4px !important;
}

.rewards-section {
  background: rgba(17, 17, 17, 0.03);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reward-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reward-label {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.7);
}

.reward-value {
  font-size: 16px;
  font-weight: 700;
  color: #111;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.7);
  margin-bottom: 8px;
}

.events-section {
  background: rgba(17, 17, 17, 0.02);
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  padding: 12px;
}

.event-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.event-item {
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(17, 17, 17, 0.03);
}

.event-item.positive {
  background: rgba(46, 204, 113, 0.1);
  color: #27ae60;
}

.event-item.negative {
  background: rgba(231, 76, 60, 0.1);
  color: #c0392b;
}

.event-item.breakthrough {
  background: rgba(241, 196, 15, 0.15);
  color: #d68910;
}

.breakthroughs-section {
  background: rgba(241, 196, 15, 0.1);
  border: 1px solid rgba(241, 196, 15, 0.3);
  border-radius: 10px;
  padding: 12px;
}

.breakthrough-item {
  font-size: 14px;
  font-weight: 600;
  color: #d68910;
}
</style>
