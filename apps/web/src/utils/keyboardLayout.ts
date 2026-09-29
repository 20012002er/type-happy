import type { FingerId } from './fingerMap'

export interface KeyDef {
  /** 键标识:字符键为小写字符本身,功能键为名称(tab/capslock/enter/lshift...) */
  code: string
  label: string
  /** Shift 上档符号(数字/符号键) */
  label2?: string
  /** 键宽(单位:1 标准键) */
  w: number
  finger?: FingerId
}

function letterKeys(letters: string, fingers: FingerId[]): KeyDef[] {
  return letters.split('').map((ch, i) => ({
    code: ch,
    label: ch,
    w: 1,
    finger: fingers[i],
  }))
}

/** 主键盘区布局,每行合计 15 个单位宽 */
export const KEY_ROWS: KeyDef[][] = [
  [
    { code: '`', label: '`', label2: '~', w: 1, finger: 'lp' },
    { code: '1', label: '1', label2: '!', w: 1, finger: 'lp' },
    { code: '2', label: '2', label2: '@', w: 1, finger: 'lr' },
    { code: '3', label: '3', label2: '#', w: 1, finger: 'lm' },
    { code: '4', label: '4', label2: '$', w: 1, finger: 'li' },
    { code: '5', label: '5', label2: '%', w: 1, finger: 'li' },
    { code: '6', label: '6', label2: '^', w: 1, finger: 'ri' },
    { code: '7', label: '7', label2: '&', w: 1, finger: 'ri' },
    { code: '8', label: '8', label2: '*', w: 1, finger: 'rm' },
    { code: '9', label: '9', label2: '(', w: 1, finger: 'rr' },
    { code: '0', label: '0', label2: ')', w: 1, finger: 'rp' },
    { code: '-', label: '-', label2: '_', w: 1, finger: 'rp' },
    { code: '=', label: '=', label2: '+', w: 1, finger: 'rp' },
    { code: 'backspace', label: '退格', w: 2, finger: 'rp' },
  ],
  [
    { code: 'tab', label: 'Tab', w: 1.5, finger: 'lp' },
    ...letterKeys('qwertyuiop', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp']),
    { code: '[', label: '[', label2: '{', w: 1, finger: 'rp' },
    { code: ']', label: ']', label2: '}', w: 1, finger: 'rp' },
    { code: '\\', label: '\\', label2: '|', w: 1.5, finger: 'rp' },
  ],
  [
    { code: 'capslock', label: 'Caps', w: 1.75, finger: 'lp' },
    ...letterKeys('asdfghjkl', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr']),
    { code: ';', label: ';', label2: ':', w: 1, finger: 'rp' },
    { code: "'", label: "'", label2: '"', w: 1, finger: 'rp' },
    { code: 'enter', label: '回车', w: 2.25, finger: 'rp' },
  ],
  [
    { code: 'lshift', label: 'Shift', w: 2.5, finger: 'lp' },
    ...letterKeys('zxcvbnm', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'rm']),
    { code: ',', label: ',', label2: '<', w: 1, finger: 'rm' },
    { code: '.', label: '.', label2: '>', w: 1, finger: 'rr' },
    { code: '/', label: '/', label2: '?', w: 1, finger: 'rp' },
    { code: 'rshift', label: 'Shift', w: 2.5, finger: 'rp' },
  ],
  [
    { code: 'lctrl', label: 'Ctrl', w: 1.5, finger: 'lp' },
    { code: 'lalt', label: 'Alt', w: 1.5, finger: 'lr' },
    { code: 'space', label: '空格', w: 9, finger: 'thumb' },
    { code: 'ralt', label: 'Alt', w: 1.5, finger: 'rr' },
    { code: 'rctrl', label: 'Ctrl', w: 1.5, finger: 'rp' },
  ],
]
