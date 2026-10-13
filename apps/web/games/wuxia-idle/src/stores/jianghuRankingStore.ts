/**
 * 江湖榜状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  RankingType,
  RankingEntryStatus,
  type RankingEntry,
  type RankingConfig,
  type RankingStats,
  type PlayerRankingInfo,
  type ChallengeResult,
} from '@/types/jianghuRanking';
import JIANGHU_RANKING_RAW from '@/assets/configs/jianghu-ranking.json5?raw';
import JSON5 from 'json5';

interface JianghuRankingConfigData {
  rankings: Array<{
    type: string;
    name: string;
    description: string;
    maxEntries: number;
    minLevel: number;
    entryReward: { goldPerRank?: number; reputationBonus?: number };
    challengeRules: {
      requireToken: boolean;
      tokenCost?: number;
      dailyLimit?: number;
      cooldownMinutes?: number;
    };
  }>;
  defaultEntries: {
    玄榜: Array<{ rank: number; name: string; level: number; combatPower: number; sect?: string }>;
    地榜: Array<{ rank: number; name: string; level: number; combatPower: number; sect?: string }>;
    天榜: Array<{ rank: number; name: string; level: number; combatPower: number; sect?: string }>;
  };
  dynamicRanking?: {
    enabled: boolean;
    updateIntervalHours: number;
    fluctuationRange: number;
    npcVictoryBoost: number;
    npcDefeatPenalty: number;
  };
}

export const useJianghuRankingStore = defineStore('jianghuRanking', () => {
  const rankings = ref<Record<RankingType, RankingEntry[]>>({
    [RankingType.天榜]: [],
    [RankingType.地榜]: [],
    [RankingType.玄榜]: [],
  });

  const configs = ref<Record<RankingType, RankingConfig>>({
    [RankingType.天榜]: {
      type: RankingType.天榜,
      name: '天榜',
      description: '绝顶高手榜，江湖最顶尖的十人。',
      maxEntries: 10,
      minLevel: 50,
      entryReward: { goldPerRank: 200, reputationBonus: 1.2 },
      challengeRules: { requireToken: true, tokenCost: 3, dailyLimit: 3, cooldownMinutes: 30 },
    },
    [RankingType.地榜]: {
      type: RankingType.地榜,
      name: '地榜',
      description: '一流高手榜，江湖中坚力量的证明。',
      maxEntries: 50,
      minLevel: 30,
      entryReward: { goldPerRank: 50, reputationBonus: 1.1 },
      challengeRules: { requireToken: true, tokenCost: 1, dailyLimit: 5, cooldownMinutes: 10 },
    },
    [RankingType.玄榜]: {
      type: RankingType.玄榜,
      name: '玄榜',
      description: '新秀榜，记录江湖新星的崛起之路。',
      maxEntries: 100,
      minLevel: 10,
      entryReward: { goldPerRank: 10, reputationBonus: 1.05 },
      challengeRules: { requireToken: false, dailyLimit: 10, cooldownMinutes: 5 },
    },
  });

  const playerRankingInfo = ref<Record<RankingType, PlayerRankingInfo>>({
    [RankingType.天榜]: { bestRank: undefined, dailyChallengesRemaining: 3 },
    [RankingType.地榜]: { bestRank: undefined, dailyChallengesRemaining: 5 },
    [RankingType.玄榜]: { bestRank: undefined, dailyChallengesRemaining: 10 },
  });

  const stats = ref<RankingStats>({
    totalChallengers: 0,
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
  });

  const initialized = ref(false);

  async function init(): Promise<void> {
    if (initialized.value) return;

    // Parse config
    const config = JSON5.parse(JIANGHU_RANKING_RAW) as unknown as JianghuRankingConfigData;

    // Populate 玄榜
    if (config.defaultEntries?.玄榜) {
      rankings.value[RankingType.玄榜] = config.defaultEntries.玄榜.map(entry => ({
        id: `npc_${entry.name}`,
        rankingType: RankingType.玄榜,
        rank: entry.rank,
        name: entry.name,
        level: entry.level,
        sect: entry.sect,
        combatPower: entry.combatPower,
        lastUpdated: Date.now(),
        status: RankingEntryStatus.在榜,
        rankChange: 0,
        rankChangeType: 'same',
      }));
    }

    // Populate 地榜
    if (config.defaultEntries?.地榜) {
      rankings.value[RankingType.地榜] = config.defaultEntries.地榜.map(entry => ({
        id: `npc_${entry.name}`,
        rankingType: RankingType.地榜,
        rank: entry.rank,
        name: entry.name,
        level: entry.level,
        sect: entry.sect,
        combatPower: entry.combatPower,
        lastUpdated: Date.now(),
        status: RankingEntryStatus.在榜,
        rankChange: 0,
        rankChangeType: 'same',
      }));
    }

    // Populate 天榜
    if (config.defaultEntries?.天榜) {
      rankings.value[RankingType.天榜] = config.defaultEntries.天榜.map(entry => ({
        id: `npc_${entry.name}`,
        rankingType: RankingType.天榜,
        rank: entry.rank,
        name: entry.name,
        level: entry.level,
        sect: entry.sect,
        combatPower: entry.combatPower,
        lastUpdated: Date.now(),
        status: RankingEntryStatus.在榜,
        rankChange: 0,
        rankChangeType: 'same',
      }));
    }

    console.log(
      `[JianghuRankingStore] 初始化完成: 天榜 ${rankings.value[RankingType.天榜].length} 人, 地榜 ${rankings.value[RankingType.地榜].length} 人, 玄榜 ${rankings.value[RankingType.玄榜].length} 人`
    );

    initialized.value = true;
  }

  function getRanking(type: RankingType): RankingEntry[] {
    return rankings.value[type] || [];
  }

  function getPlayerRank(type: RankingType, playerId: string): number | undefined {
    const list = rankings.value[type] || [];
    const entry = list.find(e => e.id === playerId);
    return entry?.rank;
  }

  function isPlayerOnRank(type: RankingType, playerId: string): boolean {
    return rankings.value[type]?.some(e => e.id === playerId) || false;
  }

  function getPlayerInfo(type: RankingType): PlayerRankingInfo {
    return playerRankingInfo.value[type];
  }

  function getStats(): RankingStats {
    return stats.value;
  }

  function getConfig(type: RankingType): RankingConfig | undefined {
    return configs.value[type];
  }

  function getTopN(type: RankingType, n: number): RankingEntry[] {
    const list = rankings.value[type] || [];
    return list.slice(0, n);
  }

  function getPlayerPosition(type: RankingType, playerId: string): number {
    const list = rankings.value[type] || [];
    const index = list.findIndex(e => e.id === playerId);
    return index >= 0 ? index + 1 : -1;
  }

  function updateRanking(type: RankingType, entry: RankingEntry): void {
    if (!rankings.value[type]) {
      rankings.value[type] = [];
    }
    const index = rankings.value[type].findIndex(e => e.id === entry.id);
    if (index >= 0) {
      rankings.value[type][index] = entry;
    } else {
      rankings.value[type].push(entry);
    }
    // 确保按rank排序
    rankings.value[type].sort((a, b) => a.rank - b.rank);
  }

  function removeFromRanking(type: RankingType, playerId: string): void {
    rankings.value[type] = rankings.value[type]?.filter(e => e.id !== playerId) || [];
  }

  function recordChallengeResult(result: ChallengeResult): void {
    if (result === 'victory') {
      stats.value.totalWins++;
    } else if (result === 'defeat') {
      stats.value.totalLosses++;
    }
    stats.value.totalChallengers++;
    const total = stats.value.totalWins + stats.value.totalLosses;
    stats.value.winRate = total > 0 ? stats.value.totalWins / total : 0;
  }

  function decrementDailyChallenges(type: RankingType): boolean {
    const info = playerRankingInfo.value[type];
    if (info.dailyChallengesRemaining > 0) {
      info.dailyChallengesRemaining--;
      return true;
    }
    return false;
  }

  function resetDailyChallenges(type: RankingType): void {
    const config = configs.value[type];
    if (config?.challengeRules.dailyLimit) {
      playerRankingInfo.value[type].dailyChallengesRemaining = config.challengeRules.dailyLimit;
    }
  }

  function setPlayerRank(type: RankingType, rank: number): void {
    const info = playerRankingInfo.value[type];
    info.currentRank = rank;
    if (!info.bestRank || rank < info.bestRank) {
      info.bestRank = rank;
    }
  }

  function canChallenge(type: RankingType): { can: boolean; reason?: string } {
    const config = configs.value[type];
    if (!config) {
      return { can: false, reason: '榜单不存在' };
    }

    // Note: playerStore is not available here, so we can't check level
    // This will be handled by the service layer
    const info = playerRankingInfo.value[type];
    if (info.dailyChallengesRemaining <= 0) {
      return { can: false, reason: '今日挑战次数已用完' };
    }

    return { can: true };
  }

  async function challenge(
    type: RankingType,
    targetEntryId: string
  ): Promise<{
    result: string;
    oldRank: number;
    newRank: number;
    rewards: { gold: number; reputation: number; exp: number };
    log: string;
  } | null> {
    return null;
  }

  function loadFromSave(data: Record<RankingType, RankingEntry[]>): void {
    if (data) {
      rankings.value = data;
    }
  }

  function getSaveData(): Record<RankingType, RankingEntry[]> {
    return rankings.value;
  }

  return {
    rankings,
    configs,
    playerRankingInfo,
    stats,
    initialized,
    init,
    getRanking,
    getPlayerRank,
    isPlayerOnRank,
    getPlayerInfo,
    getStats,
    getConfig,
    getTopN,
    getPlayerPosition,
    updateRanking,
    removeFromRanking,
    recordChallengeResult,
    decrementDailyChallenges,
    resetDailyChallenges,
    setPlayerRank,
    canChallenge,
    challenge,
    loadFromSave,
    getSaveData,
  };
});
