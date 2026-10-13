/**
 * 玩家状态管理Store
 * 使用Pinia管理玩家数据和游戏逻辑
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Player, ActionResult, LevelUpResult } from '@/types/player';
import { PlayerState, ActionType, DEFAULT_PLAYER_CONFIG } from '@/types/player';
import {
  calculateBaseStats,
  calculateLevelUpGains,
  calculateMeditationRewards,
  calculatePracticeRewards,
  calculateRestRewards,
} from '@/utils/calculations';

import {
  LEVEL_EXP_TABLE,
  calculateLevelFromTotalExp,
  getRequiredExpForNextLevel,
  getCurrentLevelExp,
  checkCanLevelUp,
  calculateExpProgressPercent,
} from '@/config/levelExpConfig';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useLevelUpAnimationStore } from '@/stores/levelUpAnimationStore';
import { useTalentTreeStore } from '@/stores/talentTreeStore';
import { actionService } from '@/services/actionService';
import { requestImmediateSave } from '@/services/autoSave';
import { useGameEventStore } from '@/stores/gameEventStore';

export const usePlayerStore = defineStore('player', () => {
  // 获取游戏日志Store实例
  const gameLogStore = useGameLogStore();
  // 获取升级动画Store实例
  const levelUpAnimationStore = useLevelUpAnimationStore();
  // ===== 状态定义 =====

  const player = ref<Player>({
    id: 'player_001',
    name: '无名侠客',
    avatar: 'ninja', // 默认头像
    title: '江湖新丁',
    stats: {
      // 系统属性
      level: 1,
      totalExp: 0,
      currentExp: 0,
      requiredExp: getRequiredExpForNextLevel(1),

      // 基础四维
      strength: 5,
      agility: 5,
      vitality: 5,
      spirit: 5,

      // 派生战斗属性
      hp: 150, // 100 + 5×10
      maxHp: 150,
      attack: 20, // 10 + 5×2
      defense: 12, // 5 + 5×1.5
      energy: 75, // 50 + 5×5
      maxEnergy: 75,

      // 命中与闪避
      accuracy: 0.925, // 0.9 + 5×0.005
      dodgeChance: 0.04, // 0.03 + 5×0.002

      // 暴击系统
      critChance: 0.06, // 0.05 + (5+5)×0.001
      critMultiplier: 1.55, // 1.5 + 5×0.01

      // 防御系统
      blockChance: 0.015, // 5×0.003
      tenacity: 2.5, // 5×0.5

      // 其他战斗属性
      armorPenetration: 2.5, // 5×0.5
      speed: 1.1, // 1 + 5×0.02

      // 武侠特色
      qinggongLevel: 0,
      neigongLevel: 0,
      energyRegen: 7.5, // 5 + 5×0.5

      // 辅助属性
      luck: 1,
    },
    resources: {
      gold: 50,
      reputation: 0,
    },
    position: {
      mapId: 'main_world',
      locationId: 'newbie_village',
    },
    state: PlayerState.IDLE,
    lastActiveTime: Date.now(),
    createdAt: Date.now(),
  } as any);

  // 在运行期为玩家挂载体力/饱食度（保持向后兼容）
  const ensureStaminaGauges = () => {
    const p = player.value;
    if (!p.stamina) p.stamina = { current: 100, max: 100 };
    if (!p.satiety) p.satiety = { current: 100, max: 100 };
  };
  ensureStaminaGauges();

  // 当前执行的动作信息
  const currentAction = ref<{
    type: ActionType | null;
    startTime: number;
    duration: number;
  }>({
    type: null,
    startTime: 0,
    duration: 0,
  });

  // ===== 计算属性 =====

  // 是否正在执行动作
  const isBusy = computed(() => player.value.state !== PlayerState.IDLE);

  // 是否可以执行新动作
  const canPerformAction = computed(() => !isBusy.value);

  // 是否已死亡
  const isDead = computed(() => player.value.stats.hp <= 0);

  // 经验值进度百分比
  const expProgress = computed(() => {
    const { level, totalExp } = player.value.stats;
    return calculateExpProgressPercent(level, totalExp);
  });

  // 生命值进度百分比
  const hpProgress = computed(() => {
    return (player.value.stats.hp / player.value.stats.maxHp) * 100;
  });

  const stamina = computed(() => player.value.stamina);
  const satiety = computed(() => player.value.satiety);

  // ===== 核心方法 =====

  /**
   * 初始化或重置玩家数据
   */
  const initializePlayer = (name: string = '无名侠客') => {
    const baseStats = calculateBaseStats(1, DEFAULT_PLAYER_CONFIG);

    player.value = {
      id: 'player_001',
      name,
      title: '江湖新丁',
      stats: {
        ...baseStats,
        totalExp: 0,
        currentExp: 0,
        requiredExp: getRequiredExpForNextLevel(1),
      },
      resources: {
        gold: 50,
        reputation: 0,
      },
      position: {
        mapId: 'main_world',
        locationId: 'newbie_village',
      },
      state: PlayerState.IDLE,
      lastActiveTime: Date.now(),
      createdAt: Date.now(),
    } as any;
    ensureStaminaGauges();
  };

  /**
   * 更新玩家属性
   */
  const updateStats = (statsUpdate: Partial<Player['stats']>) => {
    Object.assign(player.value.stats, statsUpdate);

    // 确保HP不超过最大值
    if (player.value.stats.hp > player.value.stats.maxHp) {
      player.value.stats.hp = player.value.stats.maxHp;
    }
    requestImmediateSave('updateStats');
  };

  /**
   * 恢复气血
   */
  const healHp = (amount: number): number => {
    if (amount <= 0) return 0;
    const actualHeal = Math.min(amount, player.value.stats.maxHp - player.value.stats.hp);
    if (actualHeal > 0) {
      updateStats({ hp: player.value.stats.hp + actualHeal });
    }
    return actualHeal;
  };

  /**
   * 恢复精力
   */
  const healEnergy = (amount: number): number => {
    if (amount <= 0) return 0;
    const actualHeal = Math.min(amount, player.value.stats.maxEnergy - player.value.stats.energy);
    if (actualHeal > 0) {
      updateStats({ energy: player.value.stats.energy + actualHeal });
    }
    return actualHeal;
  };

  /**
   * 更新玩家资源
   */
  const updateResources = (resourcesUpdate: Partial<Player['resources']>) => {
    Object.assign(player.value.resources, resourcesUpdate);

    // 确保资源不为负数
    if (player.value.resources.gold < 0) {
      player.value.resources.gold = 0;
    }
    if (player.value.resources.reputation < 0) {
      player.value.resources.reputation = 0;
    }
    requestImmediateSave('updateResources');
  };

  function grantInsightReward(points: number): void {
    if (points <= 0) return;
    try {
      const talentTreeStore = useTalentTreeStore();
      talentTreeStore.grantInsight(points);
      gameLogStore.addRewardLog(`悟性 +${points}`);
    } catch (error) {
      console.warn('[PlayerStore] 发放悟性点失败:', error);
    }
  }

  /**
   * 增加经验值（MMORPG升级机制）
   * 按照文档规范：AddExp(player, gained_exp)
   */
  const gainExperience = (amount: number): LevelUpResult | null => {
    // 增加总经验值
    const newTotalExp = player.value.stats.totalExp + amount;
    updateStats({
      totalExp: newTotalExp,
    });

    let totalLevelUpResult: LevelUpResult | null = null;
    let insightEarned = 0;

    // 循环升级直到不能再升级
    while (true) {
      const levelCheck = checkCanLevelUp(player.value.stats.totalExp, player.value.stats.level);

      if (!levelCheck.canLevelUp) {
        break;
      }

      // 执行升级
      const oldLevel = player.value.stats.level;
      const newLevel = levelCheck.newLevel;
      insightEarned += newLevel - oldLevel;

      // 计算属性增长
      const gains = calculateLevelUpGains(oldLevel, newLevel, DEFAULT_PLAYER_CONFIG);

      // 更新玩家数据（升级后生命和内力回满）
      const newMaxHp = player.value.stats.maxHp + gains.hpIncrease;
      const newMaxEnergy = player.value.stats.maxEnergy + (gains.energyIncrease || 0);

      updateStats({
        level: newLevel,
        requiredExp: getRequiredExpForNextLevel(newLevel),

        // 基础四维提升
        strength: player.value.stats.strength + (gains.strengthIncrease || 0),
        agility: player.value.stats.agility + (gains.agilityIncrease || 0),
        vitality: player.value.stats.vitality + (gains.vitalityIncrease || 0),
        spirit: player.value.stats.spirit + (gains.spiritIncrease || 0),

        // 派生属性提升（升级后回满）
        maxHp: newMaxHp,
        hp: newMaxHp,
        attack: player.value.stats.attack + gains.attackIncrease,
        defense: player.value.stats.defense + gains.defenseIncrease,
        maxEnergy: newMaxEnergy,
        energy: newMaxEnergy,

        // 战斗属性提升
        accuracy: player.value.stats.accuracy + (gains.accuracyIncrease || 0),
        dodgeChance: player.value.stats.dodgeChance + (gains.dodgeChanceIncrease || 0),
        critChance: player.value.stats.critChance + (gains.critChanceIncrease || 0),
        speed: player.value.stats.speed + (gains.speedIncrease || 0),

        // 辅助属性
        luck: player.value.stats.luck + (gains.luckIncrease || 0),
      });

      // 记录升级结果（用于UI展示和日志）
      const levelUpResult: LevelUpResult = {
        success: true,
        newLevel: newLevel,
        previousLevel: oldLevel,
        remainingExp: getCurrentLevelExp(newLevel, player.value.stats.totalExp),

        // 主要属性增长
        hpIncrease: gains.hpIncrease,
        attackIncrease: gains.attackIncrease,
        defenseIncrease: gains.defenseIncrease,

        // 基础四维增长
        strengthIncrease: gains.strengthIncrease,
        agilityIncrease: gains.agilityIncrease,
        vitalityIncrease: gains.vitalityIncrease,
        spiritIncrease: gains.spiritIncrease,

        // 其他派生属性增长
        energyIncrease: gains.energyIncrease,
        accuracyIncrease: gains.accuracyIncrease,
        dodgeChanceIncrease: gains.dodgeChanceIncrease,
        critChanceIncrease: gains.critChanceIncrease,
        speedIncrease: gains.speedIncrease,
        luckIncrease: gains.luckIncrease,
      };

      if (!totalLevelUpResult) {
        totalLevelUpResult = levelUpResult;

        // 触发升级动画（只在第一次升级时触发，避免连续升级时多次弹窗）
        levelUpAnimationStore.triggerLevelUpAnimation(oldLevel, newLevel, {
          hpIncrease: gains.hpIncrease,
          attackIncrease: gains.attackIncrease,
          defenseIncrease: gains.defenseIncrease,
        });
      } else {
        // 累计多次升级的结果
        totalLevelUpResult.newLevel = newLevel;
        totalLevelUpResult.hpIncrease += gains.hpIncrease;
        totalLevelUpResult.attackIncrease += gains.attackIncrease;
        totalLevelUpResult.defenseIncrease += gains.defenseIncrease;
        totalLevelUpResult.remainingExp = levelUpResult.remainingExp;

        // 更新动画显示为最终的等级变化
        levelUpAnimationStore.triggerLevelUpAnimation(totalLevelUpResult.previousLevel, newLevel, {
          hpIncrease: totalLevelUpResult.hpIncrease,
          attackIncrease: totalLevelUpResult.attackIncrease,
          defenseIncrease: totalLevelUpResult.defenseIncrease,
        });
      }
      // 触发游戏事件：升级
      const gameEventStore = useGameEventStore();
      gameEventStore.onLevelUp(newLevel);
    }

    // 更新当前等级经验进度
    updateStats({
      currentExp: getCurrentLevelExp(player.value.stats.level, player.value.stats.totalExp),
    });

    requestImmediateSave('gainExperience');
    if (insightEarned > 0) {
      grantInsightReward(insightEarned);
    }
    return totalLevelUpResult;
  };

  // ===== 动作执行方法 =====

  /**
   * 执行打坐
   */
  const meditate = async (): Promise<ActionResult> => {
    if (!canPerformAction.value) {
      const message = '正在执行其他动作';
      gameLogStore.addErrorLog(message);
      return {
        success: false,
        actionType: ActionType.MEDITATE,
        message,
        duration: 0,
      } as ActionResult;
    }
    gameLogStore.addActionLog('开始打坐修炼...');
    player.value.state = PlayerState.MEDITATING;
    const res = await actionService.performAction(player.value, ActionType.MEDITATE);
    currentAction.value = {
      type: ActionType.MEDITATE,
      startTime: Date.now(),
      duration: res.duration,
    };
    await new Promise(r => setTimeout(r, res.duration));
    if (res.changes.stats) updateStats(res.changes.stats as any);
    const rewards = calculateMeditationRewards(player.value.stats.level);
    const levelUpResult = gainExperience(rewards.expGain);
    player.value.state = PlayerState.IDLE;
    currentAction.value.type = null;
    gameLogStore.addActionLog(res.message);
    if (rewards.expGain > 0) gameLogStore.addRewardLog(`获得${rewards.expGain}点经验`);
    if (levelUpResult) {
      gameLogStore.addLevelUpLog(
        `等级提升到${levelUpResult.newLevel}级！攻击+${levelUpResult.attackIncrease}，防御+${levelUpResult.defenseIncrease}，生命+${levelUpResult.hpIncrease}`
      );
    }
    return {
      success: true,
      actionType: ActionType.MEDITATE,
      hpChange: rewards.hpRestore,
      expGain: rewards.expGain,
      message: res.message,
      duration: res.duration,
    } as ActionResult;
  };

  /**
   * 执行练功
   */
  const practice = async (): Promise<ActionResult> => {
    if (!canPerformAction.value) {
      const message = '正在执行其他动作';
      gameLogStore.addErrorLog(message);
      return {
        success: false,
        actionType: ActionType.PRACTICE,
        message,
        duration: 0,
      } as ActionResult;
    }
    gameLogStore.addActionLog('开始练习武功...');
    player.value.state = PlayerState.PRACTICING;
    const res = await actionService.performAction(player.value, ActionType.PRACTICE);
    currentAction.value = {
      type: ActionType.PRACTICE,
      startTime: Date.now(),
      duration: res.duration,
    };
    await new Promise(r => setTimeout(r, res.duration));
    if (res.changes.stats) updateStats(res.changes.stats as any);
    const rewards = calculatePracticeRewards(player.value.stats.level);
    const levelUpResult = gainExperience(rewards.expGain);
    player.value.state = PlayerState.IDLE;
    currentAction.value.type = null;
    gameLogStore.addActionLog(res.message);
    if (rewards.expGain > 0) gameLogStore.addRewardLog(`获得${rewards.expGain}点经验`);
    if (rewards.attackIncrease > 0)
      gameLogStore.addRewardLog(`攻击力永久增加${rewards.attackIncrease}点！`);
    if (levelUpResult) {
      gameLogStore.addLevelUpLog(
        `等级提升到${levelUpResult.newLevel}级！攻击+${levelUpResult.attackIncrease}，防御+${levelUpResult.defenseIncrease}，生命+${levelUpResult.hpIncrease}`
      );
    }
    return {
      success: true,
      actionType: ActionType.PRACTICE,
      expGain: rewards.expGain,
      attackIncrease: rewards.attackIncrease,
      message: res.message,
      duration: res.duration,
    } as ActionResult;
  };

  /**
   * 执行休息
   */
  const rest = async (): Promise<ActionResult> => {
    if (!canPerformAction.value) {
      const message = '正在执行其他动作';
      gameLogStore.addErrorLog(message);
      return { success: false, actionType: ActionType.REST, message, duration: 0 } as ActionResult;
    }
    gameLogStore.addActionLog('开始休息恢复...');
    player.value.state = PlayerState.RESTING;
    const res = await actionService.performAction(player.value, ActionType.REST);
    currentAction.value = { type: ActionType.REST, startTime: Date.now(), duration: res.duration };
    await new Promise(r => setTimeout(r, res.duration));
    if (res.changes.stats) updateStats(res.changes.stats as any);
    player.value.state = PlayerState.IDLE;
    currentAction.value.type = null;
    gameLogStore.addActionLog(res.message);
    const rewards = calculateRestRewards(player.value.stats.level, player.value.stats.maxHp);
    if (rewards.hpRestore > 0) gameLogStore.addRewardLog(`恢复${rewards.hpRestore}点生命值`);
    return {
      success: true,
      actionType: ActionType.REST,
      hpChange: rewards.hpRestore,
      message: res.message,
      duration: res.duration,
    } as ActionResult;
  };

  /**
   * 恢复生命值（打坐/休息合并，不获得经验）
   */
  const restoreHp = async (): Promise<ActionResult> => {
    if (!canPerformAction.value) {
      const message = '正在执行其他动作';
      gameLogStore.addErrorLog(message);
      return {
        success: false,
        actionType: ActionType.RESTORE_HP,
        message,
        duration: 0,
      } as ActionResult;
    }
    gameLogStore.addActionLog('开始调息恢复生命...');
    player.value.state = PlayerState.RESTING;
    const res = await actionService.performAction(player.value, ActionType.RESTORE_HP);
    currentAction.value = {
      type: ActionType.RESTORE_HP,
      startTime: Date.now(),
      duration: res.duration,
    };
    await new Promise(r => setTimeout(r, res.duration));
    if (res.changes.stats) updateStats(res.changes.stats as any);
    player.value.state = PlayerState.IDLE;
    currentAction.value.type = null;
    gameLogStore.addActionLog(res.message);
    return {
      success: true,
      actionType: ActionType.RESTORE_HP,
      message: res.message,
      duration: res.duration,
    } as ActionResult;
  };

  /**
   * 恢复体力
   */
  const restoreStamina = async (): Promise<ActionResult> => {
    if (!canPerformAction.value) {
      const message = '正在执行其他动作';
      gameLogStore.addErrorLog(message);
      return {
        success: false,
        actionType: ActionType.RESTORE_STAMINA,
        message,
        duration: 0,
      } as ActionResult;
    }
    const runtimePlayer = player.value as any;
    const currentStamina = Math.floor(runtimePlayer.stamina?.current || 0);
    const maxStamina = runtimePlayer.stamina?.max || 100;
    if (currentStamina >= maxStamina) {
      const message = '体力已满，无需恢复';
      gameLogStore.addInfoLog(message);
      return {
        success: false,
        actionType: ActionType.RESTORE_STAMINA,
        message,
        duration: 0,
      } as ActionResult;
    }
    gameLogStore.addActionLog('开始调息恢复体力...');
    player.value.state = PlayerState.RESTING;
    const res = await actionService.performAction(player.value, ActionType.RESTORE_STAMINA);
    currentAction.value = {
      type: ActionType.RESTORE_STAMINA,
      startTime: Date.now(),
      duration: res.duration,
    };
    await new Promise(r => setTimeout(r, res.duration));
    if ((res.changes as any).stamina) {
      const runtimePlayer = player.value as any;
      if (runtimePlayer.stamina) {
        runtimePlayer.stamina.current = (res.changes as any).stamina.current;
      }
    }
    player.value.state = PlayerState.IDLE;
    currentAction.value.type = null;
    gameLogStore.addActionLog(res.message);
    return {
      success: true,
      actionType: ActionType.RESTORE_STAMINA,
      message: res.message,
      duration: res.duration,
    } as ActionResult;
  };

  /**
   * 恢复内力
   */
  const restoreEnergy = async (): Promise<ActionResult> => {
    if (!canPerformAction.value) {
      const message = '正在执行其他动作';
      gameLogStore.addErrorLog(message);
      return {
        success: false,
        actionType: ActionType.RESTORE_ENERGY,
        message,
        duration: 0,
      } as ActionResult;
    }
    const currentEnergy = Math.floor(player.value.stats.energy || 0);
    const maxEnergy = player.value.stats.maxEnergy || 100;
    if (currentEnergy >= maxEnergy) {
      const message = '内力已满，无需恢复';
      gameLogStore.addInfoLog(message);
      return {
        success: false,
        actionType: ActionType.RESTORE_ENERGY,
        message,
        duration: 0,
      } as ActionResult;
    }
    gameLogStore.addActionLog('开始调息恢复内力...');
    player.value.state = PlayerState.RESTING;
    const res = await actionService.performAction(player.value, ActionType.RESTORE_ENERGY);
    currentAction.value = {
      type: ActionType.RESTORE_ENERGY,
      startTime: Date.now(),
      duration: res.duration,
    };
    await new Promise(r => setTimeout(r, res.duration));
    if (res.changes.stats) updateStats(res.changes.stats as any);
    player.value.state = PlayerState.IDLE;
    currentAction.value.type = null;
    gameLogStore.addActionLog(res.message);
    return {
      success: true,
      actionType: ActionType.RESTORE_ENERGY,
      message: res.message,
      duration: res.duration,
    } as ActionResult;
  };

  // 移除离线收益相关逻辑

  /**
   * 消耗体力
   */
  const consumeStamina = (amount: number): boolean => {
    const staminaObj = player.value.stamina;
    if (!staminaObj || staminaObj.current < amount) {
      return false;
    }
    staminaObj.current = Math.max(0, staminaObj.current - amount);
    return true;
  };

  /**
   * 更新玩家资料（名称和头像）
   */
  const updateProfile = (name: string, avatar: string) => {
    if (name && name.trim()) {
      player.value.name = name.trim();
    }
    if (avatar) {
      player.value.avatar = avatar;
    }
    gameLogStore.addSystemLog(`角色资料已更新`);
    console.log('[PlayerStore] 角色资料已更新:', {
      name: player.value.name,
      avatar: player.value.avatar,
    });

    // 立即触发保存
    requestImmediateSave();
  };

  // ===== 返回store接口 =====

  return {
    // 状态
    player,
    currentAction,

    // 计算属性
    isBusy,
    canPerformAction,
    isDead,
    expProgress,
    hpProgress,
    stamina,
    satiety,

    // 方法
    initializePlayer,
    updateStats,
    updateResources,
    updateProfile,
    gainExperience,
    healHp,
    healEnergy,
    meditate,
    practice,
    rest,
    restoreHp,
    restoreStamina,
    restoreEnergy,
    consumeStamina,
  };
});
