<script setup lang="ts">
import { computed, ref } from 'vue'
import { DAILY_TASKS, HARVEST_TASKS, SIGNIN_CYCLE } from '../../../games/wulin/constants'
import { STORY_CHAPTERS, chapterById } from '../../../games/wulin/data'
import { fmt, fmtDur, fmtRate } from '../../../games/wulin/format'
import { roomOf, spotKey } from '../../../games/wulin/sim'
import {
  dailyCount,
  dailyReady,
  dailyUnlocked,
  harvestReady,
  harvestUnlocked,
  canSignin,
} from '../../../games/wulin/sim/quests'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi }>()
const emit = defineEmits<{ npc: [id: string] }>()

const save = computed(() => props.ui.save)
const progress = computed(() => props.ui.save.progress)
const chapter = computed(() => chapterById.get(progress.value.chapter)!)
const room = computed(() => roomOf(progress.value.room)?.room ?? chapter.value.rooms[0])
const quest = computed(() => props.ui.sim.questInfo())
const roomNpcs = computed(() => props.ui.sim.roomNpcs(room.value))
const showTravel = ref(false)

const idleChapter = computed(() =>
  save.value.idle.chapter ? chapterById.get(save.value.idle.chapter) : null,
)
const idleRates = computed(() => {
  const id = save.value.idle.chapter
  return id ? props.ui.sim.idleRateFor(id) : null
})

function simCtx() {
  return props.ui.sim.ctx()!
}

function move(to: string): void {
  const err = props.ui.sim.moveTo(to)
  if (err) props.ui.toast(err)
  else props.ui.refreshMap()
}

function travel(id: string): void {
  const err = props.ui.sim.travelTo(id)
  showTravel.value = false
  if (err) props.ui.toast(err)
  else {
    props.ui.refreshMap()
    props.ui.toast(`风尘仆仆,抵达${chapterById.get(id)?.title}。`, true)
  }
}

function doPickup(i: number): void {
  const err = props.ui.sim.pickup(room.value, i)
  if (err) props.ui.toast(err)
  else {
    props.ui.toast('收获一件物品。', true)
    props.ui.refreshMap()
  }
}

function doSpot(i: number): void {
  const err = props.ui.sim.trainSpot(room.value, i)
  props.ui.toast(err ?? '一番苦练,略有所得。', !err)
  if (!err) props.ui.refreshMap()
}

function startIdle(id: string): void {
  const err = props.ui.sim.startIdle(id)
  props.ui.toast(err ?? '开始在江湖中闯荡磨砺。', !err)
}

function stopIdle(): void {
  props.ui.sim.stopIdle()
  props.ui.toast('停下了脚步。')
}

function doHarvest(id: string): void {
  const err = props.ui.sim.doHarvest(id)
  props.ui.toast(err ?? '忙碌一阵,颇有收获。', !err)
}

function doDaily(id: string): void {
  const err = props.ui.sim.doDaily(id)
  props.ui.toast(err ?? '任务完成!', !err)
}

function doSignin(): void {
  const err = props.ui.sim.doSignin()
  props.ui.toast(err ?? '签到成功。', !err)
}

function pickedFlags(): boolean[] {
  return (room.value.pickups ?? []).map((_, i) =>
    progress.value.picked.includes(`${room.value.id}:${i}`),
  )
}

function spotLeft(i: number): number {
  const spot = room.value.train?.[i]
  if (!spot) return 0
  return Math.max(0, spot.cap - (progress.value.trains[spotKey(room.value.id, i)] ?? 0))
}

function harvestCd(id: string): number {
  return Math.max(0, (save.value.harvest[id] ?? 0) - props.ui.now.value)
}

function dailyCd(id: string): number {
  return Math.max(0, (save.value.harvest[`d-${id}`] ?? 0) - props.ui.now.value)
}

const signinIdx = computed(() => save.value.daily.signin % SIGNIN_CYCLE.length)
</script>

<template>
  <div class="space-y-3 p-3">
    <!-- 当前地点 -->
    <section class="wl-card">
      <div class="flex items-baseline justify-between">
        <h3 class="font-serif text-base font-bold text-stone-800">
          {{ chapter.title }} · {{ room.name }}
        </h3>
        <button
          class="text-[11px] text-amber-700 underline underline-offset-2"
          @click="showTravel = true"
        >
          游历各地
        </button>
      </div>
      <p class="mt-1 font-serif text-xs leading-relaxed text-stone-500">{{ room.desc }}</p>

      <div class="mt-2 rounded-lg bg-[#f1ead8] px-3 py-2">
        <p class="text-[11px] font-semibold text-stone-600">
          主线 · {{ quest.finished ? '已完成' : `${quest.done}/${quest.total}` }}
        </p>
        <p class="mt-0.5 text-xs leading-relaxed text-stone-700">
          {{ quest.desc ?? '本章主线已了结,可在此挂机历练,或前往下一处地界。' }}
        </p>
        <p class="mt-0.5 text-[10px] text-stone-400">步骤不分先后,全部完成即通关本章。</p>
      </div>

      <div v-if="room.exits.length" class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="ex in room.exits"
          :key="ex.to"
          class="wl-btn wl-btn-ghost !px-2.5 !py-1 text-[11px]"
          @click="move(ex.to)"
        >
          {{ ex.dir }} → {{ roomOf(ex.to)?.room.name ?? '?' }}
        </button>
      </div>
    </section>

    <!-- 人物与交互 -->
    <section v-if="roomNpcs.length" class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">此地人物</h4>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <button
          v-for="n in roomNpcs"
          :key="n.id"
          class="wl-btn !px-2.5 !py-1 text-[11px]"
          :class="n.hostile ? 'wl-btn-danger' : 'wl-btn-ghost'"
          @click="emit('npc', n.id)"
        >
          {{ n.name }}{{ n.title ? ` · ${n.title}` : '' }}
        </button>
      </div>
    </section>

    <section v-if="room.pickups?.length || room.train?.length" class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">周遭事务</h4>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <template v-if="room.pickups">
          <button
            v-for="(p, i) in room.pickups"
            :key="`p${i}`"
            class="wl-btn wl-btn-gold !px-2.5 !py-1 text-[11px]"
            :disabled="pickedFlags()[i]"
            @click="doPickup(i)"
          >
            {{ pickedFlags()[i] ? '已翻找' : '翻找此处' }}
          </button>
        </template>
        <template v-if="room.train">
          <button
            v-for="(s, i) in room.train"
            :key="`t${i}`"
            class="wl-btn wl-btn-ghost !px-2.5 !py-1 text-[11px]"
            :disabled="spotLeft(i) <= 0"
            @click="doSpot(i)"
          >
            {{ s.label }}({{ spotLeft(i) }})
          </button>
        </template>
      </div>
    </section>

    <!-- 挂机 -->
    <section class="wl-card">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold text-stone-500">挂机闯荡</h4>
        <span v-if="idleChapter" class="text-[11px] text-stone-400"
          >正在:{{ idleChapter.title }}</span
        >
      </div>
      <div v-if="idleRates" class="mt-1.5 flex gap-2 text-[11px] text-stone-600">
        <span class="rounded bg-[#f1ead8] px-2 py-1">经验 {{ fmtRate(idleRates.exp) }}</span>
        <span class="rounded bg-[#f1ead8] px-2 py-1">碎银 {{ fmtRate(idleRates.silver) }}</span>
        <span class="rounded bg-[#f1ead8] px-2 py-1">潜能 {{ fmtRate(idleRates.potential) }}</span>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-if="save.idle.chapter"
          class="wl-btn wl-btn-ghost !px-2.5 !py-1 text-[11px]"
          @click="stopIdle"
        >
          停止挂机
        </button>
        <button
          v-for="cid in progress.unlocked.filter((x) => x !== 'rb')"
          :key="cid"
          class="wl-btn !px-2.5 !py-1 text-[11px]"
          :class="save.idle.chapter === cid ? 'wl-btn-gold' : ''"
          @click="startIdle(cid)"
        >
          {{ chapterById.get(cid)?.title }}
        </button>
      </div>
      <p class="mt-1.5 text-[10px] leading-relaxed text-stone-400">
        收益随综合评价、福缘与传承次数增长;离线期间也在进行(速成档最多结算 8 小时,标准档 24 小时)。
      </p>
    </section>

    <!-- 收菜 -->
    <section class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">差事(定时)</h4>
      <div class="mt-1.5 space-y-1">
        <div
          v-for="t in HARVEST_TASKS"
          :key="t.id"
          class="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5"
        >
          <div>
            <p class="text-xs text-stone-700">{{ t.name }}</p>
            <p class="text-[10px] text-stone-400">
              经验 +{{ fmt(t.exp) }} · {{ t.cdHours > 0 ? `${t.cdHours} 小时一次` : '随手可做' }}
            </p>
          </div>
          <button
            v-if="harvestUnlocked(simCtx(), t)"
            class="wl-btn !px-2.5 !py-1 text-[11px]"
            :disabled="!harvestReady(simCtx(), t)"
            @click="doHarvest(t.id)"
          >
            {{ harvestReady(simCtx(), t) ? '领取' : fmtDur(harvestCd(t.id)) }}
          </button>
          <span v-else class="text-[10px] text-stone-300">未解锁</span>
        </div>
      </div>
    </section>

    <!-- 每日历练 -->
    <section class="wl-card">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold text-stone-500">每日历练</h4>
        <button
          class="wl-btn wl-btn-gold !px-2.5 !py-1 text-[11px]"
          :disabled="!canSignin(simCtx())"
          @click="doSignin"
        >
          签到({{ SIGNIN_CYCLE[signinIdx].label }})
        </button>
      </div>
      <div class="mt-1.5 space-y-1">
        <div
          v-for="t in DAILY_TASKS"
          :key="t.id"
          class="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5"
        >
          <div class="min-w-0">
            <p class="text-xs text-stone-700">
              {{ t.name }}
              <span class="text-[10px] text-stone-400"
                >{{ dailyCount(simCtx(), t.id) }}/{{ t.limit }}</span
              >
            </p>
            <p class="truncate text-[10px] text-stone-400">{{ t.desc }}</p>
          </div>
          <button
            v-if="dailyUnlocked(simCtx(), t)"
            class="wl-btn shrink-0 !px-2.5 !py-1 text-[11px]"
            :disabled="!(dailyCount(simCtx(), t.id) < t.limit && dailyReady(simCtx(), t.id))"
            @click="doDaily(t.id)"
          >
            {{ dailyReady(simCtx(), t.id) ? '出发' : fmtDur(dailyCd(t.id)) }}
          </button>
          <span v-else class="shrink-0 text-[10px] text-stone-300">未解锁</span>
        </div>
      </div>
    </section>

    <!-- 游历弹窗 -->
    <div
      v-if="showTravel"
      class="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      @click.self="showTravel = false"
    >
      <div
        class="wl-fade-in max-h-[80%] w-full max-w-sm overflow-y-auto rounded-2xl border border-[#d8cdb2] bg-[#f7f2e6] p-4"
      >
        <h4 class="font-serif text-sm font-bold text-stone-800">游历 · 第一卷《风起青萍》</h4>
        <div class="mt-2 space-y-1.5">
          <button
            v-for="c in STORY_CHAPTERS"
            :key="c.id"
            class="flex w-full items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-left hover:bg-amber-50 disabled:opacity-40"
            :disabled="!progress.unlocked.includes(c.id)"
            @click="travel(c.id)"
          >
            <span class="text-xs font-semibold text-stone-700"
              >第{{ '一二三四五六七八九十'[c.index - 1] }}章 · {{ c.title }}</span
            >
            <span class="text-[10px] text-stone-400">
              {{
                progress.unlocked.includes(c.id)
                  ? progress.chaptersDone.includes(c.id)
                    ? '已通关'
                    : `主线 ${ui.sim.questInfoOf(c.id).done}/${c.quest.length}`
                  : '未解锁'
              }}
            </span>
          </button>
        </div>
        <button class="wl-btn wl-btn-ghost mt-3 w-full" @click="showTravel = false">关闭</button>
      </div>
    </div>
  </div>
</template>
