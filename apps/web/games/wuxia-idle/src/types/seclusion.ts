/**
 * 闭关修炼系统类型定义 v2.0
 * 金庸武侠风格「点香修炼」系统
 * @module types/seclusion
 */

// ========== 基础类型 ==========

/** 闭关类型（功课名目） */
export type SeclusionType = 'practice' | 'sparring' | 'reading';

/** 旧类型映射（向后兼容） */
export type LegacySeclusionType = 'yangqi' | 'lianti' | 'wudao';

/** 资源品质 */
export type ResourceQuality = 'common' | 'fine' | 'rare' | 'epic' | 'legendary';

/** 收集物稀有度 */
export type CollectibleRarity = 'common' | 'fine' | 'rare' | 'epic';

/** 资源类别 */
export type ResourceCategory = 'pill' | 'spirit_stone' | 'food' | 'incense';

/** 事件类型 */
export type SeclusionEventType = 'positive' | 'negative' | 'breakthrough' | 'neutral';

/** 时长选项 */
export type DurationOption = 25 | 50 | 90;

// ========== 收集物系统 ==========

/** 收集物定义 */
export interface CollectibleDefinition {
  id: string;
  name: string;
  rarity: CollectibleRarity;
  description: string;
  icon: string;
}

/** 收集物掉落结果 */
export interface CollectibleDrop {
  itemId: string;
  name: string;
  rarity: CollectibleRarity;
  description: string;
  icon: string;
  isNew: boolean; // 是否是新获得的
}

// ========== 江湖小剧场 ==========

/** 江湖小剧场事件 */
export interface JianghuStoryEvent {
  id: string;
  message: string;
  timestamp: number;
  type: 'general' | 'practice' | 'sparring' | 'reading' | 'rare';
}

// ========== 属性增益 ==========

/** 属性增益定义 */
export interface AttributeGains {
  strength?: number;
  agility?: number;
  vitality?: number;
  spirit?: number;
  maxHp?: number;
  maxEnergy?: number;
  attack?: number;
  defense?: number;
}

// ========== 资源相关 ==========

/** 资源槽位 - 闭关时消耗的资源 */
export interface SeclusionResourceSlot {
  itemId: string;
  quantity: number;
}

// ========== 闭关类型定义 ==========

/** 闭关类型定义 */
export interface SeclusionTypeDefinition {
  id: SeclusionType;
  name: string;
  description: string;
  icon: string;
  baseExpPerTick: number;
  baseGoldPerTick: number;
  primaryBonus: {
    type: 'exp' | 'attribute' | 'insight';
    multiplier: number;
  };
  /** 收集物掉落倾向 */
  collectibleDrops: {
    primary: string[];
    secondary: string[];
  };
  /** 事件权重修正 */
  eventWeightModifiers: Record<string, number>;
}

// ========== 闭关事件 ==========

/** 事件触发条件 */
export interface SeclusionEventCondition {
  minElapsedPercent?: number;
  maxElapsedPercent?: number;
  requiredType?: SeclusionType;
  requiredResourceCategory?: ResourceCategory;
}

/** 事件效果 - 支持固定值或范围 */
export interface SeclusionEventEffects {
  expBonus?: number | { min: number; max: number; scaleByLevel?: boolean };
  goldBonus?: number | { min: number; max: number };
  attributeBonus?: Partial<AttributeGains>;
  efficiencyModifier?: number;
  hpLossPercent?: number;
  expLossPercent?: number;
}

/** 闭关事件定义 */
export interface SeclusionEventDefinition {
  id: string;
  type: SeclusionEventType;
  weight: number;
  conditions?: SeclusionEventCondition;
  effects: SeclusionEventEffects;
  i18nKey: string;
}

/** 触发的闘关事件（运行时） */
export interface SeclusionEvent {
  id: string;
  type: SeclusionEventType;
  timestamp: number;
  effects: SeclusionEventEffects;
  message: string;
}

/** 事件日志记录 */
export interface SeclusionEventLog {
  eventId: string;
  type: SeclusionEventType;
  timestamp: number;
  message: string;
  appliedEffects: {
    expGained?: number;
    goldGained?: number;
    attributeGains?: Partial<AttributeGains>;
    hpLost?: number;
    expLost?: number;
  };
}

// ========== 闭关会话 ==========

/** 闭关配置 - 启动闭关时的参数 */
export interface SeclusionConfig {
  type: SeclusionType;
  durationMinutes: DurationOption;
  resources: SeclusionResourceSlot[];
  /** 是否开启闭门谢客 */
  doNotDisturb: boolean;
}

/** 闭关会话 - 运行中的闭关状态 */
export interface SeclusionSession {
  id: string;
  type: SeclusionType;
  startTime: number;
  plannedDurationMs: number;
  elapsedMs: number;
  consumedResources: SeclusionResourceSlot[];
  efficiency: number;

  // 累积数据
  totalExpGained: number;
  totalHpGained: number;
  totalEnergyGained: number;
  totalAttributeGains: AttributeGains;
  breakthroughAttempts: number;
  breakthroughSuccesses: number;

  // 临时效率修正（来自事件）
  temporaryEfficiencyModifier: number;

  // 新增：中断统计
  interruptCount: number;
  lastInterruptTime: number | null;

  // 新增：收集物掉落记录
  collectibleDrops: CollectibleDrop[];

  // 新增：江湖小剧场故事
  storyEvent: JianghuStoryEvent | null;
}

// ========== 学习统计（江湖手札） ==========

/** 每日学习统计 */
export interface DailyStudyStats {
  date: string; // YYYY-MM-DD 格式
  totalSessions: number; // 总闭关次数
  totalMinutes: number; // 总时长（分钟）
  practiceCount: number; // 闭门练功次数
  sparringCount: number; // 对招演练次数
  readingCount: number; // 抄经读谱次数
  interruptCount: number; // 心神散乱中断次数
  completedSessions: number; // 完成的闭关次数
  collectiblesObtained: number; // 获得收集物数量
  expGained: number; // 获得修为
  hpRecovered: number; // 恢复气血
  energyRecovered: number; // 恢复精力
}

/** 近七日统计 */
export interface WeeklyStats {
  dailyStats: DailyStudyStats[];
  weekStartDate: string;
  weekEndDate: string;
}

/** 总体学习统计 */
export interface StudyStats {
  totalSessions: number;
  totalMinutes: number;
  totalInterruptions: number;
  longestStreak: number; // 最长连续天数
  currentStreak: number; // 当前连续天数
  favoriteType: SeclusionType | null;
  totalCollectibles: number;
  weeklyStats: WeeklyStats;
}

// ========== 服务接口返回类型 ==========

/** 启动闭关结果 */
export interface SeclusionStartResult {
  success: boolean;
  sessionId?: string;
  message: string;
  consumedResources?: SeclusionResourceSlot[];
}

/** 停止闭关结果 */
export interface SeclusionStopResult {
  success: boolean;
  message: string;
  partialRewards: {
    exp: number;
    hp: number;
    energy: number;
    attributes: AttributeGains;
  };
  elapsedPercent: number;
  /** 获得的收集物 */
  collectibleDrop?: CollectibleDrop;
  /** 江湖小剧场故事 */
  storyEvent?: JianghuStoryEvent;
  /** 是否无中断完成 */
  completedWithoutInterrupt: boolean;
}

/** Tick处理结果 */
export interface SeclusionTickResult {
  expGained: number;
  hpGained: number;
  energyGained: number;
  attributeGains: AttributeGains;
  event?: SeclusionEvent;
  breakthrough?: BreakthroughResult;
  isCompleted: boolean;
}

/** 突破结果 */
export interface BreakthroughResult {
  attempted: boolean;
  success: boolean;
  newLevel?: number;
  rewards?: {
    attackIncrease: number;
    defenseIncrease: number;
    hpIncrease: number;
  };
  consolationGold?: number;
}

/** 离线收益结果 */
export interface OfflineRewardResult {
  offlineDurationMs: number;
  cappedDurationMs: number;
  rewards: {
    exp: number;
    hp: number;
    energy: number;
    attributes: AttributeGains;
  };
  events: SeclusionEventLog[];
  breakthroughs: BreakthroughResult[];
  message: string;
}

/** 可否开始闭关检查结果 */
export interface CanStartSeclusionResult {
  canStart: boolean;
  reason?: string;
  missingResources?: SeclusionResourceSlot[];
}

// ========== 状态管理 ==========

/** 闭关状态 */
export interface SeclusionState {
  isActive: boolean;
  isPaused: boolean;
  currentSession: SeclusionSession | null;
  accumulatedExp: number;
  accumulatedHp: number;
  accumulatedEnergy: number;
  accumulatedAttributes: AttributeGains;
  eventHistory: SeclusionEventLog[];

  // 新增：学习统计
  studyStats: StudyStats;

  // 新增：江湖小剧场历史
  storyHistory: JianghuStoryEvent[];
}

/** 闭关快照（用于存档） */
export interface SeclusionSnapshot {
  isActive: boolean;
  currentSession: SeclusionSession | null;
  eventHistory: SeclusionEventLog[];
  studyStats: StudyStats;
  storyHistory: JianghuStoryEvent[];
}

// ========== 配置参数 ==========

/** 闭关系统参数 */
export interface SeclusionParameters {
  tickIntervalMs: number;
  baseExpPerTick: number;
  baseHpRecoveryPerTick: number;
  baseEnergyRecoveryPerTick: number;
  eventTriggerChance: number;
  collectibleDropChance: number;
  reputationGainPerSession: number;
  reputationGainBonus: number;
  offlineMaxDurationMs: number;
  offlineEfficiencyMultiplier: number;
  offlineRewardCap: {
    exp: number;
    hp: number;
    energy: number;
  };
}

/** 完整配置文件结构 */
export interface SeclusionConfigFile {
  version: string;
  lastUpdated: string;
  durationOptions: Record<string, number>;
  types: SeclusionTypeDefinition[];
  collectibles: Record<string, CollectibleDefinition>;
  rarities: Record<CollectibleRarity, { name: string; dropWeight: number; color: string }>;
  storyEvents: {
    general: string[];
    practice: string[];
    sparring: string[];
    reading: string[];
    rare: string[];
  };
  events: SeclusionEventDefinition[];
  parameters: SeclusionParameters;
  qualityMultipliers: Record<ResourceQuality, number>;
  reputationTitles: { level: number; title: string; description: string }[];
}

// ========== 辅助类型 ==========

/** 时长选项显示类型 */
export interface DurationDisplay {
  key: string; // 一炷香 | 两炷香 | 一场闭关
  minutes: DurationOption;
  description: string;
}

/** 闭关类型显示类型 */
export interface TypeDisplay {
  id: SeclusionType;
  name: string;
  description: string;
  icon: string;
}

/** 统计摘要 */
export interface StatsSummary {
  todaySessions: number;
  todayInterruptions: number;
  favoriteType: string | null;
  weekProgress: number; // 0-1 本周进度
  totalCollectibles: number;
}
