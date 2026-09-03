import { expect, test } from '@playwright/test';

test('M22 v1.2 teacher surface loads read-only analytics for the trial class', async ({ page }) => {
  await page.goto('/v11-teacher');
  await page.getByLabel('教师账号').fill('teacher@example.test');
  await page.getByLabel('密码').fill('change-me-in-production');
  await page.getByLabel('班级 ID').fill('v11-trial-class');
  await page.getByRole('button', { name: '进入 v1.2 后台' }).click();
  await expect(page.getByText('v1.2 十二轮正式候选班', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('全班正在形成什么路径？')).toBeVisible();
  await expect(page.getByText('学生决策时间线')).toBeVisible();
  await expect(page.getByText('调查结果被打开')).toBeVisible();
  await expect(page.getByText('风险与事件')).toBeVisible();
  await page.getByLabel('班级名称').fill('教师后台新建班级');
  await page.getByRole('button', { name: '创建班级并生成班级码' }).click();
  await expect(page.getByText('教师后台新建班级', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: '关闭班级' }).click();
  await expect(page.getByRole('button', { name: '重新开放班级' })).toBeVisible();
  await page.getByRole('button', { name: '归档班级' }).click();
  await expect(page.getByRole('button', { name: '恢复为关闭' })).toBeVisible();
  await page.getByRole('button', { name: '恢复为关闭' }).click();
  await expect(page.getByRole('button', { name: '重新开放班级' })).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: '删除当前班级' }).click();
  await expect(page.getByText('教师后台新建班级', { exact: true })).toHaveCount(0);
});
