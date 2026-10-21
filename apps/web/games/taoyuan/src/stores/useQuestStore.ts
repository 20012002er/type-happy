import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { QuestInstance, Season, MainQuestState, MainQuestObjective } from '@/types'
import { generateQuest, generateSpecialOrder as _generateSpecialOrder } from '@/data/quests'
import { getStoryQuestById, getNextStoryQuest, getFirstStoryQuest, STORY_QUESTS } from '@/data/storyQuests'
import { getNpcById } from '@/data/npcs'
import { useInventoryStore } from './useInventoryStore'
import { usePlayerStore } from './usePlayerStore'
import { useNpcStore } from './useNpcStore'
import { useAchievementStore } from './useAchievementStore'
import { useSkillStore } from './useSkillStore'
import { useShopStore } from './useShopStore'
import { useAnimalStore } from './useAnimalStore'

export const useQuestStore = defineStore('quest', () => {
  const inventoryStore = useInventoryStore()
  const playerStore = usePlayerStore()
  const npcStore = useNpcStore()
  const achievementStore = useAchievementStore()

  /** 告示栏上的可接取任务 */
  const boardQuests = ref<QuestInstance[]>([])

  /** 已接取的进行中任务 */
  const activeQuests = ref<QuestInstance[]>([])

  /** 累计完成任务数 */
  const completedQuestCount = ref<number>(0)

  /** 当前可接取的特殊订单 */
  const specialOrder = ref<QuestInstance | null>(null)

  /** 最大同时接取任务数 */
  const MAX_ACTIVE_QUESTS = 3

  /** 每日生成新任务到告示栏 */
  const generateDailyQuests = (season: Season, day: number) => {
    boardQuests.value = [] // 清空旧的告示栏
    const count = 1 + Math.floor(Math.random() * 2) // 1-2个
    for (let i = 0; i < count; i++) {
      const quest = generateQuest(season, day)
      if (quest) {
        boardQuests.value.push(quest)
      }
    }
  }

  /** 按梯度生成特殊订单 (tier: 1-4 对应 第7/14/21/28天) */
  const generateSpecialOrder = (season: Season, tier: number) => {
    const order = _generateSpecialOrder(season, tier)
    specialOrder.value = order
  }

  /** 接取任务 */
  const acceptQuest = (questId: string): { success: boolean; message: string } => {
    if (activeQuests.value.length >= MAX_ACTIVE_QUESTS) {
      return {
        success: false,
        message: `最多同时接取${MAX_ACTIVE_QUESTS}个任务。`
      }
    }
    const idx = boardQuests.value.findIndex(q => q.id === questId)
    if (idx === -1) return { success: false, message: '任务不存在。' }

    const quest = boardQuests.value[idx]!
    quest.accepted = true

    // 非送货类委托：检查背包中已有的物品数量
    if (quest.type !== 'delivery') {
      quest.collectedQuantity = Math.min(inventoryStore.getItemCount(quest.targetItemId), quest.targetQuantity)
    }

    activeQuests.value.push(quest)
    boardQuests.value.splice(idx, 1)
    return { success: true, message: `接取了任务：${quest.description}` }
  }

  /** 接取特殊订单 */
  const acceptSpecialOrder = (): { success: boolean; message: string } => {
    if (!specialOrder.value) return { success: false, message: '没有可接取的特殊订单。' }
    if (activeQuests.value.length >= MAX_ACTIVE_QUESTS) {
      return {
        success: false,
        message: `最多同时接取${MAX_ACTIVE_QUESTS}个任务。`
      }
    }

    const order = specialOrder.value
    order.accepted = true
    order.collectedQuantity = Math.min(inventoryStore.getItemCount(order.targetItemId), order.targetQuantity)

    activeQuests.value.push(order)
    specialOrder.value = null
    return { success: true, message: `接取了特殊订单：${order.description}` }
  }

  /** 提交完成的任务 */
  const submitQuest = (questId: string): { success: boolean; message: string } => {
    const idx = activeQuests.value.findIndex(q => q.id === questId)
    if (idx === -1) return { success: false, message: '任务不存在。' }

    const quest = activeQuests.value[idx]!

    // 送货类委托：提交时从背包扣除物品
    if (quest.type === 'delivery') {
      if (!inventoryStore.hasItem(quest.targetItemId, quest.targetQuantity)) {
        return {
          success: false,
          message: `背包中${quest.targetItemName}不足。`
        }
      }
      inventoryStore.removeItem(quest.targetItemId, quest.targetQuantity)
    } else {
      // 钓鱼/挖矿/采集/特殊订单类：检查收集进度或背包数量
      const effectiveProgress = Math.max(quest.collectedQuantity, inventoryStore.getItemCount(quest.targetItemId))
      if (effectiveProgress < quest.targetQuantity) {
        return {
          success: false,
          message: `${quest.targetItemName}收集进度不足（${effectiveProgress}/${quest.targetQuantity}）。`
        }
      }
    }

    // 发放铜钱奖励
    playerStore.earnMoney(quest.moneyReward)
    npcStore.adjustFriendship(quest.npcId, quest.friendshipReward)

    // 发放物品奖励
    if (quest.itemReward) {
      for (const item of quest.itemReward) {
        inventoryStore.addItem(item.itemId, item.quantity)
      }
    }

    // 记录完成
    completedQuestCount.value++

    // 从活跃列表移除
    activeQuests.value.splice(idx, 1)

    let message = `完成了${quest.npcName}的委托！获得${quest.moneyReward}文，${quest.npcName}好感+${quest.friendshipReward}。`
    if (quest.itemReward && quest.itemReward.length > 0) {
      const itemNames = quest.itemReward.map(i => `${i.quantity}个物品`).join('、')
      message += ` 额外获得${itemNames}。`
    }

    return { success: true, message }
  }

  /** 当玩家获得某物品时，更新进行中任务的进度（钓鱼/挖矿/采集类） */
  const onItemObtained = (itemId: string, quantity: number = 1) => {
    for (const quest of activeQuests.value) {
      if (quest.type === 'delivery') continue // 送货类不自动追踪
      if (quest.targetItemId === itemId && quest.collectedQuantity < quest.targetQuantity) {
        quest.collectedQuantity = Math.min(quest.collectedQuantity + quantity, quest.targetQuantity)
      }
    }

    // 同步刷新主线任务中 deliverItem 目标的进度
    if (mainQuest.value?.accepted) {
      const def = getStoryQuestById(mainQuest.value.questId)
      if (def) {
        for (let i = 0; i < def.objectives.length; i++) {
          const obj = def.objectives[i]!
          if (obj.type === 'deliverItem' && obj.itemId === itemId && !mainQuest.value.objectiveProgress[i]) {
            mainQuest.value.objectiveProgress[i] = evaluateObjective(obj)
          }
        }
      }
    }
  }

  /** 每日更新：天数递减，过期移除 */
  const dailyUpdate = () => {
    // 活跃委托剩余天数递减
    const expired: QuestInstance[] = []
    activeQuests.value = activeQuests.value.filter(q => {
      q.daysRemaining--
      if (q.daysRemaining <= 0) {
        expired.push(q)
        return false
      }
      return true
    })

    // 特殊订单过期（未接取也会过期）
    if (specialOrder.value) {
      specialOrder.value.daysRemaining--
      if (specialOrder.value.daysRemaining <= 0) {
        specialOrder.value = null
      }
    }

    return expired
  }

  /** 检查是否有任务关注某物品 */
  const hasActiveQuestFor = (itemId: string): boolean => {
    return activeQuests.value.some(q => q.targetItemId === itemId)
  }

  // ============================================================
  // 主线任务
  // ============================================================

  /** 当前主线任务状态 */
  const mainQuest = ref<MainQuestState | null>(null)

  /** 已完成的主线任务ID列表 */
  const completedMainQuests = ref<string[]>([])

  /** 好感等级层级顺序 */
  const LEVEL_ORDER = ['stranger', 'acquaintance', 'friendly', 'bestFriend'] as const
  const meetsLevel = (current: string, required: string): boolean => {
    return LEVEL_ORDER.indexOf(current as (typeof LEVEL_ORDER)[number]) >= LEVEL_ORDER.indexOf(required as (typeof LEVEL_ORDER)[number])
  }

  /** 评估单个目标是否达成 */
  const evaluateObjective = (obj: MainQuestObjective): boolean => {
    const skillStore = useSkillStore()
    const shopStore = useShopStore()
    const animalStore = useAnimalStore()

    switch (obj.type) {
      case 'earnMoney':
        return achievementStore.stats.totalMoneyEarned >= (obj.target ?? 0)
      case 'reachMineFloor':
        return achievementStore.stats.highestMineFloor >= (obj.target ?? 0)
      case 'reachSkullFloor':
        return achievementStore.stats.skullCavernBestFloor >= (obj.target ?? 0)
      case 'skillLevel':
        if (obj.skillType) {
          return skillStore.getSkill(obj.skillType as 'farming' | 'foraging' | 'fishing' | 'mining' | 'combat').level >= (obj.target ?? 0)
        }
        // 无指定技能类型 = 任意技能达标
        return skillStore.skills.some(s => s.level >= (obj.target ?? 0))
      case 'allSkillsLevel':
        return skillStore.skills.every(s => s.level >= (obj.target ?? 0))
      case 'harvestCrops':
        return achievementStore.stats.totalCropsHarvested >= (obj.target ?? 0)
      case 'catchFish':
        return achievementStore.stats.totalFishCaught >= (obj.target ?? 0)
      case 'cookRecipes':
        return achievementStore.stats.totalRecipesCooked >= (obj.target ?? 0)
      case 'killMonsters':
        return achievementStore.stats.totalMonstersKilled >= (obj.target ?? 0)
      case 'discoverItems':
        return achievementStore.discoveredItems.length >= (obj.target ?? 0)
      case 'npcFriendship': {
        if (obj.npcId === '_any') {
          // 任意NPC达到指定好感
          return npcStore.npcStates.some(n => meetsLevel(npcStore.getFriendshipLevel(n.npcId), obj.friendshipLevel ?? 'acquaintance'))
        }
        const level = npcStore.getFriendshipLevel(obj.npcId ?? '')
        return meetsLevel(level, obj.friendshipLevel ?? 'acquaintance')
      }
      case 'npcAllFriendly':
        return npcStore.npcStates.every(n => meetsLevel(npcStore.getFriendshipLevel(n.npcId), obj.friendshipLevel ?? 'friendly'))
      case 'completeBundles':
        return achievementStore.completedBundles.length >= (obj.target ?? 0)
      case 'completeQuests':
        return completedQuestCount.value >= (obj.target ?? 0)
      case 'shipItems':
        return shopStore.shippedItems.length >= (obj.target ?? 0)
      case 'ownAnimals':
        return animalStore.animals.length >= (obj.target ?? 0)
      case 'married':
        return npcStore.getSpouse() !== null
      case 'settleDown': {
        // 在桃源乡扎下根：成家、结为知己，或与足够多的村民成为挚友——任选其一即可
        if (npcStore.getSpouse() !== null) return true
        if (npcStore.npcStates.some(n => n.zhiji)) return true
        const bestFriends = npcStore.npcStates.filter(n => npcStore.getFriendshipLevel(n.npcId) === 'bestFriend').length
        return bestFriends >= (obj.target ?? 3)
      }
      case 'hasChild':
        return npcStore.children.length > 0
      case 'household': {
        // 家里有需要照顾的生命：孩子、宠物，或成规模的牲畜——不强求生养
        if (npcStore.children.length > 0) return true
        if (animalStore.pet !== null) return true
        return animalStore.animals.length >= (obj.target ?? 6)
      }
      case 'deliverItem':
        // deliverItem 只检查背包有足够物品（提交时才扣除）
        return inventoryStore.hasItem(obj.itemId ?? '', obj.itemQuantity ?? 1)
      default:
        return false
    }
  }

  /** 初始化主线任务：如果没有当前任务，设置下一个可接取的 */
  const initMainQuest = () => {
    if (mainQuest.value) return // 已有当前任务
    if (completedMainQuests.value.length >= STORY_QUESTS.length) return // 全部完成

    // 找到下一个未完成的主线任务
    const nextQuest =
      completedMainQuests.value.length === 0
        ? getFirstStoryQuest()
        : getNextStoryQuest(completedMainQuests.value[completedMainQuests.value.length - 1]!)

    if (nextQuest) {
      mainQuest.value = {
        questId: nextQuest.id,
        accepted: false,
        objectiveProgress: nextQuest.objectives.map(() => false)
      }
    }
  }

  /** 接取主线任务 */
  const acceptMainQuest = (): { success: boolean; message: string } => {
    if (!mainQuest.value) return { success: false, message: '没有可接取的主线任务。' }
    if (mainQuest.value.accepted) return { success: false, message: '主线任务已接取。' }

    const def = getStoryQuestById(mainQuest.value.questId)
    if (!def) return { success: false, message: '主线任务数据异常。' }

    mainQuest.value.accepted = true

    // 接取时立即评估一次进度
    for (let i = 0; i < def.objectives.length; i++) {
      mainQuest.value.objectiveProgress[i] = evaluateObjective(def.objectives[i]!)
    }

    const npcDef = getNpcById(def.npcId)
    const npcName = npcDef?.name ?? def.npcId
    return {
      success: true,
      message: `接取了主线任务：${def.title}（${npcName}）`
    }
  }

  /** 每日更新主线任务进度 */
  const updateMainQuestProgress = () => {
    if (!mainQuest.value || !mainQuest.value.accepted) return

    const def = getStoryQuestById(mainQuest.value.questId)
    if (!def) return

    for (let i = 0; i < def.objectives.length; i++) {
      if (!mainQuest.value.objectiveProgress[i]) {
        mainQuest.value.objectiveProgress[i] = evaluateObjective(def.objectives[i]!)
      }
    }
  }

  /** 检查主线任务是否可提交（实时评估未完成的目标） */
  const canSubmitMainQuest = (): boolean => {
    if (!mainQuest.value || !mainQuest.value.accepted) return false

    const def = getStoryQuestById(mainQuest.value.questId)
    if (!def) return false

    // 实时刷新未完成目标的进度，使 UI 同步显示最新状态
    for (let i = 0; i < def.objectives.length; i++) {
      if (!mainQuest.value.objectiveProgress[i]) {
        mainQuest.value.objectiveProgress[i] = evaluateObjective(def.objectives[i]!)
      }
    }

    return mainQuest.value.objectiveProgress.every(p => p)
  }

  /** 提交主线任务 */
  const submitMainQuest = (): { success: boolean; message: string } => {
    if (!mainQuest.value || !mainQuest.value.accepted) {
      return { success: false, message: '没有可提交的主线任务。' }
    }

    const def = getStoryQuestById(mainQuest.value.questId)
    if (!def) return { success: false, message: '主线任务数据异常。' }

    // 最终验证所有目标
    for (let i = 0; i < def.objectives.length; i++) {
      mainQuest.value.objectiveProgress[i] = evaluateObjective(def.objectives[i]!)
    }
    if (!mainQuest.value.objectiveProgress.every(p => p)) {
      return { success: false, message: '主线任务目标尚未全部完成。' }
    }

    // deliverItem 类型扣除背包物品
    for (const obj of def.objectives) {
      if (obj.type === 'deliverItem' && obj.itemId && obj.itemQuantity) {
        if (!inventoryStore.removeItem(obj.itemId, obj.itemQuantity)) {
          return { success: false, message: `背包中物品不足，无法提交。` }
        }
      }
    }

    // 发放铜钱奖励
    playerStore.earnMoney(def.moneyReward)

    // 发放好感奖励
    if (def.friendshipReward) {
      for (const fr of def.friendshipReward) {
        npcStore.adjustFriendship(fr.npcId, fr.amount)
      }
    }

    // 发放物品奖励
    if (def.itemReward) {
      for (const item of def.itemReward) {
        inventoryStore.addItem(item.itemId, item.quantity)
      }
    }

    // 记录完成
    completedMainQuests.value.push(mainQuest.value.questId)
    mainQuest.value = null

    // 自动初始化下一个主线任务
    initMainQuest()

    const npcDef = getNpcById(def.npcId)
    const npcName = npcDef?.name ?? def.npcId
    let message = `【主线完成】${def.title}！${npcName}：获得${def.moneyReward}文。`
    if (def.itemReward && def.itemReward.length > 0) {
      message += ` 额外获得物品奖励。`
    }
    if (!mainQuest.value) {
      if (completedMainQuests.value.length >= STORY_QUESTS.length) {
        message += ` 恭喜！你已完成桃源乡全部主线任务！`
      }
    }

    return { success: true, message }
  }

  // ============================================================
  // 序列化
  // ============================================================

  const serialize = () => {
    return {
      boardQuests: boardQuests.value,
      activeQuests: activeQuests.value,
      completedQuestCount: completedQuestCount.value,
      specialOrder: specialOrder.value,
      mainQuest: mainQuest.value,
      completedMainQuests: completedMainQuests.value
    }
  }

  const deserialize = (data: ReturnType<typeof serialize>) => {
    boardQuests.value = data.boardQuests ?? []
    activeQuests.value = data.activeQuests ?? []
    completedQuestCount.value = data.completedQuestCount ?? 0
    specialOrder.value = ((data as Record<string, unknown>).specialOrder as QuestInstance | null) ?? null
    mainQuest.value = ((data as Record<string, unknown>).mainQuest as MainQuestState | null) ?? null
    completedMainQuests.value = ((data as Record<string, unknown>).completedMainQuests as string[] | undefined) ?? []
    // 加载后初始化主线任务（兼容旧存档）
    initMainQuest()
  }

  return {
    boardQuests,
    activeQuests,
    completedQuestCount,
    specialOrder,
    mainQuest,
    completedMainQuests,
    MAX_ACTIVE_QUESTS,
    generateDailyQuests,
    generateSpecialOrder,
    acceptQuest,
    acceptSpecialOrder,
    submitQuest,
    onItemObtained,
    dailyUpdate,
    hasActiveQuestFor,
    initMainQuest,
    acceptMainQuest,
    updateMainQuestProgress,
    canSubmitMainQuest,
    submitMainQuest,
    serialize,
    deserialize
  }
})
