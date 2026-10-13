import { FrameLoop } from '@/utils/frameLoop';

export interface AutoRunnerOptions {
  tickMinSeconds?: number;
  tickMaxSeconds?: number;
  tickIntervalMs?: number; // FrameLoop 内部聚合间隔，默认1000
  autoPauseOnHidden?: boolean;
  progressUpdateIntervalMs?: number; // 进度更新间隔，默认100ms
}

export interface AutoContext {
  /** 执行本次tick的秒数（通常为1或多个聚合秒） */
  dtSeconds: number;
}

export type AutoShouldRun = () => boolean | Promise<boolean>;
export type AutoOnTick = (ctx: AutoContext) => void | Promise<void>;
export type AutoOnProgress = () => void; // 进度更新回调
export type AutoOnStartStop = () => void;

/**
 * AutoRunner - 统一自动行动框架
 * - 通过 FrameLoop 聚合时间；
 * - 提供 min/max tick 窗口的随机节奏；
 * - 通过 shouldRun 门控（如：战斗中暂停）；
 * - 支持进度更新回调（用于UI进度条）；
 * - KISS：最小接口即可驱动多种自动化行为（打坐/闯荡/采集等）。
 */
export class AutoRunner {
  private loop: FrameLoop | null = null;
  private progressTimer: number | null = null;
  private tickMin = 3;
  private tickMax = 8;
  private nextTick = 3;
  private elapsed = 0;
  private shouldRun: AutoShouldRun;
  private onTick: AutoOnTick;
  private onProgress?: AutoOnProgress;
  private onStart?: AutoOnStartStop;
  private onStop?: AutoOnStartStop;
  private opts: AutoRunnerOptions;

  constructor(params: {
    shouldRun: AutoShouldRun;
    onTick: AutoOnTick;
    onProgress?: AutoOnProgress;
    onStart?: AutoOnStartStop;
    onStop?: AutoOnStartStop;
    options?: AutoRunnerOptions;
  }) {
    this.shouldRun = params.shouldRun;
    this.onTick = params.onTick;
    this.onProgress = params.onProgress;
    this.onStart = params.onStart;
    this.onStop = params.onStop;
    this.opts = params.options || {};
    this.setTickWindow(this.opts.tickMinSeconds ?? 3, this.opts.tickMaxSeconds ?? 8);
  }

  setTickWindow(minSeconds: number, maxSeconds: number) {
    this.tickMin = Math.max(1, Math.floor(minSeconds));
    this.tickMax = Math.max(this.tickMin, Math.floor(maxSeconds));
    this.nextTick = this.randBetween(this.tickMin, this.tickMax);
  }

  start() {
    if (this.loop?.isRunning()) return;
    
    // 启动主循环
    this.loop = new FrameLoop({
      tickIntervalMs: this.opts.tickIntervalMs ?? 1000,
      maxFrameDeltaMs: 250,
      autoPauseOnHidden: this.opts.autoPauseOnHidden ?? true
    });
    this.loop.addListener(async (ticks) => {
      if (!(await this.shouldRun())) return;
      this.elapsed += ticks;
      if (this.elapsed >= this.nextTick) {
        const dt = this.elapsed;
        this.elapsed = 0;
        this.nextTick = this.randBetween(this.tickMin, this.tickMax);
        await this.onTick({ dtSeconds: dt });
      }
    });
    this.loop.start();
    
    // 启动进度更新定时器（如果提供了 onProgress 回调）
    if (this.onProgress) {
      const interval = this.opts.progressUpdateIntervalMs ?? 100;
      this.progressTimer = window.setInterval(() => {
        this.onProgress?.();
      }, interval);
    }
    
    this.onStart?.();
  }

  stop() {
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }
    
    // 停止进度更新定时器
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    
    this.onStop?.();
  }

  isRunning(): boolean {
    return !!this.loop?.isRunning();
  }

  private randBetween(min: number, max: number) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}


