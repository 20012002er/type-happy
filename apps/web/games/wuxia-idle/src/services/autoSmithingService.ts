/**
 * 自动铸造服务
 * 管理铸造任务的自动执行
 */

import { AutoRunner } from '@/services/auto/AutoRunner';
import { useSmithingQueueStore } from '@/stores/smithingQueueStore';
import { SmithingConfigService } from '@/services/config/SmithingConfigService';
import { smithingService } from '@/services/smithingService';

class AutoSmithingService {
  private runner: AutoRunner | null = null;

  /**
   * 启动自动铸造
   */
  start(): void {
    if (this.runner?.isRunning()) {
      console.log('[AutoSmithingService] 已经在运行中');
      return;
    }

    console.log('[AutoSmithingService] 启动自动铸造服务');

    // 创建 AutoRunner
    this.runner = new AutoRunner({
      shouldRun: async () => {
        const smithingQueueStore = useSmithingQueueStore();
        return smithingQueueStore.isSmithing;
      },
      onTick: async (ctx) => {
        await this.executeTick(ctx.dtSeconds);
      },
      onProgress: () => {
        // 进度更新回调：每100ms调用一次
        const smithingQueueStore = useSmithingQueueStore();
        if (smithingQueueStore.isSmithing) {
          smithingQueueStore.updateProgress();
        }
      },
      onStart: () => {
        console.log('[AutoSmithingService] 自动铸造已启动');
      },
      onStop: () => {
        console.log('[AutoSmithingService] 自动铸造已停止');
      },
      options: {
        tickMinSeconds: 0.1,
        tickMaxSeconds: 0.1,
        tickIntervalMs: 100, // 每100ms检查一次
        progressUpdateIntervalMs: 100, // 每100ms更新一次进度
        autoPauseOnHidden: false // 即使页面隐藏也继续铸造
      }
    });

    this.runner.start();
  }

  /**
   * 停止自动铸造
   */
  stop(): void {
    if (this.runner) {
      console.log('[AutoSmithingService] 停止自动铸造服务');
      this.runner.stop();
      this.runner = null;
    }
  }

  /**
   * 执行铸造逻辑
   */
  private async executeTick(dtSeconds: number): Promise<void> {
    const smithingQueueStore = useSmithingQueueStore();

    // 检查是否应该执行铸造
    if (smithingQueueStore.shouldExecuteSmithing()) {
      const current = smithingQueueStore.currentSmithing;
      if (!current) return;

      // 获取配方
      const recipe = SmithingConfigService.getRecipe(current.recipeId);
      if (!recipe) {
        console.warn('[AutoSmithingService] 配方不存在:', current.recipeId);
        smithingQueueStore.stopSmithing();
        this.stop();
        return;
      }

      // 检查材料是否足够
      if (!smithingService.canCraft(recipe)) {
        console.warn('[AutoSmithingService] 材料不足，停止铸造');
        smithingQueueStore.stopSmithing();
        this.stop();
        return;
      }

      try {
        // 执行铸造
        const result = await smithingService.craftRecipe(recipe);
        
        if (result.success) {
          console.log(
            `[AutoSmithingService] 铸造成功: ${result.itemName} x${result.quantity}, 获得经验 ${result.expGained}`
          );
        } else {
          console.log(`[AutoSmithingService] 铸造失败: ${result.itemName}`);
        }
        
        // 完成一次循环，重置计时器
        smithingQueueStore.completeSmithingCycle();
        
        // 如果材料还够，继续铸造同样的配方
        if (smithingService.canCraft(recipe)) {
          // 继续铸造（队列已经在completeSmithingCycle中重置了计时器）
          console.log(`[AutoSmithingService] 继续铸造: ${recipe.name}`);
        } else {
          // 材料不足，停止
          smithingQueueStore.stopSmithing();
          this.stop();
        }
      } catch (error) {
        console.error('[AutoSmithingService] 铸造错误:', error);
        smithingQueueStore.stopSmithing();
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

// 导出单例
export const autoSmithingService = new AutoSmithingService();

