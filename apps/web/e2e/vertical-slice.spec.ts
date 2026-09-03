import { expect, test } from '@playwright/test';

const apiOrigin = `http://127.0.0.1:${process.env.API_PORT ?? '3000'}`;

test('student can join and finish the twelve-round full course path', async ({ page, request }) => {
  test.setTimeout(120_000);
  const activate = async (locator: ReturnType<typeof page.getByRole>, emulateTouch = false) => {
    if (emulateTouch && test.info().project.name.includes('iphone')) {
      await expect(locator).toBeEnabled();
      await locator.click({ force: true });
    } else {
      await locator.scrollIntoViewIfNeeded();
      await locator.click();
    }
  };
  const select = async (locator: ReturnType<typeof page.getByLabel>, value: string) => {
    await locator.selectOption(value);
    await expect(locator).toHaveValue(value);
  };
  const fill = async (locator: ReturnType<typeof page.getByLabel>, value: string) => {
    if (test.info().project.name.includes('iphone')) {
      await locator.evaluate((element, nextValue) => {
        const input = element as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
        setter?.call(input, nextValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
    } else await locator.fill(value);
    await expect(locator).toHaveValue(value);
  };
  const login = await request.post(`${apiOrigin}/api/teacher/login`, {
    data: { email: 'teacher@example.test', password: 'change-me-in-production' },
  });
  expect(login.ok()).toBeTruthy();
  const setCookie = login.headers()['set-cookie'];
  if (!setCookie) throw new Error('教师登录没有返回会话 Cookie');
  const cookieHeader = setCookie.split(';')[0] ?? '';
  const create = await request.post(`${apiOrigin}/api/teacher/classes`, {
    headers: { cookie: cookieHeader },
    data: { name: 'E2E vertical slice' },
  });
  expect(create.ok()).toBeTruthy();
  const classInfo = (await create.json()) as { code: string };

  await page.goto('/');
  await fill(page.getByLabel('班级码'), classInfo.code);
  await fill(page.getByLabel('学号'), 'e2e-001');
  await fill(page.getByLabel('姓名'), '浏览器测试');
  await activate(page.getByRole('button', { name: '进入品牌局' }));
  await expect(page.getByRole('heading', { name: '先别急着做 Logo' })).toBeVisible({
    timeout: 15_000,
  });

  async function choose(roundTitle: string, choice: string, nextRoundTitle: string) {
    await expect(page.getByRole('heading', { name: roundTitle })).toBeVisible();
    const evidence = page
      .getByRole('button', {
        name: /一周客流观察|一次现场访谈|午间排队记录|街景观察|供应和服务盘点/,
      })
      .first();
    if (await evidence.isEnabled()) {
      await activate(evidence, true);
      await expect(evidence).not.toContainText('查看（');
    }
    const choiceButton = page.locator('.choice-grid .choice').filter({ hasText: choice }).first();
    await activate(choiceButton, true);
    await expect(page.getByText('确认之前', { exact: true })).toBeVisible();
    const intent = page.getByLabel('最希望获得');
    const risk = page.getByLabel('最担心发生');
    await select(intent, 'growth');
    await select(risk, 'trust');
    const confirm = page.getByRole('button', { name: '确认这个决定' });
    await expect(confirm).toBeEnabled();
    await activate(confirm, true);
    await expect(page.getByRole('heading', { name: nextRoundTitle })).toBeVisible({
      timeout: 15_000,
    });
  }

  await choose('先别急着做 Logo', '附近居民', '先去问，不要猜');
  await choose('先去问，不要猜', '做三次短访谈', '一杯茶的理由');
  await choose('一杯茶的理由', '通勤提神', '名字不是口号');
  await choose('名字不是口号', '一眼能说清品类', '你说的品牌做得到吗');
  await choose('你说的品牌做得到吗', '删掉复杂款', '位置和价格会说话');
  await choose('位置和价格会说话', '做日常价', 'IP不是吉祥物');
  await choose('IP不是吉祥物', '让 IP 成为新客识别入口', '设计进入现实');
  await expect(page.getByRole('heading', { name: '设计进入现实' })).toBeVisible();
  await activate(page.getByRole('button', { name: /一笔成街/ }), true);
  for (const name of ['店招三秒测试', '手机缩小测试', '同街竞争测试', '包装使用测试'])
    await activate(page.getByRole('button', { name: new RegExp(name) }), true);
  await activate(page.getByRole('button', { name: /能缩小、能延展/ }), true);
  await select(page.getByLabel('最希望获得'), 'recognition');
  await select(page.getByLabel('最担心发生'), 'homogenization');
  await activate(page.getByRole('button', { name: '确认这个决定' }), true);
  await choose('杯子会离店', '优先让杯子在手机照片里保持识别', '谁在替你说话');
  await choose('谁在替你说话', '先和本地社群共同做内容', '火了以后全是事');
  await choose('火了以后全是事', '先限量', '把品牌交给明天');
  await choose('把品牌交给明天', '先整理一页品牌决策原则', 'e-research-led');
  await expect(page.getByRole('heading', { name: 'e-research-led' })).toBeVisible();
  await expect(page.getByText('因果解释')).toBeVisible();
  await expect(page.getByText('课程概念')).toBeVisible();
  await expect(page.getByRole('button', { name: '复制匿名课堂摘要' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始一次独立重玩' })).toBeVisible();
  await page.getByRole('button', { name: '开始一次独立重玩' }).click();
  await expect(page.getByRole('heading', { name: '先别急着做 Logo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '先别急着做 Logo' })).toBeVisible();
});
