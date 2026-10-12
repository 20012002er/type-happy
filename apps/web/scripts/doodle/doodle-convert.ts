import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

type PlistValue = string | number | boolean | PlistValue[] | { [k: string]: PlistValue }

function parsePlist(xml: string): PlistValue {
  const tokens = xml.match(/<[^>]+>|[^<]+/g) ?? []
  const stack: { container: PlistValue; key?: string }[] = []
  let root: PlistValue | null = null
  let mode: 'key' | 'string' | 'integer' | 'real' | null = null
  const push = (v: PlistValue) => {
    if (stack.length === 0) {
      root = v
      return
    }
    const top = stack[stack.length - 1]
    if (Array.isArray(top.container)) top.container.push(v)
    else if (top.key !== undefined) {
      ;(top.container as Record<string, PlistValue>)[top.key] = v
      top.key = undefined
    }
  }
  for (const t of tokens) {
    if (t.startsWith('<')) {
      if (t === '<key>') mode = 'key'
      else if (t === '<string>') mode = 'string'
      else if (t === '<integer>') mode = 'integer'
      else if (t === '<real>') mode = 'real'
      else if (t === '</key>' || t === '</string>' || t === '</integer>' || t === '</real>') mode = null
      else if (t.startsWith('<dict')) stack.push({ container: {} })
      else if (t.startsWith('<array')) stack.push({ container: [] })
      else if (t === '</dict>' || t === '</array>') {
        const done = stack.pop()
        if (done) push(done.container)
      } else if (t === '<true/>') push(true)
      else if (t === '<false/>') push(false)
      continue
    }
    if (mode === 'key') {
      const top = stack[stack.length - 1]
      if (top) top.key = decodeEntities(t)
    } else if (mode === 'string') push(decodeEntities(t))
    else if (mode === 'integer') push(parseInt(t, 10))
    else if (mode === 'real') push(parseFloat(t))
  }
  return root as PlistValue
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
}

const srcDir = process.argv[2]
const outDir = process.argv[3]
if (!srcDir || !outDir) throw new Error('usage: doodle-convert.ts <srcAssetsDir> <outDataDir>')
mkdirSync(outDir, { recursive: true })

const simple = [
  'generic_strings.plist',
  'stats_strings.plist',
  'achs_strings.plist',
  'mission_strings.plist',
  'tutorial_strings.plist',
  'store_strings.plist',
  'message_strings.plist',
  'missions_data/game_missions.plist',
]
for (const f of simple) {
  const parsed = parsePlist(readFileSync(join(srcDir, f), 'utf8'))
  const out = join(outDir, f.split('/').pop()!.replace('.plist', '.json'))
  writeFileSync(out, JSON.stringify(parsed, null, 1))
  console.log(`converted ${f} -> ${out}`)
}

const font = parsePlist(readFileSync(join(srcDir, 'doodlejumpfont.plist'), 'utf8')) as {
  chars: { '-lineheight': string; char: Record<string, string>[] }
}
const chars: Record<string, { x: number; y: number; w: number; h: number; xo: number; yo: number; xa: number }> = {}
for (const c of font.chars.char) {
  chars[c['-id']] = {
    x: parseInt(c['-x'], 10),
    y: parseInt(c['-y'], 10),
    w: parseInt(c['-width'], 10),
    h: parseInt(c['-height'], 10),
    xo: parseInt(c['-xoffset'], 10),
    yo: parseInt(c['-yoffset'], 10),
    xa: parseInt(c['-xadvance'], 10),
  }
}
writeFileSync(
  join(outDir, 'doodlejumpfont.json'),
  JSON.stringify({ lineHeight: parseInt(font.chars['-lineheight'], 10), chars }, null, 1),
)
console.log(`converted doodlejumpfont.plist -> ${join(outDir, 'doodlejumpfont.json')} (${Object.keys(chars).length} glyphs)`)
