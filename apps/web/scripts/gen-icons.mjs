/**
 * 网站图标生成器:从 public/favicon.svg 渲染出各尺寸 PNG、多尺寸 favicon.ico
 * 与 manifest 图标。仅在设计稿变更时手动运行(产物已提交入库):
 *   pnpm --filter @type-happy/web exec node scripts/gen-icons.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')
const svg = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8')

const PNG_FILES = [
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]
const ICO_SIZES = [16, 32, 48]

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><meta charset="utf-8"><title>icons</title>')

  const render = (size) =>
    page.evaluate(
      async ({ svg, size }) => {
        const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
        const img = new Image()
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = () => rej(new Error('svg load failed'))
          img.src = url
        })
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        return {
          pngBase64: canvas.toDataURL('image/png').split(',')[1],
          rgba: Array.from(ctx.getImageData(0, 0, size, size).data),
        }
      },
      { svg, size },
    )

  for (const [file, size] of PNG_FILES) {
    const { pngBase64 } = await render(size)
    fs.writeFileSync(path.join(publicDir, file), Buffer.from(pngBase64, 'base64'))
    console.log(`[gen-icons] ${file} (${size}x${size})`)
  }

  // favicon.ico:ICONDIR + 各尺寸 BMP(32bpp BGRA + 1bpp AND mask,行自下而上)
  const entries = []
  for (const size of ICO_SIZES) {
    const { rgba } = await render(size)
    const header = Buffer.alloc(40)
    header.writeUInt32LE(40, 0)
    header.writeInt32LE(size, 4)
    header.writeInt32LE(size * 2, 8)
    header.writeUInt16LE(1, 12)
    header.writeUInt16LE(32, 14)
    const xor = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const src = ((size - 1 - y) * size + x) * 4
        const dst = (y * size + x) * 4
        xor[dst] = rgba[src + 2]
        xor[dst + 1] = rgba[src + 1]
        xor[dst + 2] = rgba[src]
        xor[dst + 3] = rgba[src + 3]
      }
    }
    const rowBytes = Math.ceil(size / 32) * 4
    const and = Buffer.alloc(rowBytes * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const alpha = rgba[((size - 1 - y) * size + x) * 4 + 3]
        if (alpha < 128) and[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    entries.push({ size, body: Buffer.concat([header, xor, and]) })
  }
  const dir = Buffer.alloc(6 + entries.length * 16)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(entries.length, 4)
  let offset = dir.length
  entries.forEach((entry, i) => {
    const at = 6 + i * 16
    dir[at] = entry.size
    dir[at + 1] = entry.size
    dir.writeUInt16LE(1, at + 4)
    dir.writeUInt16LE(32, at + 6)
    dir.writeUInt32LE(entry.body.length, at + 8)
    dir.writeUInt32LE(offset, at + 12)
    offset += entry.body.length
  })
  fs.writeFileSync(
    path.join(publicDir, 'favicon.ico'),
    Buffer.concat([dir, ...entries.map((e) => e.body)]),
  )
  console.log(`[gen-icons] favicon.ico (${ICO_SIZES.join('/')}px)`)
} finally {
  await browser.close()
}
