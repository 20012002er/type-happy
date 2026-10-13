<template>
  <CommonModal
    v-model="modalVisible"
    title="江湖小剧场"
    :icon="BookOpen"
    :width="420"
    :show-footer="true"
    :confirm-text="confirmText"
    @close="handleClose"
    @confirm="handleConfirm"
  >
    <template #default>
      <!-- 闭关完成信息 -->
      <div class="completion-info">
        <div class="completion-badge">闭关完成</div>
        <div class="completion-time">{{ formattedDuration }}</div>
      </div>

      <!-- 江湖故事 -->
      <div class="story-content">
        <component :is="storyIcon" class="story-icon" />
        <p class="story-text">{{ storyMessage }}</p>
      </div>

      <!-- 获得收集物 -->
      <div
        v-if="collectible"
        class="collectible-reward"
      >
        <div class="collectible-header">此番收获</div>
        <div
          class="collectible-item"
          :class="rarityClass"
        >
          <span class="collectible-icon">{{ collectible.icon }}</span>
          <div class="collectible-info">
            <span class="collectible-name">{{ collectible.name }}</span>
            <span class="collectible-rarity">{{ rarityLabel }}</span>
          </div>
          <span
            v-if="collectible.isNew"
            class="new-badge"
          >新</span>
        </div>
      </div>

      <!-- 获得奖励汇总 -->
      <div class="rewards-summary">
        <div class="reward-item">
          <span class="reward-label">修为</span>
          <span class="reward-value">+{{ Math.floor(expGained) }}</span>
        </div>
        <div class="reward-item">
          <span class="reward-label">气血</span>
          <span class="reward-value">+{{ Math.floor(hpGained) }}</span>
        </div>
        <div class="reward-item">
          <span class="reward-label">精力</span>
          <span class="reward-value">+{{ Math.floor(energyGained) }}</span>
        </div>
        <div
          v-if="interruptCount === 0"
          class="reward-item bonus"
        >
          <span class="reward-label">心如止水</span>
          <span class="reward-value">+{{ reputationBonus }} 名声</span>
        </div>
      </div>

      <!-- 中断提示 -->
      <div
        v-if="interruptCount > 0"
        class="interrupt-note"
      >
        心神散乱 {{ interruptCount }} 次，未能心如止水
      </div>
    </template>
  </CommonModal>
</template>

<script setup lang="ts">
import { computed, watch, ref, type Component } from 'vue';
import { BookOpen, Leaf, Sparkles, Swords, BookMarked, Sparkle, Flower2 } from 'lucide-vue-next';
import CommonModal from './common/CommonModal.vue';
import type { CollectibleDrop, JianghuStoryEvent } from '@/types/seclusion';

interface Props {
  visible: boolean;
  storyEvent: JianghuStoryEvent | null;
  collectible: CollectibleDrop | null;
  expGained: number;
  hpGained: number;
  energyGained: number;
  interruptCount: number;
  durationMinutes: number;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  storyEvent: null,
  collectible: null,
  expGained: 0,
  hpGained: 0,
  energyGained: 0,
  interruptCount: 0,
  durationMinutes: 25,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

// 计算属性：控制CommonModal显示
const modalVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:modelValue', value),
});

// 故事图标
const storyIcon = computed(() => {
  const icons: Record<string, Component> = {
    general: Leaf,
    practice: Sparkles,
    sparring: Swords,
    reading: BookMarked,
    rare: Sparkle,
  };
  return props.storyEvent ? icons[props.storyEvent.type] || Flower2 : Flower2;
});

// 故事内容
const storyMessage = computed(() => {
  return props.storyEvent?.message || '此番闭关，虽无所得，却也无失。';
});

// 格式化时长
const formattedDuration = computed(() => {
  const duration = props.durationMinutes;
  if (duration >= 90) return '一场闭关';
  if (duration >= 50) return '两炷香';
  return '一炷香';
});

// 收集物稀有度样式
const rarityClass = computed(() => {
  return props.collectible ? `rarity-${props.collectible.rarity}` : '';
});

const rarityLabel = computed(() => {
  const labels: Record<string, string> = {
    common: '寻常',
    fine: '上乘',
    rare: '绝学',
    epic: '失传',
  };
  return props.collectible ? labels[props.collectible.rarity] || '' : '';
});

// 名声奖励
const reputationBonus = computed(() => {
  return 1 + Math.floor(props.durationMinutes / 30);
});

// 确认按钮文字
const confirmText = computed(() => {
  return props.collectible ? '收入囊中' : '收功';
});

// 关闭处理
const handleClose = () => {
  emit('close');
};

// 确认处理
const handleConfirm = () => {
  emit('confirm');
};
</script>

<style scoped>
.completion-info {
  text-align: center;
}

.completion-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid #22c55e;
  border-radius: 6px;
  font-size: 13px;
  color: #16a34a;
  margin-bottom: 8px;
}

.completion-time {
  color: rgba(17, 17, 17, 0.6);
  font-size: 14px;
}

.story-content {
  text-align: center;
  padding: 16px;
  background: rgba(17, 17, 17, 0.03);
  border-radius: 12px;
}

.story-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
}

.story-text {
  margin: 0;
  font-size: 16px;
  color: rgba(17, 17, 17, 0.8);
  line-height: 1.6;
  font-style: italic;
}

.collectible-reward {
  border-top: 1px solid rgba(17, 17, 17, 0.08);
  padding-top: 16px;
}

.collectible-header {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
  margin-bottom: 8px;
}

.collectible-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(17, 17, 17, 0.02);
  border-radius: 10px;
  border-left: 3px solid #666;
}

.collectible-item.rarity-common {
  border-left-color: #9ca3af;
}

.collectible-item.rarity-fine {
  border-left-color: #10b981;
}

.collectible-item.rarity-rare {
  border-left-color: #3b82f6;
}

.collectible-item.rarity-epic {
  border-left-color: #8b5cf6;
}

.collectible-icon {
  font-size: 24px;
}

.collectible-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collectible-name {
  font-size: 15px;
  color: #111;
}

.collectible-rarity {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.new-badge {
  padding: 2px 6px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid #fbbf24;
  border-radius: 4px;
  font-size: 11px;
  color: #d97706;
}

.rewards-summary {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 12px;
  background: rgba(17, 17, 17, 0.02);
  border-radius: 10px;
}

.reward-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.reward-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.reward-value {
  font-size: 16px;
  color: #111;
  font-family: 'Courier New', monospace;
}

.reward-item.bonus .reward-value {
  color: #16a34a;
}

.interrupt-note {
  text-align: center;
  font-size: 13px;
  color: #dc2626;
}
</style>
