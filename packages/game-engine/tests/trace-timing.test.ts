import { describe, expect, it } from 'vitest';
import { sampleContent } from '@laojie/content-schema/sample';
import { applyAction, createInitialState, type Action } from '../src/index.js';

const choiceAction = (actionId: string, roundId: string, choiceId: string): Action => ({
  actionId,
  type: 'choice_selected',
  roundId,
  payload: { choiceId },
});

describe('effect timing trace', () => {
  it('separates newly scheduled delayed effects from delayed effects arriving this round', () => {
    const first = applyAction(
      createInitialState(sampleContent, 'timing-playthrough'),
      sampleContent,
      choiceAction('choice-r01', 'r01', 'r01-local'),
      'timing-seed',
    );

    expect(first.trace.scheduledDelayedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceDecisionId: 'choice-r01', timing: 'delayed' }),
      ]),
    );
    expect(first.trace.settledDelayedEffects).toEqual([]);

    const second = applyAction(
      first.state,
      sampleContent,
      choiceAction('choice-r05', 'r05', 'r05-simplify'),
      'timing-seed',
    );

    expect(second.trace.settledDelayedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceDecisionId: 'choice-r01', timing: 'delayed' }),
      ]),
    );
    expect(second.trace.scheduledDelayedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceDecisionId: 'choice-r05', timing: 'delayed' }),
      ]),
    );
  });
});
