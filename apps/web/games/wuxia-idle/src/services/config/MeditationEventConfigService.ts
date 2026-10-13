import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

export interface MeditationEventAmount {
  min: number;
  max: number;
  scaleByLevel?: boolean;
}

export interface MeditationEventDef {
  id: string;
  type: 'exp' | 'gold' | 'applyEffect' | 'rewardTag';
  amount?: MeditationEventAmount;
  effectId?: string;
  effects?: string[]; // 支持一次应用多个效果
  hpPercent?: number;
  expPercent?: number;
  setCurrentLevelExpTo?: number; // 将当前等级经验设置为该值（例如 1）
  tag?: string;
  weight: number;
  i18nKey?: string;
}

export interface MeditationEventTableConfig {
  version: string;
  /** 全局事件触发概率（0-1），每次结算判定一次 */
  triggerChance?: number;
  events: MeditationEventDef[];
}

export class MeditationEventConfigService {
  static async loadConfig(): Promise<MeditationEventTableConfig> {
    return await configService.loadConfig<MeditationEventTableConfig>(ConfigType.MEDITATION_EVENTS);
  }

  static async getAll(): Promise<MeditationEventDef[]> {
    const cfg = await configService.loadConfig<MeditationEventTableConfig>(ConfigType.MEDITATION_EVENTS);
    return cfg.events;
  }

  static async getTriggerChance(defaultValue = 0.1): Promise<number> {
    const cfg = await this.loadConfig();
    const v = cfg.triggerChance;
    if (typeof v === 'number' && v >= 0 && v <= 1) return v;
    return defaultValue;
  }
}


