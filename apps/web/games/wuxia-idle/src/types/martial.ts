/**
 * 武学与招数类型定义
 * 保持KISS：仅定义运行期必需字段，扩展通过可选字段承载
 */

// 招数类别：外功(physical)、内功(internal)、通用(universal)
export type MoveCategory = 'outer' | 'inner' | 'universal';

/**
 * 招数定义（由 JSON5 配置驱动）
 */
export interface Move {
  id: string;               // 招数ID（唯一）
  name: string;             // 招数名称
  category: MoveCategory;   // 招数类别
  description?: string;     // 文案描述
  /**
   * 伤害修饰（在基础伤害之上）
   * damage = floor(base * damageMultiplier) + damageFlat，然后再走暴击逻辑
   */
  damageMultiplier: number; // 伤害倍数（默认1）
  damageFlat?: number;      // 额外固定伤害（可为负）
  /**
   * 概率修饰
   */
  extraCritChance?: number; // 额外暴击率（叠加到玩家暴击率）
  extraHitChance?: number;  // 额外命中率修正（对抗对方闪避，简单加法）
  /**
   * 内力相关
   */
  energyCost?: number;      // 释放消耗的内力
  minLevel?: number;        // 使用最低等级
  tags?: string[];          // 标签（流派/效果等）
  emojis?: string[];        // 招式对应的emoji表现（用于战斗飘字）
}

export interface TalentNodeEffect {
  stats?: {
    attack?: number;
    defense?: number;
    maxHp?: number;
    maxEnergy?: number;
    critChance?: number;
    critMultiplier?: number;
  };
  moveId?: string;
  move?: Move;
  tags?: string[];
}

export interface TalentNodeCostMaterial {
  id: string;
  quantity: number;
}

export interface TalentNodeCost {
  insight?: number;
  gold?: number;
  materials?: TalentNodeCostMaterial[];
}

export interface TalentNodePosition {
  x: number;
  y: number;
}

export type TalentNodeType = 'root' | 'stat' | 'skill' | 'utility';

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  type: TalentNodeType;
  position: TalentNodePosition;
  category?: string;
  autoUnlock?: boolean;
  cost?: TalentNodeCost;
  prerequisites?: string[];
  connections?: string[];
  effect?: TalentNodeEffect;
}

export interface TalentTreeConfig {
  version: string;
  theme?: string;
  startingPoints?: number;
  nodes: Record<string, TalentNode>;
}

/**
 * 武学（秘籍）定义
 * 一门武学可授予若干招数，授予逻辑通过 movePools 控制，实现“同书不同悟”。
 */
export interface MartialArt {
  id: string;                 // 武学ID
  name: string;               // 名称
  category: 'inner' | 'outer' | 'mixed'; // 武学类型
  description?: string;       // 文案描述
  /**
   * 学习时的招数授予池：
   * - 每个池可独立roll若干次（minRolls~maxRolls），每次从给定moveIds中等概率抽取1个
   * - 通过多个池组合实现差异化
   */
  movePools?: Array<{
    moveIds: string[];
    minRolls?: number;  // 默认1
    maxRolls?: number;  // 默认1
  }>;
  /**
   * 被动增益（可选，预留）
   */
  passives?: {
    attackMultiplier?: number;
    defenseMultiplier?: number;
    energyRegenPerTurn?: number;
  };
  /**
   * 学习需求（可选，预留）
   */
  requirements?: {
    minLevel?: number;
    minReputation?: number;
  };
}

// ===== 配置文件容器类型 =====

export interface MovesFile {
  version: string;
  lastUpdated: string;
  moves: Record<string, Move>;
  talentTree?: TalentTreeConfig;
}

export interface MartialArtsFile {
  version: string;
  lastUpdated: string;
  arts: Record<string, MartialArt>;
}

/**
 * 玩家武学数据（挂载在 Player.martial）
 */
export interface PlayerMartialState {
  learnedArtIds: string[];     // 已学武学
  learnedMoveIds: string[];    // 已悟招数
  equipped: {                  // 当前心法/外功（预留）
    inner?: string;
    outer?: string;
  };
  proficiency: Record<string, number>; // 招数熟练度（预留）
}


