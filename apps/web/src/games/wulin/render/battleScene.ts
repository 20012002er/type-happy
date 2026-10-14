import { Container, Graphics, Text } from 'pixi.js'
import { GAUGE_MAX, VIEW_H, VIEW_W } from '../constants'
import type { CombatState } from '../sim/combat'
import type { WeaponType } from '../types'
import {
  INK,
  drawBackdrop,
  drawFigure,
  nameStyle,
  spawnFloat,
  spawnSplash,
  updateFloat,
  updateSplash,
  type FloatText,
  type Pose,
  type SceneKind,
  type Splash,
} from './ink'

const GROUND_Y = VIEW_H * 0.78
const P_X = 128
const E_X = 352
const SCALE = 1.5

interface FighterAnim {
  pose: Pose
  poseT: number
  lunge: number
  dead: boolean
}

export class BattleScene {
  readonly container = new Container()
  /** 事件回调(音效等) */
  onEvent: ((ev: CombatState['events'][number]) => void) | null = null
  private backdrop = new Graphics()
  private playerG = new Graphics()
  private enemyG = new Graphics()
  private bars = new Graphics()
  private nameL = new Text({ text: '', style: nameStyle })
  private nameR = new Text({ text: '', style: nameStyle })
  private fx = new Container()
  private splashes: Splash[] = []
  private floats: FloatText[] = []
  private pending: { at: number; fn: () => void }[] = []
  private time = 0
  private pAnim: FighterAnim = { pose: 'idle', poseT: 0, lunge: 0, dead: false }
  private eAnim: FighterAnim = { pose: 'idle', poseT: 0, lunge: 0, dead: false }
  private playerWeapon: WeaponType | null = null
  private enemyWeapon: WeaponType | null = null
  private flashL = 0
  private flashR = 0

  constructor(sceneKind: SceneKind = 'mountain') {
    this.container.addChild(this.backdrop, this.playerG, this.enemyG, this.bars, this.fx, this.nameL, this.nameR)
    drawBackdrop(this.backdrop, sceneKind, VIEW_W, VIEW_H, 42)
    this.nameL.x = 14
    this.nameL.y = 8
    this.nameR.x = VIEW_W - 14
    this.nameR.y = 8
    this.nameR.anchor.set(1, 0)
    this.playerG.y = GROUND_Y - 30 * SCALE
    this.enemyG.y = GROUND_Y - 30 * SCALE
  }

  setFighters(playerName: string, enemyName: string, playerWeapon: WeaponType | null, enemyWeapon: WeaponType | null): void {
    this.nameL.text = playerName
    this.nameR.text = enemyName
    this.playerWeapon = playerWeapon
    this.enemyWeapon = enemyWeapon
  }

  sync(state: CombatState, dt: number): void {
    this.time += dt
    // 消费战斗事件 → 动画队列
    for (const ev of state.events) {
      this.onEvent?.(ev)
      const attacker = ev.side === 'player' ? this.pAnim : this.eAnim
      const target = ev.side === 'player' ? this.eAnim : this.pAnim
      const tx = ev.side === 'player' ? E_X : P_X
      const ty = GROUND_Y - 40
      if (ev.type === 'attack' || ev.type === 'skill') {
        attacker.pose = ev.type === 'skill' ? 'cast' : 'attack'
        attacker.poseT = 0
        attacker.lunge = ev.type === 'skill' ? 34 : 26
        const power = ev.type === 'skill' ? 1.5 : 1
        this.pending.push({
          at: this.time + 0.14,
          fn: () => {
            target.pose = 'hit'
            target.poseT = 0
            this.splashes.push(spawnSplash(this.fx, tx, ty, INK.ink, power))
            if (ev.damage !== undefined) {
              this.floats.push(spawnFloat(this.fx, tx, ty - 10, `-${ev.damage}`, ev.type === 'skill' ? INK.gold : INK.red, ev.type === 'skill' ? 19 : 16))
            }
            if (ev.side === 'player') this.flashR = 0.12
            else this.flashL = 0.12
          },
        })
      } else if (ev.type === 'miss') {
        attacker.pose = 'attack'
        attacker.poseT = 0
        attacker.lunge = 18
        this.pending.push({
          at: this.time + 0.12,
          fn: () => {
            target.pose = 'idle'
            this.floats.push(spawnFloat(this.fx, tx, ty - 10, '闪避', '#6b7280', 14))
          },
        })
      } else if (ev.type === 'heal') {
        attacker.pose = 'cast'
        attacker.poseT = 0
        const sx = ev.side === 'player' ? P_X : E_X
        this.floats.push(spawnFloat(this.fx, sx, ty - 10, `+${ev.heal ?? 0}`, INK.green, 16))
      } else if (ev.type === 'stun') {
        attacker.pose = 'cast'
        attacker.poseT = 0
        this.pending.push({
          at: this.time + 0.14,
          fn: () => {
            target.pose = 'hit'
            target.poseT = 0
            this.floats.push(spawnFloat(this.fx, tx, ty - 10, '眩晕!', INK.gold, 17))
          },
        })
      } else if (ev.type === 'end') {
        const winner = state.winner
        const w = winner === 'player' ? this.pAnim : winner === 'enemy' ? this.eAnim : null
        const l = winner === 'player' ? this.eAnim : winner === 'enemy' ? this.pAnim : null
        if (w) {
          w.pose = 'cast'
          w.poseT = 0
        }
        if (l && state.mode !== 'spar') l.dead = true
      }
    }
    state.events.length = 0

    // 定时回调
    this.pending = this.pending.filter((p) => {
      if (this.time >= p.at) {
        p.fn()
        return false
      }
      return true
    })

    for (const a of [this.pAnim, this.eAnim]) {
      a.poseT += dt
      if (a.pose !== 'idle' && a.poseT > 0.32) a.pose = 'idle'
      a.lunge = Math.max(0, a.lunge - dt * 160)
    }
    this.flashL = Math.max(0, this.flashL - dt)
    this.flashR = Math.max(0, this.flashR - dt)

    this.drawFighter(this.playerG, this.pAnim, P_X, 1, INK.player, this.playerWeapon, this.flashL)
    this.drawFighter(this.enemyG, this.eAnim, E_X, -1, INK.enemy, this.enemyWeapon, this.flashR)
    this.drawBars(state)

    this.splashes = this.splashes.filter((s) => !updateSplash(s, dt))
    this.floats = this.floats.filter((f) => !updateFloat(f, dt))
  }

  private drawFighter(g: Graphics, a: FighterAnim, x: number, facing: number, color: string, weapon: WeaponType | null, flash: number): void {
    g.clear()
    if (a.dead) {
      g.x = x
      g.rotation = (facing * Math.PI) / 2.2
      g.y = GROUND_Y - 6
      drawFigure(g, { color, scale: SCALE * 0.9, pose: 'hit', facing, weapon: null, t: 0, alpha: 0.55 })
      return
    }
    g.rotation = 0
    g.y = GROUND_Y - 30 * SCALE
    g.x = x - facing * a.lunge
    const c = flash > 0 ? INK.red : color
    drawFigure(g, { color: c, scale: SCALE, pose: a.pose, facing, weapon, t: this.time + (facing < 0 ? 1.3 : 0) })
  }

  private drawBars(state: CombatState): void {
    const g = this.bars
    g.clear()
    this.drawSide(g, state.player, 14)
    this.drawSide(g, state.enemy, VIEW_W - 14 - 190)
  }

  private drawSide(g: Graphics, c: CombatState['player'], x: number): void {
    const w = 190
    const y = 28
    const hpRatio = Math.max(0, c.hp / c.hpMax)
    const injuryRatio = Math.min(1, c.injury / c.hpMax)
    const mpRatio = Math.min(1, c.mp / Math.max(1, c.mpMax))
    const gaugeRatio = Math.min(1, c.gauge / GAUGE_MAX)
    // 底
    g.roundRect(x, y, w, 9, 4).fill({ color: 'rgba(44,42,38,0.18)' })
    // 伤势(灰)
    g.roundRect(x, y, w * Math.min(1, hpRatio + injuryRatio), 9, 4).fill({ color: 'rgba(120,120,120,0.55)' })
    // 气血
    if (hpRatio > 0) g.roundRect(x, y, w * hpRatio, 9, 4).fill({ color: INK.red })
    // 内力
    g.roundRect(x, y + 11, w, 5, 2.5).fill({ color: 'rgba(44,42,38,0.15)' })
    if (mpRatio > 0) g.roundRect(x, y + 11, w * mpRatio, 5, 2.5).fill({ color: INK.gold })
    // 行动条
    g.roundRect(x, y + 18, w, 4, 2).fill({ color: 'rgba(44,42,38,0.12)' })
    if (gaugeRatio > 0) g.roundRect(x, y + 18, w * gaugeRatio, 4, 2).fill({ color: '#d9a441' })
    if (c.stun > 0) {
      g.circle(x + w + 8, y + 5, 5).fill({ color: INK.gold })
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
