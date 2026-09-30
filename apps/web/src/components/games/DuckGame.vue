<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useKeyGame } from '../../composables/useKeyGame'
import { useElementSize } from '../../composables/useElementSize'
import { useGamesStore } from '../../stores/games'
import GameHud from './GameHud.vue'
import GameOverlay from './GameOverlay.vue'

const GAME_ID = 'duck'
const games = useGamesStore()

const area = ref<HTMLElement | null>(null)
const size = useElementSize(area)

const DUCK_COLORS = [
  { body: '#b45309', wing: '#92400e', head: '#15803d', beak: '#f59e0b', text: '#fff7ed' },
  { body: '#f1f5f9', wing: '#cbd5e1', head: '#e2e8f0', beak: '#fb923c', text: '#0f172a' },
  { body: '#0ea5e9', wing: '#0284c7', head: '#0369a1', beak: '#facc15', text: '#f0f9ff' },
]

const isNewBest = ref(false)

const game = useKeyGame({
  getSize: () => ({ width: size.width.value, height: size.height.value }),
  getSpawnY: (h) => h - 16,
  spawnDelay: (t) => Math.max(540, 1200 - t * 15),
  riseSpeed: (t) => Math.min(158, 58 + t * 2.6),
  swayAmp: (t) => Math.min(30, 14 + t * 0.4),
  swayFreq: 2.1,
  maxConcurrent: 6,
  maxLives: 5,
  variants: DUCK_COLORS.length,
  hitAnimMs: 460,
  escapeTop: -12,
  onGameOver: (stats) => {
    isNewBest.value = games.recordScore(GAME_ID, stats.score, stats.bestCombo)
  },
})

const best = computed(() => games.bestOf(GAME_ID))

function colorOf(variant: number) {
  return DUCK_COLORS[variant % DUCK_COLORS.length]
}

// 草丛锯齿路径(在 script 中生成,避免手写超长 path)
const grassPath = (() => {
  const spikes = 44
  const w = 100
  const h = 34
  let d = `M0 ${h} L0 ${(h * 0.55).toFixed(1)}`
  for (let i = 0; i < spikes; i++) {
    const x1 = ((i + 0.5) / spikes) * w
    const x2 = ((i + 1) / spikes) * w
    const tipY = 3 + (i % 4) * 5
    d += ` L${x1.toFixed(2)} ${tipY} L${x2.toFixed(2)} ${(h * 0.55).toFixed(1)}`
  }
  d += ` L${w} ${h} Z`
  return d
})()

// 漏掉:红闪 + 抖动
const missFlash = ref(false)
const shaking = ref(false)
let missTimer: ReturnType<typeof setTimeout> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
watch(game.missSignal, () => {
  missFlash.value = true
  shaking.value = true
  if (missTimer) clearTimeout(missTimer)
  if (shakeTimer) clearTimeout(shakeTimer)
  missTimer = setTimeout(() => (missFlash.value = false), 600)
  shakeTimer = setTimeout(() => (shaking.value = false), 320)
})

// 击中:枪口火光 + 后坐
const muzzle = ref(false)
let muzzleTimer: ReturnType<typeof setTimeout> | null = null
watch(game.lastPress, (p) => {
  if (p && p.hit) {
    muzzle.value = true
    if (muzzleTimer) clearTimeout(muzzleTimer)
    muzzleTimer = setTimeout(() => (muzzle.value = false), 200)
  }
})

// 按错键:红色描边
const wrongFlash = ref(false)
let wrongTimer: ReturnType<typeof setTimeout> | null = null
watch(game.lastPress, (p) => {
  if (p && !p.hit) {
    wrongFlash.value = true
    if (wrongTimer) clearTimeout(wrongTimer)
    wrongTimer = setTimeout(() => (wrongFlash.value = false), 260)
  }
})

watch(game.status, (s) => {
  if (s === 'running') isNewBest.value = false
})

const howTo = [
  '鸭子从草丛里随机飞出,身上带一个键位。',
  '按下对应键位,猎人开枪击落鸭子,+1 分。',
  '鸭子飞出屏幕顶部,-1 分并损失一颗心。',
  '五颗心用完游戏结束,挑战你的最高分!',
]
</script>

<template>
  <div
    ref="area"
    class="relative h-[62vh] max-h-[640px] min-h-[430px] w-full select-none overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-300 via-sky-100 to-lime-50 shadow-sm"
    :class="shaking ? 'game-shake' : ''"
  >
    <!-- 太阳 + 云 -->
    <div class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div class="absolute right-8 top-6 h-14 w-14 rounded-full bg-yellow-300/80 blur-[1px]" />
      <div
        class="cloud-drift absolute top-[16%] h-9 w-24 rounded-full bg-white/70 blur-[2px]"
        style="animation-duration: 44s"
      />
      <div
        class="cloud-drift absolute top-[34%] h-7 w-20 rounded-full bg-white/60 blur-[2px]"
        style="animation-duration: 58s; animation-delay: -20s"
      />
    </div>

    <!-- 顶部危险区提示 -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10 h-16"
      style="background: linear-gradient(to bottom, rgba(244, 63, 94, 0.25), transparent)"
    />

    <!-- 鸭子 -->
    <div
      v-for="t in game.targets.value"
      :key="t.id"
      class="absolute left-0 top-0 z-10 will-change-transform"
      :style="{ transform: `translate3d(${t.x}px, ${t.y}px, 0)` }"
    >
      <div
        :class="t.hit ? 'duck-fall' : ''"
        :style="t.hit ? undefined : { transform: 'translate(-50%, -50%)' }"
      >
        <svg viewBox="0 0 78 62" class="h-[52px] w-[66px] drop-shadow" aria-hidden="true">
          <!-- 身体 -->
          <ellipse cx="34" cy="40" rx="26" ry="17" :fill="colorOf(t.variant).body" />
          <!-- 尾羽 -->
          <path d="M9 38 L-2 32 L0 42 L-2 48 Z" :fill="colorOf(t.variant).wing" />
          <!-- 翅膀(扇动) -->
          <ellipse
            class="duck-flap"
            cx="34"
            cy="34"
            rx="16"
            ry="9"
            :fill="colorOf(t.variant).wing"
          />
          <!-- 头 -->
          <circle cx="58" cy="22" r="12" :fill="colorOf(t.variant).head" />
          <!-- 喙 -->
          <path d="M68 22 L80 25 L68 29 Z" :fill="colorOf(t.variant).beak" />
          <!-- 眼 -->
          <circle cx="61" cy="19" r="3.4" fill="#ffffff" />
          <circle cx="62" cy="19" r="1.7" fill="#0f172a" />
          <!-- 键位 -->
          <text
            x="32"
            y="42"
            font-size="19"
            font-weight="800"
            text-anchor="middle"
            dominant-baseline="middle"
            :fill="colorOf(t.variant).text"
            style="font-family: ui-monospace, Menlo, Consolas, monospace"
          >
            {{ t.key.toUpperCase() }}
          </text>
        </svg>
      </div>
    </div>

    <!-- 击中/漏掉 特效 -->
    <div
      v-for="e in game.effects.value"
      :key="e.id"
      class="pointer-events-none absolute left-0 top-0 z-20"
      :style="{ transform: `translate3d(${e.x}px, ${e.y}px, 0)` }"
    >
      <template v-if="e.kind === 'pop'">
        <div class="game-burst absolute h-14 w-14 rounded-full border-4 border-amber-200" />
        <div class="game-float absolute text-xl font-black text-emerald-500 drop-shadow">+1</div>
      </template>
      <template v-else>
        <div class="game-float absolute text-xl font-black text-rose-500 drop-shadow">-1</div>
      </template>
    </div>

    <!-- 前景:猎人 + 草丛 -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-30">
      <!-- 猎人 -->
      <div
        class="absolute bottom-8 left-1/2"
        :style="{ transform: muzzle ? 'translate(-50%, 3px)' : 'translate(-50%, 0)' }"
      >
        <svg viewBox="0 0 120 160" class="h-36 w-[108px] drop-shadow-lg" aria-hidden="true">
          <!-- 枪(先画,位于身后部分) -->
          <line
            x1="56"
            y1="116"
            x2="92"
            y2="26"
            stroke="#1f2937"
            stroke-width="7"
            stroke-linecap="round"
          />
          <line
            x1="58"
            y1="112"
            x2="90"
            y2="32"
            stroke="#4b5563"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <!-- 身体 -->
          <path d="M38 160 L38 100 Q38 82 60 82 Q82 82 82 100 L82 160 Z" fill="#4d7c0f" />
          <path d="M38 100 Q60 92 82 100 L82 112 Q60 104 38 112 Z" fill="#3f6212" />
          <!-- 手臂 -->
          <line
            x1="46"
            y1="100"
            x2="70"
            y2="86"
            stroke="#4d7c0f"
            stroke-width="9"
            stroke-linecap="round"
          />
          <line
            x1="74"
            y1="104"
            x2="84"
            y2="56"
            stroke="#4d7c0f"
            stroke-width="9"
            stroke-linecap="round"
          />
          <circle cx="70" cy="86" r="5" fill="#f6c99b" />
          <circle cx="84" cy="55" r="5" fill="#f6c99b" />
          <!-- 头 -->
          <circle cx="60" cy="60" r="19" fill="#f6c99b" />
          <circle cx="53" cy="60" r="2.2" fill="#334155" />
          <circle cx="67" cy="60" r="2.2" fill="#334155" />
          <path d="M54 68 Q60 72 66 68" stroke="#b45309" stroke-width="2" fill="none" />
          <!-- 帽子 -->
          <path d="M43 50 Q60 26 77 50 Z" fill="#92400e" />
          <ellipse cx="60" cy="50" rx="30" ry="7" fill="#78350f" />
        </svg>
        <!-- 枪口火光 -->
        <div v-if="muzzle" class="muzzle-flash absolute left-[76%] top-[10%] -ml-5 -mt-5 h-10 w-10">
          <svg viewBox="0 0 40 40" class="h-full w-full">
            <path
              d="M20 0 L24 14 L38 12 L27 20 L36 32 L22 26 L20 40 L18 26 L4 32 L13 20 L2 12 L16 14 Z"
              fill="#fde047"
            />
            <circle cx="20" cy="20" r="6" fill="#fff7ed" />
          </svg>
        </div>
      </div>

      <!-- 草丛 -->
      <div class="relative h-24 w-full">
        <svg
          viewBox="0 0 100 34"
          preserveAspectRatio="none"
          class="grass-sway absolute -top-6 left-0 h-9 w-full"
        >
          <path :d="grassPath" fill="#16a34a" />
        </svg>
        <div class="absolute inset-0 bg-gradient-to-b from-green-600 to-green-800" />
        <svg
          viewBox="0 0 100 34"
          preserveAspectRatio="none"
          class="grass-sway absolute -top-3 left-0 h-7 w-full opacity-90"
          style="animation-delay: -1.5s"
        >
          <path :d="grassPath" fill="#15803d" />
        </svg>
      </div>
    </div>

    <!-- 漏掉红闪 -->
    <div
      v-if="missFlash"
      class="game-miss-flash pointer-events-none absolute inset-x-0 top-0 z-20 h-28"
      style="background: linear-gradient(to bottom, rgba(244, 63, 94, 0.6), transparent)"
    />
    <!-- 按错键描边 -->
    <div
      v-if="wrongFlash"
      class="game-miss-flash pointer-events-none absolute inset-0 z-20 rounded-2xl"
      style="box-shadow: inset 0 0 0 3px rgba(244, 63, 94, 0.65)"
    />

    <GameHud
      :score="game.score.value"
      :combo="game.combo.value"
      :best-combo="game.bestCombo.value"
      :lives="game.lives.value"
      :max-lives="game.maxLives"
      :popped="game.popped.value"
      :missed="game.missed.value"
      :status="game.status.value"
      @pause="game.togglePause()"
      @restart="game.restart()"
    />

    <GameOverlay
      :status="game.status.value"
      title="打字打鸭子"
      :how-to="howTo"
      :score="game.score.value"
      :popped="game.popped.value"
      :missed="game.missed.value"
      :best-combo="game.bestCombo.value"
      :elapsed="game.elapsed.value"
      :best="best"
      :is-new-best="isNewBest"
      @start="game.start()"
      @resume="game.resume()"
      @restart="game.restart()"
    />
  </div>
</template>
