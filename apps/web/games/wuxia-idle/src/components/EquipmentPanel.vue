<template>
  <div class="equipment-panel">
    <!-- 操作按钮 -->
    <div class="action-bar">
      <button class="btn-action" @click="openSynthesis">
        <Wand2 class="btn-icon" />
        合成台
      </button>
      <button class="btn-action" @click="openReforge">
        <RefreshCw class="btn-icon" />
        洗炼台
      </button>
    </div>

    <!-- 装备展示 -->
    <div class="equip-section">
      <div class="section-header">
        <span class="section-title">装备栏</span>
      </div>
      <div class="equip-grid">
        <ItemSlot
          v-for="slotConfig in EQUIPMENT_SLOTS"
          :key="slotConfig.slot"
          :item="equipped[slotConfig.slot]"
          :slot-label="slotConfig.name"
          :empty-icon="slotConfig.icon"
          :empty-text="slotConfig.emptyText"
          :is-equipped="false"
          :show-popover="true"
          :show-bonus="true"
          :show-actions="true"
        >
          <template #actions="{ item }">
            <button
              v-if="item"
              class="btn-unequip"
              @click="unequipSlot(slotConfig.slot)"
            >
              卸下
            </button>
          </template>
        </ItemSlot>
      </div>
    </div>

    <!-- 合成台 -->
    <DraggableModal
      v-model:visible="synthVisible"
      title="合成台"
      :width="420"
      :height="300"
      :modal="false"
      :showBackdrop="false"
      :resizable="true"
    >
      <SynthesisPanel />
    </DraggableModal>

    <!-- 洗炼台 -->
    <DraggableModal
      v-model:visible="reforgeVisible"
      title="洗炼台"
      :width="460"
      :height="340"
      :modal="false"
      :showBackdrop="false"
      :resizable="true"
    >
      <ReforgePanel />
    </DraggableModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Wand2, RefreshCw } from 'lucide-vue-next';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '@/types/equipment';
import ItemSlot from './ItemSlot.vue';
import DraggableModal from './DraggableModal.vue';
import SynthesisPanel from './SynthesisPanel.vue';
import ReforgePanel from './ReforgePanel.vue';

const es = useEquipmentStore();
const equipped = computed(() => es.equipped);

const synthVisible = ref(false);
const reforgeVisible = ref(false);
const openSynthesis = () => { synthVisible.value = true; };
const openReforge = () => { reforgeVisible.value = true; };

const unequipSlot = (slot: EquipmentSlot) => { es.unequip(slot); };
</script>

<style scoped>
.equipment-panel {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 操作栏 */
.action-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  background: #fff;
  color: rgba(17, 17, 17, 0.8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-action:hover {
  border-color: rgba(17, 17, 17, 0.25);
  background: rgba(17, 17, 17, 0.03);
}

.btn-icon {
  width: 14px;
  height: 14px;
}

/* 装备区域 */
.equip-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.6);
  letter-spacing: 0.5px;
}

/* 装备网格 - 现代风格 */
.equip-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

@media (max-width: 768px) {
  .equip-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 卸下按钮 */
.btn-unequip {
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-unequip:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
