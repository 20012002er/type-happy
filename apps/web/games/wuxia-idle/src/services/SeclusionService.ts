/**
 * 闭关修炼核心服务
 * @module services/SeclusionService
 */

import { useSeclusionStore } from '@/stores/seclusionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useCombatStore } from '@/stores/combatStore';
import { SeclusionConfigService } from '@/services/config/SeclusionConfigService';
import { AutoRunner } from '@/services/auto/AutoRunner';
import { SeclusionEventService } from '@/services/SeclusionEventService';
import type {
  SeclusionConfig,
  SeclusionStartResult,
  SeclusionStopResult,
  SeclusionTickResult,
  CanStartSeclusionResult,
  OfflineRewardResult,
  SeclusionSession,
  SeclusionEvent,
  AttributeGains,
  BreakthroughResult,
  SeclusionResourceSlot,
  ResourceQuality,
} from '@/types/seclusion';
import { getRequiredExpForNextLevel, getCurrentLevelExp } from '@/config/levelExpConfig';
import i18n from '@/locales';

class SeclusionServiceImpl {
  private runner: AutoRunner | null = null;
  private lastTickTime: number = 0;

  /**
   * 检查是否可以开始闭关
   */
  async canStartSeclusion(config: SeclusionConfig): Promise<CanStartSeclusionResult> {
    const combatStore = useCombatStore();
    const seclusionStore = useSeclusionStore();
    const materialsStore = useMaterialsStore();

    // 检查是否正在战斗
    if (combatStore.inCombat) {
      return { canStart: false, reason: '战斗中无法闭关' };
    }

    // 检查是否已在闭关
    if (seclusionStore.isActive) {
      return { canStart: false, reason: '已在闭关中' };
    }

    // 检查资源是否足够
    const missingResources: SeclusionResourceSlot[] = [];
    for (const slot of config.resources) {
      if (!materialsStore.has(slot.itemId, slot.quantity)) {
        const current = materialsStore.getMaterial(slot.itemId);
        missingResources.push({
          itemId: slot.itemId,
          quantity: slot.quantity - (current?.qty || 0),
        });
      }
    }

    if (missingResources.length > 0) {
      return { canStart: false, reason: '资源不足', missingResources };
    }

    return { canStart: true };
  }

  /**
   * 开始闭关
   */
  async startSeclusion(config: SeclusionConfig): Promise<SeclusionStartResult> {
    const checkResult = await this.canStartSeclusion(config);
    if (!checkResult.canStart) {
      return {
        success: false,
        message: checkResult.reason || '无法开始闭关',
      };
    }

    const seclusionStore = useSeclusionStore();
    const materialsStore = useMaterialsStore();
    const logStore = useGameLogStore();

    // 扣除资源
    const consumedResources: SeclusionResourceSlot[] = [];
    for (const slot of config.resources) {
      if (materialsStore.consume(slot.itemId, slot.quantity)) {
        consumedResources.push({ ...slot });
      }
    }

    // 计算效率
    const efficiency = await this.calculateEfficiency(config);

    // 创建会话
    const session = seclusionStore.createSession(
      config.type,
      config.durationMinutes,
      efficiency,
      consumedResources
    );

    // 记录日志
    const typeConfig = await SeclusionConfigService.getSeclusionType(config.type);
    const typeName = typeConfig ? (i18n as any).global.t(typeConfig.name) : config.type;
    logStore.addActionLog(`开始${typeName}，预计${config.durationMinutes}分钟`);

    // 启动自动运行器
    this.startRunner();

    return {
      success: true,
      sessionId: session.id,
      message: `开始${typeName}`,
      consumedResources,
    };
  }

  /**
   * 停止闭关
   */
  async stopSeclusion(): Promise<SeclusionStopResult> {
    const seclusionStore = useSeclusionStore();
    const playerStore = usePlayerStore();
    const logStore = useGameLogStore();

    if (!seclusionStore.isActive) {
      return {
        success: false,
        message: '当前未在闭关',
        partialRewards: { exp: 0, hp: 0, energy: 0, attributes: {} },
        elapsedPercent: 0,
        completedWithoutInterrupt: false,
      };
    }

    // 停止运行器
    this.stopRunner();

    const session = seclusionStore.currentSession;
    const elapsedPercent = seclusionStore.progressPercent;

    // 发放累积奖励
    const exp = seclusionStore.accumulatedExp;
    const hp = seclusionStore.accumulatedHp;
    const energy = seclusionStore.accumulatedEnergy;
    const attributes = seclusionStore.accumulatedAttributes;

    if (exp > 0) {
      playerStore.gainExperience(Math.floor(exp));
    }
    if (hp > 0) {
      playerStore.healHp(Math.floor(hp));
    }
    if (energy > 0) {
      playerStore.healEnergy(Math.floor(energy));
    }
    this.applyAttributeGains(attributes);

    // 结束会话
    seclusionStore.endSession();

    // 记录日志
    const isCompleted = elapsedPercent >= 1;
    if (isCompleted) {
      logStore.addRewardLog(
        `闭关完成！获得修为${Math.floor(exp)}，恢复气血${Math.floor(hp)}，精力${Math.floor(energy)}`
      );
    } else {
      logStore.addActionLog(`闭关中断（${Math.floor(elapsedPercent * 100)}%），获得部分奖励`);
    }

    return {
      success: true,
      message: isCompleted ? '闭关完成' : '闭关中断',
      partialRewards: {
        exp: Math.floor(exp),
        hp: Math.floor(hp),
        energy: Math.floor(energy),
        attributes,
      },
      elapsedPercent,
      completedWithoutInterrupt: isCompleted && (session?.interruptCount || 0) === 0,
    };
  }

  /**
   * 处理单次tick
   */
  async tick(dtSeconds: number): Promise<SeclusionTickResult> {
    const seclusionStore = useSeclusionStore();
    const playerStore = usePlayerStore();

    if (!seclusionStore.isActive || seclusionStore.isPaused) {
      console.log(
        '[SeclusionService] tick 被跳过：未激活或已暂停',
        seclusionStore.isActive,
        seclusionStore.isPaused
      );
      return {
        expGained: 0,
        hpGained: 0,
        energyGained: 0,
        attributeGains: {},
        isCompleted: false,
      };
    }

    // 更新进度
    const deltaMs = dtSeconds * 1000;
    console.log(
      '[SeclusionService] 更新进度, deltaMs:',
      deltaMs,
      'current elapsed:',
      seclusionStore.elapsedMs
    );
    seclusionStore.updateProgress(deltaMs);
    console.log(
      '[SeclusionService] 更新后 elapsed:',
      seclusionStore.elapsedMs,
      'progress:',
      seclusionStore.progressPercent
    );

    // 获取配置
    const params = await SeclusionConfigService.getParameters();
    const typeConfig = await SeclusionConfigService.getSeclusionType(seclusionStore.currentType!);

    if (!typeConfig) {
      return { expGained: 0, hpGained: 0, energyGained: 0, attributeGains: {}, isCompleted: false };
    }

    // 计算收益
    const session = seclusionStore.currentSession!;
    const effectiveEfficiency = session.efficiency * (1 + session.temporaryEfficiencyModifier);

    // 经验计算: base_rate × type_multiplier × resource_efficiency
    const expGained =
      typeConfig.baseExpPerTick *
      typeConfig.primaryBonus.multiplier *
      effectiveEfficiency *
      dtSeconds;

    // 回血/回精力
    const hpGained = params.baseHpRecoveryPerTick * effectiveEfficiency * dtSeconds;
    const energyGained = params.baseEnergyRecoveryPerTick * effectiveEfficiency * dtSeconds;

    // 累积收益
    seclusionStore.addExp(expGained);
    seclusionStore.addHp(hpGained);
    seclusionStore.addEnergy(energyGained);

    // 应用到玩家
    playerStore.healHp(hpGained);
    playerStore.healEnergy(energyGained);

    // 属性收益（炼体类型）
    let attributeGains: AttributeGains = {};
    if (typeConfig.primaryBonus.type === 'attribute' && Math.random() < 0.01 * dtSeconds) {
      attributeGains = { strength: 1, vitality: 1 };
      seclusionStore.addAttributes(attributeGains);
    }

    // 检查事件触发
    let event: SeclusionEvent | undefined = undefined;
    if (Math.random() < params.eventTriggerChance * dtSeconds) {
      const triggeredEvent = await this.triggerRandomEvent();
      if (triggeredEvent) {
        event = triggeredEvent;
      }
    }

    // 检查突破
    let breakthrough: BreakthroughResult | undefined = undefined;
    const totalExp = playerStore.player.stats.totalExp + seclusionStore.accumulatedExp;
    const requiredExp = getRequiredExpForNextLevel(playerStore.player.stats.level);
    if (totalExp >= requiredExp) {
      breakthrough = await this.attemptBreakthrough();
    }

    // 检查是否完成
    const isCompleted = seclusionStore.progressPercent >= 1;
    if (isCompleted) {
      await this.stopSeclusion();
    }

    return {
      expGained,
      hpGained,
      energyGained,
      attributeGains,
      event,
      breakthrough,
      isCompleted,
    };
  }

  /**
   * 计算闭关效率
   * 每个资源槽提供基础加成，数量越多加成越高
   */
  async calculateEfficiency(config: SeclusionConfig): Promise<number> {
    if (config.resources.length === 0) {
      return 1.0; // 基础模式
    }

    let bonusPercent = 0;
    for (const slot of config.resources) {
      if (slot.itemId && slot.quantity > 0) {
        // 每个资源提供 10% 基础加成，数量越多加成越高（递减）
        const baseBonus = 10;
        const quantityBonus = Math.min(slot.quantity, 5) * 2; // 最多5个，每个+2%
        bonusPercent += baseBonus + quantityBonus;
      }
    }

    return 1 + bonusPercent / 100;
  }

  /**
   * 计算离线收益
   */
  async calculateOfflineRewards(session: SeclusionSession): Promise<OfflineRewardResult> {
    const now = Date.now();
    const offlineDurationMs = now - session.startTime - session.elapsedMs;
    const params = await SeclusionConfigService.getParameters();

    // 限制离线时长
    const cappedDurationMs = Math.min(offlineDurationMs, params.offlineMaxDurationMs);
    const remainingDurationMs = Math.min(
      cappedDurationMs,
      session.plannedDurationMs - session.elapsedMs
    );

    if (remainingDurationMs <= 0) {
      return {
        offlineDurationMs,
        cappedDurationMs: 0,
        rewards: { exp: 0, hp: 0, energy: 0, attributes: {} },
        events: [],
        breakthroughs: [],
        message: '闭关已完成',
      };
    }

    // 计算离线收益（效率降低）
    const typeConfig = await SeclusionConfigService.getSeclusionType(session.type);
    if (!typeConfig) {
      return {
        offlineDurationMs,
        cappedDurationMs,
        rewards: { exp: 0, hp: 0, energy: 0, attributes: {} },
        events: [],
        breakthroughs: [],
        message: '配置错误',
      };
    }

    const offlineSeconds = remainingDurationMs / 1000;
    const effectiveEfficiency = session.efficiency * params.offlineEfficiencyMultiplier;

    const exp =
      typeConfig.baseExpPerTick *
      typeConfig.primaryBonus.multiplier *
      effectiveEfficiency *
      offlineSeconds;
    const hp = params.baseHpRecoveryPerTick * effectiveEfficiency * offlineSeconds;
    const energy = params.baseEnergyRecoveryPerTick * effectiveEfficiency * offlineSeconds;

    // 应用上限
    const cappedExp = Math.min(exp, params.offlineRewardCap.exp);
    const cappedHp = Math.min(hp, params.offlineRewardCap.hp);
    const cappedEnergy = Math.min(energy, params.offlineRewardCap.energy);

    return {
      offlineDurationMs,
      cappedDurationMs,
      rewards: {
        exp: Math.floor(cappedExp),
        hp: Math.floor(cappedHp),
        energy: Math.floor(cappedEnergy),
        attributes: {},
      },
      events: [],
      breakthroughs: [],
      message: `离线${Math.floor(cappedDurationMs / 60000)}分钟，获得修为${Math.floor(cappedExp)}，恢复气血${Math.floor(cappedHp)}，精力${Math.floor(cappedEnergy)}`,
    };
  }

  /**
   * 触发随机事件
   */
  private async triggerRandomEvent() {
    return await SeclusionEventService.tryTriggerEvent();
  }

  /**
   * 尝试突破
   */
  private async attemptBreakthrough(): Promise<BreakthroughResult> {
    const seclusionStore = useSeclusionStore();
    const playerStore = usePlayerStore();
    const logStore = useGameLogStore();
    const params = await SeclusionConfigService.getParameters();

    // 计算成功率 v2.0 - 使用固定基础值
    const session = seclusionStore.currentSession!;
    const successChance = 0.3 + (session.efficiency - 1) * 0.1;

    const success = Math.random() < successChance;
    seclusionStore.recordBreakthroughAttempt(success);

    if (success) {
      // 发放累积经验触发升级
      const exp = seclusionStore.accumulatedExp;
      const levelUpResult = playerStore.gainExperience(Math.floor(exp));

      // 清空累积经验（已发放）
      seclusionStore.addExp(-exp);

      if (levelUpResult) {
        logStore.addLevelUpLog(`闭关突破成功！升至${levelUpResult.newLevel}级`);
        return {
          attempted: true,
          success: true,
          newLevel: levelUpResult.newLevel,
          rewards: {
            attackIncrease: levelUpResult.attackIncrease,
            defenseIncrease: levelUpResult.defenseIncrease,
            hpIncrease: levelUpResult.hpIncrease,
          },
        };
      }
    } else {
      // 突破失败，清空累积经验（避免每tick重试）
      const exp = seclusionStore.accumulatedExp;
      seclusionStore.addExp(-exp);

      // 给予少量气血恢复作为安慰
      const consolationHp = 20 + playerStore.player.stats.level * 5;
      const actualHeal = playerStore.healHp(consolationHp);
      if (actualHeal > 0) {
        logStore.addInfoLog(`突破失败，气血恢复${Math.floor(actualHeal)}点`);
      }

      return {
        attempted: true,
        success: false,
      };
    }

    return { attempted: true, success: false };
  }

  /**
   * 应用属性增益
   */
  private applyAttributeGains(gains: AttributeGains): void {
    const playerStore = usePlayerStore();
    const updates: Partial<typeof playerStore.player.stats> = {};

    if (gains.strength) updates.strength = playerStore.player.stats.strength + gains.strength;
    if (gains.agility) updates.agility = playerStore.player.stats.agility + gains.agility;
    if (gains.vitality) updates.vitality = playerStore.player.stats.vitality + gains.vitality;
    if (gains.spirit) updates.spirit = playerStore.player.stats.spirit + gains.spirit;
    if (gains.maxHp) updates.maxHp = playerStore.player.stats.maxHp + gains.maxHp;
    if (gains.maxEnergy) updates.maxEnergy = playerStore.player.stats.maxEnergy + gains.maxEnergy;
    if (gains.attack) updates.attack = playerStore.player.stats.attack + gains.attack;
    if (gains.defense) updates.defense = playerStore.player.stats.defense + gains.defense;

    if (Object.keys(updates).length > 0) {
      playerStore.updateStats(updates);
    }
  }

  /**
   * 获取资源品质
   */
  private async getResourceQuality(itemId: string): Promise<ResourceQuality> {
    // 从consumables配置中获取品质
    try {
      const { configService } = await import('@/services/config/ConfigServiceFactory');
      const { ConfigType } = await import('@/services/config/types');
      const consumables = await configService.loadConfig<any>(ConfigType.CONSUMABLES);
      const item = consumables.items?.[itemId];
      return item?.quality || 'common';
    } catch {
      return 'common';
    }
  }

  /**
   * 启动自动运行器
   */
  startRunner(): void {
    if (this.runner?.isRunning()) return;

    const seclusionStore = useSeclusionStore();
    this.lastTickTime = Date.now();

    console.log('[SeclusionService] 启动 AutoRunner, isActive:', seclusionStore.isActive);

    this.runner = new AutoRunner({
      shouldRun: () => {
        const result = seclusionStore.isActive && !seclusionStore.isPaused;
        console.log(
          '[SeclusionService] shouldRun:',
          result,
          'isActive:',
          seclusionStore.isActive,
          'isPaused:',
          seclusionStore.isPaused
        );
        return result;
      },
      onTick: async ctx => {
        console.log('[SeclusionService] onTick, dtSeconds:', ctx.dtSeconds);
        await this.tick(ctx.dtSeconds);
      },
      onProgress: () => {
        // 进度更新由store的computed属性自动处理
      },
      onStart: () => {
        console.log('[SeclusionService] 闭关开始');
      },
      onStop: () => {
        console.log('[SeclusionService] 闭关停止');
      },
      options: {
        tickMinSeconds: 1,
        tickMaxSeconds: 1,
        tickIntervalMs: 1000,
        progressUpdateIntervalMs: 100,
      },
    });

    this.runner.start();
  }

  /**
   * 停止自动运行器
   */
  stopRunner(): void {
    if (this.runner) {
      this.runner.stop();
      this.runner = null;
    }
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.runner?.isRunning() ?? false;
  }
}

export const seclusionService = new SeclusionServiceImpl();
