<script setup lang="ts">
import { computed } from 'vue'
import { BAG_CAP_MAX, bagUpgradeCost } from '../../../games/wulin/constants'
import { itemById } from '../../../games/wulin/data'
import { fmt } from '../../../games/wulin/format'
import type { ArmorSlot } from '../../../games/wulin/types'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi }>()

const char = computed(() => props.ui.save.char!)

const ARMOR_SLOTS: [ArmorSlot, string][] = [
  ['head', '头部'],
  ['body', '身躯'],
  ['hands', '手臂'],
  ['legs', '腿足'],
  ['feet', '足下'],
]

const bagList = computed(() => {
  const order = { weapon: 0, armor: 1, consumable: 2, material: 3, page: 4, quest: 5 } as const
  return Object.entries(char.value.bag)
    .filter(([id, n]) => n > 0 && itemById.get(id))
    .map(([id, n]) => ({ id, n, def: itemById.get(id)! }))
    .sort(
      (a, b) =>
        (order[a.def.kind as keyof typeof order] ?? 9) -
        (order[b.def.kind as keyof typeof order] ?? 9),
    )
})

const bagCount = computed(() => bagList.value.length)
const upgradeCost = computed(() => bagUpgradeCost(char.value.bagCap))

function use(id: string): void {
  const err = props.ui.sim.useItem(id)
  props.ui.toast(err ?? '用掉了。', !err)
}

function equipW(id: string): void {
  const err = props.ui.sim.equipWeapon(id)
  props.ui.toast(err ?? '换上了武器。', !err)
}

function equipA(id: string): void {
  const err = props.ui.sim.equipArmor(id)
  props.ui.toast(err ?? '换上了防具。', !err)
}

function sell(id: string): void {
  const err = props.ui.sim.sell(id, 1)
  props.ui.toast(err ?? '卖掉了。', !err)
}

function upgrade(): void {
  const err = props.ui.sim.upgradeBag()
  props.ui.toast(err ?? '背包扩容成功。', !err)
}

function unequipW(): void {
  props.ui.sim.unequipWeapon()
}

function unequipA(slot: ArmorSlot): void {
  props.ui.sim.unequipArmor(slot)
}

function armorDef(id: string | undefined) {
  return id ? itemById.get(id) : undefined
}
</script>

<template>
  <div class="space-y-3 p-3">
    <section class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">穿戴</h4>
      <div class="mt-2 flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
        <div>
          <p class="text-xs font-semibold text-stone-700">
            兵刃:{{ char.weapon ? itemById.get(char.weapon)?.name : '空手' }}
          </p>
          <p v-if="char.weapon" class="text-[10px] text-stone-400">
            攻击 +{{ itemById.get(char.weapon)?.weapon?.atk }} · 重量
            {{ itemById.get(char.weapon)?.weapon?.weight }}
          </p>
        </div>
        <button
          v-if="char.weapon"
          class="wl-btn wl-btn-ghost !px-2 !py-1 text-[11px]"
          @click="unequipW"
        >
          卸下
        </button>
      </div>
      <div class="mt-1.5 grid grid-cols-1 gap-1.5">
        <div
          v-for="[slot, label] in ARMOR_SLOTS"
          :key="slot"
          class="flex items-center justify-between rounded-lg bg-white/70 px-3 py-1.5"
        >
          <p class="text-xs text-stone-600">
            {{ label }}:
            <b class="text-stone-800">{{ armorDef(char.armor[slot])?.name ?? '无' }}</b>
            <span v-if="armorDef(char.armor[slot])?.armor" class="text-[10px] text-stone-400">
              防 +{{ armorDef(char.armor[slot])?.armor?.def }} 护 +{{
                armorDef(char.armor[slot])?.armor?.prot
              }}
            </span>
          </p>
          <button
            v-if="char.armor[slot]"
            class="wl-btn wl-btn-ghost !px-2 !py-0.5 text-[10px]"
            @click="unequipA(slot)"
          >
            卸下
          </button>
        </div>
      </div>
    </section>

    <section class="wl-card">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold text-stone-500">背包 {{ bagCount }}/{{ char.bagCap }}</h4>
        <button
          v-if="char.bagCap < BAG_CAP_MAX"
          class="wl-btn wl-btn-ghost !px-2 !py-1 text-[11px]"
          :disabled="char.silver < upgradeCost"
          @click="upgrade"
        >
          扩容 +5(碎银 {{ fmt(upgradeCost) }})
        </button>
      </div>
      <div class="mt-2 space-y-1.5">
        <div v-for="it in bagList" :key="it.id" class="rounded-lg bg-white/70 px-3 py-2">
          <div class="flex items-baseline justify-between">
            <p class="text-xs font-semibold text-stone-700">
              {{ it.def.name }} <span class="text-stone-400">×{{ it.n }}</span>
              <span v-if="it.def.weapon" class="ml-1 text-[10px] text-stone-400"
                >攻+{{ it.def.weapon.atk }}</span
              >
              <span v-if="it.def.armor" class="ml-1 text-[10px] text-stone-400"
                >防+{{ it.def.armor.def }}</span
              >
            </p>
            <div class="flex shrink-0 gap-1">
              <button
                v-if="it.def.kind === 'weapon'"
                class="wl-btn !px-2 !py-0.5 text-[10px]"
                @click="equipW(it.id)"
              >
                装备
              </button>
              <button
                v-if="it.def.kind === 'armor'"
                class="wl-btn !px-2 !py-0.5 text-[10px]"
                @click="equipA(it.id)"
              >
                装备
              </button>
              <button
                v-if="it.def.kind === 'consumable'"
                class="wl-btn !px-2 !py-0.5 text-[10px]"
                @click="use(it.id)"
              >
                使用
              </button>
              <button
                v-if="it.def.kind !== 'quest'"
                class="wl-btn wl-btn-ghost !px-2 !py-0.5 text-[10px]"
                @click="sell(it.id)"
              >
                卖{{ fmt(Math.max(1, Math.floor((it.def.price ?? 10) * 0.5))) }}
              </button>
            </div>
          </div>
          <p class="mt-0.5 text-[10px] leading-snug text-stone-400">{{ it.def.desc }}</p>
        </div>
        <p v-if="!bagList.length" class="py-6 text-center text-xs text-stone-400">背包空空如也</p>
      </div>
    </section>
  </div>
</template>
