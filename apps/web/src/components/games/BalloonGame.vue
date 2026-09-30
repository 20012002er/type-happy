<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useKeyGame } from '../../composables/useKeyGame'
import { useElementSize } from '../../composables/useElementSize'
import { useGamesStore } from '../../stores/games'
import GameHud from './GameHud.vue'
import GameOverlay from './GameOverlay.vue'

const GAME_ID = 'balloon'
const games = useGamesStore()

const area = ref<HTMLElement | null>(null)
const size = useElementSize(area)

const BALLOON_COLORS = [
  { body: '#fb7185', shade: '#e11d48', text: '#ffffff' },
  { body: '#fb923c', shade: '#ea580c', text: '#ffffff' },
  { body: '#facc15', shade: '#eab308', text: '#713f12' },
  { body: '#4ade80', shade: '#16a34a', text: '#052e16' },
  { body: '#38bdf8', shade: '#0284c7', text: '#082f49' },
  { body: '#818cf8', shade: '#4f46e5', text: '#ffffff' },
  { body: '#e879f9', shade: '#c026d3', text: '#ffffff' },
]

const isNewBest = ref(false)

const game = useKeyGame({
  getSize: () => ({ width: size.width.value, height: size.height.value }),
  getSpawnY: (h) => h + 34,
  spawnDelay: (t) => Math.max(520, 1250 - t * 16),
  riseSpeed: (t) => Math.min(150, 52 + t * 2.4),
  swayAmp: (t) => Math.min(18, 6 + t * 0.25),
  swayFreq: 1.3,
  maxConcurrent: 7,
  maxLives: 5,
  variants: BALLOON_COLORS.length,
  escapeTop: -12,
  onGameOver: (stats) => {
    isNewBest.value = games.recordScore(GAME_ID, stats.score, stats.bestCombo)
  },
})

const best = computed(() => games.bestOf(GAME_ID))

function colorOf(variant: number) {
  return BALLOON_COLORS[variant % BALLOON_COLORS.length]
}

// 漏掉目标:红闪 + 抖动
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

// 按错键:红色描边闪一下
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
  '气球从底部升起,每个气球上有一个键位。',
  '按下对应键位即可扎破气球,+1 分。',
  '气球飘到顶部未破,-1 分并损失一颗心。',
  '五颗心用完游戏结束,挑战你的最高分!',
]
</script>

<template>
  <div
    ref="area"
    class="relative h-[62vh] max-h-[640px] min-h-[430px] w-full select-none overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-400 via-sky-200 to-indigo-50 shadow-sm"
    :class="shaking ? 'game-shake' : ''"
  >
    <!-- 装饰云朵 -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="cloud-drift absolute top-[12%] h-10 w-24 rounded-full bg-white/70 blur-[2px]"
        style="animation-duration: 38s"
      />
      <div
        class="cloud-drift absolute top-[30%] h-8 w-20 rounded-full bg-white/60 blur-[2px]"
        style="animation-duration: 52s; animation-delay: -12s"
      />
      <div
        class="cloud-drift absolute top-[52%] h-12 w-28 rounded-full bg-white/50 blur-[3px]"
        style="animation-duration: 64s; animation-delay: -30s"
      />
    </div>

    <!-- 顶部危险区提示 -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10 h-16"
      style="background: linear-gradient(to bottom, rgba(244, 63, 94, 0.28), transparent)"
    />

    <!-- 气球 -->
    <div
      v-for="t in game.targets.value"
      :key="t.id"
      class="absolute left-0 top-0 will-change-transform"
      :style="{ transform: `translate3d(${t.x}px, ${t.y}px, 0)` }"
    >
      <div
        :class="t.hit ? 'game-pop' : ''"
        :style="t.hit ? undefined : { transform: 'translate(-50%, -50%)' }"
      >
        <svg viewBox="0 0 64 94" class="h-[74px] w-[52px] drop-shadow-md" aria-hidden="true">
          <path
            d="M32 68 C 27 76, 37 82, 32 92"
            stroke="#94a3b8"
            stroke-width="1.6"
            fill="none"
            stroke-linecap="round"
          />
          <path d="M32 60 l5 8 h-10 z" :fill="colorOf(t.variant).shade" />
          <ellipse cx="32" cy="34" rx="24" ry="30" :fill="colorOf(t.variant).body" />
          <ellipse cx="23" cy="23" rx="6" ry="9" fill="#ffffff" opacity="0.38" />
          <text
            x="32"
            y="36"
            font-size="27"
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
      class="pointer-events-none absolute left-0 top-0"
      :style="{ transform: `translate3d(${e.x}px, ${e.y}px, 0)` }"
    >
      <template v-if="e.kind === 'pop'">
        <div class="game-burst absolute h-14 w-14 rounded-full border-4 border-emerald-300" />
        <div class="game-float absolute text-xl font-black text-emerald-400 drop-shadow">+1</div>
      </template>
      <template v-else>
        <div class="game-float absolute text-xl font-black text-rose-500 drop-shadow">-1</div>
      </template>
    </div>

    <!-- 漏掉红闪 -->
    <div
      v-if="missFlash"
      class="game-miss-flash pointer-events-none absolute inset-x-0 top-0 z-10 h-28"
      style="background: linear-gradient(to bottom, rgba(244, 63, 94, 0.6), transparent)"
    />
    <!-- 按错键描边 -->
    <div
      v-if="wrongFlash"
      class="game-miss-flash pointer-events-none absolute inset-0 z-10 rounded-2xl"
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
      title="打字消气球"
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
