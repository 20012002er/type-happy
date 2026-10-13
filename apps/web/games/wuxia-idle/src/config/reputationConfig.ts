/**
 * 声望系统配置服务
 * 负责加载和解析 reputation-config.json5 配置文件
 */

import JSON5 from 'json5';
import REPUTATION_CONFIG_RAW from '@/assets/configs/reputation-config.json5?raw';
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ReputationLevel, ReputationType, ReputationPenaltyLevel } from '@/types/reputation';
import type {
  ReputationLevelConfig,
  ReputationGainRule,
  ReputationPenaltyRule,
  ReputationReward,
  ReputationConfig,
} from '@/types/reputation';

/**
 * 声望配置服务单例
 */
let configInstance: ReputationConfigService | null = null;

class ReputationConfigService {
  private config: ReputationConfig | null = null;
  private loaded = ref(false);

  /**
   * 获取加载状态
   */
  get isLoaded(): boolean {
    return this.loaded.value;
  }

  /**
   * 加载配置文件
   */
  async load(): Promise<void> {
    if (this.loaded.value) return;

    try {
      const parsed = JSON5.parse(REPUTATION_CONFIG_RAW);
      this.config = parsed as ReputationConfig;
      this.loaded.value = true;
    } catch (error) {
      console.error('[ReputationConfig] 加载配置失败:', error);
      throw error;
    }
  }

  /**
   * 确保配置已加载
   */
  async ensureLoaded(): Promise<void> {
    if (!this.loaded.value) {
      await this.load();
    }
  }

  /**
   * 获取配置实例
   */
  getConfig(): ReputationConfig {
    if (!this.config) {
      throw new Error('[ReputationConfig] 配置未加载，请先调用 load()');
    }
    return this.config;
  }

  /**
   * 根据声望值获取等级
   */
  getLevelByPoints(points: number): ReputationLevel {
    // 取整避免浮点数精度问题
    const intPoints = Math.floor(points);
    const levels = this.getConfig().levels;
    // 从高到低查找
    for (let i = levels.length - 1; i >= 0; i--) {
      if (intPoints >= levels[i].minPoints) {
        return levels[i].level;
      }
    }
    return ReputationLevel.无名小卒;
  }

  /**
   * 获取等级配置
   */
  getLevelConfig(level: ReputationLevel): ReputationLevelConfig | undefined {
    return this.getConfig().levels.find(l => l.level === level);
  }

  /**
   * 获取等级名称
   */
  getLevelName(level: ReputationLevel): string {
    const config = this.getLevelConfig(level);
    return config?.name || '未知';
  }

  /**
   * 获取等级称号
   */
  getLevelTitle(level: ReputationLevel): string {
    const config = this.getLevelConfig(level);
    return config?.title || '无名小卒';
  }

  /**
   * 获取等级加成倍率
   */
  getBonusMultiplier(level: ReputationLevel): number {
    const config = this.getLevelConfig(level);
    return config?.bonusMultiplier || 1.0;
  }

  /**
   * 获取等级解锁内容
   */
  getUnlockContent(level: ReputationLevel): string[] {
    const config = this.getLevelConfig(level);
    return config?.unlockContent || [];
  }

  /**
   * 获取下一级所需声望
   */
  getPointsToNextLevel(currentLevel: ReputationLevel, currentPoints: number): number {
    const levels = this.getConfig().levels;
    const currentIndex = levels.findIndex(l => l.level === currentLevel);

    if (currentIndex >= levels.length - 1) {
      return 0; // 已是最高级
    }

    const nextLevel = levels[currentIndex + 1];
    return nextLevel.minPoints - currentPoints;
  }

  /**
   * 获取声望进度百分比
   */
  getProgressPercent(currentLevel: ReputationLevel, currentPoints: number): number {
    const config = this.getLevelConfig(currentLevel);
    if (!config) return 0;

    const range = config.maxPoints - config.minPoints;
    const progress = currentPoints - config.minPoints;
    // 使用 Math.round 避免浮点数精度问题，并限制在 0-100 范围内
    const percent = (progress / range) * 100;
    return Math.round(Math.min(100, Math.max(0, percent)) * 10) / 10;
  }

  /**
   * 获取等级奖励
   */
  getLevelReward(level: ReputationLevel): ReputationReward | undefined {
    return this.getConfig().rewards.find(r => r.level === level);
  }

  /**
   * 获取惩罚规则
   */
  getPenaltyRule(points: number): ReputationPenaltyRule {
    // 取整避免浮点数精度问题
    const intPoints = Math.floor(points);
    const rules = this.getConfig().penaltyRules;
    // 从低到高查找（负数）
    for (const rule of rules) {
      if (intPoints >= rule.minPoints && intPoints <= rule.maxPoints) {
        return rule;
      }
    }
    return rules[0]; // 返回无惩罚规则
  }

  /**
   * 获取惩罚等级
   */
  getPenaltyLevel(points: number): ReputationPenaltyLevel {
    return this.getPenaltyRule(points).level;
  }

  /**
   * 获取所有等级配置
   */
  getAllLevels(): ReputationLevelConfig[] {
    return this.getConfig().levels;
  }

  /**
   * 获取所有获取规则
   */
  getAllGainRules(): ReputationGainRule[] {
    return this.getConfig().gainRules;
  }

  /**
   * 根据动作获取获取规则
   */
  getGainRule(action: string): ReputationGainRule | undefined {
    return this.getConfig().gainRules.find(r => r.action === action);
  }

  /**
   * 计算声望获取值
   */
  calculateGain(action: string, baseValue: number, levelDiff?: number): number {
    const rule = this.getGainRule(action);
    if (!rule) return 0;

    let gain = rule.basePoints * baseValue;

    if (rule.multiplierType === 'level_diff' && levelDiff !== undefined) {
      gain *= 1 + levelDiff * (rule.multiplierParam || 0.1);
    } else if (rule.multiplierType === 'ratio' && rule.multiplierParam) {
      gain *= rule.multiplierParam;
    }

    if (rule.maxGain) {
      gain = Math.min(gain, rule.maxGain);
    }

    return Math.floor(gain);
  }

  /**
   * 检查是否达到指定等级
   */
  hasReachedLevel(currentPoints: number, targetLevel: ReputationLevel): boolean {
    // 取整避免浮点数精度问题
    const intPoints = Math.floor(currentPoints);
    const targetConfig = this.getLevelConfig(targetLevel);
    if (!targetConfig) return false;
    return intPoints >= targetConfig.minPoints;
  }

  /**
   * 获取当前等级详情
   */
  getLevelDetail(currentPoints: number): {
    level: ReputationLevel;
    name: string;
    title: string;
    bonusMultiplier: number;
    unlockContent: string[];
    progress: number;
    pointsToNext: number;
    nextLevelName?: string;
  } {
    const level = this.getLevelByPoints(currentPoints);
    const config = this.getLevelConfig(level);
    const levels = this.getConfig().levels;
    const currentIndex = levels.findIndex(l => l.level === level);

    return {
      level,
      name: config?.name || '未知',
      title: config?.title || '无名小卒',
      bonusMultiplier: config?.bonusMultiplier || 1.0,
      unlockContent: config?.unlockContent || [],
      progress: this.getProgressPercent(level, currentPoints),
      pointsToNext: this.getPointsToNextLevel(level, currentPoints),
      nextLevelName: currentIndex < levels.length - 1 ? levels[currentIndex + 1].name : undefined,
    };
  }
}

/**
 * 获取声望配置服务单例
 */
export function useReputationConfig(): ReputationConfigService {
  if (!configInstance) {
    configInstance = new ReputationConfigService();
  }
  return configInstance;
}

/**
 * Pinia Store - 声望配置状态
 */
export const useReputationConfigStore = defineStore('reputationConfig', () => {
  const service = useReputationConfig();
  const initialized = ref(false);

  const config = computed(() => service.getConfig());
  const loaded = computed(() => service.isLoaded);

  async function initialize(): Promise<void> {
    if (!initialized.value) {
      await service.load();
      initialized.value = true;
    }
  }

  return {
    service,
    config,
    loaded,
    initialized,
    initialize,
  };
});
