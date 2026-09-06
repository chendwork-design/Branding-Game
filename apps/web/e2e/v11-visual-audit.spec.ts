import { expect, test } from '@playwright/test';

test('VISUAL-027 keeps a lazy decision visual inside the 360 px detail sheet and captures review screenshots', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/v11-slice');
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '开始经营' }).click();
  await page.getByRole('button', { name: '进入经营现场' }).click();

  async function executeChoice(choiceName: RegExp) {
    await page.getByRole('button', { name: /带着信息做选择/ }).click();
    await page.getByRole('button', { name: choiceName }).click();
    await page.getByRole('dialog').getByRole('button', { name: /执行这项决定/ }).click();
    await page.getByRole('button', { name: /确认结果/ }).click();
    await page.getByRole('button', { name: /进入经营现场/ }).click();
  }

  await executeChoice(/先做附近居民的日常茶饮/);

  await page.getByRole('button', { name: /带着信息做选择/ }).click();
  await page.getByRole('button', { name: /先做一款稳定、好复购的主打茶/ }).click();
  const detail = page.getByRole('dialog');
  const image = detail.locator('img[alt*="方案物件或操作场景"]');
  await expect(detail).toBeVisible();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('loading', 'lazy');
  await expect(image).toHaveJSProperty('naturalWidth', 800);
  await expect(image).toHaveJSProperty('naturalHeight', 600);

  const mobileBox = await image.boundingBox();
  expect(mobileBox).not.toBeNull();
  expect(mobileBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobileBox!.x + mobileBox!.width).toBeLessThanOrEqual(360);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  expect(
    (await detail.screenshot({ path: testInfo.outputPath('visual027-detail-360x800.png') })).byteLength,
  ).toBeGreaterThan(10_000);

  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(image).toBeVisible();
  expect(
    (await detail.screenshot({ path: testInfo.outputPath('visual027-detail-1366x900.png') })).byteLength,
  ).toBeGreaterThan(10_000);
});
