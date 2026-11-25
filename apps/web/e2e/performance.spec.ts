import { expect, test, type Page, type Response } from '@playwright/test'

// Pixi 运行时标记（shader 源码，只出现在 Pixi chunk，不出现在入口 import map）
const PIXI_MARKER = 'gl_FragColor'
// 题库内容标记（五年级小数除法模板文案，只出现在题库 chunk）
const BANK_MARKER = '用小数除法解决分段问题'

async function collectScriptBodies(
  page: Page,
  path: string,
  afterGoto?: (page: Page) => Promise<void>,
): Promise<string[]> {
  const urls = new Set<string>()
  const handler = (response: Response): void => {
    if (response.request().resourceType() === 'script') urls.add(response.url())
  }
  page.on('response', handler)
  await page.goto(path)
  if (afterGoto) await afterGoto(page)
  await page.waitForLoadState('networkidle')
  page.off('response', handler)
  // 直接读响应体在并行负载下可能被回收，改为重新拉取脚本正文
  const bodies: string[] = []
  for (const url of urls) {
    const response = await page.request.get(url)
    if (response.ok()) bodies.push(await response.text())
  }
  return bodies
}

test('T12-06 打字首页不加载 Pixi 与题库，学习首页不加载 Pixi，农场按需加载', async ({ page }) => {
  const homeBodies = await collectScriptBodies(page, '/')
  expect(homeBodies.length).toBeGreaterThan(0)
  expect(homeBodies.some((body) => body.includes(PIXI_MARKER))).toBe(false)
  expect(homeBodies.some((body) => body.includes(BANK_MARKER))).toBe(false)

  const learningBodies = await collectScriptBodies(page, '/learning')
  await expect(page.locator('.learn-page')).toBeVisible()
  expect(learningBodies.some((body) => body.includes(PIXI_MARKER))).toBe(false)

  // 新用户先领取新手礼包，等画布挂载完成后再收集，避免 Pixi 动态导入晚于 networkidle
  const farmBodies = await collectScriptBodies(page, '/learning/farm', async (current) => {
    await current.getByRole('button', { name: '领取新手礼包', exact: true }).click()
    await expect(current.locator('.farm-scene__canvas canvas')).toBeVisible()
  })
  await expect(page.locator('.farm-scene__canvas canvas')).toBeVisible()
  await expect(page.locator('.farm-scene__canvas canvas')).toHaveCount(1)
  expect(farmBodies.some((body) => body.includes(PIXI_MARKER))).toBe(true)
})

test('T12-06 生产 preview 学习首页 LCP/CLS/INP 达标（移动网络与 4x CPU 模拟）', async ({
  page,
}) => {
  test.skip(!process.env.E2E_BASE_URL, '仅在生产 preview（E2E_BASE_URL）下执行')

  const client = await page.context().newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page.addInitScript(() => {
    const vitals = { lcp: 0, cls: 0, inp: 0 }
    Object.assign(window, { __vitals: vitals })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) vitals.lcp = entry.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number
        hadRecentInput: boolean
      })[]) {
        if (!entry.hadRecentInput) vitals.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) vitals.inp = Math.max(vitals.inp, entry.duration)
    }).observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit)
  })

  await page.goto('/learning')
  await expect(page.locator('.learn-page')).toBeVisible()
  await page.waitForTimeout(1_000)
  const before = await page.evaluate(
    () => (window as unknown as { __vitals: { lcp: number; cls: number; inp: number } }).__vitals,
  )
  expect(before.lcp).toBeGreaterThan(0)
  expect(before.lcp, `学习首页 LCP=${before.lcp}ms`).toBeLessThanOrEqual(2_500)
  expect(before.cls, `学习首页 CLS=${before.cls}`).toBeLessThanOrEqual(0.1)

  // 核心交互：切换年级学期（页内状态更新，不发生导航）
  await page.locator('.learn-course-option[aria-pressed="false"]').first().click()
  await page.waitForTimeout(500)
  const after = await page.evaluate(
    () => (window as unknown as { __vitals: { lcp: number; cls: number; inp: number } }).__vitals,
  )
  expect(after.inp, `课程切换交互延迟=${after.inp}ms`).toBeLessThanOrEqual(200)
  expect(after.cls, `交互后 CLS=${after.cls}`).toBeLessThanOrEqual(0.1)
})
