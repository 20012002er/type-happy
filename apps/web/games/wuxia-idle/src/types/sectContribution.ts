/**
 * 门派贡献类型定义
 */

/**
 * 贡献获取类型
 */
export type ContributionGainType =
  | 'daily_prayer'
  | 'sect_task'
  | 'donate_gold'
  | 'donate_material'
  | 'sect_battle'
  | 'defend_sect'
  | 'teach_disciple'
  | 'clear_territory';

/**
 * 贡献获取规则
 */
export interface ContributionGainRule {
  type: ContributionGainType;
  name: string;
  baseContribution: number;
  perGold?: number; // 用于donate_gold类型
  description: string;
  cooldown: 'none' | 'daily' | 'weekly';
  maxDaily?: number; // 每日最大次数限制
  requirements?: {
    minReputationLevel: number;
  };
}

/**
 * 兑换奖励类型
 */
export type RewardType = 'equipment' | 'item' | 'consumable';

/**
 * 兑换奖励配置
 */
export interface RedemptionReward {
  id: string;
  name: string;
  type: RewardType;
  category?: string; // equipment类别: weapon, armor等
  contributionCost: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
  sectTypes: string[]; // 适用的门派类型
  description: string;
  quantity?: number; // 消耗品数量
  requirements?: {
    minReputationLevel: number;
  };
}

/**
 * 贡献等级配置
 */
export interface ContributionLevel {
  level: number;
  name: string;
  minContribution: number;
  maxContribution: number;
  title: string;
  benefits: string[];
}

/**
 * 玩家门派贡献数据
 */
export interface PlayerSectContribution {
  sectType: string;
  totalContribution: number;
  currentLevel: number;
  lastPrayerTime: number;
  todayTaskCount: number;
  todayBattleCount: number;
  lastUpdateTime: number;
}

/**
 * 贡献变更记录
 */
export interface ContributionLog {
  timestamp: number;
  type: ContributionGainType;
  change: number;
  reason: string;
}

/**
 * 贡献系统配置
 */
export interface SectContributionConfig {
  contributionGains: ContributionGainRule[];
  redemptionRewards: RedemptionReward[];
  contributionLevels: ContributionLevel[];
}
