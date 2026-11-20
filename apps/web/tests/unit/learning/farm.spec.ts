import { describe, expect, it } from 'vitest'
import { LEARNING_RULES } from '../../../src/learning/config/rules'
import {
  addFarmInventory,
  advanceFarmTime,
  createEmptyFarmState,
  CROP_IDS,
  getAnimalStatus,
  getPendingHarvestCount,
  getWarehouseCategory,
  parseFarmState,
  removeFarmInventory,
  seedItemId,
  type FarmState,
} from '../../../src/learning/farm/farm-state'
import {
  claimStarterGift,
  collectAnimalProduct,
  feedAnimal,
  fertilizeCrop,
  getWarehouse,
  harvestCrop,
  plantCrop,
} from '../../../src/learning/farm/farm'

const NOW = new Date(2026, 10, 20, 8, 0, 0).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE

function startedFarm(): FarmState {
  const gifted = claimStarterGift(createEmptyFarmState(), {
    actionId: 'starter-gift',
    now: NOW,
  })
  return {
    ...gifted,
    inventory: {
      ...gifted.inventory,
      'wheat-seed': 1,
      'corn-seed': 1,
      'pumpkin-seed': 1,
      fertilizer: 2,
      'cow-feed': 1,
    },
  }
}

describe('farm starter gift and crop state machine', () => {
  it('delivers the fixed starter gift once without repeatable assets', () => {
    const farm = startedFarm()
    expect(farm.plots).toHaveLength(4)
    expect(farm.inventory['radish-seed']).toBe(4)
    expect(farm.inventory['chicken-feed']).toBe(2)
    expect(farm.buildings.chickenCoop.level).toBe(1)
    expect(farm.animals).toHaveLength(1)
    expect(farm.animals[0]).toMatchObject({ kind: 'chicken', production: null })

    const repeated = claimStarterGift(farm, { actionId: 'starter-gift', now: NOW })
    const reentered = claimStarterGift(farm, { actionId: 'reenter-gift', now: NOW + 1 })
    expect(repeated).toBe(farm)
    expect(reentered.plots).toHaveLength(4)
    expect(reentered.animals).toHaveLength(1)
    expect(reentered.inventory['radish-seed']).toBe(4)
    expect(reentered.inventory['chicken-feed']).toBe(2)
  })

  it('uses the PRD growth durations and harvests each crop into storage', () => {
    let farm = startedFarm()
    CROP_IDS.forEach((cropId, index) => {
      farm = plantCrop(farm, {
        actionId: `plant-${cropId}`,
        now: NOW,
        plotId: `plot-${index + 1}`,
        cropId,
      })
      expect(farm.plots[index].crop?.readyAt).toBe(NOW + LEARNING_RULES.farm.crops[cropId].growthMs)
      expect(farm.inventory[seedItemId(cropId)]).toBe(cropId === 'radish' ? 3 : 0)
    })
    expect(() =>
      harvestCrop(farm, { actionId: 'too-early', now: NOW + MINUTE, plotId: 'plot-2' }),
    ).toThrow('尚未成熟')

    CROP_IDS.forEach((cropId, index) => {
      const readyAt = farm.plots[index].crop!.readyAt
      farm = harvestCrop(farm, {
        actionId: `harvest-${cropId}`,
        now: readyAt,
        plotId: `plot-${index + 1}`,
      })
      expect(farm.inventory[cropId]).toBe(1)
      expect(farm.plots[index].crop).toBeNull()
    })
    expect(getPendingHarvestCount(farm, NOW + 8 * HOUR)).toBe(0)
  })

  it('halves the current remaining time once without changing yield', () => {
    let farm = plantCrop(startedFarm(), {
      actionId: 'plant-radish',
      now: NOW,
      plotId: 'plot-1',
      cropId: 'radish',
    })
    farm = fertilizeCrop(farm, { actionId: 'fertilize-1', now: NOW + MINUTE, plotId: 'plot-1' })
    expect(farm.plots[0].crop).toMatchObject({
      readyAt: NOW + 3 * MINUTE,
      fertilized: true,
    })
    expect(farm.inventory.fertilizer).toBe(1)
    expect(() =>
      fertilizeCrop(farm, { actionId: 'fertilize-2', now: NOW + 2 * MINUTE, plotId: 'plot-1' }),
    ).toThrow('最多使用一袋')
    farm = harvestCrop(farm, {
      actionId: 'harvest-fertilized',
      now: NOW + 3 * MINUTE,
      plotId: 'plot-1',
    })
    expect(farm.inventory.radish).toBe(1)
  })

  it('rejects fertilizer on mature crops and conflicting action ID reuse', () => {
    const farm = plantCrop(startedFarm(), {
      actionId: 'plant-radish',
      now: NOW,
      plotId: 'plot-1',
      cropId: 'radish',
    })
    expect(() =>
      fertilizeCrop(farm, {
        actionId: 'fertilize-mature',
        now: NOW + 5 * MINUTE,
        plotId: 'plot-1',
      }),
    ).toThrow('成熟作物')
    expect(() =>
      plantCrop(farm, {
        actionId: 'plant-radish',
        now: NOW,
        plotId: 'plot-2',
        cropId: 'wheat',
      }),
    ).toThrow('操作 ID 已用于另一项')
  })
})

describe('farm animals, warehouse and monotonic time', () => {
  it('produces only one pending egg after a long offline period', () => {
    let farm = feedAnimal(startedFarm(), {
      actionId: 'feed-chicken',
      now: NOW,
      animalId: 'chicken-1',
    })
    expect(farm.inventory['chicken-feed']).toBe(1)
    expect(farm.animals[0].production?.readyAt).toBe(NOW + HOUR)
    expect(getAnimalStatus(farm.animals[0], NOW)).toBe('producing')
    farm = advanceFarmTime(farm, NOW + 72 * HOUR)
    expect(farm.animals[0]).toMatchObject({ production: null, productPending: true })
    expect(getPendingHarvestCount(farm, NOW + 72 * HOUR)).toBe(1)

    farm = collectAnimalProduct(farm, {
      actionId: 'collect-egg',
      now: NOW + 72 * HOUR,
      animalId: 'chicken-1',
    })
    expect(farm.inventory.egg).toBe(1)
    expect(getAnimalStatus(farm.animals[0], NOW + 72 * HOUR)).toBe('needs-feed')
    farm = advanceFarmTime(farm, NOW + 144 * HOUR)
    expect(farm.animals[0].productPending).toBe(false)
    expect(farm.inventory.egg).toBe(1)
  })

  it('requires feed for each new production cycle and never harms waiting animals', () => {
    let farm = feedAnimal(startedFarm(), {
      actionId: 'feed-chicken',
      now: NOW,
      animalId: 'chicken-1',
    })
    expect(() =>
      feedAnimal(farm, { actionId: 'feed-again', now: NOW + 1, animalId: 'chicken-1' }),
    ).toThrow('无需重复喂食')
    farm = collectAnimalProduct(farm, {
      actionId: 'collect-egg',
      now: NOW + HOUR,
      animalId: 'chicken-1',
    })
    farm = advanceFarmTime(farm, NOW + 100 * HOUR)
    expect(farm.animals).toHaveLength(1)
    expect(getAnimalStatus(farm.animals[0], NOW + 100 * HOUR)).toBe('needs-feed')
    farm = feedAnimal(farm, {
      actionId: 'feed-second-cycle',
      now: NOW + 100 * HOUR,
      animalId: 'chicken-1',
    })
    expect(farm.animals[0].production?.startedAt).toBe(NOW + 100 * HOUR)
  })

  it('groups products, seeds and inputs while keeping inputs unsellable by category', () => {
    const warehouse = getWarehouse(startedFarm())
    expect(warehouse.map((group) => group.category)).toEqual([
      'crops',
      'animal-products',
      'seeds',
      'fertilizer',
      'feed',
    ])
    expect(warehouse.find((group) => group.category === 'seeds')?.items).toHaveLength(4)
    expect(
      warehouse
        .filter((group) => group.category === 'crops' || group.category === 'animal-products')
        .flatMap((group) => group.items)
        .every((item) => item.salePrice !== null),
    ).toBe(true)
    expect(
      warehouse
        .filter((group) => !['crops', 'animal-products'].includes(group.category))
        .flatMap((group) => group.items)
        .every((item) => item.salePrice === null),
    ).toBe(true)
  })

  it('does not move time backward or create another product after clock rollback', () => {
    let farm = feedAnimal(startedFarm(), {
      actionId: 'feed-chicken',
      now: NOW,
      animalId: 'chicken-1',
    })
    farm = advanceFarmTime(farm, NOW + 2 * HOUR)
    farm = collectAnimalProduct(farm, {
      actionId: 'collect-egg',
      now: NOW + 2 * HOUR,
      animalId: 'chicken-1',
    })
    const beforeRollback = farm
    farm = advanceFarmTime(farm, NOW - 24 * HOUR)
    expect(farm).toBe(beforeRollback)
    expect(farm.lastAdvancedAt).toBe(NOW + 2 * HOUR)
    expect(farm.inventory.egg).toBe(1)
    expect(farm.animals[0].productPending).toBe(false)

    farm = feedAnimal(farm, {
      actionId: 'feed-after-rollback',
      now: NOW - 24 * HOUR,
      animalId: 'chicken-1',
    })
    expect(farm.animals[0].production?.startedAt).toBe(NOW + 2 * HOUR)
    farm = advanceFarmTime(farm, NOW)
    expect(farm.inventory.egg).toBe(1)
    expect(farm.animals[0].productPending).toBe(false)
  })

  it('keeps matured crops harvestable during rollback without restarting growth', () => {
    let farm = plantCrop(startedFarm(), {
      actionId: 'plant-radish',
      now: NOW,
      plotId: 'plot-1',
      cropId: 'radish',
    })
    farm = advanceFarmTime(farm, NOW + 5 * MINUTE)
    farm = harvestCrop(farm, {
      actionId: 'harvest-after-rollback',
      now: NOW - 10 * MINUTE,
      plotId: 'plot-1',
    })
    expect(farm.inventory.radish).toBe(1)
    expect(farm.plots[0].crop).toBeNull()
  })
})

describe('farm persistence boundaries', () => {
  function expectInvalidFarm(change: (farm: FarmState) => void, message: string): void {
    const farm = startedFarm()
    change(farm)
    expect(() => parseFarmState(farm)).toThrow(message)
  }

  it('rejects malformed plots, crops and building levels', () => {
    expectInvalidFarm((farm) => {
      farm.plots = {} as unknown as FarmState['plots']
    }, '最多 8 块土地')
    expectInvalidFarm((farm) => {
      farm.plots[0].id = 'plot-2'
    }, '按顺序')
    expectInvalidFarm((farm) => {
      farm.plots[0].crop = {
        cropId: 'tomato' as 'radish',
        plantedAt: NOW,
        readyAt: NOW + MINUTE,
        fertilized: false,
      }
    }, '作物类型未知')
    expectInvalidFarm((farm) => {
      farm.plots[0].crop = {
        cropId: 'radish',
        plantedAt: NOW,
        readyAt: NOW,
        fertilized: false,
      }
    }, '成熟时间')
    expectInvalidFarm((farm) => {
      farm.plots[0].crop = {
        cropId: 'radish',
        plantedAt: NOW,
        readyAt: NOW + MINUTE,
        fertilized: 'yes' as unknown as boolean,
      }
    }, 'fertilized')
    expectInvalidFarm((farm) => {
      farm.buildings.chickenCoop.level = 3
    }, '不能超过 Lv2')
  })

  it('rejects malformed animals, excess capacity and invalid production', () => {
    expectInvalidFarm((farm) => {
      farm.animals = [farm.animals[0], farm.animals[0]]
    }, '唯一')
    expectInvalidFarm((farm) => {
      farm.animals[0].kind = 'horse' as 'chicken'
    }, '动物类型未知')
    expectInvalidFarm((farm) => {
      farm.animals[0].production = { startedAt: NOW, readyAt: NOW }
    }, '成熟时间')
    expectInvalidFarm((farm) => {
      farm.animals[0].production = { startedAt: NOW, readyAt: NOW + HOUR }
      farm.animals[0].productPending = true
    }, '不能同时生产')
    expectInvalidFarm((farm) => {
      farm.animals = [
        ...farm.animals,
        { ...farm.animals[0], id: 'chicken-2' },
        { ...farm.animals[0], id: 'chicken-3' },
      ]
    }, '超过建筑容量')
  })

  it('rejects invalid daily sale, recovery, timestamp and action records', () => {
    expectInvalidFarm((farm) => {
      farm.saleIncomeByDate = { '2026-11-20': 61 }
    }, '不能超过上限')
    expectInvalidFarm((farm) => {
      farm.recoveryClaimDates = {} as unknown as string[]
    }, '必须是数组')
    expectInvalidFarm((farm) => {
      farm.recoveryClaimDates = ['2026-11-20', '2026-11-20']
    }, '必须唯一')
    expectInvalidFarm((farm) => {
      farm.lastAdvancedAt = -1
    }, 'lastAdvancedAt')
    expectInvalidFarm((farm) => {
      farm.actions = { '': 'signature' }
    }, '操作记录无效')
    expectInvalidFarm((farm) => {
      farm.actions = { action: '' }
    }, '操作记录无效')
  })

  it('guards inventory arithmetic, timestamps and unknown warehouse items', () => {
    expect(() => addFarmInventory({ radish: Number.MAX_SAFE_INTEGER }, 'radish', 1)).toThrow(
      '超出安全整数',
    )
    expect(() => addFarmInventory({}, 'radish', 0)).toThrow('物品数量')
    expect(() => removeFarmInventory({}, 'radish', 1)).toThrow('数量不足')
    expect(() => advanceFarmTime(startedFarm(), -1)).toThrow('农场时间')
    expect(getWarehouseCategory('unknown-item')).toBeNull()
  })
})
