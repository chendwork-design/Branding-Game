import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store/memory.js';

describe('security baseline', () => {
  it('sets security headers, rejects foreign origins, and limits login attempts', async () => {
    const app = buildApp(new MemoryStore());
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['x-frame-options']).toBe('DENY');
    expect(health.headers['x-request-id']).toBeTruthy();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/teacher/login',
          headers: { origin: 'https://evil.example' },
          payload: { email: 'x', password: 'y' },
        })
      ).statusCode,
    ).toBe(403);
    for (let index = 0; index < 5; index += 1) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/teacher/login',
            payload: { email: 'wrong', password: 'wrong' },
          })
        ).statusCode,
      ).toBe(401);
    }
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/teacher/login',
          payload: { email: 'wrong', password: 'wrong' },
        })
      ).statusCode,
    ).toBe(429);
    await app.close();
  });

  it('prevents cross-class playthrough access and rejects oversized input', async () => {
    const app = buildApp(new MemoryStore());
    const login = await app.inject({
      method: 'POST',
      url: '/api/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const create = async (name: string) =>
      (
        await app.inject({
          method: 'POST',
          url: '/api/teacher/classes',
          headers: { cookie },
          payload: { name },
        })
      ).json() as { code: string };
    const classA = await create('安全班 A');
    const classB = await create('安全班 B');
    const studentA = (
      await app.inject({
        method: 'POST',
        url: '/api/student/join',
        payload: { classCode: classA.code, studentNumber: 'A-1', name: 'A' },
      })
    ).json() as { token: string; playthrough: { id: string } };
    const studentB = (
      await app.inject({
        method: 'POST',
        url: '/api/student/join',
        payload: { classCode: classB.code, studentNumber: 'B-1', name: 'B' },
      })
    ).json() as { token: string; playthrough: { id: string } };
    const crossClass = await app.inject({
      method: 'GET',
      url: `/api/student/me?playthroughId=${studentB.playthrough.id}`,
      headers: { 'x-student-token': studentA.token },
    });
    expect(crossClass.statusCode).toBe(404);
    const oversizedClass = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { cookie },
      payload: { name: 'x'.repeat(81) },
    });
    expect(oversizedClass.statusCode).toBe(400);
    const oversizedReflection = await app.inject({
      method: 'POST',
      url: '/api/student/reflections',
      headers: { 'x-student-token': studentA.token },
      payload: { playthroughId: studentA.playthrough.id, text: 'x'.repeat(101) },
    });
    expect(oversizedReflection.statusCode).toBe(400);
    await app.close();
  });
});
