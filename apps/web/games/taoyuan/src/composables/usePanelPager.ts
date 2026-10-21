import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { useGameStore } from '@/stores/useGameStore'
import { isShopOpen, TAB_TO_LOCATION_GROUP } from '@/data/timeConstants'
import type { LocationGroup } from '@/types'
import { TABS, navigateToPanel } from './useNavigation'

/** TABS 中的单个面板项 */
export type PanelTab = (typeof TABS)[number]

export interface PanelPager {
  /** 同组上一个面板；可去面板不足 2 个时为 null */
  prevPanel: ComputedRef<PanelTab | null>
  /** 同组下一个面板；可去面板不足 2 个时为 null */
  nextPanel: ComputedRef<PanelTab | null>
  goPrevPanel: () => void
  goNextPanel: () => void
}

/** 面板所属地点组；无地点的面板（值为 null 或未登记）统一归为「随身」组，用 null 表示 */
const getPanelGroup = (key: string): LocationGroup | null => TAB_TO_LOCATION_GROUP[key] ?? null

/**
 * 面板翻页：在当前面板所属地点组内按 TABS 顺序找上一个 / 下一个面板，首尾循环。
 * 只在同组内翻，因此不产生移动耗时；当前进不去的面板（未营业）跳过，当前面板始终作为起点保留。
 */
export const usePanelPager = (current: MaybeRefOrGetter<string>): PanelPager => {
  const gameStore = useGameStore()

  const neighbors = computed((): { prev: PanelTab | null; next: PanelTab | null } => {
    const currentKey = toValue(current)
    const group = getPanelGroup(currentKey)
    // 用整点小时：营业状态仅在整点切换，不必随 200ms tick 频繁重算
    const hour = Math.floor(gameStore.hour)
    const tabs = TABS.filter(
      t => getPanelGroup(t.key) === group && (t.key === currentKey || isShopOpen(t.key, gameStore.day, hour).open)
    )
    const index = tabs.findIndex(t => t.key === currentKey)
    if (index < 0 || tabs.length < 2) return { prev: null, next: null }
    return {
      prev: tabs[(index - 1 + tabs.length) % tabs.length] ?? null,
      next: tabs[(index + 1) % tabs.length] ?? null
    }
  })

  // 时钟每次走动都会重算 neighbors；这里取出的是 TABS 里的同一对象，引用不变时不会触发重新渲染
  const prevPanel = computed(() => neighbors.value.prev)
  const nextPanel = computed(() => neighbors.value.next)

  const goPrevPanel = () => {
    if (prevPanel.value) navigateToPanel(prevPanel.value.key)
  }

  const goNextPanel = () => {
    if (nextPanel.value) navigateToPanel(nextPanel.value.key)
  }

  return { prevPanel, nextPanel, goPrevPanel, goNextPanel }
}
