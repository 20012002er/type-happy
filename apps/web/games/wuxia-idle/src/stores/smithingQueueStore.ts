/**
 * 铸造队列 Store
 * 管理当前铸造任务的状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SmithingQueueItem } from '@/types/smithing';
import type { QueueTask } from '@/services/QueueManagerService';

export const useSmithingQueueStore = defineStore('smithingQueue', () => {
  // ========== 状态 ==========
  
  /**
   * 当前正在铸造的项目
   */
  const currentSmithing = ref<SmithingQueueItem | null>(null);
  
  /**
   * 当前时间戳（用于触发进度更新）
   */
  const currentTime = ref(Date.now());

  // ========== 计算属性 ==========
  
  /**
   * 是否正在铸造
   */
  const isSmithing = computed(() => currentSmithing.value !== null);

  /**
   * 当前铸造进度（0-100）
   */
  const smithingProgress = computed(() => {
    if (!currentSmithing.value) return 0;
    const elapsed = currentTime.value - currentSmithing.value.startTime;
    const progress = (elapsed / currentSmithing.value.craftTime) * 100;
    return Math.min(progress, 100);
  });

  /**
   * 剩余时间（毫秒）
   */
  const remainingTime = computed(() => {
    if (!currentSmithing.value) return 0;
    const elapsed = currentTime.value - currentSmithing.value.startTime;
    const remaining = currentSmithing.value.craftTime - elapsed;
    return Math.max(remaining, 0);
  });

  // ========== 方法 ==========
  
  /**
   * 开始铸造
   */
  function startSmithing(recipeId: string, recipeName: string, craftTime: number): void {
    currentSmithing.value = {
      recipeId,
      recipeName,
      startTime: Date.now(),
      craftTime,
      currentCycle: 0
    };
    console.log('[SmithingQueue] 开始铸造:', recipeName);
  }
  
  /**
   * 停止铸造
   */
  function stopSmithing(): void {
    if (currentSmithing.value) {
      console.log('[SmithingQueue] 停止铸造:', currentSmithing.value.recipeName);
    }
    currentSmithing.value = null;
  }
  
  /**
   * 完成一次铸造循环
   */
  function completeSmithingCycle(): void {
    if (!currentSmithing.value) return;
    
    // 增加循环次数
    currentSmithing.value.currentCycle++;
    // 重置开始时间，继续下一次铸造
    currentSmithing.value.startTime = Date.now();
    
    console.log('[SmithingQueue] 完成第', currentSmithing.value.currentCycle, '次铸造');
  }

  /**
   * 检查是否应该执行铸造
   */
  function shouldExecuteSmithing(): boolean {
    if (!currentSmithing.value) return false;
    return remainingTime.value <= 0;
  }

  /**
   * 更新进度（每次 tick 调用）
   */
  function updateProgress(): void {
    currentTime.value = Date.now();
  }
  
  /**
   * 完成铸造（旧方法，保留兼容性）
   */
  function completeSmithing(): void {
    console.log('[SmithingQueue] 铸造完成');
    currentSmithing.value = null;
  }

  /**
   * 获取当前铸造信息
   */
  function getCurrentSmithingInfo() {
    if (!currentSmithing.value) return null;
    
    return {
      name: currentSmithing.value.recipeName,
      progress: smithingProgress.value,
      remaining: remainingTime.value,
      cycle: currentSmithing.value.currentCycle
    };
  }

/**
 * 创建QueueTask对象（用于队列管理器）
 * 
 * 这个方法将当前铸造任务包装成统一的QueueTask接口
 * 
 * ⚠️ 注意：
 * - AutoRunner 的启停由 QueueManager 统一管理
 * - 此处只需提供队列的停止方法
 * - 避免了 Store 依赖 Service 的循环依赖问题
 * 
 * ⚠️ 闭包陷阱：
 * - 捕获当前的 recipeId 作为值（而非引用）
 * - stopQueue 时检查 recipeId 是否匹配，避免停错任务
 */
function createQueueTask(): QueueTask {
  // 捕获当前状态的值（而非引用），避免闭包陷阱
  const taskRecipeId = currentSmithing.value?.recipeId;
  const taskRecipeName = currentSmithing.value?.recipeName || '铸造';
  
  return {
    id: `smithing-${taskRecipeId || 'unknown'}`,
    type: 'smithing',
    name: taskRecipeName,
    stopQueue: () => {
      // 只停止匹配的任务，避免闭包陷阱导致停错任务
      if (currentSmithing.value?.recipeId === taskRecipeId) {
        stopSmithing();
        console.log('[SmithingQueue] 队列已停止:', taskRecipeName);
      } else {
        console.log('[SmithingQueue] 跳过停止（任务已变更）:', taskRecipeName);
      }
    },
    isRunning: () => {
      // 检查是否是当前任务
      return isSmithing.value && currentSmithing.value?.recipeId === taskRecipeId;
    },
    getProgress: () => {
      return smithingProgress.value;
    },
    getRemainingTime: () => {
      return remainingTime.value;
    }
  };
}

  // ========== 返回 ==========
  
  return {
    // 状态
    currentSmithing,
    
    // 计算属性
    isSmithing,
    smithingProgress,
    remainingTime,
    
    // 方法
    startSmithing,
    stopSmithing,
    completeSmithingCycle,
    shouldExecuteSmithing,
    updateProgress,
    completeSmithing,
    getCurrentSmithingInfo,
    createQueueTask
  };
});

