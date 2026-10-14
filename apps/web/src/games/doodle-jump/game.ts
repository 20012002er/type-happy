import { Application, Assets, Container, Sprite, Texture } from 'pixi.js'
import {
  ACCEL_X,
  DAMP_X,
  DOODLER_H,
  DOODLER_W,
  GRAVITY,
  JETPACK_TIME,
  JUMP_V,
  MAX_VX,
  PLATFORM_H,
  PLATFORM_W,
  PROPELLER_TIME,
  SCORE_PER_PX,
  SPRING_V,
  TRAMPOLINE_V,
  WORLD_H,
  WORLD_W,
  type DeathCause,
  type GameEvent,
  type MonsterKind,
  type PlatformKind,
  type PowerupKind,
} from './constants'
import { audio } from './audio'
import { BitmapText, type FontData } from './bitmapText'

export interface GameResult {
  score: number
  jumps: number
  time: number
  cause: DeathCause
  monstersShot: number
  monstersJumped: number
}

export interface GameHooks {
  onEvent: (e: GameEvent) => void
  onScore: (score: number) => void
  onGameOver: (r: GameResult) => void
}

interface Platform {
  sprite: Sprite
  kind: PlatformKind
  x: number
  y: number
  vx: number
  broken: boolean
  vanished: boolean
  spring: 'spring' | 'trampoline' | null
  springSprite: Sprite | null
  springT: number
  dir: number
}

interface Monster {
  container: Container
  kind: MonsterKind
  frames: Texture[]
  lastFrame: number
  x: number
  y: number
  vx: number
  t: number
  dead: boolean
  w: number
  h: number
}

interface Powerup {
  sprite: Sprite
  kind: PowerupKind
  x: number
  y: number
  taken: boolean
}

interface Projectile {
  sprite: Sprite
  x: number
  y: number
  vx: number
  vy: number
  dead: boolean
}

interface Hazard {
  container: Container
  kind: 'ufo' | 'blackhole'
  x: number
  y: number
  t: number
  vx: number
  done: boolean
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0]

export class DoodleGame {
  private app: Application
  private world = new Container()
  private hooks: GameHooks
  private font: FontData
  private scoreText: BitmapText

  private platforms: Platform[] = []
  private monsters: Monster[] = []
  private powerups: Powerup[] = []
  private projectiles: Projectile[] = []
  private hazards: Hazard[] = []

  private doodler = new Sprite()
  private texLeft: Texture
  private texRight: Texture
  private texShoot: Texture
  private facing = 1
  private vx = 0
  private vy = 0
  private px = WORLD_W / 2
  private py = 0
  private axis = 0
  private shootCooldown = 0
  private shootPose = 0

  private cameraY = 0
  private minY = 0
  private startY = 0
  private nextSpawnY = 0
  private elapsed = 0
  private jumps = 0
  private monstersShot = 0
  private monstersJumped = 0

  private jetpackT = 0
  private propellerT = 0
  private shield = false
  private springShoes = false
  private dying = false
  private deathCause: DeathCause = 'miss'
  directional = false
  running = false

  constructor(app: Application, font: FontData, hooks: GameHooks) {
    this.app = app
    this.font = font
    this.hooks = hooks
    this.texLeft = Assets.get('likleft_X.png')
    this.texRight = Assets.get('likright_X.png')
    this.texShoot = Assets.get('likpuca_X.png')
    app.stage.addChild(this.world)
    this.scoreText = new BitmapText(font, Assets.get('topscore_X.png'), 0.5)
    this.scoreText.x = WORLD_W - 12
    this.scoreText.y = 10
    this.app.stage.addChild(this.scoreText)
  }

  get score(): number {
    return Math.max(0, Math.floor((this.startY - this.minY) * SCORE_PER_PX))
  }

  start(): void {
    this.world.removeChildren()
    this.platforms = []
    this.monsters = []
    this.powerups = []
    this.projectiles = []
    this.hazards = []
    this.vx = 0
    this.vy = -JUMP_V
    this.axis = 0
    this.px = WORLD_W / 2
    this.py = 0
    this.cameraY = -WORLD_H + 120
    this.minY = 0
    this.startY = 0
    this.nextSpawnY = -40
    this.elapsed = 0
    this.jumps = 0
    this.monstersShot = 0
    this.monstersJumped = 0
    this.jetpackT = 0
    this.propellerT = 0
    this.shield = false
    this.springShoes = false
    this.dying = false
    this.shootCooldown = 0

    this.doodler = new Sprite(Assets.get('likleft_X.png'))
    this.doodler.anchor.set(0.5, 0.5)
    this.world.addChild(this.doodler)

    const base = this.makePlatform('static', WORLD_W / 2 - PLATFORM_W / 2, 60)
    base.spring = null
    this.platforms.push(base)
    this.py = 60 - DOODLER_H / 2 - PLATFORM_H / 2
    this.startY = this.py
    this.minY = this.py

    while (this.nextSpawnY > this.cameraY - 100) this.spawnRow()
    this.running = true
    this.scoreText.text = '0'
    audio.play('start')
  }

  stop(): void {
    this.running = false
  }

  setAxis(a: number): void {
    this.axis = Math.max(-1, Math.min(1, a))
  }

  shoot(): void {
    if (!this.running || this.dying || this.shootCooldown > 0) return
    this.shootCooldown = 0.35
    this.shootPose = 0.2
    const sprite = new Sprite(Assets.get('projectiles/nose'))
    sprite.anchor.set(0.5)
    this.world.addChild(sprite)
    this.projectiles.push({
      sprite,
      x: this.px,
      y: this.py - DOODLER_H / 2,
      vx: this.directional ? this.vx * 0.8 : 0,
      vy: -900,
      dead: false,
    })
    audio.play('shoot')
  }

  private makePlatform(kind: PlatformKind, x: number, y: number): Platform {
    const frame =
      kind === 'static'
        ? 'platforms/static'
        : kind === 'moving'
          ? 'platforms/moving'
          : kind === 'vanish'
            ? 'platforms/vanish'
            : 'platforms/static'
    const sprite = new Sprite(Assets.get(frame))
    sprite.x = x
    sprite.y = y
    this.world.addChild(sprite)
    const p: Platform = {
      sprite,
      kind,
      x,
      y,
      vx: kind === 'moving' ? rand(40, 90) * (Math.random() < 0.5 ? -1 : 1) : 0,
      broken: false,
      vanished: false,
      spring: null,
      springSprite: null,
      springT: 0,
      dir: 1,
    }
    return p
  }

  private spawnRow(): void {
    const y = this.nextSpawnY
    const h = this.startY - y
    this.nextSpawnY -= rand(34, Math.min(96, 44 + h * 0.004))

    const r = Math.random()
    let kind: PlatformKind = 'static'
    if (r < Math.min(0.22, h / 22000)) kind = 'breakable'
    else if (r < Math.min(0.5, 0.12 + h / 16000)) kind = 'moving'
    else if (r < Math.min(0.62, 0.12 + h / 26000)) kind = 'vanish'

    const p = this.makePlatform(kind, rand(0, WORLD_W - PLATFORM_W), y)
    if (Math.random() < 0.07) {
      p.spring = 'spring'
      p.springSprite = new Sprite(Assets.get('spring/0'))
      p.springSprite.x = p.x + PLATFORM_W / 2 - 57
      p.springSprite.y = y - 79
      this.world.addChild(p.springSprite)
    } else if (Math.random() < 0.015) {
      p.spring = 'trampoline'
      p.springSprite = new Sprite(Assets.get('trampoline/1'))
      p.springSprite.x = p.x + PLATFORM_W / 2 - 35
      p.springSprite.y = y - 34
      this.world.addChild(p.springSprite)
    }
    this.platforms.push(p)

    if (h > 600 && Math.random() < Math.min(0.2, (h - 600) / 9000)) this.spawnMonster(y - rand(40, 120))
    // 每个分支是独立的 Math.random() 采样,条件文本相同但语义不同
    /* eslint-disable no-dupe-else-if */
    if (Math.random() < 0.012) this.spawnPowerup('jetpack', rand(20, WORLD_W - 60), y - rand(20, 80))
    else if (Math.random() < 0.012) this.spawnPowerup('propeller', rand(20, WORLD_W - 60), y - rand(20, 80))
    else if (Math.random() < 0.01) this.spawnPowerup('springshoes', rand(20, WORLD_W - 60), y - rand(20, 80))
    else if (Math.random() < 0.006) this.spawnPowerup('shield', rand(20, WORLD_W - 60), y - rand(20, 80))
    /* eslint-enable no-dupe-else-if */
    if (h > 2500 && Math.random() < 0.006) this.spawnHazard('ufo', y - rand(60, 140))
    if (h > 9000 && Math.random() < 0.004) this.spawnHazard('blackhole', y - rand(60, 140))
  }

  private spawnMonster(y: number): void {
    const kind = pick<MonsterKind>(['walker', 'flyer', 'oneeye', 'chomp'])
    const count = kind === 'walker' || kind === 'oneeye' ? 2 : 5
    const frames: Texture[] = []
    for (let i = 0; i < count; i++) {
      const key = `monsters/${kind}/${i}`
      if (Assets.cache.has(key)) frames.push(Assets.get(key))
    }
    if (frames.length === 0) return
    const container = new Container()
    const s = new Sprite(frames[0])
    s.anchor.set(0.5)
    container.addChild(s)
    const x = rand(30, WORLD_W - 30)
    container.x = x
    container.y = y
    this.world.addChild(container)
    const fly = kind === 'flyer'
    this.monsters.push({
      container,
      kind,
      frames,
      lastFrame: 0,
      x,
      y,
      vx: fly ? rand(60, 110) * (Math.random() < 0.5 ? -1 : 1) : rand(15, 40) * (Math.random() < 0.5 ? -1 : 1),
      t: rand(0, 10),
      dead: false,
      w: s.width,
      h: s.height,
    })
  }

  private spawnPowerup(kind: PowerupKind, x: number, y: number): void {
    const file =
      kind === 'jetpack'
        ? 'jetpack_X.png'
        : kind === 'propeller'
          ? 'propeller_X.png'
          : kind === 'shield'
            ? 'shield_X.png'
            : 'springshoesup_X.png'
    const sprite = new Sprite(Assets.get(file))
    sprite.anchor.set(0.5)
    sprite.x = x
    sprite.y = y
    this.world.addChild(sprite)
    this.powerups.push({ sprite, kind, x, y, taken: false })
  }

  private spawnHazard(kind: 'ufo' | 'blackhole', y: number): void {
    const container = new Container()
    const s = new Sprite(Assets.get(kind === 'ufo' ? 'ufo/beam' : 'blackhole'))
    s.anchor.set(0.5)
    container.addChild(s)
    const x = rand(60, WORLD_W - 60)
    container.x = x
    container.y = y
    this.world.addChild(container)
    this.hazards.push({ container, kind, x, y, t: 0, vx: kind === 'ufo' ? rand(30, 60) * (Math.random() < 0.5 ? -1 : 1) : 0, done: false })
  }

  update(dt: number): void {
    if (!this.running) return
    this.elapsed += dt
    if (!this.dying) {
      this.shootCooldown = Math.max(0, this.shootCooldown - dt)
      this.shootPose = Math.max(0, this.shootPose - dt)

      if (this.jetpackT > 0) {
        this.jetpackT -= dt
        this.vy = -880
        this.vx = this.axis * MAX_VX * 0.6
        if (this.jetpackT <= 0) this.vy = -200
      } else if (this.propellerT > 0) {
        this.propellerT -= dt
        this.vy = -260
        this.vx += this.axis * ACCEL_X * dt
        if (this.propellerT <= 0) this.vy = -100
      } else {
        this.vx += this.axis * ACCEL_X * dt
        if (this.axis === 0) this.vx -= this.vx * DAMP_X * dt
        this.vx = Math.max(-MAX_VX, Math.min(MAX_VX, this.vx))
        this.vy += GRAVITY * dt
      }
      this.px += this.vx * dt
      this.py += this.vy * dt
      if (this.px < -DOODLER_W / 2) this.px = WORLD_W + DOODLER_W / 2 - 1
      if (this.px > WORLD_W + DOODLER_W / 2) this.px = -DOODLER_W / 2 + 1
      if (this.vx > 20) this.facing = 1
      else if (this.vx < -20) this.facing = -1

      if (this.py < this.minY) this.minY = this.py
      this.collide()
    } else {
      this.vy += GRAVITY * dt
      this.py += this.vy * dt
    }

    const targetCam = Math.min(this.cameraY, this.py - WORLD_H * 0.42)
    this.cameraY = targetCam
    while (this.nextSpawnY > this.cameraY - 100) this.spawnRow()

    this.updatePlatforms(dt)
    this.updateMonsters(dt)
    this.updateHazards(dt)
    this.updateProjectiles(dt)
    this.cleanup()

    this.doodler.x = this.px
    this.doodler.y = this.py
    this.doodler.scale.x = this.facing
    const tex = this.shootPose > 0 ? this.texShoot : this.facing > 0 ? this.texLeft : this.texRight
    if (this.doodler.texture !== tex) this.doodler.texture = tex
    this.world.y = -this.cameraY
    this.world.x = 0

    const s = this.score
    this.scoreText.text = String(s)
    this.scoreText.x = WORLD_W - 12 - this.scoreText.measuredWidth
    this.hooks.onScore(s)

    if (!this.dying && this.py > this.cameraY + WORLD_H + 90) this.die('miss')
    if (this.dying && this.py > this.cameraY + WORLD_H + 160) {
      this.running = false
      this.hooks.onGameOver({
        score: s,
        jumps: this.jumps,
        time: this.elapsed,
        cause: this.deathCause,
        monstersShot: this.monstersShot,
        monstersJumped: this.monstersJumped,
      })
    }
  }

  private collide(): void {
    if (this.vy <= 0) return
    const feet = this.py + DOODLER_H / 2
    for (const p of this.platforms) {
      if (p.broken || p.vanished) continue
      const top = p.y
      if (
        feet >= top &&
        feet <= top + PLATFORM_H + Math.max(0, this.vy) * 0.02 + 8 &&
        this.px + DOODLER_W * 0.3 > p.x &&
        this.px - DOODLER_W * 0.3 < p.x + PLATFORM_W
      ) {
        if (p.spring === 'spring' && this.px > p.x + PLATFORM_W / 2 - 40 && this.px < p.x + PLATFORM_W / 2 + 40) {
          this.bounce(SPRING_V)
          if (p.springSprite) p.springSprite.texture = Assets.get('spring/1')
          p.springT = 0.25
          this.hooks.onEvent({ type: 'jump-spring' })
          audio.play('springshoes')
          return
        }
        if (p.spring === 'trampoline' && this.px > p.x + PLATFORM_W / 2 - 40 && this.px < p.x + PLATFORM_W / 2 + 40) {
          this.bounce(TRAMPOLINE_V)
          this.hooks.onEvent({ type: 'use-bonus', powerup: 'trampoline' })
          audio.play('trampoline')
          return
        }
        if (p.kind === 'breakable') {
          this.breakPlatform(p)
          this.hooks.onEvent({ type: 'break-platform', platform: 'breakable' })
          continue
        }
        if (p.kind === 'vanish') {
          p.vanished = true
          p.sprite.visible = false
        }
        this.bounce(JUMP_V)
        this.hooks.onEvent({
          type: 'bounce-platform',
          platform: p.kind,
          moving: p.kind === 'moving',
        })
        return
      }
    }
  }

  private bounce(v: number): void {
    this.vy = -v
    this.jumps += 1
    if (this.springShoes) {
      this.springShoes = false
      this.vy = -SPRING_V * 1.1
    }
    audio.play('jump')
  }

  private breakPlatform(p: Platform): void {
    p.broken = true
    p.sprite.visible = false
    const l = new Sprite(Assets.get('platforms/brokenL'))
    const r = new Sprite(Assets.get('platforms/brokenR'))
    l.x = p.x
    l.y = p.y
    r.x = p.x + 60
    r.y = p.y
    this.world.addChild(l, r)
    audio.play('break')
    window.setTimeout(() => {
      l.destroy()
      r.destroy()
    }, 600)
  }

  private updatePlatforms(dt: number): void {
    for (const p of this.platforms) {
      if (p.broken || p.vanished) continue
      if (p.kind === 'moving') {
        p.x += p.vx * dt
        if (p.x < 0 || p.x > WORLD_W - PLATFORM_W) {
          p.vx *= -1
          p.x = Math.max(0, Math.min(WORLD_W - PLATFORM_W, p.x))
        }
        p.sprite.x = p.x
        if (p.springSprite) p.springSprite.x = p.x + PLATFORM_W / 2 - (p.spring === 'spring' ? 57 : 35)
      }
      if (p.springT > 0) {
        p.springT -= dt
        if (p.springT <= 0 && p.springSprite && p.spring === 'spring') p.springSprite.texture = Assets.get('spring/0')
      }
    }
    for (const pu of this.powerups) {
      if (pu.taken) continue
      if (Math.abs(pu.x - this.px) < 34 && Math.abs(pu.y - this.py) < 44) {
        pu.taken = true
        pu.sprite.visible = false
        this.applyPowerup(pu.kind)
      }
    }
  }

  private applyPowerup(kind: PowerupKind): void {
    if (kind === 'jetpack') {
      this.jetpackT = JETPACK_TIME
      this.hooks.onEvent({ type: 'use-powerup', powerup: 'jetpack' })
      audio.play('jetpack')
    } else if (kind === 'propeller') {
      this.propellerT = PROPELLER_TIME
      this.hooks.onEvent({ type: 'use-powerup', powerup: 'propeller' })
      audio.play('propeller')
    } else if (kind === 'springshoes') {
      this.springShoes = true
      this.hooks.onEvent({ type: 'use-bonus', powerup: 'springshoes' })
      audio.play('springshoes')
    } else {
      this.shield = true
      this.hooks.onEvent({ type: 'use-powerup', powerup: 'shield' })
      audio.play('collect')
    }
  }

  private updateMonsters(dt: number): void {
    for (const m of this.monsters) {
      if (m.dead) continue
      m.t += dt
      m.x += m.vx * dt
      if (m.x < 20 || m.x > WORLD_W - 20) m.vx *= -1
      m.container.x = m.x
      m.container.y = m.y + (m.kind === 'flyer' ? Math.sin(m.t * 2) * 8 : 0)
      const idx = Math.floor(m.t * 6) % m.frames.length
      if (idx !== m.lastFrame) {
        m.lastFrame = idx
        ;(m.container.children[0] as Sprite).texture = m.frames[idx]
      }

      if (!this.dying && Math.abs(m.x - this.px) < (m.w + DOODLER_W) * 0.35 && Math.abs(m.container.y - this.py) < (m.h + DOODLER_H) * 0.35) {
        const feet = this.py + DOODLER_H / 2
        if (this.vy > 0 && feet < m.container.y + 6) {
          m.dead = true
          m.container.visible = false
          this.monstersJumped += 1
          this.bounce(JUMP_V)
          this.hooks.onEvent({ type: 'bounce-monster', monster: m.kind })
          audio.play('monsterCrash')
        } else if (this.propellerT > 0 || this.jetpackT > 0) {
          m.dead = true
          m.container.visible = false
          this.monstersShot += 1
          this.hooks.onEvent({ type: 'propeller-kill', monster: m.kind })
          audio.play('monsterCrash')
        } else if (this.shield) {
          this.shield = false
          m.dead = true
          m.container.visible = false
          this.hooks.onEvent({ type: 'kill', monster: m.kind })
          audio.play('monsterCrash')
        } else {
          this.die('monster')
        }
      }
    }
  }

  private updateHazards(dt: number): void {
    for (const hz of this.hazards) {
      if (hz.done) continue
      hz.t += dt
      if (hz.kind === 'ufo') {
        hz.x += hz.vx * dt
        if (hz.x < 50 || hz.x > WORLD_W - 50) hz.vx *= -1
        hz.container.x = hz.x
        hz.container.y = hz.y + Math.sin(hz.t * 1.5) * 6
        const beamTop = hz.container.y + 20
        const beamBottom = hz.container.y + 240
        if (!this.dying && Math.abs(hz.x - this.px) < 40 && this.py > beamTop && this.py < beamBottom) {
          hz.done = true
          this.hooks.onEvent({ type: 'ufo-abducted' })
          audio.play('ufo')
          this.die('ufo')
        } else if (!this.dying && this.vy > 0 && Math.abs(hz.x - this.px) < 70 && Math.abs(hz.container.y - 30 - this.py - DOODLER_H / 2) < 20) {
          this.bounce(JUMP_V)
          this.hooks.onEvent({ type: 'ufo-bounced' })
        }
      } else {
        hz.container.rotation += dt * 0.8
        const d = Math.hypot(hz.x - this.px, hz.y - this.py)
        if (d < 160 && !this.dying) {
          const pull = (1 - d / 160) * 900 * dt
          this.px += ((hz.x - this.px) / d) * pull
          this.py += ((hz.y - this.py) / d) * pull
        }
        if (d < 34 && !this.dying) this.die('blackhole')
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      if (pr.dead) continue
      pr.y += pr.vy * dt
      pr.x += pr.vx * dt
      pr.sprite.x = pr.x
      pr.sprite.y = pr.y
      if (pr.y < this.cameraY - 60) {
        pr.dead = true
        pr.sprite.visible = false
        this.hooks.onEvent({ type: 'hit-missing' })
        continue
      }
      for (const m of this.monsters) {
        if (m.dead) continue
        if (Math.abs(m.x - pr.x) < m.w * 0.45 && Math.abs(m.container.y - pr.y) < m.h * 0.45) {
          m.dead = true
          m.container.visible = false
          pr.dead = true
          pr.sprite.visible = false
          this.monstersShot += 1
          this.hooks.onEvent({ type: 'kill', monster: m.kind })
          audio.play('monsterCrash')
          break
        }
      }
    }
  }

  private cleanup(): void {
    const bottom = this.cameraY + WORLD_H + 200
    this.platforms = this.compact(this.platforms, (p) => {
      if (p.y > bottom) {
        p.sprite.destroy()
        p.springSprite?.destroy()
        return false
      }
      return true
    })
    this.monsters = this.compact(this.monsters, (m) => {
      if (m.dead) {
        m.container.destroy()
        return false
      }
      if (m.y > bottom) {
        if (!this.dying) this.hooks.onEvent({ type: 'avoid-monster', monster: m.kind })
        m.container.destroy()
        return false
      }
      return true
    })
    this.powerups = this.compact(this.powerups, (p) => {
      if (p.y > bottom || p.taken) {
        p.sprite.destroy()
        return false
      }
      return true
    })
    this.projectiles = this.compact(this.projectiles, (p) => {
      if (p.dead) {
        p.sprite.destroy()
        return false
      }
      return true
    })
    this.hazards = this.compact(this.hazards, (h) => {
      if (h.y > bottom || h.done) {
        h.container.destroy()
        return false
      }
      return true
    })
  }

  private compact<T>(arr: T[], keep: (item: T) => boolean): T[] {
    let w = 0
    for (let i = 0; i < arr.length; i++) {
      if (keep(arr[i])) arr[w++] = arr[i]
    }
    if (w === arr.length) return arr
    arr.length = w
    return arr
  }

  private die(cause: DeathCause): void {
    if (this.dying) return
    if (this.shield && cause !== 'blackhole') {
      this.shield = false
      this.vy = -JUMP_V
      return
    }
    this.dying = true
    this.deathCause = cause
    audio.play('fall')
  }

  destroy(): void {
    this.running = false
    this.world.destroy({ children: true })
    this.scoreText.destroy({ children: true })
  }
}
