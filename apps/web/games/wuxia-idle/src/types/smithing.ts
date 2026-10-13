/**
 * 铸造系统类型定义
 */

/**
 * 铸造配方（包括材料和装备）
 */
export interface SmithingRecipe {
  id: string;
  name: string;
  description: string;
  category: SmithingCategory;  // materials | weapon | helmet | armor | shield | boots
  slot?: string;  // 装备部位（仅装备有效）
  quality: string;
  requiredLevel: number;
  craftTime: number;  // 毫秒
  experience: number;
  baseSuccessRate: number;
  ingredients: SmithingIngredient[];
  result: SmithingResult;
}

/**
 * 铸造材料需求
 */
export interface SmithingIngredient {
  id: string;
  quantity: number;
}

/**
 * 铸造结果
 */
export interface SmithingResult {
  itemId: string;
  quantity: number;
  stats?: {
    attack?: number;
    defense?: number;
  };
}

/**
 * 铸造分类
 */
export type SmithingCategory = 
  | 'materials'  // 材料铸造
  | 'weapon'     // 武器
  | 'helmet'     // 头盔
  | 'armor'      // 护甲
  | 'shield'     // 盾牌
  | 'boots';     // 靴子

/**
 * 分类信息
 */
export interface SmithingCategoryInfo {
  id: SmithingCategory;
  name: string;
  icon: string;
  description: string;
}

/**
 * 铸造队列项
 */
export interface SmithingQueueItem {
  recipeId: string;
  recipeName: string;
  startTime: number;
  craftTime: number;
  currentCycle: number;  // 当前循环次数
}

/**
 * 铸造结果
 */
export interface SmithingCraftResult {
  success: boolean;
  itemId: string;
  itemName: string;
  quantity: number;
  expGained: number;
}

/**
 * 玩家铸造数据（用于存档）
 */
export interface PlayerSmithingData {
  // 可以扩展记录铸造次数、解锁配方等
  totalCrafts: number;
  unlockedRecipes: string[];
}

