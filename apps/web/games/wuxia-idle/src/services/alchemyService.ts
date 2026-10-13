/**
 * 炼丹服务
 *
 * 负责炼丹的核心业务逻辑：
 * - 材料检查和消耗
 * - 炼丹进度管理
 * - 经验计算和奖励发放
 */
import { useLifeSkillStore } from '@/stores/lifeSkillStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useMaterialsStore } from '@/stores/materialsStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { AlchemyConfigService } from '@/services/config/AlchemyConfigService';
import { LifeSkillType } from '@/types/lifeSkill';
import type { AlchemyRecipe, AlchemyTask } from '@/types/alchemy';
import { useGameEventStore } from '@/stores/gameEventStore';

class AlchemyServiceImpl {
  /**
   * 检查是否可以开始炼丹
   *
   * @param recipeId 配方ID
   * @returns 可以炼丹返回true，否则返回失败原因
   */
  canStartAlchemy(recipeId: string): { canStart: boolean; reason?: string } {
    const recipe = AlchemyConfigService.getRecipeById(recipeId);
    if (!recipe) {
      return { canStart: false, reason: '配方不存在' };
    }

    const lifeSkillStore = useLifeSkillStore();
    const alchemyLevel = lifeSkillStore.getSkillProgress(LifeSkillType.ALCHEMY).level;

    // 检查等级要求
    if (alchemyLevel < recipe.requiredLevel) {
      return {
        canStart: false,
        reason: `需要炼丹等级 ${recipe.requiredLevel}，当前 ${alchemyLevel}`,
      };
    }

    // 检查材料
    const materialsCheck = this.checkMaterials(recipe);
    if (!materialsCheck.hasEnough) {
      return {
        canStart: false,
        reason: '材料不足',
      };
    }

    return { canStart: true };
  }

  /**
   * 检查材料是否充足
   */
  checkMaterials(recipe: AlchemyRecipe): { hasEnough: boolean; missing?: string[] } {
    const materialsStore = useMaterialsStore();
    const missing: string[] = [];

    for (const ingredient of recipe.ingredients) {
      const material = materialsStore.getMaterial(ingredient.materialId);
      const owned = material?.quantity || 0;
      if (owned < ingredient.amount) {
        missing.push(`${ingredient.materialId} (需要 ${ingredient.amount}, 拥有 ${owned})`);
      }
    }

    return {
      hasEnough: missing.length === 0,
      missing: missing.length > 0 ? missing : undefined,
    };
  }

  /**
   * 开始炼丹
   *
   * @param recipeId 配方ID
   * @returns 炼丹任务
   */
  startAlchemy(recipeId: string): AlchemyTask | null {
    const recipe = AlchemyConfigService.getRecipeById(recipeId);
    if (!recipe) {
      console.error(`[AlchemyService] 配方不存在: ${recipeId}`);
      return null;
    }

    // 检查是否可以开始
    const check = this.canStartAlchemy(recipeId);
    if (!check.canStart) {
      const gameLogStore = useGameLogStore();
      gameLogStore.addErrorLog(`无法炼制${recipe.name}: ${check.reason}`);
      return null;
    }

    // 消耗材料
    this.consumeMaterials(recipe);

    // 创建炼丹任务
    const task: AlchemyTask = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      startTime: Date.now(),
      craftTime: recipe.craftTime,
      currentCycle: 1,
    };

    const gameLogStore = useGameLogStore();
    gameLogStore.addActionLog(`开始炼制${recipe.name}`);

    return task;
  }

  /**
   * 消耗材料
   */
  private consumeMaterials(recipe: AlchemyRecipe) {
    const materialsStore = useMaterialsStore();

    for (const ingredient of recipe.ingredients) {
      materialsStore.consume(ingredient.materialId, ingredient.amount);
    }
  }

  /**
   * 完成炼丹
   *
   * @param recipeId 配方ID
   */
  completeAlchemy(recipeId: string) {
    const recipe = AlchemyConfigService.getRecipeById(recipeId);
    if (!recipe) {
      console.error(`[AlchemyService] 配方不存在: ${recipeId}`);
      return;
    }

    const lifeSkillStore = useLifeSkillStore();
    const playerStore = usePlayerStore();
    const gameLogStore = useGameLogStore();

    // 增加经验
    const expResult = lifeSkillStore.addExp(LifeSkillType.ALCHEMY, recipe.experience);

    // 角色获得经验（30% 权重）
    const characterExp = Math.floor(recipe.experience * 0.3);
    const playerLevelUpResult = characterExp > 0 ? playerStore.gainExperience(characterExp) : null;

    // 产出丹药（添加到材料仓库）
    const materialsStore = useMaterialsStore();
    materialsStore.add(recipe.id, 1, recipe.name);

    // 成就：记录炼丹次数
    const gameEventStore = useGameEventStore();
    gameEventStore.onCraftItem(recipe.id, 'alchemy');

    // 记录日志
    if (expResult.levelUp) {
      const message = `炼制${recipe.name}成功！炼丹等级提升至 ${expResult.newLevel}！（+${recipe.experience} 经验）`;
      gameLogStore.addLevelUpLog(message);
      console.log(`[AlchemyService] ${message}`);
    } else {
      const message = `炼制${recipe.name}成功！获得经验 ${recipe.experience}`;
      gameLogStore.addRewardLog(message);
      console.log(`[AlchemyService] ${message}`);
    }

    if (playerLevelUpResult) {
      gameLogStore.addRewardLog(`✨ 角色升级！达到 Lv.${playerLevelUpResult.newLevel}`);
    } else if (characterExp > 0) {
      gameLogStore.addRewardLog(`角色经验 +${characterExp}`);
    }
  }

  /**
   * 停止炼丹（不退还材料）
   */
  stopAlchemy(recipeId: string) {
    const recipe = AlchemyConfigService.getRecipeById(recipeId);
    if (!recipe) return;

    const gameLogStore = useGameLogStore();
    gameLogStore.addInfoLog(`中止炼制${recipe.name}`);
  }
}

export const alchemyService = new AlchemyServiceImpl();
