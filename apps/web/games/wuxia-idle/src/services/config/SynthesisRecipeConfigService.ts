import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

/**
 * 合成条件定义
 * - playerLevel: 玩家等级门槛
 * - cost.gold: 金币消耗
 */
export interface SynthesisRecipeConditions {
  playerLevel?: number;
  cost?: { gold?: number };
}

/**
 * 合成附加效果
 * - inherit: 预留字段（未来可做继承策略）
 * - bonuses: 对输出装备的额外属性加成（简单相加）
 */
export interface SynthesisRecipeEffects {
  /** 预留：未来可实现属性继承策略 */
  inherit?: string[];
  /** 简单的数值加成，如 { attack: 5, defense: 2 } */
  bonuses?: Record<string, number>;
}

/**
 * 合成配方
 * - inputs: 两个蓝图ID，顺序无关
 * - output: 输出蓝图ID
 * - conditions/effects: 条件与效果
 */
export interface SynthesisRecipe {
  id: string;
  inputs: [string, string]; // 两个蓝图ID（顺序无关）
  output: string; // 输出蓝图ID
  conditions?: SynthesisRecipeConditions;
  effects?: SynthesisRecipeEffects;
  description?: string;
}

/**
 * 合成配方配置文件结构
 */
export interface SynthesisRecipesFile {
  version: string;
  lastUpdated: string;
  recipes: SynthesisRecipe[];
}

/**
 * 归一化两输入：保证顺序无关的比较
 */
function normalizeInputs(a: string, b: string): [string, string] {
  return [a, b].sort() as [string, string];
}

/**
 * 合成配方配置服务
 * - 负责加载、缓存与按输入查询
 */
export class SynthesisRecipeConfigService {
  private static cache: SynthesisRecipesFile | null = null;

  /** 从配置源加载（开发期默认禁用缓存，确保变更即时生效） */
  static async load(): Promise<SynthesisRecipesFile> {
    const data = await configService.loadConfig<SynthesisRecipesFile>(
      ConfigType.SYNTHESIS_RECIPES,
      { useCache: false }
    );
    SynthesisRecipeConfigService.cache = data;
    return data;
  }

  /** 清理内部与底层缓存 */
  static clearCache() {
    SynthesisRecipeConfigService.cache = null;
    try {
      configService.clearCache?.(ConfigType.SYNTHESIS_RECIPES as any);
    } catch (e) {
      console.warn('[SynthesisRecipeConfigService] Failed to clear cache:', e);
    }
  }

  /** 列出全部配方 */
  static async listAll(): Promise<SynthesisRecipe[]> {
    const data = await SynthesisRecipeConfigService.load();
    return data.recipes || [];
  }

  /** 按ID获取配方 */
  static async getById(id: string): Promise<SynthesisRecipe | null> {
    const data = await SynthesisRecipeConfigService.load();
    return (data.recipes || []).find(r => r.id === id) || null;
  }

  /** 根据两个输入蓝图ID（顺序无关）匹配配方 */
  static async findByInputs(inputAId: string, inputBId: string): Promise<SynthesisRecipe | null> {
    const [x, y] = normalizeInputs(inputAId, inputBId);
    const data = await SynthesisRecipeConfigService.load();
    for (const r of data.recipes || []) {
      const [a, b] = normalizeInputs(r.inputs[0], r.inputs[1]);
      if (a === x && b === y) return r;
    }
    return null;
  }

  /**
   * 校验是否可合成：检查等级与金币门槛
   */
  static async canSynthesize(inputAId: string, inputBId: string, playerLevel: number, gold: number): Promise<{ ok: boolean; reason?: string; recipe?: SynthesisRecipe }>{
    const recipe = await SynthesisRecipeConfigService.findByInputs(inputAId, inputBId);
    if (!recipe) return { ok: false, reason: '没有匹配的合成配方' };
    const cond = recipe.conditions || {};
    if (typeof cond.playerLevel === 'number' && playerLevel < cond.playerLevel) {
      return { ok: false, reason: `需要等级≥${cond.playerLevel}` };
    }
    const cost = cond.cost || {};
    if (typeof cost.gold === 'number' && gold < cost.gold) {
      return { ok: false, reason: `金币不足，需${cost.gold}` };
    }
    return { ok: true, recipe };
  }
}

export const {
  load: loadSynthesisRecipes,
  listAll: listAllSynthesisRecipes,
  getById: getSynthesisRecipeById,
  findByInputs: findSynthesisRecipeByInputs,
  canSynthesize: canSynthesizeByInputs
} = SynthesisRecipeConfigService;
