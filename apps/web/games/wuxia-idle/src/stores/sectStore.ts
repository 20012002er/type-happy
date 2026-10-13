/**
 * 门派状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SectType, PlayerSectData, SectProgressData } from '@/types/sect';
import { sectConfigService } from '@/services/config/SectConfigService';
import type { ContributionLog, PlayerSectContribution } from '@/types/sectContribution';

const STORAGE_KEY = 'wuxia_player_sect';

export const useSectStore = defineStore('sect', () => {
  // ============ 状态 ============
  const sectType = ref<SectType | null>(null);
  const lastTransferTime = ref(0);
  const sectProgress = ref<Record<string, SectProgressData>>({});

  function createEmptyContribution(sect: SectType): PlayerSectContribution {
    return {
      sectType: sect,
      totalContribution: 0,
      currentLevel: 1,
      lastPrayerTime: 0,
      todayTaskCount: 0,
      todayBattleCount: 0,
      lastUpdateTime: Date.now(),
    };
  }

  function createEmptyProgress(sect: SectType): SectProgressData {
    return {
      sectType: sect,
      reputation: 0,
      sectLevel: 1,
      contribution: createEmptyContribution(sect),
      contributionLogs: [],
      unlockedMartials: [],
      lastVictoryRewardClaimedAt: 0,
    };
  }

  function ensureSectProgress(type: SectType): SectProgressData {
    if (!sectProgress.value[type]) {
      sectProgress.value[type] = createEmptyProgress(type);
    }

    return sectProgress.value[type];
  }

  function calculateSectLevel(reputation: number): number {
    if (reputation >= 10000) return 5;
    if (reputation >= 3000) return 4;
    if (reputation >= 1000) return 3;
    if (reputation >= 300) return 2;
    return 1;
  }

  function getDayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  // ============ 计算属性 ============

  /**
   * 获取当前门派配置
   */
  const currentSect = computed(() => {
    if (!sectType.value) return null;
    return sectConfigService.getSectConfig(sectType.value);
  });

  const currentProgress = computed(() => {
    if (!sectType.value) return null;
    return ensureSectProgress(sectType.value);
  });

  const sectReputation = computed(() => {
    return currentProgress.value?.reputation ?? 0;
  });

  const sectContribution = computed(() => {
    return currentProgress.value?.contribution.totalContribution ?? 0;
  });

  const sectLevel = computed(() => {
    return currentProgress.value?.sectLevel ?? 1;
  });

  const unlockedSkills = computed(() => {
    return currentProgress.value?.unlockedMartials ?? [];
  });

  /**
   * 是否已加入门派
   */
  const hasJoinedSect = computed(() => {
    return sectType.value !== null;
  });

  /**
   * 是否可以转投（冷却是否结束）
   */
  const canTransfer = computed(() => {
    if (!sectType.value) return true;
    const cooldownDays = sectConfigService.getTransferCooldownDays();
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    return Date.now() - lastTransferTime.value >= cooldownMs;
  });

  /**
   * 转投冷却结束时间
   */
  const transferCooldownEnd = computed(() => {
    if (!sectType.value) return 0;
    const cooldownDays = sectConfigService.getTransferCooldownDays();
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    return lastTransferTime.value + cooldownMs;
  });

  /**
   * 转投剩余冷却天数
   */
  const transferRemainingDays = computed(() => {
    const remaining = transferCooldownEnd.value - Date.now();
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / (24 * 60 * 60 * 1000));
  });

  // ============ 方法 ============

  /**
   * 加入门派
   */
  function joinSect(type: SectType): void {
    sectType.value = type;
    ensureSectProgress(type);
    lastTransferTime.value = Date.now();
    save();
  }

  /**
   * 转投门派
   */
  function transferSect(newType: SectType): boolean {
    if (!canTransfer.value) {
      return false;
    }
    const previousSect = sectType.value;

    if (previousSect) {
      sectProgress.value[previousSect] = createEmptyProgress(previousSect);
    }

    sectType.value = newType;
    sectProgress.value[newType] = createEmptyProgress(newType);
    lastTransferTime.value = Date.now();
    save();
    return true;
  }

  /**
   * 增加声望
   */
  function addReputation(amount: number): void {
    if (!sectType.value) return;
    addSectReputation(sectType.value, amount);
  }

  function addSectReputation(type: SectType, amount: number): void {
    const progress = ensureSectProgress(type);
    progress.reputation = Math.max(0, progress.reputation + amount);
    progress.sectLevel = calculateSectLevel(progress.reputation);
    save();
  }

  function setSectReputation(type: SectType, points: number): void {
    const progress = ensureSectProgress(type);
    progress.reputation = Math.max(0, points);
    progress.sectLevel = calculateSectLevel(progress.reputation);
    save();
  }

  /**
   * 增加贡献
   */
  function addContribution(amount: number): void {
    if (!sectType.value) return;
    addSectContribution(sectType.value, amount);
  }

  function addSectContribution(type: SectType, amount: number): void {
    const progress = ensureSectProgress(type);
    progress.contribution.totalContribution = Math.max(0, progress.contribution.totalContribution + amount);
    progress.contribution.lastUpdateTime = Date.now();
    save();
  }

  /**
   * 解锁武学
   */
  function unlockSkill(skillId: string): void {
    if (!sectType.value) return;
    unlockMartial(skillId, sectType.value);
  }

  function unlockMartial(skillId: string, type?: SectType): void {
    const targetSect = type ?? sectType.value;
    if (!targetSect) return;

    const progress = ensureSectProgress(targetSect);
    if (!progress.unlockedMartials.includes(skillId)) {
      progress.unlockedMartials.push(skillId);
      save();
    }
  }

  function getSectProgress(type: SectType): SectProgressData {
    return ensureSectProgress(type);
  }

  function setSectContributionData(type: SectType, data: PlayerSectContribution): void {
    const progress = ensureSectProgress(type);
    progress.contribution = {
      sectType: data.sectType,
      totalContribution: data.totalContribution ?? 0,
      currentLevel: data.currentLevel ?? 1,
      lastPrayerTime: data.lastPrayerTime ?? 0,
      todayTaskCount: data.todayTaskCount ?? 0,
      todayBattleCount: data.todayBattleCount ?? 0,
      lastUpdateTime: data.lastUpdateTime ?? Date.now(),
    };
    save();
  }

  function getSectContributionData(type: SectType): PlayerSectContribution {
    return ensureSectProgress(type).contribution;
  }

  function getSectContributionLogs(type: SectType): ContributionLog[] {
    return ensureSectProgress(type).contributionLogs;
  }

  function setSectContributionLogs(type: SectType, logs: ContributionLog[]): void {
    ensureSectProgress(type).contributionLogs = [...logs];
    save();
  }

  function appendSectContributionLog(type: SectType, log: ContributionLog): void {
    const progress = ensureSectProgress(type);
    progress.contributionLogs.unshift(log);
    if (progress.contributionLogs.length > 100) {
      progress.contributionLogs.pop();
    }
    save();
  }

  function canClaimVictoryReward(type: SectType, now: number = Date.now()): boolean {
    const progress = ensureSectProgress(type);
    if (!progress.lastVictoryRewardClaimedAt) return true;
    return getDayKey(progress.lastVictoryRewardClaimedAt) !== getDayKey(now);
  }

  function markVictoryRewardClaimed(type: SectType, now: number = Date.now()): void {
    const progress = ensureSectProgress(type);
    progress.lastVictoryRewardClaimedAt = now;
    save();
  }

  /**
   * 保存到 localStorage
   */
  function save(): void {
    try {
      const activeProgress = sectType.value ? ensureSectProgress(sectType.value) : null;
      const data: PlayerSectData = {
        sectType: sectType.value,
        sectReputation: activeProgress?.reputation ?? 0,
        sectContribution: activeProgress?.contribution.totalContribution ?? 0,
        sectLevel: activeProgress?.sectLevel ?? 1,
        unlockedSkills: activeProgress?.unlockedMartials ?? [],
        lastTransferTime: lastTransferTime.value,
        sectProgress: sectProgress.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[SectStore] 保存失败:', error);
    }
  }

  /**
   * 从 localStorage 加载
   * 注意：如果数据已从存档恢复，则跳过加载以避免覆盖
   */
  function load(): void {
    // 如果已经通过 restoreFromSave 恢复过数据（有sectType），则跳过
    if (sectType.value !== null || Object.keys(sectProgress.value).length > 0) {
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as PlayerSectData;
        restoreFromSave(data);
      }
    } catch (error) {
      console.error('[SectStore] 加载失败:', error);
    }
  }

  /**
   * 获取存档数据
   */
  function getSaveData(): PlayerSectData {
    const activeProgress = sectType.value ? ensureSectProgress(sectType.value) : null;
    return {
      sectType: sectType.value,
      sectReputation: activeProgress?.reputation ?? 0,
      sectContribution: activeProgress?.contribution.totalContribution ?? 0,
      sectLevel: activeProgress?.sectLevel ?? 1,
      unlockedSkills: activeProgress?.unlockedMartials ?? [],
      lastTransferTime: lastTransferTime.value,
      sectProgress: sectProgress.value,
    };
  }

  /**
   * 从存档恢复数据
   */
  function restoreFromSave(data: PlayerSectData): void {
    console.log('[SectStore] restoreFromSave called, data:', data);
    if (!data) return;

    sectType.value = data.sectType ?? null;
    lastTransferTime.value = data.lastTransferTime ?? 0;

    if (data.sectProgress && Object.keys(data.sectProgress).length > 0) {
      sectProgress.value = Object.fromEntries(
        Object.entries(data.sectProgress).map(([key, progress]) => [
          key,
          {
            sectType: progress.sectType,
            reputation: progress.reputation ?? 0,
            sectLevel: progress.sectLevel ?? 1,
            contribution: {
              sectType: progress.contribution?.sectType ?? progress.sectType,
              totalContribution: progress.contribution?.totalContribution ?? 0,
              currentLevel: progress.contribution?.currentLevel ?? 1,
              lastPrayerTime: progress.contribution?.lastPrayerTime ?? 0,
              todayTaskCount: progress.contribution?.todayTaskCount ?? 0,
              todayBattleCount: progress.contribution?.todayBattleCount ?? 0,
              lastUpdateTime: progress.contribution?.lastUpdateTime ?? Date.now(),
            },
            contributionLogs: progress.contributionLogs ?? [],
            unlockedMartials: progress.unlockedMartials ?? [],
            lastVictoryRewardClaimedAt: progress.lastVictoryRewardClaimedAt ?? 0,
          } satisfies SectProgressData,
        ])
      );
    } else if (data.sectType) {
      sectProgress.value = {
        [data.sectType]: {
          sectType: data.sectType,
          reputation: data.sectReputation ?? 0,
          sectLevel: data.sectLevel ?? 1,
          contribution: {
            sectType: data.sectType,
            totalContribution: data.sectContribution ?? 0,
            currentLevel: 1,
            lastPrayerTime: 0,
            todayTaskCount: 0,
            todayBattleCount: 0,
            lastUpdateTime: Date.now(),
          },
          contributionLogs: [],
          unlockedMartials: data.unlockedSkills ?? [],
          lastVictoryRewardClaimedAt: 0,
        },
      };
    } else {
      sectProgress.value = {};
    }

    console.log('[SectStore] after restore, sectType:', sectType.value);
  }

  /**
   * 重置数据
   */
  function reset(): void {
    sectType.value = null;
    lastTransferTime.value = 0;
    sectProgress.value = {};
  }

  return {
    // 状态
    sectType,
    sectProgress,
    sectReputation,
    sectContribution,
    sectLevel,
    unlockedSkills,
    lastTransferTime,
    // 计算属性
    currentSect,
    hasJoinedSect,
    canTransfer,
    transferCooldownEnd,
    transferRemainingDays,
    // 方法
    joinSect,
    transferSect,
    addReputation,
    addSectReputation,
    setSectReputation,
    addContribution,
    addSectContribution,
    unlockSkill,
    unlockMartial,
    getSectProgress,
    getSectContributionData,
    setSectContributionData,
    getSectContributionLogs,
    setSectContributionLogs,
    appendSectContributionLog,
    canClaimVictoryReward,
    markVictoryRewardClaimed,
    save,
    load,
    getSaveData,
    restoreFromSave,
    reset,
  };
});
