import { FrameLoop, type FrameTickListener } from '@/utils/frameLoop';
import { tickRegistry } from '@/services/runtime/TickRegistry';

export type TickHandler = (seconds: number) => void | Promise<void>;

class TickService {
  private loop: FrameLoop | null = null;

  start() {
    if (this.loop) return;
    this.loop = new FrameLoop({ tickIntervalMs: 1000 });
    this.loop.addListener(this.onTick as FrameTickListener);
    this.loop.start();
  }

  stop() {
    if (!this.loop) return;
    this.loop.stop();
    this.loop = null;
  }

  private onTick = async (ticks: number) => {
    for (const [, handler] of tickRegistry.entries()) {
      try {
        await handler(ticks);
      } catch (e) {
        // 静默失败
      }
    }
  };
}

export const tickService = new TickService();
