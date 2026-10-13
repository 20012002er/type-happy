/**
 * 制皮配置服务
 * 负责加载和管理制皮配方配置
 */
import JSON5 from 'json5';
// @ts-ignore
import LEATHERWORKING_RECIPES_RAW from '@/assets/configs/leatherworking-recipes.json5?raw';

export interface LeatherworkingIngredient { id: string; quantity: number }
export interface LeatherworkingResult { itemId: string; quantity: number }

export interface LeatherworkingRecipe {
  id: string;
  name: string;
  description: string;
  quality: 'common' | 'fine' | 'rare' | 'epic' | 'legendary' | 'mythic';
  requiredLevel: number;
  craftTime: number;
  experience: number;
  baseSuccessRate: number;
  ingredients: LeatherworkingIngredient[];
  result: LeatherworkingResult;
}

interface LeatherworkingConfigData {
  version: string;
  lastUpdated: string;
  description?: string;
  recipes: Record<string, LeatherworkingRecipe>;
}

export class LeatherworkingConfigService {
  private static recipes: Map<string, LeatherworkingRecipe> = new Map();
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const data: LeatherworkingConfigData = JSON5.parse(LEATHERWORKING_RECIPES_RAW);
      this.recipes = new Map(Object.values(data.recipes).map(r => [r.id, r]));
      this.initialized = true;
      console.log('[LeatherworkingConfigService] 配置加载成功:', this.recipes.size);
    } catch (err) {
      console.error('[LeatherworkingConfigService] 配置加载失败:', err);
      this.recipes = new Map();
      this.initialized = true;
    }
  }

  static getAllRecipes(): LeatherworkingRecipe[] {
    return Array.from(this.recipes.values()).sort((a, b) => a.requiredLevel - b.requiredLevel);
  }

  static getRecipeById(id: string): LeatherworkingRecipe | undefined {
    return this.recipes.get(id);
  }

  static getAvailableRecipes(level: number): LeatherworkingRecipe[] {
    return this.getAllRecipes().filter(r => r.requiredLevel <= level);
  }

  static getNextUnlockRecipe(level: number): LeatherworkingRecipe | null {
    return this.getAllRecipes().find(r => r.requiredLevel > level) || null;
  }
}
