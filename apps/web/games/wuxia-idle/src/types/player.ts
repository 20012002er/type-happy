/**
 * 玩家属性系统类型定义
 * 基于武侠放置游戏的数值体系设计
 */

/**
 * 玩家基础属性
 *
 * 架构分层：
 * - 第一层：基础四维（strength, agility, vitality, spirit）
 * - 第二层：派生战斗属性（attack, defense, hp等，由四维计算）
 * - 第三层：武侠特色（qinggongLevel, neigongLevel等）
 */
export interface PlayerStats {
  // ========== 系统属性 ==========
  level: number; // 当前等级
  totalExp: number; // 总经验值（累计）
  currentExp: number; // 当前等级经验进度
  requiredExp: number; // 升级所需经验

  // ========== 第一层：基础四维（核心属性） ==========
  strength: number; // 力量 - 影响攻击、破防、负重
  agility: number; // 敏捷 - 影响命中、闪避、速度、轻功
  vitality: number; // 体质 - 影响生命、防御、韧性
  spirit: number; // 悟性 - 影响内力、内功、学习

  // ========== 第二层：派生战斗属性 ==========
  hp: number; // 当前生命值
  maxHp: number; // 最大生命值 = 基础 + 体质×10
  attack: number; // 物理攻击 = 基础 + 力量×2 + 武器
  defense: number; // 物理防御 = 基础 + 体质×1.5 + 护甲
  energy: number; // 当前内力值
  maxEnergy: number; // 最大内力 = 基础 + 悟性×5

  // 命中与闪避
  accuracy: number; // 命中率 [0.9, 1.4] 基础90%，可超100%对抗闪避
  dodgeChance: number; // 闪避率 [0.03, 0.5] 上限50%

  // 暴击系统
  critChance: number; // 暴击率 [0.05, 0.35] 上限35%
  critMultiplier: number; // 暴击倍率 [1.5, 2.5]

  // 防御系统
  blockChance: number; // 格挡率 [0, 0.3] 需要盾牌，格挡50%伤害
  tenacity: number; // 韧性 = 体质×0.5，降低受到的暴击率

  // 其他战斗属性
  armorPenetration: number; // 破防值 = 力量×0.5，无视X点防御
  speed: number; // 出手速度 = 1 + 敏捷×0.02，决定行动顺序

  // ========== 第三层：武侠特色系统 ==========
  qinggongLevel: number; // 轻功等级 [0, 20] 每级+1%闪避
  neigongLevel: number; // 内功修为 [0, 20] 每级+2内力/秒恢复
  energyRegen: number; // 内力恢复速度 每秒恢复量

  // ========== 辅助属性 ==========
  luck: number; // 幸运 影响掉落、事件触发概率
}

// 玩家资源系统
export interface PlayerResources {
  gold: number; // 金币
  reputation: number; // 声望/江湖地位
}

// 玩家位置信息
export interface PlayerPosition {
  mapId: string; // 地图ID
  locationId: string; // 当前位置ID
}

// 玩家状态枚举
export enum PlayerState {
  IDLE = 'idle', // 闲置状态
  MEDITATING = 'meditating', // 打坐中
  PRACTICING = 'practicing', // 练功中
  EXPLORING = 'exploring', // 闯荡江湖中
  RESTING = 'resting', // 休息中
  COMBAT = 'combat', // 战斗中
}

// 玩家动作类型
export enum ActionType {
  MEDITATE = 'meditate', // 打坐 - 恢复生命值，小幅增加经验
  PRACTICE = 'practice', // 练功 - 增加攻击力和经验
  EXPLORE = 'explore', // 闯荡江湖 - 触发随机事件
  REST = 'rest', // 休息 - 恢复生命值
  RESTORE_HP = 'restoreHp', // 恢复生命值（打坐/休息合并）
  RESTORE_STAMINA = 'restoreStamina', // 恢复体力
  RESTORE_ENERGY = 'restoreEnergy', // 恢复内力
}

import type { PlayerMartialState } from './martial';
import type { PlayerSectData } from './sect';

// 体力/饱食度
export interface GaugeValue {
  current: number;
  max: number;
}

// 完整的玩家数据接口
export interface Player {
  id: string; // 玩家唯一ID
  name: string; // 玩家名称（默认"无名侠客"）
  avatar: string; // 玩家头像（emoji表情）
  title: string; // 称号
  stats: PlayerStats; // 基础属性
  resources: PlayerResources; // 资源
  position: PlayerPosition; // 位置信息
  state: PlayerState; // 当前状态
  lastActiveTime: number; // 最后活跃时间（用于离线收益计算）
  createdAt: number; // 角色创建时间
  // —— 武学系统 ——
  martial?: PlayerMartialState; // 已学习的武学与招数
  // —— 门派系统 ——
  sect?: PlayerSectData; // 门派数据
  // —— 运行时属性 ——
  stamina?: GaugeValue; // 体力
  satiety?: GaugeValue; // 饱食度
}

/**
 * 玩家属性成长配置
 * 定义每级提升的属性增量
 */
export interface PlayerGrowthConfig {
  // ========== 基础四维成长 ==========
  baseStrength: number; // 初始力量
  strengthPerLevel: number; // 每级力量增长
  baseAgility: number; // 初始敏捷
  agilityPerLevel: number; // 每级敏捷增长
  baseVitality: number; // 初始体质
  vitalityPerLevel: number; // 每级体质增长
  baseSpirit: number; // 初始悟性
  spiritPerLevel: number; // 每级悟性增长

  // ========== 派生属性基础值（1级时） ==========
  baseHp: number; // 基础生命值
  hpPerLevel: number; // 每级生命值增长
  baseAttack: number; // 基础攻击力
  attackPerLevel: number; // 每级攻击力增长
  baseDefense: number; // 基础防御力
  defensePerLevel: number; // 每级防御力增长
  baseEnergy: number; // 基础最大内力
  energyPerLevel: number; // 每级内力增长

  // ========== 战斗属性成长 ==========
  baseAccuracy: number; // 基础命中率
  accuracyPerLevel: number; // 每级命中率增长
  baseDodgeChance: number; // 基础闪避率
  dodgeChancePerLevel: number; // 每级闪避率增长
  baseCritChance: number; // 基础暴击率
  critChancePerLevel: number; // 每级暴击率增长
  baseCritMultiplier: number; // 基础暴击倍率
  baseBlockChance: number; // 基础格挡率
  baseSpeed: number; // 基础速度
  speedPerLevel: number; // 每级速度增长

  // ========== 武侠特色初始值 ==========
  baseQinggongLevel: number; // 初始轻功等级
  baseNeigongLevel: number; // 初始内功等级
  baseEnergyRegen: number; // 基础内力恢复

  // ========== 其他 ==========
  baseLuck: number; // 基础幸运
  luckPerLevel: number; // 每级幸运增长
  expMultiplier: number; // 经验值倍数（已弃用，保留兼容）
}

/**
 * 玩家默认成长配置
 * 符合低武/中武武侠世界观的数值设定
 *
 * 设计原则：
 * - 等级上限80级
 * - 属性值在10-99范围
 * - 百分比属性不超过50%
 * - 平衡四维成长，体质略高（防御型）
 */
export const DEFAULT_PLAYER_CONFIG: PlayerGrowthConfig = {
  // ========== 基础四维成长 ==========
  baseStrength: 5, // 1级：5力量
  strengthPerLevel: 1, // 每级+1 → 80级：84力量
  baseAgility: 5, // 1级：5敏捷
  agilityPerLevel: 1, // 每级+1 → 80级：84敏捷
  baseVitality: 5, // 1级：5体质
  vitalityPerLevel: 2, // 每级+2（防御型）→ 80级：163体质
  baseSpirit: 5, // 1级：5悟性
  spiritPerLevel: 1, // 每级+1 → 80级：84悟性

  // ========== 派生属性基础值 ==========
  baseHp: 100, // 1级基础HP：100
  hpPerLevel: 20, // 每级+20 → 公式: 100 + 体质×10 + (等级-1)×20
  baseAttack: 10, // 1级基础攻击：10
  attackPerLevel: 3, // 每级+3 → 公式: 10 + 力量×2 + (等级-1)×3
  baseDefense: 5, // 1级基础防御：5
  defensePerLevel: 2, // 每级+2 → 公式: 5 + 体质×1.5 + (等级-1)×2
  baseEnergy: 50, // 1级基础内力：50
  energyPerLevel: 10, // 每级+10 → 公式: 50 + 悟性×5 + (等级-1)×10

  // ========== 战斗属性成长 ==========
  baseAccuracy: 0.9, // 基础命中90%
  accuracyPerLevel: 0.005, // 每级+0.5% → 80级: 90% + (敏捷×0.5%) + 39.5% ≈ 130%+
  baseDodgeChance: 0.03, // 基础闪避3%
  dodgeChancePerLevel: 0.002, // 每级+0.2% → 上限50%（含轻功加成）
  baseCritChance: 0.05, // 基础暴击5%
  critChancePerLevel: 0.002, // 每级+0.2% → 上限35%
  baseCritMultiplier: 1.5, // 基础暴击倍率150%
  baseBlockChance: 0, // 基础格挡0%（需要盾牌）
  baseSpeed: 1.0, // 基础速度1.0
  speedPerLevel: 0.02, // 每级+0.02 → 公式: 1 + 敏捷×0.02

  // ========== 武侠特色初始值 ==========
  baseQinggongLevel: 0, // 初始轻功0级（需要学习）
  baseNeigongLevel: 0, // 初始内功0级（需要学习）
  baseEnergyRegen: 5, // 基础内力恢复 5/秒

  // ========== 其他 ==========
  baseLuck: 1, // 基础幸运1
  luckPerLevel: 0.2, // 每级+0.2 → 80级: 16.8
  expMultiplier: 1.5, // 保留兼容性（实际由levelExpConfig控制）
};

/**
 * 玩家等级提升结果
 * 记录升级时的属性增长，用于UI展示
 */
export interface LevelUpResult {
  success: boolean;
  newLevel: number;
  previousLevel: number;
  remainingExp: number;

  // 主要属性提升（必须显示）
  hpIncrease: number;
  attackIncrease: number;
  defenseIncrease: number;

  // 基础四维提升（可选，详细面板显示）
  strengthIncrease?: number;
  agilityIncrease?: number;
  vitalityIncrease?: number;
  spiritIncrease?: number;

  // 其他派生属性提升（可选）
  energyIncrease?: number;
  accuracyIncrease?: number;
  dodgeChanceIncrease?: number;
  critChanceIncrease?: number;
  speedIncrease?: number;
  luckIncrease?: number;
}

// 动作执行结果
export interface ActionResult {
  success: boolean;
  actionType: ActionType;
  hpChange?: number;
  expGain?: number;
  attackIncrease?: number;
  defenseIncrease?: number;
  goldGain?: number;
  reputationGain?: number;
  message: string;
  duration: number; // 动作耗时（毫秒）
}
