import type { Season } from './game'

/** 任务类型 */
export type QuestType = 'delivery' | 'fishing' | 'mining' | 'gathering' | 'special_order'

/** 任务目标模板 */
export interface QuestTargetDef {
  itemId: string
  name: string
  minQty: number
  maxQty: number
  /** 该目标在哪些季节可用 (空数组=全季节) */
  seasons: Season[]
  /** 物品单价(用于计算奖励) */
  unitPrice: number
}

/** 任务模板(按类型) */
export interface QuestTemplateDef {
  type: QuestType
  targets: QuestTargetDef[]
  npcPool: string[]
  rewardMultiplier: number
  friendshipReward: number
}

/** 任务实例(运行时) */
export interface QuestInstance {
  id: string
  type: QuestType
  npcId: string
  npcName: string
  description: string
  targetItemId: string
  targetItemName: string
  targetQuantity: number
  collectedQuantity: number
  moneyReward: number
  friendshipReward: number
  daysRemaining: number
  accepted: boolean
  /** 物品奖励（特殊订单） */
  itemReward?: { itemId: string; quantity: number }[]
  /** 难度标签（特殊订单） */
  tierLabel?: string
}

// ============================================================
// 主线任务类型
// ============================================================

/** 主线任务目标类型 */
export type MainQuestObjectiveType =
  | 'earnMoney'
  | 'reachMineFloor'
  | 'reachSkullFloor'
  | 'skillLevel'
  | 'allSkillsLevel'
  | 'harvestCrops'
  | 'catchFish'
  | 'cookRecipes'
  | 'killMonsters'
  | 'discoverItems'
  | 'npcFriendship'
  | 'npcAllFriendly'
  | 'completeBundles'
  | 'completeQuests'
  | 'shipItems'
  | 'ownAnimals'
  | 'married'
  | 'settleDown'
  | 'hasChild'
  | 'household'
  | 'deliverItem'

/** 主线任务单个目标 */
export interface MainQuestObjective {
  type: MainQuestObjectiveType
  /** 目标描述文本 */
  label: string
  /** 数值目标(金钱/层数/等级/数量) */
  target?: number
  /** 技能类型(skillLevel时) */
  skillType?: string
  /** NPC ID(npcFriendship时) */
  npcId?: string
  /** 好感等级(npcFriendship/npcAllFriendly时) */
  friendshipLevel?: string
  /** 物品ID(deliverItem时) */
  itemId?: string
  /** 物品数量(deliverItem时) */
  itemQuantity?: number
}

/** 主线任务定义(数据层) */
export interface MainQuestDef {
  id: string
  chapter: number
  order: number
  title: string
  description: string
  npcId: string
  objectives: MainQuestObjective[]
  moneyReward: number
  friendshipReward?: { npcId: string; amount: number }[]
  itemReward?: { itemId: string; quantity: number }[]
}

/** 主线任务运行时状态 */
export interface MainQuestState {
  questId: string
  accepted: boolean
  objectiveProgress: boolean[]
}
