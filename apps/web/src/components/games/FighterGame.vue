<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import FighterSprite from './FighterSprite.vue'
import {
  MOVE_LABEL,
  PLAYER_DMG,
  PLAYER_MOVES,
  useFightGame,
  type FighterPose,
  type Move,
} from '../../composables/useFightGame'
import { useElementSize } from '../../composables/useElementSize'
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

// 以竞技场宽度的 1% 为长度单位 --u,所有位移随尺寸等比缩放
const area = ref<HTMLElement | null>(null)
const size = useElementSize(area)
const uPx = computed(() => (size.width.value || 760) / 100)

// ===== 视觉状态 =====
const poseRyu = ref<FighterPose>('idle')
const poseKen = ref<FighterPose>('idle')
const animR = ref<{ id: number; cls: string; move: Move } | null>(null)
const animK = ref<{ id: number; cls: string; move: Move } | null>(null)
const flashR = ref(false)
const flashK = ref(false)
const shakeMode = ref<'soft' | 'hard' | null>(null)
const wrongFlash = ref(false)
const stopFlash = ref(false)
const proj = ref<{ id: number; by: 'ryu' | 'ken' } | null>(null)
const toast = ref<{
  id: number
  by: 'ryu' | 'ken'
  move: Move
  dmg: number
  success: boolean
} | null>(null)
const fx = ref<{ id: number; who: 'ryu' | 'ken'; dmg: number } | null>(null)
const dust = ref<{ id: number; side: 'l' | 'r' } | null>(null)
const koFly = ref<'ryu' | 'ken' | null>(null)
const winJump = ref<'ryu' | 'ken' | null>(null)

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
  hadouken: 'atk-hadouken',
  shoryuken: 'atk-shoryu',
  tatsumaki: 'atk-tatsu',
}
/** 各招式动画总时长(位移动画 + 姿势保持) */
const ANIM_HOLD: Record<Move, number> = { hadouken: 780, shoryuken: 1080, tatsumaki: 1180 }

function puffDust(side: 'l' | 'r', id: number): void {
  dust.value = { id, side }
  later(620, () => {
    if (dust.value?.id === id) dust.value = null
  })
}

// 出招:姿势 + 位移 + 气功弹/火焰/残影 + 招式横幅
watch(fight.attack, (a) => {
  if (!a) return
  const pose = a.by === 'ryu' ? poseRyu : poseKen
  const anim = a.by === 'ryu' ? animR : animK
  pose.value = a.move
  anim.value = { id: a.id, cls: ANIM_CLS[a.move], move: a.move }
  later(ANIM_HOLD[a.move], () => {
    if (anim.value?.id === a.id) anim.value = null
    if (pose.value === a.move) pose.value = 'idle'
  })
  if (a.move === 'hadouken') {
    proj.value = { id: a.id, by: a.by }
    later(580, () => {
      if (proj.value?.id === a.id) proj.value = null
    })
  } else {
    // 蹬地烟尘(起跳/起转),升龙落地再补一次
    puffDust(a.by === 'ryu' ? 'l' : 'r', a.id * 10)
    if (a.move === 'shoryuken')
      later(820, () => puffDust(a.by === 'ryu' ? 'l' : 'r', a.id * 10 + 1))
  }
  toast.value = { id: a.id, by: a.by, move: a.move, dmg: a.dmg, success: a.success }
  later(1300, () => {
    if (toast.value?.id === a.id) toast.value = null
  })
})

// 命中:受击帧 + 顿帧白闪 + 火花 + 伤害数字 + 分档震屏
watch(fight.hurt, (h) => {
  if (!h) return
  const pose = h.who === 'ryu' ? poseRyu : poseKen
  const flash = h.who === 'ryu' ? flashR : flashK
  pose.value = 'hurt'
  flash.value = true
  later(500, () => (flash.value = false))
  later(560, () => {
    if (!koFly.value && pose.value === 'hurt') pose.value = 'idle'
  })
  stopFlash.value = true
  later(110, () => (stopFlash.value = false))
  fx.value = { id: h.id, who: h.who, dmg: h.dmg }
  later(950, () => {
    if (fx.value?.id === h.id) fx.value = null
  })
  shakeMode.value = h.dmg >= 15 ? 'hard' : 'soft'
  later(h.dmg >= 15 ? 420 : 280, () => (shakeMode.value = null))
})

// K.O.:败者被击飞 → 倒地帧 + 烟尘,胜者庆祝小跳
watch(fight.koWinner, (w) => {
  if (!w) return
  const loser = w === 'ryu' ? 'ken' : 'ryu'
  koFly.value = loser
  ;(loser === 'ryu' ? poseRyu : poseKen).value = 'hurt'
  later(920, () => {
    koFly.value = null
    ;(loser === 'ryu' ? poseRyu : poseKen).value = 'ko'
    puffDust(loser === 'ryu' ? 'l' : 'r', 99990)
    shakeMode.value = 'soft'
    later(280, () => (shakeMode.value = null))
  })
  later(1300, () => (winJump.value = w))
  later(2350, () => (winJump.value = null))
})

// 打错键:红色警示
watch(fight.wrongSignal, () => {
  wrongFlash.value = true
  later(380, () => (wrongFlash.value = false))
})

// 重开:清空全部视觉状态
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
  dust.value = null
  koFly.value = null
  winJump.value = null
  shakeMode.value = null
  stopFlash.value = false
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
const hint = computed(() => {
  const m = PLAYER_MOVES[fight.tier.value]
  return { move: m, zh: MOVE_LABEL[m].zh, dmg: PLAYER_DMG[m] }
})
const canPause = computed(
  () =>
    (fight.status.value === 'running' && fight.phase.value === 'word') ||
    fight.status.value === 'paused',
)
const shakeCls = computed(() =>
  shakeMode.value === 'hard' ? 'shake-hard' : shakeMode.value === 'soft' ? 'shake-soft' : '',
)
const perfect = computed(() => fight.koWinner.value === 'ryu' && fight.taken.value === 0)

function hpColor(hp: number): string {
  return hp > 50
    ? 'bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500'
    : hp > 25
      ? 'bg-gradient-to-b from-amber-300 via-orange-400 to-orange-600'
      : 'bg-gradient-to-b from-red-400 via-rose-500 to-rose-700'
}

/** 命中火花的 6 个飞散方向 */
const SPARK_DIRS = [0, 60, 120, 180, 240, 300].map((a) => ({
  dx: `${Math.round(Math.cos((a * Math.PI) / 180) * 34)}px`,
  dy: `${Math.round(Math.sin((a * Math.PI) / 180) * 26)}px`,
}))
/** 烟尘三团 */
const DUST_DIRS = [
  { dx: '-22px', dy: '-8px', s: '1' },
  { dx: '2px', dy: '-14px', s: '1.3' },
  { dx: '24px', dy: '-7px', s: '0.9' },
]

/** 观众剪影(固定伪随机,避免每次渲染变化) */
const CROWD = Array.from({ length: 15 }, (_, i) => ({
  left: 2 + i * 6.9,
  h: 13 + ((i * 5) % 4) * 4,
  delay: -((i % 6) * 0.31),
  dur: 1.6 + (i % 4) * 0.27,
}))
/** 星星 */
const STARS = [
  { l: 7, t: 5, d: 0 },
  { l: 17, t: 11, d: -0.8 },
  { l: 30, t: 4, d: -1.6 },
  { l: 43, t: 9, d: -0.4 },
  { l: 56, t: 3.5, d: -2.1 },
  { l: 69, t: 10, d: -1.2 },
  { l: 83, t: 5.5, d: -0.6 },
  { l: 93, t: 12, d: -1.8 },
]

const howTo = [
  '屏幕随机出现英文单词,在倒计时内完整打出即可出招。',
  '短词(3-5 字母)→ 波动拳 8 伤害;中词(6-8)→ 龙卷旋风脚 12;长词(9+)→ 升龙拳 16。',
  '连续打对触发连击,每连一击额外 +1 伤害(最多 +4)。',
  '打错任意字母或超时,肯会随机出招反击,单词越难反击越痛。',
  '双方各 100 血,先打空对方血量者获胜(K.O.);零封对手可达成 PERFECT!',
]
</script>

<template>
  <div
    ref="area"
    class="relative h-[68vh] max-h-[680px] min-h-[450px] w-full select-none overflow-hidden rounded-2xl border border-slate-800/60 shadow-xl"
    :class="shakeCls"
    :style="{ '--u': uPx + 'px' }"
  >
    <!-- ============ 舞台背景 ============ -->
    <div
      class="absolute inset-0 z-0"
      style="
        background: linear-gradient(
          to bottom,
          #14103a 0%,
          #3b1d6e 20%,
          #7c2d8e 38%,
          #d1495b 55%,
          #f97316 72%,
          #fcd34d 88%
        );
      "
    />
    <!-- 星星 -->
    <div
      v-for="s in STARS"
      :key="s.l"
      class="star-twinkle absolute z-0 h-1 w-1 rounded-full bg-white"
      :style="{ left: s.l + '%', top: s.t + '%', animationDelay: s.d + 's' }"
    />
    <!-- 太阳 + 光带 -->
    <div
      class="sun-glow absolute bottom-[19%] left-[58%] z-0 h-36 w-36 rounded-full bg-[radial-gradient(circle,#fff7cc_0%,#fbbf24_55%,rgba(251,146,60,0.35)_78%,transparent_100%)] blur-[1px]"
    />
    <div class="absolute bottom-[26%] left-[52%] z-0 h-1.5 w-56 bg-rose-400/25 blur-[1px]" />
    <div class="absolute bottom-[23%] left-[56%] z-0 h-1 w-44 bg-rose-300/20 blur-[1px]" />
    <!-- 云 -->
    <div
      class="cloud-drift absolute top-[9%] z-0 h-6 w-32 rounded-full bg-rose-300/35 blur-[3px]"
      style="animation-duration: 56s"
    />
    <div
      class="cloud-drift absolute top-[19%] z-0 h-5 w-24 rounded-full bg-orange-200/30 blur-[3px]"
      style="animation-duration: 76s; animation-delay: -28s"
    />
    <!-- 飞鸟 -->
    <svg
      viewBox="0 0 24 10"
      class="bird-fly absolute right-[-8%] top-[14%] z-0 w-6 text-indigo-950/70"
      aria-hidden="true"
    >
      <path
        d="M1 8 Q6 1 12 6 Q18 1 23 8"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
    <svg
      viewBox="0 0 24 10"
      class="bird-fly absolute right-[-14%] top-[19%] z-0 w-4 text-indigo-950/55"
      style="animation-delay: -7s; animation-duration: 21s"
      aria-hidden="true"
    >
      <path
        d="M1 8 Q6 1 12 6 Q18 1 23 8"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
    <!-- 远山两层 -->
    <svg
      viewBox="0 0 800 120"
      preserveAspectRatio="none"
      class="absolute inset-x-0 bottom-[15%] z-0 h-[24%]"
      aria-hidden="true"
    >
      <path d="M0 120 L120 30 L260 120 Z" fill="#4c2a6e" opacity="0.45" />
      <path d="M210 120 L370 44 L560 120 Z" fill="#4c2a6e" opacity="0.35" />
      <path d="M520 120 L690 36 L800 120 Z" fill="#4c2a6e" opacity="0.42" />
      <path d="M60 120 L240 58 L430 120 Z" fill="#331d52" opacity="0.55" />
      <path d="M430 120 L610 62 L800 120 Z" fill="#331d52" opacity="0.5" />
    </svg>
    <!-- 宝塔(左) -->
    <svg
      viewBox="0 0 130 175"
      class="absolute bottom-[15%] left-[3.5%] z-0 h-[42%]"
      aria-hidden="true"
    >
      <g fill="#241a3d">
        <rect x="44" y="120" width="42" height="55" />
        <path d="M22 122 Q65 104 108 122 L96 106 Q65 94 34 106 Z" />
        <rect x="50" y="78" width="30" height="30" />
        <path d="M32 80 Q65 64 98 80 L88 66 Q65 56 42 66 Z" />
        <rect x="56" y="42" width="18" height="26" />
        <path d="M40 44 Q65 30 90 44 L82 32 Q65 24 48 32 Z" />
        <rect x="63" y="14" width="4" height="12" />
        <circle cx="65" cy="12" r="3.4" />
      </g>
      <g fill="#fbbf24" opacity="0.85">
        <rect x="57" y="132" width="6" height="9" rx="1" />
        <rect x="68" y="132" width="6" height="9" rx="1" />
        <rect x="59" y="86" width="5" height="7" rx="1" />
        <rect x="67" y="86" width="5" height="7" rx="1" />
      </g>
    </svg>
    <!-- 鸟居(右) -->
    <svg
      viewBox="0 0 110 100"
      class="absolute bottom-[15%] right-[5%] z-0 h-[23%]"
      aria-hidden="true"
    >
      <g fill="#241a3d">
        <path d="M4 14 Q55 3 106 14 L106 23 Q55 12 4 23 Z" />
        <rect x="12" y="31" width="86" height="7" rx="1" />
        <rect x="18" y="31" width="9" height="69" />
        <rect x="83" y="31" width="9" height="69" />
      </g>
    </svg>
    <!-- 树影 -->
    <div
      class="absolute bottom-[15%] left-[26%] z-0 h-16 w-20 rounded-t-full bg-[#1f1533]/80 blur-[1px]"
    />
    <div
      class="absolute bottom-[15%] left-[30%] z-0 h-10 w-14 rounded-t-full bg-[#1f1533]/70 blur-[1px]"
    />
    <div
      class="absolute bottom-[15%] right-[24%] z-0 h-12 w-16 rounded-t-full bg-[#1f1533]/70 blur-[1px]"
    />
    <!-- 灯笼 -->
    <div class="lantern-sway absolute left-[17%] top-0 z-0" style="animation-delay: -1.3s">
      <div class="mx-auto h-9 w-px bg-slate-950/70" />
      <div
        class="relative mx-auto h-9 w-7 rounded-[45%] border border-red-950/70 bg-gradient-to-b from-red-500 via-red-600 to-red-800 shadow-[0_0_20px_rgba(251,113,133,0.55)]"
      >
        <div
          class="absolute -top-1 left-1/2 h-1.5 w-4 -translate-x-1/2 rounded-sm bg-amber-300/90"
        />
        <div
          class="absolute -bottom-1 left-1/2 h-1.5 w-4 -translate-x-1/2 rounded-sm bg-amber-300/90"
        />
        <div class="absolute inset-x-0 top-1/3 h-px bg-black/25" />
        <div class="absolute inset-x-0 top-2/3 h-px bg-black/25" />
      </div>
    </div>
    <div class="lantern-sway absolute right-[15%] top-0 z-0">
      <div class="mx-auto h-6 w-px bg-slate-950/70" />
      <div
        class="relative mx-auto h-8 w-6 rounded-[45%] border border-red-950/70 bg-gradient-to-b from-red-500 via-red-600 to-red-800 shadow-[0_0_18px_rgba(251,113,133,0.5)]"
      >
        <div
          class="absolute -top-1 left-1/2 h-1.5 w-3.5 -translate-x-1/2 rounded-sm bg-amber-300/90"
        />
        <div
          class="absolute -bottom-1 left-1/2 h-1.5 w-3.5 -translate-x-1/2 rounded-sm bg-amber-300/90"
        />
        <div class="absolute inset-x-0 top-1/2 h-px bg-black/25" />
      </div>
    </div>
    <!-- 花瓣 -->
    <div class="petal-fall absolute left-[22%] top-[5%] z-0 h-2 w-2 rounded-full bg-pink-200/80" />
    <div
      class="petal-fall absolute left-[47%] top-[1%] z-0 h-1.5 w-1.5 rounded-full bg-pink-100/70"
      style="animation-delay: -2.4s; animation-duration: 8.5s"
    />
    <div
      class="petal-fall absolute left-[68%] top-[8%] z-0 h-2 w-2 rounded-full bg-pink-200/70"
      style="animation-delay: -4.8s; animation-duration: 9.5s"
    />
    <div
      class="petal-fall absolute left-[86%] top-[3%] z-0 h-1.5 w-1.5 rounded-full bg-pink-100/60"
      style="animation-delay: -6.2s; animation-duration: 10.5s"
    />
    <!-- 观众剪影 -->
    <div
      v-for="(c, i) in CROWD"
      :key="i"
      class="crowd-bob absolute bottom-[14.4%] z-[2] w-[2.6%] rounded-t-full bg-slate-950/55"
      :style="{
        left: c.left + '%',
        height: c.h + 'px',
        animationDelay: c.delay + 's',
        animationDuration: c.dur + 's',
      }"
    />
    <!-- 石板地面 -->
    <div class="absolute inset-x-0 bottom-0 z-0 h-[15%]">
      <div class="absolute inset-0 bg-gradient-to-b from-stone-500 via-stone-600 to-stone-900" />
      <div class="absolute inset-x-0 top-0 h-[3px] bg-amber-200/50" />
      <div
        class="absolute inset-0 opacity-40"
        style="
          background: repeating-linear-gradient(
            90deg,
            transparent 0 calc(12.5% - 1px),
            rgba(0, 0, 0, 0.45) calc(12.5% - 1px) 12.5%
          );
        "
      />
      <div class="absolute inset-x-0 top-1/2 h-px bg-black/25" />
      <div class="absolute inset-x-0 bottom-0 h-1/4 bg-black/25" />
    </div>
    <!-- 暗角 -->
    <div
      class="pointer-events-none absolute inset-0 z-[1]"
      style="
        box-shadow:
          inset 0 0 90px rgba(15, 10, 40, 0.5),
          inset 0 -24px 60px rgba(0, 0, 0, 0.3);
      "
    />

    <!-- ============ 角色影子 ============ -->
    <div
      class="absolute bottom-[13%] left-[8%] z-[5] h-3.5 w-[18%] max-w-44 rounded-[50%] bg-black/45 blur-[3px]"
      :class="animR && animR.move !== 'hadouken' ? 'shadow-jump' : ''"
    />
    <div
      class="absolute bottom-[13%] right-[8%] z-[5] h-3.5 w-[18%] max-w-44 rounded-[50%] bg-black/45 blur-[3px]"
      :class="animK && animK.move !== 'hadouken' ? 'shadow-jump' : ''"
    />

    <!-- ============ 隆(玩家,左) ============ -->
    <div class="absolute bottom-[14%] left-[5.5%] z-10 aspect-[120/170] h-[56%]">
      <template v-if="animR && animR.move === 'tatsumaki'">
        <div class="tatsu-after" style="animation-delay: 0.07s; opacity: 0.3">
          <FighterSprite char="ryu" pose="tatsumaki" />
        </div>
        <div class="tatsu-after" style="animation-delay: 0.15s; opacity: 0.16">
          <FighterSprite char="ryu" pose="tatsumaki" />
        </div>
      </template>
      <div :key="animR ? 'a' + animR.id : 'r'" class="absolute inset-0" :class="animR?.cls">
        <div
          class="h-full w-full"
          :class="[
            flashR ? 'hurt-flash' : '',
            koFly === 'ryu' ? 'ko-fly' : '',
            winJump === 'ryu' ? 'win-bounce' : '',
            !animR && !koFly && !winJump ? 'fig-breathe' : '',
          ]"
        >
          <FighterSprite char="ryu" :pose="poseRyu" />
          <!-- 升龙拳火焰轨迹 -->
          <div
            v-if="animR && animR.move === 'shoryuken'"
            class="pointer-events-none absolute right-[2%] top-[-10%] h-[46%] w-[52%]"
          >
            <span class="flame f1" /><span class="flame f2" /><span class="flame f3" />
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 肯(对手,右,镜像) ============ -->
    <div
      class="absolute bottom-[14%] right-[5.5%] z-10 aspect-[120/170] h-[56%]"
      style="transform: scaleX(-1)"
    >
      <template v-if="animK && animK.move === 'tatsumaki'">
        <div class="tatsu-after" style="animation-delay: 0.07s; opacity: 0.3">
          <FighterSprite char="ken" pose="tatsumaki" />
        </div>
        <div class="tatsu-after" style="animation-delay: 0.15s; opacity: 0.16">
          <FighterSprite char="ken" pose="tatsumaki" />
        </div>
      </template>
      <div :key="animK ? 'a' + animK.id : 'k'" class="absolute inset-0" :class="animK?.cls">
        <div
          class="h-full w-full"
          :class="[
            flashK ? 'hurt-flash' : '',
            koFly === 'ken' ? 'ko-fly' : '',
            winJump === 'ken' ? 'win-bounce' : '',
            !animK && !koFly && !winJump ? 'fig-breathe' : '',
          ]"
        >
          <FighterSprite char="ken" :pose="poseKen" />
          <div
            v-if="animK && animK.move === 'shoryuken'"
            class="pointer-events-none absolute right-[2%] top-[-10%] h-[46%] w-[52%]"
          >
            <span class="flame f1" /><span class="flame f2" /><span class="flame f3" />
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 蹬地烟尘 ============ -->
    <div
      v-if="dust"
      :key="dust.id"
      class="pointer-events-none absolute bottom-[14%] z-[15] h-0 w-0"
      :class="dust.side === 'l' ? 'left-[16%]' : 'right-[16%]'"
    >
      <span
        v-for="(d, i) in DUST_DIRS"
        :key="i"
        class="dust-puff absolute rounded-full bg-stone-200/70 blur-[1px]"
        :style="{
          '--dx': d.dx,
          '--dy': d.dy,
          width: 14 * Number(d.s) + 'px',
          height: 10 * Number(d.s) + 'px',
          animationDelay: i * 0.05 + 's',
        }"
      />
    </div>

    <!-- ============ 波动拳气功弹 ============ -->
    <div
      v-if="proj"
      :key="proj.id"
      class="proj-fly pointer-events-none absolute bottom-[41%] z-20 h-14 w-14"
      :style="{
        left: proj.by === 'ryu' ? '30%' : '70%',
        '--fly-dist': (proj.by === 'ryu' ? 46 : -46) * uPx + 'px',
      }"
    >
      <div
        class="absolute inset-[-30%] rounded-full blur-lg"
        :class="proj.by === 'ryu' ? 'bg-cyan-400/70' : 'bg-amber-400/70'"
      />
      <div
        class="proj-core absolute inset-[12%] rounded-full"
        :style="
          proj.by === 'ryu'
            ? {
                background:
                  'radial-gradient(circle at 38% 38%, #ffffff 0%, #a5f3fc 34%, #22d3ee 62%, rgba(8,145,178,0.25) 100%)',
              }
            : {
                background:
                  'radial-gradient(circle at 38% 38%, #ffffff 0%, #fde68a 34%, #fbbf24 62%, rgba(217,119,6,0.25) 100%)',
              }
        "
      />
      <div
        class="absolute top-1/2 h-2.5 w-16 -translate-y-1/2 rounded-full blur-[3px]"
        :class="proj.by === 'ryu' ? 'right-1/2 bg-cyan-300/60' : 'left-1/2 bg-amber-300/60'"
      />
    </div>

    <!-- ============ 命中特效:星芒火花 + 冲击环 + 粒子 + 伤害数字 ============ -->
    <div
      v-if="fx"
      :key="fx.id"
      class="pointer-events-none absolute bottom-[43%] z-20 h-0 w-0"
      :class="fx.who === 'ken' ? 'left-[75%]' : 'left-[25%]'"
    >
      <svg
        viewBox="-30 -30 60 60"
        class="imp-spark absolute left-0 top-0 h-20 w-20"
        aria-hidden="true"
      >
        <path
          d="M0 -27 L5 -8 L22 -18 L10 -3 L28 4 L9 7 L16 25 L2 11 L-4 28 L-8 10 L-24 17 L-12 2 L-28 -6 L-10 -8 L-16 -25 L-3 -11 Z"
          fill="#fff7cc"
          stroke="#fbbf24"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <circle cx="0" cy="0" r="7" fill="#ffffff" />
      </svg>
      <div
        class="imp-ring absolute left-0 top-0 h-16 w-16 rounded-full border-[5px] border-white/90"
      />
      <span
        v-for="(d, i) in SPARK_DIRS"
        :key="i"
        class="spark-p absolute left-0 top-0 h-2 w-2 rounded-full bg-amber-300"
        :style="{ '--dx': d.dx, '--dy': d.dy, animationDelay: i * 0.012 + 's' }"
      />
      <div
        class="dmg-pop absolute left-0 top-0 text-3xl font-black italic tabular-nums"
        :class="fx.who === 'ken' ? 'text-amber-300' : 'text-rose-400'"
        style="
          text-shadow:
            -2px 0 #1c1917,
            2px 0 #1c1917,
            0 -2px #1c1917,
            0 2px #1c1917,
            0 0 14px rgba(0, 0, 0, 0.8);
        "
      >
        {{ fx.dmg }}
      </div>
    </div>

    <!-- ============ 招式名横幅 ============ -->
    <div
      v-if="toast"
      :key="toast.id"
      class="pointer-events-none absolute inset-x-0 bottom-[29%] z-20 text-center"
    >
      <div
        class="move-toast inline-block text-3xl font-black italic tracking-wide sm:text-4xl"
        :class="toast.success ? 'text-amber-300' : 'text-rose-300'"
        style="
          text-shadow:
            -2px 0 #431407,
            2px 0 #431407,
            0 -2px #431407,
            0 2px #431407,
            0 0 22px rgba(0, 0, 0, 0.75);
        "
      >
        {{ toast.by === 'ken' ? '肯 · ' : '' }}{{ MOVE_LABEL[toast.move].zh }}!
        <span class="text-base font-bold sm:text-lg">{{ MOVE_LABEL[toast.move].en }}</span>
      </div>
      <div
        class="mt-1 text-xs font-bold sm:text-sm"
        :class="toast.success ? 'text-emerald-300' : 'text-rose-200'"
        style="text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85)"
      >
        {{ toast.success ? `命中!伤害 ${toast.dmg}` : `失误!被反击 -${toast.dmg}` }}
      </div>
    </div>

    <!-- ============ 连击弹出 ============ -->
    <div
      v-if="fight.combo.value > 1 && fight.status.value === 'running' && fight.phase.value !== 'ko'"
      :key="fight.combo.value"
      class="combo-pop pointer-events-none absolute left-[3%] top-[24%] z-20"
    >
      <div
        class="text-2xl font-black italic text-yellow-300 sm:text-3xl"
        style="
          text-shadow:
            -2px 0 #7c2d12,
            2px 0 #7c2d12,
            0 -2px #7c2d12,
            0 2px #7c2d12;
        "
      >
        {{ fight.combo.value }} HIT<span class="text-base sm:text-xl"> COMBO!</span>
      </div>
    </div>

    <!-- ============ 顶部 HUD:斜切血条 + 计时 ============ -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-2.5 sm:p-3"
    >
      <!-- 隆 -->
      <div class="w-[38%] max-w-xs flex-1">
        <div class="mb-1 flex items-baseline gap-1.5">
          <span
            class="inline-block -skew-x-12 border border-white/25 bg-slate-900/85 px-2 py-px text-xs font-black italic tracking-wider text-yellow-300 shadow"
          >
            RYU
          </span>
          <span class="text-[11px] font-bold text-white/85 drop-shadow">隆</span>
        </div>
        <div
          class="relative h-5 -skew-x-[14deg] overflow-hidden rounded-sm border-2 border-black/80 bg-slate-950 shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
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
          <div
            class="absolute inset-0"
            style="
              background: repeating-linear-gradient(
                90deg,
                transparent 0 calc(10% - 1px),
                rgba(0, 0, 0, 0.4) calc(10% - 1px) 10%
              );
            "
          />
          <div class="absolute inset-x-0 top-0 h-2/5 bg-white/25" />
          <div v-if="fight.hpRyu.value <= 25" class="hp-danger absolute inset-0 bg-rose-600/60" />
        </div>
      </div>

      <!-- 中央计时/分数 -->
      <div class="mt-0.5 flex w-16 shrink-0 flex-col items-center">
        <div
          class="rounded-md border-2 border-black/80 bg-slate-950/90 px-2 py-0.5 text-center shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        >
          <span
            class="text-2xl font-black italic tabular-nums leading-tight"
            :class="timeUrgent ? 'animate-pulse text-rose-400' : 'text-yellow-300'"
            style="text-shadow: 0 0 8px rgba(253, 224, 71, 0.4)"
          >
            {{ timerText }}
          </span>
        </div>
        <span class="mt-0.5 text-[10px] font-bold tabular-nums text-white/85 drop-shadow">
          伤害 {{ fight.score.value }}
        </span>
      </div>

      <!-- 肯 -->
      <div class="flex w-[38%] max-w-xs flex-1 flex-col items-end">
        <div class="mb-1 flex items-baseline gap-1.5">
          <span class="text-[11px] font-bold text-white/85 drop-shadow">肯</span>
          <span
            class="inline-block skew-x-12 border border-white/25 bg-slate-900/85 px-2 py-px text-xs font-black italic tracking-wider text-yellow-300 shadow"
          >
            KEN
          </span>
        </div>
        <div
          class="relative h-5 w-full skew-x-[14deg] overflow-hidden rounded-sm border-2 border-black/80 bg-slate-950 shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
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
          <div
            class="absolute inset-0"
            style="
              background: repeating-linear-gradient(
                90deg,
                transparent 0 calc(10% - 1px),
                rgba(0, 0, 0, 0.4) calc(10% - 1px) 10%
              );
            "
          />
          <div class="absolute inset-x-0 top-0 h-2/5 bg-white/25" />
          <div v-if="fight.hpKen.value <= 25" class="hp-danger absolute inset-0 bg-rose-600/60" />
        </div>
      </div>
    </div>

    <!-- ============ 右下控制按钮 ============ -->
    <div class="absolute bottom-2 right-3 z-30 flex items-center gap-1.5">
      <button
        type="button"
        class="rounded-md border border-white/25 bg-slate-900/75 px-2.5 py-1 text-xs font-medium text-yellow-200 shadow backdrop-blur transition hover:bg-slate-800 disabled:opacity-40"
        :disabled="!canPause"
        @click="fight.togglePause()"
      >
        {{ fight.status.value === 'paused' ? '继续' : '暂停' }}
      </button>
      <button
        type="button"
        class="rounded-md border border-white/25 bg-slate-900/75 px-2.5 py-1 text-xs font-medium text-yellow-200 shadow backdrop-blur transition hover:bg-slate-800"
        @click="fight.restart()"
      >
        重开
      </button>
    </div>

    <!-- ============ 单词输入面板 ============ -->
    <div
      v-if="fight.status.value === 'running' && fight.phase.value === 'word'"
      class="pointer-events-none absolute inset-x-0 bottom-[2.5%] z-20 flex flex-col items-center gap-2 px-4"
    >
      <div
        class="flex items-center gap-2 rounded-xl border-2 border-amber-400/40 bg-slate-950/80 px-4 py-2.5 shadow-[0_4px_18px_rgba(0,0,0,0.55)] backdrop-blur"
      >
        <span
          class="mr-1 hidden items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black italic sm:inline-flex"
          :class="
            hint.move === 'hadouken'
              ? 'bg-cyan-500/90 text-cyan-950'
              : hint.move === 'tatsumaki'
                ? 'bg-emerald-500/90 text-emerald-950'
                : 'bg-orange-500/90 text-orange-950'
          "
        >
          {{ hint.zh }} ×{{ hint.dmg }}
        </span>
        <span
          v-for="(ch, i) in chars"
          :key="i"
          class="flex h-8 w-6 items-center justify-center rounded-md font-mono text-lg font-bold uppercase sm:h-10 sm:w-8 sm:text-2xl"
          :class="
            i < fight.typed.value
              ? 'chip-ok bg-emerald-500 text-white'
              : i === fight.typed.value
                ? 'chip-cur bg-white text-slate-900'
                : 'bg-white/10 text-white/85'
          "
        >
          {{ ch }}
        </span>
      </div>
      <div
        class="h-2 w-60 overflow-hidden rounded-full border border-black/50 bg-slate-950/70 sm:w-72"
      >
        <div
          class="h-full rounded-full"
          :class="[timeBarColor, timeUrgent ? 'animate-pulse' : '']"
          :style="{ width: timePct + '%' }"
        />
      </div>
    </div>

    <!-- ============ 打错键红色警示 ============ -->
    <div
      v-if="wrongFlash"
      class="pointer-events-none absolute inset-0 z-30 rounded-2xl"
      style="
        box-shadow:
          inset 0 0 0 4px rgba(244, 63, 94, 0.8),
          inset 0 0 52px rgba(244, 63, 94, 0.4);
      "
    />
    <!-- 命中顿帧白闪 -->
    <div v-if="stopFlash" class="hitstop pointer-events-none absolute inset-0 z-30 bg-white" />

    <!-- ============ ROUND / FIGHT / K.O. 横幅 ============ -->
    <div
      v-if="fight.banner.value && (fight.phase.value === 'intro' || fight.phase.value === 'ko')"
      class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      <div :key="fight.banner.value.id" class="relative flex items-center justify-center">
        <div
          class="burst-spin absolute h-72 w-72 rounded-full sm:h-96 sm:w-96"
          style="
            background: repeating-conic-gradient(
              rgba(253, 224, 71, 0.3) 0 9deg,
              transparent 9deg 18deg
            );
          "
        />
        <div
          class="relative text-5xl font-black italic tracking-wider sm:text-7xl"
          :class="
            fight.banner.value.text === 'K.O.'
              ? 'banner-ko text-rose-500'
              : fight.banner.value.text === 'FIGHT!'
                ? 'banner-fight text-yellow-300'
                : 'banner-round text-yellow-300'
          "
          style="
            text-shadow:
              -3px 0 #431407,
              3px 0 #431407,
              0 -3px #431407,
              0 3px #431407,
              0 0 30px rgba(0, 0, 0, 0.85);
          "
        >
          {{ fight.banner.value.text }}
        </div>
      </div>
    </div>

    <!-- ============ 覆盖层:开始 / 暂停 / 结算 ============ -->
    <div
      v-if="fight.status.value !== 'running'"
      class="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-md rounded-2xl border-2 border-amber-400/50 bg-slate-900/95 p-6 text-center shadow-2xl"
      >
        <!-- 开始 -->
        <template v-if="fight.status.value === 'idle'">
          <h2 class="text-2xl font-black italic tracking-wide text-yellow-300">打字街霸</h2>
          <div class="mt-1 text-3xl font-black italic text-white">
            隆 <span class="mx-1 text-rose-500">VS</span> 肯
          </div>
          <ul class="mx-auto mt-4 space-y-1.5 text-left text-sm text-slate-300">
            <li v-for="(line, i) in howTo" :key="i" class="flex gap-2">
              <span class="mt-0.5 text-amber-400/70">•</span>
              <span>{{ line }}</span>
            </li>
          </ul>
          <button
            type="button"
            class="mt-5 w-full rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 px-4 py-3 text-base font-black italic tracking-widest text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
            @click="fight.start()"
          >
            开始对战 FIGHT!
          </button>
          <p class="mt-2 text-[11px] text-slate-400">或按 空格 / 回车 开始,Esc 暂停</p>
        </template>

        <!-- 暂停 -->
        <template v-else-if="fight.status.value === 'paused'">
          <h2 class="text-xl font-black italic text-yellow-300">已暂停</h2>
          <p class="mt-1 text-sm text-slate-300">
            隆 {{ fight.hpRyu.value }} : {{ fight.hpKen.value }} 肯
          </p>
          <div class="mt-5 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 px-4 py-3 text-sm font-bold text-white shadow transition hover:brightness-110"
              @click="fight.resume()"
            >
              继续
            </button>
            <button
              type="button"
              class="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
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
            class="mx-auto mb-2 w-fit rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-300"
          >
            🎉 新纪录!
          </div>
          <h2
            class="text-3xl font-black italic tracking-wide"
            :class="fight.koWinner.value === 'ryu' ? 'text-yellow-300' : 'text-rose-500'"
            style="text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6)"
          >
            {{ fight.koWinner.value === 'ryu' ? 'YOU WIN!' : 'YOU LOSE' }}
          </h2>
          <div
            v-if="perfect"
            class="mx-auto mt-1 w-fit text-lg font-black italic tracking-[0.3em] text-cyan-300"
            style="text-shadow: 0 0 14px rgba(34, 211, 238, 0.7)"
          >
            PERFECT!
          </div>
          <div class="mt-4 rounded-xl border border-white/10 bg-slate-800/80 p-4">
            <div class="text-xs text-slate-400">总输出伤害</div>
            <div class="text-4xl font-black tabular-nums text-amber-300">
              {{ fight.score.value }}
            </div>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-slate-800/80 py-2">
              <div class="text-lg font-bold tabular-nums text-emerald-400">
                {{ fight.cleared.value }}
              </div>
              <div class="text-[11px] text-slate-400">打对单词</div>
            </div>
            <div class="rounded-lg bg-slate-800/80 py-2">
              <div class="text-lg font-bold tabular-nums text-amber-400">
                {{ fight.bestCombo.value }}
              </div>
              <div class="text-[11px] text-slate-400">最高连击</div>
            </div>
            <div class="rounded-lg bg-slate-800/80 py-2">
              <div class="text-lg font-bold tabular-nums text-rose-400">
                {{ fight.failed.value }}
              </div>
              <div class="text-[11px] text-slate-400">失误/超时</div>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
            <span>用时 {{ formatDuration(fight.elapsed.value * 1000) }}</span>
            <span class="text-slate-600">|</span>
            <span>承受伤害 {{ fight.taken.value }}</span>
            <span v-if="best" class="text-slate-600">|</span>
            <span v-if="best">历史最佳 {{ best.bestScore }}</span>
          </div>
          <button
            type="button"
            class="mt-5 w-full rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 px-4 py-3 text-sm font-black italic tracking-widest text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
            @click="fight.restart()"
          >
            再来一局 REMATCH
          </button>
          <p class="mt-2 text-[11px] text-slate-400">
            按 空格 / 回车 重开 ·
            <RouterLink to="/games" class="text-amber-300 hover:underline">返回游戏列表</RouterLink>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
