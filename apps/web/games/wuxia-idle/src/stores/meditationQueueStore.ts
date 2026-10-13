import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { QueueTask } from '@/services/QueueManagerService';
import { usePlayerStore } from '@/stores/playerStore';
import { PlayerState } from '@/types/player';

export type MeditationBias = 'balanced' | 'hp' | 'stamina' | 'energy';
export type MeditationPattern = 'even' | '424';

export interface CurrentMeditation {
  startTime: number;
  bias: MeditationBias;
  pattern: MeditationPattern;
  cycleSeconds: number;
  currentCycle: number; // 呼吸次数（可用于显示或离线推算）
}

export const useMeditationQueueStore = defineStore('meditationQueue', () => {
  const currentMeditation = ref<CurrentMeditation | null>(null);

  const isMeditating = computed(() => !!currentMeditation.value);

  function startMeditation(params: { bias: MeditationBias; pattern: MeditationPattern; cycleSeconds: number }) {
    if (currentMeditation.value) return;
    currentMeditation.value = {
      startTime: Date.now(),
      bias: params.bias,
      pattern: params.pattern,
      cycleSeconds: params.cycleSeconds,
      currentCycle: 0
    };
    // 切换玩家为打坐状态（用于全局tick加成）
    const p = usePlayerStore();
    p.player.state = PlayerState.MEDITATING;
  }

  function stopMeditation() {
    currentMeditation.value = null;
    const p = usePlayerStore();
    // 若仍处于打坐，改回空闲
    if (p.player.state === PlayerState.MEDITATING) {
      p.player.state = PlayerState.IDLE;
    }
  }

  function restoreMeditation(data: CurrentMeditation) {
    currentMeditation.value = { ...data };
    const p = usePlayerStore();
    p.player.state = PlayerState.MEDITATING;
  }

  function updateProgress() {
    // 打坐为持续行为，进度不确定，这里留空以便UI轮询时保持活跃
  }

  function getRemainingTime() {
    return -1; // 不确定时长
  }

  function createQueueTask(): QueueTask {
    const snap = currentMeditation.value ? { ...currentMeditation.value } : null;
    return {
      id: `meditation-${snap?.startTime || 'unknown'}`,
      type: 'meditation',
      name: '吐纳·周天',
      stopQueue: () => {
        // 只停止匹配的任务，避免停错
        if (snap && currentMeditation.value?.startTime === snap.startTime) {
          stopMeditation();
          // eslint-disable-next-line no-console
          console.log('[MeditationQueue] 队列已停止');
        }
      },
      isRunning: () => {
        return !!(snap && currentMeditation.value && currentMeditation.value.startTime === snap.startTime);
      },
      getProgress: () => -1,
      getRemainingTime: () => -1,
      getPhaseDescription: () => '入定吐纳'
    };
  }

  function getCurrentInfo() {
    return currentMeditation.value;
  }

  return {
    currentMeditation,
    isMeditating,
    startMeditation,
    stopMeditation,
    restoreMeditation,
    updateProgress,
    getRemainingTime,
    createQueueTask,
    getCurrentInfo
  };
});
