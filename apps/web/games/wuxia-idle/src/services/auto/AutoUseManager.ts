import { useAutoSettingsStore } from '@/stores/autoSettingsStore';
import { usePlayerStore } from '@/stores/playerStore';
import { ConsumableService } from '@/services/consumableService';
import { tickRegistry } from '@/services/runtime/TickRegistry';

class AutoUseManagerImpl {
  private registered = false;

  register() {
    if (this.registered) return;
    tickRegistry.register('auto-use', async () => {
      const as = useAutoSettingsStore();
      if (!as.enabled) return;
      const ps = usePlayerStore();
      const s = ps.player.stats;
      // HP 阈值
      if (as.usePotionId && s.hp / s.maxHp <= (as.hpThresholdPercent || 0)) {
        await ConsumableService.useById(as.usePotionId);
      }
      // 体力阈值
      const p: any = ps.player as any;
      if (p.stamina && as.useFoodId && p.stamina.current <= (as.staminaThreshold || 0)) {
        await ConsumableService.useById(as.useFoodId);
      }
    });
    this.registered = true;
  }
}

export const AutoUseManager = new AutoUseManagerImpl();

