import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

export interface ConvoyEventEntry {
  type: 'none' | 'toll' | 'wear' | 'ambush_normal' | 'ambush_elite' | 'lucky' | 'rest' | 'fortune' | 'danger_chain';
  weight: number;
  log?: string;
  gold?: number; // for toll
  integrityLoss?: [number, number]; // for wear, danger_chain
  integrityBonus?: [number, number]; // for lucky
  integrityRestore?: [number, number]; // for rest
  goldBonus?: [number, number]; // for fortune
  groupId?: string; // for ambush
}

export interface ConvoyRewardsConfig {
  goldBase: number;
  dropGroups?: Array<{ id: string; chance: number }>;
}

export interface ConvoyFailureConfig {
  consolationGoldRatio?: number; // 0~1
}

export interface ConvoyIntegrityConfig {
  start: number; // 0-100
  minRewardRatio: number; // 0-1
}

export interface ConvoyRouteConfig {
  id: string;
  name: string;
  fromLocationId: string;
  toLocationId: string;
  minLevel?: number;
  unlock?: { gold?: number };
  limits?: { daily?: number; cooldownSec?: number };
  costs: { 
    commission: number; 
    deposit: number;
    materials?: Array<{ itemId: string; qty: number; name?: string }>; // 材料需求
  };
  durationSec: number;
  segments: number;
  integrity: ConvoyIntegrityConfig;
  events: ConvoyEventEntry[];
  rewards: ConvoyRewardsConfig;
  failure?: ConvoyFailureConfig;
}

export interface ConvoyRoutesFile {
  version: string;
  lastUpdated: string;
  routes: Record<string, ConvoyRouteConfig>;
}

export class ConvoyRoutesService {
  private static cache: ConvoyRoutesFile | null = null;

  static async load(): Promise<ConvoyRoutesFile> {
    if (ConvoyRoutesService.cache) return ConvoyRoutesService.cache;
    const data = await configService.loadConfig<ConvoyRoutesFile>(ConfigType.CONVOY_ROUTES);
    ConvoyRoutesService.cache = data;
    return data;
  }

  static clearCache() { ConvoyRoutesService.cache = null; }

  static async getRoute(id: string): Promise<ConvoyRouteConfig | null> {
    const data = await ConvoyRoutesService.load();
    return data.routes[id] || null;
    }

  static async listRoutes(): Promise<ConvoyRouteConfig[]> {
    const data = await ConvoyRoutesService.load();
    return Object.values(data.routes);
  }
}

export const { load: loadConvoyRoutes, getRoute: getConvoyRoute, listRoutes: listConvoyRoutes } = ConvoyRoutesService;
