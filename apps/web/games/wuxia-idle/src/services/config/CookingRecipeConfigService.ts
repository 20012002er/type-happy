/**
 * 烹饪配方配置服务
 * 负责加载和管理烹饪配方数据
 */

import JSON5 from 'json5';
import type { CookingRecipe } from '@/types/cooking';
import type { ResourceQuality } from '@/types/lifeSkill';

// 导入配置文件（使用 ?raw 后缀以字符串形式导入）
// @ts-ignore
import COOKING_RECIPES_RAW from '@/assets/configs/cooking-recipes.json5?raw';

interface CookingRecipeData {
  id: string;
  name: string;
  description: string;
  quality: ResourceQuality;
  cookingLevel: number;
  cookingTime: number;
  experience: number;
  successRate: number;
  ingredients: Array<{ id: string; quantity: number }>;
  result: { itemId: string; quantity: number };
}

interface CookingConfigData {
  version: string;
  recipes: Record<string, CookingRecipeData>;
  cookedItems: Record<string, any>;
}

class CookingRecipeConfigServiceClass {
  private recipes: Map<string, CookingRecipe> = new Map();
  private recipesByLevel: Map<number, CookingRecipe[]> = new Map();
  private initialized = false;

  /**
   * 初始化配置服务
   */
  static async init(): Promise<void> {
    if (CookingRecipeConfigServiceClass.instance.initialized) {
      return;
    }

    try {
      const data: CookingConfigData = JSON5.parse(COOKING_RECIPES_RAW);
      const recipeMap = new Map<string, CookingRecipe>();
      const levelMap = new Map<number, CookingRecipe[]>();

      // 解析所有配方
      Object.values(data.recipes).forEach(recipe => {
        const fullRecipe: CookingRecipe = {
          ...recipe
        };
        
        recipeMap.set(recipe.id, fullRecipe);

        // 按等级分组
        if (!levelMap.has(recipe.cookingLevel)) {
          levelMap.set(recipe.cookingLevel, []);
        }
        levelMap.get(recipe.cookingLevel)!.push(fullRecipe);
      });

      CookingRecipeConfigServiceClass.instance.recipes = recipeMap;
      CookingRecipeConfigServiceClass.instance.recipesByLevel = levelMap;
      CookingRecipeConfigServiceClass.instance.initialized = true;

      console.log(
        '[CookingRecipeConfigService] 配置加载成功:',
        `共 ${recipeMap.size} 个配方`
      );
    } catch (error) {
      console.error('[CookingRecipeConfigService] 配置加载失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有配方
   */
  static getAllRecipes(): CookingRecipe[] {
    CookingRecipeConfigServiceClass.ensureInitialized();
    return Array.from(CookingRecipeConfigServiceClass.instance.recipes.values());
  }

  /**
   * 根据ID获取配方
   */
  static getRecipeById(id: string): CookingRecipe | undefined {
    CookingRecipeConfigServiceClass.ensureInitialized();
    return CookingRecipeConfigServiceClass.instance.recipes.get(id);
  }

  /**
   * 获取可用配方（等级足够）
   */
  static getAvailableRecipes(cookingLevel: number): CookingRecipe[] {
    CookingRecipeConfigServiceClass.ensureInitialized();
    return Array.from(CookingRecipeConfigServiceClass.instance.recipes.values())
      .filter(recipe => recipe.cookingLevel <= cookingLevel)
      .sort((a, b) => a.cookingLevel - b.cookingLevel);
  }

  /**
   * 获取锁定配方（等级不足）
   */
  static getLockedRecipes(cookingLevel: number): CookingRecipe[] {
    CookingRecipeConfigServiceClass.ensureInitialized();
    return Array.from(CookingRecipeConfigServiceClass.instance.recipes.values())
      .filter(recipe => recipe.cookingLevel > cookingLevel)
      .sort((a, b) => a.cookingLevel - b.cookingLevel);
  }

  /**
   * 获取下一个解锁的配方
   */
  static getNextUnlockRecipe(cookingLevel: number): CookingRecipe | null {
    const locked = CookingRecipeConfigServiceClass.getLockedRecipes(cookingLevel);
    return locked.length > 0 ? locked[0] : null;
  }

  /**
   * 获取品质名称（中文）
   */
  static getQualityName(quality: ResourceQuality): string {
    const qualityNames: Record<ResourceQuality, string> = {
      common: '普通',
      fine: '精良',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说',
      mythic: '神话'
    };
    return qualityNames[quality] || '未知';
  }

  /**
   * 确保已初始化
   */
  private static ensureInitialized(): void {
    if (!CookingRecipeConfigServiceClass.instance.initialized) {
      throw new Error('[CookingRecipeConfigService] 配置未初始化，请先调用 init()');
    }
  }

  // 单例实例
  private static instance = new CookingRecipeConfigServiceClass();
}

export const CookingRecipeConfigService = CookingRecipeConfigServiceClass;

