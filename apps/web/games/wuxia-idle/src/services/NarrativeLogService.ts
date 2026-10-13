/**
 * 叙事日志服务
 * 将结构化事件转换为小说化文案
 */

import type {
  NarrativeLevel,
  CombatEvent,
  DungeonEvent,
  RewardEvent,
  GameEvent,
  NarrativeTemplate,
} from '@/types/narrative';
import { NarrativeTemplateService } from '@/services/config/NarrativeTemplateService';
import { useGameLogStore } from '@/stores/gameLogStore';
import { LogType } from '@/types/gameLog';

const STORAGE_KEY = 'wuxia_narrative_level';

export class NarrativeLogService {
  private level: NarrativeLevel = 'normal';
  private initialized = false;

  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // 从 localStorage 恢复设置
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['off', 'brief', 'normal', 'drama'].includes(saved)) {
      this.level = saved as NarrativeLevel;
    }

    // 预加载模板
    await NarrativeTemplateService.loadTemplates();
    this.initialized = true;
  }

  /**
   * 设置叙事级别
   */
  setLevel(level: NarrativeLevel): void {
    this.level = level;
    localStorage.setItem(STORAGE_KEY, level);
  }

  /**
   * 获取当前叙事级别
   */
  getLevel(): NarrativeLevel {
    return this.level;
  }

  /**
   * 发送事件并渲染日志
   */
  async emit(event: GameEvent): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    // 关闭模式：使用简洁格式
    if (this.level === 'off') {
      this.outputFallbackLog(event);
      return;
    }

    try {
      const template = await this.selectTemplate(event);

      if (!template) {
        this.outputFallbackLog(event);
        return;
      }

      const text = this.getTemplateText(template);
      const rendered = this.renderTemplate(text, event);
      const finalText = await this.replaceSynonyms(rendered);

      this.outputToLog(finalText, this.getLogType(event.type));
    } catch (error) {
      console.warn('[NarrativeLogService] 渲染失败，使用回退:', error);
      this.outputFallbackLog(event);
    }
  }

  /**
   * 选择模板
   */
  private async selectTemplate(event: GameEvent): Promise<NarrativeTemplate | null> {
    const context = this.buildContext(event);
    return NarrativeTemplateService.getRandomTemplate(event.type, context);
  }

  /**
   * 获取对应级别的模板文本
   */
  private getTemplateText(template: NarrativeTemplate): string {
    switch (this.level) {
      case 'brief':
        return template.brief;
      case 'drama':
        return template.drama;
      case 'normal':
      default:
        return template.normal;
    }
  }

  /**
   * 渲染模板，替换变量
   */
  private renderTemplate(template: string, event: GameEvent): string {
    let result = template;

    // 提取所有变量
    const variables = this.extractVariables(event);

    // 替换变量
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}(?:\\|([^}]*))?\\}`, 'g');
      result = result.replace(regex, (_, defaultValue) => {
        if (value !== undefined && value !== null && value !== '') {
          return String(value);
        }
        return defaultValue ?? '';
      });
    }

    // 清理未替换的变量（使用默认值或空字符串）
    result = result.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_, _key, defaultValue) => {
      return defaultValue ?? '';
    });

    return result.trim();
  }

  /**
   * 从事件中提取变量
   */
  private extractVariables(event: GameEvent): Record<string, unknown> {
    const vars: Record<string, unknown> = {
      type: event.type,
    };

    if (this.isCombatEvent(event)) {
      vars.attackerName = event.attackerName;
      vars.defenderName = event.defenderName;
      vars.damage = event.damage;
      vars.isCrit = event.isCrit;
      vars.isDodged = event.isDodged;
      vars.playerHp = event.playerHp;
      vars.defenderHp = event.defenderHp;

      if (event.move) {
        vars.skillName = event.move.name;
        vars.skillEmoji = event.move.emoji;
        vars.moveName = event.move.name;
        vars.emoji = event.move.emoji;
      }

      if (event.context) {
        vars.waveIndex = event.context.waveIndex;
        vars.enemyCount = event.context.enemyCount;
        vars.isLastEnemy = event.context.isLastEnemy;
        vars.isBossWave = event.context.isBossWave;
      }
    } else if (this.isDungeonEvent(event)) {
      vars.dungeonName = event.dungeonName;
      vars.waveIndex = event.waveIndex;
      vars.totalWaves = event.totalWaves;
      vars.waveTitle = event.waveTitle;
      vars.enemyCount = event.enemyCount;

      if (event.rewardPool) {
        vars.gold = event.rewardPool.gold;
        vars.exp = event.rewardPool.exp;
      }
    } else if (this.isRewardEvent(event)) {
      vars.gold = event.gold;
      vars.exp = event.exp;
      vars.source = event.source;

      if (event.items && event.items.length > 0) {
        vars.items = event.items.map(i => `${i.name}×${i.qty}`).join('、');
      }
    }

    return vars;
  }

  /**
   * 替换同义词
   */
  private async replaceSynonyms(text: string): Promise<string> {
    // 简单实现：暂不做同义词替换，保持文案一致性
    // 后续可以根据需要启用
    return text;
  }

  /**
   * 构建模板选择上下文
   */
  private buildContext(event: GameEvent): Record<string, unknown> {
    const context: Record<string, unknown> = {};

    if (this.isCombatEvent(event)) {
      context.isCrit = event.isCrit;
      context.isDodged = event.isDodged;

      if (event.context) {
        context.isLastEnemy = event.context.isLastEnemy;
        context.isBossWave = event.context.isBossWave;
      }

      if (event.defenderHp !== undefined && event.playerHp !== undefined) {
        // 计算 HP 百分比（用于条件匹配）
        context.hpPercent = event.defenderHp;
      }
    } else if (this.isDungeonEvent(event)) {
      context.isBossWave =
        event.type === 'dungeon.wave_start' && event.waveIndex === event.totalWaves;
    }

    return context;
  }

  /**
   * 输出回退日志（简洁格式）
   */
  private outputFallbackLog(event: GameEvent): void {
    const message = this.generateFallbackMessage(event);
    this.outputToLog(message, this.getLogType(event.type));
  }

  /**
   * 生成回退消息
   */
  private generateFallbackMessage(event: GameEvent): string {
    if (this.isCombatEvent(event)) {
      if (event.isDodged) {
        return `${event.defenderName} 闪避成功`;
      }
      const critText = event.isCrit ? '（暴击）' : '';
      return `${event.attackerName} 攻击 ${event.defenderName}，造成 ${event.damage} 伤害${critText}`;
    }

    if (this.isDungeonEvent(event)) {
      switch (event.type) {
        case 'dungeon.enter':
          return `进入【${event.dungeonName}】`;
        case 'dungeon.wave_start':
          return `第 ${event.waveIndex} 波：${event.waveTitle || '敌人来袭'}`;
        case 'dungeon.wave_clear':
          return `第 ${event.waveIndex} 波清除`;
        case 'dungeon.finish':
          return `通关【${event.dungeonName}】！`;
        case 'dungeon.fail':
          return `挑战失败`;
        case 'dungeon.abort':
          return `主动撤退`;
      }
    }

    if (this.isRewardEvent(event)) {
      const parts: string[] = [];
      if (event.gold) parts.push(`${event.gold} 金币`);
      if (event.exp) parts.push(`${event.exp} 经验`);
      return `获得 ${parts.join('，')}`;
    }

    return `[未知事件]`;
  }

  /**
   * 输出到日志 Store
   */
  private outputToLog(message: string, type: LogType): void {
    const logStore = useGameLogStore();

    switch (type) {
      case LogType.COMBAT:
        logStore.addCombatLog(message);
        break;
      case LogType.REWARD:
        logStore.addRewardLog(message);
        break;
      case LogType.SYSTEM:
        logStore.addSystemLog(message);
        break;
      case LogType.STORY:
        logStore.addStoryLog(message);
        break;
      default:
        logStore.addInfoLog(message);
    }
  }

  /**
   * 获取日志类型
   */
  private getLogType(eventType: string): LogType {
    if (eventType.startsWith('combat.')) {
      return LogType.COMBAT;
    }
    if (eventType.startsWith('reward.')) {
      return LogType.REWARD;
    }
    if (eventType.startsWith('dungeon.')) {
      return LogType.SYSTEM;
    }
    if (eventType.startsWith('story.')) {
      return LogType.STORY;
    }
    return LogType.INFO;
  }

  // 类型守卫
  private isCombatEvent(event: GameEvent): event is CombatEvent {
    return event.type.startsWith('combat.');
  }

  private isDungeonEvent(event: GameEvent): event is DungeonEvent {
    return event.type.startsWith('dungeon.');
  }

  private isRewardEvent(event: GameEvent): event is RewardEvent {
    return event.type.startsWith('reward.');
  }
}

export const narrativeLogService = new NarrativeLogService();
