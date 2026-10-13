/**
 * 烹饪服务
 * 处理烹饪逻辑、材料检查、烹饪结果计算等
 */

import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useGameEventStore } from '@/stores/gameEventStore';
import { usePlayerStore } from '@/stores/playerStore';
import { CookingRecipeConfigService } from './config/CookingRecipeConfigService';
import type { CookingRecipe, CookingAttemptResult } from '@/types/cooking';
import { LifeSkillType } from '@/types/lifeSkill';

class CookingServiceClass {
  /**
   * 检查是否有足够的材料烹饪
   */
  canCook(recipe: CookingRecipe): boolean {
    const materialsStore = useMaterialsStore();
    
    for (const ingredient of recipe.ingredients) {
      const materialStack = materialsStore.getMaterial(ingredient.id);
      if (!materialStack || materialStack.quantity < ingredient.quantity) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 获取缺少的材料列表
   */
  getMissingIngredients(recipe: CookingRecipe): Array<{ id: string; needed: number; has: number }> {
    const materialsStore = useMaterialsStore();
    const missing: Array<{ id: string; needed: number; has: number }> = [];
    
    for (const ingredient of recipe.ingredients) {
      const materialStack = materialsStore.getMaterial(ingredient.id);
      if (!materialStack || materialStack.quantity < ingredient.quantity) {
        missing.push({
          id: ingredient.id,
          needed: ingredient.quantity,
          has: materialStack ? materialStack.quantity : 0
        });
      }
    }
    
    return missing;
  }

  /**
   * 消耗材料
   */
  consumeIngredients(recipe: CookingRecipe): boolean {
    const materialsStore = useMaterialsStore();
    
    for (const ingredient of recipe.ingredients) {
      const success = materialsStore.consume(ingredient.id, ingredient.quantity);
      if (!success) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 计算烹饪成功率
   */
  calculateSuccessRate(recipe: CookingRecipe, cookingLevel: number): number {
    const baseRate = recipe.baseSuccessRate ?? 0.5;
    const levelBonus = Math.min(0.3, cookingLevel * 0.02);
    const luckBonus = Math.min(0.2, cookingLevel * 0.01);
    return Math.min(0.95, Math.max(0.1, baseRate + levelBonus + luckBonus));
  }

  /**
   * 获取品质名称
   */
  getQualityName(quality: string): string {
    return CookingRecipeConfigService.getQualityName(quality as any);
  }

  /**
   * 执行一次烹饪尝试
   */
  attemptCooking(recipe: CookingRecipe): CookingAttemptResult {
    const lifeSkillStore = useLifeSkillStore();
    const materialsStore = useMaterialsStore();
    const gameLogStore = useGameLogStore();
    const playerStore = usePlayerStore();
    const gameEventStore = useGameEventStore();
    
    const skillProgress = lifeSkillStore.getSkillProgress(LifeSkillType.COOKING);
    
    // 检查等级
    if (skillProgress.level < recipe.cookingLevel) {
      return {
        success: false,
        recipeId: recipe.id,
        recipeName: recipe.name,
        experience: 0,
        message: `烹饪等级不足！需要 Lv.${recipe.cookingLevel}`
      };
    }
    
    // 检查材料
    if (!this.canCook(recipe)) {
      const missing = this.getMissingIngredients(recipe);
      const missingText = missing.map(m => `${m.id} (${m.has}/${m.needed})`).join(', ');
      return {
        success: false,
        recipeId: recipe.id,
        recipeName: recipe.name,
        experience: 0,
        message: `材料不足：${missingText}`
      };
    }
    
    // 消耗材料
    if (!this.consumeIngredients(recipe)) {
      return {
        success: false,
        recipeId: recipe.id,
        recipeName: recipe.name,
        experience: 0,
        message: '消耗材料失败'
      };
    }
    
    // 计算成功率
    const successRate = this.calculateSuccessRate(recipe, skillProgress.level);
    const isSuccess = Math.random() < successRate;
    
    // 增加技能经验
    const expGained = isSuccess ? recipe.experience : Math.floor(recipe.experience * 0.3);
    const levelUpResult = lifeSkillStore.addExp(LifeSkillType.COOKING, expGained);
    
    // 增加角色经验（30%的技能经验）
    const playerExpGained = Math.floor(expGained * 0.3);
    const playerLevelUpResult = playerStore.gainExperience(playerExpGained);
    
    if (isSuccess) {
      // 成功：添加料理到背包（带上名称，避免在库存中显示ID）
      materialsStore.addMaterial(recipe.result.itemId, recipe.result.quantity, recipe.name);
      gameEventStore.onCraftItem(recipe.id, 'cooking');
      
      gameLogStore.addSystemLog(
        `烹饪成功！制作了 ${recipe.name} x${recipe.result.quantity}，获得 ${expGained} 烹饪经验`
      );

    } else {
      gameLogStore.addSystemLog(
        `烹饪失败！制作了 ${recipe.name} x${recipe.result.quantity}，获得 ${expGained} 烹饪经验`
      );
    }
    
    return {
      success: isSuccess,
      recipeId: recipe.id,
      recipeName: recipe.name,
      experience: expGained,
      message: isSuccess ? '烹饪成功！' : '烹饪失败！'
    };
  }
}

export const cookingService = new CookingServiceClass();
export const CookingService = cookingService;