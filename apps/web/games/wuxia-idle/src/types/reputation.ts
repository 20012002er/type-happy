/**
 * 声望系统类型定义
 * 基于古典武侠游戏规划与主线框架的江湖声望等级体系
 */

/**
 * 江湖声望等级枚举（8个等级）
 * 从"无名小卒"到"传奇人物"
 */
export enum ReputationLevel {
  无名小卒 = 1, // 0-99
  江湖新秀 = 2, // 100-499
  小有名气 = 3, // 500-1499
  一流高手 = 4, // 1500-4999
  赫赫有名 = 5, // 5000-14999
  宗师级人物 = 6, // 15000-49999
  武林泰斗 = 7, // 50000-99999
  传奇人物 = 8, // 100000+
}

/**
 * 声望类型枚举
 */
export enum ReputationType {
  江湖声望 = 'jianghu', // 江湖上的整体声望
  门派声望 = 'sect', // 特定门派的声望
}

/**
 * 声望等级配置
 */
export interface ReputationLevelConfig {
  level: ReputationLevel;
  name: string; // 等级名称
  minPoints: number; // 最小声望值
  maxPoints: number; // 最大声望值
  title: string; // 对应称号
  unlockContent: string[]; // 解锁内容描述
  bonusMultiplier: number; // 声望加成倍率（0.5-2.0）
}

/**
 * 声望获取规则
 */
export interface ReputationGainRule {
  action: string; // 触发动作
  basePoints: number; // 基础声望值
  multiplierType: 'level_diff' | '固定' | 'ratio';
  multiplierParam?: number; // 乘数参数（如等级差系数）
  maxGain?: number; // 最大获取上限
  description: string; // 规则描述
}

/**
 * 声望惩罚规则（恶名系统）
 */
export enum ReputationPenaltyLevel {
  无惩罚 = 0,
  声名狼藉 = -1, // -1 ~ -99
  江湖公敌 = -2, // -100 ~ -499
  恶贯满盈 = -3, // -500 ~ -1499
  魔头 = -4, // -1500 以下
}

export interface ReputationPenaltyRule {
  level: ReputationPenaltyLevel;
  minPoints: number;
  maxPoints: number;
  effects: {
    shopPriceIncrease?: number; // 商店价格加成
    npcHostility?: boolean; // NPC不友善
    deniedEntry?: string[]; // 被拒绝进入的区域
    combatDropIncrease?: number; // 战斗掉落增加
    canBeAttacked?: boolean; // 可被正道玩家主动攻击
  };
  description: string;
}

/**
 * 声望奖励配置
 */
export interface ReputationReward {
  level: ReputationLevel;
  perLevelBonus?: {
    goldBonus?: number; // 金币奖励加成
    expBonus?: number; // 经验奖励加成
    dropRateBonus?: number; // 掉落率加成
  };
  specialRewards?: string[]; // 特殊奖励列表
}

/**
 * 玩家声望数据
 */
export interface PlayerReputation {
  jianghu: number; // 江湖声望值
  sectReputations: Record<string, number>; // 各门派声望值（key为门派类型）
  currentLevel: ReputationLevel; // 当前等级
  penaltyLevel: ReputationPenaltyLevel; // 当前惩罚等级（恶名）
  title: string; // 当前称号
}

/**
 * 声望变化记录
 */
export interface ReputationLog {
  timestamp: number;
  change: number; // 正数为增加，负数为减少
  reason: string; // 变化原因
  source: string; // 来源（战斗/任务/护镖等）
}

/**
 * 声望系统配置（从配置文件加载）
 */
export interface ReputationConfig {
  levels: ReputationLevelConfig[];
  gainRules: ReputationGainRule[];
  penaltyRules: ReputationPenaltyRule[];
  rewards: ReputationReward[];
}

/**
 * 声望等级详细信息（用于UI展示）
 */
export interface ReputationLevelDetail extends ReputationLevelConfig {
  currentProgress: number; // 当前进度（0-100%）
  nextLevelName?: string; // 下一级名称（若无则为空）
  pointsToNext: number; // 距离下一级所需声望
}

/**
 * 门派类型枚举
 */
export enum SectType {
  少林 = 'shaolin', // 刚猛霸道
  武当 = 'wudang', // 以柔克刚
  峨眉 = 'emei', // 灵动飘逸
  华山 = 'huashan', // 奇险快绝
  丐帮 = 'gaibang', // 人数众多
}

/**
 * 门派声望等级枚举（6个等级）
 */
export enum SectReputationLevel {
  外门弟子 = 1, // 0-99
  记名弟子 = 2, // 100-299
  正式弟子 = 3, // 300-999
  核心弟子 = 4, // 1000-2999
  长老 = 5, // 3000-9999
  掌门 = 6, // 10000+
}

/**
 * 门派声望配置
 */
export interface SectReputationConfig {
  sectType: SectType;
  sectName: string;
  levels: SectReputationLevelConfig[];
  benefits: string[]; // 该门派弟子享有的福利
  trainingBonus: {
    artCategory?: string; // 擅长武学类别
    statBonus?: Record<string, number>; // 属性加成
  };
}

/**
 * 单个门派声望等级配置
 */
export interface SectReputationLevelConfig {
  level: SectReputationLevel;
  name: string;
  minPoints: number;
  maxPoints: number;
  title: string;
  discountPercent: number; // 门派商店折扣
  accessLevel: string; // 可进入的区域
  exclusiveRewards: string[]; // 专属奖励
}
