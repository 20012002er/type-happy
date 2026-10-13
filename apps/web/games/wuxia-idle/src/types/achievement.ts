export enum AchievementStatus {
  LOCKED = 'locked',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REWARDED = 'rewarded',
}

export enum AchievementCategory {
  GUIDE = 'guide',
  PROGRESSION = 'progression',
  COMBAT = 'combat',
  CRAFTING = 'crafting',
  ECONOMY = 'economy',
  EXPLORATION = 'exploration',
  LIFESTYLE = 'lifestyle',
}

export enum AchievementTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

export enum AchievementObjectiveType {
  DEFEAT_ENEMY = 'defeat_enemy',
  CRAFT_ITEM = 'craft_item',
  COLLECT_ITEM = 'collect_item',
  REACH_LEVEL = 'reach_level',
  VISIT_LOCATION = 'visit_location',
  EQUIP_ITEM = 'equip_item',
  MEDITATE_TIMES = 'meditate_times',
  EARN_GOLD = 'earn_gold',
  UPGRADE_SKILL = 'upgrade_skill',
  JOIN_SECT = 'join_sect', // 加入门派
  REACH_TITLE = 'reach_title', // 获得称号
  COLLECT_TRUTH_FRAGMENT = 'collect_truth_fragment', // 收集真相碎片
  COMPLETE_CHAPTER = 'complete_chapter', // 完成主线章节
}

export interface AchievementReward {
  gold?: number;
  exp?: number;
  reputation?: number;
  items?: Array<{
    id: string;
    quantity: number;
  }>;
  insight?: number;
}

export interface AchievementObjective {
  type: AchievementObjectiveType;
  target: string | number;
  description: string;
  current: number;
  required: number;
}

export interface AchievementRequirement {
  level?: number;
  completedIds?: string[];
  skills?: Record<string, number>;
}

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  points: number;
  objectives: Array<Omit<AchievementObjective, 'current'>>;
  rewards?: AchievementReward;
  requirements?: AchievementRequirement;
  hidden?: boolean;
  quickNavTarget?: string;
}

export interface Achievement extends AchievementConfig {
  status: AchievementStatus;
  objectives: AchievementObjective[];
  unlockedAt?: number;
  completedAt?: number;
  rewardedAt?: number;
}

export interface AchievementSummary {
  total: number;
  completed: number;
  pointsEarned: number;
  pointsTotal: number;
}

// 事件通知类型（开放式字符串，服务内部做路由）
export type AchievementEventType =
  | 'goldEarned'
  | 'combatWin'
  | 'levelReached'
  | 'joinSect'
  | 'reachTitle'
  | 'collectTruthFragment'
  | 'custom';

export interface AchievementEventPayload {
  type: AchievementEventType | string;
  amount?: number; // goldEarned 使用
  count?: number; // 通用递增
  level?: number; // levelReached 使用
  key?: string; // custom 使用，对应 counters 的键
}
