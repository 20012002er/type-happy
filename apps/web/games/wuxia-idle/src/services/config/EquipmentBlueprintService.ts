import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

export interface EquipmentBlueprint {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'boots' | 'belt' | 'neck' | 'ring';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  base: Record<string, number>;
  affixPool: string[];
  enhance: { maxLevel: number; growth: Record<string, number> };
  comment?: string;
  // 市场售卖控制（可选）
  sellable?: boolean;
  sellPrice?: number;
}

export interface EquipmentBlueprintsFile {
  version: string;
  lastUpdated: string;
  blueprints: Record<string, EquipmentBlueprint>;
}

export class EquipmentBlueprintService {
  private static cache: EquipmentBlueprintsFile | null = null;

  static async load(): Promise<EquipmentBlueprintsFile> {
    // 为避免开发时缓存导致字段缺失（如新增 comment），每次强制从配置源加载
    const data = await configService.loadConfig<EquipmentBlueprintsFile>(
      ConfigType.EQUIPMENT_BLUEPRINTS,
      { useCache: false }
    );
    EquipmentBlueprintService.cache = data;
    return data;
  }

  static clearCache() {
    EquipmentBlueprintService.cache = null;
    try {
      // 同步清理底层本地配置缓存，确保最新配置生效
      configService.clearCache?.(ConfigType.EQUIPMENT_BLUEPRINTS as any);
    } catch (e) {
      console.warn('[EquipmentBlueprintService] Failed to clear cache:', e);
    }
  }

  static async getBlueprint(id: string): Promise<EquipmentBlueprint | null> {
    const data = await EquipmentBlueprintService.load();
    return data.blueprints[id] || null;
  }
}

export const { load: loadEquipmentBlueprints, getBlueprint } = EquipmentBlueprintService;


