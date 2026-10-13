/**
 * 地图类型（全文字，KISS）
 */

export interface LocationIdleConfig {
  baseExpPerSec: number;
  baseGoldPerSec: number;
  difficulty: number; // 1.0 基准
  monsterGroup?: string; // 敌人组ID（后续用）
  dropGroup?: string; // 掉落组ID（后续用）
  blueprintPool?: string[]; // 装备蓝图池
  eventChance?: number; // 0~1
  eventList?: string[]; // 事件ID列表（后续用）
  victorySeconds?: number; // 胜利奖励按秒基数（可配置）
}

export interface LocationRequirements {
  minLevel?: number;
  maxLevel?: number;
  questId?: string;
}

export interface LocationRespawnConfig {
  bossId: string;
  respawnMinutes: number;
  lastKillTimeField: string; // 存档字段名
}

export interface Location {
  id: string;
  name: string;
  description: string;
  connections: string[]; // 可到达地点ID
  idle?: LocationIdleConfig;
  requirements?: LocationRequirements;
  respawn?: LocationRespawnConfig;
  dungeonIds?: string[]; // 该地点可进入的地牢ID列表
}

export interface DropItemConfig {
  itemId?: string;
  weight: number;
  minQty?: number;
  maxQty?: number;
  // 子组支持
  groupId?: string;
  type?: 'subGroup';
}

export type DropGroupMap = Record<string, DropItemConfig[]>;

export interface EventConfig {
  type: 'quest' | 'shop' | 'battle' | 'grantMartial' | string;
  [key: string]: any; // 保持灵活，后续扩展
}

export type EventMap = Record<string, EventConfig>;

export interface WorldMapConfig {
  version: string;
  lastUpdated: string;
  startLocationId: string;
  locations: Location[]; // 简单数组，便于运营配置
  dropGroups?: DropGroupMap;
  events?: EventMap;
}

export interface WorldMap {
  startLocationId: string;
  locationsById: Record<string, Location>;
  dropGroupsById?: DropGroupMap;
  eventsById?: EventMap;
}

export const normalizeWorldMap = (config: WorldMapConfig): WorldMap => {
  const locationsById: Record<string, Location> = {};
  for (const loc of config.locations) {
    locationsById[loc.id] = loc;
  }
  return {
    startLocationId: config.startLocationId,
    locationsById,
    dropGroupsById: config.dropGroups,
    eventsById: config.events
  };
};


