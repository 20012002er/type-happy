/**
 * 烹饪队列 Store
 * 管理自动烹饪状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CookingProgress } from '@/types/cooking';
import type { QueueTask } from '@/services/QueueManagerService';

export const useCookingQueueStore = defineStore('cookingQueue', () => {
  // ========== 状态 ==========
  
  /**
   * 当前烹饪信息
   */
  const currentCooking = ref<CookingProgress | null>(null);
  
  /**
   * 当前时间戳（用于触发进度更新）
   */
  const currentTime = ref(Date.now());
  
  // ========== 计算属性 ==========
  
  /**
   * 是否正在烹饪
   */
  const isCooking = computed(() => currentCooking.value !== null);
  
  /**
   * 烹饪进度（0-100）
   */
  const cookingProgress = computed(() => {
    if (!currentCooking.value) return 0;
    const elapsed = currentTime.value - currentCooking.value.startTime;
    const progress = (elapsed / currentCooking.value.duration) * 100;
    return Math.min(progress, 100);
  });

  /**
   * 剩余时间（毫秒）
   */
  const remainingTime = computed(() => {
    if (!currentCooking.value) return 0;
    const elapsed = currentTime.value - currentCooking.value.startTime;
    const remaining = currentCooking.value.duration - elapsed;
    return Math.max(remaining, 0);
  });
  
  // ========== 方法 ==========
  
  /**
   * 开始烹饪
   */
  function startCooking(recipeId: string, recipeName: string, duration: number): void {
    const now = Date.now();
    
    currentCooking.value = {
      recipeId,
      recipeName,
      startTime: now,
      duration,
      currentCycle: 0
    };
    
    console.log('[CookingQueueStore] 开始烹饪:', recipeName);
  }
  
  /**
   * 停止烹饪
   */
  function stopCooking(): void {
    if (currentCooking.value) {
      console.log('[CookingQueueStore] 停止烹饪:', currentCooking.value.recipeName);
    }
    currentCooking.value = null;
  }
  
  /**
   * 完成一次烹饪循环
   */
  function completeCookingCycle(): void {
    if (!currentCooking.value) return;
    
    // 增加循环次数
    currentCooking.value.currentCycle++;
    // 重置开始时间，继续下一次烹饪
    currentCooking.value.startTime = Date.now();
    
    console.log('[CookingQueueStore] 完成第', currentCooking.value.currentCycle, '次烹饪');
  }

  /**
   * 检查是否应该执行烹饪
   */
  function shouldExecuteCooking(): boolean {
    if (!currentCooking.value) return false;
    return remainingTime.value <= 0;
  }

  /**
   * 更新进度（每次 tick 调用）
   */
  function updateProgress(): void {
    currentTime.value = Date.now();
  }
  
  /**
   * 完成一次烹饪（旧方法，保留兼容性）
   */
  function completeCycle(): void {
    if (currentCooking.value) {
      currentCooking.value.currentCycle += 1;
      console.log('[CookingQueueStore] 完成烹饪循环:', currentCooking.value.currentCycle);
    }
  }
  
  /**
   * 恢复烹饪状态（从存档加载时）
   */
  function restoreCooking(cookingData: CookingProgress): void {
    currentCooking.value = { 
      ...cookingData,
      startTime: Date.now() // 重置开始时间为当前时间
    };
    
    console.log('[CookingQueueStore] 恢复烹饪状态:', cookingData.recipeName);
  }

  /**
   * 获取当前烹饪信息
   */
  function getCurrentCookingInfo() {
    if (!currentCooking.value) return null;
    
    return {
      name: currentCooking.value.recipeName,
      progress: cookingProgress.value,
      remaining: remainingTime.value,
      cycle: currentCooking.value.currentCycle
    };
  }

/**
 * 创建QueueTask对象（用于队列管理器）
 * 
 * 这个方法将当前烹饪任务包装成统一的QueueTask接口
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
  const taskRecipeId = currentCooking.value?.recipeId;
  const taskRecipeName = currentCooking.value?.recipeName || '烹饪';
  
  return {
    id: `cooking-${taskRecipeId || 'unknown'}`,
    type: 'cooking',
    name: taskRecipeName,
    stopQueue: () => {
      // 只停止匹配的任务，避免闭包陷阱导致停错任务
      if (currentCooking.value?.recipeId === taskRecipeId) {
        stopCooking();
        console.log('[CookingQueue] 队列已停止:', taskRecipeName);
      } else {
        console.log('[CookingQueue] 跳过停止（任务已变更）:', taskRecipeName);
      }
    },
    isRunning: () => {
      // 检查是否是当前任务
      return isCooking.value && currentCooking.value?.recipeId === taskRecipeId;
    },
    getProgress: () => {
      return cookingProgress.value;
    },
    getRemainingTime: () => {
      return remainingTime.value;
    }
  };
}
  
  return {
    // 状态
    currentCooking,
    
    // 计算属性
    isCooking,
    cookingProgress,
    remainingTime,
    
    // 方法
    startCooking,
    stopCooking,
    completeCookingCycle,
    shouldExecuteCooking,
    updateProgress,
    completeCycle,
    restoreCooking,
    getCurrentCookingInfo,
    createQueueTask
  };
});

