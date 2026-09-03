import { describe, expect, it } from 'vitest';
import { v11FullContent } from '@laojie/content-schema';
import { applyV11Action, createV11State, type V11Action } from '../src/index.js';

function action(
  actionId: string,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown>,
): V11Action {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

describe('v1.1 state-conditioned event content', () => {
  it('triggers the event attached to the chosen path and carries its source/effects', () => {
    let state = createV11State(v11FullContent.contentVersion, 'event-neighbor');
    state = applyV11Action(
      state,
      v11FullContent,
      action('e0', 'onboarding_completed', undefined, {}),
      'event-seed',
    ).state;
    const result = applyV11Action(
      state,
      v11FullContent,
      action('e1', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'event-seed',
    );
    expect(result.trace.triggeredEvents).toHaveLength(1);
    expect(result.trace.triggeredEvents[0]?.eventId).toBe('event-r01-neighbor');
    expect(
      result.state.pendingEffects.some(
        (effect) => effect.sourceRoundId === 'r01' && effect.key === 'loyalty',
      ),
    ).toBe(true);
    expect(result.trace.result?.causeSources).toContain('r01-neighbor');
  });

  it('does not apply a sibling choice event when its condition is false', () => {
    let state = createV11State(v11FullContent.contentVersion, 'event-tourist');
    state = applyV11Action(
      state,
      v11FullContent,
      action('t0', 'onboarding_completed', undefined, {}),
      'event-seed',
    ).state;
    const result = applyV11Action(
      state,
      v11FullContent,
      action('t1', 'choice_committed', 'r01', {
        choiceId: 'r01-tourist',
        decisionGroupId: 'dg-r01',
      }),
      'event-seed',
    );
    expect(result.trace.triggeredEvents.map((event) => event.eventId)).toEqual([
      'event-r01-tourist',
    ]);
    expect(result.state.metrics.loyalty).toBe(5);
  });
});
