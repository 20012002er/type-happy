/**
 * 自动制皮服务
 */
import { AutoRunner } from '@/services/auto/AutoRunner';
import { useLeatherworkingQueueStore } from '@/stores/leatherworkingQueueStore';
import { LeatherworkingConfigService } from '@/services/config/LeatherworkingConfigService';
import { leatherworkingService } from '@/services/leatherworkingService';

class AutoLeatherworkingService {
  private runner: AutoRunner | null = null;

  start(): void {
    if (this.runner?.isRunning()) return;

    this.runner = new AutoRunner({
      shouldRun: async () => useLeatherworkingQueueStore().isWorking,
      onTick: async () => { await this.executeTick(); },
      onProgress: () => { const s = useLeatherworkingQueueStore(); if (s.isWorking) s.updateProgress(); },
      options: { tickMinSeconds: 0.1, tickMaxSeconds: 0.1, tickIntervalMs: 100, progressUpdateIntervalMs: 100, autoPauseOnHidden: false }
    });
    this.runner.start();
  }

  stop(): void { if (this.runner) { this.runner.stop(); this.runner = null; } }
  isRunning(): boolean { return this.runner?.isRunning() || false; }

  private async executeTick() {
    const q = useLeatherworkingQueueStore();
    if (!q.shouldExecute()) return;
    const current = q.current;
    if (!current) return;
    const recipe = LeatherworkingConfigService.getRecipeById(current.recipeId);
    if (!recipe) { q.stop(); this.stop(); return; }
    if (!leatherworkingService.canCraft(recipe)) { q.stop(); this.stop(); return; }

    try {
      const result = await leatherworkingService.craftRecipe(recipe);
      if (result.success) {
        console.log(`[AutoLeatherworking] 成功: ${result.itemName} x${result.quantity} (+${result.expGained}xp)`);
      } else {
        console.log(`[AutoLeatherworking] 失败: ${result.itemName}`);
      }
      q.completeCycle();
      if (!leatherworkingService.canCraft(recipe)) { q.stop(); this.stop(); }
    } catch (e) {
      console.error('[AutoLeatherworking] 错误:', e);
      q.stop(); this.stop();
    }
  }
}

export const autoLeatherworkingService = new AutoLeatherworkingService();
