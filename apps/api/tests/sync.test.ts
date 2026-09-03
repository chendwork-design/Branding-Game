import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store/memory.js';

describe('student batch sync', () => {
  it('accepts valid actions, reports conflicts, and never trusts a client state', async () => {
    const app = buildApp(new MemoryStore());
    const login = await app.inject({
      method: 'POST',
      url: '/api/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const created = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { cookie },
      payload: { name: '批量同步测试班' },
    });
    const classInfo = created.json() as { code: string };
    const joined = await app.inject({
      method: 'POST',
      url: '/api/student/join',
      payload: { classCode: classInfo.code, studentNumber: 'sync-001', name: '同步学生' },
    });
    const student = joined.json() as { token: string; playthrough: { id: string } };

    const sync = await app.inject({
      method: 'POST',
      url: '/api/student/sync',
      headers: { 'x-student-token': student.token },
      payload: {
        playthroughId: student.playthrough.id,
        state: { metrics: { cash: 999999, trust: 999999 } },
        actions: [
          {
            idempotencyKey: 'sync-r01',
            action: {
              actionId: 'sync-r01',
              type: 'choice_selected',
              roundId: 'r01',
              payload: { choiceId: 'r01-local' },
            },
          },
          {
            idempotencyKey: 'sync-invalid-round',
            action: {
              actionId: 'sync-invalid-round',
              type: 'choice_selected',
              roundId: 'r05',
              payload: { choiceId: 'r05-simplify' },
            },
          },
        ],
      },
    });

    expect(sync.statusCode).toBe(200);
    expect(sync.json().results).toEqual([
      expect.objectContaining({ idempotencyKey: 'sync-r01', status: 'accepted', sequenceNo: 1 }),
      expect.objectContaining({ idempotencyKey: 'sync-invalid-round', status: 'rejected' }),
    ]);
    expect(sync.json().playthrough.roundIndex).toBe(1);
    expect(sync.json().playthrough.visibleMetrics.cash).toBeLessThan(100);

    const repeated = await app.inject({
      method: 'POST',
      url: '/api/student/sync',
      headers: { 'x-student-token': student.token },
      payload: {
        playthroughId: student.playthrough.id,
        actions: [
          {
            idempotencyKey: 'sync-r01',
            action: {
              actionId: 'sync-r01',
              type: 'choice_selected',
              roundId: 'r01',
              payload: { choiceId: 'r01-local' },
            },
          },
        ],
      },
    });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().results[0]).toMatchObject({
      idempotencyKey: 'sync-r01',
      status: 'duplicate',
      sequenceNo: 1,
    });
    await app.close();
  });
});
