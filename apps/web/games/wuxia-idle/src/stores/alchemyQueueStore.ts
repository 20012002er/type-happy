/**
 * 炼丹队列Store
 * 
 * 管理炼丹任务队列和进度
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AlchemyTask } from '@/types/alchemy';

export const useAlchemyQueueStore = defineStore('alchemyQueue', () => {
  // ========== 状态 ==========
  const currentAlchemy = ref<AlchemyTask | null>(null);
  const isAlchemizing = ref(false);
  
  /**
   * 当前时间戳（用于触发进度更新）
   */
  const currentTime = ref(Date.now());

  // ========== 计算属性 ==========
  
  /**
   * 炼丹进度（0-100）
   */
  const alchemyProgress = computed(() => {
    if (!currentAlchemy.value || !isAlchemizing.value) return 0;
    
    const elapsed = currentTime.value - currentAlchemy.value.startTime;
    const progress = (elapsed / currentAlchemy.value.craftTime) * 100;
    
    return Math.min(progress, 100);
  });

  /**
   * 剩余时间（毫秒）
   */
  const remainingTime = computed(() => {
    if (!currentAlchemy.value || !isAlchemizing.value) return 0;
    
    const elapsed = currentTime.value - currentAlchemy.value.startTime;
    const remaining = Math.max(0, currentAlchemy.value.craftTime - elapsed);
    
    return remaining;
  });

  /**
   * 获取当前炼丹信息（用于UI显示）
   */
  const getCurrentAlchemyInfo = () => {
    if (!currentAlchemy.value) return null;
    
    return {
      recipeId: currentAlchemy.value.recipeId,
      recipeName: currentAlchemy.value.recipeName,
      progress: alchemyProgress.value,
      remaining: remainingTime.value,
      currentCycle: currentAlchemy.value.currentCycle
    };
  };

  // ========== 方法 ==========
  
  /**
   * 开始炼丹
   */
  const startAlchemy = (task: AlchemyTask) => {
    console.log(`[AlchemyQueueStore] 开始炼丹: ${task.recipeName}`);
    currentAlchemy.value = task;
    isAlchemizing.value = true;
  };

  /**
   * 停止炼丹
   */
  const stopAlchemy = () => {
    console.log('[AlchemyQueueStore] 停止炼丹');
    currentAlchemy.value = null;
    isAlchemizing.value = false;
  };

  /**
   * 完成当前炼丹
   */
  const completeAlchemy = () => {
    if (!currentAlchemy.value) return;
    
    const cycleCount = currentAlchemy.value.currentCycle;
    console.log(`[AlchemyQueueStore] 完成第 ${cycleCount} 次炼丹`);
    
    // 增加循环计数
    currentAlchemy.value.currentCycle++;
    
    // 重置开始时间（用于连续炼制）
    currentAlchemy.value.startTime = Date.now();
  };

  /**
   * 恢复炼丹状态（从存档加载）
   */
  const restoreAlchemy = (task: AlchemyTask) => {
    console.log(`[AlchemyQueueStore] 恢复炼丹状态: ${task.recipeName}`);
    
    // 计算已经过的时间
    const now = Date.now();
    const elapsed = now - task.startTime;
    
    // 如果已经完成，直接触发完成逻辑
    if (elapsed >= task.craftTime) {
      // 这里不直接处理完成，让AlchemyService的tick循环处理
      currentAlchemy.value = task;
      isAlchemizing.value = true;
    } else {
      // 未完成，恢复炼丹状态
      currentAlchemy.value = task;
      isAlchemizing.value = true;
    }
  };

  /**
   * 更新进度（由定时器调用以触发响应式更新）
   */
  const updateProgress = () => {
    currentTime.value = Date.now();
  };

  /**
   * 清空队列
   */
  const clearQueue = () => {
    currentAlchemy.value = null;
    isAlchemizing.value = false;
  };

  /**
   * 设置队列状态（用于存档加载）
   */
  const setState = (task: AlchemyTask | null, _isAlchemizing: boolean) => {
    currentAlchemy.value = task;
    isAlchemizing.value = _isAlchemizing;
  };

  /**
   * 创建队列任务对象（用于QueueManager）
   */
  const createQueueTask = () => {
    // 捕获当前状态的值（而非引用），避免闭包陷阱
    const taskRecipeId = currentAlchemy.value?.recipeId;
    const taskRecipeName = currentAlchemy.value?.recipeName || '炼丹';
    
    return {
      id: `alchemy-${taskRecipeId || 'unknown'}`,
      type: 'alchemy' as const,
      name: taskRecipeName,
      stopQueue: () => {
        // 只停止匹配的任务，避免闭包陷阱导致停错任务
        if (currentAlchemy.value?.recipeId === taskRecipeId) {
          stopAlchemy();
          console.log('[AlchemyQueue] 队列已停止:', taskRecipeName);
        } else {
          console.log('[AlchemyQueue] 跳过停止（任务已变更）:', taskRecipeName);
        }
      },
      isRunning: () => {
        // 检查是否是当前任务
        return isAlchemizing.value && currentAlchemy.value?.recipeId === taskRecipeId;
      },
      getProgress: () => {
        return alchemyProgress.value;
      },
      getRemainingTime: () => {
        return remainingTime.value;
      }
    };
  };

  return {
    // 状态
    currentAlchemy,
    isAlchemizing,
    
    // 计算属性
    alchemyProgress,
    remainingTime,
    
    // 方法
    startAlchemy,
    stopAlchemy,
    completeAlchemy,
    restoreAlchemy,
    updateProgress,
    clearQueue,
    setState,
    getCurrentAlchemyInfo,
    createQueueTask
  };
});

