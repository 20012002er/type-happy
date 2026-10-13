import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';
import type { Enemy } from '@/types/enemy';

export interface EnemiesFile { version: string; lastUpdated: string; enemies: Record<string, Enemy> }

export class EnemyConfigService {
  private static cache: EnemiesFile | null = null;

  static async load(): Promise<EnemiesFile> {
    if (EnemyConfigService.cache) return EnemyConfigService.cache;
    const data = await configService.loadConfig<EnemiesFile>(ConfigType.ENEMIES);
    EnemyConfigService.cache = data;
    return data;
  }

  static clearCache() { EnemyConfigService.cache = null; }

  static async getEnemy(id: string): Promise<Enemy | null> {
    const data = await EnemyConfigService.load();
    return data.enemies[id] || null;
  }
}

export const { load: loadEnemiesConfig, getEnemy } = EnemyConfigService;


