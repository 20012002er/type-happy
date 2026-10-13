import type { Item } from '@/types/equipment';
import { usePlayerStore } from '@/stores/playerStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useGameEventStore } from '@/stores/gameEventStore';
import { EquipmentFactory } from './EquipmentFactory';
import { canSynthesizeByInputs, findSynthesisRecipeByInputs } from '@/services/config/SynthesisRecipeConfigService';
import { getBlueprint } from '@/services/config/EquipmentBlueprintService';

export interface SynthesisPreviewResult {
  ok: boolean;
  reason?: string;
  outputBlueprintId?: string;
  expectedBonuses?: Record<string, number>;
  goldCost?: number;
}

export interface SynthesisResult {
  success: boolean;
  message: string;
  newItem?: Item;
}

export class SynthesisService {
  // 预览：不修改任何状态
  static async preview(inputA: Item, inputB: Item): Promise<SynthesisPreviewResult> {
    const player = usePlayerStore();
    const aId = inputA.blueprintId || '';
    const bId = inputB.blueprintId || '';
    const check = await canSynthesizeByInputs(aId, bId, player.player.stats.level, player.player.resources.gold);
    if (!check.ok) return { ok: false, reason: check.reason };
    const recipe = check.recipe!;
    const cost = recipe.conditions?.cost?.gold || 0;
    return {
      ok: true,
      outputBlueprintId: recipe.output,
      expectedBonuses: recipe.effects?.bonuses,
      goldCost: cost
    };
  }

  // 执行：消费两件输入与金币，生成新装备
  static async synthesize(inputA: Item, inputB: Item): Promise<SynthesisResult> {
    const player = usePlayerStore();
    const eq = useEquipmentStore();

    // 校验配方 & 资源
    const aId = inputA.blueprintId || '';
    const bId = inputB.blueprintId || '';
    const recipe = await findSynthesisRecipeByInputs(aId, bId);
    if (!recipe) return { success: false, message: '没有匹配的合成配方' };

    const levelNeed = recipe.conditions?.playerLevel ?? 0;
    if (player.player.stats.level < levelNeed) {
      return { success: false, message: `需要等级≥${levelNeed}` };
    }
    const goldCost = recipe.conditions?.cost?.gold ?? 0;
    if (player.player.resources.gold < goldCost) {
      return { success: false, message: `金币不足，需要${goldCost}` };
    }

    // 校验输出蓝图存在
    const bp = await getBlueprint(recipe.output);
    if (!bp) return { success: false, message: '输出蓝图未定义' };

    // 从背包移除输入道具
    const inv = eq.inventory as unknown as Item[]; // Pinia unwraps refs on store
    const idxA = inv.findIndex((it: Item) => it.id === inputA.id);
    const idxB = inv.findIndex((it: Item) => it.id === inputB.id);
    if (idxA === -1 || idxB === -1) {
      return { success: false, message: '背包中未找到合成材料' };
    }

    // 消耗金币
    player.updateResources({ gold: player.player.resources.gold - goldCost });

    // 移除（注意索引顺序）
    const first = Math.max(idxA, idxB);
    const second = Math.min(idxA, idxB);
    inv.splice(first, 1);
    inv.splice(second, 1);

    // 生成新道具（使用蓝图工厂，保持现有生态一致）
    const newItem = await EquipmentFactory.createFromBlueprint(recipe.output);
    if (!newItem) return { success: false, message: '生成新装备失败' };

    // 应用配方额外加成（简单相加）
    const extra = recipe.effects?.bonuses || {};
    newItem.bonuses = { ...(newItem.bonuses || {}) } as any;
    for (const k of Object.keys(extra)) {
      const v = (extra as any)[k];
      if (typeof v === 'number') {
        (newItem.bonuses as any)[k] = ((newItem.bonuses as any)[k] || 0) + v;
      }
    }

    // 入背包
    inv.push(newItem);

    // 触发游戏事件：合成物品
    const gameEventStore = useGameEventStore();
    gameEventStore.onCraftItem(newItem.blueprintId || newItem.id, newItem.slot || 'item');

    return { success: true, message: '融合成功，获得新装备！', newItem };
  }
}

export const synthesisService = SynthesisService;
