import { expect, test } from '@playwright/test';

test('classic-script compatibility page renders the student entry screen', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.goto('/legacy.html');
  expect(runtimeErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: '老街品牌局' })).toBeVisible();
  await expect(page.getByLabel('班级码')).toBeVisible();
  await expect(page.getByRole('button', { name: '进入品牌局' })).toBeVisible();
});
