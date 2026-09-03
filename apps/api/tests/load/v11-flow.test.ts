import { describe, expect, it } from 'vitest';
import { v11FullContent } from '@laojie/content-schema';
import { buildV11App } from '../../src/v11-app.js';
import { V11MemoryStore } from '../../src/store/v11-memory.js';

const percentile = (values: number[], fraction: number) =>
  [...values].sort((left, right) => left - right)[
    Math.min(values.length - 1, Math.floor(values.length * fraction))
  ] ?? 0;

describe('80-student v1.1 load model', () => {
  it('supports an 80-person join burst, 40 active actions and teacher aggregation', async () => {
    const app = buildV11App(
      new V11MemoryStore({ trialClassCode: 'LOADV11', content: v11FullContent }),
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/v11/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const joinTimes: number[] = [];
    const joined = await Promise.all(
      Array.from({ length: 80 }, async (_, index) => {
        const started = performance.now();
        const response = await app.inject({
          method: 'POST',
          url: '/api/v11/student/join',
          payload: {
            classCode: 'LOADV11',
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
    const responses = await Promise.all(
      joined.slice(0, 40).map(async (student, index) => {
        const started = performance.now();
        const response = await app.inject({
          method: 'POST',
          url: '/api/v11/student/actions',
          headers: { 'x-student-token': student.token },
          payload: {
            playthroughId: student.playthrough.id,
            idempotencyKey: `load-v11-${index}`,
            action: {
              protocolVersion: '1.1',
              actionId: `load-v11-${index}`,
              type: 'onboarding_completed',
              payload: {},
            },
          },
        });
        actionTimes.push(performance.now() - started);
        return response;
      }),
    );
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    const analytics = await app.inject({
      method: 'GET',
      url: '/api/v11/teacher/classes/v11-trial-class/analytics',
      headers: { cookie },
    });
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json().progress.totalStudents).toBe(80);
    expect(analytics.json().progress.started).toBe(80);
    expect(percentile(joinTimes, 0.95)).toBeLessThan(800);
    expect(percentile(actionTimes, 0.95)).toBeLessThan(1500);
    await app.close();
  }, 120_000);
});
