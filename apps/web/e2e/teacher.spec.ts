import { expect, test } from '@playwright/test';

test('teacher can create a class, inspect a student timeline and view aggregate progress', async ({
  page,
}) => {
  const suffix = `${test.info().project.name}-${Date.now()}`;
  const className = `教师后台 E2E ${suffix}`;
  const studentName = `教师端测试学生 ${suffix}`;
  await page.goto('/teacher');
  await page.getByLabel('教师账号').fill('teacher@example.test');
  await page.getByLabel('密码').fill('change-me-in-production');
  await page.getByRole('button', { name: '进入后台' }).click();
  await expect(page.getByRole('heading', { name: '课程观察台' })).toBeVisible();

  await page.getByLabel('新班级名称').fill(className);
  await page.getByRole('button', { name: '开班' }).click();
  const classItem = page.getByRole('button', { name: new RegExp(className) }).first();
  await expect(classItem).toBeVisible();
  const classText = await classItem.innerText();
  const classCode = classText.split('\n').at(-1)?.split('·')[0]?.trim();
  expect(classCode).toBeTruthy();

  await page.goto('/');
  await page.getByLabel('班级码').fill(classCode!);
  await page.getByLabel('学号').fill('teacher-e2e-001');
  await page.getByLabel('姓名').fill(studentName);
  await page.getByRole('button', { name: '进入品牌局' }).click();
  await expect(page.getByRole('heading', { name: '先别急着做 Logo' })).toBeVisible();
  await page.getByRole('button', { name: /附近居民/ }).click();
  await page.getByLabel('最希望获得').selectOption('growth');
  await page.getByLabel('最担心发生').selectOption('trust');
  await page.getByRole('button', { name: '确认这个决定' }).click();
  await expect(page.getByRole('heading', { name: '先去问，不要猜' })).toBeVisible();

  await page.goto('/teacher');
  await page
    .getByRole('button', { name: new RegExp(className) })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: className })).toBeVisible();
  await expect(page.getByText('学生', { exact: true })).toBeVisible();
  await expect(page.getByText(studentName)).toBeVisible();
  await page.getByText(studentName).click();
  await expect(page.getByText('首局 · 进行中')).toBeVisible();
  await expect(page.getByText('r01 · choice_selected')).toBeVisible();
  await expect(page.getByText('这群人如何做决定')).toBeVisible();
  await expect(page.getByText('不展示种子')).toBeVisible();
});
