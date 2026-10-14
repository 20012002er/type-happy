<script setup lang="ts">
import { computed } from 'vue'
import { SECTS, chapterById, itemById, npcById, sectById } from '../../../games/wulin/data'
import { fmt, fmtDur } from '../../../games/wulin/format'
import { charLevel } from '../../../games/wulin/sim/character'
import { roomOf } from '../../../games/wulin/sim'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi }>()

const char = computed(() => props.ui.save.char!)
const save = computed(() => props.ui.save)
const mySect = computed(() => sectById.get(char.value.sect ?? ''))
const level = computed(() => charLevel(char.value))

const ATTR_LABEL: Record<string, string> = { arm: '臂力', agi: '身法', bone: '根骨', ins: '悟性' }

function reqText(s: (typeof SECTS)[number]): string {
  const parts: string[] = []
  if (s.gender) parts.push(s.gender === 'male' ? '男弟子' : '女弟子')
  for (const [k, v] of Object.entries(s.requires ?? {})) parts.push(`先天${ATTR_LABEL[k]} ≥ ${v}`)
  if (s.rebirthOnly) parts.push('需历经传承')
  return parts.length ? parts.join(' · ') : '无门槛'
}

function location(s: (typeof SECTS)[number]): string {
  const ch = chapterById.get(s.home.chapter)
  const room = roomOf(s.home.room)?.room
  return `${ch?.title ?? '?'} · ${room?.name ?? '?'}`
}

function canJoinHere(s: (typeof SECTS)[number]): boolean {
  const room = roomOf(save.value.progress.room)?.room
  return !!room?.npcs?.includes(s.master)
}

function join(id: string): void {
  const err = props.ui.sim.joinSect(id)
  props.ui.toast(err ?? '拜师成功,自此有师有门!', !err)
}

function taskCd(i: number): number {
  void props.ui.now.value
  const s = mySect.value
  if (!s) return 0
  return Math.max(0, (save.value.daily.sectTasks[`${s.id}-${i}`] ?? 0) - props.ui.now.value)
}

function doTask(i: number): void {
  const err = props.ui.sim.doSectTask(i)
  props.ui.toast(err ?? '师门任务完成!', !err)
}

function kowtow(): void {
  const err = props.ui.sim.kowtow()
  if (err) props.ui.toast(err)
  else if (Math.random() < 0.15) props.ui.toast('师傅瞥了你一眼:「起来说话。」潜能 +5', true)
}

function buy(id: string): void {
  const err = props.ui.sim.buySect(id)
  props.ui.toast(err ?? '兑换成功。', !err)
}
</script>

<template>
  <div class="space-y-3 p-3">
    <!-- 未入门:门派列表 -->
    <template v-if="!mySect">
      <p class="px-1 text-[11px] leading-relaxed text-stone-400">
        拜入门派后可请教武学、领取师门任务、以贡献兑换好物;也可以做一辈子散人,靠公共武学闯荡。找到门派接引之人(在对应地点交谈)方可拜师。
      </p>
      <section v-for="s in SECTS" :key="s.id" class="wl-card">
        <div class="flex items-baseline justify-between">
          <h4 class="font-serif text-sm font-bold text-stone-800">
            {{ s.name }}
            <span class="ml-1 rounded bg-stone-200/80 px-1 py-0.5 text-[9px] text-stone-500">
              {{ s.kind === 'righteous' ? '名门正派' : s.kind === 'neutral' ? '中立门派' : '隐藏门派' }}
            </span>
          </h4>
          <span class="text-[10px] text-stone-400">{{ location(s) }}</span>
        </div>
        <p class="mt-1 text-[11px] leading-relaxed text-stone-500">{{ s.desc }}</p>
        <p class="mt-1 text-[10px] text-stone-400">入门要求:{{ reqText(s) }}</p>
        <button
          class="wl-btn mt-2 !px-3 !py-1 text-[11px]"
          :disabled="!canJoinHere(s)"
          @click="join(s.id)"
        >
          {{ canJoinHere(s) ? '拜师入门' : '接引人不在此处' }}
        </button>
      </section>
    </template>

    <!-- 已入门 -->
    <template v-else>
      <section class="wl-card">
        <h4 class="font-serif text-sm font-bold text-stone-800">
          {{ mySect.name }}
          <span class="ml-1 text-[10px] font-normal text-stone-400">{{ mySect.master ? npcById.get(mySect.master)?.name : '' }} 门下</span>
        </h4>
        <p class="mt-1 text-[11px] leading-relaxed text-stone-500">{{ mySect.desc }}</p>
        <div class="mt-2 flex gap-2 text-[11px] text-stone-600">
          <span class="rounded bg-[#f1ead8] px-2 py-1">贡献 {{ fmt(char.contribution) }}</span>
          <span class="rounded bg-[#f1ead8] px-2 py-1">威望 {{ fmt(char.prestige) }}</span>
          <button class="wl-btn wl-btn-ghost !px-2 !py-1 text-[11px]" @click="kowtow">磕头(+5 潜能)</button>
        </div>
      </section>

      <section class="wl-card">
        <h4 class="text-xs font-semibold text-stone-500">师门任务</h4>
        <div class="mt-1.5 space-y-1">
          <div v-for="(t, i) in mySect.tasks" :key="t.name" class="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5">
            <div class="min-w-0">
              <p class="text-xs text-stone-700">{{ t.name }} <span class="text-[10px] text-stone-400">{{ t.level }} 级</span></p>
              <p class="truncate text-[10px] text-stone-400">
                {{ t.desc }} · 贡献+{{ t.reward.contribution }} 威望+{{ t.reward.prestige }} 经验+{{ fmt(t.reward.exp) }}
              </p>
            </div>
            <button class="wl-btn shrink-0 !px-2 !py-1 text-[11px]" :disabled="level < t.level || taskCd(i) > 0" @click="doTask(i)">
              {{ level < t.level ? `${t.level}级` : taskCd(i) > 0 ? fmtDur(taskCd(i)) : '领任务' }}
            </button>
          </div>
        </div>
      </section>

      <section class="wl-card">
        <h4 class="text-xs font-semibold text-stone-500">贡献兑换</h4>
        <div class="mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            v-for="e in mySect.shop"
            :key="e.id"
            class="rounded-lg bg-white/70 px-2.5 py-1.5 text-left hover:bg-amber-50 disabled:opacity-40"
            :disabled="char.contribution < e.cost"
            @click="buy(e.id)"
          >
            <p class="text-[11px] font-semibold text-stone-700">{{ itemById.get(e.id)?.name ?? e.id }}</p>
            <p class="text-[10px] text-amber-700">贡献 {{ e.cost }}</p>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
