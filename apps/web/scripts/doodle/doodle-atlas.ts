import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface PngImage {
  width: number
  height: number
  data: Uint8Array
}

function decodePng(buf: Buffer): PngImage {
  let pos = 8
  let width = 0
  let height = 0
  let bitDepth: number
  let colorType: number
  const idat: Buffer[] = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(`unsupported png: bitDepth=${bitDepth} colorType=${colorType}`)
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = width * bpp
  const out = new Uint8Array(stride * height)
  let rp = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    const row = y * stride
    const prev = row - stride
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp + x]
      const a = x >= bpp ? out[row + x - bpp] : 0
      const b = y > 0 ? out[prev + x] : 0
      const c = x >= bpp && y > 0 ? out[prev + x - bpp] : 0
      let v = cur
      if (filter === 1) v = cur + a
      else if (filter === 2) v = cur + b
      else if (filter === 3) v = cur + ((a + b) >> 1)
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      out[row + x] = v & 0xff
    }
    rp += stride
  }
  return { width, height, data: out }
}

interface Component {
  x: number
  y: number
  w: number
  h: number
  pixels: number
}

function components(img: PngImage, alphaMin: number, minPixels: number): Component[] {
  const { width, height, data } = img
  const seen = new Uint8Array(width * height)
  const comps: Component[] = []
  const stack = new Int32Array(width * height)
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || data[start * 4 + 3] < alphaMin) continue
    let sp = 0
    stack[sp++] = start
    seen[start] = 1
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    let pixels = 0
    while (sp > 0) {
      const idx = stack[--sp]
      const x = idx % width
      const y = (idx / width) | 0
      pixels++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      const neigh = [idx - 1, idx + 1, idx - width, idx + width]
      for (let n = 0; n < 4; n++) {
        const nx = n === 0 ? x - 1 : n === 1 ? x + 1 : x
        const ny = n === 2 ? y - 1 : n === 3 ? y + 1 : y
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const ni = neigh[n]
        if (seen[ni] || data[ni * 4 + 3] < alphaMin) continue
        seen[ni] = 1
        stack[sp++] = ni
      }
    }
    if (pixels >= minPixels) comps.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixels })
  }
  comps.sort((a, b) => a.y - b.y || a.x - b.x)
  return comps
}

function encodePng(width: number, height: number, data: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
  }
  const crcTable: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mode = process.argv[2] ?? 'detect'
const src = process.argv[3]
if (!src) throw new Error('usage: doodle-atlas.ts <detect|build> <png> [mapping.json] [out.json]')
const img = decodePng(readFileSync(src))
if (mode === 'detect') {
  const comps = components(img, 16, 24)
  console.log(JSON.stringify({ width: img.width, height: img.height, count: comps.length, comps }, null, 1))
} else if (mode === 'crop') {
  const outPath = process.argv[4]
  const indices = (process.argv[5] ?? '').split(',').filter(Boolean).map(Number)
  const comps = components(img, 16, 24)
  const sel = indices.map((i) => comps[i]).filter(Boolean)
  const cols = 6
  const gap = 10
  const cellW = Math.max(...sel.map((c) => c.w)) + gap
  const cellH = Math.max(...sel.map((c) => c.h)) + gap
  const rows = Math.ceil(sel.length / cols)
  const sheet = new Uint8Array(cols * cellW * rows * cellH * 4)
  for (let i = 0; i < sheet.length; i += 4) {
    sheet[i] = 255
    sheet[i + 1] = 255
    sheet[i + 2] = 255
    sheet[i + 3] = 255
  }
  sel.forEach((c, i) => {
    const cx = (i % cols) * cellW + (gap >> 1)
    const cy = ((i / cols) | 0) * cellH + (gap >> 1)
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const s = ((c.y + y) * img.width + (c.x + x)) * 4
        const d = ((cy + y) * cols * cellW + (cx + x)) * 4
        sheet[d] = img.data[s]
        sheet[d + 1] = img.data[s + 1]
        sheet[d + 2] = img.data[s + 2]
        sheet[d + 3] = img.data[s + 3]
      }
    }
  })
  writeFileSync(outPath, encodePng(cols * cellW, rows * cellH, sheet))
  console.log(`wrote ${outPath}: ${sel.length} crops in ${cols}x${rows} grid, cell ${cellW}x${cellH}`)
} else {
  const mappingPath = process.argv[4]
  const outPath = process.argv[5]
  if (!mappingPath || !outPath) throw new Error('build requires mapping.json and out.json')
  const mapping: Record<string, [number, number, number, number]> = JSON.parse(readFileSync(mappingPath, 'utf8'))
  const frames: Record<string, unknown> = {}
  for (const [name, [x, y, w, h]] of Object.entries(mapping)) {
    frames[name] = {
      frame: { x, y, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    }
  }
  const atlas = {
    frames,
    meta: {
      app: 'doodle-atlas',
      version: '1.0',
      image: '../img/' + src.split('/').pop(),
      format: 'RGBA8888',
      size: { w: img.width, h: img.height },
      scale: '1',
    },
  }
  writeFileSync(outPath, JSON.stringify(atlas, null, 1))
  const absOut = join(process.cwd(), outPath)
  console.log(`wrote ${absOut} with ${Object.keys(frames).length} frames`)
}
