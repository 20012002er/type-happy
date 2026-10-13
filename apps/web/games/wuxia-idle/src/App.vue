<template>
  <div id="app">
    <LoadingState
      v-if="isBooting"
      :progress="progress"
      :message="message"
    />
    <RouterView v-else />

    <!-- 离线收益提示 -->
    <OfflineRewardModal
      v-if="offlineReward"
      :visible="showOfflineReward"
      :reward="offlineReward"
      @close="showOfflineReward = false"
    />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import { onMounted, ref } from 'vue';
import { useTheme } from '@/composables/useTheme';
import LoadingState from '@/components/LoadingState.vue';
import OfflineRewardModal from '@/components/OfflineRewardModal.vue';
import { useMapStore } from '@/stores/mapStore';
import { SaveManager } from '@/services/storage/SaveManager';
import { useAchievementStore } from '@/stores/achievementStore';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';
import { CookingRecipeConfigService } from '@/services/config/CookingRecipeConfigService';
import { SmithingConfigService } from '@/services/config/SmithingConfigService';
import { AlchemyConfigService } from '@/services/config/AlchemyConfigService';
import { offlineConfigService } from '@/services/config/OfflineConfigService';
import { LeatherworkingConfigService } from '@/services/config/LeatherworkingConfigService';
import { offlineRewardService } from '@/services/OfflineRewardService';
import { usePlayerStore } from '@/stores/playerStore';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useReputationStore } from '@/stores/reputationStore';
import { useSectStore } from '@/stores/sectStore';
import { mainStoryService } from '@/services/mainStoryService';
import { restoreAllQueues } from '@/services/QueueRestoreService';
import { sectContributionConfig } from '@/config/sectContributionConfig';
import type { OfflineReward } from '@/types/offline';

const { initTheme } = useTheme();
const isBooting = ref(true);
const progress = ref(0);
const message = ref('正在召唤江湖人士...');

// 离线收益相关
const offlineReward = ref<OfflineReward | null>(null);
const showOfflineReward = ref(false);

const msgs = [
  '正在加载武林秘籍...',
  '正在熬制一锅好茶...',
  '正在生成怪物资源...',
  '正在洗练装备属性...',
  '正在打点江湖形势...',
  '正在请出各门派长老...',
  '正在初始化任务系统...',
  '正在准备生活技能...',
  '正在计算离线收益...',
  '正在恢复队列任务...',
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * 计算并应用离线收益
 */
async function calculateOfflineRewards(saveManager: SaveManager) {
  try {
    // 获取离线快照
    const snapshot = await saveManager.getOfflineSnapshot();
    if (!snapshot) {
      console.log('[OfflineReward] 无离线快照');
      return;
    }

    // 计算离线收益（TODO: 获取玩家拥有的离线时长提升道具）
    const reward = await offlineRewardService.calculateOfflineRewards(snapshot, []);

    if (!reward) {
      console.log('[OfflineReward] 无离线收益');
      return;
    }

    console.log('[OfflineReward] 获得离线收益:', reward);

    // 应用收益到游戏状态
    applyOfflineRewards(reward);

    // 显示离线收益模态框
    offlineReward.value = reward;
    showOfflineReward.value = true;
  } catch (error) {
    console.error('[OfflineReward] 计算离线收益失败:', error);
  }
}

/**
 * 应用离线收益到游戏状态
 */
function applyOfflineRewards(reward: OfflineReward) {
  const playerStore = usePlayerStore();
  const lifeSkillStore = useLifeSkillStore();
  const materialsStore = useMaterialsStore();

  // 应用采集物品
  if (reward.rewards.gatheredItems) {
    for (const item of reward.rewards.gatheredItems) {
      materialsStore.add(item.resourceId, item.quantity, item.resourceName);
      console.log(`[OfflineReward] 添加材料: ${item.resourceName} x${item.quantity}`);
    }
  }

  // 应用技能经验
  if (reward.rewards.skillExp) {
    for (const skill of reward.rewards.skillExp) {
      lifeSkillStore.addExp(skill.skillType as any, skill.exp);
      console.log(`[OfflineReward] 添加技能经验: ${skill.skillType} +${skill.exp}`);
    }
  }

  // 应用角色总经验
  if (reward.rewards.totalExp) {
    playerStore.gainExperience(reward.rewards.totalExp);
    console.log(`[OfflineReward] 添加角色经验: +${reward.rewards.totalExp}`);
  }

  // 应用金币
  if (reward.rewards.gold) {
    playerStore.updateResources({ gold: reward.rewards.gold });
    console.log(`[OfflineReward] 添加金币: +${reward.rewards.gold}`);
  }
}

/**
 * 恢复队列服务
 *
 * 检查所有队列（采集、铸造、烹饪），如果有正在进行的活动，
 * 自动启动对应的服务并注册到 QueueManager
 */
function resumeQueueServices() {
  // 使用统一的队列恢复服务
  restoreAllQueues();
}

onMounted(async () => {
  console.log('[Boot] initTheme');
  initTheme();
  const mapStore = useMapStore();
  const achievementStore = useAchievementStore();
  const save = new SaveManager('local');

  // 进度：0% → 100%，至少1.2s
  const steps = [
    async () => {
      message.value = msgs[0];
      console.log('[Boot] init map');
      await mapStore.initializeMap();
    },
    async () => {
      message.value = msgs[1];
      await sleep(200);
    },
    async () => {
      message.value = msgs[2];
      await save.load();
    },
    async () => {
      message.value = msgs[3];
      await sleep(200);
    },
    async () => {
      message.value = msgs[4];
      await sleep(200);
    },
    async () => {
      message.value = msgs[5];
      await sleep(200);
    },
    async () => {
      message.value = msgs[6];
      console.log('[Boot] init achievements');
      await achievementStore.init();
    },
    async () => {
      message.value = msgs[6];
      console.log('[Boot] init reputation');
      await useReputationStore().init();
    },
    async () => {
      message.value = msgs[6];
      console.log('[Boot] init main story');
      await mainStoryService.init();
    },
    async () => {
      message.value = msgs[7];
      console.log('[Boot] init life skills');
      await LifeSkillConfigService.init();
    },
    async () => {
      message.value = msgs[7];
      console.log('[Boot] init cooking recipes');
      await CookingRecipeConfigService.init();
    },
    async () => {
      message.value = msgs[7];
      console.log('[Boot] init smithing recipes');
      await SmithingConfigService.init();
    },
    async () => {
      message.value = msgs[7];
      console.log('[Boot] init alchemy recipes');
      await AlchemyConfigService.init();
    },
    async () => {
      message.value = msgs[7];
      console.log('[Boot] init leatherworking recipes');
      await LeatherworkingConfigService.init();
    },
    async () => {
      message.value = msgs[7];
      console.log('[Boot] init sect contribution config');
      await sectContributionConfig.load();
    },
    async () => {
      message.value = msgs[8];
      console.log('[Boot] init offline config');
      await offlineConfigService.init();
    },
    async () => {
      message.value = msgs[8];
      console.log('[Boot] calculate offline rewards');
      await calculateOfflineRewards(save);
    },
    async () => {
      message.value = msgs[9];
      console.log('[Boot] resume queue services');
      resumeQueueServices();
    },
  ];

  const minBootMs = 1200;
  const start = performance.now();
  for (let i = 0; i < steps.length; i++) {
    await steps[i]();
    progress.value = Math.min(100, Math.round(((i + 1) / steps.length) * 100));
  }
  const spent = performance.now() - start;
  if (spent < minBootMs) await sleep(minBootMs - spent);
  isBooting.value = false;
});
</script>

<style>
/* 基础样式重置 */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family-primary);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* 引入设计系统变量 */
:root {
  /* 主色调 - 纯黑白灰 */
  --color-black: #000000;
  --color-white: #ffffff;
  --color-gray-light: #f5f5f5;
  --color-gray-medium: #cccccc;
  --color-gray-dark: #666666;

  /* 文字颜色 */
  --color-text-primary: #000000;
  --color-text-secondary: #666666;
  --color-text-muted: #999999;

  /* 背景色 */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-hover: #f0f0f0;

  /* 边框颜色 */
  --color-border-light: #e0e0e0;
  --color-border-medium: #cccccc;
  --color-border-dark: #999999;

  /* 字体设置 */
  --font-family-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: 'Courier New', Consolas, monospace;

  /* 字体大小 */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* 间距 */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* 边框宽度 */
  --border-width-thin: 1px;
  --border-width-medium: 2px;
  --border-width-thick: 3px;
}
</style>
