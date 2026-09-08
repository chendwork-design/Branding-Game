import { expect, test } from '@playwright/test';

test('v1.4 four-round slice can be finished from a phone-sized student surface', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/v11-slice');

  await expect(page.getByRole('heading', { name: '你的处境' })).toBeVisible();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await expect(page.getByText('赢法不是单项冲分')).toBeVisible();
  await page.getByRole('button', { name: '开始经营' }).click();
  await page.getByRole('button', { name: '进入经营现场' }).click();

  async function finishRound(choice: RegExp, nextRound: RegExp, choicesReady = false) {
    if (!choicesReady) await page.getByRole('button', { name: /带着信息做选择/ }).click();
    await expect(page.getByRole('button', { name: choice })).toBeVisible();
    await page.getByRole('button', { name: choice }).click();
    const detail = page.getByRole('dialog');
    await expect(detail).toBeVisible();
    await expect(detail.getByText('一次性现金')).toBeVisible();
    await detail.getByRole('button', { name: /执行这项决定/ }).click();
    await expect(page.locator('.v11-result-art')).toBeVisible();
    const theory = page.locator('.v11-why-details');
    await expect(theory.locator('summary')).toHaveText('为什么会这样？');
    await expect(theory).not.toHaveAttribute('open', '');
    await page.getByRole('button', { name: /确认结果/ }).click();
    await expect(page.getByRole('heading', { name: nextRound })).toBeVisible();
    await page.getByRole('button', { name: /进入经营现场/ }).click();
  }

  await page.getByRole('button', { name: /带着信息做选择/ }).click();
  await expect(page.getByRole('button', { name: /先做附近居民的日常茶饮/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /做一杯游客都想拍的地标饮品/ })).toBeVisible();
  await finishRound(/先做附近居民的日常茶饮/, /产品不是品牌的配饰/, true);
  await finishRound(/先做一款稳定、好复购的主打茶/, /设计进入现实/);

  await page.getByRole('button', { name: /打开视觉提案/ }).click();
  await page.getByRole('button', { name: /一笔成街/ }).click();
  await page.getByRole('button', { name: /24 px 缩小测试/ }).click();
  await expect(page.locator('[data-v11-preview-state="small"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: '店招', selected: true })).toBeVisible();
  await page
    .getByRole('button', { name: /返回经营现场/ })
    .last()
    .click();
  await page.getByRole('button', { name: /带着信息做选择/ }).click();
  await page.getByRole('button', { name: /能缩小、能延展/ }).click();
  await page.getByRole('button', { name: /执行这项决定/ }).click();
  await expect(page.locator('.v11-result-art')).toBeVisible();
  await page.getByRole('button', { name: /确认结果/ }).click();
  await expect(page.getByRole('heading', { name: '火了以后全是事' })).toBeVisible();
  await page.getByRole('button', { name: /进入经营现场/ }).click();
  await page.getByRole('button', { name: /带着信息做选择/ }).click();
  await page.getByRole('button', { name: /先限量，把老客体验稳住/ }).click();
  await page.getByRole('button', { name: /执行这项决定/ }).click();
  await page.getByRole('button', { name: /确认结果/ }).click();

  await expect(page.getByRole('heading', { name: '你的品牌已经有了一条路径' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBeFalsy();
});
