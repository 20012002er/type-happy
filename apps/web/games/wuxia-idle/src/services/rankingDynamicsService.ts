/**
 * 江湖榜动态排名服务
 * 处理排名的动态变化、周期性更新、角色生死和备用角色补位
 */

import { useJianghuRankingStore } from '@/stores/jianghuRankingStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import {
  RankingType,
  RankingEntryStatus,
  type RankingEntry,
  type RankChangeType,
  type RankingConfig,
  type BackupPoolEntry,
  type JianghuRankingConfigData,
} from '@/types/jianghuRanking';
import JIANGHU_RANKING_RAW from '@/assets/configs/jianghu-ranking.json5?raw';
import JSON5 from 'json5';

interface DynamicRankingConfig {
  enabled: boolean;
  updateIntervalHours: number;
  fluctuationRange: number;
  npcVictoryBoost: number;
  npcDefeatPenalty: number;
  backupPromotionChance: number;
}

class RankingDynamicsService {
  private static instance: RankingDynamicsService | null = null;
  private updateTimer: number | null = null;
  private lastUpdateTime: number = 0;
  private config: DynamicRankingConfig | null = null;
  private backupPools: Record<string, BackupPoolEntry[]> = {
    玄榜: [],
    地榜: [],
    天榜: [],
  };

  private constructor() {}

  static getInstance(): RankingDynamicsService {
    if (!RankingDynamicsService.instance) {
      RankingDynamicsService.instance = new RankingDynamicsService();
    }
    return RankingDynamicsService.instance;
  }

  /**
   * 初始化动态排名服务
   */
  async init(config?: RankingConfig): Promise<void> {
    const store = useJianghuRankingStore();
    await store.init();

    // 加载配置和备用角色池
    this.loadConfig();

    // 设置定时更新
    this.startAutoUpdate(this.config?.updateIntervalHours || 6);

    console.log('[RankingDynamicsService] 动态排名服务已启动');
  }

  /**
   * 加载配置
   */
  private loadConfig(): void {
    try {
      const fullConfig = JSON5.parse(JIANGHU_RANKING_RAW) as unknown as JianghuRankingConfigData;

      this.config = {
        enabled: fullConfig.dynamicRanking.enabled,
        updateIntervalHours: fullConfig.dynamicRanking.updateIntervalHours,
        fluctuationRange: fullConfig.dynamicRanking.fluctuationRange,
        npcVictoryBoost: fullConfig.dynamicRanking.npcVictoryBoost,
        npcDefeatPenalty: fullConfig.dynamicRanking.npcDefeatPenalty,
        backupPromotionChance: fullConfig.dynamicRanking.backupPromotionChance,
      };

      // 加载备用角色池
      if (fullConfig.backupPool) {
        this.backupPools = {
          玄榜: [...fullConfig.backupPool.玄榜],
          地榜: [...fullConfig.backupPool.地榜],
          天榜: [...fullConfig.backupPool.天榜],
        };
      }

      console.log('[RankingDynamicsService] 配置加载完成', {
        玄榜备用: this.backupPools.玄榜.length,
        地榜备用: this.backupPools.地榜.length,
        天榜备用: this.backupPools.天榜.length,
      });
    } catch (error) {
      console.error('[RankingDynamicsService] 配置加载失败:', error);
    }
  }

  /**
   * 启动自动更新
   */
  private startAutoUpdate(intervalHours: number): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.updateTimer = window.setInterval(() => {
      this.checkAndUpdateRankings();
    }, intervalMs);

    console.log(`[RankingDynamicsService] 自动更新已设置，每 ${intervalHours} 小时执行一次`);
  }

  /**
   * 检查并更新排名
   */
  async checkAndUpdateRankings(): Promise<void> {
    if (!this.config?.enabled) return;

    const now = Date.now();

    // 检查是否达到更新间隔
    const updateIntervalHours = this.config.updateIntervalHours;
    if (now - this.lastUpdateTime < updateIntervalHours * 60 * 60 * 1000) {
      return;
    }

    console.log('[RankingDynamicsService] 执行动态排名更新');

    // 更新所有榜单
    await this.updateAllRankings();

    // 尝试从备用池补位
    await this.promoteFromBackupPool();

    this.lastUpdateTime = now;
  }

  /**
   * 更新所有榜单的排名
   */
  async updateAllRankings(): Promise<void> {
    const store = useJianghuRankingStore();
    const logStore = useGameLogStore();

    const rankingTypes: RankingType[] = [RankingType.玄榜, RankingType.地榜, RankingType.天榜];

    for (const type of rankingTypes) {
      const entries = store.getRanking(type);
      if (entries.length === 0) continue;

      // 重置所有条目的排名变化
      const updatedEntries = entries.map(entry => {
        if (entry.rankChangeType !== 'new') {
          return { ...entry, rankChange: 0, rankChangeType: 'same' as RankChangeType };
        }
        return entry;
      });

      // 随机波动排名
      const fluctuationRange = this.config?.fluctuationRange || 3;
      const shuffled = this.shuffleArray([...updatedEntries]);

      // 对部分条目进行小幅排名变动
      for (let i = 0; i < shuffled.length * 0.3; i++) {
        const entry = shuffled[i];
        if (entry.rankChangeType === 'new') continue;

        const change = Math.floor(Math.random() * fluctuationRange * 2) - fluctuationRange;
        const newRank = Math.max(1, Math.min(entry.rank + change, updatedEntries.length));

        if (newRank !== entry.rank) {
          const rankDiff = entry.rank - newRank;
          entry.rank = newRank;
          entry.rankChange = rankDiff;
          entry.rankChangeType = rankDiff > 0 ? 'up' : 'down';
          entry.lastRankChange = Date.now();
        }
      }

      // 重新按排名排序
      updatedEntries.sort((a, b) => a.rank - b.rank);

      // 更新排名编号
      for (let i = 0; i < updatedEntries.length; i++) {
        updatedEntries[i].rank = i + 1;
      }

      // 更新到store
      for (const entry of updatedEntries) {
        store.updateRanking(type, entry);
      }

      // 记录日志
      const changedCount = updatedEntries.filter(
        e => e.rankChange !== 0 && e.rankChange !== undefined
      ).length;
      if (changedCount > 0) {
        logStore.addSystemLog(
          `【${this.getRankingName(type)}】排名已更新，${changedCount} 位高手排名变动`
        );
      }
    }
  }

  /**
   * 从备用池补充角色
   */
  async promoteFromBackupPool(): Promise<void> {
    const store = useJianghuRankingStore();
    const logStore = useGameLogStore();

    const rankingTypes: RankingType[] = [RankingType.玄榜, RankingType.地榜, RankingType.天榜];

    for (const type of rankingTypes) {
      const entries = store.getRanking(type);
      const config = store.getConfig(type);
      if (!config) continue;

      // 检查是否有空缺
      const maxEntries = config.maxEntries;
      if (entries.length >= maxEntries) continue;

      // 获取备用池
      const poolKey = this.getRankingName(type) as '玄榜' | '地榜' | '天榜';
      const backupPool = this.backupPools[poolKey];
      if (!backupPool || backupPool.length === 0) continue;

      // 随机决定是否补位
      if (Math.random() > (this.config?.backupPromotionChance || 0.5)) continue;

      // 随机选择一个备用角色
      const randomIndex = Math.floor(Math.random() * backupPool.length);
      const backupEntry = backupPool[randomIndex];

      // 创建新条目
      const newEntry: RankingEntry = {
        id: `backup_${backupEntry.name}_${Date.now()}`,
        rankingType: type,
        rank: entries.length + 1,
        name: backupEntry.name,
        level: backupEntry.level,
        sect: backupEntry.sect,
        combatPower: backupEntry.combatPower,
        lastUpdated: Date.now(),
        status: RankingEntryStatus.在榜,
        rankChange: 0,
        rankChangeType: 'new',
        lastRankChange: Date.now(),
      };

      // 添加到榜单
      store.updateRanking(type, newEntry);
      logStore.addSystemLog(
        `【${this.getRankingName(type)}】${backupEntry.name} 冲入榜单，位列第 ${newEntry.rank} 名`
      );

      // 从备用池移除
      backupPool.splice(randomIndex, 1);
    }
  }

  /**
   * NPC被玩家击败 - 排名下降
   */
  async onNPCDefeated(
    npcId: string,
    npcName: string,
    rankingType: RankingType,
    isPlayerChallenger: boolean = false
  ): Promise<{ log: string }> {
    const store = useJianghuRankingStore();
    const logStore = useGameLogStore();

    const entries = store.getRanking(rankingType);
    const entryIndex = entries.findIndex(e => e.id === npcId || e.name === npcName);

    if (entryIndex === -1) {
      return { log: `${npcName} 不在榜单上` };
    }

    const entry = entries[entryIndex];
    const oldRank = entry.rank;

    // NPC排名下降一位
    const newRank = Math.min(entry.rank + 1, entries.length);

    entry.rank = newRank;
    entry.rankChange = oldRank - newRank;
    entry.rankChangeType = 'down';
    entry.lastRankChange = Date.now();
    entry.lastUpdated = Date.now();

    store.updateRanking(rankingType, entry);

    const logMessage = `【江湖榜】${npcName} 排名下降至第 ${newRank} 名`;
    logStore.addCombatLog(logMessage);

    return { log: logMessage };
  }

  /**
   * 当NPC战斗获胜时调用
   */
  async onNPCVictory(npcId: string, npcName: string, rankingType: RankingType): Promise<void> {
    const store = useJianghuRankingStore();
    const logStore = useGameLogStore();

    const entries = store.getRanking(rankingType);
    const entry = entries.find(e => e.id === npcId || e.name === npcName);

    if (!entry) return;

    const oldRank = entry.rank;

    // NPC排名上升
    const boost = this.config?.npcVictoryBoost || 2;
    const newRank = Math.max(1, entry.rank - boost);

    entry.rank = newRank;
    entry.rankChange = oldRank - newRank;
    entry.rankChangeType = 'up';
    entry.lastRankChange = Date.now();
    entry.lastUpdated = Date.now();

    // 调整被超越的角色排名
    for (const e of entries) {
      if (e.id !== entry.id && e.rank >= newRank && e.rank < oldRank) {
        e.rank = e.rank + 1;
        e.rankChange = (e.rankChange || 0) + 1;
        e.rankChangeType = 'down';
        store.updateRanking(rankingType, e);
      }
    }

    store.updateRanking(rankingType, entry);

    logStore.addCombatLog(`【江湖榜】${npcName} 排名上升至第 ${newRank} 名`);
  }

  /**
   * 手动触发排名更新
   */
  async triggerManualUpdate(): Promise<void> {
    console.log('[RankingDynamicsService] 手动触发排名更新');
    await this.updateAllRankings();
    await this.promoteFromBackupPool();
    this.lastUpdateTime = Date.now();
  }

  /**
   * 获取排名变化显示文本
   */
  getRankChangeDisplay(change: number | undefined): { text: string; class: string } {
    if (change === undefined || change === 0) {
      return { text: '-', class: 'no-change' };
    }
    if (change > 0) {
      return { text: `↑${change}`, class: 'rank-up' };
    }
    return { text: `${change}`, class: 'rank-down' };
  }

  /**
   * 随机打乱数组
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * 获取榜单名称
   */
  private getRankingName(type: RankingType): string {
    const names: Record<string, string> = {
      tian: '天榜',
      di: '地榜',
      xuan: '玄榜',
    };
    return names[type] || type;
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    console.log('[RankingDynamicsService] 服务已停止');
  }
}

export const rankingDynamicsService = RankingDynamicsService.getInstance();
