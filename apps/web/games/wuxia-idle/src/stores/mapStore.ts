import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WorldMap, Location } from '@/types/map';
import { loadWorldMap } from '@/services/config/MapConfigService';
import { requestImmediateSave } from '@/services/autoSave';
import { useGameEventStore } from '@/stores/gameEventStore';
import { mainStoryService } from '@/services/mainStoryService';

export const useMapStore = defineStore('map', () => {
  const mapData = ref<WorldMap | null>(null);
  const currentLocationId = ref<string>('');
  const isReady = computed(() => !!mapData.value && !!currentLocationId.value);

  const currentLocation = computed<Location | null>(() => {
    if (!isReady.value) return null;
    return mapData.value!.locationsById[currentLocationId.value] || null;
  });

  const availableDestinations = computed<Location[]>(() => {
    const cur = currentLocation.value;
    if (!cur || !mapData.value) return [];
    return cur.connections.map(id => mapData.value!.locationsById[id]).filter(Boolean);
  });

  const initializeMap = async () => {
    const world = await loadWorldMap();
    mapData.value = world;
    currentLocationId.value = world.startLocationId;
  };

  const travelTo = (
    locationId: string
  ): { success: boolean; message: string; eventMessage?: string } => {
    const cur = currentLocation.value;
    if (!cur || !mapData.value) return { success: false, message: '地图未就绪' };
    if (!cur.connections.includes(locationId)) return { success: false, message: '无法到达该地点' };
    currentLocationId.value = locationId;
    requestImmediateSave('travelTo');
    const loc = mapData.value.locationsById[locationId];

    // 触发游戏事件：访问地点
    const gameEventStore = useGameEventStore();
    gameEventStore.onVisitLocation(locationId);

    // 触发主线剧情事件
    mainStoryService.triggerEvent('location.visit', { locationId });

    const eventMessage = rollTravelEvent(loc);
    return { success: true, message: `你来到了【${loc.name}】`, eventMessage };
  };

  const rollTravelEvent = (loc: Location): string | undefined => {
    // 简单随机事件：不改动数值，仅提供文字反馈，KISS
    const r = Math.random();
    if (r < 0.15) return `你在${loc.name}驻足片刻，心神宁静。`;
    if (r < 0.25) return `路过行人指点一二，你似有所悟。`;
    return undefined;
  };

  const getCurrentLocationSnapshot = (): Location | null => {
    return currentLocation.value;
  };

  return {
    // state
    mapData,
    currentLocationId,
    // getters
    isReady,
    currentLocation,
    availableDestinations,
    // actions
    initializeMap,
    travelTo,
    getCurrentLocationSnapshot,
  };
});
