<!--
  竖向地图导航组件
  用于显示当前位置和可到达的地点
  支持多地图切换（预留功能）
-->
<template>
  <div class="map-navigation">
    <div class="nav-title">地图导航</div>
    
    <!-- 地图选择（预留 - 当前只有一个地图） -->
    <div v-if="false" class="map-selector">
      <select class="map-select">
        <option value="main">主世界</option>
        <option value="dungeon">秘境</option>
      </select>
    </div>
    
    <!-- 当前位置（紧凑布局） -->
    <div v-if="currentLocation" class="current-location">
      <div class="location-header">
        <MapPin class="location-icon" />
        <span class="location-name">{{ currentLocation.name }}</span>
      </div>
      
      <!-- 地点信息（单行显示） -->
      <div v-if="currentLocation.idle" class="location-stats-compact">
        <span class="stat-compact">{{ getDifficultyText(currentLocation.idle.difficulty) }}</span>
        <span v-if="currentLocation.requirements?.minLevel" class="stat-compact">Lv.{{ currentLocation.requirements.minLevel }}+</span>
      </div>
    </div>

    <!-- 地牢入口 -->
    <div v-if="hasDungeons" class="dungeons-section">
      <div class="section-title"><Castle class="section-icon" /> 地牢入口</div>
      <div class="dungeons-list">
        <button
          v-for="dungeon in availableDungeons"
          :key="dungeon.id"
          class="dungeon-item"
          :class="{ locked: !dungeon.canEnter }"
          :disabled="!dungeon.canEnter || isDungeonRunning"
          @click="handleEnterDungeon(dungeon.id)"
        >
          <div class="dungeon-main">
            <span class="dungeon-name">{{ dungeon.name }}</span>
            <span class="dungeon-level" :class="getLevelClass(dungeon)">Lv.{{ dungeon.recommendLevel }}</span>
          </div>
          <div class="dungeon-meta">
            <span class="dungeon-waves">{{ dungeon.waveCount }}波</span>
            <span v-if="dungeon.entryCost.stamina" class="dungeon-cost">体力{{ dungeon.entryCost.stamina }}</span>
          </div>
        </button>
      </div>
    </div>
    
    <!-- 可达地点列表 -->
    <div class="destinations-section">
      <div class="section-title">可前往</div>
      <div class="destinations-list">
        <button
          v-for="location in availableDestinations"
          :key="location.id"
          class="destination-item"
          :class="{ locked: !canTravel(location) }"
          :disabled="!canTravel(location)"
          @click="handleTravel(location.id)"
        >
          <div class="dest-main">
            <span class="dest-name">{{ location.name }}</span>
          </div>
          <div class="dest-meta">
            <span v-if="location.idle" class="dest-difficulty">{{ getDifficultyText(location.idle.difficulty) }}</span>
            <span v-if="location.requirements?.minLevel" class="dest-requirement">Lv.{{ location.requirements.minLevel }}+</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { MapPin, Castle } from 'lucide-vue-next';
import { useMapStore } from '@/stores/mapStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { DungeonConfigService } from '@/services/config/DungeonConfigService';
import type { Location } from '@/types/map';
import type { DungeonConfig } from '@/types/dungeon';

interface DungeonEntry {
  id: string;
  name: string;
  recommendLevel: number;
  waveCount: number;
  entryCost: DungeonConfig['entryCost'];
  canEnter: boolean;
}

const emit = defineEmits<{
  (e: 'view-change', view: string): void;
}>();

const mapStore = useMapStore();
const playerStore = usePlayerStore();
const gameLogStore = useGameLogStore();
const dungeonStore = useDungeonStore();

const currentLocation = computed(() => mapStore.currentLocation);
const availableDestinations = computed(() => mapStore.availableDestinations);
const playerLevel = computed(() => playerStore.player.stats.level);
const isDungeonRunning = computed(() => dungeonStore.isRunning);

// 地牢列表
const availableDungeons = ref<DungeonEntry[]>([]);
const hasDungeons = computed(() => availableDungeons.value.length > 0);

/**
 * 加载当前地点的地牢
 */
async function loadDungeons() {
  availableDungeons.value = [];
  
  const location = currentLocation.value;
  if (!location?.dungeonIds?.length) return;

  const entries: DungeonEntry[] = [];

  for (const dungeonId of location.dungeonIds) {
    const config = await DungeonConfigService.getDungeon(dungeonId);
    if (!config) continue;

    const unlockCheck = DungeonConfigService.checkUnlockCondition(
      config,
      playerLevel.value
    );

    let canEnter = unlockCheck.unlocked;

    // 检查体力
    if (canEnter && config.entryCost.stamina) {
      const runtimePlayer = playerStore.player as any;
      const currentStamina = Math.floor(runtimePlayer?.stamina?.current ?? 0);
      if (currentStamina < config.entryCost.stamina) {
        canEnter = false;
      }
    }

    entries.push({
      id: config.id,
      name: config.name,
      recommendLevel: config.recommendLevel,
      waveCount: config.waves.length,
      entryCost: config.entryCost,
      canEnter
    });
  }

  availableDungeons.value = entries;
}

/**
 * 检查是否可以前往某地点
 */
function canTravel(location: Location): boolean {
  const minLevel = location.requirements?.minLevel || 0;
  return playerStore.player.stats.level >= minLevel;
}

/**
 * 处理旅行
 */
function handleTravel(locationId: string): void {
  const result = mapStore.travelTo(locationId);
  if (result.success) {
    gameLogStore.addSystemLog(result.message);
    if (result.eventMessage) {
      gameLogStore.addInfoLog(result.eventMessage);
    }
  } else {
    gameLogStore.addErrorLog(result.message);
  }
}

/**
 * 进入地牢
 */
async function handleEnterDungeon(dungeonId: string) {
  const result = await dungeonStore.enter(dungeonId);
  if (result.success) {
    gameLogStore.addActionLog(result.message);
    // 地牢面板会在 CombatView 内自动显示，无需切换视图
  } else {
    gameLogStore.addErrorLog(result.message);
  }
}

/**
 * 获取等级样式类
 */
function getLevelClass(dungeon: DungeonEntry) {
  if (playerLevel.value < dungeon.recommendLevel - 5) return 'level-danger';
  if (playerLevel.value < dungeon.recommendLevel) return 'level-warning';
  return 'level-safe';
}

/**
 * 获取难度文字描述
 */
function getDifficultyText(difficulty: number): string {
  if (difficulty <= 0.5) return '★☆☆☆☆';
  if (difficulty <= 1.0) return '★★☆☆☆';
  if (difficulty <= 1.5) return '★★★☆☆';
  if (difficulty <= 2.0) return '★★★★☆';
  return '★★★★★';
}

onMounted(() => {
  loadDungeons();
});

// 监听地点变化
watch(() => currentLocation.value?.id, () => {
  loadDungeons();
});
</script>

<style scoped>
.map-navigation {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.nav-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.78);
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.1);
  text-align: left;
}

/* 地图选择器（预留） */
.map-selector {
  margin-bottom: var(--spacing-sm);
}

.map-select {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: var(--border-width-thin) solid var(--color-border-medium);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.map-select:focus {
  outline: none;
  border-color: var(--color-border-dark);
}

/* 当前位置（紧凑布局） */
.current-location {
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: rgba(249, 249, 248, 0.7);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.location-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.location-icon {
  font-size: var(--font-size-base);
}

.location-name {
  font-size: 13px;
  font-weight: 600;
  color: #111;
}

/* 单行紧凑统计 */
.location-stats-compact {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.55);
}

.stat-compact {
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.1);
  background: #fff;
}

/* 地牢入口区域 */
.dungeons-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dungeons-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dungeon-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 10px;
  border: 1px solid rgba(234, 179, 8, 0.3);
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.05) 0%, #fff 100%);
  padding: 10px 12px;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;
}

.dungeon-item:hover:not(:disabled) {
  border-color: rgba(234, 179, 8, 0.6);
  transform: translateY(-1px);
}

.dungeon-item.locked,
.dungeon-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dungeon-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dungeon-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #111;
}

.dungeon-level {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.dungeon-level.level-safe {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.dungeon-level.level-warning {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.dungeon-level.level-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.dungeon-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.55);
}

.dungeon-waves,
.dungeon-cost {
  padding: 2px 4px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 4px;
}

/* 可达地点列表（紧凑布局） */
.destinations-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.7);
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.destinations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 4px;
  padding-top: 2px;
  min-height: 0;
}

.destinations-list::-webkit-scrollbar {
  width: 6px;
}

.destinations-list::-webkit-scrollbar-track {
  background: rgba(17, 17, 17, 0.05);
  border-radius: 999px;
}

.destinations-list::-webkit-scrollbar-thumb {
  background: rgba(17, 17, 17, 0.25);
  border-radius: 999px;
}

/* 两行按钮布局（无图标） */
.destination-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: #fff;
  padding: 10px 12px;
  text-align: left;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.destination-item:hover:not(:disabled) {
  border-color: rgba(17, 17, 17, 0.3);
  transform: translateY(-1px);
}

.destination-item:active:not(:disabled) {
  background: var(--color-black);
  color: var(--color-white);
}

.destination-item.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.destination-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 第一行：地点名称 */
.dest-main {
  display: flex;
  align-items: center;
}

.dest-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #111;
  word-break: keep-all;
  white-space: nowrap;
}

/* 第二行：难度和等级要求 */
.dest-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: rgba(17, 17, 17, 0.55);
}

.dest-difficulty,
.dest-requirement {
  padding: 2px 4px;
  background: var(--color-bg-secondary);
  border: var(--border-width-thin) solid var(--color-border-light);
  white-space: nowrap;
}
</style>
