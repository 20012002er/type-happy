import { Container, Rectangle, Sprite, Texture } from 'pixi.js'

export interface FontGlyph {
  x: number
  y: number
  w: number
  h: number
  xo: number
  yo: number
  xa: number
}

export interface FontData {
  lineHeight: number
  chars: Record<string, FontGlyph>
}

export class BitmapText extends Container {
  private font: FontData
  private sheet: Texture
  private scaleFactor: number
  private glyphTextures = new Map<string, Texture>()
  private pool: Sprite[] = []
  private content = ''
  private pen = 0

  constructor(font: FontData, sheet: Texture, scale = 0.5) {
    super()
    this.font = font
    this.sheet = sheet
    this.scaleFactor = scale
  }

  get text(): string {
    return this.content
  }

  get measuredWidth(): number {
    return this.pen * this.scaleFactor
  }

  private glyph(ch: string): Texture | null {
    const cached = this.glyphTextures.get(ch)
    if (cached) return cached
    const g = this.font.chars[ch]
    if (!g) return null
    const tex = new Texture({ source: this.sheet.source, frame: new Rectangle(g.x, g.y, g.w, g.h) })
    this.glyphTextures.set(ch, tex)
    return tex
  }

  set text(value: string) {
    if (value === this.content) return
    this.content = value
    let used = 0
    let pen = 0
    let line = 0
    const lh = this.font.lineHeight
    for (const ch of value) {
      if (ch === '\n') {
        pen = 0
        line += 1
        continue
      }
      const code = String(ch.codePointAt(0))
      const tex = this.glyph(code)
      if (!tex) {
        pen += 10
        continue
      }
      const g = this.font.chars[code]
      let sprite = this.pool[used]
      if (!sprite) {
        sprite = new Sprite(tex)
        sprite.scale.set(this.scaleFactor)
        this.pool.push(sprite)
        this.addChild(sprite)
      }
      sprite.texture = tex
      sprite.visible = true
      sprite.x = (pen + g.xo) * this.scaleFactor
      sprite.y = (line * lh + g.yo - lh * 0.5) * this.scaleFactor
      pen += g.xa
      used += 1
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].visible = false
    this.pen = pen
  }
}
