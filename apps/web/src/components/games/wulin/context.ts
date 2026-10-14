import type { Ref } from 'vue'
import type { WulinSim } from '../../../games/wulin/sim'
import type { WulinSave } from '../../../games/wulin/types'

export interface WulinUi {
  sim: WulinSim
  save: WulinSave
  toast: (msg: string, ok?: boolean) => void
  /** 每秒刷新的时间戳(用于 CD 倒计时) */
  now: Ref<number>
  /** 请求主壳刷新地图场景 */
  refreshMap: () => void
}
