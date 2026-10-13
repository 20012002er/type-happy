/**
 * 称号系统类型定义
 * 基于古典武侠游戏规划与主线框架的称号体系
 */

/**
 * 称号类别枚举
 */
export enum TitleCategory {
  阶段称号 = 'phase', // 江湖新秀、小有名气、一流高手等
  门派称号 = 'sect', // 各门派相关称号
  江湖榜称号 = 'ranking', // 江湖榜排名相关称号
  生活技能称号 = 'life_skill', // 生活技能相关称号
  成就称号 = 'achievement', // 达成特定成就获得
  隐藏称号 = 'hidden', // 隐藏成就或特殊条件获得
  特殊称号 = 'special', // 特殊剧情或事件获得
}

/**
 * 称号稀有度枚举
 */
export enum TitleRarity {
  普通 = 'common', // 白色 - 基础称号
  稀有 = 'rare', // 蓝色 - 需要一定条件
  珍贵 = 'epic', // 紫色 - 需要较大努力
  传说 = 'legendary', // 橙色 - 需要重大成就
  神话 = 'mythic', // 红色 - 顶级称号
}

/**
 * 称号属性加成
 */
export interface TitleBonus {
  statType: string; // 属性类型（attack, defense, hp等）
  value: number; // 加成值
  isPercentage: boolean; // 是否为百分比加成
}

/**
 * 称号条件
 */
export interface TitleRequirement {
  type:
    | 'reputation_level'
    | 'achievement'
    | 'sect_rank'
    | 'jianghu_rank'
    | 'level'
    | 'life_skill'
    | 'custom';
  value: string | number; // 条件值
  description?: string; // 条件描述
}

/**
 * 称号配置
 */
export interface Title {
  id: string; // 称号唯一ID
  name: string; // 称号名称
  description: string; // 称号描述
  category: TitleCategory; // 称号类别
  rarity: TitleRarity; // 稀有度
  requirements: TitleRequirement[]; // 解锁条件
  bonuses: TitleBonus[]; // 属性加成
  icon?: string; // 称号图标（emoji）
  isHidden: boolean; // 是否为隐藏称号
  isPermanent: boolean; // 是否为永久称号（不可卸下）
  source?: string; // 获得来源描述
}

/**
 * 玩家拥有的称号
 */
export interface OwnedTitle {
  titleId: string; // 称号ID
  unlockedAt: number; // 解锁时间
  isEquipped: boolean; // 是否已装备
  source?: string; // 获得来源
}

/**
 * 称号系统配置（从配置文件加载）
 */
export interface TitleConfig {
  titles: Title[];
  categories: {
    id: TitleCategory;
    name: string;
    description: string;
  }[];
}

/**
 * 称号装备结果
 */
export interface TitleEquipResult {
  success: boolean;
  previousTitleId?: string;
  newTitleId: string;
  bonusSummary: {
    statType: string;
    value: number;
    isPercentage: boolean;
  }[];
}

/**
 * 称号筛选条件
 */
export interface TitleFilter {
  category?: TitleCategory;
  rarity?: TitleRarity;
  owned?: boolean;
  equipped?: boolean;
  canUnlock?: boolean;
}
