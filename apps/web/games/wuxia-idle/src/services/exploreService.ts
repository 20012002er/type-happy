import { AutoRunner } from '@/services/auto/AutoRunner';
import { useExploreStore } from '@/stores/exploreStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useCombatStore } from '@/stores/combatStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useMapStore } from '@/stores/mapStore';
import { staminaService } from '@/services/staminaService';

class ExploreService {
  private runner: AutoRunner | null = null;

  startAuto() {
    const s = useExploreStore();
    if (this.runner?.isRunning()) return;
    s.state.isAuto = true;
    s.state.isRunning = true;
    this.runner = new AutoRunner({
      shouldRun: async () => s.state.isAuto && !useCombatStore().inCombat,
      onTick: async () => this.tick(),
      onStart: () => useGameLogStore().addActionLog('开始自动闯荡'),
      onStop: () => useGameLogStore().addActionLog('停止自动闯荡'),
      options: { tickMinSeconds: s.state.tickMinSeconds, tickMaxSeconds: s.state.tickMaxSeconds }
    });
    this.runner.start();
  }

  stopAuto() {
    const s = useExploreStore();
    if (this.runner) {
      this.runner.stop();
      this.runner = null;
    }
    s.state.isAuto = false;
    s.state.isRunning = false;
  }

  private async tick() {
    const player = usePlayerStore().player;
    const map = useMapStore();
    const logs = useGameLogStore();
    const loc = map.getCurrentLocationSnapshot();
    if (!loc) return;

    // 体力消耗：探索
    const consume = await staminaService.consume('explore');
    if (!consume.ok) {
      logs.addErrorLog('体力不足，无法继续闯荡');
      this.stopAuto();
      return;
    }

    // 按地点参数给予加成（示例：提升金币收益或遭遇频率）
    const difficulty = loc.idle?.difficulty ?? 1.0;
    const chanceBoost = Math.min(0.2, Math.max(0, (difficulty - 1) * 0.02));

    // 触发遭遇：复用 combatStore.encounter
    const result = await useCombatStore().encounter(player);
    if (result && (result as any).winner === 'enemy') {
      logs.addErrorLog('你被击败了，自动闯荡已暂停，请手动恢复');
      this.stopAuto();
      return;
    }

    if (Math.random() < chanceBoost) {
      logs.addInfoLog('你在闯荡中略有所获。');
    }
  }
}

export const exploreService = new ExploreService();


