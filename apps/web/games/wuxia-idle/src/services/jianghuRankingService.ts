/**
 * 江湖榜服务层
 * 负责排名计算、挑战匹配、奖励发放
 */

import { useJianghuRankingStore } from '@/stores/jianghuRankingStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useReputationStore } from '@/stores/reputationStore';
import {
  RankingType,
  type RankingEntry,
  type RankingChallengeResult,
  type RankingChallengeRequest,
  type RankingConfig,
  type PlayerRankingInfo,
} from '@/types/jianghuRanking';
import { ChallengeResult as ChallengeResultEnum, RankingEntryStatus } from '@/types/jianghuRanking';

export class JianghuRankingService {
  private static initialized = false;

  /**
   * 初始化江湖榜系统
   */
  static async init(): Promise<void> {
    if (this.initialized) return;

    const store = useJianghuRankingStore();
    await store.init();

    this.initialized = true;
    console.log('[JianghuRankingService] 初始化成功');
  }

  /**
   * 检查是否已初始化
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取榜单排名
   */
  static getRanking(type: RankingType, page: number = 1, pageSize: number = 10): RankingEntry[] {
    const store = useJianghuRankingStore();
    const list = store.getRanking(type);
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }

  /**
   * 获取榜单配置
   */
  static getConfig(type: RankingType): RankingConfig | undefined {
    const store = useJianghuRankingStore();
    return store.getConfig(type);
  }

  /**
   * 获取玩家排名信息
   */
  static getPlayerRankingInfo(type: RankingType): PlayerRankingInfo {
    const store = useJianghuRankingStore();
    return store.getPlayerInfo(type);
  }

  /**
   * 检查是否可以发起挑战
   */
  static canChallenge(type: RankingType): { can: boolean; reason?: string } {
    const store = useJianghuRankingStore();
    const playerStore = usePlayerStore();
    const config = store.getConfig(type);

    if (!config) {
      return { can: false, reason: '榜单不存在' };
    }

    if (playerStore.player.stats.level < config.minLevel) {
      return { can: false, reason: `等级不足，需要达到 ${config.minLevel} 级` };
    }

    const info = store.getPlayerInfo(type);
    if (info.dailyChallengesRemaining <= 0) {
      return { can: false, reason: '今日挑战次数已用完' };
    }

    return { can: true };
  }

  /**
   * 发起排名挑战
   */
  static async challenge(
    type: RankingType,
    targetEntryId: string
  ): Promise<RankingChallengeResult> {
    const store = useJianghuRankingStore();
    const playerStore = usePlayerStore();
    const logStore = useGameLogStore();

    const config = store.getConfig(type);
    if (!config) {
      return this.createResult(ChallengeResultEnum.失败, 0, '榜单不存在');
    }

    const canChallenge = this.canChallenge(type);
    if (!canChallenge.can) {
      return this.createResult(ChallengeResultEnum.失败, 0, canChallenge.reason!);
    }

    const targetRanking = store.getRanking(type);
    const targetEntry = targetRanking.find(e => e.id === targetEntryId);
    if (!targetEntry) {
      return this.createResult(ChallengeResultEnum.失败, 0, '目标不存在');
    }

    if (targetEntry.status === RankingEntryStatus.挑战中) {
      return this.createResult(ChallengeResultEnum.失败, 0, '目标正在被挑战中');
    }

    if (!store.decrementDailyChallenges(type)) {
      return this.createResult(ChallengeResultEnum.失败, 0, '挑战次数不足');
    }

    const player = playerStore.player;
    const playerCombatPower = this.calculateCombatPower(player);
    const targetCombatPower = targetEntry.combatPower;

    const victoryChance = this.calculateVictoryChance(playerCombatPower, targetCombatPower);
    const isVictory = Math.random() < victoryChance;

    const targetRank = targetEntry.rank;

    if (isVictory) {
      store.updateRanking(type, {
        ...targetEntry,
        status: RankingEntryStatus.挑战中,
      });

      const newEntry: RankingEntry = {
        id: player.id,
        rankingType: type,
        rank: targetRank,
        name: player.name,
        level: player.stats.level,
        sect: (player as any).sect,
        combatPower: playerCombatPower,
        lastUpdated: Date.now(),
        status: RankingEntryStatus.在榜,
      };

      const oldRank = store.getPlayerPosition(type, player.id);
      this.replaceRanking(type, player.id, newEntry);

      store.setPlayerRank(type, targetRank);
      store.recordChallengeResult(ChallengeResultEnum.胜利);

      const rewards = this.calculateRewards(ChallengeResultEnum.胜利, type);
      this.grantRewards(rewards, playerStore);

      logStore.addCombatLog(`挑战成功！你在【${config.name}】中位列第 ${targetRank} 名`);

      return {
        result: ChallengeResultEnum.胜利,
        oldRank,
        newRank: targetRank,
        rewards,
        log: `击败${targetEntry.name}，升至第${targetRank}名`,
      };
    } else {
      store.recordChallengeResult(ChallengeResultEnum.失败);

      const rewards = this.calculateRewards(ChallengeResultEnum.失败, type);
      this.grantRewards(rewards, playerStore);

      logStore.addCombatLog(`挑战${targetEntry.name}失败，继续努力！`);

      return {
        result: ChallengeResultEnum.失败,
        oldRank: store.getPlayerPosition(type, player.id),
        rewards,
        log: `挑战${targetEntry.name}，未能取胜`,
      };
    }
  }

  /**
   * 替换排名（挑战成功后调用）
   */
  private static replaceRanking(type: RankingType, playerId: string, newEntry: RankingEntry): void {
    const store = useJianghuRankingStore();
    const ranking = store.getRanking(type);

    const playerIndex = ranking.findIndex(e => e.id === playerId);
    const targetIndex = ranking.findIndex(e => e.id === newEntry.id);

    if (targetIndex >= 0) {
      const oldEntry = ranking[targetIndex];

      if (playerIndex >= 0 && playerIndex < targetIndex) {
        ranking.splice(playerIndex, 1);
        ranking.splice(targetIndex - 1, 0, newEntry);
      } else if (playerIndex >= 0 && playerIndex > targetIndex) {
        ranking.splice(playerIndex, 1);
        ranking.splice(targetIndex, 0, newEntry);
      } else {
        ranking[targetIndex] = newEntry;
      }

      oldEntry.status = RankingEntryStatus.离榜;
    }
  }

  /**
   * 计算战力评分
   */
  private static calculateCombatPower(player: any): number {
    const { attack, defense, hp, level } = player.stats;
    return Math.floor((attack * 2 + defense * 1.5 + hp * 0.1) * (1 + level * 0.1));
  }

  /**
   * 计算胜利概率
   */
  private static calculateVictoryChance(playerPower: number, targetPower: number): number {
    const ratio = playerPower / targetPower;
    if (ratio >= 1.5) return 0.95;
    if (ratio >= 1.2) return 0.8;
    if (ratio >= 1.0) return 0.6;
    if (ratio >= 0.8) return 0.4;
    if (ratio >= 0.5) return 0.2;
    return 0.1;
  }

  /**
   * 计算挑战奖励
   */
  private static calculateRewards(
    result: ChallengeResultEnum,
    type: RankingType
  ): { gold: number; reputation: number; exp: number } {
    const baseRewards: Record<
      RankingType,
      {
        victory: { gold: number; reputation: number; exp: number };
        defeat: { gold: number; reputation: number; exp: number };
      }
    > = {
      [RankingType.天榜]: {
        victory: { gold: 500, reputation: 100, exp: 2000 },
        defeat: { gold: 100, reputation: 20, exp: 500 },
      },
      [RankingType.地榜]: {
        victory: { gold: 200, reputation: 50, exp: 1000 },
        defeat: { gold: 50, reputation: 10, exp: 300 },
      },
      [RankingType.玄榜]: {
        victory: { gold: 50, reputation: 20, exp: 500 },
        defeat: { gold: 20, reputation: 5, exp: 100 },
      },
    };

    const rewards = baseRewards[type];
    return result === ChallengeResultEnum.胜利 ? rewards.victory : rewards.defeat;
  }

  /**
   * 发放奖励
   */
  private static grantRewards(
    rewards: { gold: number; reputation: number; exp: number },
    playerStore: any
  ): void {
    if (rewards.gold > 0) {
      playerStore.updateResources({ gold: playerStore.player.resources.gold + rewards.gold });
    }
    if (rewards.exp > 0) {
      playerStore.gainExperience(rewards.exp);
    }
    if (rewards.reputation > 0) {
      const reputationStore = useReputationStore();
      reputationStore.addReputation(rewards.reputation, 'challenge');
    }
  }

  /**
   * 创建挑战结果
   */
  private static createResult(
    result: ChallengeResultEnum,
    oldRank: number,
    log: string
  ): RankingChallengeResult {
    return { result, oldRank, log };
  }

  /**
   * 获取榜单统计
   */
  static getStats() {
    const store = useJianghuRankingStore();
    return store.getStats();
  }

  /**
   * 重置每日挑战次数
   */
  static resetDailyChallenges(type: RankingType): void {
    const store = useJianghuRankingStore();
    store.resetDailyChallenges(type);
  }

  /**
   * 更新玩家战力并检查排名变动
   */
  static updatePlayerRanking(type: RankingType, playerId: string): void {
    const store = useJianghuRankingStore();
    const playerStore = usePlayerStore();

    if (!store.isPlayerOnRank(type, playerId)) return;

    const combatPower = this.calculateCombatPower(playerStore.player);
    const ranking = store.getRanking(type);
    const entry = ranking.find(e => e.id === playerId);

    if (entry) {
      store.updateRanking(type, { ...entry, combatPower, lastUpdated: Date.now() });
    }
  }
}

export const jianghuRankingService = JianghuRankingService;
