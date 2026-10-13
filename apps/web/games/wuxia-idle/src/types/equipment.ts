import type { Component } from 'vue';

/**
 * 装备部位类型（符合武侠低武世界观）
 *
 * 参考 Melvor Idle 的深度装备系统，结合武侠特色
 * 设计理念：
 * - 头部：斗笠、头巾等防护
 * - 武器：剑、刀、棍等主手武器
 * - 副手：暗器、盾牌、匕首等辅助
 * - 衣甲：布衣、皮甲、轻甲
 * - 腰带：装饰性+实用性（增加负重）
 * - 手套：护腕、手套
 * - 靴子：轻功靴、草鞋等
 * - 饰品：玉佩、戒指等（2个槽位）
 */
export type EquipmentSlot =
  | 'head' // 头部
  | 'weapon' // 武器（主手）
  | 'offhand' // 副手（暗器/盾牌/匕首）
  | 'armor' // 衣甲
  | 'belt' // 腰带
  | 'gloves' // 手套
  | 'boots' // 靴子
  | 'accessory1' // 饰品1
  | 'accessory2'; // 饰品2

export type ItemCategory = 'equipment' | 'material' | 'food' | 'potion' | 'key';

/**
 * 装备属性加成接口
 *
 * 装备可以加成各种属性：
 * - 基础四维：力量、敏捷、体质、悟性
 * - 派生属性：HP、攻击、防御、内力等
 * - 百分比属性：命中、闪避、暴击等
 *
 * 加成方式：
 * - 绝对值加成：直接加到属性上（如 attack +10）
 * - 百分比加成：按比例增加（如 critChance +0.05 表示+5%暴击）
 */
export interface ItemStatBonus {
  // ========== 基础四维加成 ==========
  strength?: number; // 力量加成
  agility?: number; // 敏捷加成
  vitality?: number; // 体质加成
  spirit?: number; // 悟性加成

  // ========== 派生属性加成 ==========
  hp?: number; // 生命值加成
  maxHp?: number; // 最大生命加成
  attack?: number; // 攻击力加成
  defense?: number; // 防御力加成
  energy?: number; // 内力值加成
  maxEnergy?: number; // 最大内力加成

  // ========== 战斗属性加成（百分比） ==========
  accuracy?: number; // 命中率加成（如 0.05 = +5%）
  dodgeChance?: number; // 闪避率加成
  critChance?: number; // 暴击率加成
  critMultiplier?: number; // 暴击倍率加成（如 0.2 = +20%，即从1.5倍变1.7倍）
  blockChance?: number; // 格挡率加成
  tenacity?: number; // 韧性加成
  armorPenetration?: number; // 破防值加成
  speed?: number; // 速度加成

  // ========== 武侠特色加成 ==========
  qinggongLevel?: number; // 轻功等级加成
  neigongLevel?: number; // 内功等级加成
  energyRegen?: number; // 内力恢复加成

  // ========== 其他 ==========
  luck?: number; // 幸运加成
}

export interface Item {
  id: string; // 物品实例ID（唯一）
  blueprintId?: string; // 母本ID
  name: string;
  comment?: string;
  category?: ItemCategory; // 物品分类
  slot?: EquipmentSlot; // 装备类物品则有slot
  bonuses?: ItemStatBonus; // 穿戴时加成
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
  enhanceLevel?: number; // 强化段数
  affixes?: string[]; // 篆纹名称列表
  stackSize?: number; // 可堆叠数量（非装备）
  locked?: boolean; // 是否已锁定（不会在失败时掉落）
}

/**
 * 已装备的装备集合
 *
 * 包含9个装备槽位，符合武侠游戏的装备深度
 */
export interface EquippedSet {
  head?: Item;
  weapon?: Item;
  offhand?: Item;
  armor?: Item;
  belt?: Item;
  gloves?: Item;
  boots?: Item;
  accessory1?: Item;
  accessory2?: Item;
}

/**
 * 装备槽位配置
 * 用于UI显示和验证
 */
export interface EquipmentSlotConfig {
  slot: EquipmentSlot;
  name: string; // 显示名称
  icon: Component; // 图标组件
  emptyText: string; // 空槽提示
}

// 导入 lucide 图标
import {
  Crown,
  Sword,
  Shield,
  Shirt,
  Gem,
  Hand,
  Footprints,
  CircleDot,
  Circle,
} from 'lucide-vue-next';

/**
 * 所有装备槽位的配置
 */
export const EQUIPMENT_SLOTS: EquipmentSlotConfig[] = [
  { slot: 'head', name: '头部', icon: Crown, emptyText: '（空）' },
  { slot: 'weapon', name: '武器', icon: Sword, emptyText: '（空）' },
  { slot: 'offhand', name: '副手', icon: Shield, emptyText: '（空）' },
  { slot: 'armor', name: '衣甲', icon: Shirt, emptyText: '（空）' },
  { slot: 'belt', name: '腰带', icon: Gem, emptyText: '（空）' },
  { slot: 'gloves', name: '手套', icon: Hand, emptyText: '（空）' },
  { slot: 'boots', name: '靴子', icon: Footprints, emptyText: '（空）' },
  { slot: 'accessory1', name: '饰品1', icon: CircleDot, emptyText: '（空）' },
  { slot: 'accessory2', name: '饰品2', icon: Circle, emptyText: '（空）' },
];
