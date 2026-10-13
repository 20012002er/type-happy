<script setup lang="ts">
import { onBeforeUnmount, onMounted, computed, reactive, ref, shallowRef } from 'vue'
import { Application, Assets } from 'pixi.js'
import { DoodleGame, type GameResult } from '../../games/doodle-jump/game'
import { RunTracker, missionRequired, selectMissions, type MissionDef } from '../../games/doodle-jump/trackers'
import { loadSave, persistSave, type DoodleSave } from '../../games/doodle-jump/save'
import { audio } from '../../games/doodle-jump/audio'
import { WORLD_H, WORLD_W, type GameEvent } from '../../games/doodle-jump/constants'
import { useGamesStore } from '../../stores/games'

const BASE = '/games/doodle/'
const host = ref<HTMLDivElement | null>(null)
const screen = ref<'menu' | 'playing' | 'over' | 'options' | 'scores' | 'missions'>('menu')
const result = ref<GameResult | null>(null)
const save = reactive<DoodleSave>(loadSave())
const tutorialStep = ref(-1)
const gamesStore = useGamesStore()

const app = shallowRef<Application | null>(null)
const game = shallowRef<DoodleGame | null>(null)
let tracker: RunTracker | null = null
let missions: MissionDef[] = []
let missionStrings: Record<string, string[]> = {}
let achStrings: Record<string, string[]> = {}
let statsStrings: Record<string, string> = {}
let genericStrings: Record<string, string> = {}
let tutorialStrings: Record<string, string> = {}
let tutorialTimers: number[] = []

function persist(): void {
  persistSave(save)
}

function missionDefs(raw: { missions: (string | Record<string, unknown>)[] }): MissionDef[] {
  const out: MissionDef[] = []
  for (let i = 0; i < raw.missions.length; i += 2) {
    const id = raw.missions[i]
    const def = raw.missions[i + 1] as Record<string, unknown>
    if (typeof id === 'string' && def) {
      out.push({
        id,
        type: String(def.type),
        descriptions: String(def.descriptions ?? ''),
        data: (def.data as Record<string, unknown>) ?? {},
      })
    }
  }
  return out
}

function missionById(id: string): MissionDef | undefined {
  return missions.find((m) => m.id === id)
}

function missionLabel(id: string): string {
  const def = missionById(id)
  if (!def) return id
  const tpl = missionStrings[def.descriptions]?.[0] ?? def.descriptions
  const req = missionRequired(def)
  return tpl.replace('%d', String(req)).replace('{s}', req > 1 ? 's' : '')
}

async function boot(): Promise<void> {
  if (!host.value) return
  const application = new Application()
  await application.init({
    width: WORLD_W,
    height: WORLD_H,
    background: '#fbfaf4',
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  })
  host.value.appendChild(application.canvas)
  application.canvas.style.width = '100%'
  application.canvas.style.height = '100%'
  application.canvas.style.objectFit = 'contain'
  app.value = application

  await Assets.load([
    { alias: 'gametiles', src: BASE + 'atlas/gametiles.json' },
    { alias: 'projectiles', src: BASE + 'atlas/projectiles.json' },
    { alias: 'topscore_X.png', src: BASE + 'img/topscore_X.png' },
    { alias: 'likleft_X.png', src: BASE + 'img/likleft_X.png' },
    { alias: 'likright_X.png', src: BASE + 'img/likright_X.png' },
    { alias: 'likpuca_X.png', src: BASE + 'img/likpuca_X.png' },
    { alias: 'jetpack_X.png', src: BASE + 'img/jetpack_X.png' },
    { alias: 'propeller_X.png', src: BASE + 'img/propeller_X.png' },
    { alias: 'shield_X.png', src: BASE + 'img/shield_X.png' },
    { alias: 'springshoesup_X.png', src: BASE + 'img/springshoesup_X.png' },
  ])

  const [font, missionsRaw, ms, as, ss, gs, ts] = await Promise.all([
    fetch(BASE + 'data/doodlejumpfont.json').then((r) => r.json()),
    fetch(BASE + 'data/game_missions.json').then((r) => r.json()),
    fetch(BASE + 'data/mission_strings.json').then((r) => r.json()),
    fetch(BASE + 'data/achs_strings.json').then((r) => r.json()),
    fetch(BASE + 'data/stats_strings.json').then((r) => r.json()),
    fetch(BASE + 'data/generic_strings.json').then((r) => r.json()),
    fetch(BASE + 'data/tutorial_strings.json').then((r) => r.json()),
  ])
  missions = missionDefs(missionsRaw)
  missionStrings = ms
  achStrings = as
  statsStrings = ss
  genericStrings = gs
  tutorialStrings = ts

  if (save.activeMissions.length === 0) {
    save.activeMissions = selectMissions(missions, save)
    persist()
  }

  const g = new DoodleGame(application, font, {
    onEvent: (e: GameEvent) => tracker?.event(e, g.score),
    onScore: () => undefined,
    onGameOver: (r) => finishRun(r),
  })
  game.value = g
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__doodle = { game: g, save, screen }
  }
  application.ticker.add((t) => g.update(Math.min(0.033, t.deltaMS / 1000)))
  bindInput(application)
}

function startRun(): void {
  audio.enabled = save.settings.sound
  if (game.value) game.value.directional = save.settings.directionalShooting
  tracker = new RunTracker(save, missions, persist)
  screen.value = 'playing'
  result.value = null
  game.value?.start()
  tutorialTimers.forEach((t) => window.clearTimeout(t))
  tutorialTimers = []
  if (!save.tutorialSeen) {
    tutorialStep.value = 0
    tutorialTimers.push(window.setTimeout(() => (tutorialStep.value = 1), 2500))
    tutorialTimers.push(window.setTimeout(() => (tutorialStep.value = 2), 6000))
    tutorialTimers.push(window.setTimeout(() => (tutorialStep.value = -1), 10000))
  }
}

function finishRun(r: GameResult): void {
  tutorialTimers.forEach((t) => window.clearTimeout(t))
  tutorialTimers = []
  tracker?.endRun(r)
  save.tutorialSeen = true
  tutorialStep.value = -1
  const done = save.activeMissions.filter((id) => save.missions[id]?.done)
  if (done.length > 0) {
    save.activeMissions = selectMissions(missions, save)
  }
  persist()
  gamesStore.recordScore('doodle', r.score, 0)
  result.value = r
  screen.value = 'over'
}

let pointerDown = false
let pointerMoved = 0
let pointerStart = { x: 0, y: 0 }

function bindInput(application: Application): void {
  const canvas = application.canvas
  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true
    pointerMoved = 0
    pointerStart = { x: e.clientX, y: e.clientY }
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!pointerDown) return
    const dx = e.clientX - pointerStart.x
    pointerMoved = Math.max(pointerMoved, Math.abs(dx))
    game.value?.setAxis(dx / 40)
  })
  canvas.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
}

function onPointerUp(): void {
  if (pointerDown && pointerMoved < 8) game.value?.shoot()
  pointerDown = false
  game.value?.setAxis(0)
}

function onDirectionalChange(): void {
  persist()
  if (game.value) game.value.directional = save.settings.directionalShooting
}

function onKey(e: KeyboardEvent): void {
  if (screen.value !== 'playing') return
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') game.value?.setAxis(-1)
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') game.value?.setAxis(1)
  else if (e.key === ' ' || e.key === 'ArrowUp') {
    e.preventDefault()
    game.value?.shoot()
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
    game.value?.setAxis(0)
}

onMounted(() => {
  void boot()
})

onBeforeUnmount(() => {
  tutorialTimers.forEach((t) => window.clearTimeout(t))
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
  game.value?.destroy()
  void app.value?.destroy(true)
})

const stats = save.stats.original
const unlockedAchs = computed(() => Object.keys(save.achievements).filter((k) => save.achievements[k]))
</script>

<template>
  <div class="relative mx-auto aspect-[2/3] w-full max-w-[420px] overflow-hidden rounded-xl border border-slate-200 bg-[#fbfaf4] shadow-sm">
    <div ref="host" class="absolute inset-0" />

    <div v-if="tutorialStep >= 0" class="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
      <span class="rounded bg-black/60 px-3 py-1 text-sm text-white">{{ tutorialStrings[String(tutorialStep)] }}</span>
    </div>

    <div v-if="screen === 'menu'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#fbfaf4]/95 p-6">
      <h2 class="text-3xl font-bold text-lime-700">doodle jump</h2>
      <p class="text-xs text-slate-500">web 重制版 · 数据仅存本机</p>
      <button class="w-40 rounded-lg bg-lime-600 py-2 font-semibold text-white hover:bg-lime-500" @click="startRun">
        {{ genericStrings.PLAY ?? 'play' }}
      </button>
      <button class="w-40 rounded-lg bg-slate-200 py-2 text-slate-700 hover:bg-slate-300" @click="screen = 'missions'">
        {{ genericStrings.MISSIONS ?? 'missions' }}
      </button>
      <button class="w-40 rounded-lg bg-slate-200 py-2 text-slate-700 hover:bg-slate-300" @click="screen = 'scores'">
        {{ genericStrings.SCORES_BTN ?? 'scores' }}
      </button>
      <button class="w-40 rounded-lg bg-slate-200 py-2 text-slate-700 hover:bg-slate-300" @click="screen = 'options'">
        {{ genericStrings.OPTIONS ?? 'options' }}
      </button>
    </div>

    <div v-else-if="screen === 'over' && result" class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-6 text-white">
      <h3 class="text-2xl font-bold">{{ genericStrings.GAMEOVER_SCORE ?? 'your score:' }} {{ result.score }}</h3>
      <p class="text-sm opacity-80">{{ genericStrings.GAMEOVER_HIGHSCORE ?? 'high score:' }} {{ stats?.highScore ?? 0 }}</p>
      <p class="text-xs opacity-60">
        {{ result.jumps }} jumps · {{ result.time.toFixed(1) }}s · {{ result.cause }}
      </p>
      <button class="mt-3 w-40 rounded-lg bg-lime-600 py-2 font-semibold hover:bg-lime-500" @click="startRun">
        {{ genericStrings.PLAYAGAIN ?? 'play again' }}
      </button>
      <button class="w-40 rounded-lg bg-slate-200 py-2 text-slate-700 hover:bg-slate-300" @click="screen = 'menu'">
        {{ genericStrings.MENU ?? 'menu' }}
      </button>
    </div>

    <div v-else-if="screen === 'options'" class="absolute inset-0 flex flex-col gap-3 overflow-y-auto bg-[#fbfaf4]/97 p-5 text-sm">
      <h3 class="text-lg font-bold text-slate-800">{{ genericStrings.OPTIONS ?? 'options' }}</h3>
      <label class="flex items-center justify-between">
        <span>{{ genericStrings.SOUNDS ?? 'sounds' }}</span>
        <input v-model="save.settings.sound" type="checkbox" @change="persist(); audio.enabled = save.settings.sound" />
      </label>
      <label class="flex items-center justify-between">
        <span>{{ genericStrings.DIRECTIONAL ?? 'directional shooting' }}</span>
        <input v-model="save.settings.directionalShooting" type="checkbox" @change="onDirectionalChange" />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span>{{ genericStrings.GAMEOVER_NAME ?? 'your name:' }}</span>
        <input v-model="save.name" class="w-32 rounded border border-slate-300 px-2 py-1" @change="persist" />
      </label>
      <button class="mt-auto rounded-lg bg-slate-200 py-2 text-slate-700 hover:bg-slate-300" @click="screen = 'menu'">
        {{ genericStrings.CLOSE_BTN ?? 'close' }}
      </button>
    </div>

    <div v-else-if="screen === 'scores'" class="absolute inset-0 flex flex-col gap-2 overflow-y-auto bg-[#fbfaf4]/97 p-5 text-xs">
      <h3 class="text-lg font-bold text-slate-800">{{ statsStrings.HIGHSCORES_TITLE ?? 'scores & stats' }}</h3>
      <div v-if="stats" class="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
        <span>{{ statsStrings.HIGH_SCORE }}</span><span class="text-right font-semibold">{{ stats.highScore }}</span>
        <span>{{ statsStrings.LAST_SCORE }}</span><span class="text-right font-semibold">{{ stats.lastScore }}</span>
        <span>{{ statsStrings.TOTAL_GAMES }}</span><span class="text-right font-semibold">{{ stats.plays }}</span>
        <span>{{ statsStrings.AVG_SCORE }}</span><span class="text-right font-semibold">{{ stats.plays ? Math.round(stats.totalScore / stats.plays) : 0 }}</span>
        <span>{{ statsStrings.TOTAL_JUMP }}</span><span class="text-right font-semibold">{{ stats.totalJumps }}</span>
        <span>{{ statsStrings.MAX_JUMP }}</span><span class="text-right font-semibold">{{ stats.maxJumps }}</span>
        <span>{{ statsStrings.LONG_TIME }}</span><span class="text-right font-semibold">{{ stats.longestTime.toFixed(0) }}s</span>
        <span>{{ statsStrings.MONS_SHOT }}</span><span class="text-right font-semibold">{{ stats.monstersShot }}</span>
        <span>{{ statsStrings.MONS_JUMP }}</span><span class="text-right font-semibold">{{ stats.monstersJumped }}</span>
        <span>{{ statsStrings.JETPACK }}</span><span class="text-right font-semibold">{{ stats.jetpackFlights }}</span>
        <span>{{ statsStrings.PROPELLERHAT }}</span><span class="text-right font-semibold">{{ stats.propellerFlights }}</span>
        <span>{{ statsStrings.MISS_PLATFORMS }}</span><span class="text-right font-semibold">{{ stats.deaths.miss }}</span>
        <span>{{ statsStrings.JUMPED_MONSTERS }}</span><span class="text-right font-semibold">{{ stats.deaths.monster }}</span>
        <span>{{ statsStrings.ABDUCTED_UFO }}</span><span class="text-right font-semibold">{{ stats.deaths.ufo }}</span>
        <span>{{ statsStrings.BLACK_HOLE }}</span><span class="text-right font-semibold">{{ stats.deaths.blackhole }}</span>
      </div>
      <h4 class="mt-3 font-bold text-slate-800">{{ statsStrings.ACHS ?? 'achievements' }} ({{ unlockedAchs.length }})</h4>
      <div v-for="id in unlockedAchs" :key="id" class="text-slate-600">
        <span class="font-semibold text-lime-700">{{ achStrings[id]?.[0] ?? id }}</span>
        — {{ achStrings[id]?.[2] ?? '' }}
      </div>
      <button class="mt-auto rounded-lg bg-slate-200 py-2 text-slate-700 hover:bg-slate-300" @click="screen = 'menu'">
        {{ genericStrings.CLOSE_BTN ?? 'close' }}
      </button>
    </div>

    <div v-else-if="screen === 'missions'" class="absolute inset-0 flex flex-col gap-2 overflow-y-auto bg-[#fbfaf4]/97 p-5 text-xs">
      <h3 class="text-lg font-bold text-slate-800">{{ genericStrings.MISSIONS ?? 'missions' }}</h3>
      <div v-for="id in save.activeMissions" :key="id" class="rounded-lg border border-slate-200 bg-white p-2">
        <p class="font-semibold text-slate-700">{{ missionLabel(id) }}</p>
        <p class="text-slate-500">
          {{ save.missions[id]?.done ? 'done!' : `${save.missions[id]?.progress ?? 0} / ${missionRequired(missionById(id)!)}` }}
        </p>
      </div>
      <button class="mt-auto rounded-lg bg-slate-200 py-2 text-slate-700 hover:bg-slate-300" @click="screen = 'menu'">
        {{ genericStrings.CLOSE_BTN ?? 'close' }}
      </button>
    </div>
  </div>
</template>
