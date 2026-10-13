/**
 * 主线剧情服务
 * 管理主线进度、真相碎片收集、剧情触发
 */

import JSON5 from 'json5';
import TRUTH_FRAGMENTS_RAW from '@/assets/configs/truth-fragments.json5?raw';
import type {
  MainStoryChapter,
  TruthFragment,
  MainStoryProgress,
  ChapterStatus,
} from '@/types/truthFragment';
import type { MainStorySaveData } from '@/stores/mainStoryStore';
import { useMainStoryStore } from '@/stores/mainStoryStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { AchievementService } from '@/services/achievementService';

interface TruthFragmentsConfig {
  version: string;
  totalFragments: number;
  chapters: MainStoryChapter[];
  fragments: Record<string, TruthFragment>;
}

export class MainStoryService {
  private static config: TruthFragmentsConfig | null = null;
  private static initialized = false;

  /**
   * 初始化主线剧情系统
   */
  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const parsed = JSON5.parse(TRUTH_FRAGMENTS_RAW);
      this.config = parsed as TruthFragmentsConfig;

      const store = useMainStoryStore();
      await store.init(this.config.chapters, this.config.fragments);

      this.initialized = true;
      console.log(
        '[MainStoryService] 初始化成功:',
        this.config.totalFragments,
        '个真相碎片,',
        this.config.chapters.length,
        '个章节'
      );
    } catch (error) {
      console.error('[MainStoryService] 初始化失败:', error);
      this.config = null;
      this.initialized = true;
    }
  }

  /**
   * 检查是否已初始化
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 收集真相碎片
   */
  static collectFragment(fragmentId: string): boolean {
    const store = useMainStoryStore();
    const result = store.collectFragment(fragmentId);

    if (result) {
      const fragment = this.getFragment(fragmentId);
      if (fragment) {
        if (fragment.rewards) {
          this.grantRewards(fragment.rewards);
        }

        AchievementService.checkCollectTruthFragment(store.collectedCount);
      }
    }

    return result;
  }

  /**
   * 获取碎片信息
   */
  static getFragment(fragmentId: string): TruthFragment | null {
    if (!this.config) return null;
    return this.config.fragments[fragmentId] || null;
  }

  /**
   * 获取所有可收集的碎片
   */
  static getAvailableFragments(): TruthFragment[] {
    const store = useMainStoryStore();
    return store.availableFragments;
  }

  /**
   * 获取已收集的碎片
   */
  static getCollectedFragments(): TruthFragment[] {
    const store = useMainStoryStore();
    return store.collectedFragmentIds
      .map(id => this.getFragment(id))
      .filter(Boolean) as TruthFragment[];
  }

  /**
   * 获取章节信息
   */
  static getChapter(chapterId: number): MainStoryChapter | null {
    if (!this.config) return null;
    return this.config.chapters.find(c => c.id === chapterId) || null;
  }

  /**
   * 获取当前章节
   */
  static getCurrentChapter(): MainStoryChapter | null {
    const store = useMainStoryStore();
    return store.getCurrentChapter();
  }

  /**
   * 获取章节状态
   */
  static getChapterStatus(chapterId: number): ChapterStatus | null {
    const store = useMainStoryStore();
    return store.chapterStatus[chapterId] || null;
  }

  /**
   * 完成章节
   */
  static completeChapter(chapterId: number): boolean {
    const store = useMainStoryStore();
    const result = store.completeChapter(chapterId);

    if (result) {
      const chapter = this.getChapter(chapterId);
      if (chapter?.rewards) {
        this.grantRewards(chapter.rewards);
      }

      // 通知成就系统
      if (chapterId === 5) {
        AchievementService.checkCompleteChapter(5);
      }
    }

    return result;
  }

  /**
   * 设置剧情标记
   */
  static setStoryFlag(key: string, value: boolean): void {
    const store = useMainStoryStore();
    store.setStoryFlag(key, value);
  }

  /**
   * 获取剧情标记
   */
  static getStoryFlag(key: string): boolean {
    const store = useMainStoryStore();
    return store.getStoryFlag(key);
  }

  /**
   * 检查剧情标记是否满足条件
   */
  static checkFlagCondition(condition: { flagKey: string; flagValue?: boolean }): boolean {
    const currentValue = this.getStoryFlag(condition.flagKey);
    if (condition.flagValue !== undefined) {
      return currentValue === condition.flagValue;
    }
    return currentValue;
  }

  /**
   * 获取章节进度
   */
  static getChapterProgress(chapterId: number): { current: number; total: number } {
    const store = useMainStoryStore();
    return store.getChapterProgress(chapterId);
  }

  /**
   * 获取整体进度
   */
  static getOverallProgress(): { fragments: number; chapters: number } {
    const store = useMainStoryStore();
    return {
      fragments: store.collectedCount,
      chapters: store.progress.completedChapters.length,
    };
  }

  /**
   * 触发剧情事件
   */
  static triggerEvent(eventType: string, data?: Record<string, unknown>): void {
    const store = useMainStoryStore();

    switch (eventType) {
      case 'location.visit':
        if (data?.locationId) {
          this.checkLocationEvent(data.locationId as string);
        }
        break;
      case 'task.complete':
        if (data?.taskId) {
          this.checkTaskEvent(data.taskId as string);
        }
        break;
      case 'npc.interact':
        if (data?.npcId) {
          this.checkNPCEvent(data.npcId as string);
        }
        break;
    }
  }

  /**
   * 检查地点事件触发
   */
  private static checkLocationEvent(locationId: string): void {
    if (!this.config) return;

    for (const fragment of Object.values(this.config.fragments)) {
      if (
        fragment.sourceType === 'location_interaction' &&
        fragment.sourceId === locationId &&
        this.canCollectFragment(fragment.id)
      ) {
        this.collectFragment(fragment.id);
        return;
      }
    }
  }

  /**
   * 检查任务事件触发
   */
  private static checkTaskEvent(taskId: string): void {
    if (!this.config) return;

    for (const fragment of Object.values(this.config.fragments)) {
      if (
        fragment.sourceType === 'task_reward' &&
        fragment.sourceId === taskId &&
        this.canCollectFragment(fragment.id)
      ) {
        this.collectFragment(fragment.id);
        return;
      }
    }
  }

  /**
   * 检查NPC交互事件触发
   */
  private static checkNPCEvent(npcId: string): void {
    if (!this.config) return;

    for (const fragment of Object.values(this.config.fragments)) {
      if (
        fragment.sourceType === 'npc_gift' &&
        fragment.sourceId === npcId &&
        this.canCollectFragment(fragment.id)
      ) {
        this.collectFragment(fragment.id);
        return;
      }
    }
  }

  /**
   * 检查是否可以收集碎片
   */
  private static canCollectFragment(fragmentId: string): boolean {
    const store = useMainStoryStore();
    return store.availableFragments.some(f => f.id === fragmentId);
  }

  /**
   * 发放奖励
   */
  private static grantRewards(rewards: { exp?: number; gold?: number; reputation?: number }): void {
    const playerStore = import('@/stores/playerStore').then(({ usePlayerStore }) => {
      const store = usePlayerStore();
      const gameLogStore = useGameLogStore();

      if (rewards.gold) {
        store.updateResources({ gold: store.player.resources.gold + rewards.gold });
        gameLogStore.addLog(`获得 ${rewards.gold} 金币`);
      }

      if (rewards.exp) {
        store.gainExperience(rewards.exp);
        gameLogStore.addLog(`获得 ${rewards.exp} 经验`);
      }

      if (rewards.reputation) {
        store.updateResources({
          reputation: (store.player.resources.reputation || 0) + rewards.reputation,
        });
        gameLogStore.addLog(`获得 ${rewards.reputation} 声望`);
      }
    });
  }

  /**
   * 获取碎片故事内容
   */
  static getFragmentStory(fragmentId: string): string | null {
    const store = useMainStoryStore();
    return store.getFragmentStory(fragmentId);
  }

  /**
   * 将碎片标记为已读
   */
  static markFragmentAsRead(fragmentId: string): void {
    const store = useMainStoryStore();
    store.markFragmentAsRead(fragmentId);
  }

  /**
   * 存档/读档
   */
  static loadFromSave(data: MainStorySaveData): void {
    const store = useMainStoryStore();
    store.loadFromSave(data);
  }

  static getSaveData(): MainStorySaveData {
    const store = useMainStoryStore();
    return store.getSaveData();
  }

  /**
   * 重置进度
   */
  static resetProgress(): void {
    const store = useMainStoryStore();
    store.resetProgress();
  }
}

export const mainStoryService = MainStoryService;
