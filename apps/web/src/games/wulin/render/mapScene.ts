import { Container, Graphics, Rectangle, Text, TextStyle } from 'pixi.js'
import { VIEW_H, VIEW_W } from '../constants'
import type { RoomDef, WeaponType } from '../types'
import { INK, KAI, drawBackdrop, drawFigure, type SceneKind } from './ink'

const GROUND_Y = VIEW_H * 0.78

export interface NpcView {
  id: string
  name: string
  hostile: boolean
  defeated: boolean
}

export interface RoomView {
  room: RoomDef
  npcs: NpcView[]
  picked: boolean[]
  spotLeft: number[]
  playerName: string
  playerWeapon: WeaponType | null
}

export interface MapCallbacks {
  onExit: (roomId: string) => void
  onNpc: (npcId: string) => void
  onPickup: (index: number) => void
  onSpot: (index: number) => void
}

interface Walker {
  fromX: number
  toX: number
  t: number
  dir: number
  done: () => void
}

function hash(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const labelStyle = new TextStyle({ fontFamily: KAI, fontSize: 12, fill: INK.ink })
const plaqueStyle = new TextStyle({ fontFamily: KAI, fontSize: 18, fill: INK.ink, fontWeight: 'bold' })
const exitStyle = new TextStyle({ fontFamily: KAI, fontSize: 13, fill: INK.ink })

export class MapScene {
  readonly container = new Container()
  private backdrop = new Graphics()
  private layer = new Container()
  private player = new Graphics()
  private fx = new Graphics()
  private time = 0
  private walker: Walker | null = null
  private playerX = VIEW_W / 2
  private spotPositions: { x: number; y: number }[] = []

  constructor() {
    this.container.addChild(this.backdrop, this.layer, this.player, this.fx)
  }

  show(view: RoomView, cb: MapCallbacks): void {
    this.layer.removeChildren().forEach((c) => c.destroy({ children: true }))
    this.walker = null
    this.playerX = VIEW_W / 2
    this.spotPositions = []
    const kind = (view.room.scene ?? 'village') as SceneKind
    drawBackdrop(this.backdrop, kind, VIEW_W, VIEW_H, hash(view.room.id) % 9973)

    // 房间名匾额
    const plaque = new Graphics()
    const nameText = new Text({ text: view.room.name, style: plaqueStyle })
    const pw = nameText.width + 34
    plaque.roundRect(VIEW_W / 2 - pw / 2, 10, pw, 32, 6).fill({ color: 'rgba(244,238,224,0.92)' }).setStrokeStyle({ width: 1.5, color: 'rgba(44,42,38,0.5)' }).stroke()
    nameText.x = VIEW_W / 2 - nameText.width / 2
    nameText.y = 26 - nameText.height / 2 + 2
    this.layer.addChild(plaque, nameText)

    // 出口
    for (const ex of view.room.exits) {
      const pos = this.exitAnchor(ex.dir)
      const gate = new Graphics()
      gate.roundRect(pos.x - 26, pos.y - 15, 52, 30, 8).fill({ color: 'rgba(44,42,38,0.08)' }).setStrokeStyle({ width: 1.5, color: 'rgba(44,42,38,0.45)' }).stroke()
      const label = new Text({ text: `${ex.dir} →`, style: exitStyle })
      label.x = pos.x - label.width / 2
      label.y = pos.y - label.height / 2
      const hit = new Container()
      hit.addChild(gate, label)
      hit.eventMode = 'static'
      hit.cursor = 'pointer'
      hit.on('pointertap', () => {
        if (this.walker) return
        this.startWalk(pos.x, () => cb.onExit(ex.to))
      })
      this.layer.addChild(hit)
    }

    // NPC
    const npcXs = [120, 210, 300, 390, 250, 160]
    view.npcs.forEach((n, i) => {
      const x = npcXs[i % npcXs.length]
      const y = GROUND_Y - 26
      const g = new Graphics()
      drawFigure(g, {
        color: n.defeated ? 'rgba(90,47,42,0.3)' : n.hostile ? INK.enemy : INK.inkSoft,
        scale: 0.85,
        pose: 'idle',
        facing: x < VIEW_W / 2 ? 1 : -1,
        t: i * 1.7,
        alpha: n.defeated ? 0.3 : 0.9,
      })
      g.x = x
      g.y = y
      const label = new Text({ text: n.defeated ? `${n.name}(已败)` : n.name, style: labelStyle })
      label.x = x - label.width / 2
      label.y = GROUND_Y + 4
      const holder = new Container()
      holder.addChild(g, label)
      if (!n.defeated) {
        holder.eventMode = 'static'
        holder.cursor = 'pointer'
        holder.hitArea = new Rectangle(x - 26, y - 44, 52, GROUND_Y + 20 - (y - 44))
        holder.on('pointertap', () => cb.onNpc(n.id))
      }
      this.layer.addChild(holder)
    })

    // 拾取点与练功点(共用第二行标签与位置池,避免重叠)
    const interXs = [48, 432, 240, 140, 340]
    let interIdx = 0
    view.picked.forEach((picked, i) => {
      if (picked) return
      const x = interXs[interIdx++ % interXs.length]
      this.spotPositions.push({ x, y: GROUND_Y - 8 })
      const g = new Graphics()
      g.circle(x, GROUND_Y - 10, 6).fill({ color: INK.gold, alpha: 0.85 }).circle(x, GROUND_Y - 10, 10).setStrokeStyle({ width: 1, color: INK.gold, alpha: 0.4 }).stroke()
      const label = new Text({ text: '翻找', style: labelStyle })
      label.x = x - label.width / 2
      label.y = GROUND_Y + 18
      const holder = new Container()
      holder.addChild(g, label)
      holder.eventMode = 'static'
      holder.cursor = 'pointer'
      holder.on('pointertap', () => cb.onPickup(i))
      this.layer.addChild(holder)
    })

    // 练功点
    ;(view.room.train ?? []).forEach((spot, i) => {
      const left = view.spotLeft[i] ?? 0
      const x = interXs[interIdx++ % interXs.length]
      const y = GROUND_Y - 18
      const g = new Graphics()
      // 木人桩
      g.rect(x - 3, y - 12, 6, 30).fill({ color: 'rgba(91,70,50,0.8)' })
      g.circle(x, y - 18, 7).fill({ color: 'rgba(91,70,50,0.8)' })
      g.moveTo(x - 12, y - 4).lineTo(x + 12, y - 4).setStrokeStyle({ width: 4, color: 'rgba(91,70,50,0.8)', cap: 'round' }).stroke()
      if (left <= 0) g.alpha = 0.35
      const label = new Text({ text: spot.label, style: labelStyle })
      label.x = x - label.width / 2
      label.y = GROUND_Y + 18
      const holder = new Container()
      holder.addChild(g, label)
      holder.eventMode = 'static'
      holder.cursor = 'pointer'
      holder.on('pointertap', () => cb.onSpot(i))
      this.layer.addChild(holder)
    })
  }

  private exitAnchor(dir: string): { x: number; y: number } {
    if (dir.includes('西')) return { x: 34, y: GROUND_Y - 46 }
    if (dir.includes('东')) return { x: VIEW_W - 34, y: GROUND_Y - 46 }
    if (dir.includes('北')) return { x: VIEW_W / 2, y: GROUND_Y - 96 }
    return { x: VIEW_W * 0.3, y: GROUND_Y - 34 }
  }

  private startWalk(toX: number, done: () => void): void {
    this.walker = { fromX: this.playerX, toX: toX < 60 || toX > VIEW_W - 60 ? toX : this.playerX, t: 0, dir: toX < this.playerX ? -1 : 1, done }
    if (Math.abs(toX - this.playerX) < 30) {
      // 距离太近,原地顿一下就走
      this.walker.toX = this.playerX + this.walker.dir * 24
    }
  }

  update(dt: number, view: { playerName: string; playerWeapon: WeaponType | null }): void {
    this.time += dt
    this.fx.clear()
    // 拾取点闪光动画
    for (const p of this.spotPositions) {
      const r = 10 + Math.sin(this.time * 4 + p.x) * 3
      this.fx.circle(p.x, p.y - 2, r).setStrokeStyle({ width: 1, color: INK.gold, alpha: 0.35 }).stroke()
    }
    let facing = 1
    if (this.walker) {
      this.walker.t += dt
      const k = Math.min(1, this.walker.t / 0.4)
      this.playerX = this.walker.fromX + (this.walker.toX - this.walker.fromX) * k
      facing = this.walker.dir
      if (k >= 1) {
        const w = this.walker
        this.walker = null
        w.done()
      }
    }
    this.player.clear()
    this.player.x = this.playerX
    this.player.y = GROUND_Y - 30 * 1.25
    drawFigure(this.player, {
      color: INK.player,
      scale: 1.25,
      pose: this.walker ? 'attack' : 'idle',
      facing,
      weapon: view.playerWeapon,
      t: this.time,
    })
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
