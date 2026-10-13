/**
 * 制皮业务逻辑服务
 */
import type { LeatherworkingRecipe } from '@/services/config/LeatherworkingConfigService';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { usePlayerStore } from '@/stores/playerStore';
import { LifeSkillType } from '@/types/lifeSkill';

export interface LeatherworkingCraftResult {
  success: boolean;
  itemId: string;
  itemName: string;
  quantity: number;
  expGained: number;
}

class LeatherworkingService {
  canCraft(recipe: LeatherworkingRecipe): boolean {
    const materialsStore = useMaterialsStore();
    return recipe.ingredients.every(ing => (materialsStore.getMaterial(ing.id)?.quantity || 0) >= ing.quantity);
  }

  calculateSuccessRate(recipe: LeatherworkingRecipe, level: number): number {
    let rate = recipe.baseSuccessRate;
    const diff = level - recipe.requiredLevel;
    if (diff > 0) rate += Math.min(diff * 0.01, 0.1);
    return Math.max(0, Math.min(1, rate));
  }

  async craftRecipe(recipe: LeatherworkingRecipe): Promise<LeatherworkingCraftResult> {
    const materialsStore = useMaterialsStore();
    const lifeSkillStore = useLifeSkillStore();
    const playerStore = usePlayerStore();

    if (!this.canCraft(recipe)) throw new Error('材料不足');

    // 消耗材料
    for (const ing of recipe.ingredients) {
      materialsStore.consume(ing.id, ing.quantity);
    }

    // 成功判定
    const level = lifeSkillStore.getSkillLevel(LifeSkillType.LEATHERWORKING);
    const success = Math.random() < this.calculateSuccessRate(recipe, level);

    // 经验
    lifeSkillStore.addExp(LifeSkillType.LEATHERWORKING, recipe.experience);
    playerStore.gainExperience(Math.floor(recipe.experience * 0.25));

    if (success) {
      materialsStore.add(recipe.result.itemId, recipe.result.quantity, recipe.name);
    }

    return {
      success,
      itemId: recipe.result.itemId,
      itemName: recipe.name,
      quantity: success ? recipe.result.quantity : 0,
      expGained: recipe.experience
    };
  }
}

export const leatherworkingService = new LeatherworkingService();
