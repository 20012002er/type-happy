/**
 * 地图配置读取服务
 */

import type { WorldMapConfig, WorldMap } from '@/types/map';
import { normalizeWorldMap } from '@/types/map';
import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

export class MapConfigService {
  private static cachedMap: WorldMap | null = null;

  static async loadWorldMap(): Promise<WorldMap> {
    if (MapConfigService.cachedMap) return MapConfigService.cachedMap;
    const cfg = await configService.loadConfig<WorldMapConfig>(ConfigType.IDLE_LOCATIONS);
    const map = normalizeWorldMap(cfg);
    MapConfigService.cachedMap = map;
    return map;
  }

  static clearCache() {
    MapConfigService.cachedMap = null;
  }
}

export const { loadWorldMap } = MapConfigService;


