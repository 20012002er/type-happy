/**
 * 数值计算工具函数
 * 纯函数设计，易于测试和维护
 */

import type { PlayerStats, PlayerGrowthConfig } from '@/types/player';
import { 
  getRequiredExpForNextLevel as cfgGetRequiredExpForNextLevel,
  calculateLevelFromTotalExp as cfgCalculateLevelFromTotalExp
} from '@/config/levelExpConfig';

// ===== 经验值和等级计算 =====

// 等级-经验由配置驱动：以下保留名称供旧代码引用，但实现委托配置
export const calculateLevelExp = (level: number): number => {
  // 返回达到该等级所需的累计经验阈值（用于少量遗留场景），同步使用缓存
  if (level <= 1) return 0;
  let sum = 0;
  for (let l = 1; l < level; l++) {
    sum += cfgGetRequiredExpForNextLevel(l);
  }
  return sum;
};

/**
 * 计算从当前等级升到下一等级所需的经验值
 */
export const calculateNextLevelExp = (currentLevel: number): number => {
  return cfgGetRequiredExpForNextLevel(currentLevel);
};

/**
 * 根据当前经验值计算应该的等级
 * 返回玩家当前经验值对应的等级
 */
export const calculateLevelFromExp = (totalExp: number): number => {
  return cfgCalculateLevelFromTotalExp(totalExp);
};

/**
 * 检查是否可以升级
 * 返回升级信息：是否可升级、新等级、剩余经验
 */
export const checkLevelUp = (currentLevel: number, totalExp: number) => {
  const newLevel = calculateLevelFromExp(totalExp);
  const canLevelUp = newLevel > currentLevel;
  const remainingExp = totalExp - calculateLevelExp(newLevel); // 新等级进度
  return {
    canLevelUp,
    newLevel,
    previousLevel: currentLevel,
    remainingExp
  };
};

// ===== 属性成长计算 =====

/**
 * 根据等级和配置计算玩家的基础属性
 * 
 * 计算逻辑：
 * 1. 先计算基础四维（力量、敏捷、体质、悟性）
 * 2. 再基于四维计算派生属性（HP、攻击、防御等）
 * 3. 应用上下限约束
 * 
 * @param level 玩家等级
 * @param config 成长配置
 * @returns 完整的玩家基础属性
 */
export const calculateBaseStats = (
  level: number,
  config: PlayerGrowthConfig
): Omit<PlayerStats, 'totalExp' | 'currentExp' | 'requiredExp'> => {
  // ========== 第一层：基础四维 ==========
  const strength = config.baseStrength + (level - 1) * config.strengthPerLevel;
  const agility = config.baseAgility + (level - 1) * config.agilityPerLevel;
  const vitality = config.baseVitality + (level - 1) * config.vitalityPerLevel;
  const spirit = config.baseSpirit + (level - 1) * config.spiritPerLevel;
  
  // ========== 第二层：派生战斗属性 ==========
  // 生命值 = 基础 + 体质×10 + (等级-1)×成长
  const maxHp = config.baseHp + vitality * 10 + (level - 1) * config.hpPerLevel;
  
  // 攻击力 = 基础 + 力量×2 + (等级-1)×成长
  const attack = config.baseAttack + strength * 2 + (level - 1) * config.attackPerLevel;
  
  // 防御力 = 基础 + 体质×1.5 + (等级-1)×成长
  const defense = config.baseDefense + vitality * 1.5 + (level - 1) * config.defensePerLevel;
  
  // 内力值 = 基础 + 悟性×5 + (等级-1)×成长
  const maxEnergy = config.baseEnergy + spirit * 5 + (level - 1) * config.energyPerLevel;
  
  // 命中率 = 基础 + 敏捷×0.005 + (等级-1)×成长
  const accuracy = config.baseAccuracy + agility * 0.005 + (level - 1) * config.accuracyPerLevel;
  
  // 闪避率 = 基础 + 敏捷×0.002 + (等级-1)×成长
  const dodgeChance = config.baseDodgeChance + agility * 0.002 + (level - 1) * config.dodgeChancePerLevel;
  
  // 暴击率 = 基础 + (敏捷+力量)×0.001 + (等级-1)×成长
  const critChance = config.baseCritChance + (agility + strength) * 0.001 + (level - 1) * config.critChancePerLevel;
  
  // 暴击倍率 = 基础 + 力量×0.01
  const critMultiplier = config.baseCritMultiplier + strength * 0.01;
  
  // 格挡率 = 基础 + 体质×0.003（需要装备盾牌才有实际效果）
  const blockChance = config.baseBlockChance + vitality * 0.003;
  
  // 韧性 = 体质×0.5（降低受到的暴击率）
  const tenacity = vitality * 0.5;
  
  // 破防值 = 力量×0.5
  const armorPenetration = strength * 0.5;
  
  // 速度 = 基础 + 敏捷×0.02 + (等级-1)×成长
  const speed = config.baseSpeed + agility * 0.02 + (level - 1) * config.speedPerLevel;
  
  // ========== 第三层：武侠特色系统 ==========
  const qinggongLevel = config.baseQinggongLevel;
  const neigongLevel = config.baseNeigongLevel;
  // 内力恢复 = 基础 + 悟性×0.5 + 内功等级×2
  const energyRegen = config.baseEnergyRegen + spirit * 0.5 + neigongLevel * 2;
  
  // ========== 辅助属性 ==========
  const luck = config.baseLuck + (level - 1) * config.luckPerLevel;
  
  // ========== 应用上下限约束 ==========
  return {
    level,
    
    // 基础四维
    strength,
    agility,
    vitality,
    spirit,
    
    // 派生属性
    hp: maxHp,
    maxHp: Math.floor(maxHp),
    attack: Math.floor(attack),
    defense: Math.floor(defense),
    energy: maxEnergy,
    maxEnergy: Math.floor(maxEnergy),
    
    // 命中与闪避
    accuracy: Math.max(0.90, Math.min(1.40, accuracy)), // 90% ~ 140%
    dodgeChance: Math.max(0, Math.min(0.50, dodgeChance)), // 0% ~ 50%
    
    // 暴击系统
    critChance: Math.max(0, Math.min(0.35, critChance)), // 0% ~ 35%
    critMultiplier: Math.max(1.5, Math.min(2.5, critMultiplier)), // 1.5x ~ 2.5x
    
    // 防御系统
    blockChance: Math.max(0, Math.min(0.30, blockChance)), // 0% ~ 30%
    tenacity: Math.floor(tenacity),
    
    // 其他战斗属性
    armorPenetration: Math.floor(armorPenetration),
    speed: Math.max(1.0, speed),
    
    // 武侠特色
    qinggongLevel,
    neigongLevel,
    energyRegen,
    
    // 辅助
    luck
  };
};

/**
 * 计算等级提升时的属性增长
 * 
 * 注意：派生属性的增长需要考虑四维的影响
 * 例如：HP增长 = 直接成长 + 体质增长×10
 * 
 * @param fromLevel 起始等级
 * @param toLevel 目标等级
 * @param config 成长配置
 * @returns 各项属性的增长值
 */
export const calculateLevelUpGains = (
  fromLevel: number,
  toLevel: number,
  config: PlayerGrowthConfig
) => {
  const levelDiff = toLevel - fromLevel;
  
  // 基础四维增长
  const strengthIncrease = levelDiff * config.strengthPerLevel;
  const agilityIncrease = levelDiff * config.agilityPerLevel;
  const vitalityIncrease = levelDiff * config.vitalityPerLevel;
  const spiritIncrease = levelDiff * config.spiritPerLevel;
  
  // 派生属性增长（包含四维影响）
  // HP增长 = 直接成长 + 体质增长×10
  const hpIncrease = levelDiff * config.hpPerLevel + vitalityIncrease * 10;
  
  // 攻击增长 = 直接成长 + 力量增长×2
  const attackIncrease = levelDiff * config.attackPerLevel + strengthIncrease * 2;
  
  // 防御增长 = 直接成长 + 体质增长×1.5
  const defenseIncrease = levelDiff * config.defensePerLevel + vitalityIncrease * 1.5;
  
  // 内力增长 = 直接成长 + 悟性增长×5
  const energyIncrease = levelDiff * config.energyPerLevel + spiritIncrease * 5;
  
  // 命中增长 = 直接成长 + 敏捷增长×0.005
  const accuracyIncrease = levelDiff * config.accuracyPerLevel + agilityIncrease * 0.005;
  
  // 闪避增长 = 直接成长 + 敏捷增长×0.002
  const dodgeChanceIncrease = levelDiff * config.dodgeChancePerLevel + agilityIncrease * 0.002;
  
  // 暴击增长 = 直接成长 + (敏捷+力量)增长×0.001
  const critChanceIncrease = levelDiff * config.critChancePerLevel + (agilityIncrease + strengthIncrease) * 0.001;
  
  // 速度增长 = 直接成长 + 敏捷增长×0.02
  const speedIncrease = levelDiff * config.speedPerLevel + agilityIncrease * 0.02;
  
  // 幸运增长
  const luckIncrease = levelDiff * config.luckPerLevel;
  
  return {
    // 主要属性增长（向下取整用于显示）
    hpIncrease: Math.floor(hpIncrease),
    attackIncrease: Math.floor(attackIncrease),
    defenseIncrease: Math.floor(defenseIncrease),
    
    // 基础四维增长
    strengthIncrease,
    agilityIncrease,
    vitalityIncrease,
    spiritIncrease,
    
    // 其他派生属性增长
    energyIncrease: Math.floor(energyIncrease),
    accuracyIncrease,
    dodgeChanceIncrease,
    critChanceIncrease,
    speedIncrease,
    luckIncrease
  };
};

// ===== 战斗伤害计算 =====

/**
 * 计算攻击伤害
 * 基础伤害 = max(1, 攻击力 - 防御力)
 * 随机浮动 ±20% 增加战斗的不确定性
 */
export const calculateDamage = (
  attackPower: number,
  defense: number,
  variance: number = 0.2
): number => {
  // 基础伤害，最少1点
  const baseDamage = Math.max(1, attackPower - defense);
  
  // 随机浮动因子 (0.8 ~ 1.2)
  const randomFactor = 1 + (Math.random() - 0.5) * 2 * variance;
  
  // 最终伤害，向下取整
  return Math.floor(baseDamage * randomFactor);
};

/**
 * 计算暴击伤害
 * 暴击率基于攻击力，暴击伤害为1.5倍
 */
export const calculateCriticalHit = (
  attackPower: number,
  defense: number,
  critChance: number = 0.1 // 默认10%暴击率
): { damage: number; isCritical: boolean } => {
  const isCritical = Math.random() < critChance;
  let damage = calculateDamage(attackPower, defense);
  
  if (isCritical) {
    damage = Math.floor(damage * 1.5);
  }
  
  return { damage, isCritical };
};

// ===== 动作相关计算 =====

/**
 * 计算打坐的收益
 * 恢复生命值，获得少量经验
 */
export const calculateMeditationRewards = (level: number) => {
  const hpRestore = Math.floor(10 + level * 2);
  const expGain = Math.floor(5 + level * 0.5);
  
  return {
    hpRestore,
    expGain,
    duration: 3000 // 3秒
  };
};

/**
 * 计算练功的收益
 * 获得经验值，小幅提升攻击力
 */
export const calculatePracticeRewards = (level: number) => {
  const expGain = Math.floor(15 + level * 2);
  const attackIncrease = Math.random() < 0.1 ? 1 : 0; // 10%概率永久+1攻击
  
  return {
    expGain,
    attackIncrease,
    duration: 5000 // 5秒
  };
};

/**
 * 计算休息的收益
 * 快速恢复生命值
 */
export const calculateRestRewards = (level: number, maxHp: number) => {
  const hpRestore = Math.min(maxHp, Math.floor(maxHp * 0.3 + level * 3));
  
  return {
    hpRestore,
    duration: 2000 // 2秒
  };
};

// 离线收益功能已移除

// ===== 随机数相关工具 =====

/**
 * 生成指定范围内的随机整数 [min, max]
 */
export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 基于概率返回boolean结果
 */
export const randomChance = (probability: number): boolean => {
  return Math.random() < probability;
};

/**
 * 从数组中随机选择一个元素
 */
export const randomChoice = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};
