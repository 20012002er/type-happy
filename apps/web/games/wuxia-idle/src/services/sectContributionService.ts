/**
 * 门派贡献服务层
 * 负责贡献计算、任务处理、奖励兑换
 */

import { useSectContributionStore } from '@/stores/sectContributionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useReputationStore } from '@/stores/reputationStore';
import { sectContributionConfig } from '@/config/sectContributionConfig';
import type {
  ContributionGainType,
  RedemptionReward,
  ContributionLevel,
} from '@/types/sectContribution';

export class SectContributionService {
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized) return;

    await sectContributionConfig.load();
    await useSectContributionStore().init();

    this.initialized = true;
    console.log('[SectContributionService] 初始化成功');
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 执行每日诵经
   */
  static async performDailyPrayer(
    sectType: string
  ): Promise<{ success: boolean; contribution: number; message: string }> {
    const store = useSectContributionStore();
    const logStore = useGameLogStore();
    const config = sectContributionConfig;

    if (!config.isLoaded) {
      return { success: false, contribution: 0, message: '配置加载中...' };
    }

    const rule = config.getGainRule('daily_prayer');
    if (!rule) {
      return { success: false, contribution: 0, message: '未找到诵经规则' };
    }

    const result = store.gainContribution(sectType, rule.type, rule.baseContribution, '每日诵经');

    if (result.success) {
      logStore.addRewardLog(`完成每日诵经，获得 ${result.contribution} 点门派贡献`);
      return {
        success: true,
        contribution: result.contribution,
        message: '诵经完成，获得门派贡献',
      };
    }

    return { success: false, contribution: 0, message: result.reason || '诵经失败' };
  }

  /**
   * 执行门派任务
   */
  static async completeSectTask(
    sectType: string
  ): Promise<{ success: boolean; contribution: number; message: string }> {
    const store = useSectContributionStore();
    const logStore = useGameLogStore();
    const config = sectContributionConfig;

    if (!config.isLoaded) {
      return { success: false, contribution: 0, message: '配置加载中...' };
    }

    const rule = config.getGainRule('sect_task');
    if (!rule) {
      return { success: false, contribution: 0, message: '未找到任务规则' };
    }

    const result = store.gainContribution(
      sectType,
      rule.type,
      rule.baseContribution,
      '完成门派任务'
    );

    if (result.success) {
      logStore.addRewardLog(`完成门派任务，获得 ${result.contribution} 点门派贡献`);
      return {
        success: true,
        contribution: result.contribution,
        message: '任务完成，获得门派贡献',
      };
    }

    return { success: false, contribution: 0, message: result.reason || '任务失败' };
  }

  /**
   * 捐赠银两
   */
  static async donateGold(
    sectType: string,
    goldAmount: number
  ): Promise<{ success: boolean; contribution: number; message: string }> {
    const store = useSectContributionStore();
    const playerStore = usePlayerStore();
    const logStore = useGameLogStore();
    const config = sectContributionConfig;

    if (!config.isLoaded) {
      return { success: false, contribution: 0, message: '配置加载中...' };
    }

    if (playerStore.player.resources.gold < goldAmount) {
      return { success: false, contribution: 0, message: '银两不足' };
    }

    const rule = config.getGainRule('donate_gold');
    if (!rule) {
      return { success: false, contribution: 0, message: '未找到捐赠规则' };
    }

    const contribution = Math.floor(goldAmount / 100) * rule.baseContribution;
    if (contribution <= 0) {
      return { success: false, contribution: 0, message: '捐赠金额太少，无法获得贡献' };
    }

    playerStore.updateResources({ gold: playerStore.player.resources.gold - goldAmount });
    const result = store.gainContribution(
      sectType,
      rule.type,
      contribution,
      `捐赠 ${goldAmount} 银两`
    );

    if (result.success) {
      logStore.addRewardLog(`向门派捐赠 ${goldAmount} 银两，获得 ${contribution} 点门派贡献`);
      return { success: true, contribution, message: '捐赠成功，获得门派贡献' };
    }

    return { success: false, contribution: 0, message: result.reason || '捐赠失败' };
  }

  /**
   * 参与门派比武
   */
  static async participateSectBattle(
    sectType: string
  ): Promise<{ success: boolean; contribution: number; message: string }> {
    const store = useSectContributionStore();
    const logStore = useGameLogStore();
    const config = sectContributionConfig;

    if (!config.isLoaded) {
      return { success: false, contribution: 0, message: '配置加载中...' };
    }

    const rule = config.getGainRule('sect_battle');
    if (!rule) {
      return { success: false, contribution: 0, message: '未找到比武规则' };
    }

    // 模拟比武结果
    const victoryChance = 0.6;
    const isVictory = Math.random() < victoryChance;
    const contribution = isVictory ? rule.baseContribution : Math.floor(rule.baseContribution / 3);

    const result = store.gainContribution(
      sectType,
      rule.type,
      contribution,
      isVictory ? '门派比武获胜' : '门派比武战败'
    );

    if (result.success) {
      if (isVictory) {
        logStore.addRewardLog(`门派比武获胜，获得 ${contribution} 点门派贡献`);
      } else {
        logStore.addLog(`门派比武战败，获得 ${contribution} 点门派贡献`);
      }
      return { success: true, contribution, message: isVictory ? '比武获胜' : '比武惜败' };
    }

    return { success: false, contribution: 0, message: result.reason || '比武失败' };
  }

  /**
   * 指点弟子
   */
  static async teachDisciple(
    sectType: string
  ): Promise<{ success: boolean; contribution: number; message: string }> {
    const store = useSectContributionStore();
    const logStore = useGameLogStore();
    const config = sectContributionConfig;

    if (!config.isLoaded) {
      return { success: false, contribution: 0, message: '配置加载中...' };
    }

    const rule = config.getGainRule('teach_disciple');
    if (!rule) {
      return { success: false, contribution: 0, message: '未找到指点规则' };
    }

    const result = store.gainContribution(
      sectType,
      rule.type,
      rule.baseContribution,
      '指点门派弟子'
    );

    if (result.success) {
      logStore.addRewardLog(`指点门派弟子练功，获得 ${rule.baseContribution} 点门派贡献`);
      return {
        success: true,
        contribution: rule.baseContribution,
        message: '指点完成，获得门派贡献',
      };
    }

    return { success: false, contribution: 0, message: result.reason || '指点失败' };
  }

  /**
   * 清扫山门
   */
  static async clearTerritory(
    sectType: string
  ): Promise<{ success: boolean; contribution: number; message: string }> {
    const store = useSectContributionStore();
    const logStore = useGameLogStore();
    const config = sectContributionConfig;

    if (!config.isLoaded) {
      return { success: false, contribution: 0, message: '配置加载中...' };
    }

    const rule = config.getGainRule('clear_territory');
    if (!rule) {
      return { success: false, contribution: 0, message: '未找到清扫规则' };
    }

    const result = store.gainContribution(
      sectType,
      rule.type,
      rule.baseContribution,
      '清扫门派领地'
    );

    if (result.success) {
      logStore.addRewardLog(`清扫门派领地，获得 ${rule.baseContribution} 点门派贡献`);
      return {
        success: true,
        contribution: rule.baseContribution,
        message: '清扫完成，获得门派贡献',
      };
    }

    return { success: false, contribution: 0, message: result.reason || '清扫失败' };
  }

  /**
   * 获取可用兑换奖励列表
   */
  static getAvailableRewards(sectType: string): RedemptionReward[] {
    return sectContributionConfig.getAvailableRewards(sectType);
  }

  /**
   * 获取贡献等级信息
   */
  static getContributionLevel(sectType: string): ContributionLevel | undefined {
    const store = useSectContributionStore();
    const contribution = store.getTotalContribution(sectType);
    return sectContributionConfig.getLevelByContribution(contribution);
  }

  /**
   * 每日重置
   */
  static resetDaily(sectType: string): void {
    const store = useSectContributionStore();
    store.resetDaily(sectType);
  }
}

export const sectContributionService = SectContributionService;
