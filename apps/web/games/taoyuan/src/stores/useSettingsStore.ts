import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAudio } from '@/composables/useAudio'
import { getThemeByKey, hexToRgb, type ThemeKey } from '@/data/themes'
import { applyQmsgConfig } from '@/composables/useGameLog'
import type { ItemCategory } from '@/types'

export type QmsgPosition = 'topleft' | 'top' | 'topright' | 'left' | 'center' | 'right' | 'bottomleft' | 'bottom' | 'bottomright'
export type QmsgLimitWidthWrap = 'no-wrap' | 'wrap' | 'ellipsis'

const DEFAULT_FONT_SIZE = 16
const DEFAULT_THEME: ThemeKey = 'dark'
const DEFAULT_QMSG_POSITION: QmsgPosition = 'top'
/** 矿洞行动描述默认显示行数 */
const DEFAULT_MINE_LOG_LINES = 4
/** 矿洞行动描述可选行数（0 表示不显示） */
export const MINE_LOG_LINE_OPTIONS = [0, 2, 4, 8] as const

export const useSettingsStore = defineStore('settings', () => {
  const fontSize = ref(DEFAULT_FONT_SIZE)
  const theme = ref<ThemeKey>(DEFAULT_THEME)
  const qmsgPosition = ref<QmsgPosition>(DEFAULT_QMSG_POSITION)
  const qmsgTimeout = ref(2500)
  const qmsgMaxNums = ref(5)
  const qmsgIsLimitWidth = ref(true)
  const qmsgLimitWidthNum = ref(200)
  const qmsgLimitWidthWrap = ref<QmsgLimitWidthWrap>('wrap')
  const qmsgAnimation = ref(true)
  const qmsgAutoClose = ref(true)
  const qmsgShowClose = ref(false)
  const qmsgShowIcon = ref(false)
  const qmsgShowReverse = ref(false)

  /** 背包物品筛选：选中的分类（空数组 = 显示全部） */
  const inventoryFilter = ref<ItemCategory[]>([])

  /** 矿洞探索日志显示行数（0 = 完全隐藏行动描述） */
  const mineLogLines = ref(DEFAULT_MINE_LOG_LINES)

  /**
   * 桃源田庄换季是否自动施肥。
   * 默认关闭：自动撒下的低级肥会占住地块，反而挡住玩家自己想施的好肥。
   */
  const autoFertilizeOnSeasonChange = ref(false)

  /**
   * 一键钓鱼：抛竿后跳过收线小游戏，按装备与鱼的难度直接掷出结果。
   * 默认关闭，给不想被小游戏折磨的玩家一个出口。
   */
  const autoFishing = ref(false)

  const applyFontSize = () => {
    document.documentElement.style.fontSize = fontSize.value + 'px'
  }

  const applyTheme = () => {
    const t = getThemeByKey(theme.value)
    document.documentElement.style.setProperty('--color-bg', hexToRgb(t.bg))
    document.documentElement.style.setProperty('--color-panel', hexToRgb(t.panel))
    document.documentElement.style.setProperty('--color-text', hexToRgb(t.text))
  }

  const changeFontSize = (delta: number) => {
    fontSize.value = Math.min(24, Math.max(12, fontSize.value + delta))
    applyFontSize()
  }

  const changeTheme = (key: ThemeKey) => {
    theme.value = key
    applyTheme()
  }

  const changeQmsgPosition = (pos: QmsgPosition) => {
    qmsgPosition.value = pos
    syncQmsgConfig()
  }

  /** 将当前所有通知设置同步到 Qmsg */
  const syncQmsgConfig = () => {
    applyQmsgConfig({
      position: qmsgPosition.value,
      timeout: qmsgTimeout.value,
      maxNums: qmsgMaxNums.value,
      isLimitWidth: qmsgIsLimitWidth.value,
      limitWidthNum: qmsgLimitWidthNum.value,
      limitWidthWrap: qmsgLimitWidthWrap.value,
      animation: qmsgAnimation.value,
      autoClose: qmsgAutoClose.value,
      showClose: qmsgShowClose.value,
      showIcon: qmsgShowIcon.value,
      showReverse: qmsgShowReverse.value
    })
  }

  const serialize = () => {
    const { sfxEnabled, bgmEnabled } = useAudio()
    return {
      fontSize: fontSize.value,
      sfxEnabled: sfxEnabled.value,
      bgmEnabled: bgmEnabled.value,
      theme: theme.value,
      qmsgPosition: qmsgPosition.value,
      qmsgTimeout: qmsgTimeout.value,
      qmsgMaxNums: qmsgMaxNums.value,
      qmsgIsLimitWidth: qmsgIsLimitWidth.value,
      qmsgLimitWidthNum: qmsgLimitWidthNum.value,
      qmsgLimitWidthWrap: qmsgLimitWidthWrap.value,
      qmsgAnimation: qmsgAnimation.value,
      qmsgAutoClose: qmsgAutoClose.value,
      qmsgShowClose: qmsgShowClose.value,
      qmsgShowIcon: qmsgShowIcon.value,
      qmsgShowReverse: qmsgShowReverse.value,
      inventoryFilter: inventoryFilter.value,
      mineLogLines: mineLogLines.value,
      autoFertilizeOnSeasonChange: autoFertilizeOnSeasonChange.value,
      autoFishing: autoFishing.value
    }
  }

  const deserialize = (data: any) => {
    fontSize.value = data?.fontSize ?? DEFAULT_FONT_SIZE
    applyFontSize()
    theme.value = data?.theme ?? DEFAULT_THEME
    applyTheme()
    qmsgPosition.value = data?.qmsgPosition ?? DEFAULT_QMSG_POSITION
    qmsgTimeout.value = data?.qmsgTimeout ?? 2500
    qmsgMaxNums.value = data?.qmsgMaxNums ?? 5
    qmsgIsLimitWidth.value = data?.qmsgIsLimitWidth ?? true
    qmsgLimitWidthNum.value = data?.qmsgLimitWidthNum ?? 200
    qmsgLimitWidthWrap.value = data?.qmsgLimitWidthWrap ?? 'wrap'
    qmsgAnimation.value = data?.qmsgAnimation ?? true
    qmsgAutoClose.value = data?.qmsgAutoClose ?? true
    qmsgShowClose.value = data?.qmsgShowClose ?? false
    qmsgShowIcon.value = data?.qmsgShowIcon ?? false
    qmsgShowReverse.value = data?.qmsgShowReverse ?? false
    inventoryFilter.value = data?.inventoryFilter ?? []
    mineLogLines.value = data?.mineLogLines ?? DEFAULT_MINE_LOG_LINES
    autoFertilizeOnSeasonChange.value = data?.autoFertilizeOnSeasonChange ?? false
    autoFishing.value = data?.autoFishing ?? false
    syncQmsgConfig()
    const { sfxEnabled, bgmEnabled } = useAudio()
    sfxEnabled.value = data?.sfxEnabled ?? true
    bgmEnabled.value = data?.bgmEnabled ?? true
  }

  // 初始化时立即同步到 Qmsg，确保新游戏/首次加载也能生效
  syncQmsgConfig()
  applyFontSize()
  applyTheme()

  return {
    fontSize,
    theme,
    qmsgPosition,
    qmsgTimeout,
    qmsgMaxNums,
    qmsgIsLimitWidth,
    qmsgLimitWidthNum,
    qmsgLimitWidthWrap,
    qmsgAnimation,
    qmsgAutoClose,
    qmsgShowClose,
    qmsgShowIcon,
    qmsgShowReverse,
    inventoryFilter,
    mineLogLines,
    autoFertilizeOnSeasonChange,
    autoFishing,
    changeFontSize,
    changeTheme,
    changeQmsgPosition,
    syncQmsgConfig,
    applyFontSize,
    applyTheme,
    serialize,
    deserialize
  }
})
