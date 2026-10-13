import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MeditationEffect, MeditationState, MeditationSnapshot } from '@/types/meditation';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useMapStore } from '@/stores/mapStore';

export const useMeditationStore = defineStore('meditation', () => {
  const playerStore = usePlayerStore();
  const logStore = useGameLogStore();
  const mapStore = useMapStore();

  const state = ref<MeditationState>({
    isAuto: false,
    isRunning: false,
    selectedLocationId: null,
    accumulator: 0,
    upgradeLevel: 0,
    upgradeBonusPerLevel: 1,
    effects: [],
    elapsedSeconds: 0,
    tickMinSeconds: 3,
    tickMaxSeconds: 8,
    nextTickInSeconds: 3
  });

  const currentLocationId = computed(() => state.value.selectedLocationId ?? mapStore.currentLocationId);

  const activeEffects = computed(() => {
    const now = Date.now();
    return state.value.effects.filter(e => e.expiresAt > now);
  });

  // 过渡期：逐步移除本地 effects 对 EPS 的影响，保持为 1（仅显示用途）
  const temporaryModifier = computed(() => 1);

  const efficiencyBaseByLevel = (level: number) => Math.max(1, level);

  const experiencePerSecond = computed(() => {
    const levelBase = efficiencyBaseByLevel(playerStore.player.stats.level);
    const upgradeBonus = state.value.upgradeLevel * state.value.upgradeBonusPerLevel;
    // 场景系数：简单读取 mapStore.currentLocation 的 idle.baseExpPerSec 归一化
    const loc = mapStore.currentLocation;
    let locationMultiplier = 1;
    if (loc && (loc as any).idle && (loc as any).idle.baseExpPerSec) {
      // 以新手村 baseExpPerSec=5 为 1 倍，做归一
      const base = 5;
      locationMultiplier = Math.max(0.2, (loc as any).idle.baseExpPerSec / base);
    }
    return (levelBase + upgradeBonus) * locationMultiplier;
  });

  const setSelectedLocation = (locationId: string) => {
    state.value.selectedLocationId = locationId;
  };

  const setTickWindow = (minSeconds: number, maxSeconds: number) => {
    state.value.tickMinSeconds = Math.max(1, Math.floor(minSeconds));
    state.value.tickMaxSeconds = Math.max(state.value.tickMinSeconds!, Math.floor(maxSeconds));
    state.value.nextTickInSeconds = randBetween(state.value.tickMinSeconds!, state.value.tickMaxSeconds!);
  };

  const onFrameSeconds = (seconds: number) => {
    state.value.elapsedSeconds = (state.value.elapsedSeconds || 0) + seconds;
  };

  const shouldProcessTick = (): boolean => {
    const remaining = (state.value.nextTickInSeconds || 3) - (state.value.elapsedSeconds || 0);
    if (remaining <= 0) {
      state.value.elapsedSeconds = 0;
      state.value.nextTickInSeconds = randBetween(state.value.tickMinSeconds || 3, state.value.tickMaxSeconds || 8);
      return true;
    }
    return false;
  };

  const randBetween = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

  const toggleAuto = () => {
    state.value.isAuto = !state.value.isAuto;
    if (state.value.isAuto) {
      logStore.addActionLog('开始自动打坐');
    } else {
      logStore.addActionLog('停止自动打坐');
    }
  };

  const applyEffect = (effect: MeditationEffect) => {
    state.value.effects.push(effect);
  };

  const clearExpiredEffects = () => {
    const now = Date.now();
    state.value.effects = state.value.effects.filter(e => e.expiresAt > now);
  };

  const snapshot = (): MeditationSnapshot => ({
    selectedLocationId: state.value.selectedLocationId,
    upgradeLevel: state.value.upgradeLevel,
    effects: state.value.effects
  });

  const restore = (s: Partial<MeditationSnapshot>) => {
    if (s.selectedLocationId !== undefined) state.value.selectedLocationId = s.selectedLocationId;
    if (typeof s.upgradeLevel === 'number') state.value.upgradeLevel = s.upgradeLevel;
    if (Array.isArray(s.effects)) state.value.effects = s.effects;
  };

  return {
    state,
    activeEffects,
    experiencePerSecond,
    temporaryModifier,
    currentLocationId,
    setSelectedLocation,
    toggleAuto,
    applyEffect,
    clearExpiredEffects,
    setTickWindow,
    onFrameSeconds,
    shouldProcessTick,
    snapshot,
    restore
  };
});


