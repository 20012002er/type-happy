/**
 * 离线收益配置服务
 */

import type { OfflineConfig } from '@/types/offline';
import OFFLINE_CONFIG_RAW from '@/assets/configs/offline-config.json5?raw';
import JSON5 from 'json5';

export class OfflineConfigService {
  private static instance: OfflineConfigService;
  private config: OfflineConfig | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): OfflineConfigService {
    if (!this.instance) {
      this.instance = new OfflineConfigService();
    }
    return this.instance;
  }

  /**
   * 初始化配置
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.config = JSON5.parse(OFFLINE_CONFIG_RAW) as OfflineConfig;
      this.initialized = true;
      console.log('[OfflineConfigService] 离线收益配置加载成功:', {
        baseMaxHours: this.config.offlineTime.baseMaxHours,
        efficiency: this.config.offlineTime.efficiency,
        upgrades: this.config.upgrades.length
      });
    } catch (error) {
      console.error('[OfflineConfigService] 离线收益配置加载失败:', error);
      // 使用默认配置
      this.config = this.getDefaultConfig();
      this.initialized = true;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): OfflineConfig {
    if (!this.initialized || !this.config) {
      throw new Error('OfflineConfigService not initialized');
    }
    return this.config;
  }

  /**
   * 获取最大离线时长（小时）
   * @param ownedUpgrades 玩家拥有的离线时长提升道具ID列表
   */
  getMaxOfflineHours(ownedUpgrades: string[] = []): number {
    if (!this.config) return 12;

    let maxHours = this.config.offlineTime.baseMaxHours;

    // 累加道具提升的时长
    for (const upgradeId of ownedUpgrades) {
      const upgrade = this.config.upgrades.find(u => u.id === upgradeId);
      if (upgrade) {
        maxHours += upgrade.additionalHours;
      }
    }

    return maxHours;
  }

  /**
   * 获取离线效率
   */
  getOfflineEfficiency(): number {
    return this.config?.offlineTime.efficiency ?? 0.8;
  }

  /**
   * 获取最小离线时长（分钟）
   */
  getMinOfflineMinutes(): number {
    return this.config?.offlineTime.minOfflineMinutes ?? 5;
  }

  /**
   * 检查活动类型是否支持离线收益
   */
  isActivitySupported(activityType: string): boolean {
    if (!this.config) return false;
    const rule = (this.config.activityRules as any)[activityType];
    return rule?.enabled ?? false;
  }

  /**
   * 获取活动的离线效率
   */
  getActivityEfficiency(activityType: string): number {
    if (!this.config) return 0.8;
    const rule = (this.config.activityRules as any)[activityType];
    return rule?.efficiency ?? this.config.offlineTime.efficiency;
  }

  /**
   * 获取采集活动的最大迭代次数
   */
  getGatheringMaxIterations(): number {
    return this.config?.activityRules.gathering.maxIterations ?? 1000;
  }

  /**
   * 默认配置
   */
  private getDefaultConfig(): OfflineConfig {
    return {
      version: '1.0.0',
      offlineTime: {
        baseMaxHours: 12,
        minOfflineMinutes: 5,
        efficiency: 0.8
      },
      upgrades: [],
      activityRules: {
        gathering: {
          enabled: true,
          efficiency: 0.8,
          consumeQueue: true,
          maxIterations: 1000
        },
        meditation: {
          enabled: true,
          efficiency: 0.8
        },
        martial: {
          enabled: false,
          efficiency: 0.5
        },
        combat: {
          enabled: false
        }
      }
    };
  }
}

// 导出单例
export const offlineConfigService = OfflineConfigService.getInstance();

