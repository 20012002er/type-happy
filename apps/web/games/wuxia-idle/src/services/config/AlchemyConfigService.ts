/**
 * 炼丹配置服务
 * 
 * 负责加载和管理炼丹配方配置
 */
import JSON5 from 'json5';
import type { AlchemyConfig, AlchemyRecipe, AlchemyCategory, AlchemyCategoryDef } from '@/types/alchemy';

// 导入配置文件（使用 ?raw 后缀以字符串形式导入）
import ALCHEMY_RECIPES_RAW from '@/assets/configs/alchemy-recipes.json5?raw';

export class AlchemyConfigService {
  private static recipes: Map<string, AlchemyRecipe> = new Map();
  private static categories: AlchemyCategoryDef[] = [];
  private static initialized = false;

  /**
   * 初始化配置服务
   */
  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const data: AlchemyConfig = JSON5.parse(ALCHEMY_RECIPES_RAW);
      
      // 加载所有配方
      data.recipes.forEach(recipe => {
        this.recipes.set(recipe.id, recipe);
      });

      // 加载分类信息
      this.categories = data.categories;

      this.initialized = true;
      console.log('[AlchemyConfigService] 配置加载成功:', `${this.recipes.size} 个配方`);
    } catch (error) {
      console.error('[AlchemyConfigService] 配置加载失败:', error);
      this.recipes = new Map();
      this.categories = [];
      this.initialized = true;
    }
  }

  /**
   * 获取所有类别
   */
  static getCategories(): AlchemyCategoryDef[] {
    return this.categories;
  }

  /**
   * 获取指定类别的所有配方
   */
  static getRecipesByCategory(category: AlchemyCategory): AlchemyRecipe[] {
    return Array.from(this.recipes.values())
      .filter(recipe => recipe.category === category)
      .sort((a, b) => a.requiredLevel - b.requiredLevel);
  }

  /**
   * 获取指定类别的可用配方（根据等级过滤）
   */
  static getAvailableRecipes(category: AlchemyCategory, playerLevel: number): AlchemyRecipe[] {
    return this.getRecipesByCategory(category).filter(
      recipe => recipe.requiredLevel <= playerLevel
    );
  }

  /**
   * 获取下一个解锁的配方
   */
  static getNextUnlockRecipe(category: AlchemyCategory, playerLevel: number): AlchemyRecipe | null {
    const recipes = this.getRecipesByCategory(category)
      .filter(recipe => recipe.requiredLevel > playerLevel)
      .sort((a, b) => a.requiredLevel - b.requiredLevel);
    return recipes[0] || null;
  }

  /**
   * 根据ID获取配方
   */
  static getRecipeById(recipeId: string): AlchemyRecipe | null {
    return this.recipes.get(recipeId) || null;
  }

  /**
   * 获取所有配方
   */
  static getAllRecipes(): AlchemyRecipe[] {
    return Array.from(this.recipes.values()).sort((a, b) => a.requiredLevel - b.requiredLevel);
  }
}

