import type { Item } from '@/types/equipment';
import { getBlueprint } from '@/services/config/EquipmentBlueprintService';
import { getAffix } from '@/services/config/AffixConfigService';

export class EquipmentFactory {
  // 根据蓝图id、地图等级，生成成品装备（简化：随机词缀1~2条，随机强化0~N）
  static async createFromBlueprint(blueprintId: string, mapLevel: number = 1): Promise<Item | null> {
    const bp = await getBlueprint(blueprintId);
    if (!bp) return null;
    // 基础属性按地图等级微增长（每级+3%）
    const levelFactor = 1 + 0.03 * Math.max(0, mapLevel - 1);
    const bonuses: any = {};
    if (typeof bp.base.hp === 'number') bonuses.hp = Math.floor(bp.base.hp * levelFactor);
    if (typeof bp.base.attack === 'number') bonuses.attack = Math.floor(bp.base.attack * levelFactor);
    if (typeof bp.base.defense === 'number') bonuses.defense = Math.floor(bp.base.defense * levelFactor);

    // 随机强化：0 ~ min(maxLevel, floor(mapLevel/5)+2)
    const maxEnh = bp.enhance.maxLevel;
    const enhCap = Math.min(maxEnh, Math.floor(mapLevel / 5) + 2);
    const enhanceLevel = Math.floor(Math.random() * (enhCap + 1));
    for (const key of Object.keys(bp.enhance.growth)) {
      const inc = Math.floor((bp.enhance.growth as any)[key] * enhanceLevel);
      if (inc) {
        bonuses[key] = (bonuses[key] || 0) + inc;
      }
    }

    // 随机词缀：1~2条
    const affixCount = Math.min(2, Math.max(1, Math.floor(Math.random() * 3))); // 1或2
    const affixes: string[] = [];
    const pool = [...(bp.affixPool || [])];
    for (let i = 0; i < affixCount && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const affixId = pool.splice(idx, 1)[0];
      const affix = await getAffix(affixId);
      if (affix) {
        affixes.push(affix.name);
        const b = affix.bonuses || {};
        if (typeof (b as any).hp === 'number') bonuses.hp = (bonuses.hp || 0) + (b as any).hp;
        if (typeof (b as any).attack === 'number') bonuses.attack = (bonuses.attack || 0) + (b as any).attack;
        if (typeof (b as any).defense === 'number') bonuses.defense = (bonuses.defense || 0) + (b as any).defense;
      }
    }

    // 生成唯一实例ID
    const instanceId = `${bp.id}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;

    return {
      id: instanceId,
      blueprintId: bp.id,
      name: `${bp.name}${enhanceLevel > 0 ? '+' + enhanceLevel : ''}`,
      slot: (bp.slot as any),
      rarity: bp.rarity as any,
      bonuses,
      enhanceLevel,
      affixes,
      comment: (bp as any).comment
    } as Item;
  }
}

export const equipmentFactory = EquipmentFactory;


