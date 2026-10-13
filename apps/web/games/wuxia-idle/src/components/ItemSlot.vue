<!--
  ItemSlot - 现代明亮风格装备槽位组件

  设计参考：现代 RPG 游戏 UI
  - 明亮的浅色背景
  - 清晰的边框层次
  - 物品品质颜色
-->
<template>
  <div
    class="item-slot"
    :class="{
      'item-slot--empty': !item,
      'item-slot--equipped': item && isEquipped,
      'item-slot--locked': item?.locked,
      [`item-slot--rarity-${item?.rarity}`]: item?.rarity
    }"
    :title="tooltipText"
    @click="handleClick"
  >
    <!-- 槽位类型图标 -->
    <div class="slot-icon" v-if="emptyIcon">
      <component :is="emptyIcon" class="slot-icon-svg" />
    </div>

    <!-- 物品内容 -->
    <div v-if="item" class="slot-content">
      <div class="item-display">
        <InfoPopover
          v-if="showPopover"
          type="item"
          :item="item"
          :show-underline="false"
          class="item-name"
        >
          {{ item.name }}
        </InfoPopover>
        <div v-else class="item-name">{{ item.name }}</div>
      </div>

      <!-- 物品属性 -->
      <div v-if="showBonus && item.bonuses" class="item-bonus">
        {{ formatBonus(item.bonuses) }}
      </div>

      <!-- 卸下按钮 -->
      <div v-if="showActions" class="slot-actions">
        <slot name="actions" :item="item"></slot>
      </div>
    </div>

    <!-- 空槽提示 -->
    <div v-else class="slot-empty">
      <span class="empty-label">{{ slotLabel || '空' }}</span>
    </div>

    <!-- 锁定标记 -->
    <div v-if="item?.locked" class="lock-indicator">
      <Lock class="lock-icon" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { Lock } from 'lucide-vue-next';
import type { Item } from '@/types/equipment';
import InfoPopover from './InfoPopover.vue';

interface Props {
  item?: Item | null;
  slotLabel?: string;
  emptyIcon?: Component;
  emptyText?: string;
  isEquipped?: boolean;
  showPopover?: boolean;
  showBonus?: boolean;
  showActions?: boolean;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  item: null,
  slotLabel: '',
  emptyIcon: undefined,
  emptyText: '（空）',
  isEquipped: false,
  showPopover: true,
  showBonus: true,
  showActions: false,
  clickable: false
});

interface Emits {
  (e: 'click', item: Item | null): void;
}

const emit = defineEmits<Emits>();

const tooltipText = computed(() => {
  if (!props.item) {
    return props.slotLabel ? `${props.slotLabel} - 未装备` : '空槽位';
  }
  return props.item.comment || props.item.name;
});

const formatBonus = (bonuses: any) => {
  const parts: string[] = [];
  if (bonuses.attack) parts.push(`攻+${bonuses.attack}`);
  if (bonuses.defense) parts.push(`防+${bonuses.defense}`);
  if (bonuses.hp) parts.push(`命+${bonuses.hp}`);
  return parts.join(' ');
};

const handleClick = () => {
  if (props.clickable) {
    emit('click', props.item);
  }
};
</script>

<style scoped>
/* 基础格子容器 - 明亮现代风格 */
.item-slot {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1.5px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: all 0.15s ease;
  overflow: hidden;
}

.item-slot:hover {
  border-color: #bbb;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* 空槽位 */
.item-slot--empty {
  border-style: dashed;
  border-color: #d4d4d4;
  background: #fafafa;
}

.item-slot--empty:hover {
  border-color: #aaa;
  background: #f5f5f5;
}

/* 已装备 */
.item-slot--equipped {
  border-color: #fbbf24;
  background: #fffbeb;
  box-shadow: 0 0 0 1px #fbbf24, 0 2px 6px rgba(251, 191, 36, 0.2);
}

/* 锁定状态 */
.item-slot--locked {
  opacity: 0.9;
}

/* 物品品质颜色 */
.item-slot--rarity-common {
  border-color: #a1a1a1;
  background: #fafafa;
}
.item-slot--rarity-uncommon {
  border-color: #22c55e;
  background: #f0fdf4;
  box-shadow: 0 0 0 1px #22c55e, 0 2px 6px rgba(34, 197, 94, 0.15);
}
.item-slot--rarity-rare {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 1px #3b82f6, 0 2px 8px rgba(59, 130, 246, 0.2);
}
.item-slot--rarity-epic {
  border-color: #a855f7;
  background: #faf5ff;
  box-shadow: 0 0 0 1px #a855f7, 0 2px 10px rgba(168, 85, 247, 0.25);
}
.item-slot--rarity-legendary {
  border-color: #f97316;
  background: #fff7ed;
  box-shadow: 0 0 0 1px #f97316, 0 2px 12px rgba(249, 115, 22, 0.3);
}

/* 槽位类型图标 */
.slot-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.12;
  pointer-events: none;
}

.slot-icon-svg {
  width: 55%;
  height: 55%;
  color: #666;
}

/* 物品内容 */
.slot-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.item-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.item-name {
  font-size: 10px;
  font-weight: 600;
  color: #333;
  text-align: center;
  line-height: 1.25;
  word-break: break-word;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-bonus {
  font-size: 9px;
  color: #65a30d;
  font-weight: 500;
}

/* 空槽显示 */
.slot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.empty-label {
  font-size: 9px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 锁定标记 */
.lock-indicator {
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 3px;
}

.lock-icon {
  width: 9px;
  height: 9px;
  color: #f59e0b;
}

/* 操作按钮区 */
.slot-actions {
  display: flex;
  justify-content: center;
  padding-top: 2px;
  border-top: 1px solid #eee;
  width: 100%;
}

.slot-actions :deep(.btn-unequip) {
  padding: 2px 8px;
  font-size: 9px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.slot-actions :deep(.btn-unequip:hover) {
  background: #fee2e2;
  border-color: #f87171;
}
</style>
