import { describe, expect, it, vi } from 'vitest'
import { RevisionConflictError } from '../../src/learning/persistence/repository'
import { LEARNING_STORAGE_KEY } from '../../src/learning/persistence/snapshot'
import { createLearningSnapshotFixture } from '../fixtures/learning'
import { createPixiTestDouble } from '../helpers/pixi'
import { createResourceFailureLoader } from '../helpers/resource-failure'
import { createRevisionConflictScenario } from '../helpers/revision-conflict'
import {
  collectSceneObjectIds,
  expectSceneProjection,
  expectUniqueSceneObjectIds,
} from '../helpers/scene-model'

describe('resource failure loader', () => {
  it('injects a failure for only one URI and recovers on the next load', async () => {
    const resources: Record<string, string> = {
      '/farm.png': 'farm texture',
      '/animals.png': 'animal texture',
    }
    const calls: string[] = []
    const loader = createResourceFailureLoader(async (uri: string) => {
      calls.push(uri)
      return resources[uri]
    })

    await expect(loader.load('/farm.png')).resolves.toBe('farm texture')
    const failure = new Error('network offline')
    loader.failNext('/farm.png', failure)

    await expect(loader.load('/farm.png')).rejects.toBe(failure)
    await expect(loader.load('/animals.png')).resolves.toBe('animal texture')
    await expect(loader.load('/farm.png')).resolves.toBe('farm texture')
    expect(calls).toEqual(['/farm.png', '/animals.png', '/farm.png'])
  })
})

describe('revision conflict scenario', () => {
  it('shares storage between repositories without allowing a stale overwrite', () => {
    const scenario = createRevisionConflictScenario()

    expect(scenario.first).not.toBe(scenario.second)
    expect(scenario.firstSnapshot).toEqual(createLearningSnapshotFixture())
    expect(scenario.secondSnapshot).toEqual(scenario.firstSnapshot)

    const saved = scenario.saveFirst()
    expect(saved.revision).toBe(1)
    expect(scenario.second.load()).toEqual(saved)

    expect(scenario.saveStaleSecond).toThrow(RevisionConflictError)
    expect(scenario.saveStaleSecond).toThrow('期望 0，实际 1')
    expect(scenario.transactStaleSecond).toThrow(RevisionConflictError)
    expect(scenario.secondSnapshot.revision).toBe(0)
    expect(scenario.storage.getItem(LEARNING_STORAGE_KEY)).toBe(JSON.stringify(saved))
  })
})

describe('Pixi test double', () => {
  it('initializes, resizes and destroys an application without requesting a graphics context', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    const { Application, Container } = createPixiTestDouble()
    const application = new Application()
    const host = document.createElement('div')
    host.appendChild(application.canvas)

    await application.init({ width: 320, height: 180, background: '#ffffff' })
    expect(application.initialized).toBe(true)
    expect(application.initOptions).toMatchObject({ width: 320, height: 180 })
    expect(application.screen).toEqual({ width: 320, height: 180 })
    expect(application.canvas.width).toBe(320)
    expect(application.canvas.height).toBe(180)

    const layer = new Container()
    const child = new Container()
    expect(application.stage.addChild(layer)).toBe(layer)
    expect(layer.addChild(child)).toBe(child)
    expect(application.stage.children).toEqual([layer])
    expect(layer.children).toEqual([child])
    expect(layer.removeChild(child)).toBe(child)
    expect(layer.children).toEqual([])

    application.renderer.resize(640, 360)
    expect(application.screen).toEqual({ width: 640, height: 360 })
    expect(application.canvas.width).toBe(640)
    expect(application.canvas.height).toBe(360)

    application.destroy(true, { children: true })
    expect(application.destroyed).toBe(true)
    expect(application.ticker.started).toBe(false)
    expect(application.stage.children).toEqual([])
    expect(host.contains(application.canvas)).toBe(false)
    expect(getContext).not.toHaveBeenCalled()
  })

  it('supports deterministic ticker registration, start, ticks and stop', () => {
    const { Application } = createPixiTestDouble()
    const application = new Application()
    const listener = vi.fn()

    application.ticker.add(listener).add(listener)
    expect(application.ticker.listenerCount).toBe(1)
    application.ticker.start()
    expect(application.ticker.started).toBe(true)

    application.ticker.tick(32)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ deltaMS: 32, deltaTime: 1.92 })

    application.ticker.stop()
    expect(application.ticker.started).toBe(false)
    application.ticker.remove(listener)
    application.ticker.tick(32)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(application.ticker.listenerCount).toBe(0)
  })

  it('loads assets by URI and alias and recovers after a one-shot URI failure', async () => {
    const farmTexture = { kind: 'farm' }
    const animalTexture = { kind: 'animals' }
    const { Assets } = createPixiTestDouble({
      '/farm.png': farmTexture,
      '/animals.png': animalTexture,
    })

    await expect(Assets.load('/farm.png')).resolves.toBe(farmTexture)
    expect(Assets.get('/farm.png')).toBe(farmTexture)
    await expect(
      Assets.load([
        { alias: 'farm', src: '/farm.png' },
        { alias: 'animals', src: '/animals.png' },
      ]),
    ).resolves.toEqual({ farm: farmTexture, animals: animalTexture })
    expect(Assets.get('farm')).toBe(farmTexture)
    expect(Assets.get('animals')).toBe(animalTexture)

    const failure = new Error('image decode failed')
    Assets.failNext('/farm.png', failure)
    await expect(Assets.load({ alias: 'farm', src: '/farm.png' })).rejects.toBe(failure)
    await expect(Assets.load('/animals.png')).resolves.toBe(animalTexture)
    await expect(Assets.load('/farm.png')).resolves.toBe(farmTexture)
  })
})

describe('scene model helpers', () => {
  it('checks input immutability, deterministic projection and recursive IDs', () => {
    const input = {
      plots: [
        { id: 'north', growth: 0.25 },
        { id: 'south', growth: 1 },
      ],
    }
    const originalInput = structuredClone(input)
    const project = (snapshot: typeof input) => ({
      id: 'farm',
      children: snapshot.plots.map((plot) => ({
        id: `plot:${plot.id}`,
        children: [{ id: `crop:${plot.id}` }],
      })),
    })

    const model = expectSceneProjection(project, input)
    expect(model).toEqual({
      id: 'farm',
      children: [
        { id: 'plot:north', children: [{ id: 'crop:north' }] },
        { id: 'plot:south', children: [{ id: 'crop:south' }] },
      ],
    })
    expect(input).toEqual(originalInput)
    expect(collectSceneObjectIds(model)).toEqual([
      'farm',
      'plot:north',
      'crop:north',
      'plot:south',
      'crop:south',
    ])
    expectUniqueSceneObjectIds(model)
  })

  it('reports duplicate IDs across roots and nested children', () => {
    const tree = [
      { id: 'farm', children: [{ id: 'shared', children: [{ id: 'crop' }] }] },
      { id: 'shared' },
    ]

    expect(collectSceneObjectIds(tree)).toEqual(['farm', 'shared', 'crop', 'shared'])
    expect(() => expectUniqueSceneObjectIds(tree)).toThrow(/shared/)
  })

  it('rejects mutating or non-deterministic projections', () => {
    expect(() =>
      expectSceneProjection(
        (input: { growth: number }) => {
          input.growth += 1
          return { id: 'farm' }
        },
        { growth: 0 },
      ),
    ).toThrow()

    let calls = 0
    expect(() =>
      expectSceneProjection(() => ({ id: ++calls === 1 ? 'farm:first' : 'farm:second' }), {
        growth: 0,
      }),
    ).toThrow()
  })
})
