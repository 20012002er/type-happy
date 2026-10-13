/**
 * 称号系统状态管理
 * 负责管理玩家称号数据的持久化和状态更新
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import JSON5 from 'json5';
import type { Title, OwnedTitle, TitleEquipResult, TitleBonus } from '@/types/title';
import TITLES_RAW from '@/assets/configs/titles.json5?raw';
import { useReputationStore } from './reputationStore';
import { usePlayerStore } from './playerStore';

const titlesConfig = JSON5.parse(TITLES_RAW) as {
  titles: Title[];
  categories: { id: string; name: string; description: string }[];
};

export interface TitleSaveEntry {
  ownedTitles: Array<{
    titleId: string;
    unlockedAt: number;
    isEquipped: boolean;
    source?: string;
  }>;
}

export const useTitleStore = defineStore('title', () => {
  // 所有称号配置
  const allTitles = ref<Title[]>(titlesConfig.titles);

  // 玩家拥有的称号
  const ownedTitles = ref<OwnedTitle[]>([]);

  // 初始化状态
  const initialized = ref(false);

  // 计算属性：已解锁的称号
  const unlockedTitles = computed(() => {
    return allTitles.value.filter(title =>
      ownedTitles.value.some(owned => owned.titleId === title.id)
    );
  });

  // 计算属性：可解锁但未解锁的称号
  const unlockableTitles = computed(() => {
    return allTitles.value.filter(title => {
      if (ownedTitles.value.some(owned => owned.titleId === title.id)) {
        return false;
      }
      return canUnlockInternal(title);
    });
  });

  // 计算属性：装备的称号
  const equippedTitle = computed(() => {
    return ownedTitles.value.find(owned => owned.isEquipped);
  });

  // 检查称号是否可解锁（内部方法）
  function canUnlockInternal(title: Title): boolean {
    if (title.requirements.length === 0) {
      // 无要求的称号（初始称号）
      return true;
    }

    return title.requirements.every(req => {
      switch (req.type) {
        case 'reputation_level':
          const reputationStore = useReputationStore();
          return reputationStore.reputation.jianghu >= (req.value as number);

        case 'level':
          const playerStore = usePlayerStore();
          return playerStore.player.stats.level >= (req.value as number);

        case 'achievement':
          // 后续实现成就系统后检查
          return false;

        case 'sect_rank':
          // 后续实现门派系统后检查
          return false;

        case 'jianghu_rank':
          // 后续实现江湖榜系统后检查
          return false;

        case 'life_skill':
          // 后续实现生活技能系统后检查
          return false;

        case 'custom':
          // 自定义条件需要特殊处理
          if (req.value === 'join_sect') {
            return false; // 后续实现门派系统后检查
          }
          return false;

        default:
          return false;
      }
    });
  }

  // 检查称号是否可解锁（对外方法）
  function checkUnlockRequirements(titleId: string): {
    canUnlock: boolean;
    missingRequirements: string[];
  } {
    const title = allTitles.value.find(t => t.id === titleId);
    if (!title) {
      return { canUnlock: false, missingRequirements: ['称号不存在'] };
    }

    if (ownedTitles.value.some(owned => owned.titleId === titleId)) {
      return { canUnlock: false, missingRequirements: [] };
    }

    const missing: string[] = [];

    for (const req of title.requirements) {
      let satisfied = false;

      switch (req.type) {
        case 'reputation_level': {
          const reputationStore = useReputationStore();
          satisfied = reputationStore.reputation.jianghu >= (req.value as number);
          break;
        }
        case 'level': {
          const playerStore = usePlayerStore();
          satisfied = playerStore.player.stats.level >= (req.value as number);
          break;
        }
        case 'achievement':
          // TODO: 实现成就系统后检查
          satisfied = false;
          break;
        case 'sect_rank':
        case 'jianghu_rank':
        case 'life_skill':
          // TODO: 实现相关系统后检查
          satisfied = false;
          break;
        case 'custom':
          // 自定义条件需要特殊处理
          if (req.value === 'join_sect') {
            satisfied = false; // TODO: 实现门派系统后检查
          } else {
            satisfied = false;
          }
          break;
      }

      if (!satisfied) {
        missing.push(req.description || `需要满足条件: ${req.type}`);
      }
    }

    return {
      canUnlock: missing.length === 0,
      missingRequirements: missing,
    };
  }

  // 解锁称号
  function unlockTitle(titleId: string, source?: string): boolean {
    if (ownedTitles.value.some(owned => owned.titleId === titleId)) {
      return false;
    }

    const title = allTitles.value.find(t => t.id === titleId);
    if (!title) {
      return false;
    }

    const { canUnlock } = checkUnlockRequirements(titleId);
    if (!canUnlock) {
      return false;
    }

    ownedTitles.value.push({
      titleId,
      unlockedAt: Date.now(),
      isEquipped: false,
      source,
    });

    return true;
  }

  // 装备称号
  function equipTitle(titleId: string): TitleEquipResult {
    const ownedTitle = ownedTitles.value.find(owned => owned.titleId === titleId);
    if (!ownedTitle) {
      return { success: false, newTitleId: titleId, bonusSummary: [] };
    }

    const title = allTitles.value.find(t => t.id === titleId);
    if (!title) {
      return { success: false, newTitleId: titleId, bonusSummary: [] };
    }

    // 卸下当前装备的称号
    const previousEquipped = ownedTitles.value.find(owned => owned.isEquipped);
    if (previousEquipped) {
      previousEquipped.isEquipped = false;
    }

    // 装备新称号
    ownedTitle.isEquipped = true;

    const bonuses = title.bonuses.map(bonus => ({
      statType: bonus.statType,
      value: bonus.value,
      isPercentage: bonus.isPercentage,
    }));

    return {
      success: true,
      previousTitleId: previousEquipped?.titleId,
      newTitleId: titleId,
      bonusSummary: bonuses,
    };
  }

  // 卸下称号
  function unequipTitle(titleId: string): boolean {
    const ownedTitle = ownedTitles.value.find(owned => owned.titleId === titleId);
    if (!ownedTitle || !ownedTitle.isEquipped) {
      return false;
    }

    const title = allTitles.value.find(t => t.id === titleId);
    if (title?.isPermanent) {
      return false; // 永久称号不能卸下
    }

    ownedTitle.isEquipped = false;
    return true;
  }

  // 获取称号配置
  function getTitleById(titleId: string): Title | undefined {
    return allTitles.value.find(title => title.id === titleId);
  }

  // 获取玩家拥有的称号
  function getOwnedTitle(titleId: string): OwnedTitle | undefined {
    return ownedTitles.value.find(owned => owned.titleId === titleId);
  }

  // 获取装备的称号
  function getEquippedTitle(): OwnedTitle | undefined {
    return ownedTitles.value.find(owned => owned.isEquipped);
  }

  // 检查是否拥有称号
  function isOwned(titleId: string): boolean {
    return ownedTitles.value.some(owned => owned.titleId === titleId);
  }

  // 获取装备称号的属性加成
  function getEquippedBonuses(): TitleBonus[] {
    const equipped = equippedTitle.value;
    if (!equipped) {
      return [];
    }

    const title = allTitles.value.find(t => t.id === equipped.titleId);
    return title?.bonuses || [];
  }

  // 按分类获取称号
  function getTitlesByCategory(category: string): Title[] {
    return allTitles.value.filter(title => title.category === category);
  }

  // 获取称号总数
  function getTotalCount(): number {
    return allTitles.value.length;
  }

  // 获取已解锁数量
  function getUnlockedCount(): number {
    return ownedTitles.value.length;
  }

  // 初始化
  async function init(): Promise<void> {
    if (initialized.value) return;
    initialized.value = true;
  }

  // 从存档恢复
  function restoreFromSave(data: TitleSaveEntry): void {
    ownedTitles.value = data.ownedTitles || [];
  }

  // 获取存档数据
  function getSaveData(): TitleSaveEntry {
    return {
      ownedTitles: ownedTitles.value.map(owned => ({
        titleId: owned.titleId,
        unlockedAt: owned.unlockedAt,
        isEquipped: owned.isEquipped,
        source: owned.source,
      })),
    };
  }

  // 重置数据
  function reset(): void {
    ownedTitles.value = [];
    initialized.value = false;
  }

  return {
    // 状态
    allTitles,
    ownedTitles,
    initialized,

    // 计算属性
    unlockedTitles,
    unlockableTitles,
    equippedTitle,

    // 方法
    init,
    checkUnlockRequirements,
    unlockTitle,
    equipTitle,
    unequipTitle,
    getTitleById,
    getOwnedTitle,
    getEquippedTitle,
    isOwned,
    getEquippedBonuses,
    getTitlesByCategory,
    getTotalCount,
    getUnlockedCount,
    restoreFromSave,
    getSaveData,
    reset,
  };
});
