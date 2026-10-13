import { equipmentFactory } from '@/services/loot/EquipmentFactory';
import type { Item } from '@/types/equipment';

export class DropService {
  // 基于地图等级与蓝图池，生成1件装备
  static async rollEquipment(blueprintIds: string[], mapLevel: number): Promise<Item | null> {
    if (!blueprintIds || blueprintIds.length === 0) return null;
    const pick = blueprintIds[Math.floor(Math.random() * blueprintIds.length)];
    return equipmentFactory.createFromBlueprint(pick, mapLevel);
  }
}

export const dropService = DropService;


