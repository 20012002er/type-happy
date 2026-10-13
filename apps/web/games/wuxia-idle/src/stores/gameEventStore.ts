import { defineStore } from 'pinia';
import { useAchievementStore } from './achievementStore';
import type { AchievementObjectiveType } from '@/types/achievement';

/**
 * 游戏事件类型
 * 所有游戏事件都通过这个枚举定义
 */
export enum GameEventType {
  // 战斗相关
  ENEMY_DEFEATED = 'defeat_enemy',
  COMBAT_WIN = 'combat_win',
  COMBAT_LOSE = 'combat_lose',
  
  // 修炼相关
  MEDITATE = 'meditate_times',
  PRACTICE = 'practice_times',
  BREAKTHROUGH = 'breakthrough',
  
  // 等级相关
  LEVEL_UP = 'reach_level',
  
  // 装备相关
  EQUIP_ITEM = 'equip_item',
  UNEQUIP_ITEM = 'unequip_item',
  CRAFT_ITEM = 'craft_item',
  
  // 收集相关
  COLLECT_ITEM = 'collect_item',
  LOOT_ITEM = 'loot_item',
  
  // 经济相关
  EARN_GOLD = 'earn_gold',
  SPEND_GOLD = 'spend_gold',
  
  // 地图相关
  VISIT_LOCATION = 'visit_location',
  EXPLORE = 'explore',
  
  // 生活技能相关
  GATHER_HERB = 'gather_herb',
  CRAFT_PILL = 'craft_pill',
  COOK_FOOD = 'cook_food',
  FORGE_WEAPON = 'forge_weapon',
  FISH = 'fish',
  
  // 技能相关
  UPGRADE_SKILL = 'upgrade_skill',
  LEARN_SKILL = 'learn_skill'
}

/**
 * 游戏事件数据
 */
export interface GameEvent {
  type: GameEventType | string;
  target: string | number;
  amount?: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * 游戏事件Store
 * 作为全局事件总线，所有游戏事件都通过这里分发
 */
export const useGameEventStore = defineStore('gameEvent', () => {
  /**
   * 触发游戏事件
   * 这是核心方法，所有游戏系统都应该调用这个方法来触发事件
   */
  function trigger(event: Omit<GameEvent, 'timestamp'>): void {
    const fullEvent: GameEvent = {
      ...event,
      timestamp: Date.now()
    };

    console.log('[GameEvent]', fullEvent);

    // 1. 通知任务系统
    notifyAchievements(fullEvent);

    // 2. 通知成就系统（未来实现）
    // notifyAchievements(fullEvent);

    // 3. 其他需要监听游戏事件的系统
    // ...
  }

  function notifyAchievements(event: GameEvent): void {
    const achievementStore = useAchievementStore();
    if (!achievementStore.initialized) {
      console.warn('[GameEvent] 成就系统未初始化');
      return;
    }

    achievementStore.notifyProgress({
      type: event.type as AchievementObjectiveType,
      target: event.target,
      amount: event.amount || 1
    });
  }

  /**
   * 便捷方法：触发战斗胜利事件
   */
  function onEnemyDefeated(enemyId: string, options: { tier?: string } = {}): void {
    trigger({
      type: GameEventType.ENEMY_DEFEATED,
      target: enemyId,
      amount: 1
    });

    trigger({
      type: GameEventType.ENEMY_DEFEATED,
      target: 'any',
      amount: 1
    });

    if (options.tier && (options.tier === 'elite' || options.tier === 'boss')) {
      trigger({
        type: GameEventType.ENEMY_DEFEATED,
        target: 'elite',
        amount: 1
      });
    }
  }

  /**
   * 便捷方法：触发打坐事件
   */
  function onMeditate(): void {
    trigger({
      type: GameEventType.MEDITATE,
      target: 'meditate',
      amount: 1
    });
  }

  /**
   * 便捷方法：触发升级事件
   */
  function onLevelUp(newLevel: number): void {
    trigger({
      type: GameEventType.LEVEL_UP,
      target: newLevel,
      amount: 1
    });
  }

  /**
   * 便捷方法：触发装备事件
   */
  function onEquipItem(itemId: string, itemType: string): void {
    trigger({
      type: GameEventType.EQUIP_ITEM,
      target: itemId,
      amount: 1,
      metadata: { itemType }
    });

    // 如果是武器，也触发"任意武器"
    if (itemType === 'weapon') {
      trigger({
        type: GameEventType.EQUIP_ITEM,
        target: 'any_weapon',
        amount: 1
      });
    }
  }

  /**
   * 便捷方法：触发金币获得事件
   */
  function onEarnGold(amount: number): void {
    trigger({
      type: GameEventType.EARN_GOLD,
      target: 'total',
      amount
    });
  }

  /**
   * 便捷方法：触发地点访问事件
   */
  function onVisitLocation(locationId: string): void {
    trigger({
      type: GameEventType.VISIT_LOCATION,
      target: locationId,
      amount: 1
    });
  }

  /**
   * 便捷方法：触发合成/制作事件
   */
  function onCraftItem(itemId: string, category: string): void {
    trigger({
      type: GameEventType.CRAFT_ITEM,
      target: itemId,
      amount: 1,
      metadata: { category }
    });

    if (category) {
      trigger({
        type: GameEventType.CRAFT_ITEM,
        target: category,
        amount: 1
      });
    }
  }

  /**
   * 便捷方法：触发技能升级事件
   */
  function onUpgradeSkill(skillId: string, newLevel: number): void {
    trigger({
      type: GameEventType.UPGRADE_SKILL,
      target: skillId,
      amount: 1,
      metadata: { level: newLevel }
    });
  }

  return {
    // 核心方法
    trigger,

    // 便捷方法
    onEnemyDefeated,
    onMeditate,
    onLevelUp,
    onEquipItem,
    onEarnGold,
    onVisitLocation,
    onCraftItem,
    onUpgradeSkill
  };
});

