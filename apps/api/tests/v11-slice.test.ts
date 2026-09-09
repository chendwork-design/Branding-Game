import { describe, expect, it } from 'vitest';
import { v11FullContent, type GameContentV11 } from '@laojie/content-schema';
import { buildV11App } from '../src/v11-app.js';
import { V11MemoryStore } from '../src/store/v11-memory.js';

function v11Action(
  actionId: string,
  type: string,
  roundId: string | undefined,
  payload: Record<string, unknown>,
) {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

describe('v1.1 four-round API slice', () => {
  it('allows the documented LAN preview origin while rejecting untrusted writes', async () => {
    const app = buildV11App(new V11MemoryStore({ trialClassCode: 'CORSV11' }));
    const previewOrigin = 'http://192.168.1.103:4180';
    const content = await app.inject({
      method: 'GET',
      url: '/api/v11/content',
      headers: { origin: previewOrigin },
    });
    expect(content.statusCode).toBe(200);
    expect(content.headers['access-control-allow-origin']).toBe(previewOrigin);

    const productionPagesOrigin = 'https://branding-game.pages.dev';
    const productionContent = await app.inject({
      method: 'GET',
      url: '/api/v11/content',
      headers: { origin: productionPagesOrigin },
    });
    expect(productionContent.statusCode).toBe(200);
    expect(productionContent.headers['access-control-allow-origin']).toBe(productionPagesOrigin);

    const productionJoin = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      headers: { origin: productionPagesOrigin },
      payload: { classCode: 'CORSV11', studentNumber: '20260018', name: '正式入口学生' },
    });
    expect(productionJoin.statusCode).toBe(200);

    const deletePreflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v11/teacher/classes/v11-trial-class',
      headers: {
        origin: previewOrigin,
        'access-control-request-method': 'DELETE',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(deletePreflight.statusCode).toBe(204);
    expect(deletePreflight.headers['access-control-allow-methods']).toContain('DELETE');

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      headers: { origin: 'https://evil.example' },
      payload: { classCode: 'CORSV11', studentNumber: '20260000', name: '不受信任来源' },
    });
    expect(rejected.statusCode).toBe(403);
    await app.close();
  });

  it('separates process health from readiness and reports the verified content identity', async () => {
    const app = buildV11App(
      new V11MemoryStore({ trialClassCode: 'READYV11', content: v11FullContent }),
    );
    const health = await app.inject({ method: 'GET', url: '/health' });
    const ready = await app.inject({ method: 'GET', url: '/ready' });
    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({
      status: 'ready',
      contentVersion: 'v1.4.0',
    });
    expect(ready.json().contentChecksum).toHaveLength(64);
    await app.close();

    const unavailableStore = new V11MemoryStore({ content: v11FullContent });
    unavailableStore.checkReadiness = async () => {
      throw new Error('database unavailable');
    };
    const unavailableApp = buildV11App(unavailableStore);
    const notReady = await unavailableApp.inject({ method: 'GET', url: '/ready' });
    expect(notReady.statusCode).toBe(503);
    expect(notReady.json()).toMatchObject({ status: 'not_ready' });
    expect(notReady.body).not.toContain('database unavailable');
    await unavailableApp.close();
  });

  it('publishes the same content checksum and complete visual routes used by the live server', async () => {
    const app = buildV11App(
      new V11MemoryStore({ trialClassCode: 'CONTENTV11', content: v11FullContent }),
    );
    const response = await app.inject({ method: 'GET', url: '/api/v11/content' });
    const body = response.json() as typeof v11FullContent & { contentChecksum: string };
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-v11-content-version']).toBe(body.contentVersion);
    expect(response.headers['x-v11-content-checksum']).toBe(body.contentChecksum);
    expect(
      body.rounds
        .find((round) => round.roundId === 'r08')
        ?.choices.every((choice) => Boolean(choice.visualRouteId)),
    ).toBe(true);
    await app.close();
  });

  it('serves an immutable historical package by its exact version without changing the current package', async () => {
    const historicalContent: GameContentV11 = { ...v11FullContent, contentVersion: 'v1.2.0' };
    const app = buildV11App(
      new V11MemoryStore({
        trialClassCode: 'HISTORYV11',
        content: v11FullContent,
        additionalContents: [historicalContent],
      }),
    );
    const response = await app.inject({ method: 'GET', url: '/api/v11/content?version=v1.2.0' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ contentVersion: 'v1.2.0' });
    expect(response.headers['x-v11-content-version']).toBe('v1.2.0');

    const current = await app.inject({ method: 'GET', url: '/api/v11/content' });
    expect(current.json()).toMatchObject({ contentVersion: 'v1.4.0' });
    const unavailable = await app.inject({ method: 'GET', url: '/api/v11/content?version=v9.9.9' });
    expect(unavailable.statusCode).toBe(404);
    await app.close();
  });

  it('lets an authenticated teacher create and manage a v1.3 class without exposing its seed', async () => {
    const app = buildV11App(
      new V11MemoryStore({ trialClassCode: 'CLASSV11', content: v11FullContent }),
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/v11/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const created = await app.inject({
      method: 'POST',
      url: '/api/v11/teacher/classes',
      headers: { cookie },
      payload: { name: '2026 秋季品牌经营课' },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      name: '2026 秋季品牌经营课',
      contentVersion: 'v1.4.0',
      status: 'active',
    });
    expect(created.json()).not.toHaveProperty('seed');
    const classId = created.json().id as string;
    const classCode = created.json().code as string;
    const joinedStudent = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode, studentNumber: '20260021', name: '生命周期测试学生' },
    });
    expect(joinedStudent.statusCode).toBe(200);
    const listed = await app.inject({
      method: 'GET',
      url: '/api/v11/teacher/classes',
      headers: { cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().classes.some((item: { id: string }) => item.id === classId)).toBe(true);
    const closed = await app.inject({
      method: 'POST',
      url: `/api/v11/teacher/classes/${classId}/status`,
      headers: { cookie },
      payload: { status: 'closed' },
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toMatchObject({ id: classId, status: 'closed' });
    const archived = await app.inject({
      method: 'POST',
      url: `/api/v11/teacher/classes/${classId}/status`,
      headers: { cookie },
      payload: { status: 'archived' },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json()).toMatchObject({ id: classId, status: 'archived' });
    const restored = await app.inject({
      method: 'POST',
      url: `/api/v11/teacher/classes/${classId}/status`,
      headers: { cookie },
      payload: { status: 'closed' },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: classId, status: 'closed' });
    const missingConfirmation = await app.inject({
      method: 'DELETE',
      url: `/api/v11/teacher/classes/${classId}`,
      headers: { cookie },
      payload: { confirmation: 'NO' },
    });
    expect(missingConfirmation.statusCode).toBe(400);
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v11/teacher/classes/${classId}`,
      headers: { cookie },
      payload: { confirmation: 'DELETE_CLASS' },
    });
    expect(deleted.statusCode).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v11/teacher/classes', headers: { cookie } }))
        .json()
        .classes.some((item: { id: string }) => item.id === classId),
    ).toBe(false);
    const joinAfterDelete = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode, studentNumber: '20260021', name: '生命周期测试学生' },
    });
    expect(joinAfterDelete.statusCode).toBe(400);
    const studentsAfterDelete = await app.inject({
      method: 'GET',
      url: `/api/v11/teacher/classes/${classId}/students`,
      headers: { cookie },
    });
    expect(studentsAfterDelete.statusCode).toBe(404);
    await app.close();
  });

  it('uses a secure cross-site teacher session cookie in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const app = buildV11App(new V11MemoryStore({ trialClassCode: 'COOKIEV11' }));
    try {
      const login = await app.inject({
        method: 'POST',
        url: '/api/v11/teacher/login',
        payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
      });
      expect(login.statusCode).toBe(200);
      expect(String(login.headers['set-cookie'])).toContain('Secure');
      expect(String(login.headers['set-cookie'])).toContain('SameSite=None');
    } finally {
      await app.close();
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('settles authoritative actions once and exposes an auditable report', async () => {
    const store = new V11MemoryStore({ trialClassCode: 'LAOJIE11' });
    const app = buildV11App(store);
    const join = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode: 'LAOJIE11', studentNumber: '20260011', name: '切片学生' },
    });
    expect(join.statusCode).toBe(200);
    const joined = join.json() as { token: string; playthrough: { id: string } };
    const submit = async (id: string, action: ReturnType<typeof v11Action>) =>
      app.inject({
        method: 'POST',
        url: '/api/v11/student/actions',
        headers: { 'x-student-token': joined.token },
        payload: { playthroughId: joined.playthrough.id, idempotencyKey: id, action },
      });

    expect(
      (await submit('a0', v11Action('a0', 'onboarding_completed', undefined, {}))).statusCode,
    ).toBe(200);
    const first = await submit(
      'a1',
      v11Action('a1', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
    );
    const duplicate = await submit(
      'a1',
      v11Action('a1', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
    );
    expect(first.statusCode).toBe(200);
    expect(first.json().playthrough.resumeScreen).toBe('round-result');
    expect(first.json().playthrough.pendingRoundResult?.roundId).toBe('r01');
    expect(first.json().playthrough.state.pendingRoundResult?.choiceId).toBe('r01-neighbor');
    expect(duplicate.json().log.sequenceNo).toBe(2);
    expect(duplicate.json().playthrough.pendingRoundResult?.roundId).toBe('r01');
    expect(duplicate.json().playthrough.visibleMetrics.cashYuan).toBe(482000);

    expect(
      (
        await submit(
          'a2',
          v11Action('a2', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'a3',
          v11Action('a3', 'choice_committed', 'r03', {
            choiceId: 'r03-stable',
            decisionGroupId: 'dg-r03',
          }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'a4',
          v11Action('a4', 'round_result_acknowledged', 'r03', { resultId: 'result-r03' }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await submit('a5', v11Action('a5', 'visual_selected', 'r08', { visualId: 'v-line' })))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'a6',
          v11Action('a6', 'visual_tested', 'r08', {
            visualId: 'v-line',
            testId: 'r08-sign-3-second',
          }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'a7',
          v11Action('a7', 'choice_committed', 'r08', {
            choiceId: 'r08-line',
            decisionGroupId: 'dg-r08',
          }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'a8',
          v11Action('a8', 'round_result_acknowledged', 'r08', { resultId: 'result-r08' }),
        )
      ).statusCode,
    ).toBe(200);
    const r11 = await submit(
      'a9',
      v11Action('a9', 'choice_committed', 'r11', {
        choiceId: 'r11-steady',
        decisionGroupId: 'dg-r11',
      }),
    );
    expect(r11.statusCode, r11.body).toBe(200);
    const last = await submit(
      'a10',
      v11Action('a10', 'round_result_acknowledged', 'r11', { resultId: 'result-r11' }),
    );
    expect(last.statusCode).toBe(200);
    expect(last.json().playthrough.status).toBe('completed');
    expect(last.json().playthrough.reportAvailable).toBe(true);
    expect(last.json().playthrough.resumeScreen).toBe('complete');

    const report = await app.inject({
      method: 'GET',
      url: `/api/v11/student/reports/${joined.playthrough.id}`,
      headers: { 'x-student-token': joined.token },
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().evidenceDiagnosis).toBeInstanceOf(Array);
    expect(JSON.stringify(report.json())).not.toContain('r11-steady');
    await app.close();
  });

  it('rejects reusing an idempotency key for a different action', async () => {
    const app = buildV11App(new V11MemoryStore({ trialClassCode: 'IDEMPOTENCY' }));
    const join = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode: 'IDEMPOTENCY', studentNumber: '20260014', name: '幂等学生' },
    });
    const joined = join.json() as { token: string; playthrough: { id: string } };
    const submit = (action: ReturnType<typeof v11Action>) =>
      app.inject({
        method: 'POST',
        url: '/api/v11/student/actions',
        headers: { 'x-student-token': joined.token },
        payload: { playthroughId: joined.playthrough.id, idempotencyKey: 'same-command', action },
      });

    const first = await submit(v11Action('same-command', 'onboarding_completed', undefined, {}));
    const conflict = await submit(
      v11Action('same-command', 'question_action_executed', 'r01', {
        actionId: 'r01-observe-footfall',
      }),
    );

    expect(first.statusCode).toBe(200);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      retryable: false,
      playerMessage: expect.stringContaining('请求编号'),
    });
    await app.close();
  });

  it('rejects client-authored settlement fields and keeps the teacher timeline authorized', async () => {
    const store = new V11MemoryStore({ trialClassCode: 'LAOJIE11' });
    const app = buildV11App(store);
    const join = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode: 'LAOJIE11', studentNumber: '20260012', name: '协议学生' },
    });
    const joined = join.json() as { token: string; playthrough: { id: string } };
    const forged = await app.inject({
      method: 'POST',
      url: '/api/v11/student/actions',
      headers: { 'x-student-token': joined.token },
      payload: {
        playthroughId: joined.playthrough.id,
        idempotencyKey: 'forged',
        action: v11Action('forged', 'choice_committed', 'r01', {
          choiceId: 'r01-neighbor',
          decisionGroupId: 'dg-r01',
          cashYuan: 1,
          effects: [],
        }),
      },
    });
    expect(forged.statusCode).toBe(400);
    expect(forged.json()).toMatchObject({
      code: 'ACTION_REJECTED',
      playerMessage: expect.stringContaining('现在无法执行'),
      technicalCode: expect.stringContaining('不允许'),
      recoveryAction: '回到经营现场',
    });

    const unauthorizedTimeline = await app.inject({
      method: 'GET',
      url: '/api/v11/teacher/classes/v11-trial-class/students',
    });
    expect(unauthorizedTimeline.statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v11/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const timeline = await app.inject({
      method: 'GET',
      url: '/api/v11/teacher/classes/v11-trial-class/students',
      headers: { cookie },
    });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json().students[0].identity.displayName).toBe('协议学生');
    await app.close();
  });

  it('returns player-safe recovery guidance instead of a raw engine error', async () => {
    const app = buildV11App(new V11MemoryStore({ trialClassCode: 'PLAYERERROR' }));
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v11/student/actions',
      payload: { playthroughId: 'missing', action: {}, idempotencyKey: 'bad-action' },
    });

    expect(rejected.statusCode).toBe(401);
    expect(rejected.json()).toMatchObject({
      code: 'UNAUTHORIZED',
      playerMessage: expect.stringContaining('重新输入班级信息'),
      technicalCode: 'UNAUTHORIZED',
      retryable: false,
      recoveryAction: '重新进入班级',
    });
  });

  it('keeps a full-course run active until the annual review is acknowledged', async () => {
    const finalRound = v11FullContent.rounds.find((round) => round.roundId === 'r12');
    if (!finalRound) throw new Error('缺少年度方向回合');
    const content = { ...v11FullContent, rounds: [finalRound] };
    const store = new V11MemoryStore({ trialClassCode: 'FINALREVIEW', content });
    const app = buildV11App(store);
    const join = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode: 'FINALREVIEW', studentNumber: '20260013', name: '年度体检学生' },
    });
    const joined = join.json() as { token: string; playthrough: { id: string } };
    const submit = async (id: string, action: ReturnType<typeof v11Action>) =>
      app.inject({
        method: 'POST',
        url: '/api/v11/student/actions',
        headers: { 'x-student-token': joined.token },
        payload: { playthroughId: joined.playthrough.id, idempotencyKey: id, action },
      });

    expect(
      (await submit('final-intro', v11Action('final-intro', 'onboarding_completed', undefined, {})))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'final-choice',
          v11Action('final-choice', 'choice_committed', 'r12', {
            choiceId: 'r12-steady-renewal',
            decisionGroupId: 'dg-r12',
          }),
        )
      ).statusCode,
    ).toBe(200);
    const resultAcknowledged = await submit(
      'final-result',
      v11Action('final-result', 'round_result_acknowledged', 'r12', { resultId: 'result-r12' }),
    );
    expect(resultAcknowledged.statusCode).toBe(200);
    expect(resultAcknowledged.json().playthrough.status).toBe('active');
    expect(resultAcknowledged.json().playthrough.reportAvailable).toBe(false);
    expect(resultAcknowledged.json().playthrough.resumeScreen).toBe('chapter-review');
    expect(resultAcknowledged.json().playthrough.chapterReviewPending).toBe('r12');

    const reviewAcknowledged = await submit(
      'final-review',
      v11Action('final-review', 'chapter_review_acknowledged', 'r12', {}),
    );
    expect(reviewAcknowledged.statusCode).toBe(200);
    expect(reviewAcknowledged.json().playthrough.status).toBe('completed');
    expect(reviewAcknowledged.json().playthrough.reportAvailable).toBe(true);
    expect(reviewAcknowledged.json().playthrough.resumeScreen).toBe('complete');
    await app.close();
  });

  it('starts an isolated replay only after the immutable first run is complete', async () => {
    const finalRound = v11FullContent.rounds.find((round) => round.roundId === 'r12');
    if (!finalRound) throw new Error('缺少年度方向回合');
    const content = { ...v11FullContent, rounds: [finalRound] };
    const app = buildV11App(new V11MemoryStore({ trialClassCode: 'REPLAYV11', content }));
    const join = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode: 'REPLAYV11', studentNumber: '20260015', name: '重玩学生' },
    });
    const joined = join.json() as { token: string; playthrough: { id: string } };
    const replayBeforeComplete = await app.inject({
      method: 'POST',
      url: '/api/v11/student/replay',
      headers: { 'x-student-token': joined.token },
      payload: { firstRunId: joined.playthrough.id },
    });
    expect(replayBeforeComplete.statusCode).toBe(400);
    expect(replayBeforeComplete.json()).toMatchObject({
      code: 'REPLAY_NOT_READY',
      retryable: false,
    });

    const submit = (actionId: string, action: ReturnType<typeof v11Action>) =>
      app.inject({
        method: 'POST',
        url: '/api/v11/student/actions',
        headers: { 'x-student-token': joined.token },
        payload: { playthroughId: joined.playthrough.id, idempotencyKey: actionId, action },
      });
    expect(
      (
        await submit(
          'replay-intro',
          v11Action('replay-intro', 'onboarding_completed', undefined, {}),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'replay-choice',
          v11Action('replay-choice', 'choice_committed', 'r12', {
            choiceId: 'r12-steady-renewal',
            decisionGroupId: 'dg-r12',
          }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await submit(
          'replay-result',
          v11Action('replay-result', 'round_result_acknowledged', 'r12', {
            resultId: 'result-r12',
          }),
        )
      ).statusCode,
    ).toBe(200);
    const completed = await submit(
      'replay-review',
      v11Action('replay-review', 'chapter_review_acknowledged', 'r12', {}),
    );
    expect(completed.json().playthrough.status).toBe('completed');

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v11/student/replay',
      headers: { 'x-student-token': joined.token },
      payload: { firstRunId: joined.playthrough.id },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().playthrough).toMatchObject({
      kind: 'replay',
      status: 'active',
      roundIndex: 0,
    });
    expect(replay.json().playthrough.id).not.toBe(joined.playthrough.id);

    const firstRun = await app.inject({
      method: 'GET',
      url: `/api/v11/student/me?playthroughId=${joined.playthrough.id}`,
      headers: { 'x-student-token': joined.token },
    });
    expect(firstRun.json().playthrough).toMatchObject({ kind: 'first_run', status: 'completed' });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v11/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const students = await app.inject({
      method: 'GET',
      url: '/api/v11/teacher/classes/v11-trial-class/students',
      headers: { cookie },
    });
    expect(
      students
        .json()
        .students[0].playthroughs.filter((item: { kind: string }) => item.kind === 'first_run'),
    ).toHaveLength(1);
    expect(
      students
        .json()
        .students[0].playthroughs.filter((item: { kind: string }) => item.kind === 'replay'),
    ).toHaveLength(1);
    await app.close();
  });
});
