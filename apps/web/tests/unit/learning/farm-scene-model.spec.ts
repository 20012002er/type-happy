import { describe, expect, it } from 'vitest'
import { claimStarterGift, feedAnimal, plantCrop } from '../../../src/learning/farm/farm'
import { createEmptyFarmState, type FarmState } from '../../../src/learning/farm/farm-state'
import {
  projectFarmScene,
  type FarmSceneInput,
  type FarmSceneModel,
} from '../../../src/learning/farm/scene-model'
import {
  createEmptyProcessingState,
  type ProcessingState,
} from '../../../src/learning/processing/state'
import { collectSceneObjectIds, expectSceneProjection } from '../../helpers/scene-model'

const NOW = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000

function growingFarm(): FarmState {
  let farm = claimStarterGift(createEmptyFarmState(), { actionId: 'gift', now: NOW })
  farm = plantCrop(farm, { actionId: 'plant', now: NOW, plotId: 'plot-1', cropId: 'radish' })
  return feedAnimal(farm, { actionId: 'feed', now: NOW, animalId: 'chicken-1' })
}

function sceneInput(overrides: Partial<FarmSceneInput> = {}): FarmSceneInput {
  return {
    farm: growingFarm(),
    processing: createEmptyProcessingState(),
    now: NOW,
    selectedKey: null,
    ...overrides,
  }
}

function allObjectIds(model: FarmSceneModel): string[] {
  return [
    ...model.plots.map((plot) => plot.id),
    ...model.animals.map((animal) => animal.id),
    ...model.buildings.map((building) => building.id),
    model.processing.id,
    ...model.environment.clouds.map((cloud) => cloud.id),
  ]
}

describe('farm scene model projection (T09-01)', () => {
  it('is a pure deterministic projection with stable unique object IDs', () => {
    const input = sceneInput({ selectedKey: 'plot:plot-1' })
    const model = expectSceneProjection(projectFarmScene, input, (value) => ({
      id: 'scene',
      children: [
        ...value.plots,
        ...value.animals,
        ...value.buildings,
        value.processing,
        ...value.environment.clouds,
      ],
    }))
    const ids = allObjectIds(model)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('plot:plot-1')
    expect(ids).toContain('plot:plot-8')
    expect(ids).toContain('animal:chicken-1')
    expect(ids).toContain('building:chickenCoop')
    expect(ids).toContain('building:cowshed')
    expect(ids).toContain('building:processing')
    expect(ids).toContain('decor:cloud-1')
    expect(model.plots[0].selected).toBe(true)
    expect(model.plots[1].selected).toBe(false)
  })

  it('distinguishes locked, empty, seedling, growing and ready plot forms', () => {
    const farm = growingFarm()
    const seedling = projectFarmScene(sceneInput({ farm, now: NOW + MINUTE }))
    expect(seedling.plots[0].stage).toBe('seedling')
    expect(seedling.plots[0].cropId).toBe('radish')
    expect(seedling.plots[0].progress).toBeGreaterThan(0)
    expect(seedling.plots[0].progress).toBeLessThan(1 / 3)

    const growing = projectFarmScene(sceneInput({ farm, now: NOW + 3 * MINUTE }))
    expect(growing.plots[0].stage).toBe('growing')
    expect(growing.plots[0].remainingMs).toBeGreaterThan(0)

    const ready = projectFarmScene(sceneInput({ farm, now: NOW + 6 * MINUTE }))
    expect(ready.plots[0].stage).toBe('ready')
    expect(ready.plots[0].progress).toBe(1)
    expect(ready.plots[0].remainingMs).toBe(0)

    expect(ready.plots[1].stage).toBe('empty')
    expect(ready.plots[4].stage).toBe('locked')
    expect(ready.plots[7].stage).toBe('locked')
  })

  it('projects animal idle, producing and ready states without hunger semantics', () => {
    const farm = growingFarm()
    const producing = projectFarmScene(sceneInput({ farm, now: NOW + 10 * MINUTE }))
    expect(producing.animals[0]).toMatchObject({
      id: 'animal:chicken-1',
      kind: 'chicken',
      state: 'producing',
    })
    expect(producing.animals[0].remainingMs).toBeGreaterThan(0)

    const ready = projectFarmScene(sceneInput({ farm, now: NOW + 61 * MINUTE }))
    expect(ready.animals[0].state).toBe('ready')
    expect(ready.animals[0].remainingMs).toBe(0)

    const empty = projectFarmScene(sceneInput({ farm: createEmptyFarmState() }))
    expect(empty.animals).toEqual([])
    const idleFarm = claimStarterGift(createEmptyFarmState(), { actionId: 'gift', now: NOW })
    expect(projectFarmScene(sceneInput({ farm: idleFarm })).animals[0].state).toBe('idle')
  })

  it('keeps building capacity and counts as text-backed data, not visual-only', () => {
    const model = projectFarmScene(sceneInput({ now: NOW + 61 * MINUTE }))
    expect(model.buildings[0]).toEqual({
      id: 'building:chickenCoop',
      kind: 'chickenCoop',
      level: 1,
      capacity: 2,
      count: 1,
      hasReadyProduct: true,
    })
    expect(model.buildings[1]).toMatchObject({ level: 0, capacity: 0, count: 0 })
  })

  it('projects processing locked, unpurchased, idle, processing and ready states', () => {
    const farm = growingFarm()
    const locked = projectFarmScene(sceneInput({ farm }))
    expect(locked.processing).toMatchObject({
      state: 'locked',
      harvestProgress: 0,
      harvestRequired: 3,
      price: 240,
    })

    // 三次手动收获后解锁购买资格（不免费发建筑）
    let harvested = farm
    for (let index = 0; index < 3; index += 1) {
      harvested = {
        ...harvested,
        actions: {
          ...harvested.actions,
          [`harvest-${index}`]: JSON.stringify({ type: 'harvest-crop', plotId: 'plot-1' }),
        },
      }
    }
    const unpurchased = projectFarmScene(sceneInput({ farm: harvested }))
    expect(unpurchased.processing.state).toBe('unpurchased')
    expect(unpurchased.processing.harvestProgress).toBe(3)

    const purchased: ProcessingState = {
      workshop: { purchased: true, activeTask: null, pendingOutput: null },
      actions: {},
    }
    expect(
      projectFarmScene(sceneInput({ farm: harvested, processing: purchased })).processing.state,
    ).toBe('idle')

    const processing: ProcessingState = {
      workshop: {
        purchased: true,
        activeTask: {
          id: 'task-1',
          recipeId: 'flour',
          recipeVersion: 1,
          startedAt: NOW,
          completesAt: NOW + 20 * MINUTE,
        },
        pendingOutput: null,
      },
      actions: {},
    }
    const midTask = projectFarmScene(
      sceneInput({ farm: harvested, processing, now: NOW + 10 * MINUTE }),
    )
    expect(midTask.processing.state).toBe('processing')
    expect(midTask.processing.progress).toBeCloseTo(0.5)
    expect(midTask.processing.remainingMs).toBe(10 * MINUTE)

    const done = projectFarmScene(
      sceneInput({ farm: harvested, processing, now: NOW + 25 * MINUTE }),
    )
    expect(done.processing.progress).toBe(1)
    expect(done.processing.remainingMs).toBe(0)

    const pending: ProcessingState = {
      workshop: {
        purchased: true,
        activeTask: null,
        pendingOutput: { taskId: 'task-1', productId: 'flour', quantity: 1, completedAt: NOW },
      },
      actions: {},
    }
    expect(
      projectFarmScene(sceneInput({ farm: harvested, processing: pending })).processing,
    ).toMatchObject({
      state: 'ready',
      pendingQuantity: 1,
    })

    // 已购买的加工坊不受解锁进度遮蔽（老用户追溯口径）
    expect(projectFarmScene(sceneInput({ farm, processing: pending })).processing.state).toBe(
      'ready',
    )
  })

  it('never rewinds forms when the wall clock is rolled back', () => {
    const farm = { ...growingFarm(), lastAdvancedAt: NOW + 120 * MINUTE }
    const model = projectFarmScene(sceneInput({ farm, now: NOW }))
    expect(model.plots[0].stage).toBe('ready')
    expect(model.animals[0].state).toBe('ready')
  })

  it('bounds decorative environment and keeps weather independent of business data', () => {
    const input = sceneInput()
    const model = projectFarmScene(input)
    expect(model.environment.clouds).toHaveLength(3)
    expect(model.environment.daylight).toBeGreaterThanOrEqual(0)
    expect(model.environment.daylight).toBeLessThanOrEqual(1)
    expect(['none', 'drizzle']).toContain(model.environment.weather)

    // 装饰天气随日期变化（8 天内两种形态都会出现），同一天气投影确定可复现
    const weathers = new Set<string>()
    for (let day = 0; day < 8; day += 1) {
      const at = NOW + day * 24 * 60 * MINUTE
      const dayModel = projectFarmScene(sceneInput({ now: at }))
      weathers.add(dayModel.environment.weather)
      expect(projectFarmScene(sceneInput({ now: at })).environment.weather).toBe(
        dayModel.environment.weather,
      )
    }
    expect(weathers).toEqual(new Set(['none', 'drizzle']))
    expect(collectSceneObjectIds({ id: 'root', children: model.environment.clouds })).toEqual([
      'root',
      'decor:cloud-1',
      'decor:cloud-2',
      'decor:cloud-3',
    ])
  })
})
