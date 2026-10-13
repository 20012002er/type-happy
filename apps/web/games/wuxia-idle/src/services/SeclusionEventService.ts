/**
 * 闭关事件服务
 * @module services/SeclusionEventService
 */

import { useSeclusionStore } from '@/stores/seclusionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { SeclusionConfigService } from '@/services/config/SeclusionConfigService';
import type {
  SeclusionEvent,
  SeclusionEventDefinition,
  SeclusionEventLog,
  SeclusionEventEffects,
  AttributeGains,
  SeclusionType
} from '@/types/seclusion';
import i18n from '@/locales';

/**
 * 闭关事件服务
 * 负责事件触发、权重计算、效果应用
 */
export class SeclusionEventService {
  /**
   * 尝试触发随机事件
   */
  static async tryTriggerEvent(): Promise<SeclusionEvent | null> {
    const seclusionStore = useSeclusionStore();
    
    if (!seclusionStore.isActive || !seclusionStore.currentSession) {
      return null;
    }

    const session = seclusionStore.currentSession;
    const progressPercent = seclusionStore.progressPercent;

    // 获取符合条件的事件
    const eligibleEvents = await this.getEligibleEvents(session.type, progressPercent);
    if (eligibleEvents.length === 0) {
      return null;
    }

    // 按权重选择事件
    const selectedDef = this.selectEventByWeight(eligibleEvents, session.type);
    if (!selectedDef) {
      return null;
    }

    // 创建事件实例
    const event = this.createEventInstance(selectedDef);

    // 应用事件效果
    await this.applyEventEffects(event, selectedDef);

    // 记录事件日志
    this.logEvent(event, selectedDef);

    return event;
  }

  /**
   * 获取符合条件的事件列表
   */
  private static async getEligibleEvents(
    seclusionType: SeclusionType,
    progressPercent: number
  ): Promise<SeclusionEventDefinition[]> {
    const allEvents = await SeclusionConfigService.getEventDefinitions();

    return allEvents.filter(event => {
      const conditions = event.conditions;
      if (!conditions) return true;

      // 检查进度条件
      if (conditions.minElapsedPercent !== undefined && progressPercent < conditions.minElapsedPercent) {
        return false;
      }
      if (conditions.maxElapsedPercent !== undefined && progressPercent > conditions.maxElapsedPercent) {
        return false;
      }

      // 检查闭关类型条件
      if (conditions.requiredType && conditions.requiredType !== seclusionType) {
        return false;
      }

      return true;
    });
  }

  /**
   * 按权重选择事件
   */
  private static selectEventByWeight(
    events: SeclusionEventDefinition[],
    seclusionType: SeclusionType
  ): SeclusionEventDefinition | null {
    if (events.length === 0) return null;

    // 计算调整后的权重
    const weightedEvents = events.map(event => {
      let weight = event.weight;
      
      // 应用闭关类型的权重修正（从类型配置中获取）
      // 这里简化处理，实际可以从typeConfig.eventWeightModifiers获取
      
      return { event, weight };
    });

    // 计算总权重
    const totalWeight = weightedEvents.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return null;

    // 随机选择
    let random = Math.random() * totalWeight;
    for (const item of weightedEvents) {
      random -= item.weight;
      if (random <= 0) {
        return item.event;
      }
    }

    return weightedEvents[weightedEvents.length - 1].event;
  }

  /**
   * 创建事件实例
   */
  private static createEventInstance(def: SeclusionEventDefinition): SeclusionEvent {
    const message = (i18n as any).global.te(def.i18nKey) 
      ? (i18n as any).global.t(def.i18nKey)
      : def.id;

    return {
      id: def.id,
      type: def.type,
      timestamp: Date.now(),
      effects: def.effects,
      message
    };
  }

  /**
   * 应用事件效果
   */
  private static async applyEventEffects(
    event: SeclusionEvent,
    def: SeclusionEventDefinition
  ): Promise<void> {
    const seclusionStore = useSeclusionStore();
    const playerStore = usePlayerStore();
    const effects = def.effects;

    const appliedEffects: SeclusionEventLog['appliedEffects'] = {};

    // 经验奖励
    if (effects.expBonus) {
      const expAmount = this.calculateBonusAmount(effects.expBonus, playerStore.player.stats.level);
      if (expAmount > 0) {
        seclusionStore.addExp(expAmount);
        appliedEffects.expGained = expAmount;
      } else if (expAmount < 0) {
        // 负面效果：扣除经验
        seclusionStore.addExp(expAmount);
        appliedEffects.expLost = Math.abs(expAmount);
      }
    }

    // 金币奖励
    if (effects.goldBonus) {
      const goldAmount = this.calculateBonusAmount(effects.goldBonus, playerStore.player.stats.level);
      if (goldAmount !== 0) {
        seclusionStore.addGold(goldAmount);
        appliedEffects.goldGained = goldAmount;
      }
    }

    // 属性奖励
    if (effects.attributeBonus) {
      seclusionStore.addAttributes(effects.attributeBonus);
      appliedEffects.attributeGains = effects.attributeBonus;
    }

    // 效率修正
    if (effects.efficiencyModifier) {
      const currentModifier = seclusionStore.currentSession?.temporaryEfficiencyModifier || 0;
      seclusionStore.setTemporaryEfficiencyModifier(currentModifier + effects.efficiencyModifier);
    }

    // HP损失
    if (effects.hpLossPercent && effects.hpLossPercent > 0) {
      const hpLoss = Math.floor(playerStore.player.stats.maxHp * effects.hpLossPercent);
      const newHp = Math.max(1, playerStore.player.stats.hp - hpLoss);
      playerStore.updateStats({ hp: newHp });
      appliedEffects.hpLost = hpLoss;
    }

    // 经验损失（百分比）
    if (effects.expLossPercent && effects.expLossPercent > 0) {
      const currentExp = seclusionStore.accumulatedExp;
      const expLoss = Math.floor(currentExp * effects.expLossPercent);
      if (expLoss > 0) {
        seclusionStore.addExp(-expLoss);
        appliedEffects.expLost = expLoss;
      }
    }

    // 记录到事件历史
    const eventLog: SeclusionEventLog = {
      eventId: event.id,
      type: event.type,
      timestamp: event.timestamp,
      message: event.message,
      appliedEffects
    };
    seclusionStore.addEventLog(eventLog);
  }

  /**
   * 计算奖励数值
   */
  private static calculateBonusAmount(
    bonus: number | { min: number; max: number; scaleByLevel?: boolean },
    playerLevel: number
  ): number {
    if (typeof bonus === 'number') {
      return bonus;
    }

    // 范围随机
    let amount = bonus.min + Math.random() * (bonus.max - bonus.min);
    
    // 等级缩放
    if (bonus.scaleByLevel) {
      amount *= (1 + playerLevel * 0.1);
    }

    return Math.floor(amount);
  }

  /**
   * 记录事件日志
   */
  private static logEvent(event: SeclusionEvent, def: SeclusionEventDefinition): void {
    const logStore = useGameLogStore();

    switch (event.type) {
      case 'positive':
        logStore.addRewardLog(`【闭关奇遇】${event.message}`);
        break;
      case 'negative':
        logStore.addErrorLog(`【闭关意外】${event.message}`);
        break;
      case 'breakthrough':
        logStore.addLevelUpLog(`【突破契机】${event.message}`);
        break;
      case 'neutral':
      default:
        logStore.addInfoLog(`【闭关感悟】${event.message}`);
        break;
    }
  }

  /**
   * 获取事件类型的中文名称
   */
  static getEventTypeName(type: string): string {
    const names: Record<string, string> = {
      positive: '正面事件',
      negative: '负面事件',
      breakthrough: '突破事件',
      neutral: '中性事件'
    };
    return names[type] || type;
  }
}
