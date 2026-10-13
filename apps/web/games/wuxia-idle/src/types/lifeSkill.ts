/**
 * 生活技能系统类型定义
 * 参考 MilkyWayIdle 的设计理念
 */

/**
 * 生活技能类型枚举
 */
export enum LifeSkillType {
  HERB_GATHERING = 'herb_gathering',    // 采药
  WOODCUTTING = 'woodcutting',          // 伐木
  FISHING = 'fishing',                   // 钓鱼
  MINING = 'mining',                     // 采矿
  HUNTING = 'hunting',                   // 狩猎
  ALCHEMY = 'alchemy',                   // 炼丹
  COOKING = 'cooking',                   // 烹饪
  SMITHING = 'smithing',                 // 铸造
  LEATHERWORKING = 'leatherworking',     // 制皮
  ARTIFACT_CRAFTING = 'artifact_crafting', // 炼器
  TALISMAN_MAKING = 'talisman_making',   // 符箓
  MECHANISM = 'mechanism',               // 机关
  INCENSE_MAKING = 'incense_making'      // 调香
}

/**
 * 资源品质
 */
export enum ResourceQuality {
  COMMON = 'common',       // 普通（白色）
  FINE = 'fine',          // 精良（绿色）
  RARE = 'rare',          // 稀有（蓝色）
  EPIC = 'epic',          // 史诗（紫色）
  LEGENDARY = 'legendary', // 传说（橙色）
  MYTHIC = 'mythic'       // 神话（金色）
}

/**
 * 资源配置
 */
export interface ResourceConfig {
  id: string;                    // 资源唯一ID
  name: string;                  // 资源名称
  description: string;           // 资源描述
  skillType: LifeSkillType;      // 所属技能
  quality: ResourceQuality;      // 品质
  requiredLevel: number;         // 所需技能等级
  baseSuccessRate: number;       // 基础成功率（0-1）
  gatherTime: number;            // 采集时间（毫秒）
  experience: number;            // 获得经验值
  icon?: string;                 // 图标（可选）
  // 市场售卖控制（可选）
  sellable?: boolean;
  sellPrice?: number;
}

/**
 * 技能等级进度
 */
export interface SkillProgress {
  skillType: LifeSkillType;      // 技能类型
  level: number;                 // 当前等级
  currentExp: number;            // 当前经验值
  requiredExp: number;           // 升级所需经验
  totalExp: number;              // 总经验值
}

/**
 * 采集结果
 */
export interface GatherResult {
  success: boolean;              // 是否成功
  resourceId: string;            // 资源ID
  quantity: number;              // 获得数量
  experience: number;            // 获得经验
  message: string;               // 提示消息
  levelUp?: boolean;             // 是否升级
  newLevel?: number;             // 新等级
}

/**
 * 技能配置
 */
export interface LifeSkillConfig {
  type: LifeSkillType;           // 技能类型
  name: string;                  // 技能名称
  description: string;           // 技能描述
  icon: string;                  // 技能图标
  unlockLevel: number;           // 解锁等级
  unlockCondition?: string;      // 解锁条件描述
  maxLevel: number;              // 最大等级
}

/**
 * 玩家技能数据（用于存储）
 */
export interface PlayerSkillData {
  [key: string]: {               // 技能类型作为key
    level: number;
    currentExp: number;
    totalExp: number;
  };
}

