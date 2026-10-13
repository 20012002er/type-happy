/**
 * 地牢配置服务
 * 负责加载和管理地牢配置
 */

import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';
import type { DungeonConfig, DungeonsFile } from '@/types/dungeon';

export class DungeonConfigService {
  private static cache: DungeonsFile | null = null;
  private static locationDungeonsCache: Map<string, DungeonConfig[]> | null = null;

  /**
   * 加载所有地牢配置
   */
  static async loadAll(): Promise<DungeonsFile> {
    if (DungeonConfigService.cache) {
      return DungeonConfigService.cache;
    }
    
    try {
      const data = await configService.loadConfig<DungeonsFile>(ConfigType.DUNGEONS);
      DungeonConfigService.cache = data;
      return data;
    } catch (error) {
      console.error('[DungeonConfigService] 配置加载失败:', error);
      // 返回空配置，不影响游戏运行
      return {
        version: '1.0.0',
        lastUpdated: '',
        dungeons: [],
        locationDungeons: {}
      };
    }
  }

  /**
   * 获取单个地牢配置
   */
  static async getDungeon(id: string): Promise<DungeonConfig | null> {
    const data = await DungeonConfigService.loadAll();
    return data.dungeons.find(d => d.id === id) || null;
  }

  /**
   * 获取所有地牢配置
   */
  static async getDungeons(): Promise<DungeonConfig[]> {
    const data = await DungeonConfigService.loadAll();
    return data.dungeons;
  }

  /**
   * 根据地点ID获取可进入的地牢列表
   */
  static async getDungeonsByLocation(locationId: string): Promise<DungeonConfig[]> {
    const data = await DungeonConfigService.loadAll();
    const dungeonIds = data.locationDungeons[locationId] || [];
    
    return dungeonIds
      .map(id => data.dungeons.find(d => d.id === id))
      .filter((d): d is DungeonConfig => d !== undefined);
  }

  /**
   * 检查玩家是否满足地牢解锁条件
   */
  static checkUnlockCondition(
    dungeon: DungeonConfig,
    playerLevel: number,
    _completedQuests?: string[],
    _inventory?: string[]
  ): { unlocked: boolean; reason?: string } {
    const condition = dungeon.unlockCondition;
    
    if (!condition) {
      return { unlocked: true };
    }

    if (condition.minLevel && playerLevel < condition.minLevel) {
      return {
        unlocked: false,
        reason: `需要等级 ${condition.minLevel}（当前 ${playerLevel}）`
      };
    }

    // TODO: 检查任务和道具条件
    // if (condition.requiredQuestId && !completedQuests?.includes(condition.requiredQuestId)) {
    //   return { unlocked: false, reason: '需要完成前置任务' };
    // }

    return { unlocked: true };
  }

  /**
   * 验证地牢配置完整性
   */
  static validateConfig(config: DungeonConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.id) errors.push('缺少 id');
    if (!config.name) errors.push('缺少 name');
    if (typeof config.recommendLevel !== 'number') errors.push('缺少 recommendLevel');
    if (!config.entryCost) errors.push('缺少 entryCost');
    if (!config.waves || config.waves.length === 0) errors.push('缺少 waves');
    if (!config.reward) errors.push('缺少 reward');

    // 验证波次配置
    config.waves?.forEach((wave, index) => {
      if (!wave.id) errors.push(`波次 ${index + 1} 缺少 id`);
      if (!wave.spawns || wave.spawns.length === 0) {
        errors.push(`波次 ${index + 1} 缺少 spawns`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    DungeonConfigService.cache = null;
    DungeonConfigService.locationDungeonsCache = null;
  }
}

// 导出便捷方法
export const {
  loadAll: loadDungeonsConfig,
  getDungeon,
  getDungeons,
  getDungeonsByLocation,
  checkUnlockCondition,
  validateConfig: validateDungeonConfig
} = DungeonConfigService;
