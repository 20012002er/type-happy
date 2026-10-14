<script setup lang="ts">
import { computed, ref } from 'vue'
import { PACE, REBIRTH_LEVELS, REBIRTH_POINTS } from '../../../games/wulin/constants'
import { originById, sectById } from '../../../games/wulin/data'
import { fmt, fmtDur } from '../../../games/wulin/format'
import {
  acquiredAttrs,
  charLevel,
  effectiveAttrs,
  evaluation,
  spiritMax,
} from '../../../games/wulin/sim/character'
import { exportSave, importSave, clearSave } from '../../../games/wulin/save'
import type { AttrKey, Pace } from '../../../games/wulin/types'
import type { WulinUi } from './context'

const props = defineProps<{ ui: WulinUi }>()

const char = computed(() => props.ui.save.char!)
const save = computed(() => props.ui.save)
const level = computed(() => charLevel(char.value))
const exp = computed(() => props.ui.sim.expProgress())
const eff = computed(() => effectiveAttrs(char.value))
const acq = computed(() => acquiredAttrs(char.value))
const evalScore = computed(() => evaluation(char.value))

const ATTRS: [AttrKey, string][] = [
  ['arm', '臂力'],
  ['agi', '身法'],
  ['bone', '根骨'],
  ['ins', '悟性'],
]

function alloc(k: AttrKey): void {
  const err = props.ui.sim.allocPoint(k)
  if (err) props.ui.toast(err)
}

// ---- 传承 ----
const rbStage = computed(() => save.value.rebirth.stage)
const rbLevel = computed(() =>
  char.value.rebirths < REBIRTH_LEVELS.length ? REBIRTH_LEVELS[char.value.rebirths] : null,
)
const rbPoints = computed(() =>
  char.value.rebirths < REBIRTH_POINTS.length ? REBIRTH_POINTS[char.value.rebirths] : 0,
)
const disciple = computed(() => save.value.rebirth.disciple)
const discipleLeft = computed(() => {
  void props.ui.now.value
  return props.ui.sim.discipleWait()
})
const discipleOk = computed(() => {
  void props.ui.now.value
  return props.ui.sim.discipleReady()
})
const dName = ref('')

function startRb(): void {
  const err = props.ui.sim.startRebirthQuest()
  if (!err) {
    props.ui.sim.travelTo('rb')
    props.ui.refreshMap()
    props.ui.toast('荒谷之行,就此启程。', true)
  } else {
    props.ui.toast(err)
  }
}

function gotoRb(): void {
  props.ui.sim.travelTo('rb')
  props.ui.refreshMap()
}

function trainD(k: AttrKey): void {
  const err = props.ui.sim.trainDisciple(k)
  props.ui.toast(err ?? '孺子可教。', !err)
}

function doRebirth(): void {
  const err = props.ui.sim.doRebirth(dName.value || char.value.name)
  if (!err) {
    props.ui.refreshMap()
    props.ui.toast('一世传承,重入江湖!', true)
  } else {
    props.ui.toast(err)
  }
}

// ---- 设置 ----
const showExport = ref(false)
const exportText = computed(() => (showExport.value ? exportSave(save.value) : ''))
const importText = ref('')

function setPace(p: Pace): void {
  save.value.settings.pace = p
  props.ui.toast(`已切换至「${PACE[p].label}」节奏,只影响之后的收益与冷却。`, true)
}

async function copyExport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportText.value)
    props.ui.toast('存档已复制到剪贴板。', true)
  } catch {
    props.ui.toast('复制失败,请手动全选复制')
  }
}

function doImport(): void {
  const s = importSave(importText.value)
  if (!s) {
    props.ui.toast('存档文本无效')
    return
  }
  localStorage.setItem('type-happy:wulin:v1', JSON.stringify(s))
  location.reload()
}

function doReset(): void {
  if (!confirm('确定重置存档?一世江湖将烟消云散。')) return
  clearSave()
  location.reload()
}
</script>

<template>
  <div class="space-y-3 p-3">
    <section class="wl-card">
      <div class="flex items-baseline justify-between">
        <h4 class="font-serif text-base font-bold text-stone-800">
          {{ char.name }}
          <span class="ml-1 text-[10px] font-normal text-stone-400">
            {{ originById.get(char.origin)?.name }} · {{ char.gender === 'male' ? '男' : '女' }}
            <template v-if="char.sect"> · {{ sectById.get(char.sect)?.name }}</template>
            <template v-if="char.rebirths > 0"> · {{ char.rebirths }} 世传承</template>
          </span>
        </h4>
        <span class="text-xs text-stone-500">Lv.{{ level }}</span>
      </div>
      <div class="mt-1.5 h-2 overflow-hidden rounded bg-stone-200">
        <div
          class="h-full rounded bg-emerald-600 transition-all"
          :style="{ width: `${exp.ratio * 100}%` }"
        />
      </div>
      <p class="mt-1 text-[10px] text-stone-400">
        总经验 {{ fmt(exp.cur) }} / {{ fmt(exp.next) }} · 综合评价
        <b class="text-amber-700">{{ evalScore }}</b> · 精神 {{ Math.floor(char.spirit) }}/{{
          spiritMax(char)
        }}
      </p>
      <div class="mt-2 grid grid-cols-4 gap-1.5">
        <div
          v-for="[k, label] in ATTRS"
          :key="k"
          class="rounded-lg bg-[#f1ead8] px-2 py-1.5 text-center"
        >
          <p class="text-[10px] text-stone-400">{{ label }}</p>
          <p class="font-serif text-sm font-bold text-stone-800">{{ eff[k].toFixed(1) }}</p>
          <p class="text-[9px] text-stone-400">
            先天 {{ char.innate[k] + char.rebirthAttrs[k]
            }}<template v-if="acq[k]"> + 后天 {{ acq[k] }}</template>
          </p>
        </div>
      </div>
      <div
        v-if="char.attrPoints > 0"
        class="mt-2 rounded-lg border border-amber-300/70 bg-amber-50 p-2"
      >
        <p class="text-[11px] font-semibold text-amber-900">
          可分配先天属性点:{{ char.attrPoints }}
        </p>
        <div class="mt-1 flex gap-1.5">
          <button
            v-for="[k, label] in ATTRS"
            :key="k"
            class="wl-btn wl-btn-gold !px-2.5 !py-1 text-[11px]"
            @click="alloc(k)"
          >
            {{ label }} +1
          </button>
        </div>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5 text-[10px] text-stone-500">
        <span class="rounded bg-[#f1ead8] px-2 py-1">容貌 {{ char.appearance }}</span>
        <span class="rounded bg-[#f1ead8] px-2 py-1">福缘 {{ char.fortune }}</span>
        <span class="rounded bg-[#f1ead8] px-2 py-1">威望 {{ fmt(char.prestige) }}</span>
        <span class="rounded bg-[#f1ead8] px-2 py-1">阅历 {{ fmt(char.experience) }}</span>
        <span class="rounded bg-[#f1ead8] px-2 py-1">伤势 {{ Math.round(char.injury) }}</span>
      </div>
    </section>

    <!-- 传承 -->
    <section class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">
        传承 · {{ char.rebirths }}/3 世
        <span v-if="rbLevel" class="ml-1 text-[10px] text-stone-400"
          >({{ rbLevel }} 级可开启,得 {{ rbPoints }} 属性点)</span
        >
      </h4>
      <template v-if="char.rebirths >= 3">
        <p class="mt-1.5 text-xs text-stone-500">三世传承已尽,此生江湖,圆满自持。</p>
      </template>
      <template v-else-if="rbStage === 0">
        <p class="mt-1.5 text-[11px] leading-relaxed text-stone-500">
          等级达标后开启传承试炼:传闻城北荒谷有孩童被恶徒掳走。救出他、将他培养成才,便可传其衣钵、以新身重入江湖——武学清空、门派可换,但物品、书籍、先天属性与福缘容貌尽数保留。
        </p>
        <button
          class="wl-btn wl-btn-gold mt-2 !px-3 !py-1.5 text-xs"
          :disabled="!ui.sim.rebirthAvailable()"
          @click="startRb"
        >
          {{ level >= (rbLevel ?? 9999) ? '动身前往荒谷' : `等级不足(${level}/${rbLevel})` }}
        </button>
      </template>
      <template v-else-if="rbStage === 1">
        <p class="mt-1.5 text-[11px] text-stone-500">
          荒谷中传来孩童的啼哭。击败石殿中的铁面判官,救出孩子。
        </p>
        <button class="wl-btn mt-2 !px-3 !py-1 text-[11px]" @click="gotoRb">前往荒谷</button>
      </template>
      <template v-else-if="rbStage === 2 && disciple">
        <p class="mt-1.5 text-[11px] text-stone-500">
          孩子已解救。将他四维培养圆满(每项 100),即可确认传承。
        </p>
        <div class="mt-2 grid grid-cols-4 gap-1.5">
          <div
            v-for="[k, label] in ATTRS"
            :key="k"
            class="rounded-lg bg-[#f1ead8] px-2 py-1.5 text-center"
          >
            <p class="text-[10px] text-stone-400">{{ label }}</p>
            <p
              class="font-serif text-sm font-bold"
              :class="disciple.attrs[k] >= 100 ? 'text-emerald-700' : 'text-stone-800'"
            >
              {{ disciple.attrs[k] }}
            </p>
            <button
              class="wl-btn wl-btn-ghost mt-1 w-full !px-1 !py-0.5 text-[10px]"
              :disabled="discipleLeft > 0"
              @click="trainD(k)"
            >
              {{ discipleLeft > 0 ? fmtDur(discipleLeft * 1000) : '教导' }}
            </button>
          </div>
        </div>
        <div v-if="discipleOk" class="mt-2 rounded-lg border border-amber-300/70 bg-amber-50 p-2">
          <p class="text-[11px] font-semibold text-amber-900">四维圆满,可承衣钵。</p>
          <div class="mt-1.5 flex gap-1.5">
            <input
              v-model="dName"
              :placeholder="`传人姓名(默认随你:${char.name})`"
              maxlength="8"
              class="min-w-0 flex-1 rounded-lg border border-[#d8cdb2] bg-white px-2 py-1.5 text-xs outline-none focus:border-amber-600"
            />
            <button class="wl-btn wl-btn-gold !px-3 !py-1.5 text-xs" @click="doRebirth">
              确认传承
            </button>
          </div>
        </div>
      </template>
    </section>

    <!-- 设置 -->
    <section class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">设置</h4>
      <div class="mt-2 space-y-2">
        <label class="flex items-center justify-between text-xs text-stone-600">
          音效
          <input v-model="save.settings.sound" type="checkbox" class="h-4 w-4 accent-amber-700" />
        </label>
        <div class="flex items-center justify-between text-xs text-stone-600">
          节奏
          <span class="flex gap-1">
            <button
              class="wl-btn !px-2.5 !py-1 text-[11px]"
              :class="save.settings.pace === 'fast' ? 'wl-btn-gold' : 'wl-btn-ghost'"
              @click="setPace('fast')"
            >
              速成(×5)
            </button>
            <button
              class="wl-btn !px-2.5 !py-1 text-[11px]"
              :class="save.settings.pace === 'standard' ? 'wl-btn-gold' : 'wl-btn-ghost'"
              @click="setPace('standard')"
            >
              标准
            </button>
          </span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            class="wl-btn wl-btn-ghost !px-2.5 !py-1 text-[11px]"
            @click="showExport = !showExport"
          >
            导出/导入存档
          </button>
          <button class="wl-btn wl-btn-danger !px-2.5 !py-1 text-[11px]" @click="doReset">
            重置存档
          </button>
        </div>
        <div v-if="showExport" class="space-y-2 rounded-lg bg-white/70 p-2">
          <textarea
            readonly
            class="h-16 w-full resize-none rounded border border-[#d8cdb2] bg-white p-1.5 text-[10px] text-stone-500"
            :value="exportText"
          />
          <button class="wl-btn !px-2.5 !py-1 text-[11px]" @click="copyExport">复制存档</button>
          <textarea
            v-model="importText"
            placeholder="粘贴存档文本后点导入"
            class="h-16 w-full resize-none rounded border border-[#d8cdb2] bg-white p-1.5 text-[10px] text-stone-500"
          />
          <button class="wl-btn wl-btn-ghost !px-2.5 !py-1 text-[11px]" @click="doImport">
            导入存档(将刷新页面)
          </button>
        </div>
      </div>
    </section>

    <!-- 日志 -->
    <section class="wl-card">
      <h4 class="text-xs font-semibold text-stone-500">江湖日志</h4>
      <div class="wl-scroll mt-1.5 max-h-48 space-y-1 overflow-y-auto">
        <p
          v-for="(l, i) in [...save.log].reverse()"
          :key="i"
          class="font-serif text-[11px] leading-relaxed text-stone-500"
        >
          · {{ l }}
        </p>
        <p v-if="!save.log.length" class="py-3 text-center text-[11px] text-stone-300">
          江湖故事,自你落笔。
        </p>
      </div>
    </section>
  </div>
</template>
