/**
 * 制皮队列 Store
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { QueueTask } from '@/services/QueueManagerService';

export interface LeatherworkingQueueItem {
  recipeId: string;
  recipeName: string;
  startTime: number;
  craftTime: number;
  currentCycle: number;
}

export const useLeatherworkingQueueStore = defineStore('leatherworkingQueue', () => {
  const current = ref<LeatherworkingQueueItem | null>(null);
  const now = ref(Date.now());

  const isWorking = computed(() => current.value !== null);
  const progress = computed(() => {
    if (!current.value) return 0;
    const elapsed = now.value - current.value.startTime;
    return Math.min((elapsed / current.value.craftTime) * 100, 100);
  });
  const remaining = computed(() => {
    if (!current.value) return 0;
    const elapsed = now.value - current.value.startTime;
    return Math.max(current.value.craftTime - elapsed, 0);
  });

  function start(recipeId: string, recipeName: string, craftTime: number) {
    current.value = { recipeId, recipeName, startTime: Date.now(), craftTime, currentCycle: 0 };
    console.log('[LeatherworkingQueue] 开始制皮:', recipeName);
  }
  function stop() {
    if (current.value) console.log('[LeatherworkingQueue] 停止制皮:', current.value.recipeName);
    current.value = null;
  }
  function completeCycle() {
    if (!current.value) return;
    current.value.currentCycle += 1;
    current.value.startTime = Date.now();
  }
  function shouldExecute(): boolean { return !!current.value && remaining.value <= 0; }
  function updateProgress() { now.value = Date.now(); }

  function createQueueTask(): QueueTask {
    const id = current.value?.recipeId;
    const name = current.value?.recipeName || '制皮';
    return {
      id: `leatherworking-${id || 'unknown'}`,
      type: 'leatherworking',
      name,
      stopQueue: () => { if (current.value?.recipeId === id) stop(); },
      isRunning: () => isWorking.value && current.value?.recipeId === id,
      getProgress: () => progress.value,
      getRemainingTime: () => remaining.value
    };
  }

  return { current, isWorking, progress, remaining, start, stop, completeCycle, shouldExecute, updateProgress, createQueueTask };
});
