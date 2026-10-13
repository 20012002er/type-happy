/**
 * 铸造系统配置服务
 * 负责加载和管理铸造配方配置
 */

import type { SmithingRecipe, SmithingCategory, SmithingCategoryInfo } from '@/types/smithing';
import JSON5 from 'json5';
import SMITHING_CONFIG_RAW from '@/assets/configs/smithing-config.json5?raw';

interface SmithingConfigData {
  version: string;
  materials: Record<string, SmithingRecipe>;
  equipment: Record<string, SmithingRecipe>;
  categories: SmithingCategoryInfo[];
}

export class SmithingConfigService {
  private static recipes: Map<string, SmithingRecipe> = new Map();
  private static categories: SmithingCategoryInfo[] = [];
  private static initialized = false;

  /**
   * 初始化配置服务
   */
  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const data: SmithingConfigData = JSON5.parse(SMITHING_CONFIG_RAW);
      
      // 加载材料配方
      Object.values(data.materials).forEach(recipe => {
        this.recipes.set(recipe.id, recipe);
      });

      // 加载装备配方
      Object.values(data.equipment).forEach(recipe => {
        this.recipes.set(recipe.id, recipe);
      });

      // 加载分类信息
      this.categories = data.categories;

      this.initialized = true;
      console.log('[SmithingConfigService] 配置加载成功:', `${this.recipes.size} 个配方`);
    } catch (error) {
      console.error('[SmithingConfigService] 配置加载失败:', error);
      this.recipes = new Map();
      this.categories = [];
      this.initialized = true;
    }
  }

  /**
   * 获取所有配方
   */
  static getAllRecipes(): SmithingRecipe[] {
    return Array.from(this.recipes.values()).sort((a, b) => a.requiredLevel - b.requiredLevel);
  }

  /**
   * 根据ID获取配方
   */
  static getRecipe(recipeId: string): SmithingRecipe | null {
    return this.recipes.get(recipeId) || null;
  }

  /**
   * 获取指定分类的配方
   */
  static getRecipesByCategory(category: SmithingCategory): SmithingRecipe[] {
    return Array.from(this.recipes.values())
      .filter(recipe => recipe.category === category)
      .sort((a, b) => a.requiredLevel - b.requiredLevel);
  }

  /**
   * 获取玩家当前等级可用的配方
   */
  static getAvailableRecipes(category: SmithingCategory, playerLevel: number): SmithingRecipe[] {
    return this.getRecipesByCategory(category).filter(
      recipe => recipe.requiredLevel <= playerLevel
    );
  }

  /**
   * 获取下一级解锁的配方
   */
  static getNextUnlockRecipe(category: SmithingCategory, playerLevel: number): SmithingRecipe | null {
    const recipes = this.getRecipesByCategory(category);
    return recipes.find(recipe => recipe.requiredLevel > playerLevel) || null;
  }

  /**
   * 获取所有分类
   */
  static getCategories(): SmithingCategoryInfo[] {
    return this.categories;
  }

  /**
   * 获取指定分类信息
   */
  static getCategoryInfo(categoryId: SmithingCategory): SmithingCategoryInfo | null {
    return this.categories.find(cat => cat.id === categoryId) || null;
  }
}

