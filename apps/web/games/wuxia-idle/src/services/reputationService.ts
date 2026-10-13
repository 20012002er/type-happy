/**
 * 声望系统服务层
 * 负责声望相关的业务逻辑计算和集成
 */

import { useReputationStore } from '@/stores/reputationStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';

export class ReputationService {
  /**
   * 战斗胜利后获得声望
   */
  static onCombatVictory(
    enemyLevel: number,
    isBoss: boolean = false,
    isElite: boolean = false
  ): number {
    const store = useReputationStore();

    const playerStore = usePlayerStore();
    const playerLevel = playerStore.player.stats.level;
    const levelDiff = enemyLevel - playerLevel;

    let action: string;
    if (isBoss) {
      action = 'defeat_boss';
    } else if (isElite) {
      action = 'defeat_elite_enemy';
    } else {
      action = 'defeat_normal_enemy';
    }

    const result = store.gainReputation(action, 'combat', levelDiff);

    if (result) {
      const logStore = useGameLogStore();
      logStore.addLog(`战斗胜利，获得 ${result.change} 点江湖声望`);
    }

    return result?.change || 0;
  }

  /**
   * 完成日常任务获得声望
   */
  static onDailyTaskComplete(): number {
    const store = useReputationStore();
    const result = store.gainReputation('complete_daily_task', 'task', 0);

    if (result) {
      const logStore = useGameLogStore();
      logStore.addLog(`完成日常任务，获得 ${result.change} 点江湖声望`);
    }

    return result?.change || 0;
  }

  /**
   * 完成周常任务获得声望
   */
  static onWeeklyTaskComplete(): number {
    const store = useReputationStore();
    const result = store.gainReputation('complete_weekly_task', 'task', 0);

    if (result) {
      const logStore = useGameLogStore();
      logStore.addLog(`完成周常任务，获得 ${result.change} 点江湖声望`);
    }

    return result?.change || 0;
  }

  /**
   * 完成门派任务获得声望
   */
  static onSectTaskComplete(): number {
    const store = useReputationStore();
    const result = store.gainReputation('complete_sect_task', 'task', 0);

    if (result) {
      const logStore = useGameLogStore();
      logStore.addLog(`完成门派任务，获得 ${result.change} 点江湖声望`);
    }

    return result?.change || 0;
  }

  /**
   * 护镖成功获得声望
   */
  static onConvoyComplete(): number {
    const store = useReputationStore();
    const result = store.gainReputation('complete_convoy', 'convoy', 0);

    if (result) {
      const logStore = useGameLogStore();
      logStore.addLog(`护镖成功，获得 ${result.change} 点江湖声望`);
    }

    return result?.change || 0;
  }

  /**
   * 获得成就获得声望
   */
  static onAchievementUnlock(achievementName: string): number {
    const store = useReputationStore();
    const result = store.gainReputation('unlock_achievement', 'achievement', 0);

    if (result) {
      const logStore = useGameLogStore();
      logStore.addLog(`达成成就「${achievementName}」，获得 ${result.change} 点江湖声望`);
    }

    return result?.change || 0;
  }

  /**
   * 击杀正道NPC增加恶名
   */
  static onKillRighteousNPC(npcName: string, severity: number = 10): number {
    const store = useReputationStore();
    const result = store.loseReputation(severity, `击杀正道人士 ${npcName}`, 'combat');

    const logStore = useGameLogStore();
    logStore.addLog(`击杀了 ${npcName}，江湖恶名增加 ${result.change}`);

    return Math.abs(result.change);
  }

  /**
   * 完成善举减少恶名
   */
  static onGoodDeed(deedName: string, redemption: number = 5): number {
    const store = useReputationStore();

    // 善举是增加声望
    const result = store.gainReputation('good_deed', 'deed');

    if (result) {
      const logStore = useGameLogStore();
      logStore.addLog(`${deedName}，获得 ${result.change} 点江湖声望`);
    }

    return result?.change || 0;
  }

  /**
   * 计算声望加成后的奖励
   */
  static calculateBonusReward(baseReward: number, rewardType: 'gold' | 'exp' | 'drop'): number {
    const store = useReputationStore();
    const multiplier = store.bonusMultiplier;

    if (rewardType === 'gold') {
      const config = store.currentLevelConfig;
      const goldBonus = config?.bonusMultiplier || 1.0;
      return Math.floor(baseReward * goldBonus);
    }

    if (rewardType === 'exp') {
      const config = store.currentLevelConfig;
      const expBonus = config?.bonusMultiplier || 1.0;
      return Math.floor(baseReward * expBonus);
    }

    if (rewardType === 'drop') {
      const config = store.currentLevelConfig;
      const dropBonus = config?.bonusMultiplier || 1.0;
      return Math.floor(baseReward * dropBonus);
    }

    return baseReward;
  }

  /**
   * 检查是否可以进入特定区域
   */
  static canEnterArea(areaId: string): { allowed: boolean; reason?: string } {
    const store = useReputationStore();
    const penaltyRule = store.penaltyRule;

    if (penaltyRule.effects.deniedEntry?.includes(areaId)) {
      return {
        allowed: false,
        reason: `因${penaltyRule.description}，无法进入该区域`,
      };
    }

    return { allowed: true };
  }

  /**
   * 获取商店价格加成
   */
  static getShopPriceModifier(): number {
    const store = useReputationStore();
    const priceIncrease = store.penaltyRule.effects.shopPriceIncrease || 0;
    return 1 + priceIncrease;
  }

  /**
   * 获取战斗掉落加成
   */
  static getCombatDropModifier(): number {
    const store = useReputationStore();
    const dropIncrease = store.penaltyRule.effects.combatDropIncrease || 0;
    return 1 + dropIncrease;
  }

  /**
   * 是否可以被正道玩家攻击
   */
  static canBeAttackedByRighteous(): boolean {
    const store = useReputationStore();
    return store.penaltyRule.effects.canBeAttacked || false;
  }

  /**
   * 获取当前声望状态描述
   */
  static getReputationStatus(): {
    level: string;
    title: string;
    points: number;
    nextLevel: string | null;
    bonus: string;
    status: 'good' | 'neutral' | 'evil';
  } {
    const store = useReputationStore();

    let status: 'good' | 'neutral' | 'evil';
    if (store.reputation.jianghu >= 0) {
      status = 'good';
    } else if (store.reputation.jianghu >= -100) {
      status = 'neutral';
    } else {
      status = 'evil';
    }

    return {
      level: store.levelName,
      title: store.title,
      points: store.reputation.jianghu,
      nextLevel:
        store.pointsToNextLevel > 0 ? `距离下一级还需 ${store.pointsToNextLevel} 点` : null,
      bonus: `加成倍率: ${(store.bonusMultiplier * 100).toFixed(0)}%`,
      status,
    };
  }
}
