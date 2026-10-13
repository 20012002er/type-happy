/**
 * 队列管理服务 - 统一管理所有自动化任务队列
 * 
 * 设计原则：
 * 1. 单一职责：负责队列和 AutoRunner 的协调管理
 * 2. 开闭原则：新增队列类型无需修改此服务
 * 3. 依赖倒置：各业务模块通过接口与此服务交互
 * 4. 避免循环依赖：QueueManager 管理 AutoRunner，Store 不依赖 Service
 * 
 * 核心功能：
 * - 确保同一时间只有一个队列任务运行
 * - 统一管理所有 AutoRunner 的启停
 * - 自动停止旧任务，启动新任务
 * - 提供当前任务信息供UI显示
 */

import { ref, computed, readonly } from 'vue';
import { autoGatherService } from './autoGatherService';
import { autoSmithingService } from './autoSmithingService';
import { autoCookingService } from './autoCookingService';
import { autoAlchemyService } from './autoAlchemyService';
import { autoLeatherworkingService } from './autoLeatherworkingService';
import { autoMeditationService } from './autoMeditationService';

/**
 * 队列任务接口
 * 
 * ⚠️ 注意：QueueTask 不再负责启停 AutoRunner
 * AutoRunner 的启停由 QueueManager 统一管理
 */
export interface QueueTask {
  /** 任务唯一标识 */
  id: string;
  
  /** 任务类型（用于分类和日志） */
  type: 'gathering' | 'smithing' | 'leatherworking' | 'cooking' | 'alchemy' | 'meditation' | 'combat' | 'exploring' | 'dungeon';
  
  /** 任务显示名称 */
  name: string;
  
  /** 停止队列（只停队列，不停 AutoRunner） */
  stopQueue(): void;
  
  /** 检查任务是否正在运行 */
  isRunning(): boolean;
  
  /** 
   * 获取任务进度信息
   * @returns 0-100: 正常进度百分比
   * @returns -1: 不确定时长（显示循环动画）
   */
  getProgress(): number;
  
  /** 获取剩余时间（毫秒） */
  getRemainingTime(): number;
  
  /** 
   * 获取当前阶段的详细描述（可选）
   * 用于显示更详细的任务状态，如"寻找下一个敌人"、"战斗中"等
   */
  getPhaseDescription?(): string;
}

/**
 * 任务信息（用于UI显示）
 */
export interface TaskInfo {
  id: string;
  type: string;
  name: string;
  progress: number;
  remaining: number;
  /** 当前阶段的详细描述（可选） */
  phaseDescription?: string;
}

/**
 * 队列管理服务（单例）
 */
class QueueManager {
  /** 当前正在运行的任务 */
  private currentTask = ref<QueueTask | null>(null);
  
  /**
   * 根据任务类型获取对应的 AutoRunner
   * 
   * @param taskType - 任务类型
   * @returns AutoRunner 实例或 null
   */
  private getAutoRunner(taskType: string) {
    switch (taskType) {
      case 'gathering':
        return autoGatherService;
      case 'meditation':
        return autoMeditationService;
      case 'smithing':
        return autoSmithingService;
      case 'leatherworking':
        return autoLeatherworkingService;
      case 'cooking':
        return autoCookingService;
      case 'alchemy':
        return autoAlchemyService;
      case 'combat':
      case 'exploring':
        // 战斗和探索不需要 AutoRunner，由 combatStore 直接管理
        return null;
      case 'dungeon':
        // 地牢任务由 dungeonStore 内部管理 AutoRunner
        return null;
      default:
        console.warn(`[QueueManager] 未知的任务类型: ${taskType}`);
        return null;
    }
  }
  
  /**
   * 停止所有 AutoRunner
   * 注意：combat/exploring 任务通过 combatStore 管理，不在此停止
   */
  private stopAllAutoRunners(): void {
    if (autoGatherService.isRunning()) {
      autoGatherService.stop();
      console.log('[QueueManager] 已停止 autoGatherService');
    }
    if (autoMeditationService.isRunning()) {
      autoMeditationService.stop();
      console.log('[QueueManager] 已停止 autoMeditationService');
    }
    if (autoSmithingService.isRunning()) {
      autoSmithingService.stop();
      console.log('[QueueManager] 已停止 autoSmithingService');
    }
    if (autoLeatherworkingService.isRunning()) {
      autoLeatherworkingService.stop();
      console.log('[QueueManager] 已停止 autoLeatherworkingService');
    }
    if (autoAlchemyService.isRunning()) {
      autoAlchemyService.stop();
      console.log('[QueueManager] 已停止 autoAlchemyService');
    }
    if (autoCookingService.isRunning()) {
      autoCookingService.stop();
      console.log('[QueueManager] 已停止 autoCookingService');
    }
    // combat/exploring 任务由 combatStore 独立管理，无需在此停止
  }
  
  /**
   * 开始一个新任务
   * 
   * 工作流程：
   * 1. 停止所有当前运行的 AutoRunner（会清理执行状态）
   * 2. 停止旧任务的队列状态（通过 stopQueue 检查 ID 避免停错）
   * 3. 启动新任务的 AutoRunner
   * 4. 设置新任务为当前任务
   * 
   * ⚠️ 重要：会自动停止当前正在运行的任务
   * 
   * @param task - 要启动的任务
   */
  startTask(task: QueueTask): void {
    console.log(`[QueueManager] 请求启动任务: ${task.type} - ${task.name}`);
    
    // 1. 停止所有 AutoRunner（清理执行状态）
    this.stopAllAutoRunners();
    
    // 2. 停止旧任务的队列状态
    //    注意：stopQueue 内部会检查任务 ID，避免因闭包陷阱停错任务
    if (this.currentTask.value) {
      const oldTask = this.currentTask.value;
      console.log(`[QueueManager] 停止旧任务: ${oldTask.type} - ${oldTask.name}`);
      oldTask.stopQueue();
    }
    
    // 3. 启动新任务的 AutoRunner
    const autoRunner = this.getAutoRunner(task.type);
    if (autoRunner && !autoRunner.isRunning()) {
      autoRunner.start();
      console.log(`[QueueManager] 已启动 ${task.type} AutoRunner`);
    }
    
    // 4. 设置新任务为当前任务
    this.currentTask.value = task;
    
    console.log(`[QueueManager] 新任务已启动: ${task.type} - ${task.name}`);
  }
  
  /**
   * 停止当前任务
   * 
   * 会同时停止 AutoRunner 和队列
   * 
   * @param taskId - 可选的任务ID，用于确认是否是要停止的任务
   */
  stopTask(taskId?: string): void {
    if (!this.currentTask.value) {
      console.log('[QueueManager] 没有运行中的任务');
      return;
    }
    
    // 如果指定了taskId，检查是否匹配
    if (taskId && this.currentTask.value.id !== taskId) {
      console.warn(`[QueueManager] 任务ID不匹配，忽略停止请求: ${taskId}`);
      return;
    }
    
    const task = this.currentTask.value;
    console.log(`[QueueManager] 停止任务: ${task.type} - ${task.name}`);
    
    // 停止对应的 AutoRunner
    const autoRunner = this.getAutoRunner(task.type);
    if (autoRunner && autoRunner.isRunning()) {
      autoRunner.stop();
      console.log(`[QueueManager] 已停止 ${task.type} AutoRunner`);
    }
    
    // 停止队列
    task.stopQueue();
    this.currentTask.value = null;
  }
  
  /**
   * 获取当前任务信息（供UI显示）
   * 
   * @returns 任务信息或null
   */
  getCurrentTaskInfo(): TaskInfo | null {
    if (!this.currentTask.value) {
      return null;
    }
    
    const task = this.currentTask.value;
    
    // 检查任务是否还在运行（可能已经自动结束）
    if (!task.isRunning()) {
      this.currentTask.value = null;
      return null;
    }
    
    const info: TaskInfo = {
      id: task.id,
      type: task.type,
      name: task.name,
      progress: task.getProgress(),
      remaining: task.getRemainingTime()
    };
    
    // 如果任务提供了阶段描述，添加到信息中
    if (task.getPhaseDescription) {
      info.phaseDescription = task.getPhaseDescription();
    }
    
    return info;
  }
  
  /**
   * 检查是否有任务正在运行
   */
  hasRunningTask(): boolean {
    return this.currentTask.value !== null && this.currentTask.value.isRunning();
  }
  
  /**
   * 获取当前任务类型
   */
  getCurrentTaskType(): string | null {
    return this.currentTask.value?.type || null;
  }
  
  /**
   * 检查指定类型的任务是否正在运行
   */
  isTaskTypeRunning(type: string): boolean {
    return this.currentTask.value?.type === type && this.currentTask.value.isRunning();
  }
  
  /**
   * 恢复任务（用于存档加载后恢复状态）
   * 
   * ⚠️ 注意：此方法用于页面刷新后恢复任务
   * 会启动对应的 AutoRunner 并设置当前任务
   * 
   * @param task - 要恢复的任务
   */
  restoreTask(task: QueueTask): void {
    console.log(`[QueueManager] 恢复任务: ${task.type} - ${task.name}`);
    
    // 启动对应的 AutoRunner
    const autoRunner = this.getAutoRunner(task.type);
    if (autoRunner && !autoRunner.isRunning()) {
      autoRunner.start();
      console.log(`[QueueManager] 已启动 ${task.type} AutoRunner`);
    }
    
    // 设置当前任务
    this.currentTask.value = task;
  }
}

// 导出单例实例
export const queueManager = new QueueManager();

/**
 * Composable: 使用队列管理器
 * 
 * 用法示例：
 * ```typescript
 * const { startTask, stopTask, getCurrentTaskInfo } = useQueueManager();
 * 
 * // 启动任务
 * startTask(gatherQueueStore.createQueueTask());
 * ```
 */
export const useQueueManager = () => {
  return {
    startTask: (task: QueueTask) => queueManager.startTask(task),
    stopTask: (taskId?: string) => queueManager.stopTask(taskId),
    getCurrentTaskInfo: () => queueManager.getCurrentTaskInfo(),
    hasRunningTask: () => queueManager.hasRunningTask(),
    getCurrentTaskType: () => queueManager.getCurrentTaskType(),
    isTaskTypeRunning: (type: string) => queueManager.isTaskTypeRunning(type),
    restoreTask: (task: QueueTask) => queueManager.restoreTask(task)
  };
};
