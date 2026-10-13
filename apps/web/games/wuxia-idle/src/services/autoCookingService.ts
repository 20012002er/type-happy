/**
 * 自动烹饪服务
 * 管理自动烹饪队列
 */

import { AutoRunner } from './auto/AutoRunner';
import { useCookingQueueStore } from '@/stores/cookingQueueStore';
import { cookingService } from './cookingService';
import { CookingRecipeConfigService } from './config/CookingRecipeConfigService';

class AutoCookingService {
  private runner: AutoRunner | null = null;

  /**
   * 启动自动烹饪
   */
  start(): void {
    if (this.runner?.isRunning()) {
      console.log('[AutoCookingService] 已经在运行中');
      return;
    }

    console.log('[AutoCookingService] 启动自动烹饪服务');

    // 创建 AutoRunner
    this.runner = new AutoRunner({
      shouldRun: async () => {
        const cookingQueueStore = useCookingQueueStore();
        return cookingQueueStore.isCooking;
      },
      onTick: async (ctx) => {
        await this.executeTick(ctx.dtSeconds);
      },
      onProgress: () => {
        // 进度更新回调：每100ms调用一次
        const cookingQueueStore = useCookingQueueStore();
        if (cookingQueueStore.isCooking) {
          cookingQueueStore.updateProgress();
        }
      },
      onStart: () => {
        console.log('[AutoCookingService] 自动烹饪已启动');
      },
      onStop: () => {
        console.log('[AutoCookingService] 自动烹饪已停止');
      },
      options: {
        tickMinSeconds: 0.1,
        tickMaxSeconds: 0.1,
        tickIntervalMs: 100, // 每100ms检查一次
        progressUpdateIntervalMs: 100, // 每100ms更新一次进度
        autoPauseOnHidden: false // 即使页面隐藏也继续烹饪
      }
    });

    this.runner.start();
  }

  /**
   * 停止自动烹饪
   */
  stop(): void {
    if (this.runner) {
      console.log('[AutoCookingService] 停止自动烹饪服务');
      this.runner.stop();
      this.runner = null;
    }
  }

  /**
   * 执行烹饪逻辑
   */
  private async executeTick(dtSeconds: number): Promise<void> {
    const cookingQueueStore = useCookingQueueStore();

    // 检查是否应该执行烹饪
    if (cookingQueueStore.shouldExecuteCooking()) {
      const current = cookingQueueStore.currentCooking;
      if (!current) return;

      // 获取配方
      const recipe = CookingRecipeConfigService.getRecipeById(current.recipeId);
      if (!recipe) {
        console.error('[AutoCookingService] 配方不存在:', current.recipeId);
        cookingQueueStore.stopCooking();
        this.stop();
        return;
      }

      // 检查材料是否足够
      if (!cookingService.canCook(recipe)) {
        console.warn('[AutoCookingService] 材料不足，停止烹饪');
        cookingQueueStore.stopCooking();
        this.stop();
        return;
      }

      try {
        // 执行烹饪
        const result = cookingService.attemptCooking(recipe);
        
        if (result.success) {
          console.log(
            `[AutoCookingService] 烹饪成功: ${result.itemName} x${result.quantity}, 获得经验 ${result.expGained}`
          );
        } else {
          console.log(`[AutoCookingService] 烹饪失败: ${result.itemName}`);
        }
        
        // 完成一次循环，重置计时器
        cookingQueueStore.completeCookingCycle();
        
        // 如果材料还够，继续烹饪同样的配方
        if (cookingService.canCook(recipe)) {
          // 继续烹饪（队列已经在completeCookingCycle中重置了计时器）
          console.log(`[AutoCookingService] 继续烹饪: ${recipe.name}`);
        } else {
          // 材料不足，停止
          cookingQueueStore.stopCooking();
          this.stop();
        }
      } catch (error) {
        console.error('[AutoCookingService] 烹饪错误:', error);
        cookingQueueStore.stopCooking();
        this.stop();
      }
    }
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.runner?.isRunning() || false;
  }
}

export const autoCookingService = new AutoCookingService();

