<!--
  地牢入口面板
  显示当前地点可进入的地牢列表
-->
<template>
  <div class="dungeon-entry-panel">
    <div class="panel-header">
      <Castle class="header-icon" />
      <span class="header-title">地牢入口</span>
    </div>

    <div v-if="loading" class="loading-state">
      加载中...
    </div>

    <div v-else-if="dungeons.length === 0" class="empty-state">
      当前地点没有可进入的地牢
    </div>

    <div v-else class="dungeon-list">
      <div
        v-for="dungeon in dungeons"
        :key="dungeon.id"
        class="dungeon-card"
        :class="{ 'locked': !dungeon.canEnter }"
      >
        <div class="dungeon-header">
          <span class="dungeon-name">{{ dungeon.name }}</span>
          <span class="dungeon-level" :class="getLevelClass(dungeon)">
            Lv.{{ dungeon.recommendLevel }}
          </span>
        </div>

        <div class="dungeon-desc">{{ dungeon.description }}</div>

        <div class="dungeon-info">
          <div class="info-row">
            <span class="info-label">波次:</span>
            <span class="info-value">{{ dungeon.waveCount }} 波</span>
          </div>
          <div class="info-row">
            <span class="info-label">消耗:</span>
            <span class="info-value">{{ formatCost(dungeon.entryCost) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">奖励:</span>
            <span class="info-value">
              金币×{{ dungeon.reward.goldMultiplier }} 经验×{{ dungeon.reward.expMultiplier }}
            </span>
          </div>
        </div>

        <div v-if="!dungeon.canEnter" class="warning-msg">
          <AlertTriangle class="warning-icon" /> {{ dungeon.lockReason }}
        </div>

        <div v-else-if="dungeon.isUnderLevel" class="warning-msg warning">
          <AlertTriangle class="warning-icon" /> 等级低于推荐等级，挑战难度较高
        </div>

        <button
          class="enter-btn"
          :disabled="!dungeon.canEnter || isRunning"
          @click="enterDungeon(dungeon.id)"
        >
          {{ isRunning ? '挑战中...' : '进入挑战' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMapStore } from '@/stores/mapStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { AlertTriangle, Castle } from 'lucide-vue-next';
import { DungeonConfigService } from '@/services/config/DungeonConfigService';
import type { DungeonConfig } from '@/types/dungeon';

interface DungeonEntry {
  id: string;
  name: string;
  description: string;
  recommendLevel: number;
  waveCount: number;
  entryCost: DungeonConfig['entryCost'];
  reward: DungeonConfig['reward'];
  canEnter: boolean;
  lockReason?: string;
  isUnderLevel: boolean;
}

const mapStore = useMapStore();
const playerStore = usePlayerStore();
const dungeonStore = useDungeonStore();
const gameLogStore = useGameLogStore();

const loading = ref(true);
const dungeons = ref<DungeonEntry[]>([]);

const isRunning = computed(() => dungeonStore.isRunning);
const playerLevel = computed(() => playerStore.player.stats.level);

const loadDungeons = async () => {
  loading.value = true;
  dungeons.value = [];

  const location = mapStore.currentLocation;
  if (!location?.dungeonIds?.length) {
    loading.value = false;
    return;
  }

  const entries: DungeonEntry[] = [];

  for (const dungeonId of location.dungeonIds) {
    const config = await DungeonConfigService.getDungeon(dungeonId);
    if (!config) continue;

    const unlockCheck = DungeonConfigService.checkUnlockCondition(
      config,
      playerLevel.value
    );

    // 检查体力
    let canEnter = unlockCheck.unlocked;
    let lockReason = unlockCheck.reason;

    if (canEnter && config.entryCost.stamina) {
      const runtimePlayer = playerStore.player as any;
      const currentStamina = Math.floor(runtimePlayer?.stamina?.current ?? 0);
      if (currentStamina < config.entryCost.stamina) {
        canEnter = false;
        lockReason = `体力不足（需要 ${config.entryCost.stamina}）`;
      }
    }

    if (canEnter && config.entryCost.gold) {
      const currentGold = playerStore.player.resources.gold;
      if (currentGold < config.entryCost.gold) {
        canEnter = false;
        lockReason = `金币不足（需要 ${config.entryCost.gold}）`;
      }
    }

    entries.push({
      id: config.id,
      name: config.name,
      description: config.description ?? '',
      recommendLevel: config.recommendLevel,
      waveCount: config.waves.length,
      entryCost: config.entryCost,
      reward: config.reward,
      canEnter,
      lockReason,
      isUnderLevel: playerLevel.value < config.recommendLevel
    });
  }

  dungeons.value = entries;
  loading.value = false;
};

const formatCost = (cost: DungeonConfig['entryCost']): string => {
  const parts: string[] = [];
  if (cost.stamina) parts.push(`体力 ${cost.stamina}`);
  if (cost.gold) parts.push(`金币 ${cost.gold}`);
  if (cost.ticketItemId) parts.push('入场券');
  return parts.length > 0 ? parts.join(', ') : '无';
};

const getLevelClass = (dungeon: DungeonEntry) => {
  if (playerLevel.value < dungeon.recommendLevel - 5) return 'level-danger';
  if (playerLevel.value < dungeon.recommendLevel) return 'level-warning';
  return 'level-safe';
};

const enterDungeon = async (dungeonId: string) => {
  const result = await dungeonStore.enter(dungeonId);
  if (result.success) {
    gameLogStore.addActionLog(result.message);
  } else {
    gameLogStore.addErrorLog(result.message);
  }
};

onMounted(() => {
  loadDungeons();
});

// 监听地点变化
watch(() => mapStore.currentLocation?.id, () => {
  loadDungeons();
});
</script>

<style scoped>
.dungeon-entry-panel {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 12px;
  padding: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.header-icon {
  font-size: 18px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #111;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 24px;
  color: rgba(17, 17, 17, 0.5);
  font-size: 14px;
}

.dungeon-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dungeon-card {
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  padding: 14px;
  transition: all 0.2s ease;
}

.dungeon-card:hover:not(.locked) {
  border-color: rgba(17, 17, 17, 0.25);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.dungeon-card.locked {
  opacity: 0.7;
  background: rgba(17, 17, 17, 0.02);
}

.dungeon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dungeon-name {
  font-size: 15px;
  font-weight: 600;
  color: #111;
}

.dungeon-level {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.level-safe {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.level-warning {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.level-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.dungeon-desc {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
  margin-bottom: 12px;
  line-height: 1.5;
}

.dungeon-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.info-label {
  color: rgba(17, 17, 17, 0.5);
  min-width: 40px;
}

.info-value {
  color: #111;
}

.warning-msg {
  font-size: 12px;
  color: #dc2626;
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.warning-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.warning-msg.warning {
  color: #ca8a04;
  background: rgba(234, 179, 8, 0.05);
}

.enter-btn {
  width: 100%;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: #111;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.enter-btn:hover:not(:disabled) {
  background: #333;
}

.enter-btn:disabled {
  background: rgba(17, 17, 17, 0.3);
  cursor: not-allowed;
}
</style>
