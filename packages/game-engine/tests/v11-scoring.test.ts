import { describe, expect, it } from 'vitest';
import { v11SliceContent } from '@laojie/content-schema';
import {
  applyV11Action,
  createV11State,
  deriveV11RouteProfile,
  scoreV11State,
  type V11Action,
  type V11GameState,
} from '../src/index.js';

function action(
  actionId: string,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown>,
): V11Action {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

describe('v1.1 multi-round score and visual route matching', () => {
  it('keeps the overall level separate from the route profile', () => {
    const state = createV11State(v11SliceContent.contentVersion, 'score-fixture');
    const score = scoreV11State(state, v11SliceContent);
    expect(score.overall).toBeGreaterThan(0);
    expect(['barely_alive', 'formed_brand', 'sustainable', 'benchmark']).toContain(score.level);
    const route = deriveV11RouteProfile(state, v11SliceContent);
    expect(route.contributingRounds).toEqual([]);
    expect(route.routeId).toBeTruthy();
  });

  it('does not let one choice alone define a multi-round route', () => {
    const state = createV11State(v11SliceContent.contentVersion, 'route-fixture');
    const oneChoice: V11GameState = {
      ...state,
      decisions: [
        {
          actionId: 'choice',
          type: 'choice_committed',
          roundId: 'r01',
          payload: { choiceId: 'r01-tourist' },
        },
      ],
    };
    const route = deriveV11RouteProfile(oneChoice, v11SliceContent);
    expect(route.contributingRounds).toEqual(['r01']);
    expect(route.confidence).toBeLessThan(70);
  });

  it('matches the same visual system differently when the accumulated route changes', () => {
    const base = createV11State(v11SliceContent.contentVersion, 'visual-route');
    const customerRoute = {
      ...base,
      metrics: { ...base.metrics, segmentFit: 90, culturalCredibility: 80, visualAdaptability: 30 },
    };
    const deliveryRoute = {
      ...base,
      metrics: {
        ...base.metrics,
        segmentFit: 35,
        culturalCredibility: 35,
        visualAdaptability: 90,
        productDelivery: 85,
      },
    };
    const visual = v11SliceContent.visualSystems.find((item) => item.visualId === 'v-line')!;
    const customerScore = scoreV11State(customerRoute, v11SliceContent, visual).visualMatchScore;
    const deliveryScore = scoreV11State(deliveryRoute, v11SliceContent, visual).visualMatchScore;
    expect(customerScore).not.toBe(deliveryScore);
  });

  it('writes the final score, route and eligible ending only after the last result is acknowledged', () => {
    let state = createV11State(v11SliceContent.contentVersion, 'final-score-fixture');
    const actions: V11Action[] = [
      action('f0', 'onboarding_completed', undefined, {}),
      action('f1', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      action('f2', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
      action('f3', 'choice_committed', 'r03', {
        choiceId: 'r03-stable',
        decisionGroupId: 'dg-r03',
      }),
      action('f4', 'round_result_acknowledged', 'r03', { resultId: 'result-r03' }),
      action('f5', 'visual_selected', 'r08', { visualId: 'v-line' }),
      action('f6', 'choice_committed', 'r08', { choiceId: 'r08-line', decisionGroupId: 'dg-r08' }),
      action('f7', 'round_result_acknowledged', 'r08', { resultId: 'result-r08' }),
      action('f8', 'choice_committed', 'r11', {
        choiceId: 'r11-steady',
        decisionGroupId: 'dg-r11',
      }),
      action('f9', 'round_result_acknowledged', 'r11', { resultId: 'result-r11' }),
    ];
    for (const current of actions)
      state = applyV11Action(state, v11SliceContent, current, 'final-score-seed').state;
    expect(state.scoreBreakdown?.overall).toBeGreaterThan(0);
    expect(state.routeProfile?.contributingRounds).toEqual(['r01', 'r03', 'r08', 'r11']);
    expect(state.ending).toBeTruthy();
  });
});
