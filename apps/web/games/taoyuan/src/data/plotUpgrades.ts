/** 地块升级费用（文），下标为当前等级：Lv.0→1、Lv.1→2、Lv.2→3；满级 Lv.3 */
export const PLOT_UPGRADE_COSTS: readonly number[] = [10000, 100000, 1000000]

/** 从当前等级升一级的费用，满级返回 null */
export const getPlotUpgradeCost = (currentLevel: number): number | null => PLOT_UPGRADE_COSTS[currentLevel] ?? null
