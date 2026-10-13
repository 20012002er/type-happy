import { usePlayerStore } from '@/stores/playerStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { AchievementConfigService } from '@/services/config/AchievementConfigService';
import { ReputationService } from '@/services/reputationService';
import type {
  Achievement,
  AchievementConfig,
  AchievementObjective,
  AchievementReward,
} from '@/types/achievement';
import { AchievementObjectiveType, AchievementStatus } from '@/types/achievement';
import type { AchievementSaveEntry } from '@/stores/achievementStore';

export class AchievementService {
  static createAchievement(config: AchievementConfig): Achievement {
    return {
      ...config,
      status: this.determineInitialStatus(config),
      objectives: config.objectives.map<AchievementObjective>(objective => ({
        ...objective,
        current: 0,
      })),
    };
  }

  private static determineInitialStatus(config: AchievementConfig): AchievementStatus {
    if (config.hidden) {
      return AchievementStatus.LOCKED;
    }
    return this.checkRequirements(config)
      ? AchievementStatus.IN_PROGRESS
      : AchievementStatus.LOCKED;
  }

  static checkRequirements(config: AchievementConfig): boolean {
    const requirements = config.requirements;
    if (!requirements) return true;

    const playerStore = usePlayerStore();

    if (requirements.level && playerStore.player.stats.level < requirements.level) {
      return false;
    }

    // 检查前置成就是否完成
    if (requirements.completedIds && requirements.completedIds.length > 0) {
      // 需要从成就Store获取，这里简化处理
      // 实际应该传入achievementStore或achievements列表
    }

    return true;
  }

  /**
   * 检测玩家加入门派事件
   */
  static checkJoinSect(sectType: string): void {
    const achievementStore = import('@/stores/achievementStore').then(({ useAchievementStore }) => {
      const store = useAchievementStore();
      store.notifyProgress({
        type: AchievementObjectiveType.JOIN_SECT,
        target: sectType,
        amount: 1,
      });
    });
  }

  /**
   * 检测玩家获得称号事件
   */
  static checkReachTitle(titleName: string): void {
    const achievementStore = import('@/stores/achievementStore').then(({ useAchievementStore }) => {
      const store = useAchievementStore();
      store.notifyProgress({
        type: AchievementObjectiveType.REACH_TITLE,
        target: titleName,
        amount: 1,
      });
    });
  }

  /**
   * 检测玩家收集真相碎片事件
   */
  static checkCollectTruthFragment(count: number): void {
    const achievementStore = import('@/stores/achievementStore').then(({ useAchievementStore }) => {
      const store = useAchievementStore();
      store.notifyProgress({
        type: AchievementObjectiveType.COLLECT_TRUTH_FRAGMENT,
        target: count,
        amount: count,
      });
    });
  }

  /**
   * 检测玩家完成主线章节事件
   */
  static checkCompleteChapter(chapterNumber: number): void {
    const achievementStore = import('@/stores/achievementStore').then(({ useAchievementStore }) => {
      const store = useAchievementStore();
      store.notifyProgress({
        type: AchievementObjectiveType.COMPLETE_CHAPTER,
        target: chapterNumber,
        amount: 1,
      });
    });
  }

  /**
   * 检测阶段进度变化（需要外部调用）
   * 当玩家数据变化时调用此方法检查相关成就
   */
  static checkPhaseProgress(): void {
    const playerStore = usePlayerStore();

    // 检测称号变化 - 每次检查所有称号类成就
    // 实际应用中应该在称号变化时调用 checkReachTitle
  }

  static unlockAchievement(achievement: Achievement) {
    if (achievement.status !== AchievementStatus.LOCKED) return;
    achievement.status = AchievementStatus.IN_PROGRESS;
    achievement.unlockedAt = Date.now();
  }

  static updateObjective(
    achievement: Achievement,
    type: AchievementObjectiveType,
    target: string | number,
    increment = 1
  ): boolean {
    if (achievement.status !== AchievementStatus.IN_PROGRESS) return false;

    let updated = false;

    for (const objective of achievement.objectives) {
      if (objective.type !== type) continue;

      const matchesTarget = this.matchesTarget(objective.target, target);

      if (!matchesTarget) continue;

      const nextValue = Math.min(objective.current + increment, objective.required);
      if (nextValue !== objective.current) {
        objective.current = nextValue;
        updated = true;
      }
    }

    if (updated && this.isCompleted(achievement)) {
      this.completeAchievement(achievement);
    }

    return updated;
  }

  /**
   * 判断目标是否匹配
   */
  private static matchesTarget(
    objectiveTarget: string | number,
    actualTarget: string | number
  ): boolean {
    // 任意匹配
    if (objectiveTarget === 'any' || actualTarget === 'any') {
      return true;
    }
    // 数字类型比较（如收集碎片数量）
    if (typeof objectiveTarget === 'number' && typeof actualTarget === 'number') {
      return true; // 对于收集类成就，计数增加即可
    }
    // 字符串类型比较（如门派类型、称号名称）
    if (typeof objectiveTarget === 'string' && typeof actualTarget === 'string') {
      return objectiveTarget === actualTarget;
    }
    return false;
  }

  static isCompleted(achievement: Achievement): boolean {
    return achievement.objectives.every(obj => obj.current >= obj.required);
  }

  private static completeAchievement(achievement: Achievement): void {
    if (achievement.status !== AchievementStatus.IN_PROGRESS) return;
    achievement.status = AchievementStatus.COMPLETED;
    achievement.completedAt = Date.now();

    // 声望奖励
    ReputationService.onAchievementUnlock(achievement.name);
  }

  static awardReward(achievement: Achievement): void {
    if (achievement.status !== AchievementStatus.COMPLETED || achievement.rewardedAt) return;

    const rewards = achievement.rewards;
    if (!rewards) {
      achievement.status = AchievementStatus.REWARDED;
      achievement.rewardedAt = Date.now();
      return;
    }

    const playerStore = usePlayerStore();
    const gameLogStore = useGameLogStore();

    const logParts: string[] = [];

    if (rewards.gold) {
      playerStore.updateResources({
        gold: playerStore.player.resources.gold + rewards.gold,
      });
      logParts.push(`金币 +${rewards.gold}`);
    }

    if (rewards.exp) {
      const levelUpResult = playerStore.gainExperience(rewards.exp);
      logParts.push(`经验 +${rewards.exp}`);
      if (levelUpResult) {
        gameLogStore.addLevelUpLog(`角色升级至 Lv.${levelUpResult.newLevel}`);
      }
    }

    if (rewards.reputation) {
      playerStore.updateResources({
        reputation: (playerStore.player.resources.reputation || 0) + rewards.reputation,
      });
      logParts.push(`声望 +${rewards.reputation}`);
    }

    if (rewards.insight) {
      import('@/stores/talentTreeStore')
        .then(({ useTalentTreeStore }) => {
          useTalentTreeStore().grantInsight(rewards.insight!);
          gameLogStore.addRewardLog(`悟性 +${rewards.insight}`);
        })
        .catch(error => console.warn('[AchievementService] 发放悟性失败:', error));
    }

    if (rewards.items && rewards.items.length > 0) {
      logParts.push(`物品 ×${rewards.items.length}`);
      // TODO: integrate with inventory when系统完成
    }

    if (logParts.length > 0) {
      gameLogStore.addRewardLog(`成就奖励：${logParts.join('、')}`);
    }

    achievement.status = AchievementStatus.REWARDED;
    achievement.rewardedAt = Date.now();
  }

  static mergeWithConfig(saved: AchievementSaveEntry[]): Achievement[] {
    const configs = AchievementConfigService.getAllAchievements();
    const result: Achievement[] = [];

    for (const config of configs) {
      const existing = saved.find(a => a.id === config.id);
      if (!existing) {
        result.push(this.createAchievement(config));
        continue;
      }

      result.push({
        ...config,
        status: existing.status,
        objectives: config.objectives.map(objective => {
          const savedObj = existing.objectives.find(
            o => o.type === objective.type && o.target === objective.target
          );
          const current = Math.min(savedObj?.current ?? 0, objective.required);
          return {
            ...objective,
            current,
          };
        }),
        unlockedAt: existing.unlockedAt,
        completedAt: existing.completedAt,
        rewardedAt: existing.rewardedAt,
      });
    }

    return result;
  }

  static formatReward(reward?: AchievementReward): string {
    if (!reward) return '无';
    const parts: string[] = [];
    if (reward.gold) parts.push(`金币 +${reward.gold}`);
    if (reward.exp) parts.push(`经验 +${reward.exp}`);
    if (reward.reputation) parts.push(`声望 +${reward.reputation}`);
    if (reward.insight) parts.push(`悟性 +${reward.insight}`);
    if (reward.items?.length) parts.push(`物品 ×${reward.items.length}`);
    return parts.length > 0 ? parts.join('、') : '无';
  }
}

export const achievementService = AchievementService;
