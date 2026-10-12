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
  private content = ''

  constructor(font: FontData, sheet: Texture, scale = 0.5) {
    super()
    this.font = font
    this.sheet = sheet
    this.scaleFactor = scale
  }

  get text(): string {
    return this.content
  }

  set text(value: string) {
    if (value === this.content) return
    this.content = value
    this.removeChildren().forEach((c) => c.destroy())
    let pen = 0
    let line = 0
    const lh = this.font.lineHeight
    for (const ch of value) {
      if (ch === '\n') {
        pen = 0
        line += 1
        continue
      }
      const g = this.font.chars[String(ch.codePointAt(0))]
      if (!g) {
        pen += 10
        continue
      }
      const sprite = new Sprite(
        new Texture({
          source: this.sheet.source,
          frame: new Rectangle(g.x, g.y, g.w, g.h),
        }),
      )
      sprite.x = (pen + g.xo) * this.scaleFactor
      sprite.y = (line * lh + g.yo - lh * 0.5) * this.scaleFactor
      sprite.scale.set(this.scaleFactor)
      this.addChild(sprite)
      pen += g.xa
    }
  }
}
