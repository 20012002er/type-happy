import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Enemy } from '@/types/enemy';
import type { CombatResult } from '@/services/combatService';
import type { QueueTask } from '@/services/QueueManagerService';
import { useQueueManager } from '@/services/QueueManagerService';
import { AutoRunner } from '@/services/auto/AutoRunner';
import { useCombatStore } from '@/stores/combatStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { getBattleInterval } from '@/config/combatConfig';
import { requestImmediateSave } from '@/services/autoSave';

export type CombatAutomationPhase = 'idle' | 'preparing' | 'fighting' | 'waiting' | 'stopping';

interface CloneableEnemy extends Enemy {
  stats: Enemy['stats'] & { maxHp: number; hp: number };
}

const cloneEnemy = (enemy: Enemy): CloneableEnemy => {
  return JSON.parse(JSON.stringify(enemy));
};

export const useCombatAutomationStore = defineStore('combatAutomation', () => {
  const queueManager = useQueueManager();
  const combatStore = useCombatStore();
  const playerStore = usePlayerStore();
  const gameLogStore = useGameLogStore();

  const phase = ref<CombatAutomationPhase>('idle');
  const currentEnemy = ref<CloneableEnemy | null>(null);
  const queueTaskId = ref<string | null>(null);
  const wins = ref(0);
  const losses = ref(0);
  const battleCount = ref(0);
  const lastResult = ref<CombatResult | null>(null);
  const waitingTotalMs = ref<number>(getBattleInterval());
  const waitingRemainingMs = ref<number>(0);
  const stopRequested = ref(false);
  let summaryLogged = false;

  let runner: AutoRunner | null = null;
  let battleInProgress = false;

  const isRunning = computed(() => phase.value !== 'idle' && phase.value !== 'stopping');
  const isStopping = computed(() => phase.value === 'stopping');

  const waitingProgress = computed(() => {
    if (phase.value !== 'waiting' || waitingTotalMs.value <= 0) return 0;
    const completed = waitingTotalMs.value - waitingRemainingMs.value;
    return Math.min(100, (completed / waitingTotalMs.value) * 100);
  });

  const currentEnemyName = computed(() => currentEnemy.value?.name ?? '敌人');

  const ensureRunner = () => {
    if (runner) return;
    runner = new AutoRunner({
      shouldRun: async () => phase.value !== 'idle',
      onTick: async ({ dtSeconds }) => {
        await handleTick(dtSeconds);
      },
      options: {
        tickMinSeconds: 1,
        tickMaxSeconds: 1,
        tickIntervalMs: 500,
        autoPauseOnHidden: false,
        progressUpdateIntervalMs: 100,
      },
    });
  };

  const resetStats = () => {
    wins.value = 0;
    losses.value = 0;
    battleCount.value = 0;
    lastResult.value = null;
    waitingTotalMs.value = getBattleInterval();
    waitingRemainingMs.value = 0;
    stopRequested.value = false;
    summaryLogged = false;
  };

  const logSummaryIfNeeded = () => {
    if (summaryLogged) return;
    if (wins.value > 0 || losses.value > 0) {
      gameLogStore.addSystemLog(`挑战结束，本次战绩: ${wins.value}胜 / ${losses.value}败`);
      summaryLogged = true;
    }
  };

  const finalizeStop = (fromQueueManager = false) => {
    stopRequested.value = false;
    battleInProgress = false;
    phase.value = 'idle';
    waitingRemainingMs.value = 0;
    currentEnemy.value = null;
    const previousTaskId = queueTaskId.value;
    queueTaskId.value = null;
    if (runner) {
      runner.stop();
      runner = null;
    }
    if (!fromQueueManager && previousTaskId) {
      queueManager.stopTask(previousTaskId);
    }
    // 立刻保存一次，确保停止状态写入存档
    requestImmediateSave('combat-auto-stop');
  };

  const createQueueTask = (): QueueTask => {
    const taskId = queueTaskId.value ?? `combat_${Date.now()}`;
    queueTaskId.value = taskId;
    return {
      id: taskId,
      type: 'combat',
      name: currentEnemyName.value,
      stopQueue: () => {
        requestStop(true, true);
      },
      isRunning: () => phase.value !== 'idle',
      getProgress: () => {
        if (phase.value === 'waiting') {
          return waitingProgress.value;
        }
        if (phase.value === 'fighting') {
          return -1;
        }
        return 0;
      },
      getRemainingTime: () => {
        if (phase.value === 'waiting') {
          return waitingRemainingMs.value;
        }
        return 0;
      },
      getPhaseDescription: () => {
        if (phase.value === 'stopping') return '正在停止...';
        if (phase.value === 'waiting') {
          return battleCount.value > 0 ? '寻找下一个敌人' : '准备战斗';
        }
        if (phase.value === 'fighting') {
          return `战斗中 (第${battleCount.value + 1}场)`;
        }
        return '空闲';
      },
    };
  };

  const executeBattle = async () => {
    if (battleInProgress || stopRequested.value) {
      return;
    }

    const enemyTemplate = currentEnemy.value;
    if (!enemyTemplate) {
      finalizeStop();
      return;
    }

    // 🔧 BUG-001 修复：战斗前检查体力
    const staminaGauge = (playerStore.player as any).stamina;
    if (staminaGauge && staminaGauge.current <= 0) {
      console.log('[CombatAutomation] 体力不足，停止战斗');
      const logs = useGameLogStore();
      logs.addErrorLog('体力不足，无法继续战斗！请休息后再来挑战。');
      requestStop(true);
      return;
    }

    const battleEnemy = cloneEnemy(enemyTemplate);
    battleEnemy.stats.hp = battleEnemy.stats.maxHp;

    phase.value = 'fighting';
    battleInProgress = true;

    try {
      const result = await combatStore.startCombat(playerStore.player, battleEnemy);
      battleInProgress = false;
      lastResult.value = result || null;

      if (!result) {
        requestStop(true);
        return;
      }

      if (result.winner !== 'player') {
        losses.value += 1;
        requestStop(true);
        return;
      }

      wins.value += 1;
      battleCount.value += 1;

      // 🔧 BUG-002 修复：战斗胜利后恢复少量体力
      if (staminaGauge) {
        const staminaRestore = Math.ceil(staminaGauge.max * 0.1); // 恢复10%体力
        staminaGauge.current = Math.min(staminaGauge.max, staminaGauge.current + staminaRestore);
        console.log(`[CombatAutomation] 战斗胜利，体力恢复 +${staminaRestore}`);
      }

      if (stopRequested.value) {
        requestStop(true);
        return;
      }

      phase.value = 'waiting';
      waitingTotalMs.value = getBattleInterval();
      waitingRemainingMs.value = waitingTotalMs.value;
    } catch (error) {
      console.error('[CombatAutomation] 战斗执行异常:', error);
      battleInProgress = false;
      requestStop(true);
    }
  };

  const handleTick = async (dtSeconds: number) => {
    if (phase.value === 'preparing') {
      await executeBattle();
      return;
    }

    if (phase.value === 'waiting') {
      const decrement = dtSeconds * 1000;
      waitingRemainingMs.value = Math.max(0, waitingRemainingMs.value - decrement);
      if (waitingRemainingMs.value <= 0) {
        await executeBattle();
      }
      return;
    }

    if (phase.value === 'stopping' && !battleInProgress) {
      logSummaryIfNeeded();
      finalizeStop();
    }
  };

  const start = (enemy: Enemy) => {
    if (phase.value !== 'idle') {
      requestStop(true);
    }

    // 检查是否有其他队列任务正在运行（如闭关修炼），如果有则先停止
    if (queueManager.hasRunningTask()) {
      const currentTask = queueManager.getCurrentTaskInfo();
      console.log(
        `[CombatAutomation] 检测到其他任务正在运行: ${currentTask?.type} - ${currentTask?.name}，正在停止...`
      );
      queueManager.stopTask();
    }

    currentEnemy.value = cloneEnemy(enemy);
    resetStats();
    phase.value = 'preparing';
    queueTaskId.value = `combat_${Date.now()}`;

    queueManager.startTask(createQueueTask());

    ensureRunner();
    runner?.start();
    // 立刻保存一次，确保自动战斗状态和敌人ID写入存档
    requestImmediateSave('combat-auto-start');
  };

  const requestStop = (immediate = false, fromQueueManager = false) => {
    if (phase.value === 'idle') return;

    if (!fromQueueManager) {
      if (queueTaskId.value) {
        queueManager.stopTask(queueTaskId.value);
        return;
      }
    }

    stopRequested.value = true;
    if (!battleInProgress) {
      logSummaryIfNeeded();
      finalizeStop(fromQueueManager);
      return;
    }

    phase.value = 'stopping';
  };

  return {
    // state
    phase,
    currentEnemy,
    wins,
    losses,
    battleCount,
    lastResult,
    waitingTotalMs,
    waitingRemainingMs,
    waitingProgress,
    currentEnemyName,
    isRunning,
    isStopping,

    // actions
    start,
    requestStop,
  };
});
