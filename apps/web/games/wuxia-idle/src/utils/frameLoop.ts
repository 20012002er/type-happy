/**
 * FrameLoop - 统一封装 requestAnimationFrame 聚合定时器
 *
 * 设计目标：
 * - 聚合帧时间，按固定 tick 间隔（默认 1000ms）批量触发回调，避免高频业务逻辑执行
 * - 自动处理后台标签页、长时间停顿（可选最大帧间隔限制）
 * - 可配置是否在页面隐藏时自动暂停
 * - 提供 setTimeout 作为降级兜底（极少数环境无 rAF）
 * - KISS + SOLID：简单清晰的 API 与职责分离
 */

export interface FrameLoopOptions {
  /** 触发业务 tick 的时间间隔（毫秒），默认 1000ms */
  tickIntervalMs?: number;
  /** 单帧允许的最大 delta（毫秒），超过将被夹紧以避免突发巨量 tick，默认 250ms */
  maxFrameDeltaMs?: number;
  /** 页面隐藏时是否自动暂停，默认 true */
  autoPauseOnHidden?: boolean;
  /** 当不存在 rAF 时是否使用 setTimeout 兜底，默认 true */
  useSetTimeoutFallback?: boolean;
}

export interface FrameTickContext {
  /** 本次计算过程中累计超过 tickIntervalMs 的毫秒数（去除整 tick 后的余量不包含在内） */
  elapsedMsSinceLastTick: number;
  /** 截止本次回调，总共触发过的 tick 数（可用于统计） */
  tickCount: number;
  /** 当前时间戳（高精度） */
  now: number;
}

export type FrameTickListener = (ticks: number, ctx: FrameTickContext) => void;

export class FrameLoop {
  private readonly tickIntervalMs: number;
  private readonly maxFrameDeltaMs: number;
  private readonly autoPauseOnHidden: boolean;
  private readonly useSetTimeoutFallback: boolean;

  private rafId: number | null = null;
  private timeoutId: number | null = null;
  private lastTs = 0;
  private accumulatorMs = 0;
  private running = false;
  private totalTicks = 0;
  private listeners: Set<FrameTickListener> = new Set();

  constructor(options: FrameLoopOptions = {}) {
    this.tickIntervalMs = Math.max(1, options.tickIntervalMs ?? 1000);
    this.maxFrameDeltaMs = Math.max(16, options.maxFrameDeltaMs ?? 250);
    this.autoPauseOnHidden = options.autoPauseOnHidden ?? true;
    this.useSetTimeoutFallback = options.useSetTimeoutFallback ?? true;
  }

  addListener(listener: FrameTickListener) {
    this.listeners.add(listener);
  }

  removeListener(listener: FrameTickListener) {
    this.listeners.delete(listener);
  }

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    this.accumulatorMs = 0;
    this.totalTicks = 0;

    if (this.autoPauseOnHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    this.scheduleNext();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.autoPauseOnHidden && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.lastTs = 0;
    this.accumulatorMs = 0;
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      // 页面隐藏：暂停并重置时间累积，避免回来后瞬间触发大量 tick
      this.lastTs = 0;
    }
  };

  private scheduleNext() {
    const hasRAF = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
    if (hasRAF) {
      this.rafId = requestAnimationFrame(this.onFrame);
    } else if (this.useSetTimeoutFallback) {
      // fallback：用较小的步长模拟 rAF
      this.timeoutId = setTimeout(() => this.onFrame(performance.now()), 16) as unknown as number;
    }
  }

  private onFrame = (ts: number) => {
    if (!this.running) return;
    if (this.lastTs === 0) this.lastTs = ts;
    let delta = ts - this.lastTs;
    // 夹紧单帧 delta，避免长时间后台导致的瞬时巨量 tick
    if (delta > this.maxFrameDeltaMs) delta = this.maxFrameDeltaMs;
    this.lastTs = ts;

    this.accumulatorMs += delta;
    let ticks = 0;
    while (this.accumulatorMs >= this.tickIntervalMs) {
      this.accumulatorMs -= this.tickIntervalMs;
      ticks++;
    }

    if (ticks > 0 && this.listeners.size > 0) {
      this.totalTicks += ticks;
      const ctx: FrameTickContext = {
        elapsedMsSinceLastTick: ticks * this.tickIntervalMs,
        tickCount: this.totalTicks,
        now: ts
      };
      // 通知所有监听者（例如：传入 ticks=秒数，供业务批量结算）
      this.listeners.forEach(listener => listener(ticks, ctx));
    }

    this.scheduleNext();
  };
}


