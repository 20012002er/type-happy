<!--
  闯荡江湖主视图（重构版）
  
  设计原则：
  1. 整合地牢 - 地牢进行时替换战斗舞台显示地牢面板
  2. 清晰的视图切换 - 地牢结束后自动返回正常战斗视图
  3. 保持简洁 - 不引入额外的路由或复杂状态
-->
<template>
  <div class="combat-view">
    <!-- 顶部：信息栏 -->
    <div class="combat-header">
      <span class="header-title">{{ headerTitle }}</span>
      <div class="combat-info">
        <div class="info-item">
          <span class="label">等级:</span>
          <span class="value">Lv.{{ player.stats.level }}</span>
        </div>
        <div class="info-item">
          <span class="label">位置:</span>
          <span class="value">{{ currentLocationName }}</span>
        </div>
        <div v-if="!isDungeonActive" class="info-item">
          <span class="label">战绩:</span>
          <span class="value">{{ combatStats.wins }}胜/{{ combatStats.losses }}败</span>
        </div>
      </div>
    </div>

    <!-- 中间：主内容区 -->
    <div class="combat-main">
      <!-- 左侧：地图导航 -->
      <div class="map-section">
        <MapNavigation @view-change="handleViewChange" />
      </div>

      <!-- 右侧：战斗舞台 或 地牢面板 -->
      <div class="arena-section">
        <!-- 地牢进行中时显示地牢面板 -->
        <DungeonPanel 
          v-if="isDungeonActive || hasPendingRestore" 
          @dungeon-end="handleDungeonEnd"
        />
        <!-- 否则显示正常战斗舞台 -->
        <CombatArena v-else />
      </div>
    </div>

    <!-- 底部：配置面板（仅在非地牢时显示） -->
    <div v-if="!isDungeonActive" class="combat-footer">
      <CombatSettings />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Castle, Swords } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/playerStore';
import { useMapStore } from '@/stores/mapStore';
import { useCombatStore } from '@/stores/combatStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import MapNavigation from '@/components/combat/MapNavigation.vue';
import CombatArena from '@/components/combat/CombatArena.vue';
import CombatSettings from '@/components/combat/CombatSettings.vue';
import DungeonPanel from '@/components/DungeonPanel.vue';

const emit = defineEmits<{
  (e: 'quick-nav', target: string): void;
}>();

const playerStore = usePlayerStore();
const mapStore = useMapStore();
const combatStore = useCombatStore();
const dungeonStore = useDungeonStore();

const player = computed(() => playerStore.player);
const currentLocationName = computed(() => mapStore.currentLocation?.name || '未知');
const combatStats = computed(() => combatStore.combatStats);

// 地牢状态
const isDungeonActive = computed(() => {
  const phase = dungeonStore.phase;
  // 活动状态：preparing, fighting, between, settlement
  // 结束状态（需要显示结算弹窗）：finished, failed, stopped
  return phase !== 'idle';
});

const hasPendingRestore = computed(() => !!dungeonStore.pendingRestore);

// 标题
const headerTitle = computed(() => {
  if (isDungeonActive.value && dungeonStore.phase !== 'idle') {
    return `${dungeonStore.runState?.dungeonName ?? '地牢挑战'}`;
  }
  return '闯荡江湖';
});

// 处理视图切换
function handleViewChange(view: string) {
  emit('quick-nav', view);
}

// 处理地牢结束
function handleDungeonEnd() {
  // 地牢结束后，视图会自动切换回正常战斗舞台
  // 因为 isDungeonActive 会变为 false
  console.log('[CombatView] 地牢结束，返回正常视图');
}
</script>

<style scoped>
.combat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8f8f7;
  gap: 16px;
  padding: 18px 20px;
}

.combat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #111;
}

.combat-info {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.info-item .value {
  color: #111;
  font-weight: 600;
}

.combat-main {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(220px, 0.45fr) minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

.map-section,
.arena-section {
  min-height: 0;
}

.map-section {
  display: flex;
}

.map-section > * {
  flex: 1;
  border-radius: 14px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: #fff;
  padding: 12px 14px;
}

.arena-section {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.combat-footer {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.1);
  border-radius: 12px;
  padding: 12px 14px;
  max-height: 260px;
  overflow-y: auto;
}

@media (max-width: 1100px) {
  .combat-main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .map-section {
    order: 1;
  }

  .arena-section {
    order: 2;
  }
}
</style>
