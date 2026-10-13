<template>
  <div class="left-sidebar">
    <!-- 
      菜单分类说明（按新手引导流程排序）：
      0. 任务系统 - 新手引导和目标指引
      1. 采集技能 - 基础采集类生活技能（5个）
      2. 加工技能 - 初级加工类生活技能（6个）
      3. 修炼 - 角色成长玩法
      4. 战斗 - 核心战斗玩法
      5. 精炼技能 - 高级精炼类生活技能（4个）
      6. 其他功能 - 装备相关功能
      7. 经营 - 交易和门派相关
      8. 系统 - 设置等
      
      版本标记：
      - V1.0 - MVP阶段（优先实现）
      - V1.5 - 扩展阶段
      - V2.0 - 完整阶段
    -->
    <nav class="menu-nav">
      <!-- 0.1 主线剧情 -->
      <div class="menu-category">
        <div class="category-title">
          <BookOpen class="category-icon" />
          主线剧情
        </div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ active: currentView === 'mainStory' }"
            @click="changeView('mainStory')"
          >
            主线剧情
            <span
              class="badge"
              v-if="fragmentCount > 0"
              >{{ fragmentCount }}</span
            >
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'achievements' }"
            @click="changeView('achievements')"
          >
            成就进度
          </button>
        </div>
      </div>

      <!-- 1. 采集技能 - 基础层 -->
      <div class="menu-category">
        <div class="category-title">
          <Leaf class="category-icon" />
          采集技能
        </div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ active: currentView === 'herbGathering' }"
            @click="changeView('herbGathering')"
            title="游戏开始即可采集"
          >
            采药
            <span class="badge">Lv{{ herbGatheringLevel }}</span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'fishing' }"
            @click="changeView('fishing')"
            title="游戏开始即可钓鱼"
          >
            钓鱼
            <span class="badge">Lv{{ fishingLevel }}</span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'woodcutting' }"
            @click="changeView('woodcutting')"
            title="游戏开始即可采集"
          >
            伐木
            <span class="badge">Lv{{ woodcuttingLevel }}</span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'mining' }"
            @click="changeView('mining')"
            title="游戏开始即可采矿"
          >
            采矿
            <span class="badge">Lv{{ miningLevel }}</span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'hunting' }"
            @click="changeView('hunting')"
            title="锻炼身手，猎取珍贵兽材"
          >
            狩猎
            <span class="badge">Lv{{ huntingLevel }}</span>
          </button>
        </div>
      </div>

      <!-- 2. 加工技能 - 中级层 -->
      <div class="menu-category">
        <div class="category-title">
          <Hammer class="category-icon" />
          制作技能
        </div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ active: currentView === 'alchemy' }"
            @click="changeView('alchemy')"
            title="炼制各种丹药"
          >
            炼丹
            <span class="badge">Lv{{ alchemyLevel }}</span>
          </button>
          <button
            class="menu-item disabled"
            disabled
            v-if="false"
          >
            炼丹（旧）
            <InfoPopover
              type="generic"
              title="炼丹（未解锁）"
              description="解锁条件：\n• 采药技能达到 Lv10\n• 拜师炼丹师"
            >
              <Lock class="badge lock-badge" />
            </InfoPopover>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'cooking' }"
            @click="changeView('cooking')"
            title="游戏开始即可烹饪"
          >
            烹饪
            <span class="badge">Lv{{ cookingLevel }}</span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'materialsSmithing' }"
            @click="changeView('materialsSmithing')"
            title="锻造原材与中间材料"
          >
            锻材
            <span class="badge">Lv{{ smithingLevel }}</span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'leatherworking' }"
            @click="changeView('leatherworking')"
            title="制皮：加工狩猎所得兽材"
          >
            制皮
            <span class="badge">Lv{{ leatherworkingLevel }}</span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'smithing' }"
            @click="changeView('smithing')"
            title="游戏开始即可铸造"
          >
            铸造
            <span class="badge">Lv{{ smithingLevel }}</span>
          </button>
        </div>
      </div>

      <!-- 3. 修炼类 -->
      <div class="menu-category">
        <div class="category-title">
          <Sparkles class="category-icon" />
          修炼
        </div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ active: currentView === 'seclusion' }"
            @click="changeView('seclusion')"
          >
            闭关修炼
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'talentTree' }"
            @click="changeView('talentTree')"
          >
            武学修炼
            <span class="badge">悟性 {{ talentInsight }}</span>
          </button>
          <button
            class="menu-item disabled"
            disabled
          >
            内功心法
            <span class="badge">未开放</span>
          </button>
        </div>
      </div>

      <!-- 4. 战斗类 -->
      <div class="menu-category">
        <div class="category-title">
          <Sword class="category-icon" />
          战斗
        </div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ active: currentView === 'explore' }"
            @click="changeView('explore')"
          >
            闯荡江湖
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'convoy' }"
            @click="changeView('convoy')"
          >
            押镖
          </button>
          <button
            class="menu-item disabled"
            disabled
          >
            武林大会
            <span class="badge">未开放</span>
          </button>
        </div>
      </div>

      <!-- 5. 精炼技能 - 高级层 -->

      <!-- 6. 其他功能 -->

      <!-- 7. 经营类 -->
      <div class="menu-category">
        <div class="category-title">
          <Coins class="category-icon" />
          经营
        </div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ active: currentView === 'reputation' }"
            @click="changeView('reputation')"
          >
            江湖声望
            <span
              class="badge reputation-badge"
              :class="reputationStatusClass"
            >
              {{ reputationLevelName }}
            </span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'titles' }"
            @click="changeView('titles')"
          >
            称号
            <span class="badge title-badge">
              {{ unlockedTitlesCount }}/{{ totalTitlesCount }}
            </span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'jianghuRanking' }"
            @click="changeView('jianghuRanking')"
          >
            江湖榜
            <span class="badge ranking-badge">
              {{ playerRank }}
            </span>
          </button>
          <!-- 门派入口 -->
          <button
            class="menu-item"
            :class="{ active: currentView === 'sect' }"
            @click="changeView('sect')"
          >
            门派
            <span class="badge sect-badge">
              {{ sectMenuBadgeText }}
            </span>
          </button>
          <button
            class="menu-item"
            :class="{ active: currentView === 'market' }"
            @click="changeView('market')"
          >
            江湖集市
          </button>
        </div>
      </div>

      <!-- 8. 系统 -->
      <div class="menu-category">
        <div class="category-title">
          <Settings class="category-icon" />
          设置
        </div>
        <div class="menu-items">
          <button
            class="menu-item"
            :class="{ active: currentView === 'settings' }"
            @click="changeView('settings')"
          >
            游戏设置
          </button>
        </div>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Medal, BookOpen, Leaf, Hammer, Sparkles, Sword, Coins, Settings, Lock, Lamp } from 'lucide-vue-next';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { LifeSkillType } from '@/types/lifeSkill';
import InfoPopover from './InfoPopover.vue';
import { useTalentTreeStore } from '@/stores/talentTreeStore';
import { useReputationStore } from '@/stores/reputationStore';
import { useTitleStore } from '@/stores/titleStore';
import { useMainStoryStore } from '@/stores/mainStoryStore';
import { useJianghuRankingStore } from '@/stores/jianghuRankingStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useSectStore } from '@/stores/sectStore';

interface Props {
  currentView?: string;
}

interface Emits {
  (e: 'view-change', view: string): void;
  (e: 'navigate', path: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  currentView: 'achievements',
});

const emit = defineEmits<Emits>();

const lifeSkillStore = useLifeSkillStore();
const talentTreeStore = useTalentTreeStore();

// 获取各个技能的等级
const herbGatheringLevel = computed(() =>
  lifeSkillStore.getSkillLevel(LifeSkillType.HERB_GATHERING)
);
const fishingLevel = computed(() => lifeSkillStore.getSkillLevel(LifeSkillType.FISHING));
const woodcuttingLevel = computed(() => lifeSkillStore.getSkillLevel(LifeSkillType.WOODCUTTING));
const huntingLevel = computed(() => lifeSkillStore.getSkillLevel(LifeSkillType.HUNTING));
const miningLevel = computed(() => lifeSkillStore.getSkillLevel(LifeSkillType.MINING));
const alchemyLevel = computed(() => lifeSkillStore.getSkillLevel(LifeSkillType.ALCHEMY));
const cookingLevel = computed(() => lifeSkillStore.getSkillLevel(LifeSkillType.COOKING));
const smithingLevel = computed(() => lifeSkillStore.getSkillLevel(LifeSkillType.SMITHING));
const leatherworkingLevel = computed(() =>
  lifeSkillStore.getSkillLevel(LifeSkillType.LEATHERWORKING)
);
const talentInsight = computed(() => talentTreeStore.availableInsight);

const reputationStore = useReputationStore();
const reputationLevelName = computed(() => reputationStore.levelName);
const reputationStatusClass = computed(() => {
  const points = reputationStore.reputation.jianghu;
  if (points >= 0) return 'reputation-good';
  if (points >= -100) return 'reputation-neutral';
  return 'reputation-evil';
});

const titleStore = useTitleStore();
const unlockedTitlesCount = computed(() => titleStore.getUnlockedCount());
const totalTitlesCount = computed(() => titleStore.getTotalCount());

const mainStoryStore = useMainStoryStore();
const fragmentCount = computed(() => mainStoryStore.collectedCount);

const jianghuRankingStore = useJianghuRankingStore();
const playerStore = usePlayerStore();
const sectStore = useSectStore();
const playerLevel = computed(() => playerStore.player.stats.level);
const playerRank = computed(() => {
  const rankingTypes = Object.keys(jianghuRankingStore.configs || {}) as Array<
    keyof typeof jianghuRankingStore.configs
  >;
  if (rankingTypes.length === 0) return '未上榜';
  const defaultType = rankingTypes[0];
  const rank = jianghuRankingStore.getPlayerRank(defaultType, playerStore.player.id);
  return rank !== undefined ? `第${rank}名` : '未上榜';
});

const sectMenuBadgeText = computed(() => {
  if (sectStore.hasJoinedSect) {
    return sectStore.currentSect?.name ?? '已入门';
  }

  if (playerLevel.value >= 10) {
    return '可加入';
  }

  return `Lv${Math.max(10 - playerLevel.value, 0)}差距`;
});

onMounted(() => {
  talentTreeStore.initialize();
  reputationStore.init();
  titleStore.init();
  mainStoryStore.init && mainStoryStore.init([], {});
});

const changeView = (view: string) => {
  emit('view-change', view);
};
</script>

<style scoped>
.left-sidebar {
  background: #f8f8f7;
  border-right: 1px solid rgba(17, 17, 17, 0.12);
  overflow-y: auto;
  height: 100%;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.menu-nav {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.menu-category {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  color: rgba(17, 17, 17, 0.78);
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.12);
}

.category-icon {
  width: 14px;
  height: 14px;
}

.menu-icon {
  width: 14px;
  height: 14px;
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  color: #111;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.menu-item:hover:not(:disabled) {
  border-color: rgba(17, 17, 17, 0.3);
  background: rgba(17, 17, 17, 0.05);
}

.menu-item.active {
  border-color: #111;
  background: #111;
  color: #fff;
  font-weight: 600;
}

.menu-item.disabled,
.menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.6);
}

.badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(17, 17, 17, 0.15);
  background: rgba(17, 17, 17, 0.04);
  color: rgba(17, 17, 17, 0.7);
}

.menu-item.active .badge {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.menu-item.active .title-badge {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.menu-item.active .ranking-badge {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.menu-item.active .contribution-badge {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.menu-item.active .sect-badge {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.lock-badge {
  border-color: rgba(17, 17, 17, 0.18);
  background: rgba(17, 17, 17, 0.06);
  color: rgba(17, 17, 17, 0.65);
  width: 12px;
  height: 12px;
}

.reputation-badge.reputation-good {
  border-color: rgba(0, 0, 0, 0.3);
  background: rgba(0, 0, 0, 0.08);
  color: #000;
}

.reputation-badge.reputation-neutral {
  border-color: rgba(100, 100, 100, 0.3);
  background: rgba(100, 100, 100, 0.1);
  color: #666;
}

.reputation-badge.reputation-evil {
  border-color: rgba(150, 150, 150, 0.3);
  background: rgba(150, 150, 150, 0.1);
  color: #999;
}

.title-badge {
  border-color: rgba(147, 51, 234, 0.3);
  background: rgba(147, 51, 234, 0.1);
  color: #9333ea;
}

.ranking-badge {
  border-color: rgba(17, 17, 17, 0.3);
  background: rgba(17, 17, 17, 0.08);
  color: #111;
}

.contribution-badge {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.sect-badge {
  border-color: rgba(234, 88, 12, 0.3);
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

@media (max-width: 1024px) {
  .left-sidebar {
    padding: 14px;
  }
}

/* 滚动条样式 */
.left-sidebar::-webkit-scrollbar {
  width: 8px;
}

.left-sidebar::-webkit-scrollbar-track {
  background: #f0f0f0;
}

.left-sidebar::-webkit-scrollbar-thumb {
  background: #ccc;
  border: 1px solid #999;
}

.left-sidebar::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
