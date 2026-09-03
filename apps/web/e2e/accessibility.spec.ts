import { expect, test } from '@playwright/test';

test('student entry screen is keyboard operable at phone width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '老街品牌局' })).toBeVisible();
  await expect(page.getByLabel('班级码')).toBeVisible();
  await expect(page.getByLabel('学号')).toBeVisible();
  await expect(page.getByLabel('姓名')).toBeVisible();
  await page.getByLabel('班级码').focus();
  await expect(page.getByLabel('班级码')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('学号')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('姓名')).toBeFocused();
  await expect(page.getByRole('button', { name: '进入品牌局' })).toHaveAttribute('type', 'submit');
});
