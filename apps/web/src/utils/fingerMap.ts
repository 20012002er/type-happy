export type FingerId = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp' | 'thumb'

export interface FingerInfo {
  id: FingerId
  name: string
  color: string
}

/** 8 指 + 拇指,各自一色(虚拟键盘分色与图例) */
export const FINGERS: FingerInfo[] = [
  { id: 'lp', name: '左小指', color: '#f43f5e' },
  { id: 'lr', name: '左无名指', color: '#fb923c' },
  { id: 'lm', name: '左中指', color: '#eab308' },
  { id: 'li', name: '左食指', color: '#22c55e' },
  { id: 'ri', name: '右食指', color: '#14b8a6' },
  { id: 'rm', name: '右中指', color: '#0ea5e9' },
  { id: 'rr', name: '右无名指', color: '#818cf8' },
  { id: 'rp', name: '右小指', color: '#c084fc' },
  { id: 'thumb', name: '拇指', color: '#94a3b8' },
]

export const FINGER_BY_ID: Record<FingerId, FingerInfo> = Object.fromEntries(
  FINGERS.map((f) => [f.id, f]),
) as Record<FingerId, FingerInfo>

const LEFT_HAND: ReadonlySet<FingerId> = new Set(['lp', 'lr', 'lm', 'li'])

export function isLeftHand(finger: FingerId | undefined): boolean {
  return finger !== undefined && LEFT_HAND.has(finger)
}

/** 键位(主键盘区)→ 手指映射,标准 touch-typing 分区 */
export const KEY_FINGER: Record<string, FingerId> = {
  '`': 'lp',
  '1': 'lp',
  q: 'lp',
  a: 'lp',
  z: 'lp',
  '2': 'lr',
  w: 'lr',
  s: 'lr',
  x: 'lr',
  '3': 'lm',
  e: 'lm',
  d: 'lm',
  c: 'lm',
  '4': 'li',
  '5': 'li',
  r: 'li',
  t: 'li',
  f: 'li',
  g: 'li',
  v: 'li',
  b: 'li',
  '6': 'ri',
  '7': 'ri',
  y: 'ri',
  u: 'ri',
  h: 'ri',
  j: 'ri',
  n: 'ri',
  m: 'ri',
  '8': 'rm',
  i: 'rm',
  k: 'rm',
  ',': 'rm',
  '9': 'rr',
  o: 'rr',
  l: 'rr',
  '.': 'rr',
  '0': 'rp',
  '-': 'rp',
  '=': 'rp',
  p: 'rp',
  '[': 'rp',
  ']': 'rp',
  '\\': 'rp',
  ';': 'rp',
  "'": 'rp',
  '/': 'rp',
  ' ': 'thumb',
  // 功能键(resolveKey 归一化后的 code)
  space: 'thumb',
  lshift: 'lp',
  rshift: 'rp',
  tab: 'lp',
  capslock: 'lp',
  enter: 'rp',
  backspace: 'rp',
}

export interface KeyTarget {
  /** 键盘布局中的键 code(小写基础键) */
  key: string
  /** 是否需要 Shift */
  shift: boolean
}

const SHIFTED_SYMBOLS: Record<string, string> = {
  '~': '`',
  '!': '1',
  '@': '2',
  '#': '3',
  $: '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0',
  _: '-',
  '+': '=',
  '{': '[',
  '}': ']',
  '|': '\\',
  ':': ';',
  '"': "'",
  '<': ',',
  '>': '.',
  '?': '/',
}

/** 字符 → 键位目标(含 Shift 提示);无法映射的字符返回 null */
export function resolveKey(char: string): KeyTarget | null {
  if (char === ' ') return { key: 'space', shift: false }
  if (char === '\n') return { key: 'enter', shift: false }
  if (char === '\t') return { key: 'tab', shift: false }
  const shifted = SHIFTED_SYMBOLS[char]
  if (shifted) return { key: shifted, shift: true }
  if (/[a-zA-Z]/.test(char)) {
    return { key: char.toLowerCase(), shift: char >= 'A' && char <= 'Z' }
  }
  if (/[0-9]/.test(char)) return { key: char, shift: false }
  if ("`-=[]\\;',./".includes(char)) return { key: char, shift: false }
  return null
}

/** 目标键对应的手指(用于键盘高亮与提示) */
export function fingerOfKey(key: string): FingerId | undefined {
  return KEY_FINGER[key]
}
