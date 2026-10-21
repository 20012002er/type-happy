import type { Season } from '@/types'
import { isNpcAvailable } from './timeConstants'

/**
 * 村民日常出没的地点。
 * 与面板 key 对应，玩家在该面板活动时就能「顺路」碰到村民，
 * 不必专门跑去桃源村挨个点名。
 */
export type NpcSpot = 'village' | 'shop' | 'cooking' | 'upgrade' | 'forage' | 'fishing' | 'mining' | 'farm' | 'hanhai'

export const SPOT_NAMES: Record<NpcSpot, string> = {
  village: '桃源村',
  shop: '桃源商圈',
  cooking: '灶台',
  upgrade: '工坊',
  forage: '竹林',
  fishing: '清溪',
  mining: '云隐矿洞',
  farm: '农场',
  hanhai: '瀚海'
}

/** 一段作息：[from, to) 小时区间内待在某地 */
export interface NpcSpotSlot {
  from: number
  to: number
  spot: NpcSpot
}

/**
 * 每位村民的一日行程。
 * 未列出的时段表示对方不在户外活动（回家了），按 NPC_SCHEDULES 的出没时间共同判定。
 */
export const NPC_SPOTS: Record<string, NpcSpotSlot[]> = {
  // --- 商圈一线 ---
  chen_bo: [
    { from: 8, to: 18, spot: 'shop' },
    { from: 18, to: 20, spot: 'village' }
  ],
  hong_dou: [{ from: 10, to: 23, spot: 'shop' }],
  he_zhanggui: [{ from: 9, to: 22, spot: 'shop' }],
  lao_lu: [{ from: 10, to: 22, spot: 'shop' }],
  su_su: [
    { from: 8, to: 18, spot: 'shop' },
    { from: 18, to: 20, spot: 'village' }
  ],
  hui_niang: [
    { from: 8, to: 17, spot: 'shop' },
    { from: 17, to: 19, spot: 'village' }
  ],
  wu_shen: [{ from: 8, to: 20, spot: 'shop' }],
  ma_liu: [
    { from: 9, to: 13, spot: 'shop' },
    { from: 13, to: 18, spot: 'village' }
  ],
  a_hua: [
    { from: 9, to: 14, spot: 'shop' },
    { from: 14, to: 18, spot: 'village' }
  ],

  // --- 灶台与豆腐坊 ---
  wang_dashen: [
    { from: 6, to: 17, spot: 'cooking' },
    { from: 17, to: 19, spot: 'village' }
  ],
  pang_shen: [
    { from: 5, to: 11, spot: 'cooking' },
    { from: 11, to: 16, spot: 'shop' }
  ],

  // --- 工坊 ---
  zhao_mujiang: [
    { from: 7, to: 17, spot: 'upgrade' },
    { from: 17, to: 18, spot: 'village' }
  ],
  sun_tiejiang: [
    { from: 7, to: 17, spot: 'upgrade' },
    { from: 17, to: 18, spot: 'village' }
  ],
  a_tie: [
    { from: 7, to: 17, spot: 'upgrade' },
    { from: 17, to: 18, spot: 'village' }
  ],
  xiao_man: [
    { from: 9, to: 15, spot: 'upgrade' },
    { from: 15, to: 17, spot: 'village' }
  ],

  // --- 山野 ---
  yun_fei: [{ from: 6, to: 16, spot: 'forage' }],
  lin_lao: [
    { from: 8, to: 12, spot: 'village' },
    { from: 12, to: 17, spot: 'forage' },
    { from: 17, to: 19, spot: 'village' }
  ],
  qian_niang: [
    { from: 8, to: 12, spot: 'village' },
    { from: 12, to: 16, spot: 'forage' },
    { from: 16, to: 18, spot: 'village' }
  ],
  chun_lan: [
    { from: 7, to: 12, spot: 'forage' },
    { from: 12, to: 18, spot: 'shop' },
    { from: 18, to: 20, spot: 'village' }
  ],
  dan_qing: [
    { from: 8, to: 13, spot: 'forage' },
    { from: 13, to: 21, spot: 'village' }
  ],
  xue_qin: [
    { from: 10, to: 14, spot: 'forage' },
    { from: 14, to: 19, spot: 'village' }
  ],
  shi_tou: [
    { from: 8, to: 12, spot: 'village' },
    { from: 12, to: 17, spot: 'forage' },
    { from: 17, to: 20, spot: 'village' }
  ],

  // --- 溪边 ---
  qiu_yue: [
    { from: 6, to: 16, spot: 'fishing' },
    { from: 16, to: 22, spot: 'village' }
  ],
  li_yu: [
    { from: 6, to: 17, spot: 'fishing' },
    { from: 17, to: 20, spot: 'village' }
  ],
  mo_bai: [
    { from: 12, to: 18, spot: 'fishing' },
    { from: 18, to: 23, spot: 'village' }
  ],

  // --- 矿洞 ---
  a_shi: [
    { from: 7, to: 16, spot: 'mining' },
    { from: 16, to: 18, spot: 'village' }
  ],

  // --- 田间地头 ---
  da_niu: [
    { from: 6, to: 16, spot: 'farm' },
    { from: 16, to: 19, spot: 'village' }
  ],
  a_fu: [
    { from: 7, to: 15, spot: 'farm' },
    { from: 15, to: 18, spot: 'village' }
  ],
  qin_dashu: [
    { from: 6, to: 12, spot: 'farm' },
    { from: 12, to: 15, spot: 'forage' },
    { from: 15, to: 18, spot: 'village' }
  ],

  // --- 村里常驻 ---
  liu_niang: [
    { from: 9, to: 13, spot: 'village' },
    { from: 13, to: 17, spot: 'fishing' },
    { from: 17, to: 21, spot: 'village' }
  ],
  liu_cunzhang: [{ from: 8, to: 18, spot: 'village' }],
  zhou_xiucai: [{ from: 8, to: 17, spot: 'village' }],
  zhang_popo: [{ from: 8, to: 17, spot: 'village' }],
  lao_song: [{ from: 18, to: 26, spot: 'village' }]
}

/** 查询某位村民此刻在哪（不在户外则返回 null） */
export const getNpcSpot = (npcId: string, hour: number): NpcSpot | null => {
  const slots = NPC_SPOTS[npcId]
  if (!slots) return null
  for (const slot of slots) {
    if (hour >= slot.from && hour < slot.to) return slot.spot
  }
  return null
}

/** 查询此刻出现在某地点的村民 ID 列表（已排除今日不在村里的人） */
export const getNpcsAtSpot = (spot: NpcSpot, day: number, hour: number, season?: Season): string[] => {
  const result: string[] = []
  for (const npcId of Object.keys(NPC_SPOTS)) {
    if (getNpcSpot(npcId, hour) !== spot) continue
    if (!isNpcAvailable(npcId, day, hour, season)) continue
    result.push(npcId)
  }
  return result
}

/** 某位村民此刻所在地点的中文名（不在户外则返回 null） */
export const getNpcSpotName = (npcId: string, hour: number): string | null => {
  const spot = getNpcSpot(npcId, hour)
  return spot ? SPOT_NAMES[spot] : null
}
