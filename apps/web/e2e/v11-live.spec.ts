import { expect, test } from '@playwright/test';

test('v1.4 live student route settles the full course through the server', async ({ page }) => {
  test.setTimeout(180_000);
  const studentNumber = `live-${Date.now()}`;
  await page.goto('/v11');
  await page.getByLabel('班级码').fill('LAOJIE11');
  await page.getByLabel('学号').fill(studentNumber);
  await page.getByLabel('姓名').fill('正式入口测试');
  await page.getByRole('button', { name: '进入品牌局' }).click();

  await expect(page.getByRole('heading', { name: '你的处境' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '开始经营' }).click();
  await expect(page.getByRole('heading', { name: '先别急着做 Logo' })).toBeVisible();

  for (let round = 0; round < 12; round += 1) {
    if (round === 4) {
      await page.getByLabel('品牌名').fill('一盏屯溪');
      await page.getByLabel('你希望顾客从名字里感到什么？').fill('老街茶饮也能成为每天可靠的一杯');
      await page.getByLabel('如果它像一个人，会怎样说话和待客？').fill('松弛、可靠、有一点幽默');
      await page.getByRole('button', { name: '把这份身份设定写进店铺档案' }).click();
    }
    await page.getByRole('button', { name: /进入经营现场/ }).click();
    const visualPrompt = page.getByRole('button', { name: /打开视觉提案|继续检查视觉系统/ });
    if (await visualPrompt.isVisible()) {
      await visualPrompt.click();
      const availableVisual = page.locator(
        '.v11-visual-system-card .v11-visual-select:not([disabled])',
      );
      if (await availableVisual.count()) {
        await availableVisual.first().click();
        await expect(
          page.locator('.v11-visual-compare .v11-visual-system-card.selected'),
        ).toBeVisible();
      }
      await page
        .locator('.v11-visual-compare .v11-detail-footer')
        .getByRole('button', { name: '返回经营现场' })
        .click();
    }
    if (round === 10) {
      await page.getByRole('button', { name: /带着信息做选择/ }).click();
      const skipCard = page.getByRole('region', { name: '跳过本轮战略选择' });
      await expect(skipCard).toBeVisible();
      await skipCard.getByRole('button', { name: '确认跳过' }).click();
      const skipConfirmation = page.getByRole('alert');
      await expect(skipConfirmation).toContainText('这不是暂缓');
      await skipConfirmation.getByRole('button', { name: '确认跳过' }).click();
      await expect(
        page.locator('.v11-result-screen').getByRole('heading', { level: 2 }),
      ).toBeVisible();
      await page.getByRole('button', { name: '确认结果，进入下一轮' }).click();
      continue;
    }
    await page.getByRole('button', { name: /带着信息做选择/ }).click();
    const choices = page.locator('.v11-choice-compact');
    const execute = page.getByRole('button', { name: '执行这项决定' });
    let selectedChoice = false;
    for (let choiceIndex = 0; choiceIndex < (await choices.count()); choiceIndex += 1) {
      await choices.nth(choiceIndex).click();
      if (await execute.isEnabled()) {
        selectedChoice = true;
        break;
      }
      await page.getByRole('dialog').getByRole('button', { name: '再看看其他方案' }).click();
    }
    expect(selectedChoice).toBe(true);
    await page.getByRole('button', { name: '执行这项决定' }).click();
    await expect(
      page.locator('.v11-result-screen').getByRole('heading', { level: 2 }),
    ).toBeVisible();
    await page.getByRole('button', { name: '确认结果，进入下一轮' }).click();
    const chapterNext = page.locator('.v11-chapter-review .v11-button');
    const hasChapterReview = await expect(chapterNext)
      .toBeVisible({ timeout: 750 })
      .then(() => true)
      .catch(() => false);
    if (hasChapterReview && (await chapterNext.getByText('进入下一章').count()) > 0)
      await chapterNext.click();
  }

  const annualEnding = page.getByRole('button', { name: '查看年度结局' });
  await expect(annualEnding).toBeVisible();
  await annualEnding.click();
  await expect(page.getByRole('heading', { name: '你的品牌已经有了一条路径' })).toBeVisible();
  await page.getByRole('button', { name: '打开我的复盘报告' }).click();
  await expect(page.getByRole('heading', { name: '这条品牌路径，是怎么形成的？' })).toBeVisible();
  await expect(page.getByText('每轮因果链')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '你的品牌已经有了一条路径' })).toBeVisible();
  await page.getByRole('button', { name: '打开我的复盘报告' }).click();
  await expect(page.getByRole('heading', { name: '这条品牌路径，是怎么形成的？' })).toBeVisible();
});
