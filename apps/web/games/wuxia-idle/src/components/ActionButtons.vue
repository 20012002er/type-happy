<template>
  <div class="meditation-panel">
    <div class="top-layout">
      <!-- 上半部分：番茄钟圆环 -->
      <div class="timer-section">
        <div class="timer-container" :class="{ active: isActive }">
          <svg class="timer-ring" viewBox="0 0 200 200">
            <!-- 背景圆环 -->
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="rgba(17, 17, 17, 0.08)"
              stroke-width="8"
            />
            <!-- 进度圆环 -->
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              :stroke="progressColor"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="progressOffset"
              class="progress-ring"
              :class="{ active: isActive }"
            />
          </svg>
          <div class="timer-content">
            <div v-if="isActive" class="timer-status">
              <component :is="currentActionIcon" class="status-icon" />
              <div class="status-text">{{ currentActionName }}</div>
              <div class="status-time">{{ remainingTimeText }}</div>
            </div>
            <div v-else class="timer-idle">
              <Sparkles class="idle-icon" />
              <div class="idle-text">调息修炼</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 冥想洞察 -->
      <div class="insight-section">
        <div class="insight-grid">
          <div class="insight-card focus-card">
            <div class="card-label">心流层数</div>
            <div class="focus-meta">
              <span class="focus-value">{{ focusStacks }}/5</span>
              <span class="focus-hint">{{ focusLevelLabel }}</span>
            </div>
            <div class="focus-bars">
              <span
                v-for="n in 5"
                :key="n"
                class="focus-bar"
                :class="{ filled: n <= focusStacks }"
              ></span>
            </div>
            <p class="card-note">维持节奏可提升调息效率</p>
          </div>

          <div class="insight-card summary-card">
            <div class="card-label">今日调息</div>
            <div class="summary-lines">
              <div class="summary-line">
                <span>次数</span>
                <strong>{{ sessionStats.sessions }}</strong>
              </div>
              <div class="summary-line">
                <span>生命恢复</span>
                <strong>+{{ sessionStats.hp }}</strong>
              </div>
              <div class="summary-line">
                <span>体力恢复</span>
                <strong>+{{ sessionStats.stamina }}</strong>
              </div>
              <div class="summary-line">
                <span>内力恢复</span>
                <strong>+{{ sessionStats.energy }}</strong>
              </div>
            </div>
          </div>

          <div class="insight-card recommendation-card">
            <div class="recommend-head">
              <span class="recommend-icon">{{ recommendedAction.icon }}</span>
              <div>
                <div class="card-label">系统建议</div>
                <strong>{{ recommendedAction.title }}</strong>
              </div>
            </div>
            <p class="card-note">{{ recommendedAction.detail }}</p>
          </div>
        </div>

        <div class="result-feed">
          <div class="feed-header">
            <div>
              <div class="feed-title">最新收益</div>
              <p class="feed-subtitle">每次调息的即时回报</p>
            </div>
            <button class="ghost-btn small" :disabled="!recentResults.length" @click="clearRecentResults">
              清空
            </button>
          </div>
          <ul v-if="recentResults.length" class="result-feed-list">
            <li v-for="entry in recentResults" :key="entry.id" class="result-row">
              <component :is="resultIconMap[entry.type]" class="feed-icon" />
              <div class="feed-content">
                <div class="feed-line">
                  <strong>{{ resultLabelMap[entry.type] }}</strong>
                  <span class="feed-amount">+{{ entry.amount }}</span>
                </div>
                <small>{{ formatRelativeTime(entry.timestamp) }}</small>
              </div>
            </li>
          </ul>
          <div v-else class="feed-empty">完成任意调息即可在此查看收益。</div>
        </div>

        <div class="tips-card">
          <div class="tips-header">
            <div>
              <div class="feed-title">修炼建议</div>
              <p class="feed-subtitle">策划手记 · 打坐进阶</p>
            </div>
          </div>
          <ul class="tips-list">
            <li v-for="tip in plannerTips" :key="tip.id">
              <component :is="tip.icon" class="tip-icon" />
              <div>
                <strong>{{ tip.title }}</strong>
                <p>{{ tip.desc }}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 下半部分：动作按钮 -->
    <div class="actions-section">
      <div class="actions-grid">
        <button
          class="action-btn"
          :disabled="!canPerformAction || isActive"
          @click="handleRestoreHp"
        >
          <Heart class="btn-icon" />
          <div class="btn-label">恢复生命</div>
          <div class="btn-desc">调息恢复生命值</div>
        </button>

        <button
          class="action-btn"
          :disabled="!canPerformAction || isActive || isStaminaFull"
          @click="handleRestoreStamina"
        >
          <Zap class="btn-icon" />
          <div class="btn-label">恢复体力</div>
          <div class="btn-desc">调息恢复体力</div>
        </button>

        <button
          class="action-btn"
          :disabled="!canPerformAction || isActive || isEnergyFull"
          @click="handleRestoreEnergy"
        >
          <Wind class="btn-icon" />
          <div class="btn-label">恢复内力</div>
          <div class="btn-desc">调息恢复内力</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Zap, Sparkles, Wind, RefreshCw, Heart, BookOpen } from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/playerStore';
import { ActionType } from '@/types/player';

const playerStore = usePlayerStore();

type ResultType = 'hp' | 'stamina' | 'energy';
interface ResultEntry {
  id: string;
  type: ResultType;
  amount: number;
  timestamp: number;
}

const canPerformAction = computed(() => playerStore.canPerformAction);
const currentAction = computed(() => playerStore.currentAction);
const isActive = computed(() => {
  const action = currentAction.value;
  return action?.type !== null && action?.type !== undefined;
});

type SessionStats = Record<ResultType, number> & { sessions: number };
const sessionStats = ref<SessionStats>({
  sessions: 0,
  hp: 0,
  stamina: 0,
  energy: 0
});

const focusStacks = ref(0);
const recentResults = ref<ResultEntry[]>([]);
const resultIconMap: Record<ResultType, any> = {
  hp: Heart,
  stamina: Zap,
  energy: RefreshCw
};
const resultLabelMap: Record<ResultType, string> = {
  hp: '生命恢复',
  stamina: '体力恢复',
  energy: '内力恢复'
};

const remainingTime = ref(0);
const remainingTimeText = computed(() => {
  if (remainingTime.value <= 0) return '完成';
  const seconds = Math.ceil(remainingTime.value / 1000);
  return `${seconds}秒`;
});

const circumference = 2 * Math.PI * 85; // 2πr, r=85
const progressPercent = computed(() => {
  if (!isActive.value || !currentAction.value?.duration) return 0;
  const elapsed = Date.now() - (currentAction.value.startTime || Date.now());
  const progress = Math.min(1, elapsed / currentAction.value.duration);
  return progress;
});
const progressOffset = computed(() => {
  return circumference * (1 - progressPercent.value);
});
const progressColor = computed(() => {
  if (!isActive.value) return 'rgba(17, 17, 17, 0.12)';
  return '#111';
});

const currentActionIcon = computed(() => {
  const actionType = currentAction.value?.type;
  if (actionType === ActionType.RESTORE_HP) return Heart;
  if (actionType === ActionType.RESTORE_STAMINA) return Zap;
  if (actionType === ActionType.RESTORE_ENERGY) return Wind;
  return Sparkles;
});

const currentActionName = computed(() => {
  const actionType = currentAction.value?.type;
  if (actionType === ActionType.RESTORE_HP) return '恢复生命';
  if (actionType === ActionType.RESTORE_STAMINA) return '恢复体力';
  if (actionType === ActionType.RESTORE_ENERGY) return '恢复内力';
  return '调息中';
});

// 检查体力和内力是否已满
const stamina = computed(() => (playerStore as any).stamina || { current: 0, max: 0 });
const isStaminaFull = computed(() => {
  const current = Math.floor(stamina.value.current || 0);
  const max = stamina.value.max || 100;
  return current >= max;
});

const isEnergyFull = computed(() => {
  const current = Math.floor(playerStore.player.stats.energy || 0);
  const max = playerStore.player.stats.maxEnergy || 100;
  return current >= max;
});

const hpPercent = computed(() => {
  const stats = playerStore.player.stats;
  if (!stats.maxHp) return 0;
  return Math.round((stats.hp / stats.maxHp) * 100);
});

const staminaPercent = computed(() => {
  const gauge = stamina.value;
  if (!gauge.max) return 0;
  return Math.round((gauge.current / gauge.max) * 100);
});

const energyPercent = computed(() => {
  const stats = playerStore.player.stats;
  if (!stats.maxEnergy) return 0;
  return Math.round((stats.energy / stats.maxEnergy) * 100);
});

const focusLevelLabel = computed(() => {
  if (focusStacks.value >= 4) return '心流涌现';
  if (focusStacks.value >= 2) return '意念贯通';
  if (focusStacks.value > 0) return '专注凝聚';
  return '静候心流';
});

const recommendedAction = computed(() => {
  const options = [
    {
      type: ActionType.RESTORE_HP,
      ratio: hpPercent.value,
      title: '恢复生命',
      icon: '🩹',
      plan: '保持生命充盈，避免练功时被击败。'
    },
    {
      type: ActionType.RESTORE_STAMINA,
      ratio: staminaPercent.value || 100,
      title: '恢复体力',
      icon: '⚡',
      plan: '体力越高，探索与生活技能的收益越稳。'
    },
    {
      type: ActionType.RESTORE_ENERGY,
      ratio: energyPercent.value,
      title: '恢复内力',
      icon: RefreshCw,
      plan: '内力决定爆发输出，内功不足时优先调息。'
    }
  ];
  options.sort((a, b) => a.ratio - b.ratio);
  const pick = options[0];
  let detail = '';
  if (pick.ratio <= 35) {
    detail = `${pick.title}仅有 ${pick.ratio}% ，立即调息可最大化收益。`;
  } else if (pick.ratio <= 65) {
    detail = `${pick.title}跌至 ${pick.ratio}% ，建议补足以触发额外奖励。`;
  } else {
    detail = `${pick.title}仍然健康，可尝试切换其他恢复项以保持均衡。`;
  }
  return {
    title: pick.title,
    icon: pick.icon,
    detail,
    plan: pick.plan
  };
});

const basePlannerTips = [
  {
    id: 'chain',
    icon: RefreshCw,
    title: '连贯调息',
    desc: '连续完成 3 次调息即可累积心流层数，解锁更高恢复倍率（预留机制）。'
  },
  {
    id: 'breath',
    icon: Wind,
    title: '呼吸引导',
    desc: '当生命与内力都不足时，先恢复生命再补内力，避免在修炼中途被迫中断。'
  },
  {
    id: 'log',
    icon: BookOpen,
    title: '记录体感',
    desc: '将收益写入日志，有助于日后分析哪种节奏更适合当前流派。'
  }
];

const plannerTips = computed(() => {
  const dynamic = {
    id: 'priority',
    icon: recommendedAction.value.icon,
    title: `优先：${recommendedAction.value.title}`,
    desc: recommendedAction.value.plan
  };
  return [dynamic, ...basePlannerTips].slice(0, 3);
});

const formatRelativeTime = (time: number) => {
  const diff = Date.now() - time;
  if (diff < 5000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  return new Date(time).toLocaleTimeString();
};

const recordResult = (type: ResultType, amount: number) => {
  if (amount <= 0) return;
  sessionStats.value.sessions += 1;
  sessionStats.value[type] += amount;
  focusStacks.value = Math.min(5, focusStacks.value + 1);
  const entry: ResultEntry = {
    id: `${Date.now()}-${type}`,
    type,
    amount,
    timestamp: Date.now()
  };
  recentResults.value = [entry, ...recentResults.value].slice(0, 5);
};

const clearRecentResults = () => {
  recentResults.value = [];
};

// 更新剩余时间
let updateTimer: number | null = null;
let focusDecayTimer: number | null = null;
const updateRemainingTime = () => {
  if (isActive.value && currentAction.value) {
    const elapsed = Date.now() - (currentAction.value.startTime || Date.now());
    const duration = currentAction.value.duration || 0;
    remainingTime.value = Math.max(0, duration - elapsed);
  } else {
    remainingTime.value = 0;
  }
};

watch(isActive, (newVal) => {
  if (newVal) {
    updateRemainingTime();
    updateTimer = window.setInterval(updateRemainingTime, 100);
  } else {
    if (updateTimer !== null) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
    remainingTime.value = 0;
  }
}, { immediate: true });

onMounted(() => {
  if (isActive.value) {
    updateTimer = window.setInterval(updateRemainingTime, 100);
  }
  focusDecayTimer = window.setInterval(() => {
    if (!isActive.value && focusStacks.value > 0) {
      focusStacks.value = Math.max(0, focusStacks.value - 1);
    }
  }, 60000);
});

onUnmounted(() => {
  if (updateTimer !== null) {
    clearInterval(updateTimer);
  }
  if (focusDecayTimer !== null) {
    clearInterval(focusDecayTimer);
  }
});

// 动作处理
const handleRestoreHp = async () => {
  const before = playerStore.player.stats.hp;
  const res = await playerStore.restoreHp();
  if (res.success) {
    const gain = Math.max(0, playerStore.player.stats.hp - before);
    recordResult('hp', gain);
  }
};

const handleRestoreStamina = async () => {
  const gauge = stamina.value;
  const before = Math.floor(gauge.current || 0);
  const res = await playerStore.restoreStamina();
  if (res.success) {
    const after = Math.floor((stamina.value.current) || 0);
    recordResult('stamina', Math.max(0, after - before));
  }
};

const handleRestoreEnergy = async () => {
  const before = Math.floor(playerStore.player.stats.energy || 0);
  const res = await playerStore.restoreEnergy();
  if (res.success) {
    const after = Math.floor(playerStore.player.stats.energy || 0);
    recordResult('energy', Math.max(0, after - before));
  }
};
</script>

<style scoped>
.meditation-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  background: #f8f8f7;
  height: 100%;
}

.top-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: clamp(12px, 2vw, 24px);
  flex: 1;
  min-height: 0;
}

.timer-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
}

.timer-container {
  position: relative;
  width: 220px;
  height: 220px;
}

.timer-container.active {
  animation: containerPulse 4s ease-in-out infinite;
}

.timer-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

@keyframes containerPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.01);
  }
}

.progress-ring {
  transition: stroke-dashoffset 0.1s linear;
}

.progress-ring.active {
  animation: ringDistort 3s ease-in-out infinite;
  filter: drop-shadow(0 0 8px rgba(17, 17, 17, 0.2));
}

@keyframes ringDistort {
  0%, 100% {
    opacity: 1;
    transform: rotate(-90deg) scale(1);
    filter: drop-shadow(0 0 8px rgba(17, 17, 17, 0.2));
  }
  25% {
    opacity: 0.9;
    transform: rotate(-90deg) scale(1.015) skewX(1deg);
    filter: drop-shadow(0 0 10px rgba(17, 17, 17, 0.3)) drop-shadow(0 0 4px rgba(17, 17, 17, 0.15));
  }
  50% {
    opacity: 0.85;
    transform: rotate(-90deg) scale(1.02) skewX(-1deg);
    filter: drop-shadow(0 0 12px rgba(17, 17, 17, 0.35)) drop-shadow(0 0 6px rgba(17, 17, 17, 0.2));
  }
  75% {
    opacity: 0.9;
    transform: rotate(-90deg) scale(1.015) skewX(0.5deg);
    filter: drop-shadow(0 0 10px rgba(17, 17, 17, 0.3)) drop-shadow(0 0 4px rgba(17, 17, 17, 0.15));
  }
}

.timer-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  width: 100%;
}

.timer-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.status-icon {
  width: 32px;
  height: 32px;
  animation: iconFloat 2.5s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(17, 17, 17, 0.15));
}

@keyframes iconFloat {
  0%, 100% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  25% {
    transform: translateY(-3px) rotate(3deg) scale(1.05);
    opacity: 0.95;
  }
  50% {
    transform: translateY(-5px) rotate(-2deg) scale(1.08);
    opacity: 0.9;
  }
  75% {
    transform: translateY(-3px) rotate(2deg) scale(1.05);
    opacity: 0.95;
  }
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: #111;
  letter-spacing: 0.5px;
}

.status-time {
  font-size: 18px;
  font-weight: 700;
  color: #111;
  font-variant-numeric: tabular-nums;
  animation: timeShake 0.6s ease-in-out infinite;
  text-shadow:
    0 0 2px rgba(17, 17, 17, 0.1),
    1px 1px 0 rgba(17, 17, 17, 0.05);
}

@keyframes timeShake {
  0%, 100% {
    transform: translateX(0) translateY(0);
    opacity: 1;
  }
  20% {
    transform: translateX(-1.5px) translateY(0.5px);
    opacity: 0.95;
  }
  40% {
    transform: translateX(1.5px) translateY(-0.5px);
    opacity: 0.9;
  }
  60% {
    transform: translateX(-1px) translateY(0.3px);
    opacity: 0.95;
  }
  80% {
    transform: translateX(1px) translateY(-0.3px);
    opacity: 0.95;
  }
}

.timer-idle {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  opacity: 0.5;
}

.idle-icon {
  width: 48px;
  height: 48px;
}

.idle-text {
  font-size: 13px;
  color: rgba(17, 17, 17, 0.6);
  font-weight: 500;
}

.insight-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.insight-card {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(17, 17, 17, 0.5);
}

.focus-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.focus-value {
  font-size: 28px;
  font-weight: 600;
}

.focus-hint {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.focus-bars {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.focus-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
}

.focus-bar.filled {
  background: #111;
}

.card-note {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.65);
  margin: 0;
}

.summary-lines {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.8);
}

.summary-line strong {
  font-size: 14px;
}

.recommend-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.recommend-icon {
  font-size: 22px;
}

.result-feed,
.tips-card {
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  padding: 12px;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.feed-title {
  font-size: 14px;
  font-weight: 600;
}

.feed-subtitle {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
  margin: 2px 0 0;
}

.ghost-btn {
  border: 1px solid rgba(17, 17, 17, 0.2);
  background: #fff;
  color: #111;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.ghost-btn.small {
  padding: 4px 10px;
  font-size: 11px;
}

.ghost-btn:hover:not(:disabled),
.ghost-btn.active {
  border-color: rgba(17, 17, 17, 0.5);
  color: #000;
  background: rgba(17, 17, 17, 0.04);
}

.result-feed-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 150px;
  overflow-y: auto;
}

.result-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.06);
  background: rgba(249, 247, 241, 0.7);
}

.feed-icon {
  width: 18px;
  height: 18px;
  color: #16a34a;
}

.feed-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.feed-amount {
  font-weight: 600;
}

.feed-empty {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.tips-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tips-list li {
  display: flex;
  gap: 10px;
  border-radius: 10px;
  border: 1px dashed rgba(17, 17, 17, 0.12);
  padding: 8px 10px;
}

.tip-icon {
  width: 18px;
  height: 18px;
  color: #666;
}

.tips-list p {
  margin: 2px 0 0;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.65);
}

.actions-section {
  padding: 16px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(17, 17, 17, 0.08);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 12px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 90px;
}

.action-btn:hover:not(:disabled) {
  border-color: rgba(17, 17, 17, 0.3);
  background: rgba(249, 249, 248, 0.9);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(17, 17, 17, 0.08);
}

.action-btn:active:not(:disabled) {
  transform: translateY(0);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.6);
}

.btn-icon {
  width: 24px;
  height: 24px;
}

.btn-label {
  font-size: 13px;
  font-weight: 600;
  color: #111;
}

.btn-desc {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.55);
  text-align: center;
  line-height: 1.3;
}

@media (max-width: 900px) {
  .top-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .actions-grid {
    grid-template-columns: 1fr;
  }

  .timer-container {
    width: 180px;
    height: 180px;
  }
}
</style>
