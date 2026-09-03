import { describe, expect, it } from 'vitest';
import { fullContent } from '@laojie/content-schema/full';
import { buildApp } from '../../src/app.js';
import { MemoryStore } from '../../src/store/memory.js';

describe('student and teacher API lifecycle', () => {
  it('keeps first run immutable, is idempotent, and exposes the full teacher trace', async () => {
    const store = new MemoryStore();
    const app = buildApp(store);
    const login = await app.inject({
      method: 'POST',
      url: '/api/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const create = await app.inject({
      method: 'POST',
      url: '/api/teacher/classes',
      headers: { cookie },
      payload: { name: '产品品牌创新 2026' },
    });
    expect(create.statusCode).toBe(200);
    const classInfo = create.json() as { code: string; id: string };
    expect(classInfo.code).toMatch(/^[A-F0-9]{6}$/);
    expect(create.json().seed).toBeUndefined();

    const join = await app.inject({
      method: 'POST',
      url: '/api/student/join',
      payload: { classCode: classInfo.code, studentNumber: '2026001', name: '测试学生' },
    });
    expect(join.statusCode).toBe(200);
    const joined = join.json() as {
      token: string;
      playthrough: { id: string; roundIndex: number };
    };
    expect(joined.playthrough.roundIndex).toBe(0);

    const submit = async (
      id: string,
      roundId: string,
      type: string,
      payload: Record<string, string>,
    ) =>
      app.inject({
        method: 'POST',
        url: '/api/student/actions',
        headers: { 'x-student-token': joined.token },
        payload: {
          playthroughId: joined.playthrough.id,
          idempotencyKey: id,
          action: { actionId: id, roundId, type, payload },
        },
      });

    const first = await submit('r1', 'r01', 'choice_selected', { choiceId: 'r01-local' });
    const repeated = await submit('r1', 'r01', 'choice_selected', { choiceId: 'r01-local' });
    expect(first.statusCode).toBe(200);
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().log.sequenceNo).toBe(1);
    for (const round of fullContent.rounds.slice(1, -1)) {
      const evidence = round.evidence[0];
      if (evidence)
        await submit(`${round.roundId}-evidence`, round.roundId, 'evidence_viewed', {
          evidenceId: evidence.evidenceId,
        });
      if (round.visualRequired) {
        await submit(`${round.roundId}-visual`, round.roundId, 'visual_selected', {
          visualId: 'v-system',
        });
        for (const visualTest of round.visualTests)
          await submit(`${round.roundId}-${visualTest.testId}`, round.roundId, 'visual_tested', {
            testId: visualTest.testId,
          });
      }
      const choice = round.choices[0]!;
      await submit(round.roundId, round.roundId, 'choice_selected', { choiceId: choice.choiceId });
    }
    const finalRound = fullContent.rounds.at(-1)!;
    await submit('r12-evidence', 'r12', 'evidence_viewed', {
      evidenceId: finalRound.evidence[0]!.evidenceId,
    });
    const last = await submit('r12', 'r12', 'choice_selected', { choiceId: 'r12-alt-1' });
    expect(last.statusCode).toBe(200);
    expect(last.json().playthrough.status).toBe('completed');
    expect(last.json().playthrough.reportAvailable).toBe(true);

    const report = await app.inject({
      method: 'GET',
      url: `/api/student/reports/${joined.playthrough.id}`,
      headers: { 'x-student-token': joined.token },
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().causalExplanations).toHaveLength(12);

    const reflection = async (text: string) =>
      app.inject({
        method: 'POST',
        url: '/api/student/reflections',
        headers: { 'x-student-token': joined.token },
        payload: { playthroughId: joined.playthrough.id, text },
      });
    expect((await reflection('第一版复盘')).statusCode).toBe(200);
    expect((await reflection('第二版复盘')).statusCode).toBe(200);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/student/replay',
      headers: { 'x-student-token': joined.token },
      payload: { firstRunId: joined.playthrough.id },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().playthrough.kind).toBe('replay');

    const students = await app.inject({
      method: 'GET',
      url: `/api/teacher/classes/${classInfo.id}/students`,
      headers: { cookie },
    });
    expect(students.statusCode).toBe(200);
    expect(students.json().students[0].playthroughs[0].logs).toHaveLength(28);
    expect(students.json().students[0].identity.displayName).toBe('测试学生');
    expect(students.json().students[0].playthroughs[0].reflectionHistory).toHaveLength(2);
    await app.close();
  });
});
