import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { WeaponType } from '../types'

export const KAI = '"Kaiti SC","STKaiti","KaiTi","Noto Serif SC",serif'

export const INK = {
  paper: '#f4eee0',
  paperDark: '#e8dfc8',
  ink: '#2c2a26',
  inkSoft: 'rgba(44,42,38,0.55)',
  inkFaint: 'rgba(44,42,38,0.22)',
  player: '#233240',
  enemy: '#5a2f2a',
  red: '#a63a2a',
  gold: '#a8842c',
  green: '#4a7a4a',
}

export const nameStyle = new TextStyle({
  fontFamily: KAI,
  fontSize: 13,
  fill: INK.ink,
})

export const titleStyle = new TextStyle({
  fontFamily: KAI,
  fontSize: 20,
  fill: INK.ink,
  fontWeight: 'bold',
})

export const floatStyle = new TextStyle({
  fontFamily: KAI,
  fontSize: 16,
  fill: INK.red,
  fontWeight: 'bold',
  stroke: { color: '#fff', width: 2 },
})

/** 确定性随机(mulberry32) */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Pose = 'idle' | 'attack' | 'hit' | 'cast'

export interface FigureOpts {
  color: string
  scale?: number
  pose?: Pose
  /** 1 面向右,-1 面向左 */
  facing?: number
  weapon?: WeaponType | null
  t?: number
  alpha?: number
}

/** 水墨剪影小人(程序化绘制) */
export function drawFigure(g: Graphics, o: FigureOpts): void {
  const s = o.scale ?? 1
  const pose = o.pose ?? 'idle'
  const face = o.facing ?? 1
  const t = o.t ?? 0
  const breathe = Math.sin(t * 2.2) * 1.2 * s
  g.clear()
  g.alpha = o.alpha ?? 0.92

  const lean = pose === 'attack' ? 6 * face * s : pose === 'hit' ? -5 * face * s : 0

  // 袍身(梯形,下摆微摆)
  const sway = Math.sin(t * 1.6) * 1.5 * s
  g.poly([
    -7 * s + lean * 0.4,
    -14 * s + breathe,
    7 * s + lean * 0.4,
    -14 * s + breathe,
    11 * s + sway,
    30 * s,
    -11 * s + sway,
    30 * s,
  ])
    .fill({ color: o.color, alpha: 1 })
  // 头
  g.circle(lean * 0.6, -22 * s + breathe, 6.5 * s).fill({ color: o.color })
  // 发髻
  g.circle(lean * 0.6 - face * 3 * s, -27 * s + breathe, 2.6 * s).fill({ color: o.color })

  // 手臂 + 武器
  const armY = -8 * s + breathe
  g.setStrokeStyle({ width: 3 * s, color: o.color, cap: 'round' })
  if (pose === 'attack') {
    g.moveTo(0, armY).lineTo(face * 16 * s, armY - 4 * s).stroke()
    drawWeapon(g, o.weapon ?? null, face * 18 * s, armY - 5 * s, face, s, 'attack')
  } else if (pose === 'cast') {
    g.moveTo(0, armY).lineTo(face * 8 * s, armY - 12 * s).stroke()
    drawWeapon(g, o.weapon ?? null, face * 9 * s, armY - 14 * s, face, s, 'cast')
  } else if (pose === 'hit') {
    g.moveTo(0, armY).lineTo(-face * 10 * s, armY + 6 * s).stroke()
  } else {
    g.moveTo(0, armY).lineTo(face * 9 * s, armY + 8 * s).stroke()
    drawWeapon(g, o.weapon ?? null, face * 10 * s, armY + 9 * s, face, s, 'idle')
  }
  // 腰带
  g.rect(-8 * s + lean * 0.4, -2 * s + breathe, 16 * s, 2.4 * s).fill({ color: INK.red, alpha: 0.55 })
}

function drawWeapon(
  g: Graphics,
  weapon: WeaponType | null,
  x: number,
  y: number,
  face: number,
  s: number,
  pose: Pose,
): void {
  if (!weapon || weapon === 'fist') return
  const ang = pose === 'attack' ? -0.5 : pose === 'cast' ? -1.1 : 0.9
  g.setStrokeStyle({ width: 2 * s, color: '#3a3a3a', cap: 'round' })
  switch (weapon) {
    case 'sword':
      g.moveTo(x, y)
        .lineTo(x + Math.cos(ang) * 26 * s * face, y + Math.sin(ang) * 26 * s)
        .stroke()
      break
    case 'blade':
      g.setStrokeStyle({ width: 3.4 * s, color: '#444' })
      g.moveTo(x, y)
        .lineTo(x + Math.cos(ang) * 24 * s * face, y + Math.sin(ang) * 24 * s)
        .stroke()
      break
    case 'staff':
      g.setStrokeStyle({ width: 2.6 * s, color: '#5b4632' })
      g.moveTo(x - 12 * s * face, y + 10 * s).lineTo(x + 16 * s * face, y - 12 * s).stroke()
      break
    case 'whip':
      g.moveTo(x, y)
      g.quadraticCurveTo(x + 10 * s * face, y + 8 * s, x + 18 * s * face, y + 2 * s)
      g.stroke()
      break
    case 'ring':
      g.circle(x + 5 * s * face, y + 4 * s, 5 * s).stroke()
      break
    case 'hidden':
      g.circle(x + 4 * s * face, y, 1.6 * s).fill({ color: '#666' })
      break
  }
}

export type SceneKind = 'village' | 'town' | 'mountain' | 'forest' | 'temple' | 'city' | 'cave' | 'water'

/** 场景背景:远山 + 地面 + 场景元素剪影 */
export function drawBackdrop(g: Graphics, kind: SceneKind, w: number, h: number, seed = 7): void {
  const rnd = seeded(seed)
  g.clear()
  // 纸底
  g.rect(0, 0, w, h).fill({ color: kind === 'cave' ? '#d8d2c2' : INK.paper })
  const groundY = h * 0.78

  if (kind !== 'cave') {
    // 远山两层
    ridge(g, w, h * 0.42, h * 0.16, 'rgba(44,42,38,0.12)', rnd)
    ridge(g, w, h * 0.52, h * 0.12, 'rgba(44,42,38,0.2)', rnd)
    // 日/月
    g.circle(w * 0.82, h * 0.16, 16).fill({ color: INK.red, alpha: 0.28 })
  } else {
    // 洞窟:钟乳石
    for (let i = 0; i < 9; i++) {
      const x = rnd() * w
      const len = 14 + rnd() * 34
      g.poly([x - 7, 0, x + 7, 0, x, len]).fill({ color: 'rgba(44,42,38,0.3)' })
    }
  }

  switch (kind) {
    case 'mountain':
      ridge(g, w, groundY - h * 0.1, h * 0.3, 'rgba(44,42,38,0.4)', rnd)
      break
    case 'water': {
      g.rect(0, groundY, w, h - groundY).fill({ color: 'rgba(90,120,140,0.25)' })
      for (let i = 0; i < 7; i++) {
        const y = groundY + 6 + rnd() * (h - groundY - 10)
        const x = rnd() * w
        g.moveTo(x, y).quadraticCurveTo(x + 10, y - 3, x + 22, y).setStrokeStyle({ width: 1.4, color: 'rgba(255,255,255,0.5)' }).stroke()
      }
      break
    }
    case 'forest':
      for (let i = 0; i < 8; i++) {
        const x = rnd() * w
        const bh = 60 + rnd() * 90
        bamboo(g, x, groundY, bh, rnd)
      }
      break
    case 'temple':
      pagoda(g, w * 0.78, groundY, 0.9)
      break
    case 'town':
    case 'city':
      for (let i = 0; i < 5; i++) {
        const x = (w / 5) * i + rnd() * 30
        roof(g, x, groundY - 40 - rnd() * 30, 60 + rnd() * 40, kind === 'city' ? 1.25 : 0.9)
      }
      break
    case 'village':
      roof(g, w * 0.2, groundY - 40, 70, 0.85)
      roof(g, w * 0.62, groundY - 34, 55, 0.75)
      break
    case 'cave':
      break
    default:
      break
  }
  // 地面
  g.rect(0, groundY, w, h - groundY).fill({ color: kind === 'water' ? 'rgba(90,120,140,0.25)' : 'rgba(44,42,38,0.14)' })
  g.moveTo(0, groundY).lineTo(w, groundY).setStrokeStyle({ width: 2, color: 'rgba(44,42,38,0.4)' }).stroke()
}

function ridge(g: Graphics, w: number, baseY: number, amp: number, color: string, rnd: () => number): void {
  const pts: number[] = []
  const n = 7
  for (let i = 0; i <= n; i++) {
    const x = (w / n) * i
    const y = baseY - rnd() * amp * (i === 0 || i === n ? 0.3 : 1)
    pts.push(x, y)
  }
  g.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
  g.lineTo(w, baseY + amp).lineTo(0, baseY + amp).closePath()
  g.fill({ color })
}

function bamboo(g: Graphics, x: number, groundY: number, h: number, rnd: () => number): void {
  g.setStrokeStyle({ width: 3, color: 'rgba(60,80,50,0.5)' })
  g.moveTo(x, groundY).lineTo(x + (rnd() - 0.5) * 8, groundY - h).stroke()
  for (let j = 1; j < 4; j++) {
    const yy = groundY - (h / 4) * j
    g.moveTo(x - 3, yy).lineTo(x + 3, yy).stroke()
    g.moveTo(x, yy).quadraticCurveTo(x + 12, yy - 6, x + 20, yy - 2).setStrokeStyle({ width: 1.4, color: 'rgba(60,80,50,0.4)' }).stroke()
  }
}

function roof(g: Graphics, x: number, y: number, w: number, scale: number): void {
  g.poly([x - w * 0.6 * scale, y + 16 * scale, x, y - 12 * scale, x + w * 0.6 * scale, y + 16 * scale])
    .fill({ color: 'rgba(44,42,38,0.35)' })
  g.rect(x - w * 0.42 * scale, y + 16 * scale, w * 0.84 * scale, 26 * scale).fill({ color: 'rgba(44,42,38,0.22)' })
}

function pagoda(g: Graphics, x: number, groundY: number, scale: number): void {
  for (let i = 0; i < 3; i++) {
    const y = groundY - i * 30 * scale
    const w = (70 - i * 16) * scale
    g.poly([x - w / 2, y - 10 * scale, x, y - 24 * scale, x + w / 2, y - 10 * scale]).fill({ color: 'rgba(44,42,38,0.4)' })
    g.rect(x - w * 0.32, y - 10 * scale, w * 0.64, 10 * scale).fill({ color: 'rgba(44,42,38,0.25)' })
  }
}

/** 墨迹飞溅粒子 */
export interface Splash {
  g: Graphics
  t: number
  life: number
  parts: { x: number; y: number; vx: number; vy: number; r: number }[]
}

export function spawnSplash(parent: Container, x: number, y: number, color: string, power = 1): Splash {
  const g = new Graphics()
  parent.addChild(g)
  const parts: Splash['parts'] = []
  const n = 6 + Math.floor(power * 5)
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = (40 + Math.random() * 120) * power
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: 1.5 + Math.random() * 3 * power })
  }
  return { g, t: 0, life: 0.55, parts }
}

export function updateSplash(s: Splash, dt: number): boolean {
  s.t += dt
  if (s.t >= s.life) {
    s.g.destroy()
    return true
  }
  const k = 1 - s.t / s.life
  s.g.clear()
  for (const p of s.parts) {
    const px = p.x + p.vx * s.t
    const py = p.y + p.vy * s.t + 240 * s.t * s.t
    s.g.circle(px, py, p.r * k).fill({ color: INK.ink, alpha: k * 0.8 })
  }
  return false
}

/** 漂浮文字(伤害/闪避等) */
export interface FloatText {
  node: Text
  t: number
  life: number
  vy: number
}

export function spawnFloat(parent: Container, x: number, y: number, str: string, color: string, size = 16): FloatText {
  const node = new Text({
    text: str,
    style: new TextStyle({ fontFamily: KAI, fontSize: size, fill: color, fontWeight: 'bold', stroke: { color: '#fff', width: 3 } }),
  })
  node.anchor.set(0.5)
  node.x = x + (Math.random() - 0.5) * 24
  node.y = y
  parent.addChild(node)
  return { node, t: 0, life: 0.9, vy: -46 }
}

export function updateFloat(f: FloatText, dt: number): boolean {
  f.t += dt
  if (f.t >= f.life) {
    f.node.destroy()
    return true
  }
  f.node.y += f.vy * dt
  f.node.alpha = 1 - f.t / f.life
  return false
}
