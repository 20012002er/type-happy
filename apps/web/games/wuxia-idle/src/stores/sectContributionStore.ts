/**
 * 门派贡献状态管理
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { PlayerSectContribution, ContributionLog } from '@/types/sectContribution';
import { useSectStore } from './sectStore';
import type { SectType } from '@/types/sect';

interface ContributionGainResult {
  success: boolean;
  contribution: number;
  reason?: string;
}

export const useSectContributionStore = defineStore('sectContribution', () => {
  const sectStore = useSectStore();

  // 玩家门派贡献数据
  const sectContributions = computed<Record<string, PlayerSectContribution>>(() =>
    Object.fromEntries(
      Object.entries(sectStore.sectProgress).map(([sect, progress]) => [sect, progress.contribution])
    )
  );

  // 贡献变化日志
  const logs = computed<ContributionLog[]>(() => {
    const activeSect = (sectStore.sectType || playerSectType.value || '') as SectType | '';
    if (!activeSect) return [];
    return sectStore.getSectContributionLogs(activeSect as SectType);
  });

  // 初始化状态
  const initialized = ref(false);

  // 玩家所属门派类型
  const playerSectType = ref<string>('');

  /**
   * 初始化
   */
  async function init(): Promise<void> {
    if (initialized.value) return;
    initialized.value = true;
  }

  /**
   * 设置玩家门派类型
   */
  function setPlayerSectType(sectType: string): void {
    playerSectType.value = sectType;
    sectStore.getSectContributionData(sectType as SectType);
  }

  /**
   * 获取指定门派的贡献数据
   */
  function getContribution(sectType: string): PlayerSectContribution {
    return sectStore.getSectContributionData(sectType as SectType);
  }

  /**
   * 获取总贡献值
   */
  function getTotalContribution(sectType: string): number {
    return getContribution(sectType).totalContribution;
  }

  /**
   * 获取当前等级
   */
  function getCurrentLevel(sectType: string): number {
    return getContribution(sectType).currentLevel;
  }

  /**
   * 增加贡献值
   */
  function gainContribution(
    sectType: string,
    type: string,
    amount: number,
    reason: string
  ): ContributionGainResult {
    if (amount <= 0) {
      return { success: false, contribution: 0, reason: '贡献值必须大于0' };
    }

    const contribution = getContribution(sectType);

    // 检查每日限制
    if (type === 'sect_task' && contribution.todayTaskCount >= 1) {
      return { success: false, contribution: 0, reason: '今日任务次数已用完' };
    }

    if (type === 'sect_battle' && contribution.todayBattleCount >= 3) {
      return { success: false, contribution: 0, reason: '今日比武次数已用完' };
    }

    // 更新贡献值
    contribution.totalContribution += amount;
    contribution.lastUpdateTime = Date.now();

    // 更新计数
    if (type === 'sect_task') {
      contribution.todayTaskCount++;
    }
    if (type === 'sect_battle') {
      contribution.todayBattleCount++;
    }

    // 记录日志
    const log: ContributionLog = {
      timestamp: Date.now(),
      type: type as any,
      change: amount,
      reason,
    };
    sectStore.appendSectContributionLog(sectType as SectType, log);
    sectStore.setSectContributionData(sectType as SectType, contribution);

    return { success: true, contribution: amount };
  }

  /**
   * 消耗贡献值
   */
  function spendContribution(sectType: string, amount: number): boolean {
    const contribution = getContribution(sectType);
    if (contribution.totalContribution < amount) {
      return false;
    }
    contribution.totalContribution -= amount;
    contribution.lastUpdateTime = Date.now();
    sectStore.setSectContributionData(sectType as SectType, contribution);
    return true;
  }

  /**
   * 重置每日计数
   */
  function resetDaily(sectType: string): void {
    const contribution = getContribution(sectType);
    contribution.todayTaskCount = 0;
    contribution.todayBattleCount = 0;
    contribution.lastPrayerTime = 0;
    sectStore.setSectContributionData(sectType as SectType, contribution);
  }

  /**
   * 从存档恢复数据
   */
  function restoreFromSave(data: Record<string, PlayerSectContribution>): void {
    if (data) {
      for (const [sect, contribution] of Object.entries(data)) {
        sectStore.setSectContributionData(sect as SectType, contribution);
      }
    }
  }

  /**
   * 获取存档数据
   */
  function getSaveData(): Record<string, PlayerSectContribution> {
    return Object.fromEntries(
      Object.entries(sectStore.sectProgress).map(([sect, progress]) => [sect, progress.contribution])
    );
  }

  /**
   * 重置数据
   */
  function reset(): void {
    playerSectType.value = '';
    initialized.value = false;
  }

  return {
    sectContributions,
    logs,
    initialized,
    playerSectType,
    init,
    setPlayerSectType,
    getContribution,
    getTotalContribution,
    getCurrentLevel,
    gainContribution,
    spendContribution,
    resetDaily,
    restoreFromSave,
    getSaveData,
    reset,
  };
});
