import { AutoRunner } from '@/services/auto/AutoRunner';
import { useMeditationQueueStore } from '@/stores/meditationQueueStore';

class AutoMeditationService {
  private runner: AutoRunner | null = null;

  start(): void {
    if (this.runner?.isRunning()) return;

    this.runner = new AutoRunner({
      shouldRun: async () => {
        const q = useMeditationQueueStore();
        return !!q.currentMeditation;
      },
      onTick: async () => {
        // 打坐由组件内节奏和全局tick加成共同作用，此处无需重复结算。
        // 这里保留钩子以便未来扩展（如离线周期推算/心流衰减等）。
      },
      onProgress: () => {
        // 用于保持UI活跃（如果需要）
        const q = useMeditationQueueStore();
        q.updateProgress();
      },
      onStart: () => {
        // eslint-disable-next-line no-console
        console.log('[AutoMeditation] 已启动');
      },
      onStop: () => {
        // eslint-disable-next-line no-console
        console.log('[AutoMeditation] 已停止');
      },
      options: {
        tickMinSeconds: 3,
        tickMaxSeconds: 8,
        tickIntervalMs: 1000,
        autoPauseOnHidden: false,
        progressUpdateIntervalMs: 200
      }
    });

    this.runner.start();
  }

  stop(): void {
    if (this.runner) {
      this.runner.stop();
      this.runner = null;
    }
  }

  isRunning(): boolean {
    return this.runner?.isRunning() || false;
  }
}

export const autoMeditationService = new AutoMeditationService();
