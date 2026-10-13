import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  Achievement,
  AchievementCategory,
  AchievementObjectiveType,
  AchievementSummary
} from '@/types/achievement';
import {
  AchievementConfigService
} from '@/services/config/AchievementConfigService';
import { AchievementService } from '@/services/achievementService';
import {
  AchievementStatus
} from '@/types/achievement';

export type AchievementNotificationPayload = {
  type: 'completed';
  title: string;
  message: string;
};

export interface AchievementSaveEntry {
  id: string;
  status: AchievementStatus;
  unlockedAt?: number;
  completedAt?: number;
  rewardedAt?: number;
  objectives: Array<{
    type: AchievementObjectiveType;
    target: string | number;
    current: number;
    required: number;
  }>;
}

export const useAchievementStore = defineStore('achievement', () => {
  const achievements = ref<Achievement[]>([]);
  const initialized = ref(false);

  let notificationCallback: ((payload: AchievementNotificationPayload) => void) | null = null;

  const summary = computed<AchievementSummary>(() => {
    const total = achievements.value.length;
    let completed = 0;
    let pointsEarned = 0;
    let pointsTotal = 0;

    for (const achievement of achievements.value) {
      pointsTotal += achievement.points;
      if (
        achievement.status === AchievementStatus.COMPLETED ||
        achievement.status === AchievementStatus.REWARDED
      ) {
        completed += 1;
        pointsEarned += achievement.points;
      }
    }

    return {
      total,
      completed,
      pointsEarned,
      pointsTotal
    };
  });

  const byCategory = computed(() => {
    const map = new Map<AchievementCategory, Achievement[]>();
    for (const achievement of achievements.value) {
      const list = map.get(achievement.category) ?? [];
      list.push(achievement);
      map.set(achievement.category, list);
    }
    return map;
  });

  const inProgress = computed(() =>
    achievements.value.filter(a => a.status === AchievementStatus.IN_PROGRESS)
  );

  const completed = computed(() =>
    achievements.value.filter(a =>
      a.status === AchievementStatus.COMPLETED || a.status === AchievementStatus.REWARDED
    )
  );

  async function init(): Promise<void> {
    if (initialized.value) return;
    await AchievementConfigService.init();
    const configs = AchievementConfigService.getAllAchievements();
    achievements.value = configs.map(cfg => AchievementService.createAchievement(cfg));
    checkUnlocks();
    initialized.value = true;
  }

  function registerNotificationCallback(callback: (payload: AchievementNotificationPayload) => void) {
    notificationCallback = callback;
  }

  function getAchievement(id: string): Achievement | undefined {
    return achievements.value.find(a => a.id === id);
  }

  function notifyProgress(event: { type: string; target: string | number; amount?: number }) {
    const amount = event.amount ?? 1;
    let updated = false;
    const completedNow: Achievement[] = [];

    for (const achievement of inProgress.value) {
      const wasCompleted = achievement.status === AchievementStatus.COMPLETED;
      const changed = AchievementService.updateObjective(
        achievement,
        event.type as AchievementObjectiveType,
        event.target,
        amount
      );
      if (changed) {
        updated = true;
        const isCompletedNow = achievement.status === AchievementStatus.COMPLETED;
        if (!wasCompleted && isCompletedNow) {
          completedNow.push(achievement);
        }
      }
    }

    if (updated) {
      checkUnlocks();
    }

    if (completedNow.length > 0) {
      for (const achievement of completedNow) {
        sendNotification({
          type: 'completed',
          title: '成就达成',
          message: `【${achievement.name}】${achievement.description}`
        });
        AchievementService.awardReward(achievement);
      }
    }
  }

  function sendNotification(payload: AchievementNotificationPayload) {
    if (notificationCallback) {
      notificationCallback(payload);
    }
  }

  function checkUnlocks() {
    for (const achievement of achievements.value) {
      if (achievement.status === AchievementStatus.LOCKED) {
        if (AchievementService.checkRequirements(achievement)) {
          AchievementService.unlockAchievement(achievement);
        }
      }
    }
  }

  function resetAll() {
    for (const achievement of achievements.value) {
      achievement.status = AchievementStatus.LOCKED;
      achievement.objectives.forEach(obj => (obj.current = 0));
      achievement.unlockedAt = undefined;
      achievement.completedAt = undefined;
      achievement.rewardedAt = undefined;
    }
    checkUnlocks();
  }

  function loadFromSave(entries?: AchievementSaveEntry[]) {
    if (!entries || entries.length === 0) {
      checkUnlocks();
      return;
    }
    const merged = AchievementService.mergeWithConfig(entries);
    achievements.value = merged;
    checkUnlocks();
  }

  function getSaveData(): AchievementSaveEntry[] {
    return achievements.value.map(achievement => ({
      id: achievement.id,
      status: achievement.status,
      unlockedAt: achievement.unlockedAt,
      completedAt: achievement.completedAt,
      rewardedAt: achievement.rewardedAt,
      objectives: achievement.objectives.map(obj => ({
        type: obj.type,
        target: obj.target,
        current: obj.current,
        required: obj.required
      }))
    }));
  }

  return {
    achievements,
    initialized,
    summary,
    byCategory,
    inProgress,
    completed,
    init,
    getAchievement,
    notifyProgress,
    registerNotificationCallback,
    checkUnlocks,
    resetAll,
    loadFromSave,
    getSaveData
  };
});


