/**
 * 铸造业务逻辑服务
 * 负责处理铸造配方的验证、执行和结果计算
 */

import type { SmithingRecipe, SmithingCraftResult } from '@/types/smithing';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { usePlayerStore } from '@/stores/playerStore';
import { LifeSkillType } from '@/types/lifeSkill';
import { SmithingConfigService } from '@/services/config/SmithingConfigService';
import { LifeSkillConfigService } from '@/services/config/LifeSkillConfigService';

class SmithingService {
  /**
   * 检查是否可以铸造
   * @param recipe 铸造配方
   * @returns 是否材料充足
   */
  canCraft(recipe: SmithingRecipe): boolean {
    const materialsStore = useMaterialsStore();
    
    // 检查所有材料是否足够
    return recipe.ingredients.every(ingredient => {
      const material = materialsStore.getMaterial(ingredient.id);
      return (material?.quantity || 0) >= ingredient.quantity;
    });
  }

  /**
   * 计算成功率
   * @param recipe 铸造配方
   * @param playerLevel 玩家铸造等级
   * @returns 最终成功率 (0-1)
   */
  calculateSuccessRate(recipe: SmithingRecipe, playerLevel: number): number {
    // 基础成功率
    let successRate = recipe.baseSuccessRate;
    
    // 等级加成：每高出需求等级1级，成功率+1%，最多+10%
    const levelDiff = playerLevel - recipe.requiredLevel;
    if (levelDiff > 0) {
      successRate += Math.min(levelDiff * 0.01, 0.10);
    }
    
    // 确保成功率在 0-1 之间
    return Math.max(0, Math.min(1, successRate));
  }

  /**
   * 执行铸造
   * @param recipe 铸造配方
   * @returns 铸造结果（包含成功状态、产物、经验等）
   */
  async craftRecipe(recipe: SmithingRecipe): Promise<SmithingCraftResult> {
    const materialsStore = useMaterialsStore();
    const equipmentStore = useEquipmentStore();
    const lifeSkillStore = useLifeSkillStore();
    const playerStore = usePlayerStore();
    
    // 1. 检查材料是否充足
    if (!this.canCraft(recipe)) {
      throw new Error('材料不足');
    }
    
    // 2. 消耗材料
    for (const ingredient of recipe.ingredients) {
      materialsStore.consume(ingredient.id, ingredient.quantity);
    }
    
    // 3. 计算成功率并判定是否成功
    const smithingLevel = lifeSkillStore.getSkillLevel(LifeSkillType.SMITHING);
    const successRate = this.calculateSuccessRate(recipe, smithingLevel);
    const isSuccess = Math.random() < successRate;
    
    // 4. 无论成功失败都获得经验
    lifeSkillStore.addExp(LifeSkillType.SMITHING, recipe.experience);
    
    // 5. 角色也获得经验（30%权重）
    const characterExp = Math.floor(recipe.experience * 0.3);
    playerStore.gainExperience(characterExp);
    
    // 6. 构造返回结果
    const result: SmithingCraftResult = {
      success: isSuccess,
      itemId: recipe.result.itemId,
      itemName: recipe.name,
      quantity: isSuccess ? recipe.result.quantity : 0,
      expGained: recipe.experience
    };
    
    // 7. 成功则添加物品到背包
    if (isSuccess) {
      // 获取产物的显示名称
      const resultItemName = this.getResultItemName(recipe);
      
      if (recipe.category === 'materials') {
        // 材料铸造：添加到材料栏（例如：铁锭、木质手柄等中间材料）
        materialsStore.add(recipe.result.itemId, recipe.result.quantity, resultItemName);
      } else {
        // 装备铸造：生成装备实例并添加到装备栏
        for (let i = 0; i < recipe.result.quantity; i++) {
          await equipmentStore.addItemById(recipe.result.itemId);
        }
      }
    }
    
    return result;
  }

  /**
   * 获取产物的显示名称
   * 优先使用配方名称，如果产物是生活技能资源则从配置中获取
   * @param recipe 铸造配方
   * @returns 产物显示名称
   */
  private getResultItemName(recipe: SmithingRecipe): string {
    // 如果产物ID在生活技能资源配置中，使用资源名称
    const resourceName = LifeSkillConfigService.getResourceName(recipe.result.itemId);
    if (resourceName && resourceName !== recipe.result.itemId) {
      return resourceName;
    }
    
    // 否则使用配方名称
    return recipe.name;
  }

  /**
   * 获取品质名称
   */
  getQualityName(quality: string): string {
    const qualityMap: Record<string, string> = {
      common: '普通',
      fine: '精良',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说',
      mythic: '神话'
    };
    return qualityMap[quality] || quality;
  }
}

// 导出单例
export const smithingService = new SmithingService();

