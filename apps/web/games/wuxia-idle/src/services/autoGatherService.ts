/**
 * 自动采集服务
 * 使用 AutoRunner 实现自动采集功能
 */

import { AutoRunner } from './auto/AutoRunner';
import { tickRegistry } from './runtime/TickRegistry';
import { useGatherQueueStore } from '@/stores/gatherQueueStore';
import { LifeSkillService } from './lifeSkillService';
import type { LifeSkillType } from '@/types/lifeSkill';

class AutoGatherService {
  private runner: AutoRunner | null = null;
  private readonly TICK_KEY = 'auto-gather';

  /**
   * 启动自动采集
   */
  start(): void {
    if (this.runner?.isRunning()) {
      console.log('[AutoGather] 已经在运行中');
      return;
    }

    console.log('[AutoGather] 启动自动采集服务');

    // 创建 AutoRunner（负责执行采集逻辑 + 进度更新）
    this.runner = new AutoRunner({
      shouldRun: async () => {
        const gatherQueue = useGatherQueueStore();
        return gatherQueue.isGathering;
      },
      onTick: async (ctx) => {
        await this.executeTick(ctx.dtSeconds);
      },
      onProgress: () => {
        // 进度更新回调：每100ms调用一次
        const gatherQueue = useGatherQueueStore();
        if (gatherQueue.isGathering) {
          gatherQueue.updateProgress();
        }
      },
      options: {
        tickMinSeconds: 0.1,
        tickMaxSeconds: 0.1,
        tickIntervalMs: 100, // 每100ms检查一次
        progressUpdateIntervalMs: 100, // 每100ms更新一次进度
        autoPauseOnHidden: false // 即使页面隐藏也继续采集
      }
    });

    // 注册到 TickRegistry（作为备用机制）
    tickRegistry.register(this.TICK_KEY, async (seconds) => {
      if (this.runner?.isRunning()) {
        await this.executeTick(seconds);
      }
    });

    this.runner.start();
  }

  /**
   * 停止自动采集
   */
  stop(): void {
    if (this.runner) {
      console.log('[AutoGather] 停止自动采集服务');
      this.runner.stop();
      this.runner = null;
    }
    
    tickRegistry.unregister(this.TICK_KEY);
  }

  /**
   * 执行采集逻辑
   */
  private async executeTick(dtSeconds: number): Promise<void> {
    const gatherQueue = useGatherQueueStore();

    // 检查是否应该执行采集
    if (gatherQueue.shouldExecuteGather()) {
      const current = gatherQueue.currentGathering;
      if (!current) return;

      try {
        // 执行采集（不消耗体力）
        await LifeSkillService.gatherResourceAuto(
          current.skillType,
          current.resourceId
        );

        // 完成一次循环，重置计时器
        gatherQueue.completeGatherCycle();
      } catch (error) {
        console.error('[AutoGather] 采集失败:', error);
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
export const autoGatherService = new AutoGatherService();

