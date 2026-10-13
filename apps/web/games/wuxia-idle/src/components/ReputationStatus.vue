<template>
  <div
    class="reputation-status"
    :class="statusClass"
  >
    <header class="status-header">
      <div
        class="level-badge"
        :class="levelClass"
      >
        {{ reputationStore.levelName }}
      </div>
      <div class="title-badge">
        {{ reputationStore.title }}
      </div>
    </header>

    <div class="points-info">
      <span class="points-value">{{ Math.floor(reputationStore.reputation.jianghu) }}</span>
      <span class="points-label">江湖声望</span>
    </div>

    <div
      class="progress-bar"
      v-if="reputationStore.pointsToNextLevel > 0"
    >
      <div
        class="progress-bar-fill"
        :style="{ width: reputationStore.progressPercent + '%' }"
      ></div>
    </div>
    <div
      class="progress-text"
      v-if="reputationStore.pointsToNextLevel > 0"
    >
      距离下一级还需 {{ reputationStore.pointsToNextLevel }} 点
    </div>
    <div
      class="max-level-text"
      v-else
    >
      已达最高声望等级
    </div>

    <div class="bonus-info">
      <span class="bonus-label">加成倍率</span>
      <span class="bonus-value">{{ (reputationStore.bonusMultiplier * 100).toFixed(0) }}%</span>
    </div>

    <div
      class="penalty-info"
      v-if="reputationStore.reputation.jianghu < 0"
    >
      <span class="penalty-label">恶名等级</span>
      <span class="penalty-value">{{ reputationStore.penaltyRule.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useReputationStore } from '@/stores/reputationStore';

const reputationStore = useReputationStore();

const statusClass = computed(() => ({
  'reputation-status--good': reputationStore.reputation.jianghu >= 0,
  'reputation-status--neutral':
    reputationStore.reputation.jianghu < 0 && reputationStore.reputation.jianghu >= -100,
  'reputation-status--evil': reputationStore.reputation.jianghu < -100,
}));

const levelClass = computed(() => {
  const points = reputationStore.reputation.jianghu;
  if (points >= 100000) return 'level-legendary';
  if (points >= 50000) return 'level-master';
  if (points >= 15000) return 'level-grandmaster';
  if (points >= 5000) return 'level-famed';
  if (points >= 1500) return 'level-elite';
  if (points >= 500) return 'level-known';
  if (points >= 100) return 'level-rising';
  return 'level-unknown';
});
</script>

<style scoped>
.reputation-status {
  border: 1px solid #cccccc;
  background: #ffffff;
  padding: 1rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.reputation-status--good {
  border-left: 3px solid #000000;
}

.reputation-status--neutral {
  border-left: 3px solid #666666;
}

.reputation-status--evil {
  border-left: 3px solid #999999;
}

.status-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.level-badge {
  font-size: 1.25rem;
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  background: #f5f5f5;
  border: 1px solid #cccccc;
}

.level-badge.level-legendary {
  background: #000;
  color: #fff;
}
.level-badge.level-master {
  background: #333;
  color: #fff;
}
.level-badge.level-grandmaster {
  background: #666;
  color: #fff;
}
.level-badge.level-famed {
  background: #999;
  color: #fff;
}
.level-badge.level-elite {
  background: #ccc;
}
.level-badge.level-known {
  background: #eee;
}
.level-badge.level-rising {
  background: #f5f5f5;
}
.level-badge.level-unknown {
  background: #fafafa;
}

.title-badge {
  font-size: 0.875rem;
  color: #666666;
  padding: 0.25rem 0.5rem;
  display: flex;
  align-items: center;
}

.points-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.points-value {
  font-size: 1.5rem;
  font-weight: bold;
  font-family: 'Courier New', Consolas, monospace;
}

.points-label {
  font-size: 0.875rem;
  color: #666666;
}

.progress-bar {
  height: 4px;
  background: #e0e0e0;
  margin-bottom: 0.5rem;
}

.progress-bar-fill {
  height: 100%;
  background: #000000;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: #666666;
  text-align: right;
  margin-bottom: 0.75rem;
}

.max-level-text {
  font-size: 0.75rem;
  color: #000000;
  text-align: right;
  font-weight: bold;
  margin-bottom: 0.75rem;
}

.bonus-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e0e0e0;
}

.bonus-label {
  color: #666666;
}

.bonus-value {
  font-weight: bold;
}

.penalty-info {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e0e0e0;
  font-size: 0.75rem;
  color: #999999;
}

.penalty-label {
  margin-right: 0.5rem;
}

.penalty-value {
  font-style: italic;
}
</style>
