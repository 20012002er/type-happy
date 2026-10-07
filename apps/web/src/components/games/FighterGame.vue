<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import FighterSprite from './FighterSprite.vue'
import {
  MOVE_LABEL,
  useFightGame,
  type FighterPose,
  type Move,
} from '../../composables/useFightGame'
import { useGamesStore } from '../../stores/games'
import { formatDuration } from '../../utils/format'

const GAME_ID = 'fighter'
const games = useGamesStore()

const isNewBest = ref(false)

const fight = useFightGame({
  onGameOver: () => {
    isNewBest.value = games.recordScore(GAME_ID, fight.score.value, fight.bestCombo.value)
  },
})

const best = computed(() => games.bestOf(GAME_ID))

// ===== 视觉状态 =====
const poseRyu = ref<FighterPose>('idle')
const poseKen = ref<FighterPose>('idle')
const animR = ref<{ id: number; cls: string } | null>(null)
const animK = ref<{ id: number; cls: string } | null>(null)
const flashR = ref(false)
const flashK = ref(false)
const shake = ref(false)
const wrongFlash = ref(false)
const proj = ref<{ id: number; by: 'ryu' | 'ken' } | null>(null)
const toast = ref<{
  id: number
  by: 'ryu' | 'ken'
  move: Move
  dmg: number
  success: boolean
} | null>(null)
const fx = ref<{ id: number; who: 'ryu' | 'ken'; dmg: number } | null>(null)

const timers = new Set<ReturnType<typeof setTimeout>>()
function later(ms: number, fn: () => void): void {
  const t = setTimeout(() => {
    timers.delete(t)
    fn()
  }, ms)
  timers.add(t)
}
onBeforeUnmount(() => {
  for (const t of timers) clearTimeout(t)
})

const ANIM_CLS: Record<Move, string> = {
  hadouken: 'anim-lunge',
  shoryuken: 'anim-shoryu',
  tatsumaki: 'anim-tatsu',
}

// 出招:姿势 + 位移动画 + 气功弹 + 招式名提示
watch(fight.attack, (a) => {
  if (!a) return
  const pose = a.by === 'ryu' ? poseRyu : poseKen
  const anim = a.by === 'ryu' ? animR : animK
  pose.value = a.move
  anim.value = { id: a.id, cls: ANIM_CLS[a.move] }
  later(950, () => {
    if (anim.value?.id === a.id) anim.value = null
    if (pose.value === a.move) pose.value = 'idle'
  })
  if (a.move === 'hadouken') {
    proj.value = { id: a.id, by: a.by }
    later(560, () => {
      if (proj.value?.id === a.id) proj.value = null
    })
  }
  toast.value = { id: a.id, by: a.by, move: a.move, dmg: a.dmg, success: a.success }
  later(1200, () => {
    if (toast.value?.id === a.id) toast.value = null
  })
})

// 命中:受击姿势 + 红闪 + 打击特效 + 重击震屏
watch(fight.hurt, (h) => {
  if (!h) return
  if (h.who === 'ryu') {
    poseRyu.value = 'hurt'
    flashR.value = true
    later(480, () => (flashR.value = false))
    later(540, () => {
      if (poseRyu.value === 'hurt') poseRyu.value = 'idle'
    })
  } else {
    poseKen.value = 'hurt'
    flashK.value = true
    later(480, () => (flashK.value = false))
    later(540, () => {
      if (poseKen.value === 'hurt') poseKen.value = 'idle'
    })
  }
  fx.value = { id: h.id, who: h.who, dmg: h.dmg }
  later(900, () => {
    if (fx.value?.id === h.id) fx.value = null
  })
  if (h.dmg >= 15) {
    shake.value = true
    later(340, () => (shake.value = false))
  }
})

// K.O.:败者倒地
watch(fight.koWinner, (w) => {
  if (!w) return
  if (w === 'ryu') poseKen.value = 'ko'
  else poseRyu.value = 'ko'
})

// 打错键:红色警示
watch(fight.wrongSignal, () => {
  wrongFlash.value = true
  later(380, () => (wrongFlash.value = false))
})

// 重开:清空视觉状态
watch(fight.phase, (p) => {
  if (p !== 'intro') return
  poseRyu.value = 'idle'
  poseKen.value = 'idle'
  animR.value = null
  animK.value = null
  flashR.value = false
  flashK.value = false
  proj.value = null
  toast.value = null
  fx.value = null
})

watch(fight.status, (s) => {
  if (s === 'running') isNewBest.value = false
})

// ===== 派生显示 =====
const timePct = computed(() =>
  Math.max(0, Math.min(100, (fight.timeLeft.value / fight.timeLimit.value) * 100)),
)
const timerText = computed(() =>
  fight.phase.value === 'word' ? String(Math.ceil(fight.timeLeft.value)) : '—',
)
const timeUrgent = computed(() => fight.phase.value === 'word' && fight.timeLeft.value < 2)
const timeBarColor = computed(() =>
  timePct.value > 50 ? 'bg-emerald-400' : timePct.value > 25 ? 'bg-amber-400' : 'bg-rose-500',
)
const chars = computed(() => fight.word.value.split(''))
const koRyu = computed(() => fight.koWinner.value === 'ken')
const koKen = computed(() => fight.koWinner.value === 'ryu')
const hint = computed(() => {
  const m: Move =
    fight.tier.value === 0 ? 'hadouken' : fight.tier.value === 1 ? 'tatsumaki' : 'shoryuken'
  const dmg = [8, 12, 16][fight.tier.value]
  return { zh: MOVE_LABEL[m].zh, dmg }
})
const canPause = computed(
  () =>
    (fight.status.value === 'running' && fight.phase.value === 'word') ||
    fight.status.value === 'paused',
)

function hpColor(hp: number): string {
  return hp > 50
    ? 'bg-gradient-to-r from-yellow-300 to-lime-400'
    : hp > 25
      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
      : 'bg-gradient-to-r from-red-500 to-rose-500'
}

const howTo = [
  '屏幕随机出现英文单词,在倒计时内完整打出即可出招。',
  '短词(3-5 字母)→ 波动拳 8 伤害;中词(6-8)→ 龙卷旋风脚 12;长词(9+)→ 升龙拳 16。',
  '连续打对触发连击,每连一击额外 +1 伤害(最多 +4)。',
  '打错任意字母或超时,肯会随机出招反击,单词越难反击越痛。',
  '双方各 100 血,先打空对方血量者获胜(K.O.)。',
]
</script>

<template>
  <div
    class="relative h-[66vh] max-h-[660px] min-h-[440px] w-full select-none overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
    :class="shake ? 'game-shake' : ''"
  >
    <!-- 背景:黄昏天空 + 太阳 + 远山 + 宝塔 + 樱花 -->
    <div
      class="absolute inset-0 z-0"
      style="
        background: linear-gradient(
          to bottom,
          #1e1b4b 0%,
          #6d28d9 26%,
          #db2777 47%,
          #f97316 70%,
          #fcd34d 88%
        );
      "
    />
    <div
      class="cloud-drift absolute top-[10%] z-0 h-6 w-28 rounded-full bg-rose-300/40 blur-[2px]"
      style="animation-duration: 52s"
    />
    <div
      class="cloud-drift absolute top-[20%] z-0 h-5 w-20 rounded-full bg-orange-200/30 blur-[2px]"
      style="animation-duration: 70s; animation-delay: -24s"
    />
    <div
      class="absolute bottom-[22%] left-[64%] z-0 h-32 w-32 rounded-full bg-amber-200/80 blur-[2px]"
    />
    <svg
      viewBox="0 0 800 120"
      preserveAspectRatio="none"
      class="absolute inset-x-0 bottom-[16%] z-0 h-[20%]"
      aria-hidden="true"
    >
      <path d="M0 120 L130 34 L280 120 Z" fill="#4c1d95" opacity="0.55" />
      <path d="M200 120 L360 52 L560 120 Z" fill="#4c1d95" opacity="0.4" />
      <path d="M520 120 L680 40 L800 120 Z" fill="#4c1d95" opacity="0.5" />
    </svg>
    <!-- 宝塔剪影 -->
    <svg
      viewBox="0 0 120 150"
      class="absolute bottom-[16%] left-[5%] z-0 h-[36%] opacity-80"
      aria-hidden="true"
    >
      <g fill="#312e81">
        <rect x="42" y="96" width="36" height="54" />
        <path d="M22 96 L98 96 L84 80 L36 80 Z" />
        <rect x="48" y="52" width="24" height="28" />
        <path d="M32 52 L88 52 L76 38 L44 38 Z" />
        <rect x="54" y="18" width="12" height="20" />
        <path d="M42 18 L78 18 L68 8 L52 8 Z" />
        <rect x="58" y="0" width="4" height="8" />
      </g>
    </svg>
    <!-- 鸟居剪影 -->
    <svg
      viewBox="0 0 100 90"
      class="absolute bottom-[16%] right-[7%] z-0 h-[20%] opacity-75"
      aria-hidden="true"
    >
      <g fill="#312e81">
        <path d="M6 12 L94 12 L90 22 L10 22 Z" />
        <rect x="14" y="26" width="72" height="7" />
        <rect x="20" y="26" width="9" height="64" />
        <rect x="71" y="26" width="9" height="64" />
      </g>
    </svg>
    <!-- 花瓣 -->
    <div class="petal-fall absolute left-[24%] top-[6%] z-0 h-2 w-2 rounded-full bg-pink-200/80" />
    <div
      class="petal-fall absolute left-[52%] top-[2%] z-0 h-1.5 w-1.5 rounded-full bg-pink-100/70"
      style="animation-delay: -2.4s; animation-duration: 8.5s"
    />
    <div
      class="petal-fall absolute left-[78%] top-[10%] z-0 h-2 w-2 rounded-full bg-pink-200/70"
      style="animation-delay: -4.8s; animation-duration: 9.5s"
    />
    <!-- 地面 -->
    <div
      class="absolute inset-x-0 bottom-0 z-0 h-[16%] border-t-2 border-amber-200/50 bg-gradient-to-b from-stone-500 to-stone-700"
    >
      <div class="absolute inset-x-0 top-1/3 h-px bg-white/15" />
      <div class="absolute inset-x-0 top-2/3 h-px bg-black/15" />
    </div>

    <!-- 角色影子 -->
    <div
      class="absolute bottom-[14.6%] left-[9%] z-[5] h-3 w-[15%] max-w-40 rounded-[50%] bg-black/35 blur-[3px]"
    />
    <div
      class="absolute bottom-[14.6%] right-[9%] z-[5] h-3 w-[15%] max-w-40 rounded-[50%] bg-black/35 blur-[3px]"
    />

    <!-- 隆(玩家,左侧) -->
    <div class="absolute bottom-[15.5%] left-[7%] z-10 aspect-[5/7] h-[48%]">
      <div
        :key="animR ? 'a' + animR.id : 'r-idle'"
        class="h-full w-full"
        :class="[animR?.cls, koRyu ? 'fighter-ko' : 'fighter-stand']"
      >
        <div
          class="h-full w-full"
          :class="[flashR ? 'hurt-flash' : '', !animR && !koRyu ? 'fighter-breathe' : '']"
        >
          <FighterSprite char="ryu" :pose="poseRyu" />
        </div>
      </div>
    </div>

    <!-- 肯(对手,右侧,水平镜像) -->
    <div
      class="absolute bottom-[15.5%] right-[7%] z-10 aspect-[5/7] h-[48%]"
      style="transform: scaleX(-1)"
    >
      <div
        :key="animK ? 'a' + animK.id : 'k-idle'"
        class="h-full w-full"
        :class="[animK?.cls, koKen ? 'fighter-ko' : 'fighter-stand']"
      >
        <div
          class="h-full w-full"
          :class="[flashK ? 'hurt-flash' : '', !animK && !koKen ? 'fighter-breathe' : '']"
        >
          <FighterSprite char="ken" :pose="poseKen" />
        </div>
      </div>
    </div>

    <!-- 波动拳气功弹 -->
    <div
      v-if="proj"
      :key="proj.id"
      class="pointer-events-none absolute bottom-[38%] z-20 h-12 w-12"
      :class="proj.by === 'ryu' ? 'proj-ryu' : 'proj-ken'"
    >
      <div
        class="absolute inset-0 rounded-full blur-md"
        :class="proj.by === 'ryu' ? 'bg-cyan-400/85' : 'bg-amber-400/85'"
      />
      <div class="absolute inset-[16%] rounded-full bg-white/95 blur-[1px]" />
      <div
        class="absolute inset-[34%] rounded-full"
        :class="proj.by === 'ryu' ? 'bg-sky-200' : 'bg-yellow-100'"
      />
    </div>

    <!-- 命中特效:冲击环 + 伤害数字 -->
    <div
      v-if="fx"
      :key="fx.id"
      class="pointer-events-none absolute bottom-[42%] z-20 h-0 w-0"
      :class="fx.who === 'ken' ? 'right-[14%]' : 'left-[14%]'"
    >
      <div
        class="game-burst absolute left-0 top-0 h-16 w-16 rounded-full border-4 border-white/85"
      />
      <div
        class="game-float absolute left-0 top-0 text-2xl font-black tabular-nums"
        :class="fx.who === 'ken' ? 'text-amber-300' : 'text-rose-400'"
        style="text-shadow: 0 2px 0 rgba(0, 0, 0, 0.55)"
      >
        -{{ fx.dmg }}
      </div>
    </div>

    <!-- 招式名提示 -->
    <div
      v-if="toast"
      :key="toast.id"
      class="pointer-events-none absolute inset-x-0 bottom-[27%] z-20 text-center"
    >
      <div
        class="move-toast inline-block text-2xl font-black italic tracking-wide sm:text-3xl"
        :class="toast.success ? 'text-amber-300' : 'text-rose-300'"
        style="
          text-shadow:
            0 2px 0 #431407,
            0 0 18px rgba(0, 0, 0, 0.65);
        "
      >
        {{ toast.by === 'ken' ? '肯 · ' : '' }}{{ MOVE_LABEL[toast.move].zh }}!
        <span class="text-sm font-bold sm:text-base">{{ MOVE_LABEL[toast.move].en }}</span>
      </div>
      <div
        class="mt-0.5 text-xs font-bold sm:text-sm"
        :class="toast.success ? 'text-emerald-300' : 'text-rose-200'"
        style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7)"
      >
        {{ toast.success ? `命中!伤害 ${toast.dmg}` : `打错了,被反击!伤害 ${toast.dmg}` }}
      </div>
    </div>

    <!-- 顶部 HUD:血条 + 计时 + 分数 -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3">
      <!-- 隆血条 -->
      <div class="w-[38%] max-w-xs flex-1">
        <div class="mb-1 flex items-baseline gap-2">
          <span class="text-sm font-black tracking-wide text-white drop-shadow">RYU 隆</span>
          <span
            v-if="fight.combo.value > 1"
            class="rounded-full bg-amber-400/90 px-1.5 text-[11px] font-bold text-amber-950"
          >
            连击 ×{{ fight.combo.value }}
          </span>
        </div>
        <div
          class="relative h-4 overflow-hidden rounded-md border-2 border-slate-900/70 bg-slate-800/85"
        >
          <div
            class="hp-ghost absolute inset-y-0 left-0"
            :style="{ width: fight.hpRyu.value + '%' }"
          />
          <div
            class="absolute inset-y-0 left-0"
            :class="hpColor(fight.hpRyu.value)"
            :style="{ width: fight.hpRyu.value + '%' }"
          />
        </div>
      </div>

      <!-- 中央计时 -->
      <div class="mt-0.5 flex w-16 shrink-0 flex-col items-center">
        <div
          class="rounded-lg border-2 border-slate-900/70 bg-slate-800/85 px-2 py-0.5 text-center"
        >
          <span
            class="text-xl font-black tabular-nums leading-tight"
            :class="timeUrgent ? 'animate-pulse text-rose-400' : 'text-yellow-300'"
          >
            {{ timerText }}
          </span>
        </div>
        <span class="mt-0.5 text-[10px] font-bold tabular-nums text-white/80 drop-shadow">
          伤害 {{ fight.score.value }}
        </span>
      </div>

      <!-- 肯血条 -->
      <div class="flex w-[38%] max-w-xs flex-1 flex-col items-end">
        <div class="mb-1 flex items-baseline gap-2">
          <span class="text-sm font-black tracking-wide text-white drop-shadow">KEN 肯</span>
        </div>
        <div
          class="relative h-4 w-full overflow-hidden rounded-md border-2 border-slate-900/70 bg-slate-800/85"
        >
          <div
            class="hp-ghost absolute inset-y-0 right-0"
            :style="{ width: fight.hpKen.value + '%' }"
          />
          <div
            class="absolute inset-y-0 right-0"
            :class="hpColor(fight.hpKen.value)"
            :style="{ width: fight.hpKen.value + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- 右下角控制按钮 -->
    <div class="absolute bottom-2 right-3 z-30 flex items-center gap-1.5">
      <button
        type="button"
        class="rounded-lg border border-white/40 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-40"
        :disabled="!canPause"
        @click="fight.togglePause()"
      >
        {{ fight.status.value === 'paused' ? '继续' : '暂停' }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-white/40 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
        @click="fight.restart()"
      >
        重开
      </button>
    </div>

    <!-- 单词输入面板 -->
    <div
      v-if="fight.status.value === 'running' && fight.phase.value === 'word'"
      class="pointer-events-none absolute inset-x-0 bottom-[3%] z-20 flex flex-col items-center gap-2 px-4"
    >
      <div
        class="flex items-center gap-2 rounded-xl bg-slate-900/75 px-4 py-2.5 shadow-lg backdrop-blur"
      >
        <span
          class="mr-1 hidden rounded-md bg-amber-400/90 px-2 py-0.5 text-[11px] font-bold text-amber-950 sm:inline"
        >
          {{ hint.zh }} ×{{ hint.dmg }}
        </span>
        <span
          v-for="(ch, i) in chars"
          :key="i"
          class="flex h-8 w-6 items-center justify-center rounded-md font-mono text-lg font-bold uppercase sm:h-10 sm:w-8 sm:text-2xl"
          :class="
            i < fight.typed.value
              ? 'bg-emerald-500 text-white'
              : i === fight.typed.value
                ? 'bg-white text-slate-900 ring-2 ring-amber-400'
                : 'bg-white/10 text-white/85'
          "
        >
          {{ ch }}
        </span>
      </div>
      <div class="h-1.5 w-56 overflow-hidden rounded-full bg-black/45 sm:w-72">
        <div class="h-full rounded-full" :class="timeBarColor" :style="{ width: timePct + '%' }" />
      </div>
    </div>

    <!-- 打错键红色警示 -->
    <div
      v-if="wrongFlash"
      class="pointer-events-none absolute inset-0 z-30 rounded-2xl"
      style="
        box-shadow:
          inset 0 0 0 4px rgba(244, 63, 94, 0.75),
          inset 0 0 46px rgba(244, 63, 94, 0.35);
      "
    />

    <!-- ROUND / FIGHT / K.O. 横幅 -->
    <div
      v-if="fight.banner.value && (fight.phase.value === 'intro' || fight.phase.value === 'ko')"
      class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      <div
        :key="fight.banner.value.id"
        class="fight-banner text-5xl font-black italic tracking-wider sm:text-6xl"
        :class="fight.banner.value.text === 'K.O.' ? 'text-rose-500' : 'text-yellow-300'"
        style="
          text-shadow:
            0 3px 0 #431407,
            0 0 26px rgba(0, 0, 0, 0.7);
        "
      >
        {{ fight.banner.value.text }}
      </div>
    </div>

    <!-- 覆盖层:开始 / 暂停 / 结算 -->
    <div
      v-if="fight.status.value !== 'running'"
      class="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-white/60 bg-white/95 p-6 text-center shadow-2xl"
      >
        <!-- 开始 -->
        <template v-if="fight.status.value === 'idle'">
          <h2 class="text-xl font-bold text-slate-900">🥋 打字街霸 · 隆 VS 肯</h2>
          <p class="mt-1 text-xs text-slate-400">用打字出招,先打空对方血量!</p>
          <ul class="mx-auto mt-4 space-y-1.5 text-left text-sm text-slate-600">
            <li v-for="(line, i) in howTo" :key="i" class="flex gap-2">
              <span class="mt-0.5 text-slate-300">•</span>
              <span>{{ line }}</span>
            </li>
          </ul>
          <button
            type="button"
            class="mt-5 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-rose-500 active:scale-[0.99]"
            @click="fight.start()"
          >
            开始对战
          </button>
          <p class="mt-2 text-[11px] text-slate-400">或按 空格 / 回车 开始,Esc 暂停</p>
        </template>

        <!-- 暂停 -->
        <template v-else-if="fight.status.value === 'paused'">
          <h2 class="text-xl font-bold text-slate-900">已暂停</h2>
          <p class="mt-1 text-sm text-slate-500">
            隆 {{ fight.hpRyu.value }} : {{ fight.hpKen.value }} 肯
          </p>
          <div class="mt-5 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-rose-500"
              @click="fight.resume()"
            >
              继续
            </button>
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              @click="fight.restart()"
            >
              重开
            </button>
          </div>
          <p class="mt-2 text-[11px] text-slate-400">按 Esc / 空格 继续</p>
        </template>

        <!-- 结算 -->
        <template v-else>
          <div
            v-if="isNewBest"
            class="mx-auto mb-2 w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
          >
            🎉 新纪录!
          </div>
          <h2
            class="text-2xl font-black italic"
            :class="fight.koWinner.value === 'ryu' ? 'text-emerald-600' : 'text-rose-600'"
          >
            {{ fight.koWinner.value === 'ryu' ? '🏆 胜利! YOU WIN' : '💀 败北… YOU LOSE' }}
          </h2>
          <div class="mt-4 rounded-xl bg-slate-50 p-4">
            <div class="text-xs text-slate-400">总输出伤害</div>
            <div class="text-4xl font-black tabular-nums text-rose-600">
              {{ fight.score.value }}
            </div>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-slate-50 py-2">
              <div class="text-lg font-bold tabular-nums text-emerald-600">
                {{ fight.cleared.value }}
              </div>
              <div class="text-[11px] text-slate-400">打对单词</div>
            </div>
            <div class="rounded-lg bg-slate-50 py-2">
              <div class="text-lg font-bold tabular-nums text-amber-600">
                {{ fight.bestCombo.value }}
              </div>
              <div class="text-[11px] text-slate-400">最高连击</div>
            </div>
            <div class="rounded-lg bg-slate-50 py-2">
              <div class="text-lg font-bold tabular-nums text-slate-600">
                {{ fight.failed.value }}
              </div>
              <div class="text-[11px] text-slate-400">失误/超时</div>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
            <span>用时 {{ formatDuration(fight.elapsed.value * 1000) }}</span>
            <span class="text-slate-300">|</span>
            <span>承受伤害 {{ fight.taken.value }}</span>
            <span v-if="best" class="text-slate-300">|</span>
            <span v-if="best">历史最佳 {{ best.bestScore }}</span>
          </div>
          <button
            type="button"
            class="mt-5 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-rose-500 active:scale-[0.99]"
            @click="fight.restart()"
          >
            再来一局
          </button>
          <p class="mt-2 text-[11px] text-slate-400">
            按 空格 / 回车 重开 ·
            <RouterLink to="/games" class="text-indigo-500 hover:underline"
              >返回游戏列表</RouterLink
            >
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
