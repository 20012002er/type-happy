export interface MeditationEffect {
  id: string;
  name: string;
  percent: number; // -0.1 表示 -10%
  expiresAt: number; // 时间戳（毫秒）
}

export interface MeditationState {
  isAuto: boolean;
  isRunning: boolean;
  selectedLocationId: string | null;
  accumulator: number; // 小数经验积累
  upgradeLevel: number; // 效率升级等级
  upgradeBonusPerLevel: number; // 每级效率增长
  effects: MeditationEffect[]; // 临时效果
  // 结算节奏（可配置：min-max秒随机），以及当前周期累计与下次阈值
  elapsedSeconds?: number;
  tickMinSeconds?: number;
  tickMaxSeconds?: number;
  nextTickInSeconds?: number;
}

export interface MeditationSnapshot {
  selectedLocationId: string | null;
  upgradeLevel: number;
  effects: MeditationEffect[];
}

export interface MeditationTickResult {
  expGained: number;
  goldGained: number;
  logs: { type: 'system' | 'action' | 'reward' | 'level_up' | 'error' | 'info'; message: string }[];
}


