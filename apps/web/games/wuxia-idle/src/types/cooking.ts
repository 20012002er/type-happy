/**
 * 烹饪系统类型定义
 */

import type { ResourceQuality } from './lifeSkill';

/**
 * 烹饪食材
 */
export interface CookingIngredient {
  id: string;           // 材料ID（对应materials中的ID）
  quantity: number;     // 所需数量
}

/**
 * 烹饪产出
 */
export interface CookingResult {
  itemId: string;       // 产出物品ID
  quantity: number;     // 产出数量
}

/**
 * 烹饪配方
 */
export interface CookingRecipe {
  id: string;                    // 配方ID
  name: string;                  // 配方名称
  description: string;           // 配方描述
  quality: ResourceQuality;      // 料理品质
  cookingLevel: number;          // 所需烹饪等级
  cookingTime: number;           // 烹饪时间（毫秒）
  experience: number;            // 烹饪成功后获得的经验
  successRate: number;           // 基础成功率（0-1）
  ingredients: CookingIngredient[]; // 所需食材
  result: CookingResult;         // 产出结果
}

/**
 * 烹饪进度状态
 */
export interface CookingProgress {
  recipeId: string;              // 正在烹饪的配方ID
  recipeName: string;            // 配方名称
  startTime: number;             // 开始时间戳
  duration: number;              // 烹饪时长（毫秒）
  currentCycle: number;          // 当前循环次数
}

/**
 * 烹饪结果
 */
export interface CookingAttemptResult {
  success: boolean;              // 是否成功
  recipeId: string;              // 配方ID
  recipeName: string;            // 配方名称
  experience: number;            // 获得的经验
  itemId?: string;               // 产出物品ID
  itemName?: string;             // 产出物品名称
  quantity?: number;             // 产出数量
  message: string;               // 结果消息
  levelUp?: boolean;             // 是否升级
  newLevel?: number;             // 新等级
}

