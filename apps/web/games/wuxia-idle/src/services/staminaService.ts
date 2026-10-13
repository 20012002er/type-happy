import { configService, ConfigType } from '@/services/config';
import type { StaminaConfigFile, Gauge } from '@/types/stamina';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { tickRegistry } from '@/services/runtime/TickRegistry';
import { PlayerState } from '@/types/player';

export type StaminaConsumeKind = 'combat' | 'explore' | 'lifeJob';

class StaminaService {
  private cfg: StaminaConfigFile | null = null;
  // 累积器：累积小数部分，达到1时恢复整数
  private staminaRegenAccumulator = 0;
  private energyRegenAccumulator = 0;

  private async ensureConfig() {
    if (!this.cfg) {
      this.cfg = await configService.loadConfig<StaminaConfigFile>(ConfigType.STAMINA_CONFIG);
    }
  }

  async initGaugesIfNeeded() {
    await this.ensureConfig();
    const playerStore = usePlayerStore();
    const p = playerStore.player as any;
    if (!p.stamina) {
      p.stamina = { current: this.cfg!.base.staminaMax, max: this.cfg!.base.staminaMax } as Gauge;
    }
    if (!p.satiety) {
      p.satiety = { current: this.cfg!.base.satietyMax, max: this.cfg!.base.satietyMax } as Gauge;
    }
  }

  async consume(kind: StaminaConsumeKind): Promise<{ ok: boolean; reason?: string }> {
    await this.ensureConfig();
    await this.initGaugesIfNeeded();
    const playerStore = usePlayerStore();
    const p = playerStore.player as any;
    const cost = this.cfg!.costs[kind];
    const currentStamina = Math.floor(p.stamina?.current ?? 0);
    if (currentStamina < cost) {
      useGameLogStore().addErrorLog('体力不足');
      return { ok: false, reason: 'not_enough_stamina' };
    }
    p.stamina.current = Math.max(0, currentStamina - cost);
    return { ok: true };
  }

  async tick(seconds: number, context?: { meditating?: boolean }) {
    await this.ensureConfig();
    await this.initGaugesIfNeeded();
    const playerStore = usePlayerStore();
    const p = playerStore.player as any;
    // 如果没有传递 context，检查玩家状态
    const isMeditating = context?.meditating ?? (playerStore.player.state === PlayerState.MEDITATING);

    // 体力恢复：使用累积器确保整数恢复
    const baseStaminaRegenPerSec = (this.cfg!.base.staminaRegenPerMin || 3) / 60; // 默认3点/分钟，更慢
    let staminaRegen = baseStaminaRegenPerSec * seconds;

    const satietyDecayPerSec = this.cfg!.base.satietyDecayPerHour / 3600;
    p.satiety.current = Math.max(0, Math.min(p.satiety.max, p.satiety.current - satietyDecayPerSec * seconds));

    for (const m of this.cfg!.regenModifiers || []) {
      if (m.when === 'satiety<30' && p.satiety.current < 30) staminaRegen *= m.staminaRegenMultiplier;
      if (m.when === 'meditating' && isMeditating) staminaRegen *= m.staminaRegenMultiplier;
    }

    // 累积小数部分
    this.staminaRegenAccumulator += staminaRegen;
    const integerRegen = Math.floor(this.staminaRegenAccumulator);
    this.staminaRegenAccumulator -= integerRegen; // 保留小数部分
    
    const currentStamina = Math.floor(p.stamina.current || 0);
    p.stamina.current = Math.min(p.stamina.max, currentStamina + integerRegen);

    // 内力自动回复：使用累积器确保整数恢复
    const baseEnergyRegenPerSec = (p.stats.energyRegen || 5) / 60; // 默认5点/分钟
    let energyRegen = baseEnergyRegenPerSec * seconds;
    
    // 打坐时内力恢复更快
    if (isMeditating) {
      energyRegen *= 2;
    }
    
    // 累积小数部分
    this.energyRegenAccumulator += energyRegen;
    const integerEnergyRegen = Math.floor(this.energyRegenAccumulator);
    this.energyRegenAccumulator -= integerEnergyRegen; // 保留小数部分
    
    const currentEnergy = Math.floor(p.stats.energy || 0);
    p.stats.energy = Math.min(p.stats.maxEnergy || 0, currentEnergy + integerEnergyRegen);
  }

  /**
   * 获取体力恢复速度（点/分钟）
   */
  getStaminaRegenRate(): number {
    return this.cfg?.base.staminaRegenPerMin || 3;
  }

  /**
   * 获取内力恢复速度（点/分钟）
   */
  getEnergyRegenRate(player: any): number {
    const baseRate = (player.stats.energyRegen || 5);
    return baseRate;
  }
}

export const staminaService = new StaminaService();

// 模块级注册：由统一的 registerAllTickHandlers 调用
export function registerStaminaTickHandler() {
  tickRegistry.register('stamina', async (seconds) => {
    await staminaService.tick(seconds);
  });
}
