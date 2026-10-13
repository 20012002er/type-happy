import { MeditationEventConfigService, type MeditationEventDef } from './config/MeditationEventConfigService';
import { useMapStore } from '@/stores/mapStore';

export interface RolledMeditationEvent {
  def: MeditationEventDef;
  payload?: {
    exp?: number;
    gold?: number;
    effectId?: string;
    effectIds?: string[];
    hpLoss?: number;
    expLoss?: number;
    setCurrentLevelExpTo?: number;
  };
}

export class MeditationEventService {
  private static cached: MeditationEventDef[] | null = null;

  private static async getEvents(): Promise<MeditationEventDef[]> {
    if (!this.cached) {
      this.cached = await MeditationEventConfigService.getAll();
    }
    return this.cached;
  }

  static async roll(): Promise<RolledMeditationEvent | null> {
    const mapStore = useMapStore();
    const loc = mapStore.currentLocation;
    const events = await this.getEvents();
    if (!events.length) return null;

    // 先做全局触发概率判定（默认10%），失败则不触发事件
    const triggerChance = await MeditationEventConfigService.getTriggerChance(0.1);
    if (Math.random() >= triggerChance) return null;

    // 基础权重
    const weights = new Map<string, number>();
    for (const e of events) weights.set(e.id, e.weight);
    // 地点覆盖
    const override = (loc as any)?.meditationEventWeights || {};
    for (const [k, v] of Object.entries(override)) {
      weights.set(k, Number(v) || 0);
    }

    const pool: { def: MeditationEventDef; w: number }[] = [];
    for (const e of events) {
      const w = Math.max(0, weights.get(e.id) ?? e.weight);
      if (w > 0) pool.push({ def: e, w });
    }
    if (!pool.length) return null;

    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let picked: MeditationEventDef | null = null;
    for (const item of pool) {
      if (r < item.w) { picked = item.def; break; }
      r -= item.w;
    }
    if (!picked) picked = pool[pool.length - 1].def;

    // 构造 payload
    const payload: RolledMeditationEvent['payload'] = {};
    if (picked.type === 'exp' && picked.amount) {
      const level = 1; // 可注入 playerStore.level，如果需要更强一致性
      const base = randInt(picked.amount.min, picked.amount.max);
      payload.exp = picked.amount.scaleByLevel ? base * level : base;
    } else if (picked.type === 'gold' && picked.amount) {
      payload.gold = randInt(picked.amount.min, picked.amount.max);
    } else if (picked.type === 'applyEffect') {
      if (picked.effects && picked.effects.length) {
        payload.effectIds = picked.effects.slice();
      }
      if (picked.effectId) {
        payload.effectId = picked.effectId;
      }
      if (picked.hpPercent) payload.hpLoss = picked.hpPercent;
      if (picked.expPercent) payload.expLoss = picked.expPercent;
      if (typeof picked.setCurrentLevelExpTo === 'number') payload.setCurrentLevelExpTo = picked.setCurrentLevelExpTo;
    }

    return { def: picked, payload };
  }
}

function randInt(min: number, max: number): number {
  const a = Math.floor(min);
  const b = Math.floor(max);
  return a + Math.floor(Math.random() * Math.max(0, b - a + 1));
}


