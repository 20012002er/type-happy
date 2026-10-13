<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Application, Container, Sprite, Texture } from 'pixi.js'
import { BoidsSimulation, MAX_BIRDS, MIN_BIRDS } from '../../labs/boids/simulation'

const host = ref<HTMLDivElement | null>(null)
const count = ref(MIN_BIRDS)
const phase = ref<'chaos' | 'merging' | 'flocked'>('chaos')
const percent = ref(0)

const app = shallowRef<Application | null>(null)
let sim: BoidsSimulation | null = null
let texture: Texture | null = null
let birdLayer: Container | null = null
const sprites: Sprite[] = []

/** 白色发光三角形粒子贴图:径向光晕 + 实心燕形三角(朝 +x 方向) */
function createBirdTexture(): Texture {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const glow = ctx.createRadialGradient(24, 24, 0, 24, 24, 22)
    glow.addColorStop(0, 'rgba(255,255,255,0.85)')
    glow.addColorStop(0.35, 'rgba(255,255,255,0.28)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(33, 24)
    ctx.lineTo(15, 14)
    ctx.lineTo(20, 24)
    ctx.lineTo(15, 34)
    ctx.closePath()
    ctx.fill()
  }
  return Texture.from(canvas)
}

function ensureSprites(n: number): void {
  if (!app.value || !birdLayer || !texture) return
  while (sprites.length < n) {
    const s = new Sprite(texture)
    s.anchor.set(0.5)
    s.scale.set(0.6)
    s.blendMode = 'add'
    s.eventMode = 'none'
    birdLayer.addChild(s)
    sprites.push(s)
  }
  for (let i = 0; i < sprites.length; i++) sprites[i].visible = i < n
}

function syncSprites(): void {
  if (!sim) return
  const { px, py, vx, vy, count: n } = sim
  for (let i = 0; i < n; i++) {
    const s = sprites[i]
    s.x = px[i]
    s.y = py[i]
    s.rotation = Math.atan2(vy[i], vx[i])
  }
}

function updatePhase(): void {
  if (!sim) return
  const p = Math.round(sim.cohesion * 100)
  percent.value = p
  phase.value = p < 8 ? 'chaos' : p >= 100 ? 'flocked' : 'merging'
}

function localPoint(e: PointerEvent): { x: number; y: number } | null {
  const canvas = app.value?.canvas
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerMove(e: PointerEvent): void {
  const p = localPoint(e)
  if (p && sim) sim.movePointer(p.x, p.y)
}

function onPointerDown(e: PointerEvent): void {
  const p = localPoint(e)
  if (p && sim) {
    sim.movePointer(p.x, p.y)
    sim.pulse(p.x, p.y)
  }
}

function onPointerLeave(): void {
  sim?.releasePointer()
}

function onWindowResize(): void {
  if (!app.value || !host.value || !sim) return
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  app.value.renderer.resize(w, h)
  sim.resize(w, h)
}

async function boot(): Promise<void> {
  if (!host.value) return
  const application = new Application()
  await application.init({
    width: host.value.clientWidth,
    height: host.value.clientHeight,
    background: '#000000',
    antialias: false,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  })
  host.value.appendChild(application.canvas)
  application.canvas.style.width = '100%'
  application.canvas.style.height = '100%'
  application.canvas.style.display = 'block'
  application.canvas.style.touchAction = 'none'
  app.value = application

  texture = createBirdTexture()
  birdLayer = new Container()
  application.stage.addChild(birdLayer)

  sim = new BoidsSimulation(application.screen.width, application.screen.height, count.value)
  ensureSprites(sim.count)

  application.canvas.addEventListener('pointermove', onPointerMove)
  application.canvas.addEventListener('pointerdown', onPointerDown)
  application.canvas.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('resize', onWindowResize)

  application.ticker.add((ticker) => {
    if (!sim) return
    sim.step(ticker.deltaMS / 1000)
    syncSprites()
    updatePhase()
  })
}

watch(count, (n) => {
  if (!sim) return
  sim.setCount(n)
  ensureSprites(sim.count)
})

function scatter(): void {
  sim?.scatter()
  sim?.releasePointer()
}

onMounted(boot)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  const canvas = app.value?.canvas
  canvas?.removeEventListener('pointermove', onPointerMove)
  canvas?.removeEventListener('pointerdown', onPointerDown)
  canvas?.removeEventListener('pointerleave', onPointerLeave)
  sim = null
  sprites.length = 0
  birdLayer = null
  texture?.destroy(true)
  texture = null
  app.value?.destroy(true, { children: true })
  app.value = null
})
</script>

<template>
  <div class="fixed inset-0 z-30 bg-black text-white">
    <div ref="host" class="absolute inset-0"></div>

    <!-- 顶栏 -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6"
    >
      <div class="pointer-events-auto flex flex-col gap-2">
        <RouterLink
          to="/labs"
          class="inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/15 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          返回实验室
        </RouterLink>
        <div>
          <h1 class="text-lg font-semibold tracking-wide">群鸟算法 · Boids</h1>
          <p class="mt-0.5 text-xs text-white/50">移动鼠标引导鸟群,点击惊散附近的鸟</p>
        </div>
      </div>

      <!-- 集群状态 -->
      <div
        class="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-right backdrop-blur"
        aria-live="polite"
      >
        <div class="text-[11px] uppercase tracking-widest text-white/40">集群进度</div>
        <div class="mt-0.5 text-sm font-semibold tabular-nums">
          <span v-if="phase === 'chaos'" class="text-white/60">混乱个体</span>
          <span v-else-if="phase === 'merging'" class="text-cyan-300">合并中 {{ percent }}%</span>
          <span v-else class="text-emerald-300">已融为一体</span>
        </div>
        <div class="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-white/15">
          <div
            class="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-[width] duration-300"
            :style="{ width: `${percent}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 底部控制条 -->
    <div class="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 sm:p-6">
      <div
        class="pointer-events-auto flex w-full max-w-md items-center gap-4 rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 backdrop-blur"
      >
        <label for="boids-count" class="shrink-0 text-xs text-white/60">鸟群规模</label>
        <input
          id="boids-count"
          v-model.number="count"
          type="range"
          :min="MIN_BIRDS"
          :max="MAX_BIRDS"
          step="10"
          class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
        />
        <span class="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{{ count }}</span>
      </div>
      <div class="pointer-events-auto flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/85 backdrop-blur transition hover:bg-white/15 active:scale-95"
          @click="scatter"
        >
          重新打散
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
  cursor: pointer;
}
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
  cursor: pointer;
}
</style>
