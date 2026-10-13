import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ExploreState {
  isAuto: boolean;
  isRunning: boolean;
  tickMinSeconds: number;
  tickMaxSeconds: number;
  nextTickInSeconds: number;
  elapsedSeconds: number;
}

export const useExploreStore = defineStore('explore', () => {
  const state = ref<ExploreState>({
    isAuto: false,
    isRunning: false,
    tickMinSeconds: 4,
    tickMaxSeconds: 10,
    nextTickInSeconds: 4,
    elapsedSeconds: 0
  });

  const randBetween = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

  const setTickWindow = (minSeconds: number, maxSeconds: number) => {
    state.value.tickMinSeconds = Math.max(1, Math.floor(minSeconds));
    state.value.tickMaxSeconds = Math.max(state.value.tickMinSeconds, Math.floor(maxSeconds));
    state.value.nextTickInSeconds = randBetween(state.value.tickMinSeconds, state.value.tickMaxSeconds);
  };

  const onFrameSeconds = (seconds: number) => {
    state.value.elapsedSeconds = (state.value.elapsedSeconds || 0) + seconds;
  };

  const shouldProcessTick = (): boolean => {
    const remaining = (state.value.nextTickInSeconds || 4) - (state.value.elapsedSeconds || 0);
    if (remaining <= 0) {
      state.value.elapsedSeconds = 0;
      state.value.nextTickInSeconds = randBetween(state.value.tickMinSeconds || 4, state.value.tickMaxSeconds || 10);
      return true;
    }
    return false;
  };

  const toggleAuto = () => {
    state.value.isAuto = !state.value.isAuto;
  };

  return {
    state,
    setTickWindow,
    onFrameSeconds,
    shouldProcessTick,
    toggleAuto
  };
});


