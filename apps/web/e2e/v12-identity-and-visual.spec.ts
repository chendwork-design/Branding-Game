import { expect, test } from '@playwright/test';

async function completeCurrentRound(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '进入经营现场' }).click();
  const visualPrompt = page.getByRole('button', { name: /打开视觉提案|继续检查视觉系统/ });
  if (await visualPrompt.isVisible().catch(() => false)) {
    await visualPrompt.click();
    await page.locator('.v11-visual-system-card .v11-visual-select').first().click();
    await page.getByRole('button', { name: '返回经营现场' }).last().click();
  }
  await page.getByRole('button', { name: /带着信息做选择/ }).click();
  await page.locator('.v11-choice-compact').first().click();
  await page.getByRole('button', { name: '执行这项决定' }).click();
  await page.getByRole('button', { name: '确认结果，进入下一轮' }).click();
  const chapterNext = page.getByRole('button', { name: '进入下一章' });
  if (await chapterNext.isVisible().catch(() => false)) await chapterNext.click();
}

test('v1.4 first-use terminology and visual constraints remain usable on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/v11-full');
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '开始经营' }).click();

  for (let round = 0; round < 4; round += 1) await completeCurrentRound(page);

  await expect(page.getByLabel('本轮概念说明')).toBeVisible();
  await expect(page.getByRole('button', { name: '解释品牌人格' })).toBeVisible();
  for (const term of ['视觉语义', 'LOGO', 'VI', 'IP'])
    await expect(page.getByRole('button', { name: `解释${term}` })).toBeVisible();
  await page.getByRole('button', { name: '解释品牌人格' }).click();
  await page.getByRole('button', { name: '知道了，继续经营' }).click();
  await page.getByRole('button', { name: '解释LOGO' }).click();
  await expect(page.getByText('让顾客认出品牌的核心标志。')).toBeVisible();
  await page.getByRole('button', { name: '知道了，继续经营' }).click();
  await page.getByLabel('品牌名').fill('Old Street Tea');
  await page.getByLabel('你希望顾客从名字里感到什么？').fill('每天都能顺手喝到一杯靠谱的老街茶');
  await page.getByLabel('如果它像一个人，会怎样说话和待客？').fill('可靠、松弛、有一点幽默');
  await page.getByRole('button', { name: '把这份身份设定写进店铺档案' }).click();
  for (let round = 0; round < 3; round += 1) await completeCurrentRound(page);
  await page.getByRole('button', { name: '进入经营现场' }).click();
  await page.getByRole('button', { name: /打开视觉提案/ }).click();
  await page.locator('.v11-visual-system-card .v11-visual-select').first().click();
  await expect(page.getByLabel(/店招上的视觉系统预览/)).toBeVisible();
  await expect(page.getByText('黑白打印', { exact: true })).toBeVisible();
  await expect(page.getByText('24 px 缩小', { exact: true })).toBeVisible();
  await expect(page.getByText('35% 遮挡', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /24 px 缩小测试/ }).click();
  await expect(page.locator('[data-v11-preview-state="small"]')).toBeVisible();
  await expect(page.getByRole('img', { name: /Old Stre.*线性字标系统/ }).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBeFalsy();
});
