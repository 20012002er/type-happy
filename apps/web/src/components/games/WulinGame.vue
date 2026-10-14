<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { Application } from 'pixi.js'
import { VIEW_H, VIEW_W } from '../../games/wulin/constants'
import { itemById, npcById, skillById } from '../../games/wulin/data'
import { WulinSim, roomOf, spotKey } from '../../games/wulin/sim'
import { evaluation, rollOrigin } from '../../games/wulin/sim/character'
import { audio } from '../../games/wulin/audio'
import { loadSave, persistSave } from '../../games/wulin/save'
import { BattleScene } from '../../games/wulin/render/battleScene'
import { MapScene, type RoomView } from '../../games/wulin/render/mapScene'
import { INK, type SceneKind } from '../../games/wulin/render/ink'
import { formatAway } from '../../games/wulin/sim/idle'
import { fmt } from '../../games/wulin/format'
import type { WeaponType, WulinSave } from '../../games/wulin/types'
import { useGamesStore } from '../../stores/games'
import CreatePanel from './wulin/CreatePanel.vue'
import JianghuPanel from './wulin/JianghuPanel.vue'
import SkillsPanel from './wulin/SkillsPanel.vue'
import BagPanel from './wulin/BagPanel.vue'
import SectPanel from './wulin/SectPanel.vue'
import CharPanel from './wulin/CharPanel.vue'
import NpcModal from './wulin/NpcModal.vue'
import BattlePanel from './wulin/BattlePanel.vue'
import type { WulinUi } from './wulin/context'

const host = ref<HTMLDivElement | null>(null)
const gamesStore = useGamesStore()

const save = reactive(loadSave()) as WulinSave
const sim = new WulinSim(save, () => persistSave(save))

const now = ref(Date.now())
const tab = ref<'jianghu' | 'skills' | 'bag' | 'sect' | 'char'>('jianghu')
const battleActive = ref(false)
const battleSpeed = ref(2)
const battleNpcId = ref<string | null>(null)
const npcModal = ref<string | null>(null)
const toastMsg = ref<{ text: string; ok: boolean } | null>(null)
const offline = ref(sim.offlineReport)
let toastTimer = 0

function toast(text: string, ok = false): void {
  toastMsg.value = { text, ok }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toastMsg.value = null), 2600)
}

const ui: WulinUi = { sim, save, toast, now, refreshMap }

const app = shallowRef<Application | null>(null)
const mapScene = new MapScene()
let battleScene: BattleScene | null = null
let booted = false

const char = computed(() => save.char)
const level = computed(() => (save.char ? sim.level() : 1))
const hpRatio = computed(() => {
  const c = save.char
  if (!c) return 1
  return Math.max(0, Math.min(1, c.hp))
})

async function boot(): Promise<void> {
  if (!host.value || booted) return
  booted = true
  const application = new Application()
  await application.init({
    width: VIEW_W,
    height: VIEW_H,
    background: INK.paper,
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  })
  app.value = application
  host.value.appendChild(application.canvas)
  application.canvas.style.width = '100%'
  application.canvas.style.height = '100%'
  application.stage.addChild(mapScene.container)
  if (save.char) refreshMap()

  let settleAcc = 0
  let persistAcc = 0
  application.ticker.add((t) => {
    const dt = Math.min(0.05, t.deltaMS / 1000)
    settleAcc += dt
    persistAcc += dt
    if (battleActive.value && sim.combat) {
      sim.tickCombat(dt * battleSpeed.value)
      battleScene?.sync(sim.combat.state, dt * battleSpeed.value)
    } else {
      const c = save.char
      mapScene.update(dt, { playerName: c?.name ?? '', playerWeapon: c?.weapon ? (itemById.get(c.weapon)?.weapon?.type ?? null) : null })
    }
    if (settleAcc >= 5) {
      settleAcc = 0
      sim.settle()
    }
    if (persistAcc >= 15) {
      persistAcc = 0
      sim.persist()
    }
  })
}

function buildRoomView(): RoomView | null {
  const c = save.char
  if (!c) return null
  const found = roomOf(save.progress.room)
  if (!found) return null
  const room = found.room
  return {
    room,
    npcs: sim.roomNpcs(room).map((n) => ({
      id: n.id,
      name: n.name,
      hostile: n.hostile,
      defeated: n.hostile && save.progress.defeated.includes(n.id),
    })),
    picked: (room.pickups ?? []).map((_, i) => save.progress.picked.includes(`${room.id}:${i}`)),
    spotLeft: (room.train ?? []).map((s, i) => Math.max(0, s.cap - (save.progress.trains[spotKey(room.id, i)] ?? 0))),
    playerName: c.name,
    playerWeapon: c.weapon ? (itemById.get(c.weapon)?.weapon?.type ?? null) : null,
  }
}

function refreshMap(): void {
  if (!booted) return
  const view = buildRoomView()
  if (!view) return
  mapScene.show(view, {
    onExit: (roomId) => {
      const err = sim.moveTo(roomId)
      if (err) toast(err)
      else audio.click()
    },
    onNpc: (id) => {
      npcModal.value = id
      audio.click()
    },
    onPickup: (i) => {
      const err = sim.pickup(view.room, i)
      if (err) toast(err)
      else {
        audio.coin()
        toast('收获一件物品。', true)
        refreshMap()
      }
    },
    onSpot: (i) => {
      const err = sim.trainSpot(view.room, i)
      if (err) toast(err)
      else {
        audio.page()
        refreshMap()
      }
    },
  })
}

function visualWeapon(npcId: string | null, charWeapon: string | null, outSkill: string | null): WeaponType | null {
  if (npcId) {
    const def = npcById.get(npcId)
    for (const s of def?.skills ?? []) {
      const sd = skillById.get(s.id)
      if (sd?.slots.includes('output') && sd.weapon && sd.weapon !== 'fist') return sd.weapon
    }
    return null
  }
  const sd = outSkill ? skillById.get(outSkill) : undefined
  if (sd?.weapon && sd.weapon !== 'fist') {
    const held = charWeapon ? (itemById.get(charWeapon)?.weapon?.type ?? null) : null
    return held === sd.weapon ? held : null
  }
  return null
}

function startFight(npcId: string, mode: 'duel' | 'spar'): void {
  const err = sim.startFight(npcId, mode)
  if (err) {
    toast(err)
    return
  }
  battleNpcId.value = npcId
  battleActive.value = true
  overHandled = false
  const kind = (roomOf(save.progress.room)?.room.scene ?? 'mountain') as SceneKind
  battleScene = new BattleScene(kind)
  const c = save.char!
  const enemy = sim.combat!.state.enemy
  battleScene.setFighters(
    c.name,
    enemy.name,
    visualWeapon(null, c.weapon, c.equipped.output ?? null),
    visualWeapon(npcId, null, null),
  )
  battleScene.onEvent = (ev) => {
    if (ev.type === 'attack') {
      audio.slash()
      window.setTimeout(() => audio.hit(), 130)
    } else if (ev.type === 'skill') {
      audio.skill()
    } else if (ev.type === 'miss') {
      audio.miss()
    } else if (ev.type === 'heal') {
      audio.page()
    }
  }
  if (app.value) {
    app.value.stage.removeChildren()
    app.value.stage.addChild(battleScene.container)
  }
}

let overHandled = false
function checkBattleOver(): void {
  const st = sim.combat?.state
  if (!st || !st.over || overHandled) return
  overHandled = true
  if (st.winner === 'player') audio.win()
  else if (st.winner === 'enemy') audio.lose()
}

function leaveBattle(): void {
  sim.finishCombat()
  battleActive.value = false
  battleScene?.destroy()
  battleScene = null
  if (app.value) {
    app.value.stage.removeChildren()
    app.value.stage.addChild(mapScene.container)
  }
  refreshMap()
}

function fightAgain(): void {
  const id = battleNpcId.value
  const mode = sim.combat?.state.mode === 'spar' ? 'spar' : 'duel'
  leaveBattle()
  if (id) startFight(id, mode)
}

function onNpcFight(npcId: string, mode: 'duel' | 'spar'): void {
  npcModal.value = null
  startFight(npcId, mode)
}

watch(
  () => save.progress.room,
  () => {
    if (!battleActive.value) refreshMap()
  },
)

watch(
  () => save.settings.sound,
  (v) => {
    audio.enabled = v
  },
  { immediate: true },
)

watch(
  () => save.char,
  (c) => {
    if (c) {
      void nextTick(() => {
        void boot()
        refreshMap()
      })
    }
  },
)

let tickNow = 0
onMounted(() => {
  void boot()
  tickNow = window.setInterval(() => {
    now.value = Date.now()
    checkBattleOver()
  }, 500)
  window.addEventListener('pagehide', onLeave)
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__wulin = {
      sim,
      save,
      tab,
      battleActive,
      npcModal,
      offline,
      fastForward: (sec: number) => sim.fastForward(sec * 1000),
      createTest: (name = '测试侠', origin = 'martial', gender: 'male' | 'female' = 'male') => {
        const r = rollOrigin(origin)
        sim.createCharacter(name, gender, origin, r.attrs, r.appearance, r.fortune)
        refreshMap()
      },
      startFight,
      toast,
    }
  }
})

function onLeave(): void {
  sim.persist()
  if (save.char) gamesStore.recordScore('wulin', evaluation(save.char), 0)
}

onBeforeUnmount(() => {
  window.clearInterval(tickNow)
  window.clearTimeout(toastTimer)
  window.removeEventListener('pagehide', onLeave)
  onLeave()
  battleScene?.destroy()
  mapScene.destroy()
  void app.value?.destroy(true)
})

const offlineText = computed(() => {
  const r = offline.value
  if (!r) return []
  const lines: string[] = [`离开了 ${formatAway(r.minutes)}。`]
  if (r.spirit > 0) lines.push(`打坐调息,精神恢复 +${Math.round(r.spirit)}。`)
  if (r.idle) lines.push(`江湖闯荡:经验 +${fmt(r.idle.exp)},碎银 +${fmt(r.idle.silver)},潜能 +${fmt(r.idle.potential)}(${r.idle.hours.toFixed(1)} 小时)。`)
  if (r.trainedSkill && r.trainedLevels > 0) lines.push(`练功不辍,武学精进 ${r.trainedLevels} 级。`)
  if (r.seclusionText) lines.push('闭关已出,去武学页看看结果吧。')
  return lines
})

const TABS = [
  { id: 'jianghu', label: '江湖', icon: '🗺' },
  { id: 'skills', label: '武学', icon: '⚔️' },
  { id: 'bag', label: '背包', icon: '🎒' },
  { id: 'sect', label: '门派', icon: '🏯' },
  { id: 'char', label: '人物', icon: '🧘' },
] as const
</script>

<template>
  <div
    class="relative mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-[#d8cdb2] bg-[#f7f2e6] shadow-sm"
    style="height: calc(100dvh - 9rem); min-height: 540px"
  >
    <CreatePanel v-if="!char" :ui="ui" />

    <template v-else>
      <!-- HUD -->
      <header class="shrink-0 border-b border-[#e4dac0] bg-[#f1ead8]/80 px-3 py-1.5">
        <div class="flex items-baseline justify-between">
          <p class="font-serif text-sm font-bold text-stone-800">
            {{ char.name }}
            <span class="ml-1 text-[10px] font-normal text-stone-400">Lv.{{ level }} · 评价 {{ fmt(sim.evaluation()) }}</span>
          </p>
          <p class="text-[10px] text-stone-500">
            碎银 <b class="text-amber-700">{{ fmt(char.silver) }}</b> · 潜能 <b class="text-emerald-700">{{ fmt(char.potential) }}</b>
          </p>
        </div>
        <div class="mt-1 grid grid-cols-3 gap-1.5">
          <div class="h-1.5 overflow-hidden rounded bg-stone-300/60" title="气血">
            <div class="h-full bg-red-700/80" :style="{ width: `${hpRatio * 100}%` }" />
          </div>
          <div class="h-1.5 overflow-hidden rounded bg-stone-300/60" title="精神">
            <div class="h-full bg-sky-600/70" :style="{ width: `${Math.min(100, (char.spirit / (120 + char.rebirths * 40)) * 100)}%` }" />
          </div>
          <div class="h-1.5 overflow-hidden rounded bg-stone-300/60" title="经验">
            <div class="h-full bg-emerald-600/70" :style="{ width: `${sim.expProgress().ratio * 100}%` }" />
          </div>
        </div>
      </header>

      <!-- 画布 -->
      <div ref="host" class="relative w-full shrink-0 bg-[#f4eee0]" style="aspect-ratio: 480 / 300" />

      <!-- 面板区 -->
      <div class="wl-scroll min-h-0 flex-1 overflow-y-auto">
        <BattlePanel
          v-if="battleActive"
          :ui="ui"
          :speed="battleSpeed"
          :npc-id="battleNpcId"
          @leave="leaveBattle"
          @again="fightAgain"
          @speed="battleSpeed = $event"
        />
        <template v-else>
          <JianghuPanel v-if="tab === 'jianghu'" :ui="ui" @npc="npcModal = $event" />
          <SkillsPanel v-else-if="tab === 'skills'" :ui="ui" />
          <BagPanel v-else-if="tab === 'bag'" :ui="ui" />
          <SectPanel v-else-if="tab === 'sect'" :ui="ui" />
          <CharPanel v-else :ui="ui" />
        </template>
      </div>

      <!-- 底部标签 -->
      <nav v-if="!battleActive" class="grid shrink-0 grid-cols-5 border-t border-[#e4dac0] bg-[#f1ead8]">
        <button
          v-for="t in TABS"
          :key="t.id"
          class="flex flex-col items-center gap-0.5 py-1.5 text-[10px] transition"
          :class="tab === t.id ? 'font-bold text-amber-800' : 'text-stone-400 hover:text-stone-600'"
          @click="tab = t.id"
        >
          <span class="text-base leading-none">{{ t.icon }}</span>
          {{ t.label }}
        </button>
      </nav>

      <!-- NPC 弹窗 -->
      <NpcModal v-if="npcModal" :ui="ui" :npc-id="npcModal" @close="npcModal = null" @fight="onNpcFight" />

      <!-- 离线江湖快报 -->
      <div v-if="offline" class="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-5">
        <div class="wl-fade-in w-full max-w-sm rounded-2xl border border-[#d8cdb2] bg-[#f7f2e6] p-5 shadow-xl">
          <h3 class="text-center font-serif text-lg font-bold tracking-widest text-stone-800">江湖快报</h3>
          <div class="mt-3 space-y-1.5">
            <p v-for="(l, i) in offlineText" :key="i" class="font-serif text-xs leading-relaxed text-stone-600">· {{ l }}</p>
          </div>
          <button class="wl-btn mt-4 w-full" @click="offline = null">收下了</button>
        </div>
      </div>
    </template>

    <!-- Toast -->
    <div v-if="toastMsg" class="pointer-events-none absolute inset-x-0 top-16 z-50 flex justify-center px-6">
      <p
        class="wl-fade-in rounded-lg px-3 py-1.5 text-center font-serif text-xs shadow-md"
        :class="toastMsg.ok ? 'bg-emerald-800/90 text-emerald-50' : 'bg-stone-800/90 text-amber-50'"
      >
        {{ toastMsg.text }}
      </p>
    </div>
  </div>
</template>
