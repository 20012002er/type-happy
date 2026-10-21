import { computed } from 'vue'
import { useGameStore } from '@/stores/useGameStore'
import { useFarmStore } from '@/stores/useFarmStore'
import { useAnimalStore } from '@/stores/useAnimalStore'
import { useProcessingStore } from '@/stores/useProcessingStore'
import { useNpcStore } from '@/stores/useNpcStore'
import { useQuestStore } from '@/stores/useQuestStore'
import { useInventoryStore } from '@/stores/useInventoryStore'
import { useFishPondStore } from '@/stores/useFishPondStore'
import { useBreedingStore } from '@/stores/useBreedingStore'
import { NPCS, getNpcById } from '@/data/npcs'
import { getProcessingRecipeById, PROCESSING_MACHINES } from '@/data/processing'
import { getStoryQuestById } from '@/data/storyQuests'
import type { PanelKey } from './useNavigation'

/** 待办分类 */
export type TodoCategory = 'farm' | 'animal' | 'processing' | 'social' | 'quest' | 'craft'

/** 紧要程度：urgent 会高亮，info 只是提示 */
export type TodoUrgency = 'urgent' | 'normal' | 'info'

export interface TodoItem {
  id: string
  category: TodoCategory
  /** 一句话说明要做什么 */
  text: string
  /** 附加说明（数量、剩余天数等） */
  detail?: string
  urgency: TodoUrgency
  /** 点击后跳转的面板 */
  panel?: PanelKey
}

export const TODO_CATEGORY_NAMES: Record<TodoCategory, string> = {
  farm: '农事',
  animal: '牧场',
  processing: '加工',
  social: '人情',
  quest: '任务',
  craft: '工坊'
}

/**
 * 待办事项。
 *
 * 桃源乡的日常摊子铺得很开——地要浇、牲口要喂、加工品要收、谁过生日、委托快到期。
 * 这些信息原先散落在七八个面板里，玩家只能靠记。这里把它们汇总成一份「今天该做什么」。
 */
export const useTodoList = () => {
  const gameStore = useGameStore()

  const todos = computed((): TodoItem[] => {
    const list: TodoItem[] = []
    const farmStore = useFarmStore()
    const animalStore = useAnimalStore()
    const processingStore = useProcessingStore()
    const npcStore = useNpcStore()
    const questStore = useQuestStore()
    const inventoryStore = useInventoryStore()
    const fishPondStore = useFishPondStore()
    const breedingStore = useBreedingStore()

    // --- 农事 ---
    const unwatered = farmStore.plots.filter(p => (p.state === 'planted' || p.state === 'growing') && !p.watered).length
    if (unwatered > 0 && !gameStore.isRainy) {
      list.push({
        id: 'farm-water',
        category: 'farm',
        text: '有作物还没浇水',
        detail: `${unwatered} 块`,
        urgency: 'urgent',
        panel: 'farm'
      })
    }

    const harvestable = farmStore.plots.filter(p => p.state === 'harvestable').length
    if (harvestable > 0) {
      list.push({
        id: 'farm-harvest',
        category: 'farm',
        text: '有作物可以收获',
        detail: `${harvestable} 块`,
        urgency: 'normal',
        panel: 'farm'
      })
    }

    const troubled = farmStore.plots.filter(p => p.infested || p.weedy).length
    if (troubled > 0) {
      list.push({
        id: 'farm-pest',
        category: 'farm',
        text: '田里有杂草或虫害',
        detail: `${troubled} 处`,
        urgency: 'normal',
        panel: 'farm'
      })
    }

    // 换季前提醒：第28天睡前会换季，跨季作物会枯死
    if (gameStore.day === 28) {
      const planted = farmStore.plots.filter(p => p.state === 'planted' || p.state === 'growing').length
      if (planted > 0) {
        list.push({
          id: 'farm-season',
          category: 'farm',
          text: '明天换季，不合季节的作物会枯萎',
          detail: `${planted} 株生长中`,
          urgency: 'urgent',
          panel: 'farm'
        })
      }
    }

    // --- 牧场 ---
    const unfed = animalStore.animals.filter(a => !a.wasFed).length
    if (unfed > 0) {
      list.push({
        id: 'animal-feed',
        category: 'animal',
        text: '牲畜还没喂',
        detail: `${unfed} 只`,
        urgency: 'urgent',
        panel: 'animal'
      })
    }

    const unpetted = animalStore.animals.filter(a => !a.wasPetted).length
    if (unpetted > 0) {
      list.push({
        id: 'animal-pet',
        category: 'animal',
        text: '还有牲畜没有抚摸（影响心情与产出）',
        detail: `${unpetted} 只`,
        urgency: 'normal',
        panel: 'animal'
      })
    }

    if (fishPondStore.pond.built && !fishPondStore.pond.fedToday) {
      list.push({
        id: 'pond-feed',
        category: 'animal',
        text: '鱼塘还没投饵',
        urgency: 'normal',
        panel: 'fishpond'
      })
    }

    // --- 加工 ---
    const readyCount = processingStore.machines.filter(m => m.ready).length
    if (readyCount > 0) {
      list.push({
        id: 'processing-collect',
        category: 'processing',
        text: '加工坊有成品可以收取',
        detail: `${readyCount} 份`,
        urgency: 'normal',
        panel: 'workshop'
      })
    }

    const idleCount = processingStore.machines.filter(m => !m.recipeId).length
    if (idleCount > 0) {
      list.push({
        id: 'processing-idle',
        category: 'processing',
        text: '加工站有空闲槽位没在开工',
        detail: `${idleCount} 个`,
        urgency: 'info',
        panel: 'workshop'
      })
    }

    // 明天就能收的加工品，提前打个招呼
    const tomorrowReady = processingStore.machines.filter(m => m.recipeId && !m.ready && m.totalDays - m.daysProcessed === 1)
    if (tomorrowReady.length > 0) {
      const names = [...new Set(tomorrowReady.map(m => getProcessingRecipeById(m.recipeId!)?.name ?? ''))].filter(Boolean)
      list.push({
        id: 'processing-tomorrow',
        category: 'processing',
        text: '明天可收：' + names.slice(0, 3).join('、'),
        detail: `${tomorrowReady.length} 份`,
        urgency: 'info',
        panel: 'workshop'
      })
    }

    // 育种台
    const breedingReady = breedingStore.stations.filter(s => s.ready).length
    if (breedingReady > 0) {
      list.push({
        id: 'breeding-ready',
        category: 'processing',
        text: '育种台有成果可以取出',
        detail: `${breedingReady} 个`,
        urgency: 'normal',
        panel: 'breeding'
      })
    }

    // --- 工坊 ---
    if (inventoryStore.pendingUpgrade) {
      const remain = inventoryStore.pendingUpgrade.daysRemaining
      list.push({
        id: 'craft-tool',
        category: 'craft',
        text: remain <= 0 ? '升级好的工具可以取回了' : '工具正在升级中',
        detail: remain <= 0 ? '已完成' : `还需 ${remain} 天`,
        urgency: remain <= 0 ? 'normal' : 'info',
        panel: 'upgrade'
      })
    }

    // --- 人情 ---
    // 今天过生日的村民
    for (const npc of NPCS) {
      if (!npcStore.isBirthday(npc.id)) continue
      const state = npcStore.getNpcState(npc.id)
      list.push({
        id: `birthday-${npc.id}`,
        category: 'social',
        text: `今天是${npcStore.getNpcDisplayName(npc.id)}的生日`,
        detail: state?.birthdayGiftGiven ? '生日礼已送' : '可额外送一份生日礼 ×4',
        urgency: state?.birthdayGiftGiven ? 'info' : 'urgent',
        panel: 'village'
      })
    }

    // 未来三天内的生日，提前备礼
    const upcoming = getUpcomingBirthdays(gameStore.season, gameStore.day, 3)
    for (const b of upcoming) {
      list.push({
        id: `birthday-soon-${b.npcId}`,
        category: 'social',
        text: `${npcStore.getNpcDisplayName(b.npcId)}的生日快到了`,
        detail: `还有 ${b.daysLeft} 天`,
        urgency: 'info',
        panel: 'village'
      })
    }

    // 今天还没说过话的村民（只提示在场的，避免刷屏）
    const notTalked = npcStore.npcStates.filter(s => !s.talkedToday).length
    if (notTalked > 0) {
      list.push({
        id: 'social-talk',
        category: 'social',
        text: '还有村民今天没打过招呼',
        detail: `${notTalked} 人`,
        urgency: 'info',
        panel: 'village'
      })
    }

    // 配偶与子女
    const spouse = npcStore.getSpouse()
    if (spouse && !spouse.talkedToday) {
      const name = getNpcById(spouse.npcId) ? npcStore.getNpcDisplayName(spouse.npcId) : '伴侣'
      list.push({
        id: 'social-spouse',
        category: 'social',
        text: `还没和${name}说上话`,
        urgency: 'normal',
        panel: 'cottage'
      })
    }
    const childrenToVisit = npcStore.children.filter(c => !c.interactedToday).length
    if (childrenToVisit > 0) {
      list.push({
        id: 'social-child',
        category: 'social',
        text: '孩子还等着你陪一会儿',
        detail: `${childrenToVisit} 个`,
        urgency: 'normal',
        panel: 'cottage'
      })
    }

    // --- 任务 ---
    for (const quest of questStore.activeQuests) {
      const done = Math.max(quest.collectedQuantity, inventoryStore.getItemCount(quest.targetItemId)) >= quest.targetQuantity
      list.push({
        id: `quest-${quest.id}`,
        category: 'quest',
        text: done ? `可以交付：${npcStore.getNpcDisplayName(quest.npcId)}的委托` : `委托进行中：${quest.targetItemName}`,
        detail: done
          ? `剩 ${quest.daysRemaining} 天到期`
          : `${quest.collectedQuantity}/${quest.targetQuantity} · 剩 ${quest.daysRemaining} 天`,
        urgency: done ? 'normal' : quest.daysRemaining <= 1 ? 'urgent' : 'info',
        panel: 'quest'
      })
    }

    if (questStore.mainQuest?.accepted && questStore.canSubmitMainQuest()) {
      const def = getStoryQuestById(questStore.mainQuest.questId)
      list.push({
        id: 'quest-main',
        category: 'quest',
        text: `主线可以交付：${def?.title ?? ''}`,
        urgency: 'normal',
        panel: 'quest'
      })
    } else if (questStore.mainQuest && !questStore.mainQuest.accepted) {
      const def = getStoryQuestById(questStore.mainQuest.questId)
      list.push({
        id: 'quest-main-accept',
        category: 'quest',
        text: `有新的主线可以接取：${def?.title ?? ''}`,
        urgency: 'info',
        panel: 'quest'
      })
    }

    return list
  })

  /** 需要立刻处理的条目数，用于导航角标 */
  const urgentCount = computed(() => todos.value.filter(t => t.urgency === 'urgent').length)

  /** 全部待办条目数（不含纯提示） */
  const actionableCount = computed(() => todos.value.filter(t => t.urgency !== 'info').length)

  /** 按分类分组 */
  const groupedTodos = computed(() => {
    const groups = new Map<TodoCategory, TodoItem[]>()
    for (const todo of todos.value) {
      const list = groups.get(todo.category) ?? []
      list.push(todo)
      groups.set(todo.category, list)
    }
    return [...groups.entries()].map(([category, items]) => ({
      category,
      name: TODO_CATEGORY_NAMES[category],
      items
    }))
  })

  return { todos, groupedTodos, urgentCount, actionableCount }
}

/** 找出未来 N 天内过生日的村民 */
const getUpcomingBirthdays = (season: string, day: number, withinDays: number): { npcId: string; daysLeft: number }[] => {
  const result: { npcId: string; daysLeft: number }[] = []
  for (const npc of NPCS) {
    if (!npc.birthday || npc.birthday.season !== season) continue
    const daysLeft = npc.birthday.day - day
    if (daysLeft > 0 && daysLeft <= withinDays) {
      result.push({ npcId: npc.id, daysLeft })
    }
  }
  return result.sort((a, b) => a.daysLeft - b.daysLeft)
}

/** 机器类型名（供界面展示用） */
export const getMachineName = (type: string): string => {
  return PROCESSING_MACHINES.find(m => m.id === type)?.name ?? type
}
