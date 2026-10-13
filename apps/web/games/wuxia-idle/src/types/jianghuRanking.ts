/**
 * 江湖榜系统类型定义
 * 基于古典武侠游戏规划与主线框架的江湖榜体系
 */

/**
 * 榜单类型枚举
 */
export enum RankingType {
  天榜 = 'tian', // 顶级高手榜
  地榜 = 'di', // 一流高手榜
  玄榜 = 'xuan', // 新秀榜
}

/**
 * 榜单条目状态
 */
export enum RankingEntryStatus {
  在榜 = 'active', // 正常在榜
  离榜 = 'inactive', // 已离开榜单
  挑战中 = 'challenging', // 正在被挑战
}

/**
 * 挑战结果枚举
 */
export enum ChallengeResult {
  胜利 = 'victory', // 挑战成功，替换排名
  失败 = 'defeat', // 挑战失败，排名不变
  平手 = 'draw', // 平手，排名不变
}

/**
 * 排名变化类型
 */
export type RankChangeType = 'up' | 'down' | 'same' | 'new';

/**
 * 江湖榜排名条目
 */
export interface RankingEntry {
  id: string; // 唯一标识
  rankingType: RankingType; // 榜单类型
  rank: number; // 排名位置
  name: string; // 角色名称
  level: number; // 等级
  sect?: string; // 门派（可选）
  combatPower: number; // 战力评分
  lastUpdated: number; // 最后更新时间
  status: RankingEntryStatus; // 状态
  avatar?: string; // 头像/形象
  rankChange?: number; // 排名变化（正数=上升，负数=下降，0=无变化）
  rankChangeType?: RankChangeType; // 排名变化类型
  lastRankChange?: number; // 上次排名变化时间
}

/**
 * 排名挑战结果
 */
export interface RankingChallengeResult {
  result: ChallengeResult; // 挑战结果
  oldRank: number; // 原来的排名
  newRank?: number; // 新的排名（挑战成功时）
  rewards?: {
    // 挑战奖励
    gold?: number;
    reputation?: number;
    exp?: number;
  };
  log: string; // 挑战日志
}

/**
 * 排名挑战请求
 */
export interface RankingChallengeRequest {
  targetEntryId: string; // 目标条目ID
  useChallengeToken?: boolean; // 是否使用挑战令
}

/**
 * 榜单配置
 */
export interface RankingConfig {
  type: RankingType;
  name: string;
  description: string;
  maxEntries: number;
  minLevel: number;
  entryReward: {
    goldPerRank?: number;
    reputationBonus?: number;
  };
  challengeRules: {
    requireToken: boolean;
    tokenCost?: number;
    dailyLimit?: number;
    cooldownMinutes?: number;
  };
  dynamicRanking?: {
    enabled: boolean;
    updateIntervalHours: number;
    fluctuationRange: number;
    npcVictoryBoost: number;
    npcDefeatPenalty: number;
    deathChance?: {
      天榜?: number;
      地榜?: number;
      玄榜?: number;
    };
    backupPromotionChance?: number;
  };
}

/**
 * 玩家排名信息
 */
export interface PlayerRankingInfo {
  currentRank?: number;
  bestRank?: number;
  inChallenge?: boolean;
  dailyChallengesRemaining: number;
}

/**
 * 榜单统计数据
 */
export interface RankingStats {
  totalChallengers: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
}

/**
 * 备用角色池条目
 */
export interface BackupPoolEntry {
  name: string;
  level: number;
  combatPower: number;
  sect?: string;
}

/**
 * 完整配置数据
 */
export interface JianghuRankingConfigData {
  version: string;
  lastUpdated: string;
  rankings: Array<{
    type: string;
    name: string;
    description: string;
    maxEntries: number;
    minLevel: number;
    entryReward: { goldPerRank?: number; reputationBonus?: number };
    challengeRules: {
      requireToken: boolean;
      tokenCost?: number;
      dailyLimit?: number;
      cooldownMinutes?: number;
    };
  }>;
  defaultEntries: {
    玄榜: Array<{ rank: number; name: string; level: number; combatPower: number; sect?: string }>;
    地榜: Array<{ rank: number; name: string; level: number; combatPower: number; sect?: string }>;
    天榜: Array<{ rank: number; name: string; level: number; combatPower: number; sect?: string }>;
  };
  backupPool: {
    玄榜: BackupPoolEntry[];
    地榜: BackupPoolEntry[];
    天榜: BackupPoolEntry[];
  };
  challengeRewards: {
    victory: { gold: number; reputation: number; exp: number };
    defeat: { gold: number; reputation: number; exp: number };
  };
  rankUpRewards: {
    top10: { gold: number; reputation: number; title?: string };
    top50: { gold: number; reputation: number };
    top100: { gold: number; reputation: number };
  };
  dynamicRanking: {
    enabled: boolean;
    updateIntervalHours: number;
    fluctuationRange: number;
    npcVictoryBoost: number;
    npcDefeatPenalty: number;
    deathChance: {
      天榜: number;
      地榜: number;
      玄榜: number;
    };
    backupPromotionChance: number;
  };
}
