/**
 * 称号系统服务层
 * 负责称号相关的业务逻辑计算和集成
 */

import { useTitleStore } from '@/stores/titleStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useReputationStore } from '@/stores/reputationStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import type { Title, TitleEquipResult } from '@/types/title';

export class TitleService {
  /**
   * 获取称号配置
   */
  static getTitleConfig(titleId: string): Title | undefined {
    const store = useTitleStore();
    return store.getTitleById(titleId);
  }

  /**
   * 检查称号是否可解锁
   */
  static canUnlockTitle(titleId: string): { canUnlock: boolean; missingRequirements: string[] } {
    const store = useTitleStore();
    return store.checkUnlockRequirements(titleId);
  }

  /**
   * 解锁称号
   */
  static unlockTitle(titleId: string, source?: string): boolean {
    const store = useTitleStore();

    const result = store.unlockTitle(titleId, source);
    if (result) {
      const title = store.getTitleById(titleId);
      const logStore = useGameLogStore();
      logStore.addLog(`解锁称号「${title?.name}」`);
    }

    return result;
  }

  /**
   * 装备称号
   */
  static equipTitle(titleId: string): TitleEquipResult | null {
    const store = useTitleStore();

    // 检查是否拥有该称号
    const ownedTitle = store.getOwnedTitle(titleId);
    if (!ownedTitle) {
      return { success: false, newTitleId: titleId, bonusSummary: [] };
    }

    const title = store.getTitleById(titleId);
    if (!title) {
      return { success: false, newTitleId: titleId, bonusSummary: [] };
    }

    // 检查是否为永久称号（不可卸下）
    if (title.isPermanent && ownedTitle.isEquipped) {
      // 已经装备了，不能换下
      return { success: false, newTitleId: titleId, bonusSummary: [] };
    }

    const result = store.equipTitle(titleId);

    if (result.success) {
      // 更新玩家显示的称号
      const playerStore = usePlayerStore();
      const equippedTitle = store.getEquippedTitle();
      playerStore.player.title = equippedTitle?.titleId
        ? store.getTitleById(equippedTitle.titleId)?.name || '无'
        : '无';

      const logStore = useGameLogStore();
      if (result.previousTitleId) {
        const prevTitle = store.getTitleById(result.previousTitleId);
        const newTitle = store.getTitleById(titleId);
        logStore.addLog(`更换称号：${prevTitle?.name} → ${newTitle?.name}`);
      } else {
        logStore.addLog(`装备称号「${title?.name}」`);
      }
    }

    return result;
  }

  /**
   * 卸下称号
   */
  static unequipTitle(titleId: string): boolean {
    const store = useTitleStore();
    const title = store.getTitleById(titleId);

    if (!title) return false;

    const result = store.unequipTitle(titleId);

    if (result) {
      // 更新玩家显示的称号
      const playerStore = usePlayerStore();
      const equippedTitle = store.getEquippedTitle();
      playerStore.player.title = equippedTitle?.titleId
        ? store.getTitleById(equippedTitle.titleId)?.name || '无'
        : '无';

      const logStore = useGameLogStore();
      logStore.addLog(`卸下称号「${title?.name}」`);
    }

    return result;
  }

  /**
   * 计算装备称号后的属性加成
   */
  static calculateEquippedBonuses(): {
    statType: string;
    value: number;
    isPercentage: boolean;
  }[] {
    const store = useTitleStore();
    return store.getEquippedBonuses();
  }

  /**
   * 应用称号属性加成到玩家
   */
  static applyTitleBonuses(): Record<string, number> {
    const bonuses = this.calculateEquippedBonuses();
    const result: Record<string, number> = {};

    for (const bonus of bonuses) {
      if (bonus.isPercentage) {
        // 百分比加成
        result[bonus.statType] = (result[bonus.statType] || 0) + bonus.value;
      } else {
        // 固定值加成
        result[bonus.statType] = (result[bonus.statType] || 0) + bonus.value;
      }
    }

    return result;
  }

  /**
   * 检查并自动解锁符合条件的称号
   */
  static checkAndAutoUnlock(): string[] {
    const store = useTitleStore();
    const playerStore = usePlayerStore();
    const reputationStore = useReputationStore();
    const unlockedTitles: string[] = [];

    // 检查所有可解锁的称号
    for (const title of store.allTitles) {
      if (store.isOwned(title.id)) continue;

      const { canUnlock } = this.canUnlockTitle(title.id);
      if (canUnlock) {
        this.unlockTitle(title.id);
        unlockedTitles.push(title.id);
      }
    }

    return unlockedTitles;
  }

  /**
   * 获取玩家当前装备的称号信息
   */
  static getEquippedTitleInfo(): {
    name: string;
    description: string;
    icon?: string;
    bonuses: { statType: string; value: number; isPercentage: boolean }[];
  } | null {
    const store = useTitleStore();
    const equippedTitle = store.getEquippedTitle();

    if (!equippedTitle) return null;

    const title = store.getTitleById(equippedTitle.titleId);
    if (!title) return null;

    return {
      name: title.name,
      description: title.description,
      icon: title.icon,
      bonuses: title.bonuses,
    };
  }

  /**
   * 获取称号列表（按分类）
   */
  static getTitlesByCategory(category: string): Title[] {
    const store = useTitleStore();
    return store.getTitlesByCategory(category);
  }

  /**
   * 获取所有已解锁称号
   */
  static getUnlockedTitles(): Title[] {
    const store = useTitleStore();
    return store.unlockedTitles;
  }

  /**
   * 获取所有可解锁但未解锁的称号
   */
  static getUnlockableTitles(): Title[] {
    const store = useTitleStore();
    return store.unlockableTitles;
  }

  /**
   * 获取称号展示信息
   */
  static getTitleDisplay(): {
    equipped: { name: string; icon?: string } | null;
    unlockedCount: number;
    totalCount: number;
  } {
    const store = useTitleStore();
    const equippedTitle = store.getEquippedTitle();

    return {
      equipped: equippedTitle
        ? (() => {
            const title = store.getTitleById(equippedTitle.titleId);
            return title ? { name: title.name, icon: title.icon } : null;
          })()
        : null,
      unlockedCount: store.unlockedTitles.length,
      totalCount: store.allTitles.length,
    };
  }
}
