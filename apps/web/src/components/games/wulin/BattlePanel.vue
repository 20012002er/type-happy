<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { itemById, npcById } from '../../../games/wulin/data'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi; speed: number; npcId: string | null }>()
const emit = defineEmits<{ leave: []; again: []; speed: [n: number] }>()

const force = ref(0)
let timer = 0

onMounted(() => {
  timer = window.setInterval(() => force.value++, 150)
})
onBeforeUnmount(() => window.clearInterval(timer))

// 注意:sim.combat 非响应式且引用稳定,所有派生 computed 必须直接读 force 触发失效
const state = computed(() => {
  void force.value
  return props.ui.sim.combat?.state ?? null
})
const logs = computed(() => {
  void force.value
  return props.ui.sim.combat?.state.log.slice(-9) ?? []
})
const npcDef = computed(() => (props.npcId ? npcById.get(props.npcId) : undefined))
const over = computed(() => {
  void force.value
  return props.ui.sim.combat?.state.over ?? false
})
const win = computed(() => {
  void force.value
  return props.ui.sim.combat?.state.winner === 'player'
})
const fled = computed(() => {
  void force.value
  return props.ui.sim.combat?.state.fled ?? false
})

const quickItems = computed(() => {
  const c = props.ui.save.char
  if (!c) return []
  return ['med-gold', 'med-mid', 'med-big', 'mp-small', 'mp-pill']
    .filter((id) => (c.bag[id] ?? 0) > 0)
    .map((id) => ({ id, name: itemById.get(id)?.name ?? id, count: c.bag[id] }))
})

function logColor(kind: string): string {
  switch (kind) {
    case 'good':
      return 'text-emerald-700'
    case 'bad':
      return 'text-red-800'
    case 'skill':
      return 'text-amber-700'
    case 'miss':
      return 'text-stone-400'
    default:
      return 'text-stone-600'
  }
}

function useQuick(id: string): void {
  const err = props.ui.sim.useItem(id)
  if (err) props.ui.toast(err)
}

function flee(): void {
  props.ui.sim.fleeCombat()
}

function canAgain(): boolean {
  return !!props.npcId && props.ui.sim.canFight(props.npcId)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-[#e4dac0] px-3 py-1.5">
      <p class="text-xs font-semibold text-stone-700">
        ⚔️ {{ npcDef?.title ? `${npcDef.title} · ` : '' }}{{ npcDef?.name ?? '战斗' }}
        <span
          v-if="state?.mode === 'spar'"
          class="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700"
          >切磋</span
        >
      </p>
      <div class="flex items-center gap-1">
        <button
          v-for="s in [1, 2, 4]"
          :key="s"
          class="rounded px-1.5 py-0.5 text-[11px]"
          :class="speed === s ? 'bg-stone-800 text-amber-50' : 'bg-stone-200/70 text-stone-500'"
          @click="emit('speed', s)"
        >
          ×{{ s }}
        </button>
      </div>
    </div>

    <div
      class="wl-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 font-serif text-xs leading-relaxed"
    >
      <p v-for="(l, i) in logs" :key="i" :class="logColor(l.kind)">{{ l.text }}</p>
    </div>

    <div
      v-if="!over"
      class="flex flex-wrap items-center gap-1.5 border-t border-[#e4dac0] px-3 py-2"
    >
      <button
        v-for="q in quickItems"
        :key="q.id"
        class="wl-btn wl-btn-ghost !px-2 !py-1 text-[11px]"
        @click="useQuick(q.id)"
      >
        {{ q.name }}×{{ q.count }}
      </button>
      <span v-if="!quickItems.length" class="text-[11px] text-stone-400">没有可用的药品</span>
      <button class="wl-btn wl-btn-danger ml-auto !px-3 !py-1 text-[11px]" @click="flee">
        逃跑
      </button>
    </div>

    <div v-else class="wl-fade-in border-t border-[#e4dac0] px-3 py-2.5">
      <p
        class="text-center font-serif text-sm font-bold"
        :class="win ? 'text-emerald-700' : fled ? 'text-stone-500' : 'text-red-800'"
      >
        {{
          win
            ? state?.mode === 'spar'
              ? '切磋获胜!'
              : '大获全胜!'
            : fled
              ? '你逃出了战斗'
              : '败北……'
        }}
      </p>
      <div class="mt-2 flex justify-center gap-2">
        <button v-if="win && canAgain()" class="wl-btn" @click="emit('again')">再战</button>
        <button class="wl-btn wl-btn-ghost" @click="emit('leave')">离开战场</button>
      </div>
    </div>
  </div>
</template>
