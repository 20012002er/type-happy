/**
 * 叙事日志系统类型定义
 * 将战斗日志转换为小说化叙事
 */

// ========== 叙事级别 ==========

/**
 * 叙事级别
 * - off: 关闭叙事，使用原有简洁格式
 * - brief: 简洁模式
 * - normal: 标准模式
 * - drama: 戏剧模式
 */
export type NarrativeLevel = 'off' | 'brief' | 'normal' | 'drama';

// ========== 事件类型 ==========

/**
 * 战斗事件
 */
export interface CombatEvent {
  type: CombatEventType;
  attacker: 'player' | 'enemy';
  attackerName: string;
  defenderName: string;
  damage?: number;
  isCrit?: boolean;
  isDodged?: boolean;
  isBlocked?: boolean;
  move?: CombatMove;
  playerHp?: number;
  defenderHp?: number;
  context?: CombatContext;
}

export type CombatEventType =
  | 'combat.attack'
  | 'combat.dodge'
  | 'combat.crit'
  | 'combat.skill'
  | 'combat.heal'
  | 'combat.block'
  | 'combat.defeat';

export interface CombatMove {
  id: string;
  name: string;
  emoji?: string;
  target: 'single' | 'all' | 'lowest_hp';
}

export interface CombatContext {
  waveIndex?: number;
  enemyCount?: number;
  isLastEnemy?: boolean;
  isBossWave?: boolean;
}

/**
 * 地牢事件
 */
export interface DungeonEvent {
  type: DungeonEventType;
  dungeonName: string;
  waveIndex?: number;
  totalWaves?: number;
  waveTitle?: string;
  enemyCount?: number;
  rewardPool?: {
    gold: number;
    exp: number;
    drops: Array<{ name: string; qty: number }>;
  };
}

export type DungeonEventType =
  | 'dungeon.enter'
  | 'dungeon.wave_start'
  | 'dungeon.wave_clear'
  | 'dungeon.finish'
  | 'dungeon.fail'
  | 'dungeon.abort';

/**
 * 奖励事件
 */
export interface RewardEvent {
  type: RewardEventType;
  gold?: number;
  exp?: number;
  items?: Array<{ name: string; qty: number }>;
  source: RewardSource;
}

export type RewardEventType =
  | 'reward.get'
  | 'reward.pool_update'
  | 'reward.settlement';

export type RewardSource = 'wave_clear' | 'dungeon_clear' | 'partial_settlement';

/**
 * 所有游戏事件的联合类型
 */
export type GameEvent = CombatEvent | DungeonEvent | RewardEvent;

// ========== 模板类型 ==========

/**
 * 叙事模板
 */
export interface NarrativeTemplate {
  weight: number;
  brief: string;
  normal: string;
  drama: string;
  conditions?: NarrativeConditions;
}

/**
 * 模板触发条件
 */
export interface NarrativeConditions {
  isCrit?: boolean;
  isLastEnemy?: boolean;
  isBossWave?: boolean;
  hpBelow?: number;
}

/**
 * 模板配置文件结构
 */
export interface NarrativeTemplatesFile {
  version: string;
  lastUpdated: string;
  templates: Record<string, NarrativeTemplate[]>;
  synonyms: Record<string, string[]>;
}

// ========== 叙事设置 ==========

/**
 * 叙事设置
 */
export interface NarrativeSettings {
  level: NarrativeLevel;
}

/**
 * 默认叙事设置
 */
export const DEFAULT_NARRATIVE_SETTINGS: NarrativeSettings = {
  level: 'normal'
};
