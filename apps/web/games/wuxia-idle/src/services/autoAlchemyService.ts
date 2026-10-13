/**
 * 自动炼丹服务
 * 
 * 基于队列系统的自动炼丹管理
 */
import { useAlchemyQueueStore } from '@/stores/alchemyQueueStore';
import { alchemyService } from './alchemyService';

class AutoAlchemyService {
  private running = false;
  private tickInterval: number | null = null;
  private readonly TICK_RATE = 100; // 100ms检查一次

  /**
   * 启动自动炼丹服务
   */
  start() {
    if (this.running) {
      console.log('[AutoAlchemyService] 已在运行中');
      return;
    }

    console.log('[AutoAlchemyService] 启动自动炼丹服务');
    this.running = true;
    
    // 使用定时器检查炼丹进度
    this.tickInterval = window.setInterval(() => {
      this.tick();
    }, this.TICK_RATE);
  }

  /**
   * 停止自动炼丹服务
   */
  stop() {
    console.log('[AutoAlchemyService] 停止自动炼丹服务');
    this.running = false;
    
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * 每次tick检查炼丹是否完成
   */
  private tick() {
    if (!this.running) return;

    const alchemyQueueStore = useAlchemyQueueStore();
    
    // 如果没有正在炼丹的任务，返回
    if (!alchemyQueueStore.isAlchemizing || !alchemyQueueStore.currentAlchemy) {
      return;
    }

    // 更新进度（触发响应式更新）
    alchemyQueueStore.updateProgress();

    // 检查炼丹是否完成
    const now = Date.now();
    const task = alchemyQueueStore.currentAlchemy;
    const elapsed = now - task.startTime;

    if (elapsed >= task.craftTime) {
      // 炼丹完成
      this.onAlchemyComplete();
    }
  }

  /**
   * 炼丹完成处理
   */
  private onAlchemyComplete() {
    const alchemyQueueStore = useAlchemyQueueStore();
    const task = alchemyQueueStore.currentAlchemy;
    
    if (!task) return;

    console.log(`[AutoAlchemyService] 炼丹成功: ${task.recipeName} x1`);

    // 调用炼丹服务完成炼丹
    alchemyService.completeAlchemy(task.recipeId);

    // 更新队列状态（增加循环计数，重置开始时间）
    alchemyQueueStore.completeAlchemy();

    // 检查是否可以继续炼丹
    const canContinue = alchemyService.canStartAlchemy(task.recipeId);
    if (canContinue.canStart) {
      console.log(`[AutoAlchemyService] 继续炼丹: ${task.recipeName}`);
      // 继续炼丹（startTime已经在completeAlchemy中更新）
    } else {
      console.log(`[AutoAlchemyService] 无法继续炼丹: ${canContinue.reason}`);
      alchemyQueueStore.stopAlchemy();
    }
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }
}

export const autoAlchemyService = new AutoAlchemyService();

