import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store/memory.js';

describe('teacher read-only analytics API', () => {
  it('protects analytics, exports a dictionary, manages status, and never exposes content editing', async () => {
    const app = buildApp(new MemoryStore());
    const unauthorized = await app.inject({
      method: 'GET',
      url: '/api/teacher/classes/nope/analytics',
    });
    expect(unauthorized.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const create = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { cookie },
      payload: { name: '只读分析测试班' },
    });
    const classInfo = create.json() as { id: string; code: string };

    const analytics = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classInfo.id}/analytics`,
      headers: { cookie },
    });
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json().scope).toMatchObject({ denominator: 0, excludedReplays: true });

    const csv = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classInfo.id}/export/progress`,
      headers: { cookie },
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body.startsWith('\uFEFF')).toBe(true);

    const dictionary = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classInfo.id}/export-dictionary`,
      headers: { cookie },
    });
    expect(dictionary.statusCode).toBe(200);
    expect(dictionary.json().dictionary.progress).toContain('studentNumber');

    const caseResponse = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${classInfo.id}/cases`,
      headers: { cookie },
    });
    expect(caseResponse.statusCode).toBe(409);

    const status = await app.inject({
      method: 'POST',
      url: `/api/teacher/classes/${classInfo.id}/status`,
      headers: { cookie },
      payload: { status: 'closed' },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().status).toBe('closed');
    const join = await app.inject({
      method: 'POST',
      url: '/api/student/join',
      payload: { classCode: classInfo.code, studentNumber: 'closed-1', name: '关闭后学生' },
    });
    expect(join.statusCode).toBe(400);

    const contentEdit = await app.inject({
      method: 'POST',
      url: '/api/teacher/content',
      headers: { cookie },
      payload: { title: '不应修改' },
    });
    expect(contentEdit.statusCode).toBe(404);

    const second = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { cookie },
      payload: { name: '待删除班级' },
    });
    const secondId = second.json().id as string;
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/teacher/classes/${secondId}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/teacher/classes/${secondId}/analytics`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(404);
    await app.close();
  });
});
