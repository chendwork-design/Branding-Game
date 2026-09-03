import { expect, test } from '@playwright/test';

test('M14 student UI keeps the dashboard and choice detail in a recoverable focus stack', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/v11-slice');
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '开始经营' }).click();
  await page.getByRole('button', { name: '进入经营现场' }).click();

  await page.getByRole('button', { name: '打开经营看板' }).click();
  const dashboard = page.getByRole('dialog', { name: '谁在回应你，店里接得住吗？' });
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByText('顾客怎么回应你')).toBeVisible();
  await dashboard.getByRole('button', { name: '放大文字' }).click();
  await expect(dashboard.getByRole('button', { name: '放大文字' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dashboard.getByRole('button', { name: '减少动效' }).click();
  await expect(dashboard.getByRole('button', { name: '减少动效' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(dashboard).toBeHidden();

  await page.getByRole('button', { name: /带着信息做选择/ }).click();
  await page.locator('.v11-choice-compact').first().click();
  const detail = page.getByRole('dialog');
  await expect(detail).toBeVisible();
  await expect(detail.getByText('一次性现金')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `horizontal overflow at ${viewport.width}x${viewport.height}`).toBeFalsy();
  }
});

test('M12 reload recovers the student checkpoint without exposing identity in the URL', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/v11-slice');
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '开始经营' }).click();
  await page.getByRole('button', { name: '进入经营现场' }).click();
  await page.getByRole('button', { name: '打开经营看板' }).click();
  await page.reload();
  await expect(page.getByRole('dialog', { name: '谁在回应你，店里接得住吗？' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  expect(page.url()).not.toContain('student-ui-demo');
});
