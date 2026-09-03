import { expect, test } from '@playwright/test';

test('M14 full content route exposes twelve rounds and a state-conditioned event', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/v11-full');

  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '开始经营' }).click();
  await expect(page.getByText('第 1 / 12 回合', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '进入经营现场' }).click();

  await page.getByRole('button', { name: /带着信息做选择/ }).click();
  await page.getByRole('button', { name: /做一杯游客都想拍的地标饮品/ }).click();
  await page.getByRole('button', { name: /执行这项决定/ }).click();
  await page.locator('.v11-result-followup summary').click();
  await expect(page.getByText('现场插曲')).toBeVisible();
  await expect(page.getByText('第一张游客照片传开')).toBeVisible();
  await page.getByRole('button', { name: /确认结果/ }).click();
  await expect(page.getByText('第 2 / 12 回合', { exact: true })).toBeVisible();
});
