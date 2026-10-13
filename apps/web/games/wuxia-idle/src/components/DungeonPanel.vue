<!--
  地牢挑战面板（重构版）
  
  设计原则：
  1. 单一入口 - 这是地牢系统的唯一 UI 组件
  2. 状态驱动 - 根据 dungeonStore.phase 显示不同内容
  3. 清晰的用户流程 - 空闲 -> 战斗中 -> 结算 -> 返回
-->
<template>
  <div class="dungeon-panel">
    <!-- 空闲状态：显示提示 -->
    <div v-if="phase === 'idle' && !pendingRestore" class="dungeon-idle">
      <div class="idle-message">
        <Castle class="idle-icon" />
        <p>当前未在地牢中</p>
        <p class="idle-hint">在地图导航中选择地牢入口开始挑战</p>
      </div>
    </div>

    <!-- 恢复提示 -->
    <div v-else-if="pendingRestore" class="dungeon-restore">
      <div class="restore-card">
        <h3>检测到未完成的挑战</h3>
        <p>地牢：{{ pendingRestore.dungeonName }}</p>
        <p>进度：第 {{ pendingRestore.waveIndex + 1 }} / {{ pendingRestore.totalWaves }} 波</p>
        <div class="restore-actions">
          <button class="btn-primary" @click="handleConfirmRestore">继续挑战</button>
          <button class="btn-secondary" @click="handleAbandonRestore">放弃（获得50%奖励）</button>
        </div>
      </div>
    </div>

    <!-- 地牢进行中 -->
    <div v-else-if="isActive" class="dungeon-active">
      <!-- 顶部信息栏 -->
      <div class="dungeon-header">
        <div class="dungeon-title">
          <Castle class="dungeon-icon" />
          <span class="dungeon-name">{{ runState?.dungeonName }}</span>
        </div>
        <div class="header-right">
          <span class="phase-badge" :class="phaseClass">{{ phaseText }}</span>
        </div>
      </div>

      <!-- 战斗舞台 -->
      <div class="battle-area">
        <BattleArena
          :player="playerBattleState"
          :enemies="currentEnemies"
          :phase="phase"
          :wave-progress="currentWaveProgress"
        />
      </div>

      <!-- 底部：奖励预览 + 操作按钮 -->
      <div class="dungeon-footer">
        <!-- 奖励预览 -->
        <div class="reward-preview">
          <div class="reward-title">累积奖励</div>
          <div class="reward-items">
            <span class="reward-item"><Coins class="reward-icon" /> {{ rewardPoolPreview.gold }}</span>
            <span class="reward-item"><Sparkles class="reward-icon" /> {{ rewardPoolPreview.exp }}</span>
            <span v-if="rewardPoolPreview.drops.length > 0" class="reward-item">
              <Package class="reward-icon" /> {{ rewardPoolPreview.drops.length }}件
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="dungeon-actions">
          <button
            v-if="canRetreat"
            class="btn-danger"
            :disabled="isAborting"
            @click="handleAbort"
          >
            <template v-if="isAborting">
              <Hourglass class="btn-spinner" /> 撤退中...
            </template>
            <template v-else>
              <DoorOpen /> 撤退（获得50%奖励）
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- 结算弹窗 -->
    <DungeonSettlementModal
      v-if="showSettlement"
      :visible="showSettlement"
      :result="settlementResult"
      :dungeon-name="settlementData.dungeonName"
      :waves-cleared="settlementData.wavesCleared"
      :total-waves="settlementData.totalWaves"
      :duration="settlementData.duration"
      :rewards="settlementData.rewards"
      @close="handleCloseSettlement"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useDungeonStore } from '@/stores/dungeonStore';
import { Coins, Sparkles, Package, Hourglass, DoorOpen, Castle } from 'lucide-vue-next';
import BattleArena from '@/components/dungeon/BattleArena.vue';
import DungeonSettlementModal from '@/components/dungeon/DungeonSettlementModal.vue';
import type { DungeonResult, RewardPool, DungeonPhase } from '@/types/dungeon';

const emit = defineEmits<{
  (e: 'dungeon-end'): void;
}>();

const dungeonStore = useDungeonStore();

// Store 状态
const runState = computed(() => dungeonStore.runState);
const phase = computed(() => dungeonStore.phase);
const currentWaveProgress = computed(() => dungeonStore.currentWaveProgress);
const currentEnemies = computed(() => dungeonStore.currentEnemies);
const rewardPoolPreview = computed(() => dungeonStore.rewardPoolPreview);
const pendingRestore = computed(() => dungeonStore.pendingRestore);
const isAborting = computed(() => dungeonStore.isAborting);
const playerBattleState = computed(() => dungeonStore.playerBattleState);

// 是否处于活动状态（非空闲、非结束）
const isActive = computed(() => {
  const p = phase.value;
  return p !== 'idle' && p !== 'finished' && p !== 'failed' && p !== 'stopped';
});

// 是否可以撤退
const canRetreat = computed(() => {
  return ['preparing', 'fighting', 'between'].includes(phase.value);
});

// 阶段样式
const phaseClass = computed(() => {
  switch (phase.value) {
    case 'fighting': return 'phase-fighting';
    case 'between': return 'phase-between';
    case 'settlement': return 'phase-settlement';
    default: return '';
  }
});

// 阶段文字
const phaseText = computed(() => {
  switch (phase.value) {
    case 'preparing': return '准备中';
    case 'fighting': return '战斗中';
    case 'between': return '波次间隔';
    case 'settlement': return '结算中';
    default: return '';
  }
});

// 结算弹窗状态
const showSettlement = ref(false);
const settlementResult = ref<DungeonResult>('cleared');
const settlementData = ref({
  dungeonName: '',
  wavesCleared: 0,
  totalWaves: 0,
  duration: 0,
  rewards: { gold: 0, exp: 0, drops: [] } as RewardPool
});

// 监听阶段变化，显示结算弹窗
watch(phase, (newPhase, oldPhase) => {
  // 从活动状态变为结束状态时显示结算
  const endPhases: DungeonPhase[] = ['finished', 'failed', 'stopped'];
  const activePhases: DungeonPhase[] = ['preparing', 'fighting', 'between', 'settlement'];
  
  if (endPhases.includes(newPhase) && activePhases.includes(oldPhase)) {
    // 保存结算数据
    settlementResult.value = newPhase === 'finished' ? 'cleared' : 
                             newPhase === 'failed' ? 'failed' : 'aborted';
    settlementData.value = {
      dungeonName: runState.value?.dungeonName ?? '',
      wavesCleared: runState.value?.waveIndex ?? 0,
      totalWaves: runState.value?.totalWaves ?? 0,
      duration: Date.now() - (runState.value?.startTime ?? Date.now()),
      rewards: { ...rewardPoolPreview.value }
    };
    showSettlement.value = true;
  }
});

// 操作处理
function handleAbort() {
  if (!isAborting.value) {
    dungeonStore.abort();
  }
}

function handleConfirmRestore() {
  dungeonStore.confirmRestore();
}

function handleAbandonRestore() {
  dungeonStore.abandonRestore();
}

function handleCloseSettlement() {
  showSettlement.value = false;
  dungeonStore.confirmEnd();
  // 通知父组件地牢结束
  emit('dungeon-end');
}

// 初始化时检查恢复
onMounted(() => {
  dungeonStore.restoreFromStorage();
});
</script>

<style scoped>
.dungeon-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 空闲状态 */
.dungeon-idle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.idle-message {
  text-align: center;
  color: rgba(17, 17, 17, 0.5);
}

.idle-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

.idle-hint {
  font-size: 13px;
  margin-top: 8px;
}

/* 恢复提示 */
.dungeon-restore {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
}

.restore-card {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  max-width: 400px;
}

.restore-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #111;
}

.restore-card p {
  margin: 8px 0;
  color: rgba(17, 17, 17, 0.7);
  font-size: 14px;
}

.restore-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: center;
}

/* 活动状态 */
.dungeon-active {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dungeon-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, #fff 100%);
  border-bottom: 1px solid rgba(234, 179, 8, 0.2);
}

.dungeon-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dungeon-icon {
  font-size: 20px;
}

.dungeon-name {
  font-size: 16px;
  font-weight: 600;
  color: #111;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.phase-badge {
  font-size: 11px;
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

.phase-settlement {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

/* 战斗区域 */
.battle-area {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* 底部 */
.dungeon-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

/* 奖励预览 */
.reward-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reward-title {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.5);
}

.reward-items {
  display: flex;
  gap: 12px;
}

.reward-item {
  font-size: 13px;
  font-weight: 500;
  color: #111;
  display: flex;
  align-items: center;
  gap: 4px;
}

.reward-icon {
  width: 14px;
  height: 14px;
  color: rgba(17, 17, 17, 0.6);
}

/* 操作按钮 */
.dungeon-actions {
  display: flex;
  gap: 8px;
}

/* 按钮样式 */
.btn-primary {
  padding: 10px 20px;
  background: #111;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  padding: 10px 20px;
  background: #fff;
  color: #111;
  border: 1px solid rgba(17, 17, 17, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s;
}

.btn-secondary:hover {
  border-color: rgba(17, 17, 17, 0.4);
}

.btn-danger {
  padding: 10px 16px;
  background: #fff;
  color: #dc2626;
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.05);
  border-color: rgba(220, 38, 38, 0.5);
}

.btn-danger:disabled {
  opacity: 0.7;
  cursor: wait;
  color: rgba(220, 38, 38, 0.7);
}

.btn-spinner {
  width: 14px;
  height: 14px;
  animation: spin 1s linear infinite;
  color: inherit;
}

.btn-danger :deep(svg) {
  width: 14px;
  height: 14px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
