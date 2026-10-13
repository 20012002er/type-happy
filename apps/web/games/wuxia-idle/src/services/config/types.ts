/**
 * 配置服务类型定义
 */

// 等级经验配置类型（简化版：每级仅配置该级的经验条容量）
export interface LevelExpConfig {
  level: number;
  exp: number; // 升到下一级所需的经验（该级的经验条长度）
  description?: string;
}

// 等级经验表配置（简化版）
export interface LevelExpTableConfig {
  version: string;
  lastUpdated: string;
  levels: LevelExpConfig[];
}

// 配置类型枚举
export enum ConfigType {
  LEVEL_EXP_TABLE = 'level-exp-table',
  IDLE_LOCATIONS = 'idle-locations',
  MONSTER_GROUPS = 'monster-groups',
  ENEMIES = 'enemies',
  EQUIPMENT_BLUEPRINTS = 'equipment-blueprints',
  AFFIXES = 'affixes',
  COMBAT_CONFIG = 'combat-config',
  MEDITATION_EVENTS = 'meditation-events',
  STATUS_EFFECTS = 'status-effects',
  SYNTHESIS_RECIPES = 'synthesis-recipes',
  // 新增：武学与招数配置
  MOVES = 'moves',
  MARTIAL_ARTS = 'martial-arts',
  // 新增：经济与体力配置
  ECONOMY = 'economy',
  STAMINA_CONFIG = 'stamina-config',
  REFORGE_RULES = 'reforge-rules',
  CONSUMABLES = 'consumables',
  ACHIEVEMENTS = 'achievements',
  // 新增：炼丹配置
  ALCHEMY_RECIPES = 'alchemy-recipes',
  CONVOY_ROUTES = 'convoy-routes',
  // 新增：地牢与叙事系统
  DUNGEONS = 'dungeons',
  NARRATIVE_TEMPLATES = 'narrative-templates',
  // 新增：闭关修炼系统
  SECLUSION = 'seclusion-config'
}

// 配置加载选项
export interface ConfigLoadOptions {
  useCache?: boolean;
  timeout?: number;
  fallbackToLocal?: boolean;
}

// 配置服务接口
export interface IConfigService {
  /**
   * 加载配置
   * @param configType 配置类型
   * @param options 加载选项
   */
  loadConfig<T>(configType: ConfigType, options?: ConfigLoadOptions): Promise<T>;
  
  /**
   * 获取缓存的配置
   * @param configType 配置类型
   */
  getCachedConfig<T>(configType: ConfigType): T | null;
  
  /**
   * 清除配置缓存
   * @param configType 配置类型，不传则清除所有
   */
  clearCache(configType?: ConfigType): void;
  
  /**
   * 检查配置是否存在
   * @param configType 配置类型
   */
  hasConfig(configType: ConfigType): Promise<boolean>;
  
  /**
   * 获取配置版本信息
   * @param configType 配置类型
   */
  getConfigVersion(configType: ConfigType): Promise<string | null>;
}

// 配置服务配置
export interface ConfigServiceConfig {
  // 配置源类型
  source: 'local' | 'remote' | 'hybrid';
  
  // 本地配置路径
  localConfigPath?: string;
  
  // 远程API配置
  remoteConfig?: {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
  };
  
  // 缓存配置
  cache?: {
    enabled: boolean;
    maxAge: number; // 缓存有效期（毫秒）
    maxSize: number; // 最大缓存项数
  };
  
  // 错误处理配置
  errorHandling?: {
    retryAttempts: number;
    retryDelay: number;
    fallbackToLocal: boolean;
  };
}
