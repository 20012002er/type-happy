<template>
  <div class="game-layout">
    <!-- 顶部状态栏 -->
    <TopStatusBar />

    <!-- 主要游戏区域 -->
    <main class="game-main">
      <!-- 左侧菜单栏 -->
      <LeftSidebar
        ref="leftSidebarRef"
        :current-view="currentView"
        @view-change="handleViewChange"
        @navigate="handleNavigate"
      />

      <!-- 中央内容区 -->
      <section class="game-content">
        <!-- 根据当前视图动态显示内容 -->
        <component
          :is="currentViewComponent"
          v-bind="currentViewProps"
          @quick-nav="handleQuickNav"
        />
      </section>

      <!-- 右侧面板 -->
      <RightSidebar />
    </main>

    <!-- 成就通知 -->
    <AchievementNotification ref="achievementNotificationRef" />

    <!-- 升级动画 -->
    <LevelUpAnimation
      :visible="showLevelUpAnimation"
      :from-level="levelUpData.fromLevel"
      :to-level="levelUpData.toLevel"
      :gains="levelUpData.gains"
      @close="closeLevelUpAnimation"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, markRaw } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '@/composables/useTheme';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useLevelUpAnimationStore } from '@/stores/levelUpAnimationStore';
import TopStatusBar from '@/components/TopStatusBar.vue';
import LeftSidebar from '@/components/LeftSidebar.vue';
import RightSidebar from '@/components/RightSidebar.vue';
import LevelUpAnimation from '@/components/LevelUpAnimation.vue';
import AchievementNotification from '@/components/AchievementNotification.vue';
import { startAutoSave } from '@/services/autoSave';
import { useAchievementStore } from '@/stores/achievementStore';

// 导入视图组件
import ActionButtons from '@/components/ActionButtons.vue';
import MapNavigation from '@/components/MapNavigation.vue';
import MartialPanel from '@/components/MartialPanel.vue';
import SynthesisPanel from '@/components/SynthesisPanel.vue';
import AchievementPanel from '@/components/AchievementPanel.vue';
import HerbGatheringPanel from '@/components/HerbGatheringPanel.vue';
import WoodcuttingPanel from '@/components/WoodcuttingPanel.vue';
import FishingPanel from '@/components/FishingPanel.vue';
import MiningPanel from '@/components/MiningPanel.vue';
import CookingPanel from '@/components/CookingPanel.vue';
import AlchemyPanel from '@/components/AlchemyPanel.vue';
import SmithingPanel from '@/components/SmithingPanel.vue';
import MaterialsSmithingPanel from '@/components/MaterialsSmithingPanel.vue';
import LeatherworkingPanel from '@/components/LeatherworkingPanel.vue';
import HuntingPanel from '@/components/HuntingPanel.vue';
import TalentTreePanel from '@/components/TalentTreePanel.vue';
import CombatView from '@/views/CombatView.vue';
import ConvoyView from '@/views/ConvoyView.vue';
import MarketView from '@/views/MarketView.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import DungeonPanel from '@/components/DungeonPanel.vue';
import SeclusionPanel from '@/components/SeclusionPanel.vue';
import ReputationPanel from '@/components/ReputationPanel.vue';
import TitlePanel from '@/components/TitlePanel.vue';
import MainStoryPanel from '@/components/MainStoryPanel.vue';
import JianghuRankingPanel from '@/components/JianghuRankingPanel.vue';
import SectPanel from '@/components/SectPanel.vue';
import { normalizeGameView } from './gameViewRouting';

const router = useRouter();
const { initTheme } = useTheme();
const playerStore = usePlayerStore();
const gameLogStore = useGameLogStore();
const levelUpAnimationStore = useLevelUpAnimationStore();
const achievementStore = useAchievementStore();

// Refs
const achievementNotificationRef = ref<InstanceType<typeof AchievementNotification>>();
const leftSidebarRef = ref<InstanceType<typeof LeftSidebar>>();

// 视图组件映射
const viewComponents = markRaw({
  seclusion: SeclusionPanel,
  explore: CombatView,
  convoy: ConvoyView,
  market: MarketView,
  settings: SettingsPanel,
  martial: MartialPanel,
  synthesis: SynthesisPanel,
  achievements: AchievementPanel,
  herbGathering: HerbGatheringPanel,
  fishing: FishingPanel,
  hunting: HuntingPanel,
  woodcutting: WoodcuttingPanel,
  mining: MiningPanel,
  cooking: CookingPanel,
  alchemy: AlchemyPanel,
  leatherworking: LeatherworkingPanel,
  materialsSmithing: MaterialsSmithingPanel,
  smithing: SmithingPanel,
  talentTree: TalentTreePanel,
  dungeon: DungeonPanel,
  reputation: ReputationPanel,
  sect: SectPanel,
  titles: TitlePanel,
  mainStory: MainStoryPanel,
  jianghuRanking: JianghuRankingPanel,
});

// LocalStorage key for saving current view
const LAST_VIEW_KEY = 'wuxia-idle-last-view';

/**
 * 从 localStorage 恢复上次的视图
 * 如果上次的视图不存在，默认返回 'achievements'
 */
function restoreLastView(): string {
  try {
    const savedView = localStorage.getItem(LAST_VIEW_KEY);
    const normalizedView = savedView ? normalizeGameView(savedView) : '';
    if (normalizedView && normalizedView in viewComponents) {
      console.log('[GameView] 恢复上次视图:', normalizedView);
      return normalizedView;
    }
  } catch (error) {
    console.warn('[GameView] 恢复视图失败:', error);
  }

  // 默认显示成就面板
  console.log('[GameView] 使用默认视图: achievements');
  return 'achievements';
}

// 当前视图 - 从 localStorage 恢复
const currentView = ref(restoreLastView());

// 当前视图组件
const currentViewComponent = computed(() => {
  return viewComponents[currentView.value as keyof typeof viewComponents] || ActionButtons;
});

// 当前视图Props
const currentViewProps = computed(() => {
  // 根据不同视图返回不同的props
  return {};
});

// 处理视图切换
const handleViewChange = (view: string) => {
  const normalizedView = normalizeGameView(view);
  currentView.value = normalizedView;
  console.log('[GameView] 切换视图:', normalizedView);

  // 保存当前视图到 localStorage
  try {
    localStorage.setItem(LAST_VIEW_KEY, normalizedView);
  } catch (error) {
    console.warn('[GameView] 保存视图失败:', error);
  }
};

// 处理导航
const handleNavigate = (path: string) => {
  router.push(`/${path}`);
};

// 处理快捷导航（从任务跳转）
const handleQuickNav = (target: string) => {
  console.log('[GameView] 快捷导航:', target);

  // 根据target切换到对应的视图
  const viewMap: Record<string, string> = {
    meditation: 'seclusion',
    seclusion: 'seclusion',
    forest_path: 'explore',
    mountain_trail: 'explore',
    equipment: 'equipment',
    synthesis: 'synthesis',
    martial: 'martial',
    dungeon: 'dungeon',
  };

  const targetView = normalizeGameView(viewMap[target] || target);

  // 检查视图是否存在
  if (targetView in viewComponents) {
    currentView.value = targetView;

    // 保存当前视图到 localStorage
    try {
      localStorage.setItem(LAST_VIEW_KEY, targetView);
    } catch (error) {
      console.warn('[GameView] 保存视图失败:', error);
    }

    console.log('[GameView] 已切换到视图:', targetView);
  } else {
    console.warn('[GameView] 未找到对应视图:', target);
  }
};

// 升级动画状态（从store获取）
const showLevelUpAnimation = computed(() => levelUpAnimationStore.showAnimation);
const levelUpData = computed(() => levelUpAnimationStore.animationData);

// 关闭升级动画
const closeLevelUpAnimation = () => {
  levelUpAnimationStore.closeLevelUpAnimation();
};

// 组件挂载时初始化
onMounted(() => {
  // 初始化主题
  initTheme();

  // 初始化游戏日志系统
  if (gameLogStore.logs.length === 0) {
    gameLogStore.initializeDefaultLogs();
  }

  // 初始化玩家数据
  if (!playerStore.player.name) {
    playerStore.initializePlayer('无名侠客');
  }

  // 注册成就通知回调
  if (achievementNotificationRef.value) {
    achievementStore.registerNotificationCallback(notification => {
      achievementNotificationRef.value?.show({
        type: 'completed',
        title: notification.title,
        message: notification.message,
      });
    });
  }

  // 启动自动保存
  startAutoSave();
});
</script>

<style scoped>
.game-layout {
  display: grid;
  grid-template-rows: 60px 1fr;
  height: 100vh;
  background-color: #fff;
  font-family: var(--font-family-primary);
  color: #000;
  overflow: hidden;
}

.game-main {
  display: grid;
  grid-template-columns: 200px 1fr 320px;
  height: 100%;
  overflow: hidden;
}

.game-content {
  background: #fff;
  padding: 0;
  overflow-y: auto;
  border-left: 1px solid #000;
  border-right: 1px solid #000;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .game-main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}
</style>
