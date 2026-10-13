import { configService, ConfigType } from '@/services/config';
import type { Item } from '@/types/equipment';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { usePlayerStore } from '@/stores/playerStore';
import { economyService } from '@/services/economyService';
import { useMaterialsStore } from '@/stores/materialsStore';

interface ReforgeRulesFile {
  version: string;
  lastUpdated: string;
  rules: Record<string, { maxAffixes: number; pools: string[] }>;
  cost: { gold: { base: number; perAffix: number }, materials: { id: string; name?: string; qty: number }[], hpLoss: number };
  failureRate?: number;
  weights?: Record<string, number>;
}

interface AffixEntry { name: string; bonuses?: any; extra?: any }

export class ReforgeService {
  private static rules: ReforgeRulesFile | null = null;
  private static affixes: Record<string, AffixEntry> | null = null;

  private static async ensureLoaded() {
    if (!this.rules) this.rules = await configService.loadConfig<ReforgeRulesFile>(ConfigType.REFORGE_RULES);
    if (!this.affixes) {
      const a = await configService.loadConfig<any>(ConfigType.AFFIXES);
      this.affixes = a.affixes || {};
    }
  }

  private static weightedPick(ids: string[], weights?: Record<string, number>) {
    if (!weights) return ids[Math.floor(Math.random() * ids.length)];
    let sum = 0;
    for (const id of ids) sum += (weights[id] ?? 1);
    let r = Math.random() * sum;
    for (const id of ids) {
      r -= (weights[id] ?? 1);
      if (r <= 0) return id;
    }
    return ids[ids.length - 1];
  }

  static async reforge(itemId: string) {
    await this.ensureLoaded();
    const es = useEquipmentStore();
    const logs = useGameLogStore();
    const ps = usePlayerStore();
    const ms = useMaterialsStore();

    const it = es.inventory.find(x => x.id === itemId);
    if (!it || !it.slot) {
      logs.addErrorLog('无法洗炼：物品不存在或非装备');
      return { ok: false, reason: 'invalid_item' } as const;
    }

    const rule = this.rules!.rules[it.slot];
    if (!rule) {
      logs.addErrorLog('无法洗炼：无对应部位规则');
      return { ok: false, reason: 'no_rule' } as const;
    }

    // 成本计算
    const currentAffixCount = (it.affixes?.length || 0);
    const priceGold = (this.rules!.cost.gold.base || 0) + currentAffixCount * (this.rules!.cost.gold.perAffix || 0);

    // 检查材料
    for (const m of this.rules!.cost.materials) {
      if (!ms.has(m.id, m.qty)) {
        logs.addErrorLog(`材料不足：${m.name || m.id} x${m.qty}`);
        return { ok: false, reason: 'not_enough_materials' } as const;
      }
    }

    // 扣金币
    const pay = await economyService.spend({ gold: priceGold }, '装备洗炼');
    if (!pay.ok) return { ok: false, reason: 'not_enough_gold' } as const;

    // 扣材料
    for (const m of this.rules!.cost.materials) ms.consume(m.id, m.qty);

    // 扣生命
    const hpLoss = Math.max(0, this.rules!.cost.hpLoss || 0);
    if (hpLoss > 0) ps.updateStats({ hp: Math.max(1, ps.player.stats.hp - hpLoss) });

    // 文案：开场
    logs.addSystemLog('铁匠铺里，炉火昏黄。铁匠把剑往砧上一放，低声道：');
    logs.addSystemLog('“要改纹，得三样东西——一瓢寒水，一截乌炭，一滴你的血，只此而已。”');

    // 失败判定
    const failRate = Math.max(0, Math.min(1, this.rules!.failureRate ?? 0));
    const failed = Math.random() < failRate;
    if (failed) {
      logs.addCombatLog('火光骤然一颤，铁匠沉吟道：“剑不答应。今日不成。”');
      return { ok: false, reason: 'failed' } as const;
    }

    // 抽取新“篆纹”
    const newAffixIds: string[] = [];
    const pools = rule.pools.slice();
    const max = rule.maxAffixes;
    for (let i = 0; i < max; i++) {
      const pick = this.weightedPick(pools, this.rules!.weights);
      if (pick) newAffixIds.push(pick);
    }

    // 重新构建 bonuses
    const mergedBonuses: any = {};
    for (const af of newAffixIds) {
      const entry = this.affixes![af];
      if (entry?.bonuses) {
        for (const k of Object.keys(entry.bonuses)) {
          mergedBonuses[k] = (mergedBonuses[k] || 0) + (entry.bonuses[k] || 0);
        }
      }
    }

    it.affixes = newAffixIds.map(a => this.affixes![a]?.name || a);
    it.bonuses = mergedBonuses;

    // 文案：成功
    logs.addCombatLog('剑出炉，寒光一闪，篆纹若隐若现。铁匠淡淡道：“成不成，看剑肯不肯答应。今日，算它点头了。”');
    logs.addRewardLog(`新篆纹：${it.affixes.join('、')}`);
    return { ok: true, item: it } as const;
  }
}
