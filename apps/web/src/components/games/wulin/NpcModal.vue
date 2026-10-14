<script setup lang="ts">
import { computed, ref } from 'vue'
import { itemById, npcById, sectById, skillById, SECTS } from '../../../games/wulin/data'
import { teachPotentialCost } from '../../../games/wulin/constants'
import { fmt } from '../../../games/wulin/format'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi; npcId: string }>()
const emit = defineEmits<{ close: []; fight: [npcId: string, mode: 'duel' | 'spar'] }>()

const def = npcById.get(props.npcId)
const char = computed(() => props.ui.save.char!)
const showShop = ref(false)
const showGift = ref(false)

const isSectMaster = computed(() => {
  const c = char.value
  return !!c.sect && sectById.get(c.sect)?.master === props.npcId
})

const recruiterSect = computed(() => SECTS.find((s) => s.master === props.npcId))

const teachList = computed(() => {
  if (!def) return []
  const c = char.value
  const ids = new Set<string>(def.teach ?? [])
  if (isSectMaster.value && c.sect) {
    for (const sid of sectById.get(c.sect)?.skills ?? []) ids.add(sid)
  }
  return [...ids].map((id) => {
    const sd = skillById.get(id)!
    const st = c.skills[id]
    const isBasic = sd.tier === 'basic'
    return {
      id,
      def: sd,
      learned: !!st,
      level: st?.level ?? 0,
      cost: isBasic ? (st ? teachPotentialCost(st.level) : 0) : sd.learn.potential,
      silver: isBasic ? 0 : sd.learn.silver,
      contribution: isBasic ? 0 : sd.learn.contribution,
      basic: isBasic,
    }
  })
})

const shopList = computed(() =>
  (def?.shop ?? []).map((s) => ({ ...s, name: itemById.get(s.id)?.name ?? s.id, desc: itemById.get(s.id)?.desc ?? '' })),
)

const giftItems = computed(() => {
  const c = char.value
  return Object.entries(c.bag)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, n, def: itemById.get(id) }))
    .filter((x) => x.def && (x.def.kind === 'consumable' || x.def.kind === 'material'))
})

const defeatedBoss = computed(() => def?.hostile && char.value && props.ui.save.progress.defeated.includes(props.npcId))

function talk(): void {
  const err = props.ui.sim.talkTo(props.npcId)
  if (err) props.ui.toast(err)
  else props.ui.toast(def?.dialog?.[0] ? '交谈完毕' : '对方点了点头。', true)
}

function teachTo(id: string): void {
  const err = props.ui.sim.teach(props.npcId, id)
  props.ui.toast(err ?? '有所收获。', !err)
}

function buy(id: string): void {
  const err = props.ui.sim.buy(props.npcId, id)
  props.ui.toast(err ?? '交易达成。', !err)
}

function give(id: string): void {
  const err = props.ui.sim.gift(props.npcId, id)
  props.ui.toast(err ?? '礼轻情意重。', !err)
}

function join(sectId: string): void {
  const err = props.ui.sim.joinSect(sectId)
  props.ui.toast(err ?? '拜师成功!', !err)
}

function fight(mode: 'duel' | 'spar'): void {
  emit('fight', props.npcId, mode)
}
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" @click.self="emit('close')">
    <div class="max-h-[86%] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#d8cdb2] bg-[#f7f2e6] p-4 shadow-xl sm:rounded-2xl">
      <template v-if="def">
        <header class="flex items-start justify-between">
          <div>
            <h3 class="font-serif text-lg font-bold text-stone-800">
              {{ def.name }}
              <span v-if="def.title" class="ml-1 text-xs font-normal text-stone-500">{{ def.title }}</span>
            </h3>
            <p class="text-[11px] text-stone-400">
              {{ def.hostile ? '可决斗' : '友善' }} · 约 {{ def.level }} 级身手
            </p>
          </div>
          <button class="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-200 hover:text-stone-600" @click="emit('close')">✕</button>
        </header>

        <div v-if="def.dialog?.length" class="mt-3 space-y-1.5 rounded-lg bg-white/70 p-3">
          <p v-for="(d, i) in def.dialog" :key="i" class="text-xs leading-relaxed text-stone-600">「{{ d }}」</p>
        </div>

        <p v-if="defeatedBoss" class="mt-3 rounded-lg bg-stone-200/70 p-2 text-center text-xs text-stone-500">
          此人已败于你手,江湖再见亦是点头之交。
        </p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button class="wl-btn" @click="talk">交谈</button>
          <button v-if="def.hostile && !defeatedBoss" class="wl-btn wl-btn-danger" @click="fight('duel')">决斗</button>
          <button v-if="!def.hostile && def.level > 10" class="wl-btn" @click="fight('spar')">切磋</button>
          <button v-if="def.shop?.length" class="wl-btn" @click="showShop = !showShop">交易</button>
          <button v-if="def.gift" class="wl-btn" @click="showGift = !showGift">送礼</button>
        </div>

        <!-- 拜师入口 -->
        <div v-if="recruiterSect && !char.sect" class="mt-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-3">
          <p class="text-sm font-semibold text-amber-900">拜入「{{ recruiterSect.name }}」</p>
          <p class="mt-1 text-[11px] leading-relaxed text-stone-500">{{ recruiterSect.desc }}</p>
          <p class="mt-1 text-[11px] text-stone-500">
            入门要求:
            <template v-if="recruiterSect.gender">{{ recruiterSect.gender === 'male' ? '男弟子' : '女弟子' }}</template>
            <template v-if="recruiterSect.requires">
              {{ Object.entries(recruiterSect.requires).map(([k, v]) => `先天${{ arm: '臂力', agi: '身法', bone: '根骨', ins: '悟性' }[k]} ≥ ${v}`).join('、') }}
            </template>
            <template v-if="!recruiterSect.gender && !recruiterSect.requires">无</template>
            <template v-if="recruiterSect.rebirthOnly"> · 需历经传承</template>
          </p>
          <button class="wl-btn mt-2" @click="join(recruiterSect.id)">拜师入门</button>
        </div>

        <!-- 请教 -->
        <div v-if="teachList.length" class="mt-3">
          <h4 class="text-sm font-semibold text-stone-700">请教武学</h4>
          <div class="mt-2 space-y-1.5">
            <div v-for="t in teachList" :key="t.id" class="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold text-stone-700">
                  {{ t.def.name }}
                  <span v-if="t.learned" class="text-[10px] text-stone-400">{{ t.level }} 级</span>
                </p>
                <p class="text-[10px] text-stone-400">
                  <template v-if="t.basic">{{ t.learned ? `请教一次 +5 级 · 潜能 ${fmt(t.cost)}` : '可免费入门' }}</template>
                  <template v-else>习得需 潜能 {{ fmt(t.cost) }}<template v-if="t.silver"> · 碎银 {{ fmt(t.silver) }}</template><template v-if="t.contribution"> · 贡献 {{ t.contribution }}</template></template>
                </p>
              </div>
              <button
                class="wl-btn shrink-0 !px-2.5 !py-1 text-[11px]"
                :disabled="char.potential < t.cost || (!t.basic && t.learned)"
                @click="teachTo(t.id)"
              >
                {{ t.learned && t.basic ? '请教' : t.learned ? '已习得' : '习得' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 商店 -->
        <div v-if="showShop" class="mt-3">
          <h4 class="text-sm font-semibold text-stone-700">货摊 <span class="text-xs font-normal text-stone-400">碎银 {{ fmt(char.silver) }}</span></h4>
          <div class="mt-2 grid grid-cols-1 gap-1.5">
            <div v-for="s in shopList" :key="s.id" class="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold text-stone-700">{{ s.name }}</p>
                <p class="truncate text-[10px] text-stone-400">{{ s.desc }}</p>
              </div>
              <button class="wl-btn shrink-0 !px-2.5 !py-1 text-[11px]" :disabled="char.silver < s.price" @click="buy(s.id)">
                {{ fmt(s.price) }}
              </button>
            </div>
          </div>
        </div>

        <!-- 送礼 -->
        <div v-if="showGift" class="mt-3">
          <h4 class="text-sm font-semibold text-stone-700">送礼</h4>
          <div class="mt-2 grid grid-cols-2 gap-1.5">
            <button
              v-for="g in giftItems"
              :key="g.id"
              class="rounded-lg bg-white/70 px-2 py-1.5 text-left text-xs text-stone-600 hover:bg-amber-50"
              @click="give(g.id)"
            >
              {{ g.def!.name }} ×{{ g.n }}
            </button>
            <p v-if="!giftItems.length" class="col-span-2 text-center text-[11px] text-stone-400">背包里没有可送的物品</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
