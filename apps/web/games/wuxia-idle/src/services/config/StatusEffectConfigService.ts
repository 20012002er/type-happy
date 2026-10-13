import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';

/**
 * 状态效果修改器接口
 * 
 * 状态效果（Buff/Debuff）可以修改玩家的各种属性：
 * - 基础四维：力量、敏捷、体质、悟性
 * - 战斗属性：攻击、防御、生命等
 * - 百分比属性：命中、闪避、暴击等
 * - 特殊系统：打坐效率、内力恢复等
 * 
 * 修改器类型：
 * - 绝对值加成：如 attack: 10 表示增加10点攻击
 * - 百分比加成：如 critChance: 0.05 表示增加5%暴击率
 * - 负数减益：如 defense: -5 表示降低5点防御
 */
export interface StatusEffectModifiers {
  // ========== 基础四维修改 ==========
  strength?: number;      // 力量修改
  agility?: number;       // 敏捷修改
  vitality?: number;      // 体质修改
  spirit?: number;        // 悟性修改
  
  // ========== 战斗属性修改 ==========
  maxHp?: number;         // 最大生命修改
  attack?: number;        // 攻击力修改
  defense?: number;       // 防御力修改
  maxEnergy?: number;     // 最大内力修改
  
  // ========== 战斗特性修改 ==========
  accuracy?: number;      // 命中率修改
  dodgeChance?: number;   // 闪避率修改
  critChance?: number;    // 暴击率修改
  critMultiplier?: number; // 暴击倍率修改
  blockChance?: number;   // 格挡率修改
  tenacity?: number;      // 韧性修改
  armorPenetration?: number; // 破防值修改
  speed?: number;         // 速度修改
  
  // ========== 武侠特色修改 ==========
  energyRegen?: number;   // 内力恢复修改
  
  // ========== 特殊系统修改 ==========
  meditationEpsPercent?: number; // 打坐效率百分比修改（如 0.1 = +10%）
  
  // ========== 其他 ==========
  luck?: number;          // 幸运修改
}

/**
 * 状态效果定义
 * 
 * 包含状态效果的基本信息和修改器
 */
export interface StatusEffectDef {
  id: string;                    // 状态效果唯一ID
  name: string;                  // 显示名称
  durationMs: number;            // 持续时间（毫秒）
  stacking: 'none' | 'stack' | 'refresh'; // 叠加策略
  modifiers: StatusEffectModifiers; // 属性修改器
}

export interface StatusEffectTableConfig {
  version: string;
  effects: StatusEffectDef[];
}

export class StatusEffectConfigService {
  static async loadConfig(): Promise<StatusEffectTableConfig> {
    return await configService.loadConfig<StatusEffectTableConfig>(ConfigType.STATUS_EFFECTS);
  }

  static async getById(id: string): Promise<StatusEffectDef | undefined> {
    const cfg = await this.loadConfig();
    return cfg.effects.find(e => e.id === id);
  }
}


