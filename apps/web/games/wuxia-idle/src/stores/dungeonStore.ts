/**
 * 地牢状态管理（重构版）
 *
 * 设计原则：
 * 1. 简化状态机 - 移除不必要的 AutoRunner，战斗本身是异步的
 * 2. 清晰的阶段转换 - idle -> preparing -> fighting -> between -> ... -> finished/failed/stopped
 * 3. 单一职责 - store 只管理状态，不驱动 UI
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  DungeonConfig,
  WaveConfig,
  DungeonRunState,
  DungeonPhase,
  RuntimeEnemy,
  RewardPool,
  DungeonHistory,
  DungeonResult,
} from '@/types/dungeon';
import type { QueueTask } from '@/services/QueueManagerService';
import { useQueueManager } from '@/services/QueueManagerService';
import { DungeonConfigService } from '@/services/config/DungeonConfigService';
import { EnemyConfigService } from '@/services/config/EnemyConfigService';
import { groupCombatService, type GroupCombatResult } from '@/services/GroupCombatService';
import { narrativeLogService } from '@/services/NarrativeLogService';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { economyService } from '@/services/economyService';
import { requestImmediateSave } from '@/services/autoSave';

const STORAGE_KEY = 'wuxia_dungeon_state';
const BETWEEN_WAVE_DELAY_MS = 1500;

export const useDungeonStore = defineStore('dungeon', () => {
  const queueManager = useQueueManager();
  const playerStore = usePlayerStore();
  const gameLogStore = useGameLogStore();

  // ========== State ==========
  const runState = ref<DungeonRunState | null>(null);
  const phase = ref<DungeonPhase>('idle');
  const history = ref<DungeonHistory[]>([]);
  const queueTaskId = ref<string | null>(null);
  const pendingRestore = ref<DungeonRunState | null>(null);
  const isAborting = ref(false); // 是否正在撤退中
  const playerHp = ref(0); // 战斗中的玩家 HP
  const playerMaxHp = ref(0); // 玩家最大 HP

  // 内部状态
  let currentConfig: DungeonConfig | null = null;
  let abortController: AbortController | null = null;

  // ========== Getters ==========
  const isRunning = computed(
    () =>
      phase.value !== 'idle' &&
      phase.value !== 'finished' &&
      phase.value !== 'failed' &&
      phase.value !== 'stopped'
  );

  const currentWaveProgress = computed(() => {
    if (!runState.value) return '';
    return `第 ${runState.value.waveIndex + 1} 波 / 共 ${runState.value.totalWaves} 波`;
  });

  const currentEnemies = computed(() => runState.value?.enemies ?? []);

  const rewardPoolPreview = computed(
    () => runState.value?.rewardPool ?? { gold: 0, exp: 0, drops: [] }
  );

  // 玩家战斗状态
  const playerBattleState = computed(() => ({
    hp: playerHp.value,
    maxHp: playerMaxHp.value,
    name: playerStore.player.name,
    level: playerStore.player.stats.level,
    attack: playerStore.player.stats.attack,
    defense: playerStore.player.stats.defense,
  }));

  // ========== 内部方法 ==========

  const generateInstanceId = (): string => {
    return `enemy_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  };

  const spawnWaveEnemies = async (wave: WaveConfig): Promise<RuntimeEnemy[]> => {
    const enemies: RuntimeEnemy[] = [];

    for (const spawn of wave.spawns) {
      const enemyConfig = await EnemyConfigService.getEnemy(spawn.enemyId);
      if (!enemyConfig) {
        console.warn(`[DungeonStore] 敌人配置未找到: ${spawn.enemyId}`);
        continue;
      }

      const count = spawn.count || 1;
      for (let i = 0; i < count; i++) {
        let attackMul = 1;
        let defenseMul = 1;
        let hpMul = 1;

        for (const mod of wave.modifiers ?? []) {
          if (mod.type === 'buff_enemies') {
            attackMul *= mod.attackMul ?? 1;
            defenseMul *= mod.defenseMul ?? 1;
            hpMul *= mod.hpMul ?? 1;
          }
        }

        const levelOffset = spawn.levelOffset ?? 0;
        const effectiveLevel = enemyConfig.stats.level + levelOffset;

        const enemy: RuntimeEnemy = {
          instanceId: generateInstanceId(),
          configId: spawn.enemyId,
          name: enemyConfig.name,
          tier: spawn.tier,
          stats: {
            hp: Math.floor(enemyConfig.stats.maxHp * hpMul),
            maxHp: Math.floor(enemyConfig.stats.maxHp * hpMul),
            attack: Math.floor(enemyConfig.stats.attack * attackMul),
            defense: Math.floor(enemyConfig.stats.defense * defenseMul),
            level: effectiveLevel,
          },
          modifiers: { attackMul, defenseMul },
        };

        enemies.push(enemy);
      }
    }

    return enemies;
  };

  const addToRewardPool = (gold: number, exp: number, drops: RewardPool['drops'] = []) => {
    if (!runState.value) return;
    runState.value.rewardPool.gold += gold;
    runState.value.rewardPool.exp += exp;
    runState.value.rewardPool.drops.push(...drops);
  };

  const settleRewards = async (ratio: number) => {
    if (!runState.value) return;

    const pool = runState.value.rewardPool;
    const goldGain = Math.floor(pool.gold * ratio);
    const expGain = Math.floor(pool.exp * ratio);

    if (goldGain > 0) {
      await economyService.addGold('dungeon', goldGain);
    }
    if (expGain > 0) {
      playerStore.gainExperience(expGain);
    }

    await narrativeLogService.emit({
      type: 'reward.settlement',
      gold: goldGain,
      exp: expGain,
      items: pool.drops.map(d => ({ name: d.name, qty: d.qty })),
      source: ratio >= 1 ? 'dungeon_clear' : 'partial_settlement',
    });
  };

  const recordHistory = (result: DungeonResult) => {
    if (!runState.value) return;

    const record: DungeonHistory = {
      dungeonId: runState.value.dungeonId,
      completedAt: Date.now(),
      result,
      wavesCleared: runState.value.waveIndex,
      totalWaves: runState.value.totalWaves,
      rewards: { ...runState.value.rewardPool },
    };

    history.value.push(record);
    if (history.value.length > 50) {
      history.value = history.value.slice(-50);
    }
  };

  const setPhase = (newPhase: DungeonPhase) => {
    phase.value = newPhase;
    if (runState.value) {
      runState.value.phase = newPhase;
    }
    saveToStorage();
  };

  const saveToStorage = () => {
    try {
      const data = { runState: runState.value, history: history.value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[DungeonStore] 保存失败:', error);
    }
  };

  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // ========== 队列任务 ==========

  const createQueueTask = (): QueueTask => {
    const taskId = queueTaskId.value ?? `dungeon_${Date.now()}`;
    queueTaskId.value = taskId;

    return {
      id: taskId,
      type: 'dungeon',
      name: runState.value?.dungeonName ?? '地牢挑战',
      stopQueue: () => abort(),
      isRunning: () => isRunning.value,
      getProgress: () => {
        if (!runState.value) return 0;
        return (runState.value.waveIndex / runState.value.totalWaves) * 100;
      },
      getRemainingTime: () => 0,
      getPhaseDescription: () => {
        switch (phase.value) {
          case 'preparing':
            return '准备进入';
          case 'fighting':
            return `战斗中 ${currentWaveProgress.value}`;
          case 'between':
            return '波次间隔';
          case 'settlement':
            return '结算中';
          default:
            return '空闲';
        }
      },
    };
  };

  // ========== 核心战斗流程 ==========

  /**
   * 执行完整的地牢挑战流程
   */
  const runDungeonLoop = async () => {
    if (!runState.value || !currentConfig) return;

    // 确保创建新的 AbortController
    abortController = new AbortController();
    const signal = abortController.signal;

    // 重置撤退状态
    isAborting.value = false;

    try {
      while (runState.value.waveIndex < runState.value.totalWaves) {
        // 检查是否请求中止
        if (signal.aborted || isAborting.value) {
          await handleAbort();
          return;
        }

        const waveIndex = runState.value.waveIndex;
        const wave = currentConfig.waves[waveIndex];

        // 生成敌人
        const enemies = await spawnWaveEnemies(wave);
        if (enemies.length === 0) {
          gameLogStore.addErrorLog('敌人生成失败，跳过此波');
          runState.value.waveIndex++;
          continue;
        }

        // 更新敌人列表
        runState.value.enemies = [...enemies];
        setPhase('fighting');

        // 发送波次开始事件
        await narrativeLogService.emit({
          type: 'dungeon.wave_start',
          dungeonName: runState.value.dungeonName,
          waveIndex: waveIndex + 1,
          totalWaves: runState.value.totalWaves,
          waveTitle: wave.title,
          enemyCount: enemies.length,
        });

        // 执行战斗
        const result = await executeBattle(enemies, signal);

        // 战斗结束后检查是否请求中止
        if (signal.aborted || isAborting.value) {
          await handleAbort();
          return;
        }

        if (result.winner === 'player') {
          await handleWaveVictory(wave);

          // 检查是否还有下一波
          if (runState.value.waveIndex < runState.value.totalWaves) {
            setPhase('between');
            await delay(BETWEEN_WAVE_DELAY_MS);

            // 波次间隔后再次检查
            if (signal.aborted || isAborting.value) {
              await handleAbort();
              return;
            }
          }
        } else {
          await handleDefeat();
          return;
        }
      }

      // 所有波次完成
      await handleVictory();
    } catch (error) {
      console.error('[DungeonStore] 地牢流程异常:', error);
      await handleDefeat();
    }
  };

  /**
   * 执行单场战斗
   */
  const executeBattle = async (
    enemies: RuntimeEnemy[],
    signal: AbortSignal
  ): Promise<GroupCombatResult> => {
    return new Promise(async resolve => {
      // 检查是否已中止
      if (signal.aborted) {
        resolve({
          winner: 'enemies',
          rounds: [],
          totalDamageDealt: 0,
          totalDamageTaken: 0,
          enemiesDefeated: [],
          enemySurvivors: [],
        });
        return;
      }

      // 初始化玩家战斗 HP
      playerHp.value = playerStore.player.stats.hp;
      playerMaxHp.value = playerStore.player.stats.maxHp;

      const result = await groupCombatService.start(
        playerStore.player,
        enemies,
        { delayMs: 350, activeSkills: [] },
        log => {
          // 实时更新敌人 HP
          if (runState.value && log.targets) {
            for (const target of log.targets) {
              const enemy = runState.value.enemies.find(e => e.instanceId === target.instanceId);
              if (enemy) {
                enemy.stats.hp = target.remainingHp;
              }
              // 更新玩家 HP
              if (target.instanceId === 'player') {
                playerHp.value = target.remainingHp;
              }
            }
          }
          // 输出战斗日志
          narrativeLogService.emit(log.event);
        },
        (newPlayerHp, enemiesHp) => {
          // 更新玩家 HP
          playerHp.value = newPlayerHp;
        }
      );

      resolve(result);
    });
  };

  /**
   * 处理波次胜利
   */
  const handleWaveVictory = async (wave: WaveConfig) => {
    if (!runState.value || !currentConfig) return;

    runState.value.wins++;
    runState.value.battleCount++;

    // 计算波次奖励
    const baseGold = 50 * (runState.value.waveIndex + 1);
    const baseExp = 30 * (runState.value.waveIndex + 1);
    const goldMul = currentConfig.reward.goldMultiplier ?? 1;
    const expMul = currentConfig.reward.expMultiplier ?? 1;

    addToRewardPool(Math.floor(baseGold * goldMul), Math.floor(baseExp * expMul));

    await narrativeLogService.emit({
      type: 'dungeon.wave_clear',
      dungeonName: runState.value.dungeonName,
      waveIndex: runState.value.waveIndex + 1,
      totalWaves: runState.value.totalWaves,
    });

    runState.value.waveIndex++;
    runState.value.enemies = [];
    saveToStorage();
  };

  /**
   * 处理通关
   */
  const handleVictory = async () => {
    if (!runState.value) return;

    setPhase('settlement');

    await narrativeLogService.emit({
      type: 'dungeon.finish',
      dungeonName: runState.value.dungeonName,
      rewardPool: {
        gold: runState.value.rewardPool.gold,
        exp: runState.value.rewardPool.exp,
        drops: runState.value.rewardPool.drops.map(d => ({ name: d.name, qty: d.qty })),
      },
    });

    await settleRewards(1.0);
    recordHistory('cleared');
    setPhase('finished');

    gameLogStore.addSystemLog(`✨ 通关【${runState.value.dungeonName}】！`);
  };

  /**
   * 处理失败
   */
  const handleDefeat = async () => {
    if (!runState.value) return;

    await narrativeLogService.emit({
      type: 'dungeon.fail',
      dungeonName: runState.value.dungeonName,
    });

    await settleRewards(0.5);
    recordHistory('failed');
    setPhase('failed');

    gameLogStore.addSystemLog(`✗ 挑战【${runState.value.dungeonName}】失败`);
  };

  /**
   * 处理主动退出
   */
  const handleAbort = async () => {
    if (!runState.value) {
      cleanup();
      return;
    }

    await narrativeLogService.emit({
      type: 'dungeon.abort',
      dungeonName: runState.value.dungeonName,
    });

    await settleRewards(0.5);
    recordHistory('aborted');
    setPhase('stopped');

    gameLogStore.addSystemLog(`← 撤退【${runState.value.dungeonName}】，获得50%奖励`);
  };

  /**
   * 清理状态（在 UI 确认后调用）
   */
  const cleanup = () => {
    currentConfig = null;
    abortController = null;
    runState.value = null;
    phase.value = 'idle';
    isAborting.value = false;
    playerHp.value = 0;
    playerMaxHp.value = 0;

    if (queueTaskId.value) {
      queueManager.stopTask(queueTaskId.value);
      queueTaskId.value = null;
    }

    clearStorage();
    requestImmediateSave('dungeon-cleanup');
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ========== Public Actions ==========

  /**
   * 进入地牢
   */
  const enter = async (dungeonId: string): Promise<{ success: boolean; message: string }> => {
    if (phase.value !== 'idle') {
      return { success: false, message: '当前正在进行其他挑战' };
    }

    const config = await DungeonConfigService.getDungeon(dungeonId);
    if (!config) {
      return { success: false, message: '地牢配置不存在' };
    }

    const unlockCheck = DungeonConfigService.checkUnlockCondition(
      config,
      playerStore.player.stats.level
    );
    if (!unlockCheck.unlocked) {
      return { success: false, message: unlockCheck.reason ?? '未解锁' };
    }

    // 检查并扣除消耗
    const cost = config.entryCost;
    if (cost.stamina) {
      const runtimePlayer = playerStore.player as any;
      const currentStamina = Math.floor(runtimePlayer?.stamina?.current ?? 0);
      if (currentStamina < cost.stamina) {
        return { success: false, message: `体力不足（需要 ${cost.stamina}）` };
      }
      if (runtimePlayer?.stamina) {
        runtimePlayer.stamina.current = currentStamina - cost.stamina;
      }
    }

    if (cost.gold) {
      const currentGold = playerStore.player.resources.gold;
      if (currentGold < cost.gold) {
        return { success: false, message: `金币不足（需要 ${cost.gold}）` };
      }
      await economyService.spend({ gold: cost.gold }, 'dungeon_entry');
    }

    // 初始化状态（确保重置所有状态）
    currentConfig = config;
    isAborting.value = false; // 重置撤退状态
    abortController = null; // 重置中止控制器

    runState.value = {
      dungeonId: config.id,
      dungeonName: config.name,
      waveIndex: 0,
      totalWaves: config.waves.length,
      enemies: [],
      rewardPool: { gold: 0, exp: 0, drops: [] },
      phase: 'preparing',
      startTime: Date.now(),
      battleCount: 0,
      wins: 0,
      losses: 0,
    };

    setPhase('preparing');
    queueTaskId.value = `dungeon_${Date.now()}`;
    queueManager.startTask(createQueueTask());

    await narrativeLogService.emit({
      type: 'dungeon.enter',
      dungeonName: config.name,
      totalWaves: config.waves.length,
    });

    saveToStorage();
    requestImmediateSave('dungeon-enter');

    // 启动地牢流程（异步，不阻塞）
    runDungeonLoop();

    return { success: true, message: `进入【${config.name}】` };
  };

  /**
   * 主动退出
   */
  const abort = () => {
    if (
      phase.value === 'idle' ||
      phase.value === 'finished' ||
      phase.value === 'failed' ||
      phase.value === 'stopped'
    ) {
      return;
    }

    isAborting.value = true;

    if (abortController) {
      abortController.abort();
    }
  };

  /**
   * 确认结束（UI 调用，清理状态）
   */
  const confirmEnd = () => {
    cleanup();
  };

  /**
   * 从存储恢复
   */
  const restoreFromStorage = async () => {
    // 确保初始状态是干净的
    isAborting.value = false;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const data = JSON.parse(saved);

      if (data.history) {
        history.value = data.history;
      }

      // 只有在有有效的运行状态且不是结束状态时才提示恢复
      if (
        data.runState &&
        data.runState.phase &&
        !['idle', 'finished', 'failed', 'stopped'].includes(data.runState.phase)
      ) {
        pendingRestore.value = data.runState;
        gameLogStore.addSystemLog('检测到未完成的地牢挑战');
      } else {
        // 清理无效的存档
        clearStorage();
      }
    } catch (error) {
      console.error('[DungeonStore] 恢复失败:', error);
      clearStorage();
    }
  };

  /**
   * 确认恢复
   */
  const confirmRestore = async () => {
    if (!pendingRestore.value) return;

    const config = await DungeonConfigService.getDungeon(pendingRestore.value.dungeonId);
    if (!config) {
      gameLogStore.addSystemLog('地牢配置已变更，无法恢复');
      abandonRestore();
      return;
    }

    currentConfig = config;
    isAborting.value = false; // 重置撤退状态
    abortController = null; // 重置中止控制器

    runState.value = pendingRestore.value;
    phase.value = runState.value.phase;
    pendingRestore.value = null;

    queueTaskId.value = `dungeon_${Date.now()}`;
    queueManager.startTask(createQueueTask());

    gameLogStore.addSystemLog(`继续挑战【${config.name}】`);

    // 继续地牢流程
    runDungeonLoop();
  };

  /**
   * 放弃恢复
   */
  const abandonRestore = async () => {
    if (!pendingRestore.value) return;

    const pool = pendingRestore.value.rewardPool;
    const goldGain = Math.floor(pool.gold * 0.5);
    const expGain = Math.floor(pool.exp * 0.5);

    if (goldGain > 0) {
      await economyService.addGold('dungeon', goldGain);
    }
    if (expGain > 0) {
      playerStore.gainExperience(expGain);
    }

    gameLogStore.addSystemLog(`放弃挑战，获得部分奖励：${goldGain} 金币，${expGain} 经验`);

    pendingRestore.value = null;
    clearStorage();
  };

  return {
    // State
    runState,
    phase,
    history,
    pendingRestore,
    isAborting,
    playerBattleState,

    // Getters
    isRunning,
    currentWaveProgress,
    currentEnemies,
    rewardPoolPreview,

    // Actions
    enter,
    abort,
    confirmEnd,
    restoreFromStorage,
    confirmRestore,
    abandonRestore,
  };
});
