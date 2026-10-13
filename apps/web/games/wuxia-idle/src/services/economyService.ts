import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import type { Price } from '@/types/economy';
import { configService, ConfigType } from '@/services/config';
import { useGameEventStore } from '@/stores/gameEventStore';

export interface SpendResult {
  ok: boolean;
  reason?: string;
}

export class EconomyService {
  async addGold(source: string, amount: number) {
    const playerStore = usePlayerStore();
    const logs = useGameLogStore();
    const current = playerStore.player.resources.gold;
    playerStore.updateResources({ gold: current + Math.max(0, Math.floor(amount)) });
    logs.addRewardLog(`获得金币+${Math.max(0, Math.floor(amount))}（${source}）`);
    const gameEventStore = useGameEventStore();
    gameEventStore.onEarnGold(Math.max(0, Math.floor(amount)));
  }

  async spend(price: Price, reason: string): Promise<SpendResult> {
    const playerStore = usePlayerStore();
    const logs = useGameLogStore();
    const goldNeed = Math.max(0, Math.floor(price.gold || 0));
    if (goldNeed > 0 && playerStore.player.resources.gold < goldNeed) {
      logs.addErrorLog('金币不足');
      return { ok: false, reason: 'not_enough_gold' };
    }
    // 物品扣除预留：当前阶段无背包物品系统对接
    if (goldNeed > 0) {
      playerStore.updateResources({ gold: playerStore.player.resources.gold - goldNeed });
      logs.addSystemLog(`已支付金币${goldNeed}（${reason}）`);
    }
    return { ok: true };
  }

  async getStandardPrices() {
    return await configService.loadConfig<any>(ConfigType.ECONOMY);
  }
}

export const economyService = new EconomyService();
