<template>
  <div class="reputation-panel">
    <header class="panel-header">
      <div class="panel-title">
        <h1>江湖声望</h1>
        <p>在江湖中的名望决定你的地位和待遇</p>
      </div>
      <div class="panel-summary">
        <div class="summary-item">
          <span class="summary-label">当前声望</span>
          <span class="summary-value">{{ reputationStore.reputation.jianghu }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">等级称号</span>
          <span class="summary-value">{{ reputationStore.title }}</span>
        </div>
      </div>
    </header>

    <!-- 当前等级展示 -->
    <section class="current-level-section">
      <div
        class="level-showcase"
        :class="levelClass"
      >
        <div class="level-badge">{{ reputationStore.levelName }}</div>
        <div class="level-title">{{ reputationStore.title }}</div>
        <div class="level-points">{{ Math.floor(reputationStore.reputation.jianghu) }} 声望</div>
      </div>

      <!-- 进度条 -->
      <div
        class="progress-section"
        v-if="reputationStore.pointsToNextLevel > 0"
      >
        <div class="progress-header">
          <span class="progress-label">距离「{{ nextLevelName }}」</span>
          <span class="progress-value">{{ reputationStore.pointsToNextLevel }} 点</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-bar-fill"
            :style="{ width: reputationStore.progressPercent + '%' }"
          ></div>
        </div>
        <div class="progress-percent">{{ reputationStore.progressPercent.toFixed(1) }}%</div>
      </div>
      <div
        class="max-level-badge"
        v-else
      >
        <Star class="max-icon" />
        <span>已达最高声望等级</span>
      </div>
    </section>

    <!-- 等级加成 -->
    <section class="bonus-section">
      <h2 class="section-title">等级加成</h2>
      <div class="bonus-grid">
        <div class="bonus-card">
          <Zap class="bonus-icon" />
          <div class="bonus-info">
            <span class="bonus-label">加成倍率</span>
            <span class="bonus-value"
              >{{ (reputationStore.bonusMultiplier * 100).toFixed(0) }}%</span
            >
          </div>
        </div>
      </div>
    </section>

    <!-- 恶名惩罚 -->
    <section
      class="penalty-section"
      v-if="reputationStore.reputation.jianghu < 0"
    >
      <h2 class="section-title">恶名惩罚</h2>
      <div class="penalty-card">
        <div class="penalty-header">
          <span class="penalty-level-badge">{{ reputationStore.penaltyRule.level }}</span>
          <span class="penalty-description">{{ reputationStore.penaltyRule.description }}</span>
        </div>
        <ul
          class="penalty-effects"
          v-if="hasPenaltyEffects"
        >
          <li v-if="reputationStore.penaltyRule.effects.shopPriceIncrease">
            <Coins class="effect-icon" />
            <span
              >商店价格增加
              {{ (reputationStore.penaltyRule.effects.shopPriceIncrease * 100).toFixed(0) }}%</span
            >
          </li>
          <li v-if="reputationStore.penaltyRule.effects.deniedEntry?.length">
            <Ban class="effect-icon" />
            <span
              >被拒绝进入：{{ reputationStore.penaltyRule.effects.deniedEntry.join('、') }}</span
            >
          </li>
          <li v-if="reputationStore.penaltyRule.effects.combatDropIncrease">
            <Swords class="effect-icon" />
            <span
              >战斗掉落增加
              {{ (reputationStore.penaltyRule.effects.combatDropIncrease * 100).toFixed(0) }}%</span
            >
          </li>
          <li v-if="reputationStore.penaltyRule.effects.canBeAttacked">
            <AlertTriangle class="effect-icon" />
            <span>可被正道人士主动攻击</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- 声望等级列表 -->
    <section class="levels-section">
      <h2 class="section-title">声望等级</h2>
      <div class="levels-grid">
        <div
          v-for="level in allLevels"
          :key="level.level"
          class="level-card"
          :class="{
            'level-current': level.level === reputationStore.reputation.currentLevel,
            'level-unlocked': reputationStore.hasReachedLevel(level.level),
          }"
        >
          <div class="level-card-header">
            <span class="level-name">{{ level.name }}</span>
            <span
              class="level-badge-mini"
              :class="getLevelBadgeClass(level.level)"
            >
              {{ level.bonusMultiplier * 100 }}%
            </span>
          </div>
          <div class="level-range">
            {{ formatPoints(level.minPoints) }} - {{ formatPoints(level.maxPoints) }} 声望
          </div>
          <div class="level-title-text">{{ level.title }}</div>
        </div>
      </div>
    </section>

    <!-- 声望获取规则 -->
    <section class="rules-section">
      <h2 class="section-title">声望获取</h2>
      <div class="rules-list">
        <div
          v-for="rule in allGainRules"
          :key="rule.action"
          class="rule-card"
        >
          <div class="rule-info">
            <span class="rule-action">{{ rule.description }}</span>
            <span
              class="rule-range"
              v-if="rule.maxGain"
              >上限 {{ rule.maxGain }} 点</span
            >
          </div>
          <div class="rule-points">
            <span class="points-value">+{{ rule.basePoints }}</span>
            <span class="points-unit">声望</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Zap, Coins, Ban, Swords, AlertTriangle, Star } from 'lucide-vue-next';
import { useReputationStore } from '@/stores/reputationStore';
import { useReputationConfig } from '@/config/reputationConfig';
import { ReputationLevel } from '@/types/reputation';

const reputationStore = useReputationStore();
const configService = useReputationConfig();

onMounted(async () => {
  await reputationStore.init();
});

const allLevels = computed(() => configService.getAllLevels());
const allGainRules = computed(() => configService.getAllGainRules());
const nextLevelName = computed(() => {
  const detail = reputationStore.levelDetail;
  return detail.nextLevelName || '传奇人物';
});

const hasPenaltyEffects = computed(() => {
  const effects = reputationStore.penaltyRule.effects;
  return !!(
    effects.shopPriceIncrease ||
    effects.deniedEntry?.length ||
    effects.combatDropIncrease ||
    effects.canBeAttacked
  );
});

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

function getLevelBadgeClass(level: ReputationLevel): string {
  if (level >= ReputationLevel.传奇人物) return 'badge-legendary';
  if (level >= ReputationLevel.武林泰斗) return 'badge-master';
  if (level >= ReputationLevel.宗师级人物) return 'badge-grandmaster';
  if (level >= ReputationLevel.赫赫有名) return 'badge-famed';
  if (level >= ReputationLevel.一流高手) return 'badge-elite';
  if (level >= ReputationLevel.小有名气) return 'badge-known';
  if (level >= ReputationLevel.江湖新秀) return 'badge-rising';
  return 'badge-unknown';
}

function formatPoints(points: number): string {
  if (points >= 1000) {
    return (points / 1000).toFixed(1) + 'k';
  }
  return points.toString();
}
</script>

<style scoped>
.reputation-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.panel-title h1 {
  margin: 0 0 6px 0;
  font-size: 22px;
  font-weight: 600;
  color: #0f0f0f;
  letter-spacing: -0.3px;
}

.panel-title p {
  margin: 0;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.55);
}

.panel-summary {
  display: flex;
  gap: 20px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 100px;
  text-align: right;
}

.summary-label {
  font-size: 10px;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.45);
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: #101010;
}

/* 当前等级展示 */
.current-level-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.level-showcase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 24px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.level-badge {
  font-size: 20px;
  font-weight: 600;
  color: #0f0f0f;
  padding: 8px 24px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 999px;
}

.level-showcase.level-legendary .level-badge {
  background: linear-gradient(135deg, #111, #333);
  color: #fff;
}

.level-showcase.level-master .level-badge {
  background: #333;
  color: #fff;
}

.level-showcase.level-grandmaster .level-badge {
  background: #555;
  color: #fff;
}

.level-showcase.level-famed .level-badge {
  background: #777;
  color: #fff;
}

.level-title {
  font-size: 14px;
  color: rgba(17, 17, 17, 0.6);
}

.level-points {
  font-size: 13px;
  font-weight: 500;
  color: rgba(17, 17, 17, 0.45);
  font-family: 'SF Mono', 'Courier New', monospace;
}

/* 进度条 */
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.progress-label {
  color: rgba(17, 17, 17, 0.6);
}

.progress-value {
  color: rgba(17, 17, 17, 0.45);
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(135deg, #101010, #3d3d3d);
  transition: width 0.3s ease;
}

.progress-percent {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
  text-align: right;
}

.max-level-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 12px;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
}

.max-icon {
  width: 18px;
  height: 18px;
  color: #111;
}

/* Section Title */
.section-title {
  margin: 0 0 14px 0;
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
  letter-spacing: 0.5px;
}

/* 等级加成 */
.bonus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.bonus-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
}

.bonus-icon {
  font-size: 24px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.04);
  border-radius: 10px;
  color: #111;
}

.bonus-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bonus-label {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
}

.bonus-value {
  font-size: 18px;
  font-weight: 600;
  color: #101010;
}

/* 恶名惩罚 */
.penalty-card {
  padding: 20px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
}

.penalty-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.penalty-level-badge {
  padding: 4px 12px;
  background: rgba(17, 17, 17, 0.08);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #111;
}

.penalty-description {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
}

.penalty-effects {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.penalty-effects li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(17, 17, 17, 0.72);
}

.effect-icon {
  width: 16px;
  height: 16px;
  color: rgba(17, 17, 17, 0.6);
}

/* 声望等级列表 */
.levels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.level-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(17, 17, 17, 0.06);
  border-radius: 12px;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.level-card.level-unlocked {
  opacity: 1;
  background: #fff;
  border-color: rgba(17, 17, 17, 0.12);
}

.level-card.level-current {
  border-color: #111;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.level-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.level-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f0f0f;
}

.level-badge-mini {
  padding: 2px 8px;
  background: rgba(17, 17, 17, 0.06);
  border-radius: 999px;
  font-size: 10px;
  color: rgba(17, 17, 17, 0.55);
}

.level-badge-mini.badge-legendary {
  background: #111;
  color: #fff;
}
.level-badge-mini.badge-master {
  background: #333;
  color: #fff;
}
.level-badge-mini.badge-grandmaster {
  background: #555;
  color: #fff;
}
.level-badge-mini.badge-famed {
  background: #777;
  color: #fff;
}

.level-range {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.45);
  font-family: 'SF Mono', 'Courier New', monospace;
}

.level-title-text {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.6);
}

/* 声望获取规则 */
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 12px;
}

.rule-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rule-action {
  font-size: 13px;
  color: #0f0f0f;
}

.rule-range {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.45);
}

.rule-points {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.points-value {
  font-size: 18px;
  font-weight: 600;
  color: #101010;
}

.points-unit {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.5);
}
</style>
