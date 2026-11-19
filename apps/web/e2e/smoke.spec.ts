import { expect, test } from '@playwright/test'

test('主站首页与游戏路由可访问', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/打字乐园/)
  await expect(page.getByRole('heading', { name: /每天十分钟/ })).toBeVisible()

  await page.getByRole('link', { name: '打字游戏', exact: true }).click()
  await expect(page).toHaveURL(/\/games$/)
  await expect(page.getByRole('heading', { name: '打字游戏', exact: true })).toBeVisible()
})
