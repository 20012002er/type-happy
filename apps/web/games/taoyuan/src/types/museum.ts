/** 博物馆物品分类 */
export type MuseumCategory = 'ore' | 'gem' | 'bar' | 'fossil' | 'artifact' | 'spirit'

/** 博物馆可捐赠物品定义 */
export interface MuseumItemDef {
  id: string
  name: string
  category: MuseumCategory
  /** 来源提示（未获得时显示） */
  sourceHint: string
}

/** 博物馆里程碑奖励 */
export interface MuseumMilestone {
  count: number
  name: string
  reward: {
    money?: number
    items?: { itemId: string; quantity: number }[]
  }
}
