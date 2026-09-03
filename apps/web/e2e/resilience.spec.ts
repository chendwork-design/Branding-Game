import { expect, test, type APIRequestContext } from '@playwright/test';

const apiOrigin = `http://127.0.0.1:${process.env.API_PORT ?? '3000'}`;

async function createClass(request: APIRequestContext) {
  const login = await request.post(`${apiOrigin}/api/teacher/login`, {
    data: { email: 'teacher@example.test', password: 'change-me-in-production' },
  });
  expect(login.ok()).toBeTruthy();
  const setCookie = login.headers()['set-cookie'];
  if (!setCookie) throw new Error('教师登录没有返回会话 Cookie');
  const create = await request.post(`${apiOrigin}/api/teacher/classes`, {
    headers: { cookie: setCookie.split(';')[0] ?? '' },
    data: { name: `M3 resilience ${Date.now()}` },
  });
  expect(create.ok()).toBeTruthy();
  return ((await create.json()) as { code: string }).code;
}

test('student keeps a local round across an interrupted sync and flushes it after recovery', async ({
  page,
  request,
}) => {
  const classCode = await createClass(request);
  await page.goto('/');
  await page.getByLabel('班级码').fill(classCode);
  await page.getByLabel('学号').fill(`m3-${Date.now()}`);
  await page.getByLabel('姓名').fill('离线恢复测试');
  await page.getByRole('button', { name: '进入品牌局' }).click();
  await expect(page.getByRole('heading', { name: '先别急着做 Logo' })).toBeVisible();

  await page.route('**/api/student/actions', (route) => route.abort('failed'));
  await page.locator('.choice-grid .choice').filter({ hasText: '附近居民' }).click();
  await page.getByLabel('最希望获得').selectOption('growth');
  await page.getByLabel('最担心发生').selectOption('trust');
  await page.getByRole('button', { name: '确认这个决定' }).click();
  await expect(page.getByRole('heading', { name: '先去问，不要猜' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: '先去问，不要猜' })).toBeVisible();
  await page.unroute('**/api/student/actions');
  const evidence = page.getByRole('button', { name: /一次现场访谈/ }).first();
  await evidence.click();
  await expect(evidence).toContainText('你从现场得到');
});
