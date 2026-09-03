import { describe, expect, it } from 'vitest';
import { v11SliceContent } from '@laojie/content-schema';
import {
  applyV11Action,
  createV11State,
  hashV11State,
  replayV11,
  type V11Action,
} from '../src/index.js';

const action = (
  n: number,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown> = {},
): V11Action => ({
  protocolVersion: '1.1',
  actionId: `v11-a-${n}`,
  type,
  ...(roundId ? { roundId } : {}),
  payload,
});

const rounds = v11SliceContent.rounds;

function sliceActions(): V11Action[] {
  const actions: V11Action[] = [action(1, 'onboarding_completed', undefined)];
  let n = 2;
  for (const round of rounds) {
    const evidence = round.evidence[0]!;
    const stageAction =
      round.stageActions.find((item) => item.revealsEvidenceIds?.includes(evidence.evidenceId)) ??
      round.stageActions[0]!;
    const choice = round.choices[0]!;
    const riskPlan = round.riskPlans[0];
    actions.push(
      action(n++, 'stage_action_selected', round.roundId, { actionId: stageAction.actionId }),
      action(n++, 'evidence_viewed', round.roundId, { evidenceId: evidence.evidenceId }),
      action(n++, 'choice_previewed', round.roundId, { choiceId: choice.choiceId }),
    );
    if (round.roundId === 'r08') {
      actions.push(
        action(n++, 'visual_selected', round.roundId, { visualId: 'v-line' }),
        action(n++, 'visual_tested', round.roundId, {
          testId: round.visualTests[0]!.testId,
          visualId: 'v-line',
        }),
      );
    }
    if (riskPlan && round.roundId !== 'r08' && round.roundId !== 'r11')
      actions.push(
        action(n++, 'risk_plan_selected', round.roundId, { riskPlanId: riskPlan.riskPlanId }),
      );
    actions.push(
      action(n++, 'choice_committed', round.roundId, {
        choiceId: choice.choiceId,
        ...(riskPlan ? { riskPlanId: riskPlan.riskPlanId } : {}),
        decisionGroupId: `dg-${round.roundId}`,
        predictionId: `prediction-${round.roundId}`,
      }),
      action(n++, 'round_result_acknowledged', round.roundId, {
        resultId: `result-${round.roundId}`,
      }),
    );
  }
  return actions;
}

describe('v1.1 vertical slice runtime', () => {
  it('runs R01, R03, R08 and R11 with a result checkpoint after each decision', () => {
    const actions = sliceActions();
    let state = createV11State(v11SliceContent.contentVersion, 'v11-slice');
    for (const currentAction of actions) {
      const result = applyV11Action(state, v11SliceContent, currentAction, 'slice-seed');
      state = result.state;
      if (currentAction.type === 'choice_committed') {
        expect(state.pendingRoundResult?.roundId).toBe(currentAction.roundId);
        expect(
          result.trace.immediateEffects.length + result.trace.scheduledEffects.length,
        ).toBeGreaterThan(0);
      }
      if (currentAction.type === 'round_result_acknowledged')
        expect(state.pendingRoundResult).toBeUndefined();
    }
    expect(state.completedRoundIds).toEqual(['r01', 'r03', 'r08', 'r11']);
    expect(state.roundIndex).toBe(4);
    expect(state.cashYuan).toBeLessThan(500000);
    expect(state.financialLedger.length).toBeGreaterThan(0);
    expect(state.visualState.selectedVisualId).toBe('v-line');
  });

  it('does not settle previews and blocks actions until the result is acknowledged', () => {
    const state = createV11State(v11SliceContent.contentVersion, 'v11-preview');
    const preview = applyV11Action(
      state,
      v11SliceContent,
      action(1, 'choice_previewed', 'r01', { choiceId: rounds[0]!.choices[0]!.choiceId }),
      'seed',
    );
    expect(preview.state.cashYuan).toBe(state.cashYuan);
    expect(preview.state.stageActionPoints).toBe(state.stageActionPoints);

    const committed = applyV11Action(
      state,
      v11SliceContent,
      action(2, 'choice_committed', 'r01', {
        choiceId: rounds[0]!.choices[0]!.choiceId,
        decisionGroupId: 'dg-r01',
      }),
      'seed',
    );
    expect(() =>
      applyV11Action(
        committed.state,
        v11SliceContent,
        action(3, 'choice_committed', 'r01', { choiceId: rounds[0]!.choices[1]!.choiceId }),
        'seed',
      ),
    ).toThrow('请先确认本轮结果');
  });

  it('replays the same vertical slice to the same state hash', () => {
    const first = replayV11(v11SliceContent, 'v11-replay', 'slice-seed', sliceActions());
    const second = replayV11(v11SliceContent, 'v11-replay', 'slice-seed', sliceActions());
    expect(hashV11State(first)).toBe(hashV11State(second));
  });
});
