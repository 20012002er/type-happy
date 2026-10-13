<template>
  <div class="seclusion-stats-panel">
    <header class="panel-header">
      <h2 class="panel-title">江湖手札</h2>
      <div class="panel-date">{{ currentDate }}</div>
    </header>

    <div class="panel-content">
      <!-- 今日点香 -->
      <section class="stats-section">
        <h3 class="section-title">今日点香</h3>
        <div class="incense-dots">
          <span
            v-for="i in maxDailySessions"
            :key="i"
            class="incense-dot"
            :class="{ filled: i <= todaySessions }"
          >
            {{ i <= todaySessions ? '●' : '○' }}
          </span>
        </div>
        <div class="session-count">{{ todaySessions }} 炷香</div>
      </section>

      <!-- 心神散乱 -->
      <section class="stats-section">
        <h3 class="section-title">心神散乱几回</h3>
        <div class="interrupt-bars">
          <div
            v-for="i in 5"
            :key="i"
            class="interrupt-bar"
            :class="{ filled: i <= todayInterruptions }"
          ></div>
        </div>
        <div class="interrupt-count">{{ todayInterruptions }} 次中断</div>
      </section>

      <!-- 最常练的功课 -->
      <section class="stats-section">
        <h3 class="section-title">最常练的功课</h3>
        <div
          v-if="favoriteType"
          class="favorite-type"
        >
          <component :is="getTypeIcon(favoriteType)" class="type-icon" />
          <span class="type-name">{{ getTypeName(favoriteType) }}</span>
        </div>
        <div
          v-else
          class="favorite-type empty"
        >
          尚无记录
        </div>
      </section>

      <!-- 近七日墨迹走势 -->
      <section class="stats-section">
        <h3 class="section-title">近七日墨迹走势</h3>
        <div class="weekly-chart">
          <div class="chart-container">
            <div
              v-for="(stat, index) in weeklyStats"
              :key="index"
              class="chart-bar-wrapper"
            >
              <div
                class="chart-bar"
                :style="{ height: `${getBarHeight(stat.totalSessions)}%` }"
              >
                <div class="bar-tooltip">{{ stat.date }}: {{ stat.totalSessions }} 次</div>
              </div>
              <div class="chart-label">{{ formatDateLabel(stat.date) }}</div>
            </div>
          </div>
          <div class="chart-legend">
            <span class="legend-item">修行天数</span>
          </div>
        </div>
      </section>

      <!-- 文案总结 -->
      <section class="stats-section summary">
        <h3 class="section-title">手札结语</h3>
        <p class="summary-text">{{ summaryText }}</p>
      </section>

      <!-- 连续天数 -->
      <section class="stats-section streak">
        <div class="streak-info">
          <span class="streak-label">连续修行</span>
          <span class="streak-value">{{ currentStreak }} 天</span>
        </div>
        <div
          v-if="longestStreak > currentStreak"
          class="streak-best"
        >
          最长 {{ longestStreak }} 天
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles, Swords, BookOpen, Pencil, Circle } from 'lucide-vue-next';
import { useSeclusionStore } from '@/stores/seclusionStore';
import { SeclusionConfigService } from '@/services/config/SeclusionConfigService';
import type { SeclusionType, DailyStudyStats } from '@/types/seclusion';

const seclusionStore = useSeclusionStore();

// 最大每日闭关次数显示
const maxDailySessions = 5;

// 今日数据
const todaySessions = computed(() => seclusionStore.todaySessions);
const todayInterruptions = computed(() => seclusionStore.todayInterruptions);

// 总体统计
const currentStreak = computed(() => seclusionStore.studyStats.currentStreak);
const longestStreak = computed(() => seclusionStore.studyStats.longestStreak);
const favoriteType = computed(() => seclusionStore.studyStats.favoriteType);

// 周统计
const weeklyStats = computed(() => {
  const stats = seclusionStore.studyStats.weeklyStats.dailyStats;
  return stats.slice(-7);
});

// 当前日期
const currentDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  });
});

// 获取柱状图高度百分比
const getBarHeight = (sessions: number): number => {
  const maxSessions = Math.max(...weeklyStats.value.map(s => s.totalSessions), 1);
  return Math.max((sessions / maxSessions) * 100, 5);
};

// 格式化日期标签
const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.getMonth() + 1 + '/' + date.getDate();
};

// 获取类型图标
const getTypeIcon = (type: SeclusionType) => {
  const icons: Record<SeclusionType, any> = {
    practice: Sparkles,
    sparring: Swords,
    reading: BookOpen,
  };
  return icons[type] || Pencil;
};

// 获取类型名称
const getTypeName = async (type: SeclusionType): Promise<string> => {
  const typeConfig = await SeclusionConfigService.getSeclusionType(type);
  return typeConfig?.name || type;
};

// 生成总结文案
const summaryText = computed(() => {
  const sessions = todaySessions.value;
  const interruptions = todayInterruptions.value;

  if (sessions === 0) {
    return '今日尚未点香修行。';
  }

  if (interruptions === 0 && sessions >= 3) {
    return '今日心神安定，修行进展顺利。';
  }

  if (interruptions >= 3) {
    return '今日杂念颇多，宜早歇，明日再战。';
  }

  if (sessions >= 5) {
    return '今日勤勉有加，颇有进境。';
  }

  if (sessions >= 2) {
    return '今日修行尚可，张弛有度。';
  }

  return '今日有所修行，虽不多，但聊胜于无。';
});
</script>

<style scoped>
.seclusion-stats-panel {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #333;
  background: linear-gradient(180deg, #1f1f1f 0%, #1a1a1a 100%);
}

.panel-title {
  margin: 0;
  font-size: 1.1rem;
  color: #f0f0f0;
  letter-spacing: 0.1em;
}

.panel-date {
  font-size: 0.85rem;
  color: #888;
}

.panel-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.stats-section {
  padding-bottom: 1rem;
  border-bottom: 1px solid #2a2a2a;
}

.stats-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.8rem;
  color: #666;
  font-weight: normal;
  letter-spacing: 0.05em;
}

/* 今日点香 */
.incense-dots {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.incense-dot {
  font-size: 1.2rem;
  color: #333;
  transition:
    color 0.3s,
    transform 0.2s;
}

.incense-dot.filled {
  color: #d4a574;
  text-shadow: 0 0 8px rgba(212, 165, 116, 0.4);
}

.session-count {
  font-size: 0.85rem;
  color: #888;
}

/* 心神散乱 */
.interrupt-bars {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.interrupt-bar {
  flex: 1;
  height: 20px;
  background: #2a2a2a;
  border-radius: 2px;
  transition: background 0.3s;
}

.interrupt-bar.filled {
  background: #8b0000;
}

.interrupt-count {
  font-size: 0.85rem;
  color: #888;
}

/* 最常练的功课 */
.favorite-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  color: #f0f0f0;
}

.favorite-type.empty {
  color: #555;
  font-style: italic;
}

.type-icon {
  width: 20px;
  height: 20px;
  color: #f0f0f0;
}

/* 近七日图表 */
.weekly-chart {
  margin-top: 0.25rem;
}

.chart-container {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  height: 80px;
  padding: 0 0.25rem;
}

.chart-bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.chart-bar {
  width: 100%;
  max-width: 24px;
  background: linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%);
  border-radius: 2px 2px 0 0;
  margin-top: auto;
  position: relative;
  transition: height 0.3s ease;
  cursor: pointer;
}

.chart-bar:hover {
  background: linear-gradient(180deg, #5a5a5a 0%, #4a4a4a 100%);
}

.bar-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  padding: 0.3rem 0.5rem;
  border-radius: 3px;
  font-size: 0.7rem;
  color: #f0f0f0;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  margin-bottom: 4px;
}

.chart-bar:hover .bar-tooltip {
  opacity: 1;
}

.chart-label {
  font-size: 0.65rem;
  color: #555;
  margin-top: 0.35rem;
  transform: rotate(-45deg);
  white-space: nowrap;
}

.chart-legend {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.legend-item {
  font-size: 0.7rem;
  color: #555;
}

/* 文案总结 */
.summary {
  background: rgba(255, 255, 255, 0.02);
  margin: 0 -1rem;
  padding: 1rem !important;
  border-bottom: none !important;
}

.summary-text {
  margin: 0;
  font-size: 0.9rem;
  color: #a0a0a0;
  line-height: 1.6;
  font-style: italic;
}

/* 连续天数 */
.streak {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.streak-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.streak-label {
  font-size: 0.8rem;
  color: #666;
}

.streak-value {
  font-size: 1.5rem;
  color: #d4a574;
  font-family: 'Courier New', monospace;
  font-weight: 300;
}

.streak-best {
  font-size: 0.75rem;
  color: #555;
}
</style>
