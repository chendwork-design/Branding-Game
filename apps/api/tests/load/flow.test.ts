import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { MemoryStore } from '../../src/store/memory.js';

const percentile = (values: number[], fraction: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * fraction))
  ] ?? 0;

describe('80-student load model', () => {
  it('supports an 80-person join burst, 40 action submissions, analytics and export', async () => {
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
      payload: { name: '80人负载测试班' },
    });
    const classInfo = created.json() as { id: string; code: string };

    const joinTimes: number[] = [];
    const joined = await Promise.all(
      Array.from({ length: 80 }, async (_, index) => {
        const started = performance.now();
        const response = await app.inject({
          method: 'POST',
          url: '/api/student/join',
          payload: {
            classCode: classInfo.code,
            studentNumber: `load-${index}`,
            name: `负载学生${index}`,
          },
        });
        joinTimes.push(performance.now() - started);
        expect(response.statusCode).toBe(200);
        return response.json() as { token: string; playthrough: { id: string } };
      }),
    );
    const actionTimes: number[] = [];
    const actionResponses = await Promise.all(
      joined.slice(0, 40).map(async (student, index) => {
        const started = performance.now();
        const response = await app.inject({
          method: 'POST',
          url: '/api/student/actions',
          headers: { 'x-student-token': student.token },
          payload: {
            playthroughId: student.playthrough.id,
            idempotencyKey: `load-action-${index}`,
            action: {
              actionId: `load-action-${index}`,
              roundId: 'r01',
              type: 'choice_selected',
              payload: { choiceId: 'r01-local' },
            },
          },
        });
        actionTimes.push(performance.now() - started);
        return response;
      }),
    );
    expect(actionResponses.every((response) => response.statusCode === 200)).toBe(true);

    const analyticsStarted = performance.now();
    const analytics = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classInfo.id}/analytics`,
      headers: { cookie },
    });
    const analyticsMs = performance.now() - analyticsStarted;
    const exportStarted = performance.now();
    const exported = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classInfo.id}/export/decisions`,
      headers: { cookie },
    });
    const exportMs = performance.now() - exportStarted;
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json().progress.totalStudents).toBe(80);
    expect(exported.statusCode).toBe(200);
    expect(percentile(joinTimes, 0.95)).toBeLessThan(800);
    expect(percentile(actionTimes, 0.95)).toBeLessThan(1500);
    expect(analyticsMs).toBeLessThan(800);
    expect(exportMs).toBeLessThan(800);
    console.log(
      JSON.stringify({
        environment: {
          node: process.version,
          model: 'MemoryStore + Fastify inject',
          users: 80,
          concurrentActions: 40,
        },
        samples: {
          joinP95Ms: percentile(joinTimes, 0.95),
          actionP95Ms: percentile(actionTimes, 0.95),
          analyticsMs,
          exportMs,
          errorRate: 0,
        },
      }),
    );
    await app.close();
  });
});
