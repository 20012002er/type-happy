import { describe, expect, it } from 'vitest'
import { claimStarterGift, feedAnimal, plantCrop } from '../../../src/learning/farm/farm'
import { createEmptyFarmState } from '../../../src/learning/farm/farm-state'
import { projectFarmScene, type FarmSceneModel } from '../../../src/learning/farm/scene-model'
import {
  FARM_SCENE_ASSETS,
  FEEDBACK_LABELS,
  FarmSceneRenderer,
  type FarmPixiModule,
  type SceneAnchor,
} from '../../../src/learning/farm/scene-renderer'
import { createEmptyProcessingState } from '../../../src/learning/processing/state'
import { createPixiTestDouble } from '../../helpers/pixi'

const NOW = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000

function growingModel(): FarmSceneModel {
  let farm = claimStarterGift(createEmptyFarmState(), { actionId: 'gift', now: NOW })
  farm = plantCrop(farm, { actionId: 'plant', now: NOW, plotId: 'plot-1', cropId: 'radish' })
  farm = feedAnimal(farm, { actionId: 'feed', now: NOW, animalId: 'chicken-1' })
  return projectFarmScene({
    farm,
    processing: createEmptyProcessingState(),
    now: NOW + MINUTE,
    selectedKey: 'plot:plot-1',
  })
}

function anchorsFor(model: FarmSceneModel): Map<string, SceneAnchor> {
  const anchors = new Map<string, SceneAnchor>()
  const ids = [
    ...model.plots.map((plot) => plot.id),
    ...model.animals.map((animal) => animal.id),
    ...model.buildings.map((building) => building.id),
    model.processing.id,
  ]
  ids.forEach((id, index) => {
    anchors.set(id, { x: index * 50, y: 10, width: 40, height: 40 })
  })
  return anchors
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function setup() {
  const resources = Object.fromEntries(
    FARM_SCENE_ASSETS.map((asset) => [asset.src, { id: asset.alias }]),
  )
  const pixi = createPixiTestDouble(resources)
  const applications: InstanceType<typeof pixi.Application>[] = []
  class TrackedApplication extends pixi.Application {
    constructor() {
      super()
      applications.push(this)
    }
  }
  const module = { ...pixi, Application: TrackedApplication } as unknown as FarmPixiModule
  const renderer = new FarmSceneRenderer(module)
  const host = document.createElement('div')
  document.body.appendChild(host)
  return { pixi, module, renderer, host, applications }
}

async function initialized() {
  const context = setup()
  await context.renderer.init(context.host, { width: 400, height: 300, resolution: 2 })
  return context
}

interface RendererInternals {
  nodes: Map<string, { graphics: { calls: string[] }; container: { rotation: number } }>
  feedbacks: unknown[]
}

function internals(renderer: FarmSceneRenderer): RendererInternals {
  return renderer as unknown as RendererInternals
}

describe('FarmSceneRenderer lifecycle (T09-02)', () => {
  it('initializes on demand, appends an aria-hidden canvas and registers one ticker callback', async () => {
    const { renderer, host, applications } = await initialized()
    const canvas = host.querySelector('canvas')!
    expect(canvas).toBeTruthy()
    expect(canvas.getAttribute('aria-hidden')).toBe('true')
    expect(applications).toHaveLength(1)
    expect(applications[0].initOptions).toMatchObject({
      width: 400,
      height: 300,
      resolution: 2,
      backgroundAlpha: 0,
      antialias: false,
    })
    expect(applications[0].ticker.listenerCount).toBe(1)
    expect(applications[0].ticker.started).toBe(true)
    renderer.destroy()
    host.remove()
  })

  it('falls back cleanly when asset loading fails: no canvas, app destroyed', async () => {
    const { pixi, renderer, host, applications } = setup()
    pixi.Assets.failNext(FARM_SCENE_ASSETS[0].src)
    await expect(renderer.init(host, { width: 400, height: 300, resolution: 1 })).rejects.toThrow(
      /Injected asset failure/,
    )
    expect(host.querySelector('canvas')).toBeNull()
    expect(applications[0].destroyed).toBe(true)
    expect(applications[0].ticker.listenerCount).toBe(0)
    renderer.destroy()
    host.remove()
  })

  it('destroy removes the ticker listener, canvas and textures, and is idempotent', async () => {
    const { renderer, host, applications } = await initialized()
    const model = growingModel()
    renderer.sync(model, anchorsFor(model))
    renderer.playFeedback('plot:plot-1', 'harvest')
    renderer.destroy()
    expect(applications[0].ticker.listenerCount).toBe(0)
    expect(applications[0].destroyed).toBe(true)
    expect(host.querySelector('canvas')).toBeNull()
    expect(internals(renderer).nodes.size).toBe(0)
    expect(internals(renderer).feedbacks).toHaveLength(0)
    renderer.destroy()
    host.remove()
  })
})

describe('FarmSceneRenderer scene sync (T09-01/03/04/05/06)', () => {
  it('creates stable nodes per object and only redraws when the visual state changes', async () => {
    const { renderer, host } = await initialized()
    const model = growingModel()
    const anchors = anchorsFor(model)
    renderer.sync(model, anchors)
    const nodes = internals(renderer).nodes
    expect(nodes.size).toBe(model.plots.length + model.animals.length + model.buildings.length + 1)
    const plotCalls = nodes.get('plot:plot-1')!.graphics.calls.length
    expect(plotCalls).toBeGreaterThan(0)

    renderer.sync(model, anchors)
    expect(nodes.get('plot:plot-1')!.graphics.calls.length).toBe(plotCalls)

    const matured = projectFarmScene({
      farm: claimStarterGift(createEmptyFarmState(), { actionId: 'gift', now: NOW }),
      processing: createEmptyProcessingState(),
      now: NOW,
      selectedKey: null,
    })
    renderer.sync(matured, anchorsFor(matured))
    expect(nodes.get('plot:plot-1')!.graphics.calls.length).toBeGreaterThan(plotCalls)
    renderer.destroy()
    host.remove()
  })

  it('ticker only moves display objects and never mutates the frozen scene model', async () => {
    const { renderer, host, applications } = await initialized()
    const model = deepFreeze(growingModel())
    const anchors = deepFreeze(anchorsFor(model))
    renderer.sync(model, anchors)
    const before = JSON.stringify(model)
    for (let frame = 0; frame < 120; frame += 1) applications[0].ticker.tick(16)
    expect(JSON.stringify(model)).toBe(before)
    expect(internals(renderer).nodes.get('plot:plot-1')!.container.rotation).not.toBe(0)
    renderer.destroy()
    host.remove()
  })
})

describe('FarmSceneRenderer motion, visibility and performance (T09-08)', () => {
  it('static mode stops the ticker, resets poses and skips animated feedback', async () => {
    const { renderer, host, applications } = await initialized()
    const model = growingModel()
    renderer.sync(model, anchorsFor(model))
    applications[0].ticker.tick(16)
    renderer.setMotionMode('static')
    expect(applications[0].ticker.started).toBe(false)
    expect(internals(renderer).nodes.get('plot:plot-1')!.container.rotation).toBe(0)
    const stageCount = applications[0].stage.children.length
    renderer.playFeedback('plot:plot-1', 'harvest')
    renderer.playCoins(3)
    expect(applications[0].stage.children.length).toBe(stageCount)
    renderer.setMotionMode('full')
    expect(applications[0].ticker.started).toBe(true)
    renderer.destroy()
    host.remove()
  })

  it('pauses in background and resyncs the current snapshot on return without replay', async () => {
    const { renderer, host, applications } = await initialized()
    const model = growingModel()
    renderer.sync(model, anchorsFor(model))
    renderer.setHidden(true)
    expect(applications[0].ticker.started).toBe(false)
    renderer.setHidden(false)
    expect(applications[0].ticker.started).toBe(true)
    expect(internals(renderer).nodes.size).toBeGreaterThan(0)
    renderer.destroy()
    host.remove()
  })

  it('degrades decorative loops after sustained slow frames', async () => {
    const { renderer, host, applications } = await initialized()
    const model = growingModel()
    renderer.sync(model, anchorsFor(model))
    expect(renderer.isDegraded).toBe(false)
    for (let frame = 0; frame < 60; frame += 1) applications[0].ticker.tick(50)
    expect(renderer.isDegraded).toBe(true)
    renderer.destroy()
    host.remove()
  })

  it('resize updates the renderer surface and environment layout', async () => {
    const { renderer, host, applications } = await initialized()
    renderer.resize(720, 480)
    expect(applications[0].screen.width).toBe(720)
    expect(applications[0].screen.height).toBe(480)
    renderer.destroy()
    host.remove()
  })
})

describe('FarmSceneRenderer operation feedback (T09-07)', () => {
  it('plays a short object-local feedback that expires and is destroyed', async () => {
    const { renderer, host, applications } = await initialized()
    const model = growingModel()
    renderer.sync(model, anchorsFor(model))
    renderer.playFeedback('animal:chicken-1', 'collect')
    expect(internals(renderer).feedbacks).toHaveLength(1)
    const texts = applications[0].stage.children.flatMap(
      (child) => (child as { children?: { text?: string }[] }).children ?? [],
    )
    expect(texts.some((child) => child.text === FEEDBACK_LABELS.collect)).toBe(true)
    for (let frame = 0; frame < 70; frame += 1) applications[0].ticker.tick(16)
    expect(internals(renderer).feedbacks).toHaveLength(0)
    renderer.destroy()
    host.remove()
  })

  it('ignores feedback for unknown anchors and shows signed coin amounts', async () => {
    const { renderer, host, applications } = await initialized()
    const model = growingModel()
    renderer.sync(model, anchorsFor(model))
    renderer.playFeedback('plot:missing', 'harvest')
    expect(internals(renderer).feedbacks).toHaveLength(0)
    renderer.playCoins(0)
    expect(internals(renderer).feedbacks).toHaveLength(0)
    renderer.playCoins(9)
    renderer.playCoins(-6)
    expect(internals(renderer).feedbacks).toHaveLength(2)
    const texts = applications[0].stage.children.flatMap(
      (child) => (child as { children?: { text?: string }[] }).children ?? [],
    )
    expect(texts.some((child) => child.text === '+9 金币')).toBe(true)
    expect(texts.some((child) => child.text === '-6 金币')).toBe(true)
    renderer.destroy()
    host.remove()
  })
})
