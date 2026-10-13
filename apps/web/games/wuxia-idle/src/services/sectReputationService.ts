/**
 * 门派声望服务
 * 处理五大派（少林、武当、峨眉、华山、丐帮）的门派声望逻辑
 */

import { useReputationStore } from '@/stores/reputationStore';
import { useGameLogStore } from '@/stores/gameLogStore';
import { useSectStore } from '@/stores/sectStore';
import { sectReputationConfig, sectTaskConfig } from '@/assets/configs/sect-reputation-config';
import {
  SectType,
  SectReputationLevel,
  type SectReputationConfig,
  type SectReputationLevelConfig,
} from '@/types/reputation';

export class SectReputationService {
  /**
   * 获取所有门派类型
   */
  static getAllSectTypes(): SectType[] {
    return [SectType.少林, SectType.武当, SectType.峨眉, SectType.华山, SectType.丐帮];
  }

  /**
   * 获取门派配置
   */
  static getSectConfig(sectType: SectType): SectReputationConfig | null {
    const key = sectType as keyof typeof sectReputationConfig;
    const config = sectReputationConfig[key];
    if (!config) return null;
    // 确保类型安全
    return {
      ...config,
      sectType: sectType,
    };
  }

  /**
   * 获取门派名称
   */
  static getSectName(sectType: SectType): string {
    const config = this.getSectConfig(sectType);
    return config?.sectName || sectType;
  }

  /**
   * 根据声望值获取门派等级
   */
  static getSectLevelByPoints(sectType: SectType, points: number): SectReputationLevel {
    const config = this.getSectConfig(sectType);
    if (!config) return SectReputationLevel.外门弟子;

    // 从高到低查找
    for (let i = config.levels.length - 1; i >= 0; i--) {
      if (points >= config.levels[i].minPoints) {
        return config.levels[i].level;
      }
    }
    return SectReputationLevel.外门弟子;
  }

  /**
   * 获取门派等级配置
   */
  static getSectLevelConfig(
    sectType: SectType,
    level: SectReputationLevel
  ): SectReputationLevelConfig | undefined {
    const config = this.getSectConfig(sectType);
    if (!config) return undefined;
    return config.levels.find(l => l.level === level);
  }

  /**
   * 获取门派等级名称
   */
  static getSectLevelName(sectType: SectType, points: number): string {
    const level = this.getSectLevelByPoints(sectType, points);
    const levelConfig = this.getSectLevelConfig(sectType, level);
    return levelConfig?.name || '外门弟子';
  }

  /**
   * 获取门派等级称号
   */
  static getSectLevelTitle(sectType: SectType, points: number): string {
    const level = this.getSectLevelByPoints(sectType, points);
    const levelConfig = this.getSectLevelConfig(sectType, level);
    return levelConfig?.title || '外门弟子';
  }

  /**
   * 获取门派声望进度百分比
   */
  static getSectProgressPercent(sectType: SectType, currentPoints: number): number {
    const level = this.getSectLevelByPoints(sectType, currentPoints);
    const levelConfig = this.getSectLevelConfig(sectType, level);
    if (!levelConfig) return 0;

    const range = levelConfig.maxPoints - levelConfig.minPoints;
    const progress = currentPoints - levelConfig.minPoints;
    return Math.min(100, Math.max(0, (progress / range) * 100));
  }

  /**
   * 获取距离下一级所需声望
   */
  static getSectPointsToNextLevel(sectType: SectType, currentPoints: number): number {
    const config = this.getSectConfig(sectType);
    if (!config) return 0;

    const level = this.getSectLevelByPoints(sectType, currentPoints);
    const currentIndex = config.levels.findIndex(l => l.level === level);

    if (currentIndex >= config.levels.length - 1) {
      return 0; // 已是最高级
    }

    const nextLevel = config.levels[currentIndex + 1];
    return nextLevel.minPoints - currentPoints;
  }

  /**
   * 获取门派商店折扣
   */
  static getSectDiscount(sectType: SectType, points: number): number {
    const level = this.getSectLevelByPoints(sectType, points);
    const levelConfig = this.getSectLevelConfig(sectType, level);
    return levelConfig?.discountPercent || 0;
  }

  /**
   * 获取门派专属奖励
   */
  static getSectExclusiveRewards(sectType: SectType, points: number): string[] {
    const level = this.getSectLevelByPoints(sectType, points);
    const levelConfig = this.getSectLevelConfig(sectType, level);
    return levelConfig?.exclusiveRewards || [];
  }

  /**
   * 获取可进入的区域
   */
  static getSectAccessLevel(sectType: SectType, points: number): string {
    const level = this.getSectLevelByPoints(sectType, points);
    const levelConfig = this.getSectLevelConfig(sectType, level);
    return levelConfig?.accessLevel || '山门';
  }

  /**
   * 完成任务获得门派声望
   */
  static completeSectTask(sectType: SectType, taskId: string, taskPoints: number): number {
    const store = useReputationStore();
    const currentPoints = store.getSectReputation(sectType) + taskPoints;
    store.setSectReputation(sectType, currentPoints);
    useSectStore().setSectReputation(sectType, currentPoints);

    const sectName = this.getSectName(sectType);
    const logStore = useGameLogStore();
    logStore.addLog(`完成${sectName}任务，获得 ${taskPoints} 点门派声望`);

    return taskPoints;
  }

  /**
   * 完成门派任务（简化版本，使用配置）
   */
  static completeTaskFromConfig(sectType: SectType, taskIndex: number): number {
    const config = sectTaskConfig[sectType as keyof typeof sectTaskConfig];
    if (!config || !config.tasks[taskIndex]) {
      console.warn(`[SectReputation] 未找到门派任务: ${sectType} - ${taskIndex}`);
      return 0;
    }

    const task = config.tasks[taskIndex];
    return this.completeSectTask(sectType, task.id, task.points);
  }

  /**
   * 获得门派贡献度（捐赠获得）
   */
  static donateToSect(sectType: SectType, goldAmount: number): number {
    // 每10两银子 = 1点门派声望
    const points = Math.floor(goldAmount / 10);
    if (points <= 0) return 0;

    const store = useReputationStore();
    const currentPoints = store.getSectReputation(sectType) + points;
    store.setSectReputation(sectType, currentPoints);
    useSectStore().setSectReputation(sectType, currentPoints);

    const sectName = this.getSectName(sectType);
    const logStore = useGameLogStore();
    logStore.addLog(`向${sectName}捐赠 ${goldAmount} 两银子，获得 ${points} 点门派声望`);

    return points;
  }

  /**
   * 违反门规扣除声望
   */
  static violateSectRule(sectType: SectType, reason: string, points: number): number {
    const store = useReputationStore();
    const currentPoints = Math.max(0, store.getSectReputation(sectType) - points);
    store.setSectReputation(sectType, currentPoints);
    useSectStore().setSectReputation(sectType, currentPoints);

    const sectName = this.getSectName(sectType);
    const logStore = useGameLogStore();
    logStore.addLog(`${sectName}：${reason}，扣除 ${points} 点门派声望`);

    return points;
  }

  /**
   * 获取门派福利列表
   */
  static getSectBenefits(sectType: SectType): string[] {
    const config = this.getSectConfig(sectType);
    return config?.benefits || [];
  }

  /**
   * 获取门派修炼加成
   */
  static getSectTrainingBonus(sectType: SectType): {
    artCategory?: string;
    statBonus?: Record<string, number>;
  } {
    const config = this.getSectConfig(sectType);
    return config?.trainingBonus || {};
  }

  /**
   * 检查是否可以进入门派区域
   */
  static canEnterSectArea(
    sectType: SectType,
    points: number,
    areaId: string
  ): {
    allowed: boolean;
    reason?: string;
  } {
    const accessLevel = this.getSectAccessLevel(sectType, points);

    // 简化的权限检查
    const areaHierarchy = ['山门', '正殿', '前殿', '前院', '藏经阁', '后山', '禁地'];
    const requiredIndex = areaHierarchy.indexOf(areaId);
    const currentIndex = areaHierarchy.indexOf(accessLevel);

    if (requiredIndex > currentIndex && currentIndex >= 0) {
      return {
        allowed: false,
        reason: `需要${accessLevel}以上才可进入${areaId}`,
      };
    }

    return { allowed: true };
  }

  /**
   * 获取门派声望完整信息
   */
  static getSectReputationInfo(
    sectType: SectType,
    points: number
  ): {
    sectType: SectType;
    sectName: string;
    currentLevel: SectReputationLevel;
    levelName: string;
    title: string;
    points: number;
    progressPercent: number;
    pointsToNext: number;
    discountPercent: number;
    accessLevel: string;
    benefits: string[];
    exclusiveRewards: string[];
  } {
    const config = this.getSectConfig(sectType);
    const currentLevel = this.getSectLevelByPoints(sectType, points);
    const levelConfig = this.getSectLevelConfig(sectType, currentLevel);

    return {
      sectType,
      sectName: this.getSectName(sectType),
      currentLevel,
      levelName: levelConfig?.name || '外门弟子',
      title: levelConfig?.title || '外门弟子',
      points,
      progressPercent: this.getSectProgressPercent(sectType, points),
      pointsToNext: this.getSectPointsToNextLevel(sectType, points),
      discountPercent: levelConfig?.discountPercent || 0,
      accessLevel: levelConfig?.accessLevel || '山门',
      benefits: config?.benefits || [],
      exclusiveRewards: levelConfig?.exclusiveRewards || [],
    };
  }

  /**
   * 获取所有门派的声望信息
   */
  static getAllSectReputationInfo(): Array<{
    sectType: SectType;
    sectName: string;
    currentLevel: SectReputationLevel;
    levelName: string;
    title: string;
    points: number;
    progressPercent: number;
    pointsToNext: number;
    discountPercent: number;
    accessLevel: string;
    benefits: string[];
    exclusiveRewards: string[];
  }> {
    const store = useReputationStore();
    const results: Array<{
      sectType: SectType;
      sectName: string;
      currentLevel: SectReputationLevel;
      levelName: string;
      title: string;
      points: number;
      progressPercent: number;
      pointsToNext: number;
      discountPercent: number;
      accessLevel: string;
      benefits: string[];
      exclusiveRewards: string[];
    }> = [];

    for (const sectType of this.getAllSectTypes()) {
      const points = store.getSectReputation(sectType);
      results.push(this.getSectReputationInfo(sectType, points));
    }

    return results;
  }

  /**
   * 获取指定门派的任务列表
   */
  static getSectTasks(sectType: SectType): Array<{
    id: string;
    name: string;
    points: number;
    description: string;
  }> {
    const config = sectTaskConfig[sectType as keyof typeof sectTaskConfig];
    return config?.tasks || [];
  }
}
