<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { rollOrigin } from '../../../games/wulin/sim/character'
import { ORIGINS } from '../../../games/wulin/data'
import { ATTR_TOTAL, EXTRA_TOTAL } from '../../../games/wulin/constants'
import type { Attrs, Gender } from '../../../games/wulin/types'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi }>()

const name = ref('')
const gender = ref<Gender>('male')
const originId = ref('orphan')

const roll = reactive<{ attrs: Attrs; appearance: number; fortune: number }>(rollOrigin(originId.value))

function reroll(): void {
  const r = rollOrigin(originId.value)
  roll.attrs = r.attrs
  roll.appearance = r.appearance
  roll.fortune = r.fortune
}

function pickOrigin(id: string): void {
  originId.value = id
  reroll()
}

const attrTotal = computed(() => roll.attrs.arm + roll.attrs.agi + roll.attrs.bone + roll.attrs.ins)
const attrNames: [keyof Attrs, string, string][] = [
  ['arm', '臂力', '攻击·伤害·命中'],
  ['agi', '身法', '防御·闪避·攻速'],
  ['bone', '根骨', '气血·内力·防护'],
  ['ins', '悟性', '练功速度·潜能消耗'],
]

function start(): void {
  const n = name.value.trim()
  if (!n) {
    props.ui.toast('先给自己取个名号')
    return
  }
  if (n.length > 8) {
    props.ui.toast('名号最长 8 个字')
    return
  }
  props.ui.sim.createCharacter(n, gender.value, originId.value, roll.attrs, roll.appearance, roll.fortune)
  props.ui.toast(`${n},自此踏入江湖。`, true)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto bg-[#f7f2e6] px-5 py-6">
    <div class="text-center">
      <h2 class="font-serif text-3xl font-bold tracking-widest text-stone-800">放置武林</h2>
      <p class="mt-1 text-xs tracking-wider text-stone-500">机制致敬《放置江湖》· 文字水墨 · 纯本地存档</p>
    </div>

    <div class="mx-auto mt-5 w-full max-w-md space-y-4">
      <section class="rounded-xl border border-[#d8cdb2] bg-white/60 p-4">
        <h3 class="text-sm font-semibold text-stone-700">名号与性别</h3>
        <div class="mt-2 flex gap-2">
          <input
            v-model="name"
            maxlength="8"
            placeholder="输入名号"
            class="min-w-0 flex-1 rounded-lg border border-[#d8cdb2] bg-white px-3 py-2 text-sm outline-none focus:border-amber-600"
          />
          <div class="flex overflow-hidden rounded-lg border border-[#d8cdb2]">
            <button
              class="px-3 text-sm"
              :class="gender === 'male' ? 'bg-stone-800 text-amber-50' : 'bg-white text-stone-600'"
              @click="gender = 'male'"
            >
              男
            </button>
            <button
              class="px-3 text-sm"
              :class="gender === 'female' ? 'bg-stone-800 text-amber-50' : 'bg-white text-stone-600'"
              @click="gender = 'female'"
            >
              女
            </button>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-[#d8cdb2] bg-white/60 p-4">
        <h3 class="text-sm font-semibold text-stone-700">出身</h3>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button
            v-for="o in ORIGINS"
            :key="o.id"
            class="rounded-lg border p-2.5 text-left transition"
            :class="originId === o.id ? 'border-amber-600 bg-amber-50' : 'border-[#d8cdb2] bg-white hover:border-amber-400'"
            @click="pickOrigin(o.id)"
          >
            <p class="text-sm font-semibold text-stone-800">{{ o.name }}</p>
            <p class="mt-1 text-[11px] leading-snug text-stone-500">{{ o.desc }}</p>
          </button>
        </div>
      </section>

      <section class="rounded-xl border border-[#d8cdb2] bg-white/60 p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-stone-700">
            先天属性 <span class="text-xs text-stone-400">(四维合计 {{ attrTotal }}/{{ ATTR_TOTAL }})</span>
          </h3>
          <button class="rounded-lg bg-stone-700 px-3 py-1.5 text-xs text-amber-50 hover:bg-stone-600" @click="reroll">
            重新投掷
          </button>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <div v-for="[k, label, hint] in attrNames" :key="k" class="rounded-lg bg-[#f1ead8] px-3 py-2">
            <p class="flex items-baseline justify-between text-xs text-stone-500">
              {{ label }}
              <span class="font-serif text-lg font-bold text-stone-800">{{ roll.attrs[k] }}</span>
            </p>
            <p class="text-[10px] text-stone-400">{{ hint }}</p>
          </div>
        </div>
        <div class="mt-2 flex gap-2 text-xs text-stone-500">
          <span class="flex-1 rounded-lg bg-[#f1ead8] px-3 py-2">
            容貌 <b class="text-stone-800">{{ roll.appearance }}</b>
          </span>
          <span class="flex-1 rounded-lg bg-[#f1ead8] px-3 py-2">
            福缘 <b class="text-amber-700">{{ roll.fortune }}</b>
            <i class="not-italic text-[10px] text-stone-400">(挂机收益 +{{ roll.fortune * 2 }}%)</i>
          </span>
          <span class="flex items-center text-[10px] text-stone-400">合计 {{ roll.appearance + roll.fortune }}/{{ EXTRA_TOTAL }}</span>
        </div>
        <p class="mt-2 text-[11px] leading-relaxed text-stone-400">
          提示:悟性不影响战斗,只加快练功;福缘提升挂机与任务收益。属性可在多次投掷中挑选,传承后还有属性点补足。
        </p>
      </section>

      <button
        class="w-full rounded-xl bg-gradient-to-b from-stone-700 to-stone-900 py-3 font-serif text-lg tracking-[0.5em] text-amber-50 shadow-md transition hover:from-stone-600 hover:to-stone-800"
        @click="start"
      >
        踏入江湖
      </button>
    </div>
  </div>
</template>
