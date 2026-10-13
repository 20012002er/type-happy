/**
 * 本地配置服务实现
 * 从本地JSON文件读取游戏配置
 */

import type { IConfigService, ConfigLoadOptions, ConfigServiceConfig } from './types';
import { ConfigType } from './types';
// 已全面迁移为 JSON5，移除旧 JSON 静态导入
import JSON5 from 'json5';
// 静态导入所有 JSON5 文本，构建期打包，无需运行时 fetch 或插件
import LEVEL_EXP_TABLE_RAW from '@/assets/configs/level-exp-table.json5?raw';
import IDLE_LOCATIONS_RAW from '@/assets/configs/idle-locations.json5?raw';
import MONSTER_GROUPS_RAW from '@/assets/configs/monster-groups.json5?raw';
import ENEMIES_RAW from '@/assets/configs/enemies.json5?raw';
import EQUIPMENT_BLUEPRINTS_RAW from '@/assets/configs/equipment-blueprints.json5?raw';
import AFFIXES_RAW from '@/assets/configs/affixes.json5?raw';
import MEDITATION_EVENTS_RAW from '@/assets/configs/meditation-events.json5?raw';
import STATUS_EFFECTS_RAW from '@/assets/configs/status-effects.json5?raw';
import SYNTHESIS_RECIPES_RAW from '@/assets/configs/synthesis-recipes.json5?raw';
import MOVES_RAW from '@/assets/configs/moves.json5?raw';
import MARTIAL_ARTS_RAW from '@/assets/configs/martial-arts.json5?raw';
import ECONOMY_RAW from '@/assets/configs/economy.json5?raw';
import STAMINA_CONFIG_RAW from '@/assets/configs/stamina-config.json5?raw';
import REFORGE_RULES_RAW from '@/assets/configs/reforge-rules.json5?raw';
import CONSUMABLES_RAW from '@/assets/configs/consumables.json5?raw';
import ACHIEVEMENTS_RAW from '@/assets/configs/achievements.json5?raw';
import CONVOY_ROUTES_RAW from '@/assets/configs/convoy-routes.json5?raw';
import DUNGEONS_RAW from '@/assets/configs/dungeons.json5?raw';
import NARRATIVE_TEMPLATES_RAW from '@/assets/configs/narrative-templates.json5?raw';
import SECLUSION_RAW from '@/assets/configs/seclusion-config.json5?raw';

export class LocalConfigService implements IConfigService {
  private cache = new Map<string, { data: any; timestamp: number; version: string }>();
  private config: ConfigServiceConfig;
  // 通过顶部静态导入 + JSON5.parse，在构建后同样可用，且避免运行时网络请求

  constructor(config: ConfigServiceConfig) {
    this.config = {
      cache: {
        enabled: true,
        maxAge: 30 * 60 * 1000, // 30分钟
        maxSize: 50,
      },
      ...config,
    };
  }

  /**
   * 加载配置
   */
  async loadConfig<T>(configType: ConfigType, options?: ConfigLoadOptions): Promise<T> {
    const useCache = options?.useCache ?? this.config.cache?.enabled ?? true;

    // 检查缓存
    if (useCache) {
      const cached = this.getCachedConfig<T>(configType);
      if (cached) {
        return cached;
      }
    }

    try {
      // 加载本地配置文件
      const configData = await this.loadLocalConfig(configType);

      // 缓存配置
      if (useCache && this.config.cache?.enabled) {
        this.setCacheConfig(configType, configData);
      }

      return configData as T;
    } catch (error) {
      console.error(`加载配置失败: ${configType}`, error);
      throw new Error(`Failed to load config: ${configType}`);
    }
  }

  /**
   * 获取缓存的配置
   */
  getCachedConfig<T>(configType: ConfigType): T | null {
    const cached = this.cache.get(configType);
    if (!cached) return null;

    // 检查缓存是否过期
    const now = Date.now();
    const maxAge = this.config.cache?.maxAge ?? 30 * 60 * 1000;

    if (now - cached.timestamp > maxAge) {
      this.cache.delete(configType);
      return null;
    }

    return cached.data as T;
  }

  /**
   * 设置缓存配置
   */
  private setCacheConfig(configType: ConfigType, data: any): void {
    if (!this.config.cache?.enabled) return;

    // 检查缓存大小限制
    const maxSize = this.config.cache?.maxSize ?? 50;
    if (this.cache.size >= maxSize) {
      // 删除最旧的缓存项
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    // 提取版本信息
    const version = data.version || '1.0.0';

    this.cache.set(configType, {
      data,
      timestamp: Date.now(),
      version,
    });
  }

  /**
   * 清除配置缓存
   */
  clearCache(configType?: ConfigType): void {
    if (configType) {
      this.cache.delete(configType);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 检查配置是否存在
   */
  async hasConfig(configType: ConfigType): Promise<boolean> {
    try {
      await this.loadLocalConfig(configType);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取配置版本信息
   */
  async getConfigVersion(configType: ConfigType): Promise<string | null> {
    try {
      const config = await this.loadConfig<any>(configType);
      return config.version || null;
    } catch {
      return null;
    }
  }

  /**
   * 加载本地配置文件
   */
  private async loadLocalConfig(configType: ConfigType): Promise<any> {
    switch (configType) {
      case ConfigType.LEVEL_EXP_TABLE:
        return JSON5.parse(LEVEL_EXP_TABLE_RAW);
      case ConfigType.IDLE_LOCATIONS:
        return JSON5.parse(IDLE_LOCATIONS_RAW);
      case ConfigType.MONSTER_GROUPS:
        return JSON5.parse(MONSTER_GROUPS_RAW);
      case ConfigType.ENEMIES:
        return JSON5.parse(ENEMIES_RAW);
      case ConfigType.EQUIPMENT_BLUEPRINTS:
        return JSON5.parse(EQUIPMENT_BLUEPRINTS_RAW);
      case ConfigType.AFFIXES:
        return JSON5.parse(AFFIXES_RAW);
      case ConfigType.MEDITATION_EVENTS:
        return JSON5.parse(MEDITATION_EVENTS_RAW);
      case ConfigType.STATUS_EFFECTS:
        return JSON5.parse(STATUS_EFFECTS_RAW);
      case ConfigType.SYNTHESIS_RECIPES:
        return JSON5.parse(SYNTHESIS_RECIPES_RAW);
      case ConfigType.MOVES:
        return JSON5.parse(MOVES_RAW);
      case ConfigType.MARTIAL_ARTS:
        return JSON5.parse(MARTIAL_ARTS_RAW);
      case ConfigType.ECONOMY:
        return JSON5.parse(ECONOMY_RAW);
      case ConfigType.STAMINA_CONFIG:
        return JSON5.parse(STAMINA_CONFIG_RAW);
      case ConfigType.REFORGE_RULES:
        return JSON5.parse(REFORGE_RULES_RAW);
      case ConfigType.CONSUMABLES:
        return JSON5.parse(CONSUMABLES_RAW);
      case ConfigType.ACHIEVEMENTS:
        return JSON5.parse(ACHIEVEMENTS_RAW);
      case ConfigType.CONVOY_ROUTES:
        return JSON5.parse(CONVOY_ROUTES_RAW);
      case ConfigType.DUNGEONS:
        return JSON5.parse(DUNGEONS_RAW);
      case ConfigType.NARRATIVE_TEMPLATES:
        return JSON5.parse(NARRATIVE_TEMPLATES_RAW);
      case ConfigType.SECLUSION:
        return JSON5.parse(SECLUSION_RAW);
      default:
        throw new Error(`Unknown config type: ${String(configType)}`);
    }
  }

  private getConfigFileBase(configType: ConfigType): string {
    switch (configType) {
      case ConfigType.LEVEL_EXP_TABLE:
        return 'level-exp-table';
      case ConfigType.IDLE_LOCATIONS:
        return 'idle-locations';
      case ConfigType.MONSTER_GROUPS:
        return 'monster-groups';
      case ConfigType.ENEMIES:
        return 'enemies';
      case ConfigType.EQUIPMENT_BLUEPRINTS:
        return 'equipment-blueprints';
      case ConfigType.AFFIXES:
        return 'affixes';
      case ConfigType.MEDITATION_EVENTS:
        return 'meditation-events';
      case ConfigType.STATUS_EFFECTS:
        return 'status-effects';
      case ConfigType.SYNTHESIS_RECIPES:
        return 'synthesis-recipes';
      case ConfigType.MOVES:
        return 'moves';
      case ConfigType.MARTIAL_ARTS:
        return 'martial-arts';
      case ConfigType.SECLUSION:
        return 'seclusion-config';
      default:
        return String(configType);
    }
  }

  /**
   * 获取配置文件路径
   */
  private getConfigPath(configType: ConfigType): string {
    const basePath = this.config.localConfigPath || '/src/assets/configs';
    const configFileName = `${this.getConfigFileBase(configType)}.json5`;
    return `${basePath}/${configFileName}`;
  }
}

/**
 * 默认配置服务配置
 */
export const DEFAULT_LOCAL_CONFIG: ConfigServiceConfig = {
  source: 'local',
  localConfigPath: '/src/assets/configs',
  cache: {
    enabled: true,
    maxAge: 30 * 60 * 1000, // 30分钟
    maxSize: 50,
  },
  errorHandling: {
    retryAttempts: 3,
    retryDelay: 1000,
    fallbackToLocal: true,
  },
};
