/** 每日行情系统 — 季节系数 × 供需系数 × 随机波动(±5%)，clamp [0.5, 2.0] */

// === 类型 ===

export type MarketCategory = 'crop' | 'fish' | 'animal_product' | 'processed' | 'fruit' | 'ore' | 'gem'
export type MarketTrend = 'boom' | 'rising' | 'stable' | 'falling' | 'crash'

export interface CategoryMarketInfo {
  category: MarketCategory
  multiplier: number
  trend: MarketTrend
}

// === 常量 ===

const MARKET_CATEGORIES: MarketCategory[] = ['crop', 'fish', 'animal_product', 'processed', 'fruit', 'ore', 'gem']

/** 季节系数：[spring, summer, autumn, winter] */
const SEASON_COEFFICIENTS: Record<MarketCategory, [number, number, number, number]> = {
  crop: [1.0, 0.9, 0.85, 1.2], // 秋收最便宜，冬季最贵
  fish: [1.0, 0.9, 1.0, 1.15], // 夏季鱼多便宜，冬季贵
  animal_product: [1.0, 0.95, 1.0, 1.1], // 冬季畜产品需求高
  processed: [0.95, 1.0, 1.1, 1.05], // 秋季加工品需求旺
  fruit: [1.1, 0.85, 0.9, 1.2], // 夏季水果多便宜，冬季贵
  ore: [1.0, 1.05, 1.0, 0.9], // 冬季矿多便宜
  gem: [1.0, 1.05, 1.0, 0.9] // 同矿石
}

/** 供需阈值：7天累计出货量 */
const SUPPLY_THRESHOLDS: Record<MarketCategory, { low: number; mid: number; high: number }> = {
  crop: { low: 20, mid: 50, high: 100 },
  fish: { low: 10, mid: 25, high: 50 },
  animal_product: { low: 10, mid: 25, high: 50 },
  processed: { low: 5, mid: 15, high: 30 },
  fruit: { low: 10, mid: 25, high: 50 },
  ore: { low: 15, mid: 40, high: 80 },
  gem: { low: 3, mid: 8, high: 15 }
}

export const TREND_NAMES: Record<MarketTrend, string> = {
  boom: '大涨',
  rising: '上涨',
  stable: '平稳',
  falling: '下跌',
  crash: '暴跌'
}

export const TREND_COLORS: Record<MarketTrend, string> = {
  boom: 'text-danger border-danger/30',
  rising: 'text-success border-success/30',
  stable: 'text-muted border-muted/20',
  falling: 'text-warning border-warning/30',
  crash: 'text-danger border-danger/30'
}

export const MARKET_CATEGORY_NAMES: Record<MarketCategory, string> = {
  crop: '农产品',
  fish: '鱼类',
  animal_product: '畜产品',
  processed: '加工品',
  fruit: '水果',
  ore: '矿石',
  gem: '宝石'
}

// === 伪随机 ===

const seededRandom = (seed: number): (() => number) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// === 内部计算 ===

const _isMarketCategory = (category: string): category is MarketCategory => {
  return MARKET_CATEGORIES.includes(category as MarketCategory)
}

const _clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

/** 线性插值 */
const _lerp = (v: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number => {
  const t = (v - fromMin) / (fromMax - fromMin)
  return toMin + t * (toMax - toMin)
}

/** 供需系数：出货越多价格越低 */
const _computeSupplyDemand = (category: MarketCategory, recentVolume: number): number => {
  const th = SUPPLY_THRESHOLDS[category]
  if (recentVolume <= 0) return 1.1
  if (recentVolume < th.low) return _lerp(recentVolume, 0, th.low, 1.1, 1.0)
  if (recentVolume < th.mid) return _lerp(recentVolume, th.low, th.mid, 1.0, 0.9)
  if (recentVolume < th.high) return _lerp(recentVolume, th.mid, th.high, 0.9, 0.8)
  return 0.8
}

/** 三因子计算：季节 × 供需 × 随机(±5%) */
const _computeMultiplier = (category: MarketCategory, seasonIndex: number, rng: () => number, recentVolume: number): number => {
  const season = SEASON_COEFFICIENTS[category][seasonIndex] ?? 1.0
  const supply = _computeSupplyDemand(category, recentVolume)
  const random = 0.95 + rng() * 0.1 // 0.95 ~ 1.05
  return _clamp(Math.round(season * supply * random * 100) / 100, 0.5, 2.0)
}

const _toTrend = (multiplier: number): MarketTrend => {
  if (multiplier >= 1.4) return 'boom'
  if (multiplier > 1.05) return 'rising'
  if (multiplier <= 0.6) return 'crash'
  if (multiplier < 0.95) return 'falling'
  return 'stable'
}

// === 公开 API ===

/** 获取某品类当日价格系数（非波动品类返回 1.0） */
export const getMarketMultiplier = (
  category: string,
  year: number,
  seasonIndex: number,
  day: number,
  recentCategoryVolume?: number
): number => {
  if (!_isMarketCategory(category)) return 1.0
  const info = getDailyMarketInfo(
    year,
    seasonIndex,
    day,
    recentCategoryVolume !== undefined ? { [category]: recentCategoryVolume } : undefined
  )
  return info.find(i => i.category === category)?.multiplier ?? 1.0
}

/** 缓存 */
let _cache: { key: string; data: CategoryMarketInfo[] } | null = null

/** 获取当日所有品类行情 */
export const getDailyMarketInfo = (
  year: number,
  seasonIndex: number,
  day: number,
  recentShipping?: Partial<Record<MarketCategory, number>>
): CategoryMarketInfo[] => {
  const shipping = recentShipping ?? {}
  const key = `${year}-${seasonIndex}-${day}-${JSON.stringify(shipping)}`
  if (_cache?.key === key) return _cache.data

  const seed = year * 10000 + seasonIndex * 1000 + day * 37 + 7777
  const rng = seededRandom(seed)

  const data: CategoryMarketInfo[] = MARKET_CATEGORIES.map(category => {
    const volume = shipping[category] ?? 0
    const multiplier = _computeMultiplier(category, seasonIndex, rng, volume)
    return { category, multiplier, trend: _toTrend(multiplier) }
  })

  _cache = { key, data }
  return data
}
