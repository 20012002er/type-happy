<script setup lang="ts">
import { computed } from 'vue'
import type { FighterPose } from '../../composables/useFightGame'

const props = defineProps<{
  /** ryu=白衣红头带(玩家),ken=红衣金发(对手) */
  char: 'ryu' | 'ken'
  pose: FighterPose
}>()

const P = computed(() =>
  props.char === 'ryu'
    ? {
        gi: '#f1f5f9',
        giDark: '#cbd5e1',
        belt: '#1f2937',
        hair: '#4a2f1b',
        band: '#dc2626',
        glove: '#b91c1c',
        skin: '#f2c191',
        skinDark: '#d9a066',
      }
    : {
        gi: '#dc2626',
        giDark: '#991b1b',
        belt: '#1f2937',
        hair: '#f0b429',
        band: '#dc2626',
        glove: '#7f1d1d',
        skin: '#f2c191',
        skinDark: '#d9a066',
      },
)
</script>

<template>
  <svg
    viewBox="0 0 100 140"
    class="fighter-svg h-full w-full drop-shadow-[0_4px_4px_rgba(0,0,0,0.35)]"
    :class="`pose-${pose}`"
    aria-hidden="true"
  >
    <!-- 后腿 -->
    <g class="fs-leg-b">
      <path
        d="M48 90 L34 110 L31 128"
        :stroke="P.giDark"
        stroke-width="15"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <ellipse cx="33" cy="133" rx="8" ry="4.5" :fill="P.skinDark" />
    </g>

    <!-- 后臂 -->
    <g class="fs-arm-b">
      <path
        d="M43 58 L36 72"
        :stroke="P.giDark"
        stroke-width="10"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M36 72 L47 62"
        :stroke="P.skinDark"
        stroke-width="7"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="47" cy="61" r="5.5" :fill="P.glove" />
    </g>

    <!-- 躯干(道服上衣 + 腰带) -->
    <g class="fs-torso">
      <path d="M37 55 Q34 88 42 94 L60 94 Q68 88 65 55 Q51 46 37 55 Z" :fill="P.gi" />
      <path d="M45 53 L51 74 L58 53 Q51 48 45 53 Z" :fill="P.skin" />
      <path d="M45 53 L51 74 L47 76 L40 56 Z" :fill="P.giDark" opacity="0.7" />
      <rect x="40" y="85" width="23" height="6.5" rx="2" :fill="P.belt" />
      <path
        d="M47 91 L44 103 M54 91 L56 101"
        :stroke="P.belt"
        stroke-width="4"
        stroke-linecap="round"
        fill="none"
      />
    </g>

    <!-- 前腿 -->
    <g class="fs-leg-f">
      <path
        d="M52 90 L64 108 L61 128"
        :stroke="P.gi"
        stroke-width="15"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <ellipse cx="64" cy="133" rx="8" ry="4.5" :fill="P.skin" />
    </g>

    <!-- 头 -->
    <g class="fs-head">
      <circle cx="52" cy="37" r="14.5" :fill="P.skin" />
      <circle cx="40" cy="39" r="3" :fill="P.skinDark" />
      <!-- 头发 -->
      <template v-if="char === 'ryu'">
        <path
          d="M37 31 Q38 18 52 17 Q66 18 67 30 L67 33 Q61 24 52 24 Q43 24 38 34 Z"
          :fill="P.hair"
        />
        <path
          d="M41 21 L38 12 L47 18 M52 17 L52 8 L57 16 M62 19 L66 11 L65 21"
          :stroke="P.hair"
          stroke-width="4"
          stroke-linecap="round"
          fill="none"
        />
        <!-- 红色头带 + 飘带 -->
        <path d="M36 31 Q52 25 68 31 L68 36.5 Q52 31 36 36.5 Z" :fill="P.band" />
        <g class="fs-band-tail">
          <path
            d="M37 33 Q26 31 18 37 M37 36 Q27 39 22 47"
            :stroke="P.band"
            stroke-width="3.6"
            stroke-linecap="round"
            fill="none"
          />
        </g>
      </template>
      <template v-else>
        <path
          d="M36 33 Q33 15 52 14 Q71 15 68 32 L68 37 Q62 22 52 22 Q42 22 37 37 Z"
          :fill="P.hair"
        />
        <path
          d="M40 22 L36 11 L46 17 M50 15 L50 5 L57 14 M61 17 L66 8 L66 19 M37 30 Q29 34 26 44"
          :stroke="P.hair"
          stroke-width="4.4"
          stroke-linecap="round"
          fill="none"
        />
      </template>
      <!-- 眉眼 -->
      <path d="M55 30.5 L63.5 29.5" :stroke="P.hair" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="59" cy="36" r="2.1" fill="#1f2937" />
      <path
        d="M57 44.5 Q60 46 62.5 43.5"
        :stroke="P.skinDark"
        stroke-width="1.8"
        fill="none"
        stroke-linecap="round"
      />
    </g>

    <!-- 前臂 -->
    <g class="fs-arm-f">
      <path d="M59 58 L68 66" :stroke="P.gi" stroke-width="10" stroke-linecap="round" fill="none" />
      <path
        d="M68 66 L73 53"
        :stroke="P.skin"
        stroke-width="7"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="73" cy="51" r="5.5" :fill="P.glove" />
    </g>
  </svg>
</template>

<style scoped>
.fighter-svg g {
  transform-box: view-box;
  transition: transform 0.16s ease-out;
}

.fs-arm-f {
  transform-origin: 59px 58px;
}
.fs-arm-b {
  transform-origin: 43px 58px;
}
.fs-torso {
  transform-origin: 50px 92px;
}
.fs-head {
  transform-origin: 52px 50px;
}
.fs-leg-f {
  transform-origin: 52px 90px;
}
.fs-leg-b {
  transform-origin: 48px 90px;
}

/* 波动拳:双手向前推出,身体前倾 */
.pose-hadouken .fs-arm-f {
  transform: rotate(58deg);
}
.pose-hadouken .fs-arm-b {
  transform: rotate(58deg) translateX(13px);
}
.pose-hadouken .fs-torso {
  transform: rotate(10deg);
}
.pose-hadouken .fs-head {
  transform: rotate(6deg);
}
.pose-hadouken .fs-leg-f {
  transform: rotate(8deg);
}
.pose-hadouken .fs-leg-b {
  transform: rotate(-6deg);
}

/* 升龙拳:前手冲天,身体后仰(起跳由外层动画完成) */
.pose-shoryuken .fs-arm-f {
  transform: rotate(-72deg);
}
.pose-shoryuken .fs-arm-b {
  transform: rotate(38deg);
}
.pose-shoryuken .fs-torso {
  transform: rotate(-8deg);
}
.pose-shoryuken .fs-head {
  transform: rotate(-5deg);
}
.pose-shoryuken .fs-leg-f {
  transform: rotate(-26deg);
}
.pose-shoryuken .fs-leg-b {
  transform: rotate(14deg);
}

/* 龙卷旋风脚:前腿水平踢出,身体后倾旋转(位移旋转由外层动画完成) */
.pose-tatsumaki .fs-leg-f {
  transform: rotate(-88deg);
}
.pose-tatsumaki .fs-leg-b {
  transform: rotate(38deg);
}
.pose-tatsumaki .fs-torso {
  transform: rotate(-26deg);
}
.pose-tatsumaki .fs-head {
  transform: rotate(-12deg);
}
.pose-tatsumaki .fs-arm-f {
  transform: rotate(46deg);
}
.pose-tatsumaki .fs-arm-b {
  transform: rotate(-55deg);
}

/* 被击中:身体后仰,手臂甩开 */
.pose-hurt .fs-torso {
  transform: rotate(-15deg);
}
.pose-hurt .fs-head {
  transform: rotate(-20deg);
}
.pose-hurt .fs-arm-f {
  transform: rotate(-32deg);
}
.pose-hurt .fs-arm-b {
  transform: rotate(-24deg);
}
.pose-hurt .fs-leg-f {
  transform: rotate(-8deg);
}

/* 倒地:四肢瘫开(整体旋转由外层完成) */
.pose-ko .fs-torso {
  transform: rotate(-10deg);
}
.pose-ko .fs-head {
  transform: rotate(-16deg);
}
.pose-ko .fs-arm-f {
  transform: rotate(-65deg);
}
.pose-ko .fs-arm-b {
  transform: rotate(-50deg);
}
.pose-ko .fs-leg-f {
  transform: rotate(-18deg);
}
.pose-ko .fs-leg-b {
  transform: rotate(12deg);
}

/* 头带飘带摆动 */
@keyframes band-sway {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(8deg);
  }
}
.fs-band-tail {
  transform-box: view-box;
  transform-origin: 38px 33px;
  animation: band-sway 1.3s ease-in-out infinite;
}
</style>
