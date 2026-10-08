<script setup lang="ts">
import { computed } from 'vue'
import type { FighterPose } from '../../composables/useFightGame'

/**
 * 原创手绘矢量格斗角色:白衣红头带(隆风格)与红衣金发(肯风格)。
 * 每个姿势是一帧独立摆位的"精灵帧"(四肢关节坐标逐帧定义),
 * 躯干/头部用 transform 平滑过渡,配合外层位移动画呈现流畅招式。
 */
const props = defineProps<{
  char: 'ryu' | 'ken'
  pose: FighterPose
}>()

type Pt = [number, number]

interface PoseDef {
  elbB: Pt
  fistB: Pt
  elbF: Pt
  fistF: Pt
  kneeB: Pt
  ankB: Pt
  footB: Pt
  kneeF: Pt
  ankF: Pt
  footF: Pt
  torso: string
  head: string
  face: 'calm' | 'fierce' | 'pain'
}

/** 肩/髋关节锚点(面向右,viewBox 120x170) */
const SHB: Pt = [48, 80]
const SHF: Pt = [68, 79]
const HIPB: Pt = [54, 110]
const HIPF: Pt = [62, 110]

const POSES: Record<Exclude<FighterPose, 'ko'>, PoseDef> = {
  // 待机:格斗架,双拳护头
  idle: {
    elbB: [42, 98],
    fistB: [54, 74],
    elbF: [81, 90],
    fistF: [85, 70],
    kneeB: [42, 132],
    ankB: [40, 150],
    footB: [42, 156],
    kneeF: [74, 130],
    ankF: [71, 150],
    footF: [74, 156],
    torso: 'rotate(4deg)',
    head: 'rotate(3deg)',
    face: 'calm',
  },
  // 波动拳:深弓步双拳前推
  hadouken: {
    elbB: [70, 92],
    fistB: [93, 89],
    elbF: [86, 84],
    fistF: [104, 87],
    kneeB: [33, 132],
    ankB: [22, 150],
    footB: [24, 156],
    kneeF: [84, 126],
    ankF: [85, 148],
    footF: [88, 155],
    torso: 'rotate(13deg) translate(2px, 0px)',
    head: 'rotate(9deg)',
    face: 'fierce',
  },
  // 升龙拳:腾空上勾拳,前拳冲天,双腿收放
  shoryuken: {
    elbB: [41, 99],
    fistB: [47, 113],
    elbF: [79, 52],
    fistF: [74, 27],
    kneeB: [46, 133],
    ankB: [52, 148],
    footB: [54, 153],
    kneeF: [80, 121],
    ankF: [74, 138],
    footF: [73, 143],
    torso: 'rotate(-10deg)',
    head: 'rotate(-6deg)',
    face: 'fierce',
  },
  // 龙卷旋风脚:身体后倾,前腿水平踢出,双臂张开
  tatsumaki: {
    elbB: [30, 66],
    fistB: [17, 59],
    elbF: [76, 98],
    fistF: [67, 109],
    kneeB: [42, 126],
    ankB: [52, 136],
    footB: [56, 141],
    kneeF: [92, 104],
    ankF: [112, 107],
    footF: [116, 108],
    torso: 'rotate(-28deg)',
    head: 'rotate(-14deg)',
    face: 'fierce',
  },
  // 受击:头部后甩,双臂上扬,踉跄
  hurt: {
    elbB: [34, 70],
    fistB: [26, 57],
    elbF: [80, 62],
    fistF: [89, 49],
    kneeB: [37, 131],
    ankB: [29, 150],
    footB: [27, 156],
    kneeF: [74, 134],
    ankF: [68, 150],
    footF: [70, 156],
    torso: 'rotate(-17deg) translate(-2px, 0px)',
    head: 'rotate(-25deg) translate(-3px, 2px)',
    face: 'pain',
  },
}

const C = computed(() =>
  props.char === 'ryu'
    ? {
        gi: '#f5f7fa',
        giShade: '#d3dae4',
        belt: '#14181f',
        skin: '#f0b98a',
        skinShade: '#d99a66',
        hair: '#3c2617',
        band: '#e02b2b',
        glove: '#c62828',
        gloveShade: '#8e1c1c',
        outline: '#171c26',
        mouth: '#57190f',
      }
    : {
        gi: '#e23333',
        giShade: '#a81f1f',
        belt: '#14181f',
        skin: '#f0b98a',
        skinShade: '#d99a66',
        hair: '#f2b01e',
        band: '#e02b2b',
        glove: '#a52020',
        gloveShade: '#6f1212',
        outline: '#171c26',
        mouth: '#57190f',
      },
)

const P = computed(() => {
  const p = props.pose === 'ko' ? POSES.idle : (POSES[props.pose] ?? POSES.idle)
  const seg = (a: Pt, b: Pt) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`
  const tri = (a: Pt, b: Pt, c: Pt) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}`
  return {
    ...p,
    upB: seg(SHB, p.elbB),
    foreB: seg(p.elbB, p.fistB),
    upF: seg(SHF, p.elbF),
    foreF: seg(p.elbF, p.fistF),
    legB: tri(HIPB, p.kneeB, p.ankB),
    legF: tri(HIPF, p.kneeF, p.ankF),
  }
})
</script>

<template>
  <svg
    viewBox="0 0 120 170"
    class="fighter-svg h-full w-full drop-shadow-[0_5px_5px_rgba(0,0,0,0.4)]"
    style="overflow: visible"
    aria-hidden="true"
  >
    <!-- ================= 站立姿势(精灵帧) ================= -->
    <template v-if="pose !== 'ko'">
      <!-- 后腿 -->
      <path
        :d="P.legB"
        :stroke="C.outline"
        stroke-width="21"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        :d="P.legB"
        :stroke="C.giShade"
        stroke-width="16"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <ellipse :cx="P.footB[0]" :cy="P.footB[1]" rx="9.6" ry="5.6" :fill="C.outline" />
      <ellipse :cx="P.footB[0]" :cy="P.footB[1] - 0.6" rx="8" ry="4.2" :fill="C.skinShade" />

      <!-- 后臂 -->
      <path :d="P.upB" :stroke="C.outline" stroke-width="15" stroke-linecap="round" fill="none" />
      <path :d="P.upB" :stroke="C.giShade" stroke-width="10.5" stroke-linecap="round" fill="none" />
      <path
        :d="P.foreB"
        :stroke="C.outline"
        stroke-width="12.5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        :d="P.foreB"
        :stroke="C.skinShade"
        stroke-width="8"
        stroke-linecap="round"
        fill="none"
      />
      <circle :cx="P.fistB[0]" :cy="P.fistB[1]" r="7" :fill="C.outline" />
      <circle :cx="P.fistB[0]" :cy="P.fistB[1]" r="5.2" :fill="C.gloveShade" />

      <!-- 躯干 -->
      <g class="fs-torso" :style="{ transform: P.torso }">
        <path
          d="M43 74 Q40 94 45 112 L73 112 Q78 94 75 74 Q59 65 43 74 Z"
          :fill="C.gi"
          :stroke="C.outline"
          stroke-width="2.6"
          stroke-linejoin="round"
        />
        <path d="M43 74 Q40 94 45 112 L53 112 Q47 92 50 72 Z" :fill="C.giShade" opacity="0.75" />
        <path d="M52 71 L59.5 92 L67 71 Q59.5 66 52 71 Z" :fill="C.skin" />
        <path
          d="M52 71 L59.5 92 L63.5 92 L56.5 70 Z"
          :fill="C.gi"
          :stroke="C.outline"
          stroke-width="1.2"
        />
        <path d="M67 71 L59.5 92" :stroke="C.outline" stroke-width="1.2" fill="none" />
        <path
          d="M70 80 Q68 92 70 102"
          :stroke="C.giShade"
          stroke-width="1.6"
          fill="none"
          opacity="0.8"
        />
        <!-- 腰带 -->
        <path d="M43.5 103 L74.5 103 L73.5 111.5 L44.5 111.5 Z" :fill="C.belt" />
        <rect
          x="55"
          y="101.5"
          width="9"
          height="11"
          rx="2"
          :fill="C.belt"
          :stroke="C.outline"
          stroke-width="1"
        />
        <path
          d="M58 112 L54 125 M63 112 L66.5 124"
          :stroke="C.belt"
          stroke-width="4.6"
          stroke-linecap="round"
          fill="none"
        />
      </g>

      <!-- 前腿 -->
      <path
        :d="P.legF"
        :stroke="C.outline"
        stroke-width="21"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        :d="P.legF"
        :stroke="C.gi"
        stroke-width="16"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        :d="P.legF"
        :stroke="C.giShade"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
        opacity="0.35"
        transform="translate(-3.5, 3)"
      />
      <ellipse :cx="P.footF[0]" :cy="P.footF[1]" rx="9.6" ry="5.6" :fill="C.outline" />
      <ellipse :cx="P.footF[0]" :cy="P.footF[1] - 0.6" rx="8" ry="4.2" :fill="C.skin" />

      <!-- 头 -->
      <g class="fs-head" :style="{ transform: P.head }">
        <path d="M54 55 L54 68 L67 68 L67 55 Z" :fill="C.skinShade" />
        <circle cx="61" cy="45" r="16" :fill="C.skin" :stroke="C.outline" stroke-width="2.6" />
        <circle
          cx="46"
          cy="48"
          r="3.6"
          :fill="C.skinShade"
          :stroke="C.outline"
          stroke-width="1.4"
        />

        <!-- 表情 -->
        <g class="fs-eyes">
          <template v-if="P.face === 'calm'">
            <ellipse cx="58.5" cy="43" rx="2.5" ry="3" fill="#ffffff" />
            <ellipse cx="67.5" cy="42.4" rx="2.5" ry="3" fill="#ffffff" />
            <circle cx="59.6" cy="43.2" r="1.4" :fill="C.outline" />
            <circle cx="68.6" cy="42.6" r="1.4" :fill="C.outline" />
            <path
              d="M55 37.2 L62 36.2"
              :stroke="C.hair"
              stroke-width="2.6"
              stroke-linecap="round"
            />
            <path
              d="M64.5 35.8 L71.5 37.2"
              :stroke="C.hair"
              stroke-width="2.6"
              stroke-linecap="round"
            />
            <path
              d="M60 53.5 Q64 55 67.5 52.5"
              :stroke="C.mouth"
              stroke-width="2"
              stroke-linecap="round"
              fill="none"
            />
          </template>
          <template v-else-if="P.face === 'fierce'">
            <circle cx="59" cy="43.4" r="1.7" :fill="C.outline" />
            <circle cx="68.2" cy="42.8" r="1.7" :fill="C.outline" />
            <path
              d="M54.5 35.8 L62 39.2"
              :stroke="C.hair"
              stroke-width="3.2"
              stroke-linecap="round"
            />
            <path
              d="M65 38.8 L72 35.4"
              :stroke="C.hair"
              stroke-width="3.2"
              stroke-linecap="round"
            />
            <ellipse cx="63.5" cy="54" rx="4.6" ry="3.6" :fill="C.mouth" />
            <path d="M59.6 52.4 L67.4 52.4" stroke="#ffffff" stroke-width="1.5" opacity="0.9" />
          </template>
          <template v-else>
            <path
              d="M55.5 42.5 Q58.5 39.8 61.5 42.5"
              :stroke="C.outline"
              stroke-width="2.2"
              fill="none"
              stroke-linecap="round"
            />
            <path
              d="M64.5 42 Q67.5 39.3 70.5 42"
              :stroke="C.outline"
              stroke-width="2.2"
              fill="none"
              stroke-linecap="round"
            />
            <path
              d="M55 36.5 L61.5 35"
              :stroke="C.hair"
              stroke-width="2.4"
              stroke-linecap="round"
            />
            <path
              d="M65 34.8 L71.5 36.8"
              :stroke="C.hair"
              stroke-width="2.4"
              stroke-linecap="round"
            />
            <ellipse cx="63" cy="54" rx="3.8" ry="3" :fill="C.mouth" />
          </template>
        </g>

        <!-- 头发:隆=棕发+红头带 -->
        <template v-if="char === 'ryu'">
          <path
            d="M45 44 Q43.5 26 61 25 Q78.5 26 77 43 L77 47 Q73 34 61 33 Q49 34 46 48 Z"
            :fill="C.hair"
          />
          <path
            d="M48 30 L44 18 L55 26 M58 25 L57.5 12 L64 23 M69 26 L74 15 L73 29"
            :stroke="C.hair"
            stroke-width="5.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
          <path d="M45 43 L44 53 L49.5 50 L48.5 42 Z" :fill="C.hair" />
          <path d="M44.5 38.5 Q61 32 77.5 38.5 L77.5 44.5 Q61 38.5 44.5 44.5 Z" :fill="C.band" />
          <path
            d="M44.5 42.5 Q61 36.5 77.5 42.5 L77.5 44.5 Q61 38.5 44.5 44.5 Z"
            fill="#a01f1f"
            opacity="0.55"
          />
          <g class="fs-band-tail">
            <path
              d="M45 41 Q30 38.5 20 45 M45.5 44 Q33 47 26 56"
              :stroke="C.band"
              stroke-width="4.6"
              stroke-linecap="round"
              fill="none"
            />
          </g>
          <circle cx="45.5" cy="41.5" r="3.2" :fill="C.band" :stroke="C.outline" stroke-width="1" />
        </template>
        <!-- 头发:肯=金色飞扬长发 -->
        <template v-else>
          <path
            d="M43.5 45 Q41 23.5 61 22.5 Q81 23.5 78.5 44 L78.5 49 Q74 32 61 31 Q48 32 44.5 50 Z"
            :fill="C.hair"
          />
          <path
            d="M47 28 L40 15 L53 23.5 M57.5 21.5 L56.5 8 L65 19.5 M69 22.5 L76.5 11 L74.5 26.5 M77.5 33 L87 25.5 L79.5 39"
            :stroke="C.hair"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
          <path
            d="M43.5 41 Q33 45.5 30 56.5"
            :stroke="C.hair"
            stroke-width="5.5"
            stroke-linecap="round"
            fill="none"
          />
          <path d="M44 43 L43.5 52 L48.5 49.5 Z" :fill="C.hair" />
          <path
            d="M47 26 Q58 21 70 25"
            stroke="#f8d168"
            stroke-width="2"
            fill="none"
            opacity="0.7"
          />
        </template>
      </g>

      <!-- 前臂 -->
      <path :d="P.upF" :stroke="C.outline" stroke-width="15" stroke-linecap="round" fill="none" />
      <path :d="P.upF" :stroke="C.gi" stroke-width="10.5" stroke-linecap="round" fill="none" />
      <path
        :d="P.foreF"
        :stroke="C.outline"
        stroke-width="12.5"
        stroke-linecap="round"
        fill="none"
      />
      <path :d="P.foreF" :stroke="C.skin" stroke-width="8" stroke-linecap="round" fill="none" />
      <circle :cx="P.fistF[0]" :cy="P.fistF[1]" r="7" :fill="C.outline" />
      <circle :cx="P.fistF[0]" :cy="P.fistF[1]" r="5.2" :fill="C.glove" />
      <path
        :d="`M${P.fistF[0] - 3} ${P.fistF[1] - 1.5} q3 -2 6 0`"
        :stroke="C.gloveShade"
        stroke-width="1.4"
        fill="none"
      />
    </template>

    <!-- ================= K.O. 倒地帧(独立绘制) ================= -->
    <template v-else>
      <ellipse cx="62" cy="161" rx="50" ry="6" fill="#000000" opacity="0.2" />

      <!-- 远侧腿 -->
      <path
        d="M70 150 L94 145 L107 149"
        :stroke="C.outline"
        stroke-width="20"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        d="M70 150 L94 145 L107 149"
        :stroke="C.giShade"
        stroke-width="15"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <ellipse cx="110" cy="149" rx="8.5" ry="5" :fill="C.outline" />
      <ellipse cx="110" cy="148.4" rx="7" ry="3.7" :fill="C.skinShade" />
      <!-- 远侧臂 -->
      <path
        d="M46 143 L34 134"
        :stroke="C.outline"
        stroke-width="14"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M46 143 L34 134"
        :stroke="C.giShade"
        stroke-width="9.5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M34 134 L25 135"
        :stroke="C.outline"
        stroke-width="11.5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M34 134 L25 135"
        :stroke="C.skinShade"
        stroke-width="7.5"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="23" cy="135" r="6.4" :fill="C.outline" />
      <circle cx="23" cy="135" r="4.8" :fill="C.gloveShade" />

      <!-- 躯干(横躺) -->
      <path
        d="M36 150 Q33 138.5 47 135.5 L71 137.5 Q80 141 78.5 152 Q77 160 64 159 L44 159 Q34.5 158.5 36 150 Z"
        :fill="C.gi"
        :stroke="C.outline"
        stroke-width="2.6"
        stroke-linejoin="round"
      />
      <path
        d="M44 159 L64 159 Q77 160 78.5 152 L70 151.5 Q60 156 44 154 Z"
        :fill="C.giShade"
        opacity="0.7"
      />
      <path d="M47 135.5 L52 143 L58 137 Z" :fill="C.skin" />
      <path d="M66 137 L73 138.5 L70.5 158 L63.5 157.5 Z" :fill="C.belt" />
      <path
        d="M68 158 L66 166 M72 157 L74 165"
        :stroke="C.belt"
        stroke-width="4"
        stroke-linecap="round"
        fill="none"
      />

      <!-- 近侧腿 -->
      <path
        d="M68 152.5 L92 155 L105 150.5"
        :stroke="C.outline"
        stroke-width="21"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        d="M68 152.5 L92 155 L105 150.5"
        :stroke="C.gi"
        stroke-width="16"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <ellipse cx="108" cy="150.5" rx="9" ry="5.2" :fill="C.outline" />
      <ellipse cx="108" cy="149.9" rx="7.4" ry="3.9" :fill="C.skin" />
      <!-- 近侧臂 -->
      <path
        d="M64 144 L78 136"
        :stroke="C.outline"
        stroke-width="15"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M64 144 L78 136"
        :stroke="C.gi"
        stroke-width="10.5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M78 136 L89 137.5"
        :stroke="C.outline"
        stroke-width="12.5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M78 136 L89 137.5"
        :stroke="C.skin"
        stroke-width="8"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="91" cy="137.5" r="7" :fill="C.outline" />
      <circle cx="91" cy="137.5" r="5.2" :fill="C.glove" />

      <!-- 头(侧躺,面朝上) -->
      <g>
        <!-- 摊开的头发 -->
        <path
          v-if="char === 'ryu'"
          d="M12.5 140 Q9 151 17 159.5 L37 159.5 Q42 151 39 141 Q26 132.5 12.5 140 Z"
          :fill="C.hair"
        />
        <path
          v-else
          d="M11 141 Q7 152 16 160 L38 160 Q44 151 40 140 Q25 130 11 141 Z"
          :fill="C.hair"
        />
        <path
          v-if="char === 'ken'"
          d="M14 136 L8 127 L20 132 M30 133 L32 122 L37 132 M40 138 L48 131 L43 142"
          :stroke="C.hair"
          stroke-width="5"
          stroke-linecap="round"
          fill="none"
        />
        <circle cx="26" cy="148" r="15" :fill="C.skin" :stroke="C.outline" stroke-width="2.6" />
        <template v-if="char === 'ryu'">
          <path d="M12 143.5 Q26 137 39.5 142.5 L39.5 148 Q26 142.5 12 149 Z" :fill="C.band" />
          <path
            d="M13 147 Q5 151 3.5 157.5"
            :stroke="C.band"
            stroke-width="4.4"
            stroke-linecap="round"
            fill="none"
          />
          <path
            d="M12.5 140 Q9.5 149 15 157"
            :stroke="C.hair"
            stroke-width="4"
            stroke-linecap="round"
            fill="none"
          />
        </template>
        <template v-else>
          <path d="M12 142 Q26 133 40 141 L39 147 Q26 139 13 147 Z" :fill="C.hair" />
        </template>
        <!-- 昏迷表情 -->
        <path
          d="M22 145.5 Q25 143.3 28 145.5"
          :stroke="C.outline"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M31.5 145 Q34.5 142.8 37.5 145"
          :stroke="C.outline"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
        />
        <ellipse cx="29.5" cy="153.5" rx="3" ry="2.2" :fill="C.mouth" />
      </g>

      <!-- 冒金星 -->
      <g transform="translate(15 123)">
        <path
          class="ko-star s1"
          d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z"
          fill="#fde047"
          stroke="#f59e0b"
          stroke-width="1"
        />
      </g>
      <g transform="translate(28 115)">
        <path
          class="ko-star s2"
          d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z"
          fill="#fef08a"
          stroke="#f59e0b"
          stroke-width="1"
        />
      </g>
      <g transform="translate(41 122)">
        <path
          class="ko-star s3"
          d="M0 -4.4 L1.3 -1.3 L4.4 0 L1.3 1.3 L0 4.4 L-1.3 1.3 L-4.4 0 L-1.3 -1.3 Z"
          fill="#fde047"
          stroke="#f59e0b"
          stroke-width="1"
        />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.fs-torso {
  transform-box: view-box;
  transform-origin: 58px 112px;
  transition: transform 0.14s ease-out;
}
.fs-head {
  transform-box: view-box;
  transform-origin: 58px 66px;
  transition: transform 0.14s ease-out;
}

/* 待机眨眼 */
@keyframes fs-blink {
  0%,
  90%,
  100% {
    transform: scaleY(1);
  }
  94% {
    transform: scaleY(0.08);
  }
}
.fs-eyes {
  transform-box: view-box;
  transform-origin: 63px 43px;
  animation: fs-blink 4.6s linear infinite;
}

/* 头带飘带摆动 */
@keyframes band-sway {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(9deg);
  }
}
.fs-band-tail {
  transform-box: view-box;
  transform-origin: 45px 41px;
  animation: band-sway 1.25s ease-in-out infinite;
}

/* K.O. 金星闪烁 */
@keyframes ko-star {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0) scale(0.75) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: translateY(-4px) scale(1.15) rotate(18deg);
  }
}
.ko-star {
  transform-box: fill-box;
  transform-origin: center;
  animation: ko-star 1.5s ease-in-out infinite;
}
.ko-star.s2 {
  animation-delay: 0.35s;
}
.ko-star.s3 {
  animation-delay: 0.7s;
}
</style>
