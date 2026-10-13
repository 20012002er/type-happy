<template>
  <div class="achievement-panel">
    <header class="panel-header">
      <div class="panel-title">
        <h1>成就总览</h1>
        <p>达成成就以引导系统探索并获取永久奖励。</p>
      </div>
      <div class="panel-summary">
        <div class="summary-item">
          <span class="summary-label">已达成</span>
          <span class="summary-value">{{ summary.completed }}/{{ summary.total }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">成就点数</span>
          <span class="summary-value">{{ summary.pointsEarned }}/{{ summary.pointsTotal }}</span>
        </div>
      </div>
    </header>

    <nav class="filter-tabs" v-if="!isLoading">
      <button
        v-for="tab in categoryTabs"
        :key="tab.key"
        class="filter-tab"
        :class="{ active: currentCategory === tab.key }"
        @click="currentCategory = tab.key"
      >
        {{ tab.label }}
        <span class="tab-count">{{ tab.count }}</span>
      </button>
    </nav>

    <div class="empty-state" v-if="isLoading">
      <p>成就加载中...</p>
    </div>

    <section class="achievement-list" v-else-if="filteredAchievements.length > 0">
      <article
        v-for="achievement in filteredAchievements"
        :key="achievement.id"
        class="achievement-card"
        :class="achievement.status"
      >
        <header class="card-header">
          <div class="card-title">
            <span class="tier-pill" :class="achievement.tier">{{ tierLabel(achievement.tier) }}</span>
            <h2>{{ achievement.name }}</h2>
          </div>
          <span class="status-pill" :class="statusClass(achievement.status)">
            {{ statusLabel(achievement.status) }}
          </span>
        </header>

        <p class="card-description">{{ achievement.description }}</p>

        <ul class="objective-list">
          <li v-for="(objective, idx) in achievement.objectives" :key="idx">
            <span>{{ objective.description }}</span>
            <span class="objective-progress">{{ objective.current }}/{{ objective.required }}</span>
            <div class="objective-bar">
              <div class="objective-bar-fill" :style="{ width: objectivePercent(objective) + '%' }"></div>
            </div>
          </li>
        </ul>

        <footer class="card-footer">
          <span class="reward-text">奖励：{{ formatReward(achievement.rewards) }}</span>
          <div class="footer-actions">
            <span class="point-text">+{{ achievement.points }} pts</span>
            <button
              v-if="achievement.quickNavTarget"
              class="quick-nav-button"
              @click="quickNav(achievement.quickNavTarget)"
            >
              前往
            </button>
          </div>
        </footer>
      </article>
    </section>

    <div v-else class="empty-state">
      <p>暂无成就可显示。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAchievementStore } from '@/stores/achievementStore';
import { AchievementService } from '@/services/achievementService';
import {
  AchievementCategory,
  AchievementStatus,
  type Achievement,
  type AchievementObjective,
  AchievementTier
} from '@/types/achievement';

type CategoryKey = 'all' | AchievementCategory;

const achievementStore = useAchievementStore();
const { achievements, byCategory, summary, initialized } = storeToRefs(achievementStore);
const emit = defineEmits<{ (e: 'quick-nav', target: string): void }>();
const currentCategory = ref<CategoryKey>('all');
const isLoading = ref(true);

onMounted(async () => {
  if (!initialized.value) {
    await achievementStore.init();
  }
  console.log('[AchievementPanel] achievements loaded:', achievements.value.length);
  isLoading.value = false;
});

const categoryTabs = computed(() => {
  const base = [
    { key: 'all' as CategoryKey, label: '全部' }
  ];
  const categories = Array.from(byCategory.value.keys());
  const mapped = categories.map((category) => ({
    key: category as CategoryKey,
    label: categoryLabel(category as AchievementCategory),
    count: byCategory.value.get(category as AchievementCategory)?.length ?? 0
  }));
  const allCount = achievements.value.length;
  return [{ ...base[0], count: allCount }, ...mapped];
});

const filteredAchievements = computed<Achievement[]>(() => {
  if (currentCategory.value === 'all') {
    return achievements.value;
  }
  return (
    byCategory.value.get(currentCategory.value as AchievementCategory) ?? []
  );
});

function categoryLabel(category: AchievementCategory): string {
  const map: Record<AchievementCategory, string> = {
    [AchievementCategory.GUIDE]: '引导',
    [AchievementCategory.PROGRESSION]: '成长',
    [AchievementCategory.COMBAT]: '战斗',
    [AchievementCategory.CRAFTING]: '制作',
    [AchievementCategory.ECONOMY]: '经济',
    [AchievementCategory.EXPLORATION]: '探索',
    [AchievementCategory.LIFESTYLE]: '修行'
  };
  return map[category] ?? category;
}

function statusLabel(status: AchievementStatus): string {
  const map: Record<AchievementStatus, string> = {
    [AchievementStatus.LOCKED]: '未解锁',
    [AchievementStatus.IN_PROGRESS]: '进行中',
    [AchievementStatus.COMPLETED]: '待领取',
    [AchievementStatus.REWARDED]: '已完成'
  };
  return map[status];
}

function statusClass(status: AchievementStatus): string {
  return `status-${status}`;
}

function objectivePercent(objective: AchievementObjective): number {
  if (objective.required <= 0) return 0;
  return Math.min(100, Math.round((objective.current / objective.required) * 100));
}

function formatReward(reward?: Achievement['rewards']): string {
  return AchievementService.formatReward(reward);
}

function tierLabel(tier: AchievementTier): string {
  const map: Record<AchievementTier, string> = {
    [AchievementTier.BRONZE]: 'BRONZE',
    [AchievementTier.SILVER]: 'SILVER',
    [AchievementTier.GOLD]: 'GOLD',
    [AchievementTier.PLATINUM]: 'PLATINUM'
  };
  return map[tier];
}

function quickNav(target?: string) {
  if (!target) return;
  emit('quick-nav', target);
}
</script>

<style scoped>
.achievement-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px;
  background: #f7f7f5;
  min-height: 100%;
}

.achievement-panel.is-compact {
  padding: 16px;
  gap: 12px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.05);
}

.panel-title h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.6px;
  color: #0f0f0f;
}

.panel-title p {
  margin: 6px 0 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.panel-summary {
  display: flex;
  gap: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 100px;
}

.summary-label {
  font-size: 10px;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.45);
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #101010;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.filter-tab.active {
  background: #101010;
  color: #fff;
  border-color: #101010;
}

.tab-count {
  font-size: 10px;
  opacity: 0.7;
}

.achievement-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.achievement-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.06);
}

.achievement-card.rewarded {
  border-color: rgba(17, 17, 17, 0.18);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tier-pill {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  border: 1px solid rgba(17, 17, 17, 0.2);
  color: rgba(17, 17, 17, 0.6);
}

.tier-pill.bronze {
  background: rgba(205, 127, 50, 0.12);
}

.tier-pill.silver {
  background: rgba(180, 180, 180, 0.18);
}

.tier-pill.gold {
  background: rgba(255, 215, 0, 0.15);
}

.tier-pill.platinum {
  background: rgba(180, 205, 255, 0.2);
}

.card-title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #0f0f0f;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.status-pill.status-in_progress {
  background: rgba(17, 17, 17, 0.08);
  color: #111;
}

.status-pill.status-locked {
  background: rgba(17, 17, 17, 0.05);
  color: rgba(17, 17, 17, 0.45);
}

.status-pill.status-completed {
  background: rgba(17, 17, 17, 0.12);
  color: #111;
}

.status-pill.status-rewarded {
  background: #101010;
  color: #fff;
}

.card-description {
  margin: 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.62);
  line-height: 1.45;
}

.objective-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.objective-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: rgba(17, 17, 17, 0.72);
}

.objective-progress {
  font-size: 10px;
  color: rgba(17, 17, 17, 0.5);
}

.objective-bar {
  position: relative;
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.objective-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(135deg, #101010, #3d3d3d);
  transition: width 0.2s ease;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: rgba(17, 17, 17, 0.6);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.point-text {
  font-weight: 600;
  color: #101010;
}

.quick-nav-button {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.18);
  background: rgba(17, 17, 17, 0.05);
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-nav-button:hover {
  background: #101010;
  color: #fff;
}

.empty-state {
  padding: 30px;
  border: 1px dashed rgba(17, 17, 17, 0.12);
  border-radius: 14px;
  text-align: center;
  color: rgba(17, 17, 17, 0.55);
  background: rgba(255, 255, 255, 0.6);
}

@media (max-width: 1024px) {
  .achievement-panel {
    padding: 16px;
    gap: 12px;
  }

  .achievement-list {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>

