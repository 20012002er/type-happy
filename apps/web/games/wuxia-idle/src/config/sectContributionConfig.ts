/**
 * 门派贡献配置服务
 */

import JSON5 from 'json5';
import SECT_CONTRIBUTION_RAW from '@/assets/configs/sect-contribution.json5?raw';
import { ref } from 'vue';
import type {
  SectContributionConfig,
  ContributionGainRule,
  RedemptionReward,
  ContributionLevel,
} from '@/types/sectContribution';

class SectContributionConfigService {
  private config: SectContributionConfig | null = null;
  private loaded = ref(false);

  private get currentConfig(): SectContributionConfig | null {
    if (!this.loaded.value) {
      return null;
    }

    return this.config;
  }

  async load(): Promise<void> {
    if (this.loaded.value) return;

    try {
      const parsed = JSON5.parse(SECT_CONTRIBUTION_RAW);
      this.config = parsed as SectContributionConfig;
      this.loaded.value = true;
      console.log('[SectContributionConfig] 配置加载成功');
    } catch (error) {
      console.error('[SectContributionConfig] 配置加载失败:', error);
      throw error;
    }
  }

  get isLoaded(): boolean {
    return this.loaded.value;
  }

  getContributionGains(): ContributionGainRule[] {
    return this.currentConfig?.contributionGains || [];
  }

  getRedemptionRewards(): RedemptionReward[] {
    return this.currentConfig?.redemptionRewards || [];
  }

  getContributionLevels(): ContributionLevel[] {
    return this.currentConfig?.contributionLevels || [];
  }

  getGainRule(type: string): ContributionGainRule | undefined {
    return this.currentConfig?.contributionGains.find(g => g.type === type);
  }

  getRewardById(id: string): RedemptionReward | undefined {
    return this.currentConfig?.redemptionRewards.find(r => r.id === id);
  }

  getLevelByContribution(points: number): ContributionLevel | undefined {
    const config = this.currentConfig;
    if (!config) return undefined;

    return config.contributionLevels.find(
      level => points >= level.minContribution && points <= level.maxContribution
    );
  }

  getNextLevel(currentLevel: number): ContributionLevel | undefined {
    const config = this.currentConfig;
    if (!config) return undefined;

    return config.contributionLevels.find(level => level.level === currentLevel + 1);
  }

  getPointsToNextLevel(points: number): number {
    const config = this.currentConfig;
    if (!config) return 0;

    const currentLevel = this.getLevelByContribution(points);
    if (!currentLevel) return 0;
    const nextLevel = this.getNextLevel(currentLevel.level);
    if (!nextLevel) return 0;
    return nextLevel.minContribution - points;
  }

  getProgressPercent(points: number): number {
    const config = this.currentConfig;
    if (!config) return 0;

    const currentLevel = this.getLevelByContribution(points);
    if (!currentLevel || currentLevel.level >= 5) return 100;
    const nextLevel = this.getNextLevel(currentLevel.level);
    if (!nextLevel) return 100;
    const totalRange = nextLevel.minContribution - currentLevel.minContribution;
    const currentProgress = points - currentLevel.minContribution;
    return (currentProgress / totalRange) * 100;
  }

  getAvailableRewards(sectType: string): RedemptionReward[] {
    return this.currentConfig?.redemptionRewards.filter(r => r.sectTypes.includes(sectType)) || [];
  }

  getAvailableGains(minReputationLevel: number): ContributionGainRule[] {
    return (
      this.currentConfig?.contributionGains.filter(
        g => !g.requirements || g.requirements.minReputationLevel <= minReputationLevel
      ) || []
    );
  }
}

export const sectContributionConfig = new SectContributionConfigService();
