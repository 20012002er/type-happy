import type { Pace } from './types'

/** 逻辑画布尺寸(战斗/地图共用) */
export const VIEW_W = 480
export const VIEW_H = 300

/** 行动条满值(借鉴原作:一条黄条 3.0,招式前后摇决定出手次数) */
export const GAUGE_MAX = 3.0

/**
 * 双档节奏倍率:所有「产出速率」乘以 rate,所有「冷却/耗时」除以 rate。
 * fast 为默认档,standard 接近硬核原作节奏(仍做了网页化压缩)。
 */
export const PACE: Record<Pace, { rate: number; label: string }> = {
  fast: { rate: 5, label: '速成' },
  standard: { rate: 1, label: '标准' },
}

/** 属性点总和(出身创建时) */
export const ATTR_TOTAL = 80
export const ATTR_MIN = 10
/** 容貌+福缘总和 */
export const EXTRA_TOTAL = 40
export const FORTUNE_MAX = 27

/** 人物等级曲线:升到 L 级所需累计总经验 */
export function expForLevel(level: number): number {
  return Math.floor(12 * Math.pow(level, 2.25))
}

export function levelFromExp(exp: number): number {
  let lv = 1
  while (lv < 1000 && exp >= expForLevel(lv + 1)) lv++
  return lv
}

/** 武学升级所需修为:level → level+1 */
export function skillExpForLevel(level: number): number {
  return Math.floor(3 * Math.pow(level, 1.7)) + 10
}

/** 内力基础上限(未含打坐成长) */
export const BASE_MP = 100
/** 气血基础上限 */
export const BASE_HP = 220

/** 精神:上限基础值,恢复公式(离线分钟/3)² */
export const BASE_SPIRIT = 120
export const SPIRIT_MAX_BONUS_PER_REBIRTH = 40

/** 练功每小时精神消耗(标准档) */
export const TRAIN_SPIRIT_PER_HOUR = 120
/** 练功修为速率基数(×转化率×(1+悟性/100)) */
export const TRAIN_EXP_PER_HOUR = 14

/** 请教基本武学:单次 +5 级,潜能消耗 = 20 + 8×当前等级 */
export const TEACH_STEP = 5
export const teachPotentialCost = (level: number): number => 20 + 8 * level

/** 闭关:耗时(秒,标准档)、潜能消耗、三种结果 */
export const SECLUSION_SEC = 2 * 3600
export const SECLUSION_POTENTIAL = 400
export const SECLUSION_OUTCOME = {
  perfect: { basic: 5, art: 10, chance: 0.25 },
  normal: { basic: 1, art: 5, chance: 0.55 },
  fail: { basic: -1, art: -5, chance: 0.2 },
} as const

/** 研究:基本武学消耗(借鉴原作公式) */
export const researchPotential = (ins: number): number => Math.floor(ins * 15 + 3000)
export const researchExp = (ins: number): number => Math.floor((ins * 15 + 3000) * (1 + 0.005 * ins))
export const RESEARCH_SPIRIT = 30

/** 打坐:消耗精神、每次内力回复比例、超上限成长 */
export const MEDITATE_SPIRIT = 8
export const MEDITATE_MP_RATIO = 0.6

/** 互动练功点:单次消耗气血 / 获得武学经验 */
export const SPOT_HP_COST = 10
export const SPOT_EXP_GAIN = 15

/** 挂机基础时薪(标准档,第 n 章 ×评价×福缘×传承) */
export const IDLE_BASE = { exp: 120, silver: 60, potential: 2.5 }

/** 离线结算上限(小时) */
export const OFFLINE_CAP_H: Record<Pace, number> = { fast: 8, standard: 24 }

/** 传承:等级阈值 / 属性点 / 挂机倍率加成 */
export const REBIRTH_LEVELS = [300, 500, 700]
export const REBIRTH_POINTS = [30, 40, 50]
export const REBIRTH_IDLE_BONUS = 0.25
/** 弟子培养:单次耗时(秒,标准档)、精神、属性增量、满值 */
export const DISCIPLE_TRAIN_SEC = 1800
export const DISCIPLE_TRAIN_SPIRIT = 30
export const DISCIPLE_STEP = 5
export const DISCIPLE_MAX = 100

/** 收菜任务(沿用原作 CD 结构,任务名原创) */
export interface HarvestTask {
  id: string
  name: string
  exp: number
  cap: number
  cdHours: number
  /** 解锁:章节 index 与总经验门槛 */
  req: { chapter: number; exp: number }
}

export const HARVEST_TASKS: HarvestTask[] = [
  { id: 'pond', name: '池边打鱼', exp: 200, cap: 5000, cdHours: 0, req: { chapter: 1, exp: 1 } },
  { id: 'tea', name: '斟茶倒水', exp: 280, cap: 2800, cdHours: 0, req: { chapter: 1, exp: 1000 } },
  { id: 'yard', name: '看守磨坊', exp: 500, cap: 12000, cdHours: 1, req: { chapter: 1, exp: 2000 } },
  { id: 'dock', name: '渡口运货', exp: 1500, cap: 9000, cdHours: 4, req: { chapter: 2, exp: 5000 } },
  { id: 'show', name: '街头卖艺', exp: 2000, cap: 12000, cdHours: 4, req: { chapter: 3, exp: 15000 } },
  { id: 'repair', name: '修葺兵械', exp: 3000, cap: 9000, cdHours: 8, req: { chapter: 5, exp: 80000 } },
  { id: 'escort', name: '押送镖车', exp: 5000, cap: 10000, cdHours: 12, req: { chapter: 6, exp: 300000 } },
  { id: 'coach', name: '武馆教习', exp: 6000, cap: 12000, cdHours: 16, req: { chapter: 7, exp: 500000 } },
  { id: 'border', name: '抵御外敌', exp: 8000, cap: 16000, cdHours: 16, req: { chapter: 8, exp: 1000000 } },
  { id: 'letter', name: '护送军书', exp: 10000, cap: 20000, cdHours: 16, req: { chapter: 9, exp: 5000000 } },
]

/** 每日任务 */
export interface DailyTask {
  id: string
  name: string
  desc: string
  limit: number
  cdSec: number
  reward: { exp: number; potential: number; silver: number }
  req: { chapter: number }
}

export const DAILY_TASKS: DailyTask[] = [
  {
    id: 'thief',
    name: '夜擒飞贼',
    desc: '城中飞贼作案,追上去擒拿归案。',
    limit: 10,
    cdSec: 60,
    reward: { exp: 400, potential: 60, silver: 200 },
    req: { chapter: 1 },
  },
  {
    id: 'bandit',
    name: '剿灭匪寨',
    desc: '黑风寨匪类作乱,直捣当家老巢。',
    limit: 3,
    cdSec: 300,
    reward: { exp: 2500, potential: 400, silver: 900 },
    req: { chapter: 3 },
  },
  {
    id: 'post',
    name: '江湖送信',
    desc: '替驿卒分忧,把书信送往各处。',
    limit: 8,
    cdSec: 90,
    reward: { exp: 300, potential: 40, silver: 450 },
    req: { chapter: 2 },
  },
  {
    id: 'hunt',
    name: '缉拿恶徒',
    desc: '官府悬赏,缉拿在逃恶徒。',
    limit: 8,
    cdSec: 120,
    reward: { exp: 900, potential: 220, silver: 300 },
    req: { chapter: 4 },
  },
  {
    id: 'temple',
    name: '古刹失窃',
    desc: '山中古刹经书失窃,查访夺回。',
    limit: 1,
    cdSec: 0,
    reward: { exp: 6000, potential: 900, silver: 1200 },
    req: { chapter: 5 },
  },
]

/** 7 天签到循环 */
export interface SigninReward {
  exp?: number
  silver?: number
  potential?: number
  item?: string
  count?: number
}

export const SIGNIN_CYCLE: { label: string; reward: SigninReward }[] = [
  { label: '碎银×300', reward: { silver: 300 } },
  { label: '经验×500', reward: { exp: 500 } },
  { label: '金创药×2', reward: { item: 'med-mid', count: 2 } },
  { label: '潜能×200', reward: { potential: 200 } },
  { label: '碎银×800', reward: { silver: 800 } },
  { label: '小还丹×1', reward: { item: 'mp-pill' } },
  { label: '潜能丹×1', reward: { item: 'potential-pill' } },
]

/** 战斗调参 */
export const BATTLE = {
  /** 行动条基础填充速度(条/秒) */
  baseSpeed: 0.5,
  /** PVE 连击伤害衰减 */
  comboScale: [1, 0.6, 0.4],
  /** 部位命中倍率表 */
  parts: [
    { name: '头部', mult: 1.3 },
    { name: '颈项', mult: 1.25 },
    { name: '胸口', mult: 1.0 },
    { name: '腹部', mult: 0.95 },
    { name: '手臂', mult: 0.8 },
    { name: '腿足', mult: 0.75 },
  ],
  /** 防御减伤常数:dmg × K/(K+def+prot) */
  defK: 480,
  /** 伤势转化:每次受击 20% 转为伤势(压低气血上限) */
  injuryRatio: 0.2,
  /** 每点福缘的挂机加成 */
  fortuneIdle: 0.01,
}

/** 背包初始/上限容量与扩容价格 */
export const BAG_CAP0 = 30
export const BAG_CAP_MAX = 100
export const bagUpgradeCost = (cap: number): number => 12000 + (cap - BAG_CAP0) * 7200

/** 综合评价(挂机倍率与主站分数) */
export const EVAL_SKILL_W = 1.6
export const EVAL_ATTR_W = 3
export const EVAL_REBIRTH = 120
