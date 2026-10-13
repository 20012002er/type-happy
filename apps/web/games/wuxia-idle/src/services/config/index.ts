/**
 * 配置服务统一导出
 */

// 类型定义
export type {
  IConfigService,
  ConfigLoadOptions,
  ConfigServiceConfig,
  LevelExpConfig,
  LevelExpTableConfig,
} from './types';

export { ConfigType } from './types';

// 配置服务实现
export { LocalConfigService, DEFAULT_LOCAL_CONFIG } from './LocalConfigService';
export { ConfigServiceFactory, configService } from './ConfigServiceFactory';

// 等级经验配置服务
export {
  LevelExpConfigService,
  loadLevelExpConfig,
  getLevelConfig,
  getRequiredExpForNextLevel,
  calculateLevelFromTotalExp,
  getCurrentLevelExp,
  checkCanLevelUp,
  calculateExpProgressPercent,
  getMaxLevel,
  getAllLevels,
  clearLevelExpCache,
} from './LevelExpConfigService';

// 新增配置服务：冥想事件与状态效果
export * from './MeditationEventConfigService';
export * from './StatusEffectConfigService';
// 预留：合成配方配置服务
export * from './SynthesisRecipeConfigService';

// 地牢与叙事系统配置服务
export * from './DungeonConfigService';
export * from './NarrativeTemplateService';

// 门派配置服务
export * from './SectConfigService';
