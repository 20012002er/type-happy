/**
 * 闭关修炼配置服务 v2.0
 * 支持金庸武侠风格「点香修炼」系统
 * @module services/config/SeclusionConfigService
 */

import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';
import type {
  SeclusionConfigFile,
  SeclusionTypeDefinition,
  SeclusionEventDefinition,
  SeclusionParameters,
  SeclusionType,
  ResourceQuality,
  DurationOption,
  CollectibleDefinition,
} from '@/types/seclusion';

// 默认参数 v2.0
const DEFAULT_PARAMETERS: SeclusionParameters = {
  tickIntervalMs: 1000,
  baseExpPerTick: 1,
  baseGoldPerTick: 0.1,
  eventTriggerChance: 0.02,
  collectibleDropChance: 0.15,
  reputationGainPerSession: 1,
  reputationGainBonus: 0.5,
  offlineMaxDurationMs: 14400000,
  offlineEfficiencyMultiplier: 0.5,
  offlineRewardCap: {
    exp: 10000,
    gold: 1000,
  },
};

const DEFAULT_QUALITY_MULTIPLIERS: Record<ResourceQuality, number> = {
  common: 1.0,
  fine: 1.5,
  rare: 2.0,
  epic: 3.0,
  legendary: 5.0,
};

// 默认时长选项 v2.0
const DEFAULT_DURATION_OPTIONS: Record<string, number> = {
  一炷香: 25,
  两炷香: 50,
  一场闭关: 90,
};

/**
 * 闭关配置服务 v2.0
 */
export class SeclusionConfigService {
  private static configCache: SeclusionConfigFile | null = null;

  /**
   * 加载完整配置
   */
  static async loadConfig(): Promise<SeclusionConfigFile> {
    if (this.configCache) {
      return this.configCache;
    }

    try {
      const config = await configService.loadConfig<SeclusionConfigFile>(ConfigType.SECLUSION);
      const validated = this.validateConfig(config);
      this.configCache = validated;
      return validated;
    } catch (error) {
      console.error('[SeclusionConfigService] 配置加载失败，使用默认配置:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取所有闭关类型
   */
  static async getSeclusionTypes(): Promise<SeclusionTypeDefinition[]> {
    const config = await this.loadConfig();
    return config.types;
  }

  /**
   * 获取指定闭关类型
   */
  static async getSeclusionType(typeId: SeclusionType): Promise<SeclusionTypeDefinition | null> {
    const types = await this.getSeclusionTypes();
    return types.find(t => t.id === typeId) || null;
  }

  /**
   * 获取事件定义
   */
  static async getEventDefinitions(): Promise<SeclusionEventDefinition[]> {
    const config = await this.loadConfig();
    return config.events;
  }

  /**
   * 获取数值参数
   */
  static async getParameters(): Promise<SeclusionParameters> {
    const config = await this.loadConfig();
    return config.parameters;
  }

  /**
   * 获取时长选项 v2.0
   */
  static async getDurationOptions(): Promise<Record<string, number>> {
    const config = await this.loadConfig();
    return config.durationOptions || DEFAULT_DURATION_OPTIONS;
  }

  /**
   * 获取时长选项数组（用于选择器）
   */
  static async getDurationOptionsArray(): Promise<{ key: string; minutes: DurationOption }[]> {
    const options = await this.getDurationOptions();
    return Object.entries(options).map(([key, value]) => ({
      key,
      minutes: value as DurationOption,
    }));
  }

  /**
   * 获取时长分钟数
   */
  static async getDurationMinutes(key: string): Promise<number> {
    const options = await this.getDurationOptions();
    return options[key] || 25;
  }

  /**
   * 获取品质效率映射
   */
  static async getQualityMultipliers(): Promise<Record<ResourceQuality, number>> {
    const config = await this.loadConfig();
    return config.qualityMultipliers;
  }

  /**
   * 获取指定品质的效率倍率
   */
  static async getQualityMultiplier(quality: ResourceQuality): Promise<number> {
    const multipliers = await this.getQualityMultipliers();
    return multipliers[quality] ?? 1.0;
  }

  /**
   * 获取收集物定义
   */
  static async getCollectibles(): Promise<Record<string, CollectibleDefinition>> {
    const config = await this.loadConfig();
    return config.collectibles || {};
  }

  /**
   * 获取单个收集物
   */
  static async getCollectible(itemId: string): Promise<CollectibleDefinition | null> {
    const collectibles = await this.getCollectibles();
    return collectibles[itemId] || null;
  }

  /**
   * 获取江湖小剧场故事
   */
  static async getStoryEvents(): Promise<{
    general: string[];
    practice: string[];
    sparring: string[];
    reading: string[];
    rare: string[];
  }> {
    const config = await this.loadConfig();
    return (
      config.storyEvents || {
        general: [],
        practice: [],
        sparring: [],
        reading: [],
        rare: [],
      }
    );
  }

  /**
   * 获取随机故事（根据闭关类型）
   */
  static async getRandomStory(type: SeclusionType, isRare: boolean = false): Promise<string> {
    const stories = await this.getStoryEvents();

    // 优先从对应类型的故事中选取
    const typeStories = stories[type] || [];

    // 如果有稀有故事且条件满足，可能触发稀有故事
    if (isRare && stories.rare.length > 0 && Math.random() < 0.3) {
      return stories.rare[Math.floor(Math.random() * stories.rare.length)];
    }

    // 否则从通用和类型特定故事中选取
    const allStories = [...stories.general, ...typeStories];
    if (allStories.length === 0) {
      return '此番闭关，虽无所得，却也无失。';
    }

    return allStories[Math.floor(Math.random() * allStories.length)];
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.configCache = null;
  }

  /**
   * 验证配置完整性 v2.0
   */
  private static validateConfig(config: SeclusionConfigFile): SeclusionConfigFile {
    const errors: string[] = [];

    // 验证类型定义
    if (!Array.isArray(config.types) || config.types.length === 0) {
      errors.push('缺少闭关类型定义');
    } else {
      config.types.forEach((type, index) => {
        if (!type.id) errors.push(`类型[${index}]缺少id`);
        if (!type.name) errors.push(`类型[${index}]缺少name`);
        if (typeof type.baseExpPerTick !== 'number')
          errors.push(`类型[${index}]缺少baseExpPerTick`);
      });
    }

    // 验证事件定义
    if (!Array.isArray(config.events)) {
      errors.push('缺少事件定义');
    }

    if (errors.length > 0) {
      console.warn('[SeclusionConfigService] 配置验证警告:', errors);
    }

    // 填充缺失的默认值 v2.0
    return {
      version: config.version || '2.0.0',
      lastUpdated: config.lastUpdated || new Date().toISOString(),
      types: config.types || this.getDefaultTypes(),
      events: config.events || [],
      parameters: { ...DEFAULT_PARAMETERS, ...config.parameters },
      durationOptions: { ...DEFAULT_DURATION_OPTIONS, ...config.durationOptions },
      qualityMultipliers: { ...DEFAULT_QUALITY_MULTIPLIERS, ...config.qualityMultipliers },
      collectibles: config.collectibles || {},
      rarities: config.rarities || {
        common: { name: '寻常', dropWeight: 60, color: '#9ca3af' },
        fine: { name: '上乘', dropWeight: 25, color: '#10b981' },
        rare: { name: '绝学', dropWeight: 10, color: '#3b82f6' },
        epic: { name: '失传', dropWeight: 5, color: '#8b5cf6' },
      },
      storyEvents: config.storyEvents || {
        general: ['忽闻远处钟声悠悠，心境竟平和了几分'],
        practice: ['内力运转周天，竟比往日更顺畅'],
        sparring: ['拆招之际，忽觉招式有破绽'],
        reading: ['翻阅旧籍，发现夹页批注'],
        rare: ['邻桌两人压低嗓音，提到一页失传剑谱……'],
      },
      reputationTitles: config.reputationTitles || [],
    };
  }

  /**
   * 获取默认类型定义 v2.0
   */
  private static getDefaultTypes(): SeclusionTypeDefinition[] {
    return [
      {
        id: 'practice',
        name: '闭门练功',
        description: '吐纳调息，运转周天',
        icon: '🧘',
        baseExpPerTick: 2,
        baseGoldPerTick: 0.1,
        primaryBonus: { type: 'exp', multiplier: 1.5 },
        collectibleDrops: {
          primary: ['心法残页', '武学典籍'],
          secondary: ['江湖典故'],
        },
        eventWeightModifiers: {
          insight_flash: 1.5,
          qi_surge: 1.3,
          meditation_deep: 1.2,
        },
      },
      {
        id: 'sparring',
        name: '对招演练',
        description: '拆招解式，精进武艺',
        icon: '⚔️',
        baseExpPerTick: 1,
        baseGoldPerTick: 0.05,
        primaryBonus: { type: 'attribute', multiplier: 2.0 },
        collectibleDrops: {
          primary: ['招式残谱', '兵器谱条目'],
          secondary: ['兵器谱'],
        },
        eventWeightModifiers: {
          body_strengthen: 1.5,
          endurance_boost: 1.3,
          muscle_tear: 1.2,
        },
      },
      {
        id: 'reading',
        name: '抄经读谱',
        description: '研读典籍，悟道参禅',
        icon: '📖',
        baseExpPerTick: 1.5,
        baseGoldPerTick: 0.2,
        primaryBonus: { type: 'insight', multiplier: 1.8 },
        collectibleDrops: {
          primary: ['武学批注', '古籍批注'],
          secondary: ['心法残页'],
        },
        eventWeightModifiers: {
          enlightenment: 1.5,
          wisdom_gain: 1.3,
          confusion: 0.8,
        },
      },
    ];
  }

  /**
   * 获取默认配置 v2.0
   */
  private static getDefaultConfig(): SeclusionConfigFile {
    return {
      version: '2.0.0',
      lastUpdated: new Date().toISOString(),
      types: this.getDefaultTypes(),
      events: [],
      parameters: DEFAULT_PARAMETERS,
      durationOptions: DEFAULT_DURATION_OPTIONS,
      qualityMultipliers: DEFAULT_QUALITY_MULTIPLIERS,
      collectibles: {},
      rarities: {
        common: { name: '寻常', dropWeight: 60, color: '#9ca3af' },
        fine: { name: '上乘', dropWeight: 25, color: '#10b981' },
        rare: { name: '绝学', dropWeight: 10, color: '#3b82f6' },
        epic: { name: '失传', dropWeight: 5, color: '#8b5cf6' },
      },
      storyEvents: {
        general: ['忽闻远处钟声悠悠，心境竟平和了几分'],
        practice: ['内力运转周天，竟比往日更顺畅'],
        sparring: ['拆招之际，忽觉招式有破绽'],
        reading: ['翻阅旧籍，发现夹页批注'],
        rare: ['邻桌两人压低嗓音，提到一页失传剑谱……'],
      },
      reputationTitles: [],
    };
  }
}
