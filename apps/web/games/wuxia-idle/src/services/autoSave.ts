import { SaveManager } from '@/services/storage/SaveManager';
import { FrameLoop } from '@/utils/frameLoop';

let timer: number | null = null;
let INTERVAL_MS = 5_000; // 5s 默认更短

let immediateTimer: number | null = null;
const IMMEDIATE_DEBOUNCE_MS = 800;
const mgr = new SaveManager('local');

// 使用 FrameLoop 管理周期性自动保存
let loop: FrameLoop | null = null;

export const startAutoSave = () => {
  if (loop?.isRunning()) return;
  const tick = async () => {
    try {
      await mgr.autoSave();
    } catch {
      // ignore
    }
  };
  // 立即一次
  tick();
  loop = new FrameLoop({ tickIntervalMs: INTERVAL_MS, maxFrameDeltaMs: 1000, autoPauseOnHidden: true });
  loop.addListener((ticks) => {
    // 累计 ticks 次，每次执行一次保存（一般为1，也可批量执行多次以追平进度）
    const run = async () => {
      for (let i = 0; i < ticks; i++) {
        await tick();
      }
    };
    void run();
  });
  loop.start();
};

export const stopAutoSave = () => {
  if (loop) {
    loop.stop();
    loop = null;
  }
};

export const setAutoSaveInterval = (ms: number) => {
  INTERVAL_MS = Math.max(1000, ms);
  if (loop?.isRunning()) {
    stopAutoSave();
    startAutoSave();
  }
};

export const requestImmediateSave = (reason?: string) => {
  if (immediateTimer) {
    clearTimeout(immediateTimer);
  }
  // 仍使用 setTimeout 作为去抖单次立即保存（不进入 FrameLoop，保持简单）
  immediateTimer = window.setTimeout(async () => {
    try {
      await mgr.autoSave();
    } catch (e) {
      // ignore
    } finally {
      immediateTimer = null;
    }
  }, IMMEDIATE_DEBOUNCE_MS);
};


