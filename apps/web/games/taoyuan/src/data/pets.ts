import type { PetAbilityDef, PetAbilityId, PetType } from '@/types'

/**
 * 宠物能力。
 *
 * 好感分档解锁：猫狗都会叼物；狗看家，拦下乌鸦和夜里糟蹋庄稼的野兽；
 * 猫每天早上捕捉农田虫害。
 */

/** 宠物好感上限 */
export const PET_MAX_FRIENDSHIP = 1000

/** 每次抚摸增加的好感 */
export const PET_PETTING_FRIENDSHIP = 5

/** 每次抚摸恢复的体力（不超过体力上限） */
export const PET_PETTING_STAMINA = 5

/** 当天未抚摸扣除的好感 */
export const PET_NEGLECT_FRIENDSHIP_LOSS = 2

/** 叼物解锁好感 */
export const PET_FETCH_UNLOCK = 200

/** 狗看家解锁好感 */
export const DOG_GUARD_UNLOCK = 400

/** 猫捕虫解锁好感 */
export const CAT_PEST_UNLOCK = 400

/** 能力列表（顺序即宠物卡上的标签顺序） */
export const PET_ABILITIES: PetAbilityDef[] = [
  { id: 'fetch', name: '叼物', petTypes: ['cat', 'dog'], unlockFriendship: PET_FETCH_UNLOCK },
  { id: 'guard', name: '看家', petTypes: ['dog'], unlockFriendship: DOG_GUARD_UNLOCK },
  { id: 'pest', name: '捕虫', petTypes: ['cat'], unlockFriendship: CAT_PEST_UNLOCK }
]

/** 叼物每日概率，按好感从高到低匹配 */
export const PET_FETCH_TIERS: { minFriendship: number; chance: number }[] = [
  { minFriendship: 800, chance: 0.3 },
  { minFriendship: 500, chance: 0.2 },
  { minFriendship: PET_FETCH_UNLOCK, chance: 0.1 }
]

/** 叼回的物品：狗叼山野采集物，猫叼小鱼小虾 */
export const PET_FETCH_ITEMS: Record<PetType, string[]> = {
  dog: ['herb', 'wild_berry', 'pine_cone', 'bamboo_shoot', 'wild_mushroom'],
  cat: ['minnow', 'crucian', 'loach', 'freshwater_shrimp', 'snail']
}

/** 猫每天早上最多清除的虫害处数，按好感从高到低匹配 */
export const CAT_PEST_TIERS: { minFriendship: number; limit: number }[] = [
  { minFriendship: 800, limit: 3 },
  { minFriendship: CAT_PEST_UNLOCK, limit: 2 }
]

/** 乌鸦来袭概率，与 useFarmStore.crowAttack 保持一致；狗看家时据此判定是否有乌鸦被赶走 */
export const CROW_VISIT_CHANCE = 0.15

/** 宠物是否已解锁某项能力 */
export const isPetAbilityUnlocked = (type: PetType, id: PetAbilityId, friendship: number): boolean => {
  const def = PET_ABILITIES.find(a => a.id === id)
  return def !== undefined && def.petTypes.includes(type) && friendship >= def.unlockFriendship
}

/** 当前好感对应的每日叼物概率，未解锁为 0 */
export const getPetFetchChance = (friendship: number): number => {
  return PET_FETCH_TIERS.find(t => friendship >= t.minFriendship)?.chance ?? 0
}

/** 当前好感下猫每天最多清除的虫害处数，未解锁为 0 */
export const getCatPestLimit = (friendship: number): number => {
  return CAT_PEST_TIERS.find(t => friendship >= t.minFriendship)?.limit ?? 0
}
