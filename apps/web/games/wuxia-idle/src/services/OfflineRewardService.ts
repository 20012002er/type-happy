/**
 * 离线收益服务
 * 负责计算玩家离线期间的收益
 */

import type { OfflineSnapshot, OfflineReward, OfflineActivityType } from '@/types/offline';
import type { ResourceConfig } from '@/types/lifeSkill';
import { offlineConfigService } from '@/services/config/OfflineConfigService';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';
import { getBattleInterval } from '@/config/combatConfig';

export class OfflineRewardService {
  private static instance: OfflineRewardService;

  private constructor() {}

  static getInstance(): OfflineRewardService {
    if (!this.instance) {
      this.instance = new OfflineRewardService();
    }
    return this.instance;
  }

  /**
   * 计算离线收益
   * @param snapshot 离线快照
   * @param ownedUpgrades 玩家拥有的离线时长提升道具
   */
  async calculateOfflineRewards(
    snapshot: OfflineSnapshot,
    ownedUpgrades: string[] = []
  ): Promise<OfflineReward | null> {
    const now = Date.now();
    const offlineTimeMs = now - snapshot.lastActiveTime;

    // 检查是否达到最小离线时长
    const minOfflineMs = offlineConfigService.getMinOfflineMinutes() * 60 * 1000;
    if (offlineTimeMs < minOfflineMs) {
      console.log('[OfflineReward] 离线时间不足，无收益');
      return null;
    }

    // 检查是否有活动
    if (!snapshot.activeActivity || snapshot.activeActivity.type === 'none') {
      console.log('[OfflineReward] 离线时无活动，无收益');
      return null;
    }

    // 检查活动是否支持离线收益
    const activityType = snapshot.activeActivity.type;
    if (!offlineConfigService.isActivitySupported(activityType)) {
      console.log('[OfflineReward] 活动类型不支持离线收益:', activityType);
      return null;
    }

    // 计算有效离线时长（限制上限）
    const maxOfflineMs = offlineConfigService.getMaxOfflineHours(ownedUpgrades) * 60 * 60 * 1000;
    const cappedTimeMs = Math.min(offlineTimeMs, maxOfflineMs);

    // 获取离线效率
    const efficiency = offlineConfigService.getActivityEfficiency(activityType);

    console.log('[OfflineReward] 计算离线收益:', {
      activityType,
      offlineTimeMs,
      cappedTimeMs,
      efficiency,
      offlineHours: (cappedTimeMs / (60 * 60 * 1000)).toFixed(2)
    });

    // 根据活动类型计算收益
    let reward: OfflineReward;
    switch (activityType) {
      case 'gathering':
        reward = await this.calculateGatheringRewards(snapshot, cappedTimeMs, efficiency);
        break;
      case 'meditation':
        reward = await this.calculateMeditationRewards(snapshot, cappedTimeMs, efficiency);
        break;
      case 'combat':
        reward = await this.calculateCombatRewards(snapshot, cappedTimeMs, efficiency);
        break;
      default:
        console.warn('[OfflineReward] 未实现的活动类型:', activityType);
        return null;
    }

    reward.offlineTimeMs = offlineTimeMs;
    reward.cappedTimeMs = cappedTimeMs;
    reward.efficiency = efficiency;

    return reward;
  }

  /**
   * 计算采集类活动的离线收益
   */
  private async calculateGatheringRewards(
    snapshot: OfflineSnapshot,
    cappedTimeMs: number,
    efficiency: number
  ): Promise<OfflineReward> {
    const activityData = snapshot.activeActivity!.data;
    const { resourceId, skillType } = activityData;

    // 获取资源配置
    const resource = LifeSkillConfigService.getResource(resourceId, skillType as any);
    if (!resource) {
      console.warn('[OfflineReward] 未找到资源配置:', resourceId, '技能类型:', skillType);
      return this.createEmptyReward(cappedTimeMs, efficiency, '资源配置不存在');
    }

    // 计算能完成多少次采集
    const gatherTimeMs = resource.gatherTime; // gatherTime 已经是毫秒单位
    const maxIterations = offlineConfigService.getGatheringMaxIterations();
    const possibleIterations = Math.floor(cappedTimeMs / gatherTimeMs);
    const actualIterations = Math.min(possibleIterations, maxIterations);

    if (actualIterations <= 0) {
      return this.createEmptyReward(cappedTimeMs, efficiency, '离线时间不足以完成一次采集');
    }

    // 计算成功次数（考虑成功率和离线效率）
    const adjustedSuccessRate = resource.baseSuccessRate * efficiency;
    let successCount = 0;
    let totalSkillExp = 0;

    for (let i = 0; i < actualIterations; i++) {
      if (Math.random() < adjustedSuccessRate) {
        successCount++;
        totalSkillExp += resource.experience;
      }
    }

    // 角色总经验（技能经验的30%）
    const totalCharExp = Math.floor(totalSkillExp * 0.3);

    const messages: string[] = [];
    messages.push(`离线期间，${resource.name}自动采集进行了${actualIterations}次`);
    messages.push(`成功${successCount}次，失败${actualIterations - successCount}次`);
    if (successCount > 0) {
      messages.push(`获得了${successCount}个${resource.name}`);
      messages.push(`${skillType}技能经验+${totalSkillExp}`);
      messages.push(`角色总经验+${totalCharExp}`);
    }

    return {
      offlineTimeMs: 0, // 会在外部设置
      cappedTimeMs,
      efficiency,
      rewards: {
        gatheredItems: successCount > 0 ? [{
          resourceId: resource.id,
          resourceName: resource.name,
          quantity: successCount
        }] : [],
        skillExp: totalSkillExp > 0 ? [{
          skillType,
          exp: totalSkillExp
        }] : [],
        totalExp: totalCharExp
      },
      message: this.generateSummaryMessage(cappedTimeMs, successCount, resource.name),
      detailedMessages: messages
    };
  }

  /**
   * 计算打坐修炼的离线收益
   */
  private async calculateMeditationRewards(
    snapshot: OfflineSnapshot,
    cappedTimeMs: number,
    efficiency: number
  ): Promise<OfflineReward> {
    // TODO: 实现打坐修炼的离线收益计算
    // 暂时返回空收益
    return this.createEmptyReward(cappedTimeMs, efficiency, '打坐修炼离线收益暂未实现');
  }

  /**
   * 计算战斗类活动的离线收益（MVP）
   * - 基于离线时长 / 战斗间隔估算战斗场次
   * - 以效率作为近似胜率（限定范围0.3~0.8）
   * - 奖励：每胜一场 +5 角色经验，+3 金币
   */
  private async calculateCombatRewards(
    snapshot: OfflineSnapshot,
    cappedTimeMs: number,
    efficiency: number
  ): Promise<OfflineReward> {
    const activityData = snapshot.activeActivity?.data || {};
    const enemyId = activityData.enemyId as string | undefined;

    const intervalMs = getBattleInterval();
    const fights = Math.max(0, Math.floor(cappedTimeMs / Math.max(1, intervalMs)));

    const estimatedWinRate = Math.min(0.8, Math.max(0.3, efficiency));
    const wins = Math.floor(fights * estimatedWinRate);

    const totalExp = wins * 5;
    const gold = wins * 3;

    const enemyText = enemyId ? `（敌人: ${enemyId}）` : '';
    const detailedMessages: string[] = [];
    detailedMessages.push(`离线期间估算完成战斗 ${fights} 场${enemyText}`);
    detailedMessages.push(`估算胜利 ${wins} 场（按效率 ${Math.round(estimatedWinRate * 100)}% 折算）`);
    if (wins > 0) {
      detailedMessages.push(`角色经验 +${totalExp}`);
      detailedMessages.push(`金币 +${gold}`);
    }

    return {
      offlineTimeMs: 0,
      cappedTimeMs,
      efficiency,
      rewards: {
        totalExp: totalExp > 0 ? totalExp : 0,
        gold: gold > 0 ? gold : 0
      },
      message: `离线战斗结算：预计完成 ${fights} 场，胜利 ${wins} 场。`,
      detailedMessages
    };
  }

  /**
   * 创建空收益对象
   */
  private createEmptyReward(cappedTimeMs: number, efficiency: number, message: string): OfflineReward {
    return {
      offlineTimeMs: 0,
      cappedTimeMs,
      efficiency,
      rewards: {},
      message,
      detailedMessages: [message]
    };
  }

  /**
   * 生成总结消息
   */
  private generateSummaryMessage(timeMs: number, itemCount: number, itemName: string): string {
    const hours = Math.floor(timeMs / (60 * 60 * 1000));
    const minutes = Math.floor((timeMs % (60 * 60 * 1000)) / (60 * 1000));

    let timeStr = '';
    if (hours > 0) {
      timeStr = `${hours}小时`;
      if (minutes > 0) {
        timeStr += `${minutes}分钟`;
      }
    } else {
      timeStr = `${minutes}分钟`;
    }

    if (itemCount > 0) {
      return `离线${timeStr}，自动采集获得了${itemCount}个${itemName}`;
    } else {
      return `离线${timeStr}，未获得任何收益`;
    }
  }
}

// 导出单例
export const offlineRewardService = OfflineRewardService.getInstance();

