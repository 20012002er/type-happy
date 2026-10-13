import { StatusEffectConfigService, type StatusEffectDef, type StatusEffectModifiers } from './config/StatusEffectConfigService';

/**
 * 激活的状态效果实例
 * 
 * 记录当前生效的状态效果ID和过期时间
 */
export interface ActiveEffectInstance {
  id: string;           // 状态效果ID
  expiresAt: number;    // 过期时间戳（毫秒）
}

/**
 * 状态效果服务
 * 
 * 职责：
 * - 管理激活的状态效果（Buff/Debuff）
 * - 应用和移除状态效果
 * - 聚合所有激活效果的属性修改器
 * - 提供详细的效果信息给UI显示
 * 
 * 特性：
 * - 自动清理过期效果
 * - 支持多种叠加策略（none/stack/refresh）
 * - 聚合所有激活效果的修改器
 */
class StatusEffectServiceImpl {
  private active: ActiveEffectInstance[] = [];
  private defsById: Map<string, StatusEffectDef> = new Map();
  private loaded = false;

  /**
   * 确保配置已加载
   * 懒加载状态效果配置
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const cfg = await StatusEffectConfigService.loadConfig();
    this.defsById.clear();
    for (const def of cfg.effects) this.defsById.set(def.id, def);
    this.loaded = true;
  }

  /**
   * 应用状态效果
   * 
   * @param effectId 状态效果ID
   * 
   * 叠加策略：
   * - refresh: 刷新持续时间（默认）
   * - stack: 可以多次叠加
   * - none: 不可叠加，已存在时忽略
   */
  async applyEffect(effectId: string): Promise<void> {
    await this.ensureLoaded();
    const def = this.defsById.get(effectId);
    if (!def) return;
    
    const now = Date.now();
    const exists = this.active.find(e => e.id === effectId);
    
    if (exists) {
      // 根据叠加策略处理
      if (def.stacking === 'refresh') {
        exists.expiresAt = now + def.durationMs;
      } else if (def.stacking === 'stack') {
        // 允许叠加，添加新实例
        this.active.push({ id: effectId, expiresAt: now + def.durationMs });
      }
      // stacking === 'none' 时忽略
      return;
    }
    
    // 添加新效果
    this.active.push({ id: effectId, expiresAt: now + def.durationMs });
  }

  /**
   * 清理已过期的状态效果
   */
  clearExpired(): void {
    const now = Date.now();
    this.active = this.active.filter(e => e.expiresAt > now);
  }

  /**
   * 获取聚合的属性修改器（同步版本）
   * 
   * 将所有激活的状态效果的修改器累加起来
   * 返回总的属性修改值
   * 
   * 注意：会自动清理过期效果
   */
  getAggregatedModifiersSync(): StatusEffectModifiers {
    this.clearExpired();
    
    // 初始化聚合结果
    const aggregated: StatusEffectModifiers = {
      meditationEpsPercent: 0
    };
    
    // 累加所有激活效果的修改器
    for (const inst of this.active) {
      const def = this.defsById.get(inst.id);
      if (!def || !def.modifiers) continue;
      
      const mod = def.modifiers;
      
      // 基础四维
      if (mod.strength) aggregated.strength = (aggregated.strength || 0) + mod.strength;
      if (mod.agility) aggregated.agility = (aggregated.agility || 0) + mod.agility;
      if (mod.vitality) aggregated.vitality = (aggregated.vitality || 0) + mod.vitality;
      if (mod.spirit) aggregated.spirit = (aggregated.spirit || 0) + mod.spirit;
      
      // 战斗属性
      if (mod.maxHp) aggregated.maxHp = (aggregated.maxHp || 0) + mod.maxHp;
      if (mod.attack) aggregated.attack = (aggregated.attack || 0) + mod.attack;
      if (mod.defense) aggregated.defense = (aggregated.defense || 0) + mod.defense;
      if (mod.maxEnergy) aggregated.maxEnergy = (aggregated.maxEnergy || 0) + mod.maxEnergy;
      
      // 战斗特性
      if (mod.accuracy) aggregated.accuracy = (aggregated.accuracy || 0) + mod.accuracy;
      if (mod.dodgeChance) aggregated.dodgeChance = (aggregated.dodgeChance || 0) + mod.dodgeChance;
      if (mod.critChance) aggregated.critChance = (aggregated.critChance || 0) + mod.critChance;
      if (mod.critMultiplier) aggregated.critMultiplier = (aggregated.critMultiplier || 0) + mod.critMultiplier;
      if (mod.blockChance) aggregated.blockChance = (aggregated.blockChance || 0) + mod.blockChance;
      if (mod.tenacity) aggregated.tenacity = (aggregated.tenacity || 0) + mod.tenacity;
      if (mod.armorPenetration) aggregated.armorPenetration = (aggregated.armorPenetration || 0) + mod.armorPenetration;
      if (mod.speed) aggregated.speed = (aggregated.speed || 0) + mod.speed;
      
      // 武侠特色
      if (mod.energyRegen) aggregated.energyRegen = (aggregated.energyRegen || 0) + mod.energyRegen;
      
      // 特殊系统
      if (mod.meditationEpsPercent) aggregated.meditationEpsPercent = (aggregated.meditationEpsPercent || 0) + mod.meditationEpsPercent;
      
      // 其他
      if (mod.luck) aggregated.luck = (aggregated.luck || 0) + mod.luck;
    }
    
    return aggregated;
  }

  /**
   * 获取激活效果的详细信息
   * 
   * 用于UI显示，包含：
   * - 效果ID和名称
   * - 过期时间和剩余时间
   * - 具体的修改器内容
   */
  getActiveEffectsDetailed(): Array<{ 
    id: string; 
    name: string; 
    expiresAt: number; 
    remainingMs: number; 
    modifiers: StatusEffectDef['modifiers'] 
  }> {
    this.clearExpired();
    const now = Date.now();
    const details: Array<{ 
      id: string; 
      name: string; 
      expiresAt: number; 
      remainingMs: number; 
      modifiers: StatusEffectDef['modifiers'] 
    }> = [];
    
    for (const inst of this.active) {
      const def = this.defsById.get(inst.id);
      if (!def) continue;
      details.push({ 
        id: inst.id, 
        name: def.name, 
        expiresAt: inst.expiresAt, 
        remainingMs: Math.max(0, inst.expiresAt - now), 
        modifiers: def.modifiers 
      });
    }
    
    return details;
  }
}

export const StatusEffectService = new StatusEffectServiceImpl();


