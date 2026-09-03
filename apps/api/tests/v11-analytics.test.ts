import { describe, expect, it } from 'vitest';
import { v11SliceContent } from '@laojie/content-schema';
import { createV11State, type V11GameState } from '@laojie/game-engine';
import { buildV11App } from '../src/v11-app.js';
import { buildV11AnonymousCases } from '../src/v11-analytics.js';
import { V11MemoryStore } from '../src/store/v11-memory.js';

function action(
  actionId: string,
  type: string,
  roundId: string | undefined,
  payload: Record<string, unknown>,
) {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

describe('v1.1 report and teacher analytics', () => {
  it('selects up to three distinct anonymous paths for discussion', () => {
    const bundles = ['A', 'B', 'C'].map((label, index) => {
      const state = createV11State('1.1.0', `playthrough-${index}`);
      state.completedRoundIds = ['r01', 'r03', 'r08', 'r11'];
      state.traces = [
        {
          actionType: 'choice_committed',
          roundId: 'r01',
          result: { choiceLabel: `第${index + 1}种开局` },
        } as V11GameState['traces'][number],
      ];
      return {
        identity: {
          id: `identity-${index}`,
          classId: 'class',
          studentNumber: `${index}`,
          normalizedStudentNumber: `${index}`,
          displayName: `学生${index}`,
          createdAt: '',
        },
        playthroughs: [
          {
            id: `playthrough-${index}`,
            classId: 'class',
            studentIdentityId: `identity-${index}`,
            kind: 'first_run' as const,
            status: 'completed' as const,
            state,
            stateHash: '',
            logs: [],
            startedAt: '',
          },
        ],
      };
    });
    const cases = buildV11AnonymousCases(bundles, v11SliceContent);
    expect(cases).toHaveLength(3);
    expect(new Set(cases.map((item) => item.path[0]?.choiceLabel)).size).toBe(3);
  });

  it('returns a causal report, teacher aggregates, anonymous case and safe CSV', async () => {
    const store = new V11MemoryStore({ trialClassCode: 'ANALYTICS11' });
    const app = buildV11App(store);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v11/teacher/login',
      payload: { email: 'teacher@example.test', password: 'change-me-in-production' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const join = await app.inject({
      method: 'POST',
      url: '/api/v11/student/join',
      payload: { classCode: 'ANALYTICS11', studentNumber: '001', name: '仅教师可见' },
    });
    const joined = join.json() as { token: string; playthrough: { id: string } };
    const submit = (id: string, current: ReturnType<typeof action>) =>
      app.inject({
        method: 'POST',
        url: '/api/v11/student/actions',
        headers: { 'x-student-token': joined.token },
        payload: { playthroughId: joined.playthrough.id, idempotencyKey: id, action: current },
      });
    const steps = [
      action('a0', 'onboarding_completed', undefined, {}),
      action('a1-research', 'stage_action_selected', 'r01', { actionId: 'r01-observe-footfall' }),
      action('a1-evidence', 'evidence_viewed', 'r01', { evidenceId: 'ev-r01-footfall' }),
      action('a2', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      action('a3', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
      action('a4', 'choice_committed', 'r03', {
        choiceId: 'r03-stable',
        decisionGroupId: 'dg-r03',
      }),
      action('a5', 'round_result_acknowledged', 'r03', { resultId: 'result-r03' }),
      action('a6', 'visual_selected', 'r08', { visualId: 'v-line' }),
      action('a7', 'visual_tested', 'r08', { visualId: 'v-line', testId: 'r08-sign-3-second' }),
      action('a8', 'choice_committed', 'r08', { choiceId: 'r08-line', decisionGroupId: 'dg-r08' }),
      action('a9', 'round_result_acknowledged', 'r08', { resultId: 'result-r08' }),
      action('a10', 'choice_committed', 'r11', {
        choiceId: 'r11-steady',
        decisionGroupId: 'dg-r11',
      }),
      action('a11', 'round_result_acknowledged', 'r11', { resultId: 'result-r11' }),
    ];
    for (const step of steps) expect((await submit(step.actionId, step)).statusCode).toBe(200);

    const report = await app.inject({
      method: 'GET',
      url: `/api/v11/student/reports/${joined.playthrough.id}`,
      headers: { 'x-student-token': joined.token },
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().roundReviews).toHaveLength(4);
    expect(JSON.stringify(report.json())).not.toContain('001');
    expect(JSON.stringify(report.json())).not.toContain('r01-neighbor');

    const analytics = await app.inject({
      method: 'GET',
      url: '/api/v11/teacher/classes/v11-trial-class/analytics',
      headers: { cookie },
    });
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json().progress.completed).toBe(1);
    expect(analytics.json().choiceDistribution['r01-neighbor']).toBe(1);
    expect(analytics.json().brandIdentityDistribution).toEqual(
      expect.objectContaining({ wordmark: 0, symbol: 0, ip: 0 }),
    );
    expect(analytics.json().predictionSummary).toEqual(
      expect.objectContaining({ submitted: 0, matchedTopChange: 0 }),
    );
    expect(analytics.json().anonymousAwards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ awardId: 'evidence-led', count: 1 }),
        expect.objectContaining({ awardId: 'traceable-decisions', count: 1 }),
      ]),
    );

    const exported = await app.inject({
      method: 'GET',
      url: '/api/v11/teacher/classes/v11-trial-class/export/reports',
      headers: { cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.body.startsWith('\uFEFF')).toBe(true);
    expect(exported.body).toContain('仅教师可见');

    const createdCase = await app.inject({
      method: 'POST',
      url: '/api/v11/teacher/classes/v11-trial-class/cases',
      headers: { cookie },
    });
    expect(createdCase.statusCode).toBe(200);
    const casePayload = createdCase.json() as {
      caseId: string;
      path: Array<{ roundTitle: string; choiceLabel: string }>;
    };
    expect(casePayload.path[0]?.choiceLabel).toBe('先做附近居民的日常茶饮');
    expect(JSON.stringify(casePayload)).not.toContain('仅教师可见');
    const publicCase = await app.inject({
      method: 'GET',
      url: `/api/v11/cases/${casePayload.caseId}`,
    });
    expect(publicCase.statusCode).toBe(200);
    await app.close();
  });
});
