import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store/memory.js';

describe('local trial class', () => {
  it('allows a fresh local server to accept the configured trial class code', async () => {
    const app = buildApp(new MemoryStore({ trialClassCode: 'LAOJIE' }));
    const response = await app.inject({
      method: 'POST',
      url: '/api/student/join',
      payload: { classCode: 'laojie', studentNumber: '20260001', name: '试运行学生' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().playthrough.roundIndex).toBe(0);
    await app.close();
  });

  it('does not create a trial class unless it is explicitly configured', async () => {
    const app = buildApp(new MemoryStore());
    const response = await app.inject({
      method: 'POST',
      url: '/api/student/join',
      payload: { classCode: 'LAOJIE', studentNumber: '20260001', name: '试运行学生' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('班级不存在或已关闭');
    await app.close();
  });
});
