import JSON5 from 'json5';
import ACHIEVEMENTS_RAW from '@/assets/configs/achievements.json5?raw';
import type { AchievementConfig } from '@/types/achievement';

/**
 * 成就配置服务
 * 负责加载并缓存 achievements.json5
 */
export class AchievementConfigService {
  private static configs: Record<string, AchievementConfig> = {};
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const parsed = JSON5.parse(ACHIEVEMENTS_RAW);
      this.configs = parsed.achievements || parsed;
      this.initialized = true;
      console.log(
        '[AchievementConfigService] 加载成就配置成功:',
        Object.keys(this.configs).length,
        '个成就'
      );
    } catch (error) {
      console.error('[AchievementConfigService] 加载成就配置失败:', error);
      this.configs = {};
      this.initialized = true;
    }
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  static getAchievement(id: string): AchievementConfig | undefined {
    if (!this.initialized) {
      console.warn('[AchievementConfigService] 配置未初始化，先调用 init()');
    }
    return this.configs[id];
  }

  static getAllAchievements(): AchievementConfig[] {
    if (!this.initialized) {
      console.warn('[AchievementConfigService] 配置未初始化，先调用 init()');
    }
    return Object.values(this.configs);
  }

  static getAchievementsByCategory(category: string): AchievementConfig[] {
    return this.getAllAchievements().filter(cfg => cfg.category === category);
  }
}

