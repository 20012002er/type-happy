import type { FarmSceneModel } from './scene-model'

/** 场景锚点：由 DOM 布局测量得到，canvas 只跟随布局，不定义布局（T09-09） */
export interface SceneAnchor {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface DisplayObjectLike {
  position: { x: number; y: number; set(x: number, y: number): void }
  scale: { set(x: number, y?: number): void }
  anchor?: { set(x: number, y?: number): void }
  alpha: number
  visible: boolean
  rotation: number
  destroy(options?: unknown): void
}

export interface PixiContainerLike extends DisplayObjectLike {
  children: readonly unknown[]
  addChild<T>(child: T): T
  removeChild<T>(child: T): T
  removeChildren(): unknown[]
}

export interface PixiGraphicsLike extends PixiContainerLike {
  rect(x: number, y: number, width: number, height: number): this
  circle(x: number, y: number, radius: number): this
  fill(color: number): this
  clear(): this
}

export interface PixiTextLike extends PixiContainerLike {
  text: string
}

interface ApplicationLike {
  readonly canvas: HTMLCanvasElement
  readonly stage: PixiContainerLike
  readonly ticker: {
    add(callback: (ticker: { deltaMS: number }) => void): unknown
    remove(callback: (ticker: { deltaMS: number }) => void): unknown
    start(): void
    stop(): void
  }
  init(options: Record<string, unknown>): Promise<void>
  destroy(removeView?: boolean, options?: Record<string, unknown>): void
  readonly renderer: { resize(width: number, height: number): void }
}

/** 渲染器只依赖结构化 Pixi 图元，单元测试注入替身，不依赖 WebGL（T00-04） */
export interface FarmPixiModule {
  Application: new () => ApplicationLike
  Container: new () => PixiContainerLike
  Graphics: new () => PixiGraphicsLike
  Text: new (options: { text: string; style?: unknown }) => PixiTextLike
  TextStyle: new (options: Record<string, unknown>) => unknown
  Sprite: new (texture: unknown) => PixiContainerLike
  Assets: {
    load(requests: readonly { alias: string; src: string }[]): Promise<Record<string, unknown>>
    get<T = unknown>(key: string): T
  }
}

export type FarmFeedbackKind =
  | 'plant'
  | 'fertilize'
  | 'harvest'
  | 'feed'
  | 'collect'
  | 'buy'
  | 'process-start'
  | 'process-collect'

export const FEEDBACK_LABELS: Record<FarmFeedbackKind, string> = {
  plant: '已播种',
  fertilize: '已施肥',
  harvest: '已入仓',
  feed: '开始生产',
  collect: '已收取',
  buy: '购买成功',
  'process-start': '加工中',
  'process-collect': '加工品入仓',
}

function svgUri(body: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16">${body}</svg>`)}`
}

/** 装饰纹理全部内联，无外部请求；加载失败时整体回退静态 DOM 场景 */
export const FARM_SCENE_ASSETS: readonly { alias: string; src: string }[] = [
  {
    alias: 'farm-cloud',
    src: svgUri(
      '<ellipse cx="16" cy="10" rx="14" ry="5" fill="#ffffff"/><ellipse cx="9" cy="7" rx="7" ry="4" fill="#ffffff"/><ellipse cx="22" cy="7" rx="6" ry="4" fill="#ffffff"/>',
    ),
  },
  {
    alias: 'farm-sparkle',
    src: svgUri(
      '<rect x="14" y="2" width="4" height="12" fill="#ffd75e"/><rect x="10" y="6" width="12" height="4" fill="#ffd75e"/>',
    ),
  },
]

const INK = 0x3a2f23
const LEAF = 0x4f9e4f
const LEAF_DARK = 0x357a35
const SOIL = 0x8a6242
const CROP_FRUIT: Record<string, number> = {
  radish: 0xe86a6a,
  wheat: 0xd9b44a,
  corn: 0xf2c14e,
  pumpkin: 0xe0862f,
}

type PixelMap = readonly string[]

const SEEDLING_PIXELS: PixelMap = ['..g..', '..g..', '.gGg.', '..g..']
const GROWING_PIXELS: PixelMap = ['..g..', '.gGg.', 'gGgGg', '..g..', '..g..']
const CHICKEN_PIXELS: PixelMap = ['..r..', '.www.', 'wwwww', '.www.', '..y..']
const COW_PIXELS: PixelMap = ['.wwww.', 'wwkwww', 'wwwwkw', '.wwww.', '.w..w.']
const PIXEL_PALETTE: Record<string, number> = {
  g: LEAF,
  G: LEAF_DARK,
  r: 0xd9534f,
  w: 0xf7f3e8,
  k: INK,
  y: 0xf2c14e,
}

function drawPixels(
  graphics: PixiGraphicsLike,
  rows: PixelMap,
  palette: Record<string, number>,
  pixel: number,
  offsetX: number,
  offsetY: number,
): void {
  rows.forEach((row, rowIndex) => {
    for (let column = 0; column < row.length; column += 1) {
      const color = palette[row[column]]
      if (color === undefined) continue
      graphics.rect(offsetX + column * pixel, offsetY + rowIndex * pixel, pixel, pixel).fill(color)
    }
  })
}

function drawBorder(
  graphics: PixiGraphicsLike,
  width: number,
  height: number,
  color: number,
  thickness = 2,
): void {
  graphics.rect(0, 0, width, thickness).fill(color)
  graphics.rect(0, height - thickness, width, thickness).fill(color)
  graphics.rect(0, 0, thickness, height).fill(color)
  graphics.rect(width - thickness, 0, thickness, height).fill(color)
}

interface SceneNode {
  container: PixiContainerLike
  graphics: PixiGraphicsLike
  stateKey: string
  anchor: SceneAnchor
}

interface Feedback {
  container: PixiContainerLike
  elapsed: number
  duration: number
  rise: number
}

interface CloudSprite {
  sprite: PixiContainerLike
  lane: number
  speed: number
  baseX: number
}

const PERFORMANCE_WINDOW = 60
const SLOW_FRAME_MS = 40

/**
 * Pixi 渲染适配层：ticker 只推进装饰相位与反馈计时，绝不修改领域状态；
 * 业务形态全部来自 sync 传入的只读 scene model（T09-01/02/08）。
 */
export class FarmSceneRenderer {
  private app: ApplicationLike | null = null
  private readonly nodes = new Map<string, SceneNode>()
  private readonly clouds = new Map<string, CloudSprite>()
  private readonly feedbacks: Feedback[] = []
  private weather: PixiGraphicsLike | null = null
  private sun: PixiGraphicsLike | null = null
  private model: FarmSceneModel | null = null
  private anchors: ReadonlyMap<string, SceneAnchor> = new Map()
  private phase = 0
  private motion: 'full' | 'static' = 'full'
  private hidden = false
  private degraded = false
  private disposed = false
  private width = 0
  private height = 0
  private readonly frameTimes: number[] = []
  private readonly tick = (ticker: { deltaMS: number }): void => this.onTick(ticker.deltaMS)

  constructor(private readonly pixi: FarmPixiModule) {}

  get isDegraded(): boolean {
    return this.degraded
  }

  async init(
    host: HTMLElement,
    options: { width: number; height: number; resolution: number },
  ): Promise<void> {
    const app = new this.pixi.Application()
    await app.init({
      width: options.width,
      height: options.height,
      resolution: options.resolution,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      preference: 'webgl',
    })
    try {
      await this.pixi.Assets.load(FARM_SCENE_ASSETS)
    } catch (error) {
      app.destroy(true, { children: true })
      throw error
    }
    this.app = app
    this.width = options.width
    this.height = options.height
    host.appendChild(app.canvas)
    app.canvas.setAttribute('aria-hidden', 'true')
    app.ticker.add(this.tick)
    this.buildEnvironment()
    this.applyMotion()
  }

  sync(model: FarmSceneModel, anchors: ReadonlyMap<string, SceneAnchor>): void {
    this.model = model
    this.anchors = anchors
    if (!this.app) return

    const wanted = new Set<string>()
    for (const plot of model.plots) {
      wanted.add(plot.id)
      this.ensureNode(
        plot.id,
        `${plot.stage}:${plot.cropId}:${plot.selected}`,
        (graphics, anchor) => {
          const pixel = Math.max(2, Math.min(5, Math.floor(anchor.width / 14)))
          const centerX = (anchor.width - 5 * pixel) / 2
          const baseY = anchor.height - 6 * pixel
          graphics.rect(0, anchor.height - pixel * 2, anchor.width, pixel * 2).fill(SOIL)
          if (plot.stage === 'seedling') {
            drawPixels(graphics, SEEDLING_PIXELS, PIXEL_PALETTE, pixel, centerX, baseY + pixel)
          } else if (plot.stage === 'growing' || plot.stage === 'ready') {
            drawPixels(graphics, GROWING_PIXELS, PIXEL_PALETTE, pixel, centerX, baseY)
            if (plot.stage === 'ready') {
              graphics
                .rect(centerX + pixel, baseY - pixel, pixel * 3, pixel * 2)
                .fill(CROP_FRUIT[plot.cropId ?? 'radish'] ?? CROP_FRUIT.radish)
            }
          }
          if (plot.selected) drawBorder(graphics, anchor.width, anchor.height, INK)
        },
      )
    }
    for (const animal of model.animals) {
      wanted.add(animal.id)
      this.ensureNode(
        animal.id,
        `${animal.kind}:${animal.state}:${animal.selected}`,
        (graphics, anchor) => {
          const map = animal.kind === 'chicken' ? CHICKEN_PIXELS : COW_PIXELS
          const pixel = Math.max(2, Math.min(5, Math.floor(anchor.width / 12)))
          drawPixels(
            graphics,
            map,
            PIXEL_PALETTE,
            pixel,
            (anchor.width - map[0].length * pixel) / 2,
            anchor.height - map.length * pixel - 2,
          )
          if (animal.state === 'ready') {
            graphics
              .circle(anchor.width - pixel * 2, pixel * 2, pixel)
              .fill(animal.kind === 'chicken' ? 0xf7f3e8 : 0xdfe8f5)
          }
          if (animal.selected) drawBorder(graphics, anchor.width, anchor.height, INK)
        },
      )
    }
    for (const building of [...model.buildings, model.processing]) {
      wanted.add(building.id)
      const stateKey =
        'kind' in building
          ? `${building.kind}:${building.level}:${building.hasReadyProduct}`
          : `${building.state}:${building.pendingQuantity}`
      this.ensureNode(building.id, stateKey, (graphics, anchor) => {
        const unit = Math.max(2, Math.floor(anchor.width / 12))
        if ('kind' in building) {
          const roof = building.kind === 'chickenCoop' ? 0xd9534f : 0x8a6242
          graphics.rect(0, unit * 2, anchor.width, anchor.height - unit * 2).fill(0xf0e6d2)
          graphics.rect(0, 0, anchor.width, unit * 2).fill(building.level === 0 ? 0xb9b0a1 : roof)
          graphics
            .rect(anchor.width / 2 - unit, anchor.height - unit * 3, unit * 2, unit * 3)
            .fill(INK)
          if (building.level >= 2) graphics.rect(unit, unit * 3, unit * 2, unit * 2).fill(0x9fc6e8)
        } else {
          const body =
            building.state === 'locked'
              ? 0xb9b0a1
              : building.state === 'unpurchased'
                ? 0xd8cdb8
                : 0xcfd6dd
          graphics.rect(0, unit, anchor.width, anchor.height - unit).fill(body)
          graphics.rect(0, 0, anchor.width, unit).fill(0x6b7480)
          graphics
            .circle(anchor.width / 2, anchor.height / 2, unit * 1.5)
            .fill(building.state === 'ready' ? 0xffd75e : 0x6b7480)
          if (building.state === 'ready') {
            graphics
              .rect(anchor.width - unit * 3, anchor.height - unit * 3, unit * 2, unit * 2)
              .fill(0xf7f3e8)
          }
        }
      })
    }
    for (const [id, node] of this.nodes) {
      if (wanted.has(id)) continue
      node.container.destroy({ children: true })
      this.nodes.delete(id)
    }

    if (this.sun) this.sun.alpha = 0.25 + model.environment.daylight * 0.5
    this.ensureClouds(model)
    if (this.weather) {
      this.weather.visible =
        model.environment.weather === 'drizzle' && !this.degraded && this.motion === 'full'
    }
  }

  setMotionMode(mode: 'full' | 'static'): void {
    this.motion = mode
    this.applyMotion()
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden
    this.applyMotion()
    // 返回前台直接同步当前业务快照，不逐帧补播离线动画（T09-08）
    if (!hidden && this.model) this.sync(this.model, this.anchors)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.app?.renderer.resize(width, height)
    this.layoutEnvironment()
  }

  /** 只在保存成功后由视图调用；静态模式不播放动画，文字反馈由 DOM 承担（T09-07） */
  playFeedback(id: string, kind: FarmFeedbackKind): void {
    if (!this.app || this.motion === 'static') return
    const anchor = this.anchors.get(id)
    if (!anchor || anchor.width === 0) return
    const container = new this.pixi.Container()
    const sparkle = new this.pixi.Sprite(this.pixi.Assets.get('farm-sparkle'))
    sparkle.anchor?.set(0.5)
    sparkle.position.set(anchor.width / 2, anchor.height / 2)
    container.addChild(sparkle)
    const label = new this.pixi.Text({
      text: FEEDBACK_LABELS[kind],
      style: new this.pixi.TextStyle({ fontFamily: 'monospace', fontSize: 12, fill: INK }),
    })
    label.anchor?.set(0.5)
    label.position.set(anchor.width / 2, anchor.height / 4)
    container.addChild(label)
    container.position.set(anchor.x, anchor.y)
    this.app.stage.addChild(container)
    this.feedbacks.push({ container, elapsed: 0, duration: 900, rise: 14 })
  }

  playCoins(amount: number): void {
    if (!this.app || this.motion === 'static' || amount === 0) return
    const text = new this.pixi.Text({
      text: `${amount > 0 ? '+' : ''}${amount} 金币`,
      style: new this.pixi.TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: amount > 0 ? 0x2f7a35 : 0xa34a2a,
      }),
    })
    text.anchor?.set(0.5)
    text.position.set(this.width / 2, 18)
    const container = new this.pixi.Container()
    container.addChild(text)
    this.app.stage.addChild(container)
    this.feedbacks.push({ container, elapsed: 0, duration: 1100, rise: 10 })
  }

  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    const app = this.app
    this.app = null
    if (!app) return
    app.ticker.remove(this.tick)
    app.ticker.stop()
    app.destroy(true, { children: true, texture: true, textureSource: true })
    this.nodes.clear()
    this.clouds.clear()
    this.feedbacks.length = 0
    this.weather = null
    this.sun = null
    this.model = null
    this.frameTimes.length = 0
  }

  private ensureNode(
    id: string,
    stateKey: string,
    draw: (graphics: PixiGraphicsLike, anchor: SceneAnchor) => void,
  ): void {
    const anchor = this.anchors.get(id)
    if (!anchor || anchor.width === 0 || !this.app) return
    let node = this.nodes.get(id)
    if (!node) {
      const container = new this.pixi.Container()
      const graphics = new this.pixi.Graphics()
      container.addChild(graphics)
      this.app.stage.addChild(container)
      node = { container, graphics, stateKey: '', anchor }
      this.nodes.set(id, node)
    }
    node.anchor = anchor
    node.container.position.set(anchor.x, anchor.y)
    if (node.stateKey !== stateKey) {
      node.stateKey = stateKey
      node.graphics.clear()
      draw(node.graphics, anchor)
    }
  }

  private buildEnvironment(): void {
    if (!this.app) return
    this.sun = new this.pixi.Graphics()
    this.sun.circle(0, 0, 14).fill(0xffd75e)
    this.app.stage.addChild(this.sun)
    this.weather = new this.pixi.Graphics()
    for (let index = 0; index < 12; index += 1) {
      this.weather.rect(index * 24, (index % 3) * 18, 2, 8).fill(0x9fc6e8)
    }
    this.weather.alpha = 0.5
    this.app.stage.addChild(this.weather)
    this.layoutEnvironment()
  }

  private ensureClouds(model: FarmSceneModel): void {
    if (!this.app) return
    const texture = this.pixi.Assets.get('farm-cloud')
    for (const cloud of model.environment.clouds) {
      if (this.clouds.has(cloud.id)) continue
      const sprite = new this.pixi.Sprite(texture)
      sprite.scale.set(cloud.scale)
      this.app.stage.addChild(sprite)
      this.clouds.set(cloud.id, { sprite, lane: cloud.lane, speed: cloud.speed, baseX: 0 })
    }
    let index = 0
    for (const cloud of this.clouds.values()) {
      cloud.sprite.visible = !this.degraded || index === 0
      index += 1
    }
    this.layoutEnvironment()
  }

  private layoutEnvironment(): void {
    this.sun?.position.set(this.width - 36, 30)
    let index = 0
    for (const cloud of this.clouds.values()) {
      cloud.baseX = (this.width / Math.max(1, this.clouds.size)) * index
      cloud.sprite.position.set(cloud.baseX, this.height * cloud.lane)
      index += 1
    }
    this.weather?.position.set(0, 0)
  }

  private applyMotion(): void {
    if (!this.app) return
    if (this.motion === 'static' || this.hidden) {
      this.app.ticker.stop()
      for (const node of this.nodes.values()) {
        node.container.rotation = 0
        node.container.alpha = 1
      }
      if (this.weather) this.weather.visible = false
      return
    }
    this.app.ticker.start()
    if (this.model) this.sync(this.model, this.anchors)
  }

  private onTick(deltaMS: number): void {
    this.phase += deltaMS
    this.trackPerformance(deltaMS)
    for (const cloud of this.clouds.values()) {
      const span = this.width + 80
      const x = (cloud.baseX + (this.phase / 1000) * cloud.speed) % span
      cloud.sprite.position.set(x - 40, this.height * cloud.lane)
    }
    if (this.weather?.visible) this.weather.position.set(0, (this.phase / 40) % 18)
    for (const [id, node] of this.nodes) {
      if (id.startsWith('plot:')) {
        node.container.rotation = Math.sin(this.phase / 900 + node.anchor.x) * 0.03
      } else if (id.startsWith('animal:')) {
        node.container.position.set(
          node.anchor.x + Math.sin(this.phase / 700 + node.anchor.y) * 3,
          node.anchor.y,
        )
      }
    }
    for (let index = this.feedbacks.length - 1; index >= 0; index -= 1) {
      const feedback = this.feedbacks[index]
      feedback.elapsed += deltaMS
      const progress = Math.min(1, feedback.elapsed / feedback.duration)
      feedback.container.alpha = 1 - progress
      feedback.container.position.set(
        feedback.container.position.x,
        feedback.container.position.y - (feedback.rise * deltaMS) / feedback.duration,
      )
      if (progress >= 1) {
        feedback.container.destroy({ children: true })
        this.feedbacks.splice(index, 1)
      }
    }
  }

  private trackPerformance(deltaMS: number): void {
    if (this.degraded) return
    this.frameTimes.push(deltaMS)
    if (this.frameTimes.length < PERFORMANCE_WINDOW) return
    const average = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    if (average > SLOW_FRAME_MS) {
      this.degraded = true
      let index = 0
      for (const cloud of this.clouds.values()) {
        cloud.sprite.visible = index === 0
        index += 1
      }
      if (this.weather) this.weather.visible = false
    }
  }
}
