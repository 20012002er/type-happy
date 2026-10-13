/**
 * 等级经验配置服务
 * 专门处理等级经验相关的配置读取和计算
 */

import type { LevelExpConfig, LevelExpTableConfig } from './types';
import { ConfigType } from './types';
import { configService } from './ConfigServiceFactory';

export class LevelExpConfigService {
  private static cachedConfig: LevelExpTableConfig | null = null;
  
  /**
   * 加载等级经验表配置
   */
  static async loadLevelExpConfig(): Promise<LevelExpTableConfig> {
    if (LevelExpConfigService.cachedConfig) {
      return LevelExpConfigService.cachedConfig;
    }
    
    try {
      const config = await configService.loadConfig<LevelExpTableConfig>(
        ConfigType.LEVEL_EXP_TABLE
      );
      
      // 基础校验与格式化：按 level 升序，并确保字段存在
      const sorted = [...config.levels].sort((a, b) => a.level - b.level);
      const normalized: LevelExpTableConfig = {
        version: config.version,
        lastUpdated: config.lastUpdated,
        levels: sorted.map(l => ({ level: l.level, exp: Math.max(0, l.exp || 0), description: l.description }))
      };
      
      LevelExpConfigService.cachedConfig = normalized;
      return normalized;
    } catch (error) {
      console.error('加载等级经验配置失败:', error);
      // 返回默认配置
      return LevelExpConfigService.getDefaultConfig();
    }
  }
  
  /**
   * 获取指定等级的配置
   */
  static async getLevelConfig(level: number): Promise<LevelExpConfig | null> {
    const config = await LevelExpConfigService.loadLevelExpConfig();
    return config.levels.find(levelConfig => levelConfig.level === level) || null;
  }
  
  /**
   * 获取升级到下一等级所需的经验值
   */
  static async getRequiredExpForNextLevel(level: number): Promise<number> {
    const levelConfig = await LevelExpConfigService.getLevelConfig(level);
    if (!levelConfig) return 0;
    // 若为最高等级，返回0
    const maxLevel = await LevelExpConfigService.getMaxLevel();
    if (level >= maxLevel) return 0;
    return levelConfig.exp;
  }
  
  /**
   * 根据总经验计算当前等级
   */
  static async calculateLevelFromTotalExp(totalExp: number): Promise<number> {
    const config = await LevelExpConfigService.loadLevelExpConfig();
    if (config.levels.length === 0) return 1;
    
    let level = 1;
    let remaining = Math.max(0, totalExp);
    
    // 逐级扣除当前等级所需的经验条长度（最高只能到最后一个等级）
    for (let i = 1; i < config.levels.length; i++) {
      const req = config.levels[i - 1]?.exp ?? 0; // level i 的经验条长度位于索引 i-1
      if (remaining >= req) {
        remaining -= req;
        level += 1;
      } else {
        break;
      }
    }
    
    return level;
  }
  
  /**
   * 根据等级和总经验计算当前等级的经验进度
   */
  static async getCurrentLevelExp(level: number, totalExp: number): Promise<number> {
    const config = await LevelExpConfigService.loadLevelExpConfig();
    if (config.levels.length === 0) return 0;
    
    // 累计前面所有等级的经验条作为阈值
    const threshold = config.levels
      .filter(l => l.level < level)
      .reduce((sum, l) => sum + (l.exp || 0), 0);
    
    const current = Math.max(0, totalExp - threshold);
    const required = await LevelExpConfigService.getRequiredExpForNextLevel(level);
    if (required === 0) return 0; // 满级视为0/0 或 100%
    return Math.min(current, required);
  }
  
  /**
   * 检查是否可以升级
   */
  static async checkCanLevelUp(totalExp: number, currentLevel: number): Promise<{
    canLevelUp: boolean;
    newLevel: number;
  }> {
    const newLevel = await LevelExpConfigService.calculateLevelFromTotalExp(totalExp);
    return {
      canLevelUp: newLevel > currentLevel,
      newLevel
    };
  }
  
  /**
   * 计算经验进度百分比
   */
  static async calculateExpProgressPercent(level: number, totalExp: number): Promise<number> {
    const requiredExp = await LevelExpConfigService.getRequiredExpForNextLevel(level);
    if (requiredExp === 0) return 100; // 满级
    const currentExp = await LevelExpConfigService.getCurrentLevelExp(level, totalExp);
    return Math.floor((currentExp / requiredExp) * 100);
  }
  
  /**
   * 获取最大等级
   */
  static async getMaxLevel(): Promise<number> {
    const config = await LevelExpConfigService.loadLevelExpConfig();
    if (config.levels.length === 0) return 1;
    return Math.max(...config.levels.map(l => l.level));
  }
  
  /**
   * 获取等级经验表的所有等级
   */
  static async getAllLevels(): Promise<LevelExpConfig[]> {
    const config = await LevelExpConfigService.loadLevelExpConfig();
    return config.levels;
  }
  
  /**
   * 清除缓存
   */
  static clearCache(): void {
    LevelExpConfigService.cachedConfig = null;
    configService.clearCache(ConfigType.LEVEL_EXP_TABLE);
  }
  
  /**
   * 获取默认配置（作为fallback）
   */
  private static getDefaultConfig(): LevelExpTableConfig {
    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      levels: [
        { level: 1, exp: 100 },
        { level: 2, exp: 200 },
        { level: 3, exp: 300 },
        { level: 4, exp: 400 },
        { level: 5, exp: 500 },
        { level: 6, exp: 600 },
        { level: 7, exp: 700 },
        { level: 8, exp: 800 },
        { level: 9, exp: 900 },
        { level: 10, exp: 1000 }
      ]
    };
  }
}

// 便捷的导出函数
export const {
  loadLevelExpConfig,
  getLevelConfig,
  getRequiredExpForNextLevel,
  calculateLevelFromTotalExp,
  getCurrentLevelExp,
  checkCanLevelUp,
  calculateExpProgressPercent,
  getMaxLevel,
  getAllLevels,
  clearCache: clearLevelExpCache
} = LevelExpConfigService;
