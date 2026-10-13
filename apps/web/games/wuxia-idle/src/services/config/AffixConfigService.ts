import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

export interface Affix { name: string; bonuses?: Record<string, number>; extra?: Record<string, number> }
export interface AffixesFile { version: string; lastUpdated: string; affixes: Record<string, Affix> }

export class AffixConfigService {
  private static cache: AffixesFile | null = null;

  static async load(): Promise<AffixesFile> {
    if (AffixConfigService.cache) return AffixConfigService.cache;
    const data = await configService.loadConfig<AffixesFile>(ConfigType.AFFIXES);
    AffixConfigService.cache = data;
    return data;
  }

  static clearCache() { AffixConfigService.cache = null; }

  static async getAffix(id: string): Promise<Affix | null> {
    const data = await AffixConfigService.load();
    return data.affixes[id] || null;
  }
}

export const { load: loadAffixes, getAffix } = AffixConfigService;


