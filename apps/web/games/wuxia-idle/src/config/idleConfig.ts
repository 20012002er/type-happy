/**
 * Idle挂机配置
 * 按照MMORPG + Idle规范实现
 */

// 地点挂机配置
export interface LocationIdleConfig {
  locationId: string;
  baseExpPerSecond: number;    // 基础每秒经验
  baseGoldPerSecond: number;   // 基础每秒金币
  levelMultiplier: number;     // 等级倍数
  maxIdleHours: number;        // 最大挂机时长（小时）
  requirements?: {
    minLevel?: number;         // 最低等级要求
    maxLevel?: number;         // 最高等级限制（超过此等级收益减半）
  };
}

// 挂机地点配置表
export const IDLE_LOCATIONS: Record<string, LocationIdleConfig> = {
  newbie_village: {
    locationId: 'newbie_village',
    baseExpPerSecond: 0.1,     // 每秒0.1经验
    baseGoldPerSecond: 0.05,   // 每秒0.05金币
    levelMultiplier: 1.0,      // 无等级加成
    maxIdleHours: 12,          // 最多挂机12小时
    requirements: {
      maxLevel: 5              // 5级以上收益减半
    }
  },
  forest_path: {
    locationId: 'forest_path',
    baseExpPerSecond: 0.2,     // 每秒0.2经验
    baseGoldPerSecond: 0.08,   // 每秒0.08金币
    levelMultiplier: 1.2,      // 等级加成20%
    maxIdleHours: 24,          // 最多挂机24小时
    requirements: {
      minLevel: 3              // 需要3级以上
    }
  },
  mountain_trail: {
    locationId: 'mountain_trail',
    baseExpPerSecond: 0.3,     // 每秒0.3经验
    baseGoldPerSecond: 0.12,   // 每秒0.12金币
    levelMultiplier: 1.5,      // 等级加成50%
    maxIdleHours: 24,
    requirements: {
      minLevel: 8              // 需要8级以上
    }
  }
};

// 默认挂机配置（如果找不到地点配置）
export const DEFAULT_IDLE_CONFIG: LocationIdleConfig = {
  locationId: 'unknown',
  baseExpPerSecond: 0.05,
  baseGoldPerSecond: 0.02,
  levelMultiplier: 1.0,
  maxIdleHours: 6,
  requirements: {}
};

/**
 * 计算Idle经验收益
 * 按照文档规范：idle_exp = idle_duration_seconds × exp_rate_per_second
 */
export function calculateIdleExpRewards(
  locationId: string,
  playerLevel: number,
  idleDurationSeconds: number
): {
  totalExp: number;
  totalGold: number;
  effectiveSeconds: number;
  expRatePerSecond: number;
  goldRatePerSecond: number;
} {
  // 获取地点配置
  const locationConfig = IDLE_LOCATIONS[locationId] || DEFAULT_IDLE_CONFIG;
  
  // 检查等级要求
  if (locationConfig.requirements?.minLevel && playerLevel < locationConfig.requirements.minLevel) {
    return {
      totalExp: 0,
      totalGold: 0,
      effectiveSeconds: 0,
      expRatePerSecond: 0,
      goldRatePerSecond: 0
    };
  }
  
  // 限制最大挂机时间
  const maxIdleSeconds = locationConfig.maxIdleHours * 3600;
  const effectiveSeconds = Math.min(idleDurationSeconds, maxIdleSeconds);
  
  // 计算每秒收益率
  let expRatePerSecond = locationConfig.baseExpPerSecond;
  let goldRatePerSecond = locationConfig.baseGoldPerSecond;
  
  // 应用等级倍数
  expRatePerSecond *= (1 + (playerLevel - 1) * (locationConfig.levelMultiplier - 1));
  goldRatePerSecond *= (1 + (playerLevel - 1) * (locationConfig.levelMultiplier - 1));
  
  // 如果等级过高，收益减半
  if (locationConfig.requirements?.maxLevel && playerLevel > locationConfig.requirements.maxLevel) {
    expRatePerSecond *= 0.5;
    goldRatePerSecond *= 0.5;
  }
  
  // 计算总收益：idle_exp = idle_duration_seconds × exp_rate_per_second
  const totalExp = Math.floor(effectiveSeconds * expRatePerSecond);
  const totalGold = Math.floor(effectiveSeconds * goldRatePerSecond);
  
  return {
    totalExp,
    totalGold,
    effectiveSeconds,
    expRatePerSecond,
    goldRatePerSecond
  };
}

/**
 * 获取地点的挂机收益预览
 */
export function getIdleRatePreview(locationId: string, playerLevel: number): {
  expPerHour: number;
  goldPerHour: number;
  canIdle: boolean;
  requirementMessage?: string;
} {
  const locationConfig = IDLE_LOCATIONS[locationId] || DEFAULT_IDLE_CONFIG;
  
  // 检查等级要求
  if (locationConfig.requirements?.minLevel && playerLevel < locationConfig.requirements.minLevel) {
    return {
      expPerHour: 0,
      goldPerHour: 0,
      canIdle: false,
      requirementMessage: `需要等级 ${locationConfig.requirements.minLevel} 以上`
    };
  }
  
  // 计算小时收益
  const { expRatePerSecond, goldRatePerSecond } = calculateIdleExpRewards(
    locationId, 
    playerLevel, 
    3600 // 1小时
  );
  
  return {
    expPerHour: Math.floor(expRatePerSecond * 3600),
    goldPerHour: Math.floor(goldRatePerSecond * 3600),
    canIdle: true
  };
}

/**
 * 格式化离线时间显示
 */
export function formatIdleTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${remainingSeconds}秒`;
  } else {
    return `${remainingSeconds}秒`;
  }
}
