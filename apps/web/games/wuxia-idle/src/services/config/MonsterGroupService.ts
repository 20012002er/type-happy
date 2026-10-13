import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

export interface MonsterEntry { enemyId: string; weight: number }
export interface MonsterGroupConfig { normal: MonsterEntry[]; elite?: MonsterEntry[]; boss?: MonsterEntry[] }
export interface TierModifier { attack: number; hp: number; defense: number; critChance: number; dodgeChance: number }
export interface MonsterGroupsFile { version: string; lastUpdated: string; groups: Record<string, MonsterGroupConfig>; tierModifiers?: Record<'normal'|'elite'|'boss', TierModifier> }

export class MonsterGroupService {
  private static cache: MonsterGroupsFile | null = null;

  static async load(): Promise<MonsterGroupsFile> {
    if (MonsterGroupService.cache) return MonsterGroupService.cache;
    const data = await configService.loadConfig<MonsterGroupsFile>(ConfigType.MONSTER_GROUPS);
    MonsterGroupService.cache = data;
    return data;
  }

  static clearCache() { MonsterGroupService.cache = null; }

  static async pickEnemyId(groupId: string): Promise<{ tier: 'normal'|'elite'|'boss'; enemyId: string; modifier?: TierModifier } | null> {
    const data = await MonsterGroupService.load();
    const group = data.groups[groupId];
    if (!group) return null;

    // 简化：80% 普通，15% 精英，5% BOSS（若该tier有配置）
    const r = Math.random();
    const pickTier = (r < 0.8 && group.normal?.length) ? 'normal' : (r < 0.95 && group.elite?.length ? 'elite' : (group.boss?.length ? 'boss' : 'normal'));
    const list = (group as any)[pickTier] as MonsterEntry[];
    if (!list || list.length === 0) return null;
    const total = list.reduce((s, e) => s + (e.weight || 0), 0) || 1;
    let roll = Math.random() * total;
    for (const entry of list) {
      roll -= entry.weight || 0;
      if (roll <= 0) return { tier: pickTier as any, enemyId: entry.enemyId, modifier: data.tierModifiers?.[pickTier] };
    }
    return { tier: pickTier as any, enemyId: list[list.length - 1].enemyId, modifier: data.tierModifiers?.[pickTier] };
  }
}

export const { load: loadMonsterGroups, pickEnemyId } = MonsterGroupService;


