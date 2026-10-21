import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { SeedGenetics, BreedingSlot, BreedingSeed, CompendiumEntry } from '@/types/breeding'
import {
  BASE_BREEDING_BOX,
  SEED_BOX_UPGRADES,
  SEED_BOX_UPGRADE_INCREMENT,
  BREEDING_DAYS,
  BASE_MUTATION_MAGNITUDE,
  GENERATIONAL_STABILITY_GAIN,
  MAX_STABILITY,
  MUTATION_JUMP_MIN,
  MUTATION_JUMP_MAX,
  MUTATION_RATE_DRIFT,
  MUTATION_POSITIVE_CHANCE,
  BREEDING_STATION_COST,
  MAX_BREEDING_STATIONS,
  generateGeneticsId,
  clampStat,
  HYBRID_REQUIREMENT_TOLERANCE,
  clampMutationRate,
  getDefaultGenetics,
  getStarRating,
  makeSeedLabel,
  findPossibleHybrid,
  findPossibleHybridById,
  getSeedMakerGeneticChance,
  getHybridTier
} from '@/data/breeding'
import { getCropById } from '@/data/crops'
import { addLog } from '@/composables/useGameLog'
import { useAchievementStore } from './useAchievementStore'
import { useGameStore } from './useGameStore'

export const useBreedingStore = defineStore('breeding', () => {
  // === 状态 ===

  /** 种子箱 */
  const breedingBox = ref<BreedingSeed[]>([])

  /** 育种台 */
  const stations = ref<BreedingSlot[]>([])

  /** 已建造的育种台数量 */
  const stationCount = ref(0)

  /** 图鉴 */
  const compendium = ref<CompendiumEntry[]>([])

  /** 是否已解锁育种系统（拥有种子制造机即解锁） */
  const unlocked = ref(false)

  /** 种子箱等级：0/1/2，对应 30/45/60 */
  const seedBoxLevel = ref(0)

  // === 计算属性 ===

  /** 种子箱最大容量（基于等级） */
  const maxSeedBox = computed(() => BASE_BREEDING_BOX + seedBoxLevel.value * SEED_BOX_UPGRADE_INCREMENT)

  const boxCount = computed(() => breedingBox.value.length)
  const boxFull = computed(() => breedingBox.value.length >= maxSeedBox.value)

  // === 种子箱操作 ===

  const addToBox = (genetics: SeedGenetics): boolean => {
    if (breedingBox.value.length >= maxSeedBox.value) return false
    breedingBox.value.push({
      genetics,
      label: makeSeedLabel(genetics)
    })
    return true
  }

  const removeFromBox = (geneticsId: string): BreedingSeed | null => {
    const idx = breedingBox.value.findIndex(s => s.genetics.id === geneticsId)
    if (idx === -1) return null
    return breedingBox.value.splice(idx, 1)[0] ?? null
  }

  // === 种子制造机增强 ===

  const trySeedMakerGeneticSeed = (cropId: string, farmingLevel: number): boolean => {
    if (breedingBox.value.length >= maxSeedBox.value) return false

    const chance = getSeedMakerGeneticChance(farmingLevel)
    if (Math.random() > chance) return false

    const base = getDefaultGenetics(cropId)
    // 添加少量随机波动
    const genetics: SeedGenetics = {
      ...base,
      id: generateGeneticsId(),
      sweetness: clampStat(base.sweetness + Math.round((Math.random() - 0.5) * 10)),
      yield: clampStat(base.yield + Math.round((Math.random() - 0.5) * 10)),
      resistance: clampStat(base.resistance + Math.round((Math.random() - 0.5) * 10))
    }

    addToBox(genetics)
    unlocked.value = true
    return true
  }

  // === 育种台 ===

  const craftStation = (spendMoney: (amount: number) => void, removeItem: (id: string, qty: number) => void): boolean => {
    if (stationCount.value >= MAX_BREEDING_STATIONS) return false
    spendMoney(BREEDING_STATION_COST.money)
    for (const mat of BREEDING_STATION_COST.materials) {
      removeItem(mat.itemId, mat.quantity)
    }
    stationCount.value++
    stations.value.push({
      parentA: null,
      parentB: null,
      daysProcessed: 0,
      totalDays: BREEDING_DAYS,
      result: null,
      ready: false
    })
    return true
  }

  const canCraftStation = (money: number, getItemCount: (id: string) => number): boolean => {
    if (stationCount.value >= MAX_BREEDING_STATIONS) return false
    if (money < BREEDING_STATION_COST.money) return false
    for (const mat of BREEDING_STATION_COST.materials) {
      if (getItemCount(mat.itemId) < mat.quantity) return false
    }
    return true
  }

  // === 种子箱升级 ===

  const getNextSeedBoxUpgrade = () => {
    const next = seedBoxLevel.value + 1
    return SEED_BOX_UPGRADES.find(u => u.level === next) ?? null
  }

  const canUpgradeSeedBox = (money: number, getItemCount: (id: string) => number): boolean => {
    const upgrade = getNextSeedBoxUpgrade()
    if (!upgrade) return false
    if (money < upgrade.cost) return false
    for (const mat of upgrade.materials) {
      if (getItemCount(mat.itemId) < mat.quantity) return false
    }
    return true
  }

  const upgradeSeedBox = (
    spendMoney: (amount: number) => void,
    removeItem: (id: string, qty: number) => void
  ): { success: boolean; message: string } => {
    const upgrade = getNextSeedBoxUpgrade()
    if (!upgrade) return { success: false, message: '种子箱已达到最高等级。' }
    spendMoney(upgrade.cost)
    for (const mat of upgrade.materials) {
      removeItem(mat.itemId, mat.quantity)
    }
    seedBoxLevel.value++
    return {
      success: true,
      message: `种子箱扩容完成！容量提升至${maxSeedBox.value}格。`
    }
  }

  const startBreeding = (slotIndex: number, seedAId: string, seedBId: string): boolean => {
    const slot = stations.value[slotIndex]
    if (!slot || slot.parentA || slot.ready) return false

    const seedA = removeFromBox(seedAId)
    const seedB = removeFromBox(seedBId)
    if (!seedA || !seedB) {
      // 归还已取出的种子
      if (seedA) addToBox(seedA.genetics)
      if (seedB) addToBox(seedB.genetics)
      return false
    }

    slot.parentA = seedA.genetics
    slot.parentB = seedB.genetics
    slot.daysProcessed = 0
    slot.totalDays = BREEDING_DAYS
    slot.result = null
    slot.ready = false
    return true
  }

  const collectResult = (slotIndex: number): SeedGenetics | null => {
    const slot = stations.value[slotIndex]
    if (!slot || !slot.ready || !slot.result) return null

    const result = slot.result
    // 放入种子箱
    if (!addToBox(result)) {
      addLog('种子箱已满，无法收取。')
      return null
    }

    // 安全校验：确保杂交种已记录到图鉴
    if (result.isHybrid && result.hybridId) {
      const existing = compendium.value.find(e => e.hybridId === result.hybridId)
      if (!existing) {
        const hybrid = findPossibleHybridById(result.hybridId)
        compendium.value.push({
          hybridId: result.hybridId,
          discoveredYear: useGameStore().year,
          bestTotalStats: result.sweetness + result.yield + result.resistance,
          timesGrown: 0
        })
        if (hybrid) addLog(hybrid.discoveryText)
      }
    }

    // 重置槽位
    slot.parentA = null
    slot.parentB = null
    slot.daysProcessed = 0
    slot.result = null
    slot.ready = false

    return result
  }

  // === 核心杂交算法 ===

  const breedSeeds = (parentA: SeedGenetics, parentB: SeedGenetics): SeedGenetics => {
    if (parentA.cropId === parentB.cropId) {
      // 同种杂交：世代培育
      return breedSameCrop(parentA, parentB)
    } else {
      // 异种杂交
      return breedDifferentCrop(parentA, parentB)
    }
  }

  /** 同种杂交（世代培育） */
  const breedSameCrop = (a: SeedGenetics, b: SeedGenetics): SeedGenetics => {
    const avgStability = (a.stability + b.stability) / 2
    const avgMutationRate = (a.mutationRate + b.mutationRate) / 2

    const fluctuationScale = (avgMutationRate / 50) * (1 - avgStability / 100)

    const fluctuate = (): number => {
      return Math.round((Math.random() - 0.5) * 2 * BASE_MUTATION_MAGNITUDE * fluctuationScale)
    }

    let sweetness = clampStat(Math.round((a.sweetness + b.sweetness) / 2) + fluctuate())
    let yieldVal = clampStat(Math.round((a.yield + b.yield) / 2) + fluctuate())
    let resistance = clampStat(Math.round((a.resistance + b.resistance) / 2) + fluctuate())
    let mutationRate = clampMutationRate(Math.round(avgMutationRate))

    // 变异事件
    if (Math.random() < avgMutationRate / 100) {
      const mutateCount = Math.random() < 0.5 ? 1 : 2
      const stats: ('sweetness' | 'yield' | 'resistance')[] = ['sweetness', 'yield', 'resistance']
      // Fisher-Yates 洗牌
      for (let j = stats.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1))
        ;[stats[j], stats[k]] = [stats[k]!, stats[j]!]
      }
      const shuffled = stats
      const current = { sweetness, yield: yieldVal, resistance }

      for (let i = 0; i < mutateCount; i++) {
        const stat = shuffled[i]!
        const jump = MUTATION_JUMP_MIN + Math.round(Math.random() * (MUTATION_JUMP_MAX - MUTATION_JUMP_MIN))
        const direction = Math.random() < MUTATION_POSITIVE_CHANCE ? 1 : -1
        current[stat] = clampStat(current[stat] + jump * direction)
      }

      sweetness = current.sweetness
      yieldVal = current.yield
      resistance = current.resistance
      mutationRate = clampMutationRate(mutationRate + Math.round((Math.random() - 0.5) * 2 * MUTATION_RATE_DRIFT))

      addLog('育种发生了变异！属性产生了大幅波动。')
    }

    const result: SeedGenetics = {
      id: generateGeneticsId(),
      cropId: a.cropId,
      generation: Math.max(a.generation, b.generation) + 1,
      sweetness,
      yield: yieldVal,
      resistance,
      stability: Math.min(Math.round(avgStability) + GENERATIONAL_STABILITY_GAIN, MAX_STABILITY),
      mutationRate,
      parentA: a.id,
      parentB: b.id,
      isHybrid: a.isHybrid || b.isHybrid,
      hybridId: a.hybridId ?? b.hybridId
    }

    // 同种杂交也需要同步图鉴（防止图鉴条目丢失后无法恢复）
    if (result.isHybrid && result.hybridId) {
      const existing = compendium.value.find(e => e.hybridId === result.hybridId)
      if (!existing) {
        const hybrid = findPossibleHybridById(result.hybridId)
        compendium.value.push({
          hybridId: result.hybridId,
          discoveredYear: useGameStore().year,
          bestTotalStats: result.sweetness + result.yield + result.resistance,
          timesGrown: 0
        })
        if (hybrid) addLog(hybrid.discoveryText)
      } else {
        const total = result.sweetness + result.yield + result.resistance
        if (total > existing.bestTotalStats) {
          existing.bestTotalStats = total
        }
      }
    }

    return result
  }

  /** 异种杂交 */
  const breedDifferentCrop = (a: SeedGenetics, b: SeedGenetics): SeedGenetics => {
    const hybrid = findPossibleHybrid(a.cropId, b.cropId)
    const avgSweetness = (a.sweetness + b.sweetness) / 2
    const avgYield = (a.yield + b.yield) / 2

    // 门槛留出宽容度：差一两点就整批作废最容易劝退，这里按需求的 85% 判定
    const sweetnessNeeded = hybrid ? Math.ceil(hybrid.minSweetness * HYBRID_REQUIREMENT_TOLERANCE) : 0
    const yieldNeeded = hybrid ? Math.ceil(hybrid.minYield * HYBRID_REQUIREMENT_TOLERANCE) : 0

    if (hybrid && avgSweetness >= sweetnessNeeded && avgYield >= yieldNeeded) {
      // 匹配成功，产出杂交种
      const avgStability = (a.stability + b.stability) / 2
      const avgMutationRate = (a.mutationRate + b.mutationRate) / 2
      const fluctuationScale = (avgMutationRate / 50) * (1 - avgStability / 100)

      const fluctuate = (): number => {
        return Math.round((Math.random() - 0.5) * 2 * BASE_MUTATION_MAGNITUDE * fluctuationScale)
      }

      const result: SeedGenetics = {
        id: generateGeneticsId(),
        cropId: hybrid.resultCropId,
        generation: Math.max(a.generation, b.generation) + 1,
        sweetness: clampStat(Math.round(hybrid.baseGenetics.sweetness * 0.6 + avgSweetness * 0.4) + fluctuate()),
        yield: clampStat(Math.round(hybrid.baseGenetics.yield * 0.6 + avgYield * 0.4) + fluctuate()),
        resistance: clampStat(Math.round(hybrid.baseGenetics.resistance * 0.6 + ((a.resistance + b.resistance) / 2) * 0.4) + fluctuate()),
        stability: Math.min(Math.round(avgStability) + GENERATIONAL_STABILITY_GAIN, MAX_STABILITY),
        mutationRate: clampMutationRate(Math.round(avgMutationRate)),
        parentA: a.id,
        parentB: b.id,
        isHybrid: true,
        hybridId: hybrid.id
      }

      // 更新图鉴
      const existing = compendium.value.find(e => e.hybridId === hybrid.id)
      if (!existing) {
        compendium.value.push({
          hybridId: hybrid.id,
          discoveredYear: useGameStore().year,
          bestTotalStats: result.sweetness + result.yield + result.resistance,
          timesGrown: 0
        })
        addLog(hybrid.discoveryText)
        const achievementStore = useAchievementStore()
        achievementStore.recordHybridDiscovered()
        achievementStore.recordHybridTier(getHybridTier(hybrid.id))
      } else {
        const total = result.sweetness + result.yield + result.resistance
        if (total > existing.bestTotalStats) {
          existing.bestTotalStats = total
        }
      }

      return result
    } else {
      // 匹配失败：保留亲本属性不再倒扣，否则连续失败会让玩家越试越差
      const source = Math.random() < 0.5 ? a : b

      const failed: SeedGenetics = {
        ...source,
        id: generateGeneticsId()
      }

      if (hybrid) {
        const lackSweet = Math.max(0, sweetnessNeeded - Math.round(avgSweetness))
        const lackYield = Math.max(0, yieldNeeded - Math.round(avgYield))
        const gaps: string[] = []
        if (lackSweet > 0) gaps.push(`甜度还差${lackSweet}点（${Math.round(avgSweetness)}/${sweetnessNeeded}）`)
        if (lackYield > 0) gaps.push(`产量还差${lackYield}点（${Math.round(avgYield)}/${yieldNeeded}）`)
        addLog(`杂交未成：${gaps.join('，')}。种子已原样返还，先用同种培育把属性顶上去再试。`)
      } else {
        addLog('这两个品种无法杂交，种子已原样返还。')
      }

      return failed
    }
  }

  // === 日更新 ===

  const dailyUpdate = (): void => {
    for (const slot of stations.value) {
      if (slot.parentA && slot.parentB && !slot.ready) {
        slot.daysProcessed++
        if (slot.daysProcessed >= slot.totalDays) {
          const isCrossBreed = slot.parentA.cropId !== slot.parentB.cropId
          slot.result = breedSeeds(slot.parentA, slot.parentB)
          slot.ready = true
          const crop = getCropById(slot.result.cropId)
          const stars = getStarRating(slot.result)
          if (isCrossBreed && slot.result.isHybrid) {
            addLog(`杂交成功：${crop?.name ?? slot.result.cropId}（${stars}星）！已记录到图鉴。`)
          } else if (isCrossBreed) {
            addLog(`杂交未成功，获得了${crop?.name ?? slot.result.cropId}种子（${stars}星）。`)
          } else {
            addLog(`育种完成：${crop?.name ?? slot.result.cropId}（${stars}星）。`)
          }
          const achievementStore = useAchievementStore()
          achievementStore.recordBreeding()
        }
      }
    }
  }

  /** 记录杂交种被种植 */
  const recordHybridGrown = (hybridId: string): void => {
    const entry = compendium.value.find(e => e.hybridId === hybridId)
    if (entry) {
      entry.timesGrown++
    }
  }

  // === 序列化 ===

  /**
   * 整理种子箱。
   * 种子多起来以后同类散落各处，找一颗要翻半天。
   * 按「作物种类 → 综合属性 → 代数」排序，同类自然聚在一起，好的排在前面。
   */
  const sortBreedingBox = () => {
    breedingBox.value.sort((a, b) => {
      const ga = a.genetics
      const gb = b.genetics
      if (ga.cropId !== gb.cropId) return ga.cropId.localeCompare(gb.cropId)
      const totalA = ga.sweetness + ga.yield + ga.resistance
      const totalB = gb.sweetness + gb.yield + gb.resistance
      if (totalA !== totalB) return totalB - totalA
      return gb.generation - ga.generation
    })
  }

  const serialize = () => ({
    breedingBox: breedingBox.value.map(s => ({
      genetics: s.genetics,
      label: s.label
    })),
    stations: stations.value.map(s => ({
      parentA: s.parentA,
      parentB: s.parentB,
      daysProcessed: s.daysProcessed,
      totalDays: s.totalDays,
      result: s.result,
      ready: s.ready
    })),
    stationCount: stationCount.value,
    seedBoxLevel: seedBoxLevel.value,
    compendium: compendium.value,
    unlocked: unlocked.value
  })

  const deserialize = (data: any) => {
    breedingBox.value = (data.breedingBox ?? []).map((s: any) => ({
      genetics: s.genetics,
      label: s.label ?? makeSeedLabel(s.genetics)
    }))
    stations.value = (data.stations ?? []).map((s: any) => ({
      parentA: s.parentA ?? null,
      parentB: s.parentB ?? null,
      daysProcessed: s.daysProcessed ?? 0,
      totalDays: s.totalDays ?? BREEDING_DAYS,
      result: s.result ?? null,
      ready: s.ready ?? false
    }))
    stationCount.value = data.stationCount ?? 0
    seedBoxLevel.value = data.seedBoxLevel ?? 0
    compendium.value = data.compendium ?? []
    unlocked.value = data.unlocked ?? false
  }

  const reset = () => {
    breedingBox.value = []
    stations.value = []
    stationCount.value = 0
    seedBoxLevel.value = 0
    compendium.value = []
    unlocked.value = false
  }

  return {
    // 状态
    breedingBox,
    sortBreedingBox,
    stations,
    stationCount,
    seedBoxLevel,
    compendium,
    unlocked,
    // 计算
    boxCount,
    boxFull,
    maxSeedBox,
    // 方法
    addToBox,
    removeFromBox,
    trySeedMakerGeneticSeed,
    craftStation,
    canCraftStation,
    getNextSeedBoxUpgrade,
    canUpgradeSeedBox,
    upgradeSeedBox,
    startBreeding,
    collectResult,
    dailyUpdate,
    recordHybridGrown,
    // 序列化
    serialize,
    deserialize,
    reset
  }
})
