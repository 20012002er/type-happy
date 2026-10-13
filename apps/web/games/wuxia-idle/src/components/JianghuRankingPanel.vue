<template>
  <div class="jianghu-ranking-panel">
    <header class="panel-header">
      <div class="panel-title">
        <h1>江湖榜</h1>
        <p>武无第二，江湖榜记录天下高手的排名</p>
      </div>
    </header>

    <!-- 排行榜选择 -->
    <section class="ranking-tabs">
      <button
        v-for="tier in rankingTiers"
        :key="tier.type"
        class="ranking-tab"
        :class="{ active: selectedTier === tier.type }"
        @click="selectedTier = tier.type"
      >
        <span class="tier-name">{{ tier.name }}</span>
        <span class="tier-count"
          >{{ rankingStore.getRanking(tier.type).length }}/{{ tier.maxEntries }}</span
        >
      </button>
    </section>

    <!-- 玩家排名信息 -->
    <section
      class="player-info-section"
      v-if="currentConfig"
    >
      <div class="player-rank-card">
        <div class="player-rank-header">
          <span class="player-label">你的排名</span>
          <span
            class="player-status-badge"
            :class="playerStatusClass"
          >
            {{ playerStatusText }}
          </span>
        </div>
        <div class="player-rank-value">
          {{ playerRank !== undefined ? `第 ${playerRank} 名` : '未上榜' }}
        </div>
        <div class="player-stats">
          <div class="stat-item">
            <span class="stat-label">今日挑战</span>
            <span class="stat-value">{{ playerInfo.dailyChallengesRemaining }} 次</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最低等级</span>
            <span class="stat-value">{{ currentConfig.minLevel }} 级</span>
          </div>
        </div>
        <button
          class="challenge-btn"
          :disabled="!canChallenge.can"
          @click="handleChallenge"
        >
          {{ canChallenge.can ? '发起挑战' : canChallenge.reason }}
        </button>
      </div>
    </section>

    <!-- 榜单列表 -->
    <section class="ranking-list-section">
      <div class="ranking-header">
        <span class="rank-col">排名</span>
        <span class="change-col">变化</span>
        <span class="name-col">姓名</span>
        <span class="level-col">等级</span>
        <span class="combat-col">战力</span>
        <span class="status-col">状态</span>
      </div>
      <div class="ranking-entries">
        <div
          v-for="entry in currentRanking"
          :key="entry.id"
          class="ranking-entry"
          :class="{
            'entry-player': entry.id === playerId,
            'entry-challengeable': canChallenge.can && entry.id !== playerId,
            'entry-selected': selectedTarget?.id === entry.id,
          }"
          @click="handleEntryClick(entry)"
        >
          <span class="rank-col">
            <span
              class="rank-badge"
              :class="getRankBadgeClass(entry.rank)"
              >{{ entry.rank }}</span
            >
          </span>
          <span class="change-col">
            <span
              v-if="entry.rankChange !== undefined && entry.rankChange !== 0"
              class="rank-change"
              :class="getRankChangeClass(entry.rankChange)"
            >
              {{ getRankChangeDisplay(entry.rankChange) }}
            </span>
            <span
              v-else
              class="rank-change no-change"
              >-</span
            >
          </span>
          <span class="name-col">{{ entry.name }}</span>
          <span class="level-col">{{ entry.level }} 级</span>
          <span class="combat-col">{{ formatCombatPower(entry.combatPower) }}</span>
          <span class="status-col">
            <span
              class="status-badge"
              :class="entry.status"
              >{{ entry.status }}</span
            >
          </span>
        </div>
        <div
          v-if="currentRanking.length === 0"
          class="empty-ranking"
        >
          <p>暂无榜单数据</p>
        </div>
      </div>
    </section>

    <!-- 挑战记录 -->
    <section class="challenge-history-section">
      <h2 class="section-title">挑战统计</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <Swords class="stat-icon" />
          <span class="stat-number">{{ rankingStore.stats.totalChallengers }}</span>
          <span class="stat-label">总挑战次数</span>
        </div>
        <div class="stat-card">
          <Check class="stat-icon" />
          <span class="stat-number">{{ rankingStore.stats.totalWins }}</span>
          <span class="stat-label">胜利次数</span>
        </div>
        <div class="stat-card">
          <X class="stat-icon" />
          <span class="stat-number">{{ rankingStore.stats.totalLosses }}</span>
          <span class="stat-label">失败次数</span>
        </div>
        <div class="stat-card">
          <BarChart3 class="stat-icon" />
          <span class="stat-number">{{ (rankingStore.stats.winRate * 100).toFixed(0) }}%</span>
          <span class="stat-label">胜率</span>
        </div>
      </div>
    </section>

    <!-- 挑战确认弹窗 -->
    <CommonModal
      v-model="showModal"
      :title="getModalTitle()"
      :icon="getModalIcon()"
      :width="480"
      :show-footer="!isChallenging && !challengeResult"
      :show-confirm="false"
      :show-cancel="false"
      @close="closeModal"
    >
      <template #default>
        <!-- 挑战中状态 -->
        <div
          v-if="isChallenging"
          class="challenge-progress"
        >
          <div class="challenge-animation">
            <Swords class="swords-cross" />
            <p>正在与 {{ selectedTarget?.name }} 交战...</p>
          </div>
        </div>

        <!-- 挑战结果 -->
        <div
          v-else-if="challengeResult"
          class="challenge-result"
        >
          <div
            class="result-icon"
            :class="challengeResult.result === 'victory' ? 'victory' : 'defeat'"
          >
            <Check v-if="challengeResult.result === 'victory'" class="result-check-icon" />
            <X v-else class="result-x-icon" />
          </div>
          <h4>{{ challengeResult.result === 'victory' ? '挑战成功！' : '挑战失败' }}</h4>
          <p class="result-log">{{ challengeResult.log }}</p>
          <div
            v-if="challengeResult.newRank"
            class="result-rank"
          >
            {{
              challengeResult.result === 'victory'
                ? `升至第 ${challengeResult.newRank} 名`
                : `保持第 ${challengeResult.oldRank} 名`
            }}
          </div>
        </div>

        <!-- 确认信息 -->
        <div
          v-else
          class="challenge-confirm"
        >
          <div class="target-info">
            <div class="target-avatar">
              {{ selectedTarget?.name?.charAt(0) || '?' }}
            </div>
            <div class="target-details">
              <h4>{{ selectedTarget?.name }}</h4>
              <p>{{ selectedTarget?.level }} 级 | {{ selectedTarget?.sect || '无门派' }}</p>
              <p>战力: {{ formatCombatPower(selectedTarget?.combatPower || 0) }}</p>
              <p>当前排名: 第 {{ selectedTarget?.rank }} 名</p>
            </div>
          </div>
          <div class="challenge-warning">
            <p><AlertTriangle class="warning-icon" /> 挑战失败可能会导致排名下降</p>
            <p>剩余挑战次数: {{ playerInfo.dailyChallengesRemaining }} 次</p>
          </div>
        </div>
      </template>

      <template #footer>
        <!-- 确认状态的按钮 -->
        <div v-if="!isChallenging && !challengeResult" class="modal-actions">
          <button
            class="modal-btn secondary"
            @click="closeModal"
          >
            取消
          </button>
          <button
            class="modal-btn primary"
            :disabled="playerInfo.dailyChallengesRemaining <= 0"
            @click="confirmChallenge"
          >
            开始挑战
          </button>
        </div>
        <!-- 挑战结果状态的按钮 -->
        <div v-else-if="challengeResult" class="modal-actions">
          <button
            class="modal-btn primary"
            @click="closeModal"
          >
            确定
          </button>
        </div>
      </template>
    </CommonModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Swords, Trophy, Skull, HandFist, Check, X, BarChart3, AlertTriangle } from 'lucide-vue-next';
import { useJianghuRankingStore } from '@/stores/jianghuRankingStore';
import { usePlayerStore } from '@/stores/playerStore';
import { RankingType, type RankingEntry, type RankingConfig } from '@/types/jianghuRanking';
import CommonModal from './common/CommonModal.vue';

const rankingStore = useJianghuRankingStore();
const playerStore = usePlayerStore();

const selectedTier = ref<RankingType>(RankingType.玄榜);

// Modal state
const showModal = ref(false);
const selectedTarget = ref<RankingEntry | null>(null);
const isChallenging = ref(false);
const challengeResult = ref<{
  result: string;
  oldRank: number;
  newRank?: number;
  log: string;
} | null>(null);

const playerId = computed(() => playerStore.player.id);

const rankingTiers: { type: RankingType; name: string; maxEntries: number }[] = [
  { type: RankingType.天榜, name: '天榜', maxEntries: 20 },
  { type: RankingType.地榜, name: '地榜', maxEntries: 40 },
  { type: RankingType.玄榜, name: '玄榜', maxEntries: 30 },
];

const currentConfig = computed(() => rankingStore.getConfig(selectedTier.value));

const currentRanking = computed(() => rankingStore.getRanking(selectedTier.value));

const playerInfo = computed(() => rankingStore.getPlayerInfo(selectedTier.value));

const playerRank = computed(() => {
  const rank = rankingStore.getPlayerRank(selectedTier.value, playerId.value);
  return rank;
});

const canChallenge = computed(() => {
  return rankingStore.canChallenge
    ? rankingStore.canChallenge(selectedTier.value)
    : { can: false, reason: '系统初始化中' };
});

const playerStatusClass = computed(() => {
  if (playerRank.value !== undefined) return 'on-rank';
  if (playerStore.player.stats.level < (currentConfig.value?.minLevel || 0)) return 'level-too-low';
  return 'not-on-rank';
});

const playerStatusText = computed(() => {
  if (playerRank.value !== undefined) return '在榜';
  if (playerStore.player.stats.level < (currentConfig.value?.minLevel || 0)) return '等级不足';
  return '未上榜';
});

function getRankBadgeClass(rank: number): string {
  if (rank === 1) return 'rank-gold';
  if (rank <= 3) return 'rank-silver';
  if (rank <= 10) return 'rank-bronze';
  return 'rank-normal';
}

function getRankChangeDisplay(change: number): string {
  if (change > 0) return `↑${change}`;
  if (change < 0) return `${change}`;
  return '-';
}

function getRankChangeClass(change: number): string {
  if (change > 0) return 'change-up';
  if (change < 0) return 'change-down';
  return 'no-change';
}

function formatCombatPower(power: number): string {
  if (power >= 10000) {
    return (power / 10000).toFixed(1) + 'w';
  }
  if (power >= 1000) {
    return (power / 1000).toFixed(1) + 'k';
  }
  return power.toString();
}

function getModalTitle(): string {
  if (isChallenging.value) return '挑战中...';
  if (challengeResult.value) {
    return challengeResult.value.result === 'victory' ? '挑战成功' : '挑战失败';
  }
  return '挑战确认';
}

function getModalIcon() {
  if (isChallenging.value) return Swords;
  if (challengeResult.value) {
    return challengeResult.value.result === 'victory' ? Trophy : Skull;
  }
  return HandFist;
}

function handleEntryClick(entry: RankingEntry) {
  if (entry.id === playerId.value) return;
  // Open challenge modal
  selectedTarget.value = entry;
  challengeResult.value = null;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  selectedTarget.value = null;
  challengeResult.value = null;
  isChallenging.value = false;
}

async function handleChallenge() {
  const ranking = currentRanking.value;
  const playerPos = ranking.findIndex(e => e.id === playerId.value);

  let targetEntry;
  if (playerPos >= 0 && playerPos < ranking.length - 1) {
    targetEntry = ranking[playerPos + 1];
  } else if (ranking.length > 0) {
    targetEntry = ranking[0];
  } else {
    return;
  }

  selectedTarget.value = targetEntry;
  challengeResult.value = null;
  showModal.value = true;
}

async function confirmChallenge() {
  if (!selectedTarget.value) return;

  isChallenging.value = true;

  // Simulate battle delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const targetEntry = selectedTarget.value;
  const playerCombatPower = calculatePlayerCombatPower();
  const targetCombatPower = targetEntry.combatPower;

  // Battle logic: harder to beat stronger opponents
  const targetIsStronger = targetCombatPower > playerCombatPower;
  const powerRatio = targetIsStronger
    ? playerCombatPower / targetCombatPower
    : targetCombatPower / playerCombatPower;

  // Base win chance - much harder to beat stronger opponents
  let playerWinChance: number;
  if (!targetIsStronger) {
    // Player is stronger - high win chance
    playerWinChance = 0.85 + (1 - powerRatio) * 0.1;
  } else {
    // Target is stronger - low win chance based on power difference
    playerWinChance = 0.3 * powerRatio;
  }
  playerWinChance = Math.min(0.95, Math.max(0.05, playerWinChance));

  const isVictory = Math.random() < playerWinChance;

  // Calculate rank change
  const oldRank = playerRank.value || 999;
  let newRank = oldRank;

  if (isVictory) {
    // Victory: take target's position!
    newRank = targetEntry.rank;

    const ranking = [...currentRanking.value]; // Copy to avoid mutation issues
    const targetIndex = ranking.findIndex(e => e.id === targetEntry.id);

    // Remove player from ranking if already exists (from previous defeats)
    const playerAlreadyOnList = ranking.findIndex(e => e.id === playerId.value);
    if (playerAlreadyOnList >= 0) {
      ranking.splice(playerAlreadyOnList, 1);
    }

    // Update targetIndex after potential player removal
    const newTargetIndex = ranking.findIndex(e => e.id === targetEntry.id);

    if (newTargetIndex >= 0) {
      // Push target and those below them down by 1
      for (let i = newTargetIndex; i < ranking.length; i++) {
        const entry = ranking[i];
        entry.rank = i + 2; // Push down by 1
        entry.rankChange = (entry.rankChange || 0) + 1;
        entry.rankChangeType = 'down';
        entry.lastRankChange = Date.now();
        rankingStore.updateRanking(selectedTier.value, entry);
      }
    }

    // Create new player entry at target's old position
    const playerEntry: RankingEntry = {
      id: playerId.value,
      rankingType: selectedTier.value,
      rank: targetEntry.rank,
      name: playerStore.player.name,
      level: playerStore.player.stats.level,
      sect: playerStore.player.sect || '散人',
      combatPower: playerCombatPower,
      lastUpdated: Date.now(),
      status: 'active',
      rankChange: oldRank < 999 && oldRank < targetEntry.rank ? oldRank - targetEntry.rank : 0,
      rankChangeType: 'up',
      lastRankChange: Date.now(),
    };
    rankingStore.updateRanking(selectedTier.value, playerEntry);

    // Update target's info for display
    targetEntry.rank = targetEntry.rank + 1;
    targetEntry.rankChange = -1;
    targetEntry.rankChangeType = 'down';
  } else {
    // Defeat: keep current rank, just update stats
    // Don't change player's rank position on defeat
    newRank = oldRank;
    // 挑战失败只记录统计，不修改排名
  }

  // Update stats
  rankingStore.recordChallengeResult(isVictory ? 'victory' : 'defeat');
  rankingStore.decrementDailyChallenges(selectedTier.value);

  // Generate result log
  const resultLog = isVictory
    ? `你击败了 ${targetEntry.name}，取而代之成为第 ${targetEntry.rank - 1} 名！`
    : playerRank.value !== undefined
      ? `你挑战 ${targetEntry.name} 落败，你仍在这${getTierName(selectedTier.value)}第 ${playerRank.value} 名`
      : `你挑战 ${targetEntry.name} 落败，暂未上榜，继续努力！`;

  function getTierName(tier: RankingType): string {
    switch (tier) {
      case RankingType.天榜:
        return '天榜';
      case RankingType.地榜:
        return '地榜';
      case RankingType.玄榜:
        return '玄榜';
      default:
        return '榜';
    }
  }

  challengeResult.value = {
    result: isVictory ? 'victory' : 'defeat',
    oldRank,
    newRank: newRank < 999 ? newRank : undefined,
    log: resultLog,
  };

  isChallenging.value = false;
}

function calculatePlayerCombatPower(): number {
  const stats = playerStore.player.stats;
  return Math.floor((stats.attack + stats.defense) * stats.level * 1.5);
}

onMounted(async () => {
  await rankingStore.init();
});
</script>

<style scoped>
.jianghu-ranking-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

/* Header */
.panel-header {
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.panel-title h1 {
  margin: 0 0 6px 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
}

.panel-title p {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

/* Tabs */
.ranking-tabs {
  display: flex;
  gap: 8px;
}

.ranking-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ranking-tab:hover {
  border-color: rgba(17, 17, 17, 0.2);
}

.ranking-tab.active {
  background: #0f0f0f;
  border-color: #0f0f0f;
}

.ranking-tab.active .tier-name,
.ranking-tab.active .tier-count {
  color: #fff;
}

.tier-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f0f0f;
}

.tier-count {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
}

/* Player Info Section */
.player-info-section {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
}

.player-rank-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.player-label {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.player-status-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.player-status-badge.on-rank {
  background: rgba(17, 17, 17, 0.08);
  color: #0f0f0f;
}

.player-status-badge.not-on-rank {
  background: rgba(17, 17, 17, 0.04);
  color: rgba(17, 17, 17, 0.5);
}

.player-status-badge.level-too-low {
  background: rgba(200, 50, 50, 0.1);
  color: #c83232;
}

.player-rank-value {
  font-size: 28px;
  font-weight: 700;
  color: #0f0f0f;
  margin-bottom: 12px;
}

.player-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-item .stat-label {
  font-size: 10px;
  color: rgba(17, 17, 17, 0.45);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-item .stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #0f0f0f;
}

.challenge-btn {
  width: 100%;
  padding: 12px;
  background: #0f0f0f;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.challenge-btn:hover:not(:disabled) {
  background: #333;
}

.challenge-btn:disabled {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.4);
  cursor: not-allowed;
}

/* Ranking List */
.ranking-list-section {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.ranking-header {
  display: flex;
  padding: 12px 16px;
  background: rgba(17, 17, 17, 0.04);
  font-size: 11px;
  font-weight: 600;
  color: rgba(17, 17, 17, 0.6);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.rank-col {
  width: 50px;
  text-align: center;
}
.change-col {
  width: 50px;
  text-align: center;
}
.name-col {
  flex: 1;
}
.level-col {
  width: 80px;
  text-align: center;
}
.combat-col {
  width: 100px;
  text-align: center;
}
.status-col {
  width: 80px;
  text-align: center;
}

.ranking-entries {
  max-height: 400px;
  overflow-y: auto;
}

.ranking-entry {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.04);
  transition: background 0.1s ease;
}

.ranking-entry:hover {
  background: rgba(17, 17, 17, 0.02);
}

.ranking-entry.entry-player {
  background: rgba(17, 17, 17, 0.04);
}

.ranking-entry.entry-challengeable {
  cursor: pointer;
}

.ranking-entry.entry-challengeable:hover {
  background: rgba(17, 17, 17, 0.06);
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  background: rgba(17, 17, 17, 0.06);
  color: rgba(17, 17, 17, 0.6);
}

.rank-change {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 24px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.rank-change.no-change {
  color: rgba(17, 17, 17, 0.3);
}

.rank-change.change-up {
  background: rgba(30, 120, 50, 0.1);
  color: #1e7832;
}

.rank-change.change-down {
  background: rgba(180, 50, 50, 0.1);
  color: #b43232;
}

.rank-badge.rank-gold {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #fff;
}

.rank-badge.rank-silver {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
  color: #fff;
}

.rank-badge.rank-bronze {
  background: linear-gradient(135deg, #cd7f32, #a0522d);
  color: #fff;
}

.name-col {
  font-size: 14px;
  font-weight: 500;
  color: #0f0f0f;
}

.level-col,
.combat-col {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
  font-family: 'SF Mono', 'Courier New', monospace;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.status-badge.in-progress {
  background: rgba(17, 17, 17, 0.08);
  color: rgba(17, 17, 17, 0.6);
}

.status-badge.on-list {
  background: rgba(17, 17, 17, 0.04);
  color: rgba(17, 17, 17, 0.5);
}

.status-badge.off-list {
  background: transparent;
  color: rgba(17, 17, 17, 0.3);
}

.empty-ranking {
  padding: 40px;
  text-align: center;
  color: rgba(17, 17, 17, 0.4);
}

/* Challenge History */
.challenge-history-section {
  padding-top: 16px;
  border-top: 1px solid rgba(17, 17, 17, 0.08);
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
}

.stat-icon {
  width: 20px;
  height: 20px;
  color: #111;
}

.stat-number {
  font-size: 20px;
  font-weight: 700;
  color: #0f0f0f;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.stat-label {
  font-size: 10px;
  color: rgba(17, 17, 17, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Modal弹窗内容样式 */
.target-info {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 12px;
  margin-bottom: 16px;
}

.target-avatar {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #0f0f0f, #333);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.target-details h4 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f0f0f;
}

.target-details p {
  margin: 2px 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
}

.challenge-warning {
  padding: 12px;
  background: rgba(200, 50, 50, 0.08);
  border-radius: 8px;
  margin-bottom: 16px;
}

.challenge-warning p {
  margin: 4px 0;
  font-size: 13px;
  color: #c83232;
  display: flex;
  align-items: center;
  gap: 6px;
}

.warning-icon {
  width: 16px;
  height: 16px;
  color: #c83232;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  width: 100%;
}

.modal-btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-btn.primary {
  background: #0f0f0f;
  color: #fff;
  border: none;
}

.modal-btn.primary:hover:not(:disabled) {
  background: #333;
}

.modal-btn.primary:disabled {
  background: rgba(17, 17, 17, 0.3);
  cursor: not-allowed;
}

.modal-btn.secondary {
  background: rgba(17, 17, 17, 0.06);
  color: #666;
  border: 1px solid rgba(17, 17, 17, 0.15);
}

.modal-btn.secondary:hover {
  background: rgba(17, 17, 17, 0.1);
}

/* Challenge Progress */
.challenge-progress {
  text-align: center;
  padding: 40px 20px;
}

.challenge-animation {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.swords-cross {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: #111;
}

.challenge-progress p {
  font-size: 16px;
  color: #0f0f0f;
}

/* Challenge Result */
.challenge-result {
  text-align: center;
  padding: 30px 20px;
}

.result-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-check-icon {
  width: 64px;
  height: 64px;
  color: #22c55e;
}

.result-x-icon {
  width: 64px;
  height: 64px;
  color: #ef4444;
}

.result-icon.victory {
  animation: bounceIn 0.5s ease;
}

.result-icon.defeat {
  animation: shake 0.5s ease;
}

@keyframes bounceIn {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-10px);
  }
  75% {
    transform: translateX(10px);
  }
}

.challenge-result h4 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
}

.result-log {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.7);
  margin-bottom: 12px;
}

.result-rank {
  font-size: 18px;
  font-weight: 600;
  color: #1e7832;
  margin-bottom: 20px;
}

/* Selected entry highlight */
.ranking-entry.entry-selected {
  background: rgba(17, 17, 17, 0.08);
  border-left: 3px solid #0f0f0f;
}
</style>
