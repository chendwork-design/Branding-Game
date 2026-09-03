import { describe, expect, it } from 'vitest';
import { v11FullContent, validateV11Content } from '@laojie/content-schema';
import { applyV11Action, createV11State, type V11Action } from '../src/index.js';

function action(
  actionId: string,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown>,
): V11Action {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

describe('v1.2 action-to-evidence loop', () => {
  it('charges once when an action reveals evidence, then lets the player read it without a second charge', () => {
    let state = createV11State(v11FullContent.contentVersion, 'action-evidence');
    state = applyV11Action(
      state,
      v11FullContent,
      action('intro', 'onboarding_completed', undefined, {}),
      'evidence-seed',
    ).state;
    const before = { cashYuan: state.cashYuan, freeActionPoints: state.freeActionPoints };
    state = applyV11Action(
      state,
      v11FullContent,
      action('observe', 'question_action_executed', 'r01', { actionId: 'r01-observe-footfall' }),
      'evidence-seed',
    ).state;
    expect(state.viewedEvidenceIds).toContain('ev-r01-footfall');
    expect(state.freeActionPoints).toBe(before.freeActionPoints - 1);
    const afterAction = { cashYuan: state.cashYuan, freeActionPoints: state.freeActionPoints };
    state = applyV11Action(
      state,
      v11FullContent,
      action('open', 'evidence_viewed', 'r01', { evidenceId: 'ev-r01-footfall' }),
      'evidence-seed',
    ).state;
    expect({ cashYuan: state.cashYuan, freeActionPoints: state.freeActionPoints }).toEqual(
      afterAction,
    );
    expect(state.traces.at(-1)?.explanation).toContain('不再重复花费资源');
  });

  it('does not reveal a paid action result before the matching action has been completed', () => {
    let state = createV11State(v11FullContent.contentVersion, 'locked-evidence');
    state = applyV11Action(
      state,
      v11FullContent,
      action('intro', 'onboarding_completed', undefined, {}),
      'evidence-seed',
    ).state;
    expect(() =>
      applyV11Action(
        state,
        v11FullContent,
        action('peek', 'evidence_viewed', 'r01', { evidenceId: 'ev-r01-footfall' }),
        'evidence-seed',
      ),
    ).toThrow('先完成能带回这条结果的行动');
  });

  it('keeps every first-round investigation result distinct and reviewable after the action completes', () => {
    let state = createV11State(v11FullContent.contentVersion, 'action-result-audit');
    state = applyV11Action(
      state,
      v11FullContent,
      action('intro', 'onboarding_completed', undefined, {}),
      'evidence-seed',
    ).state;
    for (const actionId of ['r01-observe-footfall', 'r01-interview-neighbors', 'r01-quote-rent']) {
      state = applyV11Action(
        state,
        v11FullContent,
        action(`run-${actionId}`, 'question_action_executed', 'r01', { actionId }),
        'evidence-seed',
      ).state;
    }
    expect(state.viewedEvidenceIds).toEqual(
      expect.arrayContaining([
        'ev-r01-footfall',
        'ev-r01-competition',
        'ev-r01-neighbor-interviews',
        'ev-r01-opening-cost',
      ]),
    );
  });

  it('turns visual tests into auditable diagnostics and carries them into settlement', () => {
    const r08 = v11FullContent.rounds.find((round) => round.roundId === 'r08');
    if (!r08) throw new Error('缺少 r08 测试轮次');
    const content = validateV11Content({
      ...v11FullContent,
      rounds: [{ ...r08, eventIds: [] }],
      events: [],
      achievements: [],
      endings: [],
    });
    let state = createV11State(content.contentVersion, 'visual-diagnostic');
    state = applyV11Action(
      state,
      content,
      action('intro', 'onboarding_completed', undefined, {}),
      'visual-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('select-line', 'visual_selected', 'r08', { visualId: 'v-line' }),
      'visual-seed',
    ).state;

    const tested = applyV11Action(
      state,
      content,
      action('test-line', 'visual_tested', 'r08', {
        visualId: 'v-line',
        testId: 'r08-sign-3-second',
      }),
      'visual-seed',
    );
    state = tested.state;

    expect(tested.trace.visualDiagnostics).toMatchObject([
      {
        roundId: 'r08',
        testId: 'r08-sign-3-second',
        score: 92,
        passed: true,
        metricChanges: { visualAdaptability: 2 },
      },
    ]);
    expect(state.visualState.testResults).toHaveLength(1);
    expect(state.metrics.visualAdaptability).toBe(22);
    expect(state.freeActionPoints).toBe(3);

    state = applyV11Action(
      state,
      content,
      action('commit-line', 'choice_committed', 'r08', {
        choiceId: 'r08-line',
        decisionGroupId: 'dg-r08-line',
      }),
      'visual-seed',
    ).state;
    expect(state.pendingRoundResult?.visualDiagnostics).toMatchObject([
      {
        testId: 'r08-sign-3-second',
        passed: true,
        score: 92,
      },
    ]);

    let weakState = createV11State(content.contentVersion, 'visual-diagnostic-weak');
    weakState = applyV11Action(
      weakState,
      content,
      action('weak-intro', 'onboarding_completed', undefined, {}),
      'visual-seed',
    ).state;
    weakState = applyV11Action(
      weakState,
      content,
      action('select-symbol', 'visual_selected', 'r08', { visualId: 'v-symbol' }),
      'visual-seed',
    ).state;
    const weakTest = applyV11Action(
      weakState,
      content,
      action('test-symbol', 'visual_tested', 'r08', {
        visualId: 'v-symbol',
        testId: 'r08-sign-3-second',
      }),
      'visual-seed',
    );
    expect(weakTest.trace.visualDiagnostics?.[0]).toMatchObject({
      score: 62,
      passed: false,
      metricChanges: { visualAdaptability: -2 },
    });
    expect(weakTest.state.metrics.visualAdaptability).toBe(18);
  });
});
