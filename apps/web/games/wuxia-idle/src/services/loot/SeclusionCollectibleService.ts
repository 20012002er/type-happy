/**
 * 闭关收集物掉落服务
 * 负责武学收集物的随机掉落逻辑
 * @module services/loot/SeclusionCollectibleService
 */

import { useMaterialsStore } from '@/stores/materialsStore';
import { useSeclusionStore } from '@/stores/seclusionStore';
import { SeclusionConfigService } from '@/services/config/SeclusionConfigService';
import type {
  SeclusionType,
  CollectibleDrop,
  CollectibleRarity,
  SeclusionConfigFile,
} from '@/types/seclusion';

interface CollectibleConfig {
  id: string;
  name: string;
  rarity: CollectibleRarity;
  description: string;
  icon: string;
}

interface RarityConfig {
  name: string;
  dropWeight: number;
  color: string;
}

interface DropPool {
  common: string[];
  fine: string[];
  rare: string[];
  epic: string[];
}

export class SeclusionCollectibleService {
  private static collectibles: Record<string, CollectibleConfig> = {};
  private static rarities: Record<string, RarityConfig> = {};
  private static dropPools: Record<SeclusionType, DropPool> = {
    practice: {
      common: ['心法残页'],
      fine: ['武学典籍'],
      rare: ['上乘心法夹页'],
      epic: ['失传心法残篇'],
    },
    sparring: {
      common: ['招式残页'],
      fine: ['兵器谱条目'],
      rare: ['上乘招式残谱'],
      epic: ['失传剑谱'],
    },
    reading: {
      common: ['武学批注'],
      fine: ['古籍批注'],
      rare: ['江湖典故'],
      epic: ['失传典籍'],
    },
  };
  private static isInitialized = false;

  /**
   * 初始化加载配置
   */
  static async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const config = await SeclusionConfigService.loadConfig();

      this.collectibles = config.collectibles || {};
      this.rarities = config.rarities || {};

      // 更新掉落池
      if (config.types) {
        for (const type of config.types) {
          if (this.dropPools[type.id as SeclusionType]) {
            const typeConfig = config.types.find((t: any) => t.id === type.id);
            if (typeConfig?.collectibleDrops) {
              this.dropPools[type.id as SeclusionType] = {
                common: typeConfig.collectibleDrops.primary.filter(
                  (item: string) => this.collectibles[item]?.rarity === 'common'
                ),
                fine: typeConfig.collectibleDrops.primary.filter(
                  (item: string) => this.collectibles[item]?.rarity === 'fine'
                ),
                rare: typeConfig.collectibleDrops.secondary.filter(
                  (item: string) => this.collectibles[item]?.rarity === 'rare'
                ),
                epic: typeConfig.collectibleDrops.secondary.filter(
                  (item: string) => this.collectibles[item]?.rarity === 'epic'
                ),
              };
            }
          }
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('[SeclusionCollectibleService] 配置加载失败，使用默认配置');
    }
  }

  /**
   * 尝试触发收集物掉落
   */
  static async tryDrop(
    seclusionType: SeclusionType,
    completedWithoutInterrupt: boolean = true
  ): Promise<CollectibleDrop | null> {
    await this.init();

    const seclusionStore = useSeclusionStore();
    const materialsStore = useMaterialsStore();

    try {
      const params = await SeclusionConfigService.getParameters();

      // 中断完成时降低掉落概率
      const dropChance = completedWithoutInterrupt
        ? params.collectibleDropChance
        : params.collectibleDropChance * 0.3;

      if (Math.random() > dropChance) {
        return null;
      }

      // 决定稀有度
      const rarity = this.rollRarity();

      // 从对应稀有度池中随机选择物品
      const pool = this.dropPools[seclusionType];
      if (!pool || pool[rarity].length === 0) {
        return null;
      }

      const itemId = pool[rarity][Math.floor(Math.random() * pool[rarity].length)];
      const collectible = this.collectibles[itemId];

      if (!collectible) {
        return null;
      }

      // 检查是否是新获得的
      const existing = materialsStore.getMaterial(itemId);
      const isNew = !existing;

      // 添加到材料仓库
      materialsStore.add(itemId, 1, collectible.name);

      // 记录到 store
      seclusionStore.recordCollectibleDrop({
        itemId,
        name: collectible.name,
        rarity: collectible.rarity,
        description: collectible.description,
        icon: collectible.icon,
        isNew,
      });

      return {
        itemId,
        name: collectible.name,
        rarity: collectible.rarity,
        description: collectible.description,
        icon: collectible.icon,
        isNew,
      };
    } catch (error) {
      console.warn('[SeclusionCollectibleService] 掉落处理失败:', error);
      return null;
    }
  }

  /**
   * 根据权重随机决定稀有度
   */
  private static rollRarity(): CollectibleRarity {
    if (Object.keys(this.rarities).length === 0) {
      // 默认权重
      const weights = { common: 60, fine: 25, rare: 10, epic: 5 };
      const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
      let random = Math.random() * total;
      const order: CollectibleRarity[] = ['common', 'fine', 'rare', 'epic'];
      for (const rarity of order) {
        random -= weights[rarity];
        if (random <= 0) return rarity;
      }
      return 'common';
    }

    const totalWeight = Object.values(this.rarities).reduce((sum, r) => sum + r.dropWeight, 0);
    let random = Math.random() * totalWeight;

    const rarityOrder: CollectibleRarity[] = ['common', 'fine', 'rare', 'epic'];
    for (const rarity of rarityOrder) {
      const config = this.rarities[rarity];
      if (config) {
        random -= config.dropWeight;
        if (random <= 0) {
          return rarity;
        }
      }
    }

    return 'common';
  }

  /**
   * 获取收集物详情
   */
  static getCollectible(itemId: string): CollectibleConfig | null {
    return this.collectibles[itemId] || null;
  }

  /**
   * 获取某类型的掉落池
   */
  static getDropPool(seclusionType: SeclusionType): DropPool | null {
    return this.dropPools[seclusionType] || null;
  }

  /**
   * 获取所有收集物统计
   */
  static getCollectionStats(): {
    total: number;
    byRarity: Record<CollectibleRarity, number>;
  } {
    const materialsStore = useMaterialsStore();
    const byRarity: Record<CollectibleRarity, number> = {
      common: 0,
      fine: 0,
      rare: 0,
      epic: 0,
    };

    let total = 0;
    for (const itemId in this.collectibles) {
      const material = materialsStore.getMaterial(itemId);
      if (material && material.qty > 0) {
        total += material.qty;
        const rarity = this.collectibles[itemId]?.rarity;
        if (rarity) {
          byRarity[rarity] += material.qty;
        }
      }
    }

    return { total, byRarity };
  }
}

export const seclusionCollectibleService = SeclusionCollectibleService;
