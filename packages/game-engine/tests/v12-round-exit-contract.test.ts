import { describe, expect, it } from 'vitest';
import { v11FullContent, type GameContentV11 } from '@laojie/content-schema';
import { applyV11Action, createV11State, type V11Action } from '../src/index.js';

function action(
  actionId: string,
  type: V11Action['type'],
  roundId?: string,
  payload: Record<string, unknown> = {},
): V11Action {
  return {
    protocolVersion: '1.2',
    actionId,
    type,
    ...(roundId ? { roundId } : {}),
    payload,
  };
}

function oneRoundContent(roundIndex: number): GameContentV11 {
  return { ...v11FullContent, rounds: [v11FullContent.rounds[roundIndex]!] };
}

function readyState(content: GameContentV11, seed: string, visualId = 'v-line') {
  let state = createV11State(content.contentVersion, `exit-${seed}`);
  state = applyV11Action(
    state,
    content,
    action(`${seed}-onboarding`, 'onboarding_completed'),
    `${seed}-engine`,
  ).state;
  const round = content.rounds[0]!;
  if (round.visualRequired) {
    state = applyV11Action(
      state,
      content,
      action(`${seed}-visual`, 'visual_selected', round.roundId, { visualId }),
      `${seed}-engine`,
    ).state;
  }
  return state;
}

describe('v1.2 round-exit contract', () => {
  it('creates an acknowledgeable result for every strategic choice in every round', () => {
    for (const [roundIndex, sourceRound] of v11FullContent.rounds.entries()) {
      const content = oneRoundContent(roundIndex);
      const round = content.rounds[0]!;
      for (const choice of sourceRound.choices) {
        const seed = `${round.roundId}-${choice.choiceId}`;
        let state = readyState(content, seed, choice.visualRouteId ?? 'v-line');
        state = applyV11Action(
          state,
          content,
          action(`${seed}-commit`, 'choice_committed', round.roundId, {
            choiceId: choice.choiceId,
            decisionGroupId: `dg-${round.roundId}`,
          }),
          `${seed}-engine`,
        ).state;
        expect(state.pendingRoundResult?.roundId, `${round.roundId}/${choice.choiceId}`).toBe(
          round.roundId,
        );
        expect(state.pendingRoundResult?.choiceId, `${round.roundId}/${choice.choiceId}`).toBe(
          choice.choiceId,
        );
        if (choice.visualRouteId)
          expect(state.visualState.selectedVisualId, `${round.roundId}/${choice.choiceId}`).toBe(
            choice.visualRouteId,
          );

        state = applyV11Action(
          state,
          content,
          action(`${seed}-ack`, 'round_result_acknowledged', round.roundId, {
            resultId: `result-${round.roundId}`,
          }),
          `${seed}-engine`,
        ).state;
        expect(state.pendingRoundResult, `${round.roundId}/${choice.choiceId}`).toBeUndefined();
        expect(state.roundIndex, `${round.roundId}/${choice.choiceId}`).toBe(1);
      }
    }
  });

  it('blocks a visual strategy when it does not match the route selected in the visual check', () => {
    const r08Index = v11FullContent.rounds.findIndex((round) => round.roundId === 'r08');
    const content = oneRoundContent(r08Index);
    const state = readyState(content, 'r08-route-mismatch', 'v-symbol');
    expect(() =>
      applyV11Action(
        state,
        content,
        action('r08-route-mismatch-commit', 'choice_committed', 'r08', {
          choiceId: 'r08-line',
          decisionGroupId: 'dg-r08-route-mismatch',
        }),
        'r08-route-mismatch-engine',
      ),
    ).toThrow('视觉策略和当前选中的视觉路线不一致');
  });

  it('creates an acknowledgeable result for every round that explicitly permits skipping', () => {
    for (const [roundIndex, sourceRound] of v11FullContent.rounds.entries()) {
      if (sourceRound.skipPolicy !== 'allowed') continue;
      const content = oneRoundContent(roundIndex);
      const round = content.rounds[0]!;
      const seed = `${round.roundId}-skip`;
      let state = readyState(content, seed);
      state = applyV11Action(
        state,
        content,
        action(`${seed}-commit`, 'choice_skipped', round.roundId, { reason: '本轮维持现状' }),
        `${seed}-engine`,
      ).state;
      expect(state.pendingRoundResult?.roundId, round.roundId).toBe(round.roundId);
      expect(state.pendingRoundResult?.resultType, round.roundId).toBe('skip');

      state = applyV11Action(
        state,
        content,
        action(`${seed}-ack`, 'round_result_acknowledged', round.roundId, {
          resultId: `result-${round.roundId}`,
        }),
        `${seed}-engine`,
      ).state;
      expect(state.pendingRoundResult, round.roundId).toBeUndefined();
      expect(state.roundIndex, round.roundId).toBe(1);
    }
  });
});
