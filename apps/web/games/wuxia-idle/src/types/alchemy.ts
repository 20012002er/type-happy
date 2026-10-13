/**
 * 炼丹系统类型定义
 * 
 * 炼丹系统功能：
 * - 使用基础采集材料炼制各种丹药
 * - 丹药可提供回复、增益、减益等效果
 * - 支持不同品质和类别的丹药
 */

/**
 * 丹药类别
 */
export type AlchemyCategory = 
  | 'healing'      // 回血丹药
  | 'stamina'      // 回体丹药
  | 'buff'         // 增益丹药
  | 'special';     // 特殊丹药（包含有趣的debuff）

/**
 * 丹药品质
 */
export type AlchemyQuality = 
  | 'common'       // 普通
  | 'fine'         // 精良
  | 'rare'         // 稀有
  | 'epic'         // 史诗
  | 'legendary'    // 传说
  | 'mythic';      // 神话

/**
 * 炼丹材料需求
 */
export interface AlchemyIngredient {
  materialId: string;  // 材料ID（来自life-skills.json5的资源ID）
  amount: number;      // 所需数量
}

/**
 * 丹药效果
 */
export interface AlchemyEffect {
  type: string;        // 效果类型（如 restoreHp, buffAttack, debuffSpeed）
  value?: number;      // 效果值
  duration?: number;   // 持续时间（秒），仅buff/debuff有效
  description?: string; // 效果描述
}

/**
 * 炼丹配方
 */
export interface AlchemyRecipe {
  id: string;                    // 配方ID
  name: string;                  // 丹药名称
  description: string;           // 丹药描述
  category: AlchemyCategory;     // 丹药类别
  quality: AlchemyQuality;       // 丹药品质
  requiredLevel: number;         // 所需炼丹等级
  craftTime: number;             // 炼制时间（毫秒）
  experience: number;            // 炼制成功获得经验
  ingredients: AlchemyIngredient[]; // 所需材料
  effects: AlchemyEffect[];      // 丹药效果
  resultItemId?: string;         // 产出物品ID（用于消耗品系统）
  icon?: string;                 // 丹药图标emoji
}

/**
 * 丹药类别配置
 */
export interface AlchemyCategoryDef {
  id: AlchemyCategory;
  name: string;
  icon: string;
  description: string;
}

/**
 * 炼丹配置表
 */
export interface AlchemyConfig {
  version: string;
  categories: AlchemyCategoryDef[];
  recipes: AlchemyRecipe[];
}

/**
 * 炼丹队列任务
 */
export interface AlchemyTask {
  recipeId: string;              // 配方ID
  recipeName: string;            // 配方名称
  startTime: number;             // 开始时间（毫秒时间戳）
  craftTime: number;             // 炼制时间（毫秒）
  currentCycle: number;          // 当前循环次数（用于连续炼制）
}

