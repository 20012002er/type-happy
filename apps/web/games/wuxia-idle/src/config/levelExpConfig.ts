/**
 * 等级经验配置表（简化版）
 * 规则：每级配置一个经验条容量 exp；每次升级经验条清零；底层维护 totalExp
 */

// 重新导出配置服务的类型和函数，保持原有接口兼容
export type { LevelExpConfig } from '@/services/config';

import {
  LevelExpConfigService,
  getRequiredExpForNextLevel as _getRequiredExpForNextLevel,
  calculateLevelFromTotalExp as _calculateLevelFromTotalExp,
  getCurrentLevelExp as _getCurrentLevelExp,
  checkCanLevelUp as _checkCanLevelUp,
  calculateExpProgressPercent as _calculateExpProgressPercent,
  getMaxLevel as _getMaxLevel,
  getAllLevels as _getAllLevels
} from '@/services/config';

/**
 * 获取等级经验配置表
 * @deprecated 使用异步的 getAllLevels() 替代
 */
export const LEVEL_EXP_TABLE: any[] = []; // 保持兼容性，但建议使用异步函数

/**
 * 异步获取等级经验表
 */
export const getLevelExpTable = _getAllLevels;

/**
 * 根据等级获取经验配置
 */
export async function getLevelExpConfig(level: number) {
  const levelConfig = await LevelExpConfigService.getLevelConfig(level);
  return levelConfig;
}

/**
 * 获取升级到下一等级所需的经验值
 */
export function getRequiredExpForNextLevel(level: number): number {
  // 同步：依赖初始化后缓存
  if (LevelExpConfigService['cachedConfig']) {
    const cfg = LevelExpConfigService['cachedConfig'];
    const maxLevel = Math.max(...cfg.levels.map(l => l.level));
    if (level >= maxLevel) return 0;
    const levelCfg = cfg.levels.find(l => l.level === level);
    return levelCfg?.exp ?? 0;
  }
  console.warn('等级经验配置未加载（同步），返回0');
  return 0;
}

/**
 * 异步版本：获取升级到下一等级所需的经验值
 */
export const getRequiredExpForNextLevelAsync = _getRequiredExpForNextLevel;

/**
 * 根据总经验计算当前等级
 */
export function calculateLevelFromTotalExp(totalExp: number): number {
  if (LevelExpConfigService['cachedConfig']) {
    const levels = [...LevelExpConfigService['cachedConfig'].levels].sort((a, b) => a.level - b.level);
    let level = 1;
    let remaining = Math.max(0, totalExp);
    for (let i = 0; i < levels.length - 1; i++) {
      const req = levels[i].exp || 0; // level i+1 的经验条容量
      if (remaining >= req) {
        remaining -= req;
        level += 1;
      } else {
        break;
      }
    }
    return level;
  }
  console.warn('等级经验配置未加载（同步），返回1');
  return 1;
}

/**
 * 异步版本：根据总经验计算当前等级
 */
export const calculateLevelFromTotalExpAsync = _calculateLevelFromTotalExp;

/**
 * 根据等级和总经验计算当前等级的经验进度
 */
export function getCurrentLevelExp(level: number, totalExp: number): number {
  if (LevelExpConfigService['cachedConfig']) {
    const levels = [...LevelExpConfigService['cachedConfig'].levels].sort((a, b) => a.level - b.level);
    const required = getRequiredExpForNextLevel(level);
    if (required === 0) return 0; // 满级
    let threshold = 0;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].level >= level) break;
      threshold += levels[i].exp || 0;
    }
    const cur = Math.max(0, totalExp - threshold);
    return Math.min(cur, required);
  }
  console.warn('等级经验配置未加载（同步），返回0');
  return 0;
}

/**
 * 异步版本：根据等级和总经验计算当前等级的经验进度
 */
export const getCurrentLevelExpAsync = _getCurrentLevelExp;

/**
 * 检查是否可以升级
 */
export function checkCanLevelUp(totalExp: number, currentLevel: number): {
  canLevelUp: boolean;
  newLevel: number;
} {
  const newLevel = calculateLevelFromTotalExp(totalExp);
  return {
    canLevelUp: newLevel > currentLevel,
    newLevel
  };
}

/**
 * 异步版本：检查是否可以升级
 */
export const checkCanLevelUpAsync = _checkCanLevelUp;

/**
 * 计算经验进度百分比
 */
export function calculateExpProgressPercent(level: number, totalExp: number): number {
  const requiredExp = getRequiredExpForNextLevel(level);
  if (requiredExp === 0) return 100; // 满级
  const currentExp = getCurrentLevelExp(level, totalExp);
  return Math.floor((currentExp / requiredExp) * 100);
}

/**
 * 异步版本：计算经验进度百分比
 */
export const calculateExpProgressPercentAsync = _calculateExpProgressPercent;

/**
 * 获取最大等级
 */
export const getMaxLevel = _getMaxLevel;

/**
 * 初始化配置服务
 * 应在应用启动时调用，预加载配置
 */
export async function initializeLevelExpConfig(): Promise<void> {
  try {
    console.log('初始化等级经验配置...');
    const config = await LevelExpConfigService.loadLevelExpConfig();
    const maxLevel = Math.max(...config.levels.map(l => l.level));
    console.log(`已加载等级经验配置: v${config.version}, 最大等级: ${maxLevel}`);
    
    // 验证配置完整性
    if (config.levels.length === 0) {
      throw new Error('等级经验配置为空');
    }
    
    // 检查等级连续性
    for (let i = 1; i <= maxLevel; i++) {
      const levelConfig = config.levels.find(level => level.level === i);
      if (!levelConfig) {
        console.warn(`缺少等级 ${i} 的配置`);
      }
    }
    
    console.log('等级经验配置初始化完成');
  } catch (error) {
    console.error('初始化等级经验配置失败:', error);
    throw error;
  }
}

/**
 * 清除配置缓存
 */
export function clearLevelExpConfigCache(): void {
  LevelExpConfigService.clearCache();
}

// 保持向后兼容的导出
export {
  calculateLevelFromTotalExp as calculateLevelFromExp,
  getRequiredExpForNextLevel as calculateNextLevelExp,
  getCurrentLevelExp as calculateCurrentLevelExp
};