<template>
  <div class="right-sidebar">
    <!-- 横向Tab栏 -->
    <div class="tab-bar">
      <div 
        v-for="tab in tabs" 
        :key="tab.id"
        class="tab-item"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </div>
    </div>

    <!-- Tab内容区域 -->
    <div class="tab-content">
      <!-- 装备面板 -->
      <div v-show="activeTab === 'equipment'" class="tab-panel">
        <EquipmentPanel compact />
      </div>

      <!-- 库存面板 -->
      <div v-show="activeTab === 'inventory'" class="tab-panel inventory-tab">
        <InventoryPanel />
      </div>

      <!-- 属性面板 -->
      <div v-show="activeTab === 'stats'" class="tab-panel stats-panel">
        <div class="stats-summary">
          <!-- 基础四维 -->
          <div class="stats-section">
            <div class="section-title">基础属性</div>
            <div class="stat-line">
              <span>力量：</span>
              <span>{{ player.stats.strength ?? 5 }}</span>
            </div>
            <div class="stat-line">
              <span>敏捷：</span>
              <span>{{ player.stats.agility ?? 5 }}</span>
            </div>
            <div class="stat-line">
              <span>体质：</span>
              <span>{{ player.stats.vitality ?? 5 }}</span>
            </div>
            <div class="stat-line">
              <span>悟性：</span>
              <span>{{ player.stats.spirit ?? 5 }}</span>
            </div>
          </div>

          <!-- 战斗属性 -->
          <div class="stats-section">
            <div class="section-title">战斗属性</div>
            <div class="stat-line">
              <span>生命：</span>
              <span>{{ player.stats.hp }}/{{ player.stats.maxHp }}</span>
            </div>
            <div class="stat-line">
              <span>内力：</span>
              <span>{{ Math.floor(player.stats.energy ?? 0) }}/{{ player.stats.maxEnergy ?? 100 }}</span>
            </div>
            <div class="stat-line">
              <span>内力恢复：</span>
              <span>{{ energyRegenRate }}/分钟</span>
            </div>
            <div class="stat-line">
              <span>体力：</span>
              <span>{{ Math.floor(stamina.current) }}/{{ stamina.max }}</span>
            </div>
            <div class="stat-line">
              <span>体力恢复：</span>
              <span>{{ staminaRegenRate }}/分钟</span>
            </div>
            <div class="stat-line">
              <span>攻击：</span>
              <span>{{ player.stats.attack }}</span>
            </div>
            <div class="stat-line">
              <span>防御：</span>
              <span>{{ player.stats.defense }}</span>
            </div>
            <div class="stat-line">
              <span>破防：</span>
              <span>{{ Math.floor(player.stats.armorPenetration ?? 0) }}</span>
            </div>
          </div>

          <!-- 战斗特性 -->
          <div class="stats-section">
            <div class="section-title">战斗特性</div>
            <div class="stat-line">
              <span>命中：</span>
              <span>{{ ((player.stats.accuracy ?? 0.9) * 100).toFixed(1) }}%</span>
            </div>
            <div class="stat-line">
              <span>闪避：</span>
              <span>{{ ((player.stats.dodgeChance ?? 0) * 100).toFixed(1) }}%</span>
            </div>
            <div class="stat-line">
              <span>暴击：</span>
              <span>{{ ((player.stats.critChance ?? 0) * 100).toFixed(1) }}%</span>
            </div>
            <div class="stat-line">
              <span>暴伤：</span>
              <span>{{ ((player.stats.critMultiplier ?? 1.5) * 100).toFixed(0) }}%</span>
            </div>
            <div class="stat-line">
              <span>格挡：</span>
              <span>{{ ((player.stats.blockChance ?? 0) * 100).toFixed(1) }}%</span>
            </div>
            <div class="stat-line">
              <span>韧性：</span>
              <span>{{ Math.floor(player.stats.tenacity ?? 0) }}</span>
            </div>
            <div class="stat-line">
              <span>速度：</span>
              <span>{{ (player.stats.speed ?? 1.0).toFixed(2) }}</span>
            </div>
          </div>

          <!-- 武侠特色 -->
          <div class="stats-section">
            <div class="section-title">武侠修为</div>
            <div class="stat-line">
              <span>轻功：</span>
              <span>{{ player.stats.qinggongLevel ?? 0 }}级</span>
            </div>
            <div class="stat-line">
              <span>内功：</span>
              <span>{{ player.stats.neigongLevel ?? 0 }}级</span>
            </div>
          </div>

          <!-- 其他属性 -->
          <div class="stats-section">
            <div class="section-title">其他</div>
            <div class="stat-line">
              <span>幸运：</span>
              <span>{{ (player.stats.luck ?? 1).toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 日志面板 -->
      <div v-show="activeTab === 'log'" class="tab-panel log-panel">
        <GameLog :height="300" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePlayerStore } from '@/stores/playerStore';
import EquipmentPanel from './EquipmentPanel.vue';
import InventoryPanel from './InventoryPanel.vue';
import GameLog from './GameLog.vue';
import { staminaService } from '@/services/staminaService';

const playerStore = usePlayerStore();

const player = computed(() => playerStore.player);

// 体力和恢复速度
const stamina = computed(() => (playerStore as any).stamina || { current: 0, max: 0 });
const staminaRegenRate = computed(() => staminaService.getStaminaRegenRate());
const energyRegenRate = computed(() => staminaService.getEnergyRegenRate(player.value));

// Tab配置
const tabs = [
  { id: 'equipment', label: '装备' },
  { id: 'inventory', label: '库存' },
  { id: 'stats', label: '属性' },
  { id: 'log', label: '日志' }
];

// 当前激活的Tab，默认显示装备
const activeTab = ref<string>('equipment');
</script>

<style scoped>
.right-sidebar {
  background: #f8f8f7;
  border-left: 1px solid rgba(17, 17, 17, 0.12);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid rgba(17, 17, 17, 0.12);
  background: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.tab-item {
  padding: 10px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  border-right: 1px solid rgba(17, 17, 17, 0.08);
  transition: background 0.15s ease;
  color: rgba(17, 17, 17, 0.55);
}

.tab-item:last-child {
  border-right: none;
}

.tab-item:hover {
  background: rgba(17, 17, 17, 0.05);
  color: rgba(17, 17, 17, 0.8);
}

.tab-item.active {
  background: #fff;
  color: #111;
  box-shadow: inset 0 -2px 0 #111;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tab-panel {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  padding: 14px;
}

.tab-panel.inventory-tab {
  padding: 0;
  border: none;
  background: transparent;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  background: rgba(249, 249, 248, 0.8);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(17, 17, 17, 0.75);
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
  padding-bottom: 4px;
}

.stat-line {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: rgba(17, 17, 17, 0.7);
}

.stat-line span:last-child {
  color: #111;
  font-weight: 600;
}

.log-panel {
  padding: 0;
  border: none;
  background: transparent;
}

.tab-content::-webkit-scrollbar {
  width: 6px;
}

.tab-content::-webkit-scrollbar-track {
  background: rgba(17, 17, 17, 0.05);
}

.tab-content::-webkit-scrollbar-thumb {
  background: rgba(17, 17, 17, 0.2);
  border-radius: 999px;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background: rgba(17, 17, 17, 0.35);
}

@media (max-width: 1200px) {
  .tab-content {
    padding: 14px;
  }

  .stats-summary {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}
</style>

