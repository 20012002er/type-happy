/**
 * 战斗系统配置
 */

/**
 * 自动战斗配置
 */
export interface AutoCombatConfig {
  /** 战斗间隔时间（毫秒）- 每场战斗之间的等待时间 */
  battleInterval: number;
  
  /** 战斗回合间隔（毫秒）- 每个回合之间的等待时间 */
  roundInterval: number;
}

/**
 * 默认自动战斗配置
 */
export const DEFAULT_AUTO_COMBAT_CONFIG: AutoCombatConfig = {
  battleInterval: 3000,  // 战斗间隔3秒
  roundInterval: 300     // 回合间隔300毫秒
};

/**
 * 获取战斗间隔时间
 */
export function getBattleInterval(): number {
  return DEFAULT_AUTO_COMBAT_CONFIG.battleInterval;
}

/**
 * 获取回合间隔时间
 */
export function getRoundInterval(): number {
  return DEFAULT_AUTO_COMBAT_CONFIG.roundInterval;
}

