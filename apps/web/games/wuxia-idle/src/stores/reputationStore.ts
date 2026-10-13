/**
 * 声望系统状态管理
 * 负责管理玩家声望数据的持久化和状态更新
 */

import { defineStore } from 'pinia';
import { computed, ref, readonly } from 'vue';
import { ReputationLevel, ReputationPenaltyLevel } from '@/types/reputation';
import type { PlayerReputation, ReputationLog } from '@/types/reputation';
import { useReputationConfig } from '@/config/reputationConfig';

export type ReputationChangePayload = {
  change: number;
  reason: string;
  source: string;
  newPoints: number;
  newLevel: ReputationLevel;
};

export interface ReputationSaveEntry {
  jianghu: number;
  sectReputations: Record<string, number>;
  logs: ReputationLog[];
}

export const useReputationStore = defineStore('reputation', () => {
  const configService = useReputationConfig();

  // 声望数据
  const reputation = ref<PlayerReputation>({
    jianghu: 0,
    sectReputations: {},
    currentLevel: ReputationLevel.无名小卒,
    penaltyLevel: ReputationPenaltyLevel.无惩罚,
    title: '无名小卒',
  });

  // 声望变化日志
  const logs = ref<ReputationLog[]>([]);

  // 初始化状态
  const initialized = ref(false);

  // 计算属性：当前等级配置
  const currentLevelConfig = computed(() => {
    if (!configService.isLoaded) return undefined;
    return configService.getLevelConfig(reputation.value.currentLevel);
  });

  // 计算属性：等级名称
  const levelName = computed(() => {
    if (!configService.isLoaded) return '加载中...';
    return configService.getLevelName(reputation.value.currentLevel);
  });

  // 计算属性：等级称号
  const title = computed(() => {
    if (!configService.isLoaded) return '加载中...';
    return configService.getLevelTitle(reputation.value.currentLevel);
  });

  // 计算属性：加成倍率
  const bonusMultiplier = computed(() => {
    if (!configService.isLoaded) return 1.0;
    return configService.getBonusMultiplier(reputation.value.currentLevel);
  });

  // 计算属性：进度百分比
  const progressPercent = computed(() => {
    if (!configService.isLoaded) return 0;
    return configService.getProgressPercent(
      reputation.value.currentLevel,
      reputation.value.jianghu
    );
  });

  // 计算属性：距离下一级所需声望
  const pointsToNextLevel = computed(() => {
    if (!configService.isLoaded) return 0;
    return configService.getPointsToNextLevel(
      reputation.value.currentLevel,
      reputation.value.jianghu
    );
  });

  // 计算属性：是否达到指定等级
  function hasReachedLevel(targetLevel: ReputationLevel): boolean {
    if (!configService.isLoaded) return false;
    return configService.hasReachedLevel(reputation.value.jianghu, targetLevel);
  }

  // 计算属性：当前惩罚等级配置
  const penaltyRule = computed(() => {
    if (!configService.isLoaded) {
      return {
        level: ReputationPenaltyLevel.无惩罚,
        minPoints: 0,
        maxPoints: 0,
        effects: {},
        description: '无惩罚',
      };
    }
    return configService.getPenaltyRule(reputation.value.jianghu);
  });

  // 计算属性：完整等级详情
  const levelDetail = computed(() => {
    if (!configService.isLoaded) {
      return {
        level: ReputationLevel.无名小卒,
        name: '加载中...',
        title: '加载中...',
        bonusMultiplier: 1.0,
        unlockContent: [],
        progress: 0,
        pointsToNext: 0,
        nextLevelName: undefined,
      };
    }
    return configService.getLevelDetail(reputation.value.jianghu);
  });

  // 获取门派声望
  function getSectReputation(sectType: string): number {
    return reputation.value.sectReputations[sectType] || 0;
  }

  // 设置门派声望
  function setSectReputation(sectType: string, points: number) {
    reputation.value.sectReputations[sectType] = points;
  }

  // 增加声望
  function gainReputation(
    action: string,
    source: string = 'unknown',
    levelDiff?: number
  ): ReputationChangePayload | null {
    if (!configService.isLoaded) {
      console.warn('[ReputationStore] 配置未加载，无法增加声望');
      return null;
    }

    const config = configService.getGainRule(action);
    if (!config) {
      console.warn(`[ReputationStore] 未找到声望获取规则: ${action}`);
      return null;
    }

    const basePoints = 1; // 基础值为1声望
    const gained = configService.calculateGain(action, basePoints, levelDiff);

    if (gained <= 0) return null;

    const oldPoints = reputation.value.jianghu;
    const oldLevel = reputation.value.currentLevel;

    // 更新声望值
    reputation.value.jianghu = Math.floor(reputation.value.jianghu + gained);

    // 更新等级
    const newLevel = configService.getLevelByPoints(reputation.value.jianghu);
    reputation.value.currentLevel = newLevel;
    reputation.value.title = configService.getLevelTitle(newLevel);

    // 更新惩罚等级
    reputation.value.penaltyLevel = configService.getPenaltyLevel(reputation.value.jianghu);

    // 记录日志
    const log: ReputationLog = {
      timestamp: Date.now(),
      change: gained,
      reason: config.description,
      source,
    };
    logs.value.unshift(log);
    if (logs.value.length > 100) {
      logs.value.pop(); // 最多保留100条记录
    }

    return {
      change: gained,
      reason: config.description,
      source,
      newPoints: reputation.value.jianghu,
      newLevel,
    };
  }

  // 减少声望（恶名系统）
  function loseReputation(
    points: number,
    reason: string,
    source: string = 'unknown'
  ): ReputationChangePayload {
    if (!configService.isLoaded) {
      // 如果配置未加载，只更新声望值，不更新等级
      const newPoints = Math.max(-2000, reputation.value.jianghu - points);
      const result = {
        change: -points,
        reason,
        source,
        newPoints,
        newLevel: reputation.value.currentLevel,
      };
      reputation.value.jianghu = newPoints;
      return result;
    }

    const oldPoints = reputation.value.jianghu;
    const oldLevel = reputation.value.currentLevel;

    // 更新声望值
    reputation.value.jianghu = Math.floor(Math.max(-2000, reputation.value.jianghu - points));

    // 更新等级
    const newLevel = configService.getLevelByPoints(reputation.value.jianghu);
    reputation.value.currentLevel = newLevel;
    reputation.value.title = configService.getLevelTitle(newLevel);

    // 更新惩罚等级
    reputation.value.penaltyLevel = configService.getPenaltyLevel(reputation.value.jianghu);

    // 记录日志
    const log: ReputationLog = {
      timestamp: Date.now(),
      change: -points,
      reason,
      source,
    };
    logs.value.unshift(log);
    if (logs.value.length > 100) {
      logs.value.pop();
    }

    return {
      change: -points,
      reason,
      source,
      newPoints: reputation.value.jianghu,
      newLevel,
    };
  }

  // 直接设置声望值（用于特殊剧情）
  function setReputation(points: number) {
    reputation.value.jianghu = Math.floor(points);
    const newLevel = configService.getLevelByPoints(reputation.value.jianghu);
    reputation.value.currentLevel = newLevel;
    reputation.value.title = configService.getLevelTitle(newLevel);
    reputation.value.penaltyLevel = configService.getPenaltyLevel(reputation.value.jianghu);
  }

  // 直接增加声望值（用于系统奖励，如江湖榜奖励）
  function addReputation(points: number, reason: string = 'system') {
    if (points <= 0) return;

    const oldPoints = reputation.value.jianghu;
    const oldLevel = reputation.value.currentLevel;

    // 更新声望值
    reputation.value.jianghu = Math.floor(reputation.value.jianghu + points);

    // 更新等级
    const newLevel = configService.getLevelByPoints(reputation.value.jianghu);
    reputation.value.currentLevel = newLevel;
    reputation.value.title = configService.getLevelTitle(newLevel);

    // 更新惩罚等级
    reputation.value.penaltyLevel = configService.getPenaltyLevel(reputation.value.jianghu);

    // 记录日志
    const log: ReputationLog = {
      timestamp: Date.now(),
      change: points,
      reason,
      source: 'system',
    };
    logs.value.unshift(log);
    if (logs.value.length > 100) {
      logs.value.pop();
    }
  }

  // 初始化
  async function init(): Promise<void> {
    if (initialized.value) return;

    await configService.load();
    initialized.value = true;
  }

  // 从存档恢复
  function restoreFromSave(data: ReputationSaveEntry): void {
    reputation.value.jianghu = Math.floor(data.jianghu || 0);
    reputation.value.sectReputations = data.sectReputations || {};
    logs.value = data.logs || [];

    // 重新计算等级
    const newLevel = configService.getLevelByPoints(reputation.value.jianghu);
    reputation.value.currentLevel = newLevel;
    reputation.value.title = configService.getLevelTitle(newLevel);
    reputation.value.penaltyLevel = configService.getPenaltyLevel(reputation.value.jianghu);
  }

  // 获取存档数据
  function getSaveData(): ReputationSaveEntry {
    return {
      jianghu: Math.floor(reputation.value.jianghu),
      sectReputations: { ...reputation.value.sectReputations },
      logs: logs.value.slice(0, 100), // 最多保存100条日志
    };
  }

  // 重置数据
  function reset(): void {
    reputation.value = {
      jianghu: 0,
      sectReputations: {},
      currentLevel: ReputationLevel.无名小卒,
      penaltyLevel: ReputationPenaltyLevel.无惩罚,
      title: '无名小卒',
    };
    logs.value = [];
    initialized.value = false;
  }

  return {
    // 状态
    reputation: readonly(reputation),
    logs: readonly(logs),
    initialized,

    // 计算属性
    currentLevelConfig,
    levelName,
    title,
    bonusMultiplier,
    progressPercent,
    pointsToNextLevel,
    penaltyRule,
    levelDetail,

    // 方法
    init,
    gainReputation,
    loseReputation,
    setReputation,
    addReputation,
    getSectReputation,
    setSectReputation,
    hasReachedLevel,
    restoreFromSave,
    getSaveData,
    reset,
  };
});
