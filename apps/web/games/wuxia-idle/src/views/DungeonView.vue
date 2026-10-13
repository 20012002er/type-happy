<!--
  地牢挑战主视图
  显示地牢战斗进度、敌人状态和奖励预览
-->
<template>
  <div class="dungeon-view">
    <!-- 顶部：地牢信息 -->
    <div class="dungeon-header">
      <div class="header-left">
        <Castle class="header-icon" />
        <span class="header-title">{{ dungeonName }}</span>
      </div>
      <div class="header-right">
        <span class="wave-progress">{{ waveProgress }}</span>
        <span class="phase-badge" :class="phaseClass">{{ phaseText }}</span>
      </div>
    </div>

    <!-- 中间：战斗区域 -->
    <div class="dungeon-main">
      <!-- 左侧：敌人展示 -->
      <div class="enemies-section">
        <MultiEnemyBattle
          :enemies="currentEnemies"
          :phase="phase"
        />
      </div>

      <!-- 右侧：奖励预览 -->
      <div class="rewards-section">
        <div class="section-title">累积奖励</div>
        <div class="reward-pool">
          <div class="reward-item">
            <Coins class="reward-icon" />
            <span class="reward-value">{{ rewardPool.gold }}</span>
            <span class="reward-label">金币</span>
          </div>
          <div class="reward-item">
            <Sparkle class="reward-icon" />
            <span class="reward-value">{{ rewardPool.exp }}</span>
            <span class="reward-label">经验</span>
          </div>
        </div>
        <div v-if="rewardPool.drops.length > 0" class="drops-list">
          <div class="section-subtitle">掉落物品</div>
          <div v-for="(drop, idx) in rewardPool.drops" :key="idx" class="drop-item">
            {{ drop.name }} ×{{ drop.qty }}
          </div>
        </div>
      </div>
    </div>

    <!-- 底部：操作按钮 -->
    <div class="dungeon-footer">
      <button
        class="action-btn retreat-btn"
        :disabled="!canRetreat"
        @click="handleRetreat"
      >
        <DoorOpen class="btn-icon" /> 撤退（保留50%奖励）
      </button>
    </div>

    <!-- 恢复提示弹窗 -->
    <div v-if="pendingRestore" class="restore-modal">
      <div class="modal-content">
        <div class="modal-title">检测到未完成的挑战</div>
        <div class="modal-desc">
          是否继续之前的地牢挑战？
        </div>
        <div class="modal-actions">
          <button class="modal-btn primary" @click="confirmRestore">
            继续挑战
          </button>
          <button class="modal-btn secondary" @click="abandonRestore">
            放弃（获得50%奖励）
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Castle, Coins, Sparkle, DoorOpen } from 'lucide-vue-next';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import MultiEnemyBattle from '@/components/dungeon/MultiEnemyBattle.vue';

const dungeonStore = useDungeonStore();
const gameLogStore = useGameLogStore();

const phase = computed(() => dungeonStore.phase);
const dungeonName = computed(() => dungeonStore.runState?.dungeonName ?? '地牢');
const waveProgress = computed(() => dungeonStore.currentWaveProgress);
const currentEnemies = computed(() => dungeonStore.currentEnemies);
const rewardPool = computed(() => dungeonStore.rewardPoolPreview);
const pendingRestore = computed(() => dungeonStore.pendingRestore);

const phaseClass = computed(() => {
  switch (phase.value) {
    case 'fighting': return 'phase-fighting';
    case 'between': return 'phase-between';
    case 'settlement': return 'phase-settlement';
    case 'finished': return 'phase-finished';
    case 'failed': return 'phase-failed';
    default: return '';
  }
});

const phaseText = computed(() => {
  switch (phase.value) {
    case 'idle': return '空闲';
    case 'preparing': return '准备中';
    case 'fighting': return '战斗中';
    case 'between': return '波次间隔';
    case 'settlement': return '结算中';
    case 'finished': return '已通关';
    case 'failed': return '挑战失败';
    case 'stopped': return '已撤退';
    default: return '';
  }
});

const canRetreat = computed(() => {
  return ['fighting', 'between', 'preparing'].includes(phase.value);
});

const handleRetreat = () => {
  if (!canRetreat.value) return;
  dungeonStore.abort();
  gameLogStore.addActionLog('撤退地牢挑战');
};

const confirmRestore = () => {
  dungeonStore.confirmRestore();
};

const abandonRestore = () => {
  dungeonStore.abandonRestore();
};

onMounted(() => {
  dungeonStore.restoreFromStorage();
});
</script>

<style scoped>
.dungeon-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8f8f7;
  gap: 16px;
  padding: 18px 20px;
}

.dungeon-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 20px;
  height: 20px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #111;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wave-progress {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.6);
}

.phase-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(17, 17, 17, 0.08);
  color: #111;
}

.phase-fighting {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.phase-between {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.phase-settlement,
.phase-finished {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.phase-failed {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.dungeon-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 16px;
  min-height: 0;
}

.enemies-section {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  padding: 16px;
  overflow: auto;
}

.rewards-section {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  padding: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #111;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.section-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: rgba(17, 17, 17, 0.6);
  margin: 14px 0 8px;
}

.reward-pool {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reward-item {
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
}

.reward-value {
  font-size: 16px;
  font-weight: 600;
  color: #111;
}

.reward-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
}

.drops-list {
  margin-top: 8px;
}

.drop-item {
  font-size: 13px;
  color: #111;
  padding: 6px 0;
  border-bottom: 1px solid rgba(17, 17, 17, 0.05);
}

.drop-item:last-child {
  border-bottom: none;
}

.dungeon-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 12px;
}

.action-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retreat-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.retreat-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.retreat-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
  vertical-align: middle;
  margin-right: 4px;
}

/* 恢复弹窗 */
.restore-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #111;
  margin-bottom: 12px;
}

.modal-desc {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.6);
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modal-btn {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-btn.primary {
  background: #111;
  color: #fff;
}

.modal-btn.primary:hover {
  background: #333;
}

.modal-btn.secondary {
  background: rgba(17, 17, 17, 0.08);
  color: #111;
}

.modal-btn.secondary:hover {
  background: rgba(17, 17, 17, 0.12);
}

@media (max-width: 900px) {
  .dungeon-main {
    grid-template-columns: 1fr;
  }

  .rewards-section {
    order: -1;
  }
}
</style>
