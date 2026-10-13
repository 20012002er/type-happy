/**
 * 主线剧情状态管理
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  MainStoryProgress,
  CollectedFragment,
  MainStoryChapter,
  ChapterStatus,
  TruthFragment,
  FragmentCollection,
} from '@/types/truthFragment';
import { ChapterStatus as ChapterStatusEnum } from '@/types/truthFragment';

export type MainStoryNotificationPayload = {
  type: 'fragment.collected' | 'chapter.unlocked' | 'chapter.completed';
  title: string;
  message: string;
};

export interface MainStorySaveData {
  currentChapter: number;
  completedChapters: number[];
  currentNodeId: string;
  collectedFragments: CollectedFragment[];
  storyFlags: Record<string, boolean>;
  lastChapterAt?: number;
}

export const useMainStoryStore = defineStore('mainStory', () => {
  const progress = ref<MainStoryProgress>({
    currentChapter: 0,
    completedChapters: [],
    currentNodeId: 'start',
    fragmentCollection: {
      collectedFragments: [],
      totalCollected: 0,
    },
    storyFlags: {},
    lastChapterAt: undefined,
  });

  const initialized = ref(false);
  const chapters = ref<MainStoryChapter[]>([]);
  const fragments = ref<Record<string, TruthFragment>>({});

  let notificationCallback: ((payload: MainStoryNotificationPayload) => void) | null = null;

  const totalFragments = computed(() => Object.keys(fragments.value).length);

  const collectedCount = computed(
    () => progress.value.fragmentCollection.collectedFragments.length
  );

  const collectedFragmentIds = computed(() =>
    progress.value.fragmentCollection.collectedFragments.map(f => f.fragmentId)
  );

  const uncollectedFragments = computed(() => {
    const collected = new Set(collectedFragmentIds.value);
    return Object.values(fragments.value).filter(f => !collected.has(f.id));
  });

  const availableFragments = computed(() => {
    const collected = new Set(collectedFragmentIds.value);

    return Object.values(fragments.value).filter(fragment => {
      if (collected.has(fragment.id)) return false;

      if (fragment.requirements?.completedFragments) {
        const missing = fragment.requirements.completedFragments.filter(id => !collected.has(id));
        if (missing.length > 0) return false;
      }

      return true;
    });
  });

  const chapterStatus = computed((): Record<number, ChapterStatus> => {
    const statusMap: Record<number, ChapterStatus> = {};

    for (const chapter of chapters.value) {
      const completed = progress.value.completedChapters.includes(chapter.id);
      if (completed) {
        statusMap[chapter.id] = ChapterStatusEnum.COMPLETED;
      } else if (chapter.id === progress.value.currentChapter + 1) {
        statusMap[chapter.id] = ChapterStatusEnum.AVAILABLE;
      } else if (chapter.id <= progress.value.currentChapter) {
        statusMap[chapter.id] = ChapterStatusEnum.IN_PROGRESS;
      } else {
        statusMap[chapter.id] = ChapterStatusEnum.LOCKED;
      }
    }

    return statusMap;
  });

  async function init(
    chaptersData: MainStoryChapter[],
    fragmentsData: Record<string, TruthFragment>
  ): Promise<void> {
    if (initialized.value) return;

    chapters.value = chaptersData;
    fragments.value = fragmentsData;
    initialized.value = true;

    checkChapterUnlocks();
  }

  function registerNotificationCallback(callback: (payload: MainStoryNotificationPayload) => void) {
    notificationCallback = callback;
  }

  function sendNotification(payload: MainStoryNotificationPayload) {
    if (notificationCallback) {
      notificationCallback(payload);
    }
  }

  function collectFragment(fragmentId: string): boolean {
    const fragment = fragments.value[fragmentId];
    if (!fragment) return false;

    if (collectedFragmentIds.value.includes(fragmentId)) return false;

    progress.value.fragmentCollection.collectedFragments.push({
      fragmentId,
      collectedAt: Date.now(),
      read: false,
    });
    progress.value.fragmentCollection.totalCollected += 1;

    sendNotification({
      type: 'fragment.collected',
      title: '获得真相碎片',
      message: `【${fragment.name}】${fragment.description}`,
    });

    checkChapterUnlocks();

    return true;
  }

  function markFragmentAsRead(fragmentId: string): boolean {
    const collected = progress.value.fragmentCollection.collectedFragments.find(
      f => f.fragmentId === fragmentId
    );
    if (collected) {
      collected.read = true;
      return true;
    }
    return false;
  }

  function getFragmentStory(fragmentId: string): string | null {
    const fragment = fragments.value[fragmentId];
    if (!fragment) return null;

    const collected = progress.value.fragmentCollection.collectedFragments.find(
      f => f.fragmentId === fragmentId
    );
    if (!collected) return null;

    return fragment.storyContent;
  }

  function checkChapterUnlocks(): void {
    for (const chapter of chapters.value) {
      if (progress.value.completedChapters.includes(chapter.id)) continue;

      const canUnlock = checkChapterRequirements(chapter);
      if (canUnlock && chapter.id === progress.value.currentChapter + 1) {
        progress.value.currentChapter = chapter.id;
        progress.value.currentNodeId = 'start';

        sendNotification({
          type: 'chapter.unlocked',
          title: '新章节解锁',
          message: `【${chapter.name}】${chapter.description}`,
        });
      }
    }
  }

  function checkChapterRequirements(chapter: MainStoryChapter): boolean {
    const collectedIds = new Set(collectedFragmentIds.value);
    const collected = collectedIds.size;

    if (collected < chapter.requiredFragments) return false;

    if (chapter.fragmentsRequired.length > 0) {
      const missing = chapter.fragmentsRequired.filter(id => !collectedIds.has(id));
      if (missing.length > 0) return false;
    }

    return true;
  }

  function completeChapter(chapterId: number): boolean {
    if (!progress.value.completedChapters.includes(chapterId)) {
      progress.value.completedChapters.push(chapterId);
      progress.value.lastChapterAt = Date.now();

      sendNotification({
        type: 'chapter.completed',
        title: '章节完成',
        message: `完成【${chapters.value.find(c => c.id === chapterId)?.name}】！`,
      });

      return true;
    }
    return false;
  }

  function setStoryFlag(key: string, value: boolean): void {
    progress.value.storyFlags[key] = value;
  }

  function getStoryFlag(key: string): boolean {
    return progress.value.storyFlags[key] ?? false;
  }

  function getCurrentChapter(): MainStoryChapter | null {
    return chapters.value.find(c => c.id === progress.value.currentChapter) ?? null;
  }

  function getChapterProgress(chapterId: number): { current: number; total: number } {
    const chapter = chapters.value.find(c => c.id === chapterId);
    if (!chapter) return { current: 0, total: 0 };

    const collected = new Set(collectedFragmentIds.value);
    const required = chapter.fragmentsRequired.filter(id => collected.has(id)).length;
    const total = chapter.fragmentsRequired.length;

    return { current: required, total };
  }

  function loadFromSave(data?: MainStorySaveData): void {
    if (!data) {
      progress.value = {
        currentChapter: 0,
        completedChapters: [],
        currentNodeId: 'start',
        fragmentCollection: {
          collectedFragments: [],
          totalCollected: 0,
        },
        storyFlags: {},
        lastChapterAt: undefined,
      };
      return;
    }

    progress.value = {
      currentChapter: data.currentChapter,
      completedChapters: data.completedChapters,
      currentNodeId: data.currentNodeId,
      fragmentCollection: {
        collectedFragments: data.collectedFragments,
        totalCollected: data.collectedFragments.length,
      },
      storyFlags: data.storyFlags || {},
      lastChapterAt: data.lastChapterAt,
    };
  }

  function getSaveData(): MainStorySaveData {
    return {
      currentChapter: progress.value.currentChapter,
      completedChapters: progress.value.completedChapters,
      currentNodeId: progress.value.currentNodeId,
      collectedFragments: progress.value.fragmentCollection.collectedFragments,
      storyFlags: progress.value.storyFlags,
      lastChapterAt: progress.value.lastChapterAt,
    };
  }

  function resetProgress(): void {
    progress.value = {
      currentChapter: 0,
      completedChapters: [],
      currentNodeId: 'start',
      fragmentCollection: {
        collectedFragments: [],
        totalCollected: 0,
      },
      storyFlags: {},
      lastChapterAt: undefined,
    };
    checkChapterUnlocks();
  }

  return {
    progress,
    initialized,
    chapters,
    totalFragments,
    collectedCount,
    collectedFragmentIds,
    uncollectedFragments,
    availableFragments,
    chapterStatus,
    init,
    registerNotificationCallback,
    collectFragment,
    markFragmentAsRead,
    getFragmentStory,
    completeChapter,
    setStoryFlag,
    getStoryFlag,
    getCurrentChapter,
    getChapterProgress,
    loadFromSave,
    getSaveData,
    resetProgress,
  };
});
