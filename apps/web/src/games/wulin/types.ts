/** 放置武林 —— 核心类型定义(机制借鉴《放置江湖》,内容原创) */

/** 四维属性:臂力 / 身法 / 根骨 / 悟性 */
export interface Attrs {
  arm: number
  agi: number
  bone: number
  ins: number
}

export type AttrKey = keyof Attrs

export type Pace = 'fast' | 'standard'

/** 武学装备位:输出 / 内功 / 轻功 / 招架 */
export type SkillSlot = 'output' | 'internal' | 'lightness' | 'parry'

/** 武器类别 */
export type WeaponType = 'sword' | 'blade' | 'staff' | 'whip' | 'ring' | 'hidden' | 'fist'

/** 基本武学类别(决定后天属性成长与可装备门类) */
export type BasicKind = 'fist' | 'parry' | 'internal' | 'lightness' | 'sword' | 'blade' | 'staff' | 'hidden' | 'read'

export type ArmorSlot = 'head' | 'body' | 'hands' | 'legs' | 'feet'

export type Gender = 'male' | 'female'

/** 招式(战斗时随机施展,前后摇消耗行动条) */
export interface SkillMove {
  name: string
  /** 招式攻击倍率 */
  atk: number
  /** 招式附加伤害 */
  dmg: number
  /** 前摇 */
  pre: number
  /** 后摇 */
  post: number
}

/** 主动技能(残页解锁) */
export interface ActiveSkill {
  name: string
  /** 解锁所需残页数 */
  pages: number
  /** 内力消耗 */
  mp: number
  /** 冷却(秒) */
  cd: number
  kind: 'damage' | 'heal' | 'control'
  /** 伤害倍率 / 治疗量 / 眩晕秒数 */
  power: number
  desc: string
}

export interface SkillDef {
  id: string
  name: string
  /** 所属门派 id;null = 基本/公共武学 */
  sect: string | null
  tier: 'basic' | 'sect' | 'public' | 'hidden' | 'secret'
  /** 可装备的位置 */
  slots: SkillSlot[]
  /** 对应的基本武学(等级上限受其约束;装备时占用哪个基本槽) */
  basic: BasicKind | null
  /** 需求武器类别;null = 空手 */
  weapon: WeaponType | null
  /** 转化率(25~80,越高练功越快) */
  conversion: number
  /** 攻击系数 */
  atkCoef: number
  /** 伤害系数 */
  dmgCoef: number
  /** 命中系数 */
  hitCoef: number
  /** 加力攻击系数 */
  pAtkCoef: number
  /** 防御系数(招架位) */
  defCoef: number
  /** 闪避系数(轻功位) */
  dodgeCoef: number
  /** 攻速系数 */
  speedCoef: number
  /** 生命系数(内功位:影响气血上限) */
  hpCoef: number
  /** 内力系数(内功位:影响内力上限) */
  mpCoef: number
  /** 请教习得/升级成本 */
  learn: { potential: number; silver: number; contribution: number }
  moves: SkillMove[]
  active: ActiveSkill | null
  desc: string
}

export interface SkillState {
  /** 武学等级 */
  level: number
  /** 当前等级内的修为经验 */
  exp: number
  /** 主动技能是否已解锁 */
  activeUnlocked: boolean
}

export interface ItemDef {
  id: string
  name: string
  kind: 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'page'
  weapon?: { type: WeaponType; atk: number; weight: number }
  armor?: { slot: ArmorSlot; def: number; prot: number }
  /** 使用效果 */
  use?: {
    hp?: number
    mp?: number
    injury?: number
    spirit?: number
    exp?: number
    potential?: number
    mpMax?: number
  }
  /** 商店售价(碎银) */
  price?: number
  /** 对应武学 id(kind=page 时) */
  skill?: string
  desc: string
}

export interface NpcDef {
  id: string
  name: string
  title?: string
  gender: Gender
  /** 强度档位(≈人物等级) */
  level: number
  attrs: Attrs
  hp?: number
  mp?: number
  /** 使用的武学(id + 等级) */
  skills: { id: string; level: number }[]
  /** 加力值 */
  power: number
  /** 是否可决斗 */
  hostile: boolean
  dialog?: string[]
  /** 可请教的武学 id */
  teach?: string[]
  /** 出售物品(碎银价) */
  shop?: { id: string; price: number }[]
  /** 击败掉落 */
  drops?: { id: string; chance: number }[]
  /** 击败奖励:经验倍率(基于 npc 等级自动算,可覆盖) */
  expReward?: number
  silverReward?: number
  /** 送礼喜好(物品 id → 好感效果) */
  gift?: { likes: string[]; reward: { exp?: number; silver?: number; potential?: number; item?: string; flag?: string } }
}

export interface RoomExit {
  dir: string
  to: string
}

export interface RoomDef {
  id: string
  name: string
  desc: string
  exits: RoomExit[]
  npcs?: string[]
  /** 一次性拾取物 */
  pickups?: { item: string; count?: number }[]
  /** 互动练功点:点击消耗气血换武学经验 */
  train?: { skill: string; label: string; cap: number }[]
  /** 场景风格(渲染用) */
  scene?: 'village' | 'town' | 'mountain' | 'forest' | 'temple' | 'city' | 'cave' | 'water'
}

export interface QuestStep {
  desc: string
  type: 'defeat' | 'talk' | 'fetch' | 'pickup'
  /** npc id / item id / room id */
  target: string
  give?: { exp?: number; silver?: number; potential?: number; item?: string; count?: number }
}

export interface ChapterDef {
  id: string
  index: number
  title: string
  intro: string
  start: string
  rooms: RoomDef[]
  /** 主线步骤(顺序完成) */
  quest: QuestStep[]
  reward: { exp: number; silver: number; potential?: number; item?: string }
}

export interface SectTask {
  name: string
  level: number
  desc: string
  cdHours: number
  reward: { contribution: number; prestige: number; exp: number; page?: string }
}

export interface SectDef {
  id: string
  name: string
  kind: 'righteous' | 'neutral' | 'hidden'
  gender?: Gender
  /** 入门先天属性要求 */
  requires?: Partial<Attrs>
  /** 需完成首次传承才可加入 */
  rebirthOnly?: boolean
  desc: string
  /** 掌门/师傅 NPC */
  master: string
  /** 门派驻地(章节 id + 房间 id) */
  home: { chapter: string; room: string }
  skills: string[]
  /** 可请教的基本武学 */
  basics: BasicKind[]
  tasks: SectTask[]
  /** 贡献兑换商店(物品 id → 贡献价) */
  shop: { id: string; cost: number }[]
}

export interface OriginDef {
  id: string
  name: string
  desc: string
  /** 先天属性单项上限 */
  cap: number
  /** 单项属性特别上限(默认用 cap) */
  capOverride?: Partial<Attrs>
  /** 额外福缘 */
  fortuneBonus?: number
  startSkills?: { id: string; level: number }[]
  startItems?: { id: string; count: number }[]
  silver?: number
}

export interface Character {
  name: string
  gender: Gender
  origin: string
  /** 先天四维 */
  innate: Attrs
  /** 传承分配的属性点(加到先天上) */
  rebirthAttrs: Attrs
  /** 传承获得的未分配属性点 */
  attrPoints: number
  appearance: number
  fortune: number
  /** 总经验(决定人物等级) */
  exp: number
  potential: number
  spirit: number
  /** 打坐修炼出的永久内力上限加成 */
  mpGrown: number
  /** 伤势(临时压低气血上限) */
  injury: number
  /** 当前气血比例(0~1,1=满;随时间缓慢恢复) */
  hp: number
  silver: number
  bank: number
  contribution: number
  prestige: number
  experience: number
  rebirths: number
  sect: string | null
  skills: Record<string, SkillState>
  equipped: Partial<Record<SkillSlot, string>>
  /** 残页数量(skillId → 张数) */
  pages: Record<string, number>
  weapon: string | null
  armor: Partial<Record<ArmorSlot, string>>
  bag: Record<string, number>
  bagCap: number
  /** 已解锁的主动技能使用开关 */
  autoActive: boolean
}

export interface Disciple {
  name: string
  attrs: Attrs
}

export interface GameProgress {
  chapter: string
  room: string
  /** 每章主线已完成步骤下标(chapterId → 步骤集合,任意顺序完成) */
  questByChapter?: Record<string, number[]>
  unlocked: string[]
  defeated: string[]
  picked: string[]
  trains: Record<string, number>
  flags: Record<string, boolean>
  /** 已完成章节 */
  chaptersDone: string[]
}

export interface DailyState {
  date: string
  done: Record<string, number>
  signin: number
  signinDate: string
  sectTasks: Record<string, number>
}

export interface WulinSave {
  version: 1
  createdAt: number
  lastSeen: number
  settings: { sound: boolean; pace: Pace }
  char: Character | null
  progress: GameProgress
  /** 练功中(时间戳结算) */
  training: { skill: string | null; since: number }
  /** 闭关中 */
  seclusion: { skill: string | null; since: number; totalSec: number; guard: boolean }
  /** 挂机地图(章节 id) */
  idle: { chapter: string | null; since: number }
  /** 收菜任务下次可用时间戳 */
  harvest: Record<string, number>
  daily: DailyState
  rebirth: { stage: number; disciple: Disciple | null; trainedAt: number }
  seenIntro: boolean
  /** 江湖日志(最近 60 条) */
  log: string[]
}
