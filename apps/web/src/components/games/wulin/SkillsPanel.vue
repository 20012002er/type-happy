<script setup lang="ts">
import { computed } from 'vue'
import {
  SECLUSION_POTENTIAL,
  TRAIN_EXP_PER_HOUR,
  TRAIN_SPIRIT_PER_HOUR,
  researchPotential,
  skillExpForLevel,
} from '../../../games/wulin/constants'
import { itemById, skillById } from '../../../games/wulin/data'
import { fmt, fmtDur } from '../../../games/wulin/format'
import { effectiveAttrs } from '../../../games/wulin/sim/character'
import type { SkillSlot } from '../../../games/wulin/types'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi }>()

const char = computed(() => props.ui.save.char!)
const save = computed(() => props.ui.save)

const SLOT_NAMES: Record<SkillSlot, string> = {
  output: '输出',
  internal: '内功',
  lightness: '轻功',
  parry: '招架',
}

const learned = computed(() =>
  Object.entries(char.value.skills)
    .map(([id, st]) => ({ id, st, def: skillById.get(id)! }))
    .filter((x) => x.def)
    .sort((a, b) => {
      const order = { basic: 0, sect: 1, public: 1, hidden: 2, secret: 3 } as const
      return (
        (order[a.def.tier as keyof typeof order] ?? 1) -
          (order[b.def.tier as keyof typeof order] ?? 1) || b.st.level - a.st.level
      )
    }),
)

function optionsFor(slot: SkillSlot): { id: string; name: string }[] {
  return learned.value
    .filter((x) => x.def.slots.includes(slot))
    .map((x) => ({ id: x.id, name: `${x.def.name} Lv.${x.st.level}` }))
}

function equip(slot: SkillSlot, e: Event): void {
  const id = (e.target as HTMLSelectElement).value
  if (!id) return
  const err = props.ui.sim.equipSkill(slot, id)
  if (err) props.ui.toast(err)
}

const trainingSkill = computed(() =>
  save.value.training.skill ? skillById.get(save.value.training.skill) : null,
)

const effIns = computed(() => effectiveAttrs(char.value).ins)

const trainGainPerHour = computed(() => {
  if (!trainingSkill.value) return 0
  return (
    TRAIN_EXP_PER_HOUR *
    (trainingSkill.value.conversion / 50) *
    (1 + effIns.value / 100) *
    props.ui.sim.rate()
  )
})

const seclusionSkill = computed(() =>
  save.value.seclusion.skill ? skillById.get(save.value.seclusion.skill) : null,
)
const seclusionLeft = computed(() => {
  void props.ui.now.value
  return props.ui.sim.seclusionRemaining()
})

function startTrain(id: string): void {
  if (save.value.training.skill === id) {
    props.ui.sim.stopTraining()
    props.ui.toast('停下了修炼。')
    return
  }
  const err = props.ui.sim.startTraining(id)
  props.ui.toast(err ?? '开始练功。', !err)
}

function startSeclusion(id: string): void {
  const useGuard = (char.value.bag['guard-pill'] ?? 0) > 0
  const err = props.ui.sim.startSeclusion(id, useGuard)
  props.ui.toast(err ?? (useGuard ? '服下静心丸,安然入定。' : '入定闭关,成败在天。'), !err)
}

function doResearch(id: string): void {
  const err = props.ui.sim.research(id)
  props.ui.toast(err ?? '研读有成。', !err)
}

function doMeditate(): void {
  const err = props.ui.sim.meditate()
  props.ui.toast(err ?? '周身舒畅。', !err)
}

function usePage(id: string): void {
  const err = props.ui.sim.usePage(id)
  props.ui.toast(err ?? '参悟残页……', !err)
}

const taixuReady = computed(() =>
  ['q-taixu-1', 'q-taixu-2', 'q-taixu-3'].every((id) => (char.value.bag[id] ?? 0) > 0),
)

function comprehend(): void {
  const err = props.ui.sim.comprehendTaixu()
  props.ui.toast(err ?? '剑意冲霄!', !err)
}

const weaponName = computed(() =>
  char.value.weapon ? itemById.get(char.value.weapon)?.name : '空手',
)

function tierLabel(t: string): string {
  return { basic: '基本', sect: '门派', public: '公共', hidden: '隐藏', secret: '绝学' }[t] ?? t
}
</script>

<template>
  <div class="space-y-3 p-3">
    <!-- 准备位 -->
    <section class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">
        临敌准备 <span class="ml-1 text-[10px] text-stone-400">手持:{{ weaponName }}</span>
      </h4>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label v-for="(name, slot) in SLOT_NAMES" :key="slot" class="block">
          <span class="text-[10px] text-stone-400">{{ name }}位</span>
          <select
            class="mt-0.5 w-full rounded-lg border border-[#d8cdb2] bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-amber-600"
            :value="char.equipped[slot] ?? ''"
            @change="equip(slot as SkillSlot, $event)"
          >
            <option value="" disabled>未装备</option>
            <option v-for="o in optionsFor(slot as SkillSlot)" :key="o.id" :value="o.id">
              {{ o.name }}
            </option>
          </select>
        </label>
      </div>
      <p class="mt-1.5 text-[10px] leading-relaxed text-stone-400">
        武学等级 ≤ 人物等级,且 ≤ 对应基本武学 +1。兵器武学需手持对应兵刃。
      </p>
    </section>

    <!-- 修炼状态 -->
    <section class="wl-card space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold text-stone-500">修炼</h4>
        <span class="text-[11px] text-stone-500">
          精神 <b class="text-stone-800">{{ Math.floor(char.spirit) }}</b
          >/{{ 120 + char.rebirths * 40 }}
        </span>
      </div>
      <div v-if="trainingSkill" class="rounded-lg bg-amber-50 px-3 py-2">
        <p class="text-xs text-amber-900">
          练功中:「{{ trainingSkill.name }}」 · 约 {{ fmt(trainGainPerHour) }} 修为/时 · 耗精神
          {{ TRAIN_SPIRIT_PER_HOUR }}/时
        </p>
        <button
          class="wl-btn wl-btn-ghost mt-1.5 !px-2.5 !py-1 text-[11px]"
          @click="startTrain(trainingSkill.id)"
        >
          停止练功
        </button>
      </div>
      <div v-if="seclusionSkill" class="rounded-lg bg-stone-100 px-3 py-2">
        <p class="text-xs text-stone-700">
          闭关中:「{{ seclusionSkill.name }}」 · 剩余 {{ fmtDur(seclusionLeft * 1000) }}
        </p>
        <p class="mt-0.5 text-[10px] text-stone-400">
          出关结果:完美/普通/走火入魔{{ save.seclusion.guard ? '(已服静心丸,不会入魔)' : '' }}
        </p>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button class="wl-btn !px-2.5 !py-1 text-[11px]" @click="doMeditate">
          打坐(精神-8,疗伤+内力上限+1)
        </button>
        <button
          v-if="taixuReady"
          class="wl-btn wl-btn-gold !px-2.5 !py-1 text-[11px]"
          @click="comprehend"
        >
          三卷合一 · 参悟太虚剑典
        </button>
      </div>
      <p class="text-[10px] text-stone-400">
        闭关一次耗潜能 {{ SECLUSION_POTENTIAL }},可提前备好静心丸防走火入魔。
      </p>
    </section>

    <!-- 武学列表 -->
    <section class="space-y-1.5">
      <div v-for="x in learned" :key="x.id" class="wl-card !p-2.5">
        <div class="flex items-baseline justify-between">
          <p class="text-sm font-semibold text-stone-800">
            {{ x.def.name }}
            <span class="ml-1 rounded bg-stone-200/80 px-1 py-0.5 text-[9px] text-stone-500">{{
              tierLabel(x.def.tier)
            }}</span>
          </p>
          <p class="text-xs text-stone-500">Lv.{{ x.st.level }}</p>
        </div>
        <div class="mt-1 h-1.5 overflow-hidden rounded bg-stone-200">
          <div
            class="h-full rounded bg-amber-600"
            :style="{ width: `${Math.min(100, (x.st.exp / skillExpForLevel(x.st.level)) * 100)}%` }"
          />
        </div>
        <p class="mt-1 text-[10px] leading-snug text-stone-400">
          转化率 {{ x.def.conversion }}
          <template v-if="x.def.atkCoef"> · 攻 {{ x.def.atkCoef }}</template>
          <template v-if="x.def.defCoef"> · 防 {{ x.def.defCoef }}</template>
          <template v-if="x.def.dodgeCoef"> · 闪 {{ x.def.dodgeCoef }}</template>
          <template v-if="x.def.hpCoef"> · 血 {{ x.def.hpCoef }}</template>
          <template v-if="x.def.mpCoef"> · 内 {{ x.def.mpCoef }}</template>
          · {{ x.def.desc }}
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <button
            v-if="x.def.tier !== 'basic' && !x.def.slots.includes('internal')"
            class="wl-btn !px-2 !py-0.5 text-[11px]"
            :class="save.training.skill === x.id ? 'wl-btn-gold' : ''"
            @click="startTrain(x.id)"
          >
            {{ save.training.skill === x.id ? '练功中' : '练功' }}
          </button>
          <button
            v-if="x.def.slots.includes('internal')"
            class="wl-btn !px-2 !py-0.5 text-[11px]"
            :disabled="!!save.seclusion.skill"
            @click="startSeclusion(x.id)"
          >
            闭关
          </button>
          <button
            v-if="x.def.tier === 'basic'"
            class="wl-btn wl-btn-ghost !px-2 !py-0.5 text-[11px]"
            @click="doResearch(x.id)"
          >
            研究(潜能 {{ fmt(researchPotential(effIns)) }})
          </button>
          <template v-if="x.def.active">
            <span
              v-if="x.st.activeUnlocked"
              class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700"
            >
              「{{ x.def.active.name }}」已参悟
            </span>
            <button
              v-else
              class="wl-btn wl-btn-ghost !px-2 !py-0.5 text-[11px]"
              :disabled="!(char.bag['wuxue-page'] > 0)"
              @click="usePage(x.id)"
            >
              参悟残页({{ char.pages[x.id] ?? 0 }}/{{ x.def.active.pages }})
            </button>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
