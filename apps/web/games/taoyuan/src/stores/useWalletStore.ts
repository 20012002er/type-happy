import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { WALLET_ITEMS } from '@/data/wallet'
import { FISH } from '@/data/fish'
import { useAchievementStore } from './useAchievementStore'
import { useSkillStore } from './useSkillStore'
import { useMiningStore } from './useMiningStore'

export const useWalletStore = defineStore('wallet', () => {
  /** 已解锁的钱袋物品ID */
  const unlockedItems = ref<string[]>([])

  /** 已解锁的钱袋物品定义 */
  const unlockedDefs = computed(() => WALLET_ITEMS.filter(w => unlockedItems.value.includes(w.id)))

  /** 检查是否已拥有某物品 */
  const has = (id: string): boolean => {
    return unlockedItems.value.includes(id)
  }

  /** 手动解锁 */
  const unlock = (id: string): boolean => {
    if (has(id)) return false
    if (!WALLET_ITEMS.find(w => w.id === id)) return false
    unlockedItems.value.push(id)
    return true
  }

  /** 检查并自动解锁满足条件的物品，返回新解锁的物品名 */
  const checkAndUnlock = (): string[] => {
    const achievementStore = useAchievementStore()
    const skillStore = useSkillStore()
    const miningStore = useMiningStore()

    const newlyUnlocked: string[] = []

    // 商人印鉴：累计赚钱10000文
    if (!has('merchant_seal') && achievementStore.stats.totalMoneyEarned >= 10000) {
      unlock('merchant_seal')
      newlyUnlocked.push('商人印章')
    }

    // 草药图鉴：采集等级8
    if (!has('herb_guide') && skillStore.getSkill('foraging').level >= 8) {
      unlock('herb_guide')
      newlyUnlocked.push('神农本草')
    }

    // 矿工护符：矿洞50层
    if (!has('miners_charm') && miningStore.safePointFloor >= 50) {
      unlock('miners_charm')
      newlyUnlocked.push('矿工护符')
    }

    // 垂钓者令牌：钓到30种鱼
    if (!has('anglers_token')) {
      const fishIdSet = new Set(FISH.map(f => f.id))
      const fishCount = achievementStore.discoveredItems.filter(id => fishIdSet.has(id)).length
      if (fishCount >= 30) {
        unlock('anglers_token')
        newlyUnlocked.push('钓翁令牌')
      }
    }

    // 厨师帽：烹饪10道不同食谱
    if (!has('chefs_hat') && achievementStore.stats.totalRecipesCooked >= 10) {
      unlock('chefs_hat')
      newlyUnlocked.push('厨师帽')
    }

    // 大地图腾：收获100次作物
    if (!has('earth_totem') && achievementStore.stats.totalCropsHarvested >= 100) {
      unlock('earth_totem')
      newlyUnlocked.push('土地图腾')
    }

    return newlyUnlocked
  }

  // === 被动效果查询 ===

  /** 商店折扣 (0.1 = 10%) */
  const getShopDiscount = (): number => {
    return has('merchant_seal') ? 0.1 : 0
  }

  /** 采集品质加成档数 */
  const getForageQualityBoost = (): number => {
    return has('herb_guide') ? 1 : 0
  }

  /** 挖矿体力减免 (0.15 = 15%) */
  const getMiningStaminaReduction = (): number => {
    return has('miners_charm') ? 0.15 : 0
  }

  /** 钓鱼calm概率加成 */
  const getFishingCalmBonus = (): number => {
    return has('anglers_token') ? 0.1 : 0
  }

  /** 烹饪恢复量加成 (0.25 = 25%) */
  const getCookingRestoreBonus = (): number => {
    return has('chefs_hat') ? 0.25 : 0
  }

  /** 作物生长速度加成 (0.1 = 10%) */
  const getCropGrowthBonus = (): number => {
    return has('earth_totem') ? 0.1 : 0
  }

  /** 通商积分加成 (0.2 = 20%) */
  const getTradeBonus = (): number => {
    return has('trade_prosperity_seal') ? 0.2 : 0
  }

  const serialize = () => {
    return { unlockedItems: unlockedItems.value }
  }

  const deserialize = (data: ReturnType<typeof serialize>) => {
    unlockedItems.value = data.unlockedItems ?? []
  }

  return {
    unlockedItems,
    unlockedDefs,
    has,
    unlock,
    checkAndUnlock,
    getShopDiscount,
    getForageQualityBoost,
    getMiningStaminaReduction,
    getFishingCalmBonus,
    getCookingRestoreBonus,
    getCropGrowthBonus,
    getTradeBonus,
    serialize,
    deserialize
  }
})
