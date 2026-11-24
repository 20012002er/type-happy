import { createResourceFailureLoader } from './resource-failure'

interface ApplicationOptions {
  width?: number
  height?: number
  [key: string]: unknown
}

interface DestroyOptions {
  children?: boolean
}

type AssetRequest = string | { alias: string; src: string }

export function createPixiTestDouble(resources: Record<string, unknown> = {}) {
  class TestDisplayObject {
    readonly position = {
      x: 0,
      y: 0,
      set(x: number, y: number) {
        this.x = x
        this.y = y
      },
    }
    readonly scale = {
      x: 1,
      y: 1,
      set(x: number, y = x) {
        this.x = x
        this.y = y
      },
    }
    readonly anchor = {
      x: 0,
      y: 0,
      set(x: number, y = x) {
        this.x = x
        this.y = y
      },
    }
    alpha = 1
    visible = true
    rotation = 0
    destroyed = false

    destroy() {
      this.destroyed = true
    }
  }

  class TestContainer extends TestDisplayObject {
    readonly children: TestContainer[] = []

    addChild<T extends TestContainer>(child: T): T {
      this.children.push(child)
      return child
    }

    removeChild<T extends TestContainer>(child: T): T {
      const index = this.children.indexOf(child)
      if (index >= 0) this.children.splice(index, 1)
      return child
    }

    removeChildren(): TestContainer[] {
      return this.children.splice(0)
    }
  }

  class TestGraphics extends TestContainer {
    readonly calls: string[] = []

    rect(x: number, y: number, width: number, height: number): this {
      this.calls.push(`rect:${x},${y},${width},${height}`)
      return this
    }

    circle(x: number, y: number, radius: number): this {
      this.calls.push(`circle:${x},${y},${radius}`)
      return this
    }

    fill(color: unknown): this {
      this.calls.push(`fill:${String(color)}`)
      return this
    }

    clear(): this {
      this.calls.push('clear')
      return this
    }
  }

  class TestText extends TestContainer {
    text: string
    constructor(options: { text?: string } = {}) {
      super()
      this.text = options.text ?? ''
    }
  }

  class TestSprite extends TestContainer {
    constructor(readonly texture: unknown) {
      super()
    }
  }

  class TestTextStyle {
    constructor(readonly options: Record<string, unknown> = {}) {}
  }

  class TestTicker {
    started = false
    private readonly callbacks = new Set<(ticker: { deltaMS: number; deltaTime: number }) => void>()

    get listenerCount() {
      return this.callbacks.size
    }

    add(callback: (ticker: { deltaMS: number; deltaTime: number }) => void) {
      this.callbacks.add(callback)
      return this
    }

    remove(callback: (ticker: { deltaMS: number; deltaTime: number }) => void) {
      this.callbacks.delete(callback)
      return this
    }

    start() {
      this.started = true
    }

    tick(deltaMS = 1000 / 60) {
      const ticker = { deltaMS, deltaTime: deltaMS / (1000 / 60) }
      for (const callback of this.callbacks) callback(ticker)
    }

    stop() {
      this.started = false
    }
  }

  class TestApplication {
    readonly canvas = document.createElement('canvas')
    readonly stage = new TestContainer()
    readonly ticker = new TestTicker()
    readonly screen = { width: 0, height: 0 }
    readonly renderer = {
      resize: (width: number, height: number) => this.resize(width, height),
    }
    initialized = false
    destroyed = false
    initOptions: ApplicationOptions | null = null

    async init(options: ApplicationOptions = {}) {
      this.initOptions = { ...options }
      this.initialized = true
      this.destroyed = false
      this.resize(options.width ?? 300, options.height ?? 150)
    }

    resize(width: number, height: number) {
      this.screen.width = width
      this.screen.height = height
      this.canvas.width = width
      this.canvas.height = height
    }

    destroy(removeView = false, options: DestroyOptions = {}) {
      this.destroyed = true
      this.ticker.stop()
      if (options.children) this.stage.removeChildren()
      if (removeView) this.canvas.remove()
    }
  }

  class TestAssets {
    private readonly cache = new Map<string, unknown>()
    private readonly loader = createResourceFailureLoader((uri: string) => {
      if (!Object.hasOwn(resources, uri)) throw new Error(`Missing test resource: ${uri}`)
      return resources[uri]
    })

    failNext(uri: string, error = new Error(`Injected asset failure: ${uri}`)) {
      this.loader.failNext(uri, error)
    }

    get<T = unknown>(key: string): T {
      return this.cache.get(key) as T
    }

    load(request: AssetRequest): Promise<unknown>
    load(requests: readonly AssetRequest[]): Promise<Record<string, unknown>>
    async load(request: AssetRequest | readonly AssetRequest[]): Promise<unknown> {
      if (Array.isArray(request)) {
        const entries = await Promise.all(
          request.map(async (item) => {
            const value = await this.loadOne(item)
            return [typeof item === 'string' ? item : item.alias, value] as const
          }),
        )
        return Object.fromEntries(entries)
      }
      return this.loadOne(request as AssetRequest)
    }

    private async loadOne(request: AssetRequest) {
      const uri = typeof request === 'string' ? request : request.src
      const value = await this.loader.load(uri)
      this.cache.set(uri, value)
      if (typeof request !== 'string') this.cache.set(request.alias, value)
      return value
    }
  }

  return {
    Application: TestApplication,
    Container: TestContainer,
    Graphics: TestGraphics,
    Text: TestText,
    TextStyle: TestTextStyle,
    Sprite: TestSprite,
    Assets: new TestAssets(),
  }
}
