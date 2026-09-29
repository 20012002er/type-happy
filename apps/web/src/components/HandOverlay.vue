<script setup lang="ts">
import { computed } from 'vue'
import { keyCenter } from '../utils/keyboardLayout'
import type { FingerId } from '../utils/fingerMap'

export interface HandPose {
  finger: FingerId
  keyCode: string
}

interface Props {
  /** 当前需要动作的手指及其目标键(Shift 场景为两个 pose) */
  poses: HandPose[]
  flashFinger?: FingerId | null
  flashCorrect?: boolean
}

const props = withDefaults(defineProps<Props>(), { flashFinger: null, flashCorrect: true })

interface FingerSpec {
  finger: FingerId
  side: 'l' | 'r'
  /** 指根(掌缘)坐标 */
  base: [number, number]
  /**  resting 指尖坐标(基准键位上) */
  rest: [number, number]
  /** 手指半径 */
  r: number
}

function homeTip(code: string): [number, number] {
  const c = keyCenter(code)
  return c ? [c.x, c.y + 6] : [0, 0]
}

const SPECS: FingerSpec[] = [
  { finger: 'lp', side: 'l', base: [103, 198], rest: homeTip('a'), r: 7.5 },
  { finger: 'lr', side: 'l', base: [139, 202], rest: homeTip('s'), r: 8 },
  { finger: 'lm', side: 'l', base: [175, 203], rest: homeTip('d'), r: 8.5 },
  { finger: 'li', side: 'l', base: [211, 200], rest: homeTip('f'), r: 8.5 },
  { finger: 'ri', side: 'r', base: [368, 200], rest: homeTip('j'), r: 8.5 },
  { finger: 'rm', side: 'r', base: [404, 203], rest: homeTip('k'), r: 8.5 },
  { finger: 'rr', side: 'r', base: [440, 202], rest: homeTip('l'), r: 8 },
  { finger: 'rp', side: 'r', base: [476, 198], rest: homeTip(';'), r: 7.5 },
  { finger: 'thumb', side: 'l', base: [222, 222], rest: [292, 200], r: 10 },
  { finger: 'thumb', side: 'r', base: [420, 222], rest: [350, 200], r: 10 },
]

function tipFor(spec: FingerSpec, keyCode: string | null): [number, number] {
  if (!keyCode) return spec.rest
  const c = keyCenter(keyCode)
  if (!c) return spec.rest
  if (spec.finger === 'thumb') {
    return [c.x + (spec.side === 'l' ? -20 : 20), c.y + 2]
  }
  return [c.x, c.y + 6]
}

const poseByFinger = computed(() => {
  const m = new Map<FingerId, string>()
  for (const p of props.poses) m.set(p.finger, p.keyCode)
  return m
})

interface RenderFinger extends FingerSpec {
  d: string
  state: 'idle' | 'active' | 'flash'
}

const fingers = computed<RenderFinger[]>(() =>
  SPECS.map((spec) => {
    const keyCode = poseByFinger.value.get(spec.finger) ?? null
    const [tx, ty] = tipFor(spec, keyCode)
    const state: RenderFinger['state'] =
      props.flashFinger === spec.finger ? 'flash' : keyCode !== null ? 'active' : 'idle'
    return {
      ...spec,
      d: `M ${spec.base[0]} ${spec.base[1]} L ${tx} ${ty}`,
      state,
    }
  }),
)

function outlineColor(f: RenderFinger): string {
  if (f.state === 'flash') return props.flashCorrect ? '#16a34a' : '#dc2626'
  if (f.state === 'active') return '#2563eb'
  return '#94a3b8'
}

function fillColor(f: RenderFinger): string {
  if (f.state === 'flash') return props.flashCorrect ? '#bbf7d0' : '#fecaca'
  if (f.state === 'active') return '#bfdbfe'
  return '#f1f5f9'
}
</script>

<template>
  <g pointer-events="none">
    <rect
      x="86"
      y="188"
      width="150"
      height="150"
      rx="30"
      fill="#f1f5f9"
      fill-opacity="0.5"
      stroke="#94a3b8"
      stroke-width="2"
    />
    <rect
      x="348"
      y="188"
      width="150"
      height="150"
      rx="30"
      fill="#f1f5f9"
      fill-opacity="0.5"
      stroke="#94a3b8"
      stroke-width="2"
    />
    <g v-for="f in fingers" :key="`${f.finger}-${f.side}`" class="finger">
      <path
        :d="f.d"
        :stroke="outlineColor(f)"
        :stroke-width="f.r * 2 + 3"
        stroke-linecap="round"
        fill="none"
      />
      <path
        :d="f.d"
        :stroke="fillColor(f)"
        :stroke-width="f.r * 2"
        stroke-linecap="round"
        :stroke-opacity="f.state === 'idle' ? 0.6 : 0.85"
        fill="none"
      />
    </g>
  </g>
</template>

<style scoped>
.finger path {
  transition:
    d 120ms ease,
    stroke 150ms ease;
}
</style>
