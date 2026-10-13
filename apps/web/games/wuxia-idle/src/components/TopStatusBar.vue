<template>
  <div class="top-status-bar">
    <div
      class="logo-section"
      title="WuXia Idle"
    >
      <img
        :src="logoSrc"
        alt="WuXia Idle 标识"
        class="logo-image"
      />
    </div>

    <div class="content-sections">
      <!-- 左侧：角色信息 -->
      <div
        class="left-section"
        @click="openProfileModal"
        title="点击编辑角色资料"
      >
        <component :is="currentAvatarIcon" class="player-avatar" />
        <span class="player-name">{{ player.name }}</span>
        <span class="separator">|</span>
        <span class="player-level">Lv.{{ player.stats.level }}</span>
        <div class="exp-bar">
          <div
            class="exp-progress"
            :style="{ width: expProgress + '%' }"
          ></div>
          <span class="exp-text">{{ currentExp }}/{{ requiredExp }}</span>
        </div>
      </div>

      <!-- 中间：活动队列 -->
      <div class="center-section">
        <div
          v-if="currentActivity"
          class="activity-queue"
        >
          <span class="activity-name">{{ currentActivity.name }}</span>
          <div
            class="activity-progress-bar"
            :class="{ indeterminate: currentActivity.progress < 0 }"
          >
            <div
              v-if="currentActivity.progress >= 0"
              class="activity-progress"
              :style="{ width: currentActivity.progress + '%' }"
            ></div>
            <div
              v-else
              class="activity-progress-indeterminate"
            ></div>
          </div>
          <span class="activity-time">{{ formatTime(currentActivity.remaining) }}</span>
        </div>
        <span
          v-else
          class="idle-text"
          >空闲中...</span
        >
      </div>

      <!-- 右侧：Buff/Debuff -->
      <div class="right-section">
        <div class="effects">
          <div
            v-for="effect in activeEffects"
            :key="effect.id"
            class="effect-icon"
            :class="effect.type"
            :title="`${effect.name}\n${formatTime(effect.remaining)}`"
          >
            {{ effect.icon || '●' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 角色资料编辑模态框 -->
    <PlayerProfileModal
      :visible="showProfileModal"
      :current-name="player.name"
      :current-avatar="player.avatar"
      @close="showProfileModal = false"
      @save="handleProfileSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Component } from 'vue';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueManager } from '@/services/QueueManagerService';
import { useSeclusionStore } from '@/stores/seclusionStore';
import { StatusEffectService } from '@/services/StatusEffectService';
import { User, Shirt, Skull, Sword, Shield, Crosshair, Theater, Ghost, Glasses, Crown, CircleUser, Baby, Hexagon, Circle, Sparkles } from 'lucide-vue-next';
import PlayerProfileModal from './PlayerProfileModal.vue';

import gameLogo from '@/assets/game-logo.png';

const playerStore = usePlayerStore();
const seclusionStore = useSeclusionStore();
const { getCurrentTaskInfo } = useQueueManager();
const logoSrc = gameLogo;

// 强制刷新标志，用于定时更新进度条
const refreshTrigger = ref(0);

// 模态框状态
const showProfileModal = ref(false);

const player = computed(() => playerStore.player);

// 头像选项 - 与 PlayerProfileModal 保持一致
const avatarOptions: { id: string; icon: Component; label: string }[] = [
  { id: 'ninja', icon: Shirt, label: '忍者' },
  { id: 'mage', icon: Sparkles, label: '法师' },
  { id: 'hero', icon: Skull, label: '超级英雄' },
  { id: 'person', icon: CircleUser, label: '剪影' },
  { id: 'sword', icon: Sword, label: '剑' },
  { id: 'shield', icon: Shield, label: '盾牌' },
  { id: 'crosshair', icon: Crosshair, label: '弓箭' },
  { id: 'mask', icon: Theater, label: '面具' },
  { id: 'demon', icon: Ghost, label: '妖怪' },
  { id: 'cool', icon: Glasses, label: '墨镜' },
  { id: 'cowboy', icon: Crown, label: '牛仔' },
  { id: 'man', icon: User, label: '男人' },
  { id: 'woman', icon: CircleUser, label: '女人' },
  { id: 'adult', icon: CircleUser, label: '人' },
  { id: 'child', icon: Baby, label: '婴儿' },
  { id: 'elder', icon: Circle, label: '老人' },
  { id: 'dragon', icon: Hexagon, label: '龙' },
];

const currentAvatarIcon = computed(() => {
  const avatar = avatarOptions.find(a => a.id === player.value.avatar);
  return avatar?.icon || CircleUser;
});

const expProgress = computed(() => playerStore.expProgress);
const currentExp = computed(() => player.value.stats.currentExp);
const requiredExp = computed(() => player.value.stats.requiredExp);

/**
 * 当前活动
 *
 * 通过统一的队列管理器获取当前活动任务
 * 这样无需关心具体是哪种类型的队列（采集/铸造/烹饪等）
 * 符合开闭原则：新增队列类型无需修改此处代码
 */
const currentActivity = computed(() => {
  // 依赖refreshTrigger触发重新计算（实现定时刷新）
  refreshTrigger.value;

  // 优先级1: 检查闭关状态
  if (seclusionStore.isActive) {
    const typeNames: Record<string, string> = {
      practice: '闭门练功',
      sparring: '对招演练',
      reading: '抄经读谱',
    };
    const typeName = typeNames[seclusionStore.currentType || ''] || '闭关';

    return {
      name: typeName,
      progress: seclusionStore.progressPercent * 100,
      remaining: seclusionStore.remainingMs,
    };
  }

  // 优先级2: 从队列管理器获取当前任务
  const taskInfo = getCurrentTaskInfo();
  if (taskInfo) {
    // 如果任务提供了阶段描述，优先使用阶段描述
    const displayName = taskInfo.phaseDescription
      ? formatTaskName(taskInfo.type, taskInfo.name) + ' - ' + taskInfo.phaseDescription
      : formatTaskName(taskInfo.type, taskInfo.name);

    return {
      name: displayName,
      progress: taskInfo.progress,
      remaining: taskInfo.remaining,
    };
  }

  // 优先级3: 玩家其他状态（如战斗、打坐等）
  if (playerStore.isBusy) {
    return {
      name: getActivityName(player.value.state),
      progress: 0, // TODO: 实际进度
      remaining: 0, // TODO: 剩余时间
    };
  }

  return null;
});

/**
 * 格式化任务名称（添加类型标签）
 */
const formatTaskName = (type: string, name: string): string => {
  const typeLabels: Record<string, string> = {
    gathering: '采集',
    smithing: '铸造',
    cooking: '烹饪',
    alchemy: '炼丹',
    seclusion: '闭关',
    combat: '战斗',
    exploring: '探索',
  };

  const label = typeLabels[type] || '任务';
  return `${label}: ${name}`;
};

// 活动效果
const activeEffects = computed(() => {
  return StatusEffectService.getActiveEffectsDetailed().map(eff => ({
    id: eff.id,
    name: eff.name,
    type: 'buff', // 默认为buff类型
    remaining: eff.remainingMs,
    icon: getEffectIcon('buff'),
  }));
});

const getActivityName = (state: string): string => {
  const stateMap: Record<string, string> = {
    idle: '空闲',
    meditating: '打坐',
    practicing: '练功',
    exploring: '闯荡',
    resting: '休息',
    combat: '战斗',
  };
  return stateMap[state] || '未知';
};

const getEffectIcon = (type?: string): string => {
  const iconMap: Record<string, string> = {
    buff: '↑',
    debuff: '↓',
    neutral: '●',
  };
  return iconMap[type || 'neutral'] || '●';
};

const formatTime = (ms: number): string => {
  // 如果时间为0，表示不确定时长（如战斗中）
  if (ms <= 0) return '进行中';

  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
};

// 资料编辑相关方法
const openProfileModal = () => {
  showProfileModal.value = true;
};

const handleProfileSave = (data: { name: string; avatar: string }) => {
  playerStore.updateProfile(data.name, data.avatar);
};

// 定时刷新进度条
let refreshTimer: number | null = null;

onMounted(() => {
  // 每100ms刷新一次，确保进度条平滑更新
  refreshTimer = window.setInterval(() => {
    refreshTrigger.value++;
  }, 100);
});

onUnmounted(() => {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<style scoped>
.top-status-bar {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 16px;
  padding: 10px 18px;
  background: #fdfdfc;
  border-bottom: 1px solid rgba(17, 17, 17, 0.12);
  min-height: 54px;
}

.logo-section {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.content-sections {
  display: grid;
  grid-template-columns: minmax(260px, 0.7fr) minmax(180px, 1fr) minmax(140px, 0.5fr);
  gap: 14px;
  align-items: center;
}

/* 左侧区域 */
.left-section {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 10px;
  transition: background 0.15s ease;
}

.left-section:hover {
  background: rgba(17, 17, 17, 0.05);
}

.player-avatar {
  width: 24px;
  height: 24px;
}

.player-name {
  font-weight: 600;
  font-size: 14px;
}

.separator {
  color: rgba(17, 17, 17, 0.35);
}

.player-level {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.55);
}

.exp-bar {
  position: relative;
  flex: 1;
  height: 10px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.exp-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #111;
  transition: width 0.3s ease;
}

.exp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

/* 中间区域 */
.center-section {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.activity-queue {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 460px;
}

.activity-name {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-progress-bar {
  position: relative;
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  overflow: hidden;
}

.activity-progress {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #111, #333);
  transition: width 0.2s ease;
}

/* 不确定时长的循环动画进度条 */
.activity-progress-indeterminate {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #111, rgba(17, 17, 17, 0.1));
  animation: indeterminate-progress 1.2s ease-in-out infinite;
}

@keyframes indeterminate-progress {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(10%);
  }
  100% {
    transform: translateX(120%);
  }
}

.activity-time {
  font-size: 11px;
  color: rgba(17, 17, 17, 0.45);
  white-space: nowrap;
}

.idle-text {
  font-size: 12px;
  color: rgba(17, 17, 17, 0.45);
}

/* 右侧区域 */
.right-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.effects {
  display: flex;
  align-items: center;
  gap: 6px;
}

.effect-icon {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid rgba(17, 17, 17, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: rgba(17, 17, 17, 0.04);
  color: rgba(17, 17, 17, 0.7);
}

.effect-icon:hover {
  background: #f0f0f0;
  transform: scale(1.1);
}

.effect-icon.buff {
  border-color: #000;
}

.effect-icon.debuff {
  border-color: #666;
  background: #f5f5f5;
}

/* 响应式 */
@media (max-width: 1200px) {
  .content-sections {
    grid-template-columns: minmax(220px, 1fr) minmax(160px, 1fr) minmax(120px, 0.5fr);
    gap: 12px;
  }
}

@media (max-width: 960px) {
  .top-status-bar {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }

  .content-sections {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .center-section {
    justify-content: flex-start;
  }

  .right-section {
    justify-content: flex-start;
  }
}
</style>
