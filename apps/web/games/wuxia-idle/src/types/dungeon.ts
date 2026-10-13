/**
 * 地牢系统类型定义
 * 支持多波次、多敌人的地牢挑战机制
 */

// ========== 配置类型 ==========

/**
 * 地牢配置
 */
export interface DungeonConfig {
  id: string;
  name: string;
  description?: string;
  recommendLevel: number;
  entryCost: DungeonEntryCost;
  waves: WaveConfig[];
  reward: DungeonReward;
  unlockCondition?: DungeonUnlockCondition;
}

/**
 * 入口消耗
 */
export interface DungeonEntryCost {
  stamina?: number;
  gold?: number;
  ticketItemId?: string;
}

/**
 * 解锁条件
 */
export interface DungeonUnlockCondition {
  minLevel?: number;
  requiredQuestId?: string;
  requiredItemId?: string;
}

/**
 * 地牢奖励配置
 */
export interface DungeonReward {
  goldMultiplier: number;
  expMultiplier: number;
  dropTables: string[];
  bonusDropChance?: number;
  pity?: DungeonPity;
}

/**
 * 保底机制
 */
export interface DungeonPity {
  minRareEvery?: number;
  minEpicOnClear?: boolean;
}

/**
 * 波次配置
 */
export interface WaveConfig {
  id: string;
  title?: string;
  spawns: EnemySpawn[];
  modifiers?: WaveModifier[];
  isBossWave?: boolean;
}

/**
 * 敌人生成配置
 */
export interface EnemySpawn {
  enemyId: string;
  tier: EnemyTier;
  count: number;
  levelOffset?: number;
}

/**
 * 敌人等级
 */
export type EnemyTier = 'normal' | 'elite' | 'boss';

/**
 * 波次修饰符
 */
export type WaveModifier =
  | WaveModifierBuffEnemies
  | WaveModifierDebuffPlayer
  | WaveModifierTimeLimit
  | WaveModifierNoHeal;

export interface WaveModifierBuffEnemies {
  type: 'buff_enemies';
  attackMul?: number;
  hpMul?: number;
  defenseMul?: number;
}

export interface WaveModifierDebuffPlayer {
  type: 'debuff_player';
  attackMul?: number;
  defenseMul?: number;
}

export interface WaveModifierTimeLimit {
  type: 'time_limit';
  seconds: number;
}

export interface WaveModifierNoHeal {
  type: 'no_heal';
}

// ========== 运行时类型 ==========

/**
 * 运行时敌人实例
 */
export interface RuntimeEnemy {
  instanceId: string;
  configId: string;
  name: string;
  tier: EnemyTier;
  stats: RuntimeEnemyStats;
  modifiers?: RuntimeEnemyModifiers;
}

export interface RuntimeEnemyStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  level: number;
}

export interface RuntimeEnemyModifiers {
  attackMul: number;
  defenseMul: number;
}

/**
 * 奖励池
 */
export interface RewardPool {
  gold: number;
  exp: number;
  drops: RewardDrop[];
}

export interface RewardDrop {
  itemId: string;
  name: string;
  qty: number;
  rarity?: string;
}

/**
 * 地牢运行状态
 */
export interface DungeonRunState {
  dungeonId: string;
  dungeonName: string;
  waveIndex: number;
  totalWaves: number;
  enemies: RuntimeEnemy[];
  rewardPool: RewardPool;
  phase: DungeonPhase;
  startTime: number;
  battleCount: number;
  wins: number;
  losses: number;
}

/**
 * 地牢阶段
 */
export type DungeonPhase =
  | 'idle'        // 未在地牢中
  | 'preparing'   // 准备进入
  | 'fighting'    // 战斗中
  | 'between'     // 波次间隔
  | 'settlement'  // 结算中
  | 'finished'    // 已完成
  | 'failed'      // 已失败
  | 'stopped';    // 主动退出

// ========== 存档类型 ==========

/**
 * 地牢存档数据
 */
export interface DungeonSaveData {
  runState: DungeonRunState | null;
  history: DungeonHistory[];
}

/**
 * 地牢历史记录
 */
export interface DungeonHistory {
  dungeonId: string;
  completedAt: number;
  result: DungeonResult;
  wavesCleared: number;
  totalWaves: number;
  rewards: RewardPool;
}

export type DungeonResult = 'cleared' | 'failed' | 'aborted';

// ========== 配置文件类型 ==========

/**
 * 地牢配置文件结构
 */
export interface DungeonsFile {
  version: string;
  lastUpdated: string;
  dungeons: DungeonConfig[];
  locationDungeons: Record<string, string[]>;
}
