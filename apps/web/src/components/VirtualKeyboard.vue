<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { KEY_ROWS, PAD, U, type KeyDef } from '../utils/keyboardLayout'
import { FINGERS, FINGER_BY_ID, fingerOfKey, isLeftHand, resolveKey } from '../utils/fingerMap'
import type { FingerId } from '../utils/fingerMap'
import HandOverlay, { type HandPose } from './HandOverlay.vue'

interface Props {
  /** 当前目标字符(英文/指法为下一个待打字符,中文为音节首字母) */
  targetChar?: string | null
  /** 按键反馈:correct 绿色闪烁,wrong 红色闪烁 */
  feedback?: { key: string; correct: boolean; id: number } | null
  showFingers?: boolean
  /** 是否叠加双手手势提示图 */
  showHands?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  targetChar: null,
  feedback: null,
  showFingers: true,
  showHands: true,
})

/** 手势图在键盘下方额外占用的高度 */
const HAND_EXTRA = 110

interface PlacedKey extends KeyDef {
  x: number
  y: number
}

const placedKeys = computed<PlacedKey[]>(() => {
  const out: PlacedKey[] = []
  KEY_ROWS.forEach((row, ri) => {
    let x = 0
    for (const k of row) {
      out.push({ ...k, x, y: ri * U })
      x += k.w * U
    }
  })
  return out
})

const svgWidth = 15 * U + PAD * 2
const svgHeight = computed(() => 5 * U + PAD * 2 + (props.showHands ? HAND_EXTRA : 0))

const target = computed(() => (props.targetChar ? resolveKey(props.targetChar) : null))

/** Shift 提示:目标为大写/上档符号时,高亮对侧 Shift */
const shiftCode = computed<string | null>(() => {
  const t = target.value
  if (!t?.shift) return null
  return isLeftHand(fingerOfKey(t.key)) ? 'rshift' : 'lshift'
})

const flash = ref<{ code: string; correct: boolean } | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.feedback?.id,
  () => {
    const fb = props.feedback
    if (!fb) return
    const resolved = resolveKey(fb.key)
    if (!resolved) return
    flash.value = { code: resolved.key, correct: fb.correct }
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flash.value = null
    }, 250)
  },
)

onBeforeUnmount(() => {
  if (flashTimer) clearTimeout(flashTimer)
})

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

function keyFill(k: PlacedKey): string {
  const color = k.finger ? FINGER_BY_ID[k.finger].color : '#94a3b8'
  if (flash.value?.code === k.code) {
    return flash.value.correct ? '#22c55e' : '#ef4444'
  }
  if (k.code === target.value?.key || k.code === shiftCode.value) {
    return withAlpha(color, 0.85)
  }
  if (props.showFingers && k.finger) {
    return withAlpha(color, 0.14)
  }
  return '#ffffff'
}

function keyStroke(k: PlacedKey): string {
  const isTarget = k.code === target.value?.key || k.code === shiftCode.value
  if (isTarget && k.finger) return FINGER_BY_ID[k.finger].color
  return '#cbd5e1'
}

function keyLabelFill(k: PlacedKey): string {
  const isTarget = k.code === target.value?.key || k.code === shiftCode.value
  if (isTarget || flash.value?.code === k.code) return '#ffffff'
  return '#334155'
}

function isSpecial(k: PlacedKey): boolean {
  return k.w > 1.2 || k.code === 'space'
}

/** 手势图:目标键手指 + 对侧 Shift 手指(大写/上档场景) */
const poses = computed<HandPose[]>(() => {
  const list: HandPose[] = []
  const t = target.value
  if (t) {
    const f = fingerOfKey(t.key)
    if (f) list.push({ finger: f, keyCode: t.key })
  }
  if (shiftCode.value) {
    const sf = fingerOfKey(shiftCode.value)
    if (sf) list.push({ finger: sf, keyCode: shiftCode.value })
  }
  return list
})

const flashFinger = computed<FingerId | null>(() =>
  flash.value ? (fingerOfKey(flash.value.code) ?? null) : null,
)
</script>

<template>
  <div class="select-none">
    <svg :viewBox="`0 0 ${svgWidth} ${svgHeight}`" class="w-full" role="img" aria-label="虚拟键盘">
      <g :transform="`translate(${PAD}, ${PAD})`">
        <g v-for="k in placedKeys" :key="`${k.code}-${k.x}-${k.y}`">
          <rect
            :x="k.x + 2"
            :y="k.y + 2"
            :width="k.w * U - 4"
            :height="U - 4"
            rx="5"
            :fill="keyFill(k)"
            :stroke="keyStroke(k)"
            :stroke-width="k.code === target?.key || k.code === shiftCode ? 2 : 1"
            :class="flash?.code === k.code ? 'kb-flash' : ''"
          />
          <template v-if="k.label2">
            <text
              :x="k.x + k.w * U * (isSpecial(k) ? 0.5 : 0.3)"
              :y="k.y + 16"
              :font-size="10"
              :fill="keyLabelFill(k)"
              :text-anchor="isSpecial(k) ? 'middle' : 'middle'"
            >
              {{ k.label2 }}
            </text>
            <text
              :x="k.x + k.w * U * (isSpecial(k) ? 0.5 : 0.3)"
              :y="k.y + 31"
              :font-size="13"
              :fill="keyLabelFill(k)"
              text-anchor="middle"
            >
              {{ k.label }}
            </text>
          </template>
          <text
            v-else
            :x="k.x + k.w * U * (isSpecial(k) ? 0.5 : 0.5)"
            :y="k.y + 26"
            :font-size="isSpecial(k) ? 11 : 14"
            :fill="keyLabelFill(k)"
            text-anchor="middle"
          >
            {{ k.label }}
          </text>
        </g>
      </g>
      <HandOverlay
        v-if="showHands"
        :poses="poses"
        :flash-finger="flashFinger"
        :flash-correct="flash?.correct ?? true"
      />
    </svg>

    <div v-if="showFingers" class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <div
        v-for="f in FINGERS"
        :key="f.id"
        class="flex items-center gap-1.5 text-xs text-slate-500"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: f.color }" />
        {{ f.name }}
      </div>
    </div>
  </div>
</template>
