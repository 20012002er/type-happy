/**
 * 自动采集队列 Store
 * 管理生活技能的自动采集队列
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LifeSkillType, ResourceConfig } from '@/types/lifeSkill';
import type { QueueTask } from '@/services/QueueManagerService';

export interface GatherQueueItem {
  skillType: LifeSkillType;
  resourceId: string;
  resourceName: string;
  gatherTime: number;
  startTime: number;
  currentCycle: number; // 当前循环次数
}

export const useGatherQueueStore = defineStore('gatherQueue', () => {
  // ========== 状态 ==========
  
  /**
   * 当前正在采集的项目
   */
  const currentGathering = ref<GatherQueueItem | null>(null);

  /**
   * 采集队列（暂时只支持单个，未来可扩展为多个）
   */
  const queue = ref<GatherQueueItem[]>([]);

  /**
   * 当前时间戳（用于触发进度更新）
   */
  const currentTime = ref(Date.now());

  // ========== 计算属性 ==========

  /**
   * 是否正在采集
   */
  const isGathering = computed(() => currentGathering.value !== null);

  /**
   * 当前采集进度（0-100）
   */
  const gatherProgress = computed(() => {
    if (!currentGathering.value) return 0;
    const elapsed = currentTime.value - currentGathering.value.startTime;
    const progress = (elapsed / currentGathering.value.gatherTime) * 100;
    return Math.min(progress, 100);
  });

  /**
   * 剩余时间（毫秒）
   */
  const remainingTime = computed(() => {
    if (!currentGathering.value) return 0;
    const elapsed = currentTime.value - currentGathering.value.startTime;
    const remaining = currentGathering.value.gatherTime - elapsed;
    return Math.max(remaining, 0);
  });

  // ========== 方法 ==========

  /**
   * 开始自动采集
   */
  function startGathering(resource: ResourceConfig, skillType: LifeSkillType): void {
    const item: GatherQueueItem = {
      skillType,
      resourceId: resource.id,
      resourceName: resource.name,
      gatherTime: resource.gatherTime,
      startTime: Date.now(),
      currentCycle: 0
    };

    currentGathering.value = item;
    console.log('[GatherQueue] 开始自动采集:', resource.name);
  }

  /**
   * 停止采集
   */
  function stopGathering(): void {
    if (currentGathering.value) {
      console.log('[GatherQueue] 停止采集:', currentGathering.value.resourceName);
    }
    currentGathering.value = null;
  }

  /**
   * 完成一次采集循环
   */
  function completeGatherCycle(): void {
    if (!currentGathering.value) return;
    
    // 增加循环次数
    currentGathering.value.currentCycle++;
    // 重置开始时间，继续下一次采集
    currentGathering.value.startTime = Date.now();
    
    console.log('[GatherQueue] 完成第', currentGathering.value.currentCycle, '次采集');
  }

  /**
   * 检查是否应该执行采集
   */
  function shouldExecuteGather(): boolean {
    if (!currentGathering.value) return false;
    return remainingTime.value <= 0;
  }

  /**
   * 更新进度（每次 tick 调用）
   */
  function updateProgress(): void {
    currentTime.value = Date.now();
  }

  /**
   * 获取当前采集信息（用于顶部状态栏）
   */
  function getCurrentGatheringInfo() {
    if (!currentGathering.value) return null;
    
    return {
      name: currentGathering.value.resourceName,
      progress: gatherProgress.value,
      remaining: remainingTime.value,
      cycle: currentGathering.value.currentCycle
    };
  }

  /**
   * 从存档恢复采集状态
   */
  function restoreGathering(savedData: GatherQueueItem | null): void {
    if (savedData) {
      // 恢复采集状态，但重置开始时间为当前时间
      // 这样可以从当前时刻重新开始采集，而不是继续之前的进度
      currentGathering.value = {
        ...savedData,
        startTime: Date.now()
      };
      console.log('[GatherQueue] 恢复采集状态:', savedData.resourceName);
    } else {
      currentGathering.value = null;
    }
  }

/**
 * 创建QueueTask对象（用于队列管理器）
 * 
 * 这个方法将当前采集任务包装成统一的QueueTask接口
 * 
 * ⚠️ 注意：
 * - AutoRunner 的启停由 QueueManager 统一管理
 * - 此处只需提供队列的停止方法
 * - 避免了 Store 依赖 Service 的循环依赖问题
 * 
 * ⚠️ 闭包陷阱：
 * - 捕获当前的 resourceId 作为值（而非引用）
 * - stopQueue 时检查 resourceId 是否匹配，避免停错任务
 */
function createQueueTask(): QueueTask {
  // 捕获当前状态的值（而非引用），避免闭包陷阱
  const taskResourceId = currentGathering.value?.resourceId;
  const taskResourceName = currentGathering.value?.resourceName || '采集';
  
  return {
    id: `gathering-${taskResourceId || 'unknown'}`,
    type: 'gathering',
    name: taskResourceName,
    stopQueue: () => {
      // 只停止匹配的任务，避免闭包陷阱导致停错任务
      if (currentGathering.value?.resourceId === taskResourceId) {
        stopGathering();
        console.log('[GatherQueue] 队列已停止:', taskResourceName);
      } else {
        console.log('[GatherQueue] 跳过停止（任务已变更）:', taskResourceName);
      }
    },
    isRunning: () => {
      // 检查是否是当前任务
      return isGathering.value && currentGathering.value?.resourceId === taskResourceId;
    },
    getProgress: () => {
      return gatherProgress.value;
    },
    getRemainingTime: () => {
      return remainingTime.value;
    }
  };
}

  return {
    // 状态
    currentGathering,
    queue,

    // 计算属性
    isGathering,
    gatherProgress,
    remainingTime,

    // 方法
    startGathering,
    stopGathering,
    completeGatherCycle,
    shouldExecuteGather,
    updateProgress,
    getCurrentGatheringInfo,
    restoreGathering,
    createQueueTask
  };
});

