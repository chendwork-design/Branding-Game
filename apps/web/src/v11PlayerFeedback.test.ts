import { describe, expect, it } from 'vitest';
import { v11FullContent } from '@laojie/content-schema';
import type { V11Action } from '@laojie/game-engine';
import { v11PlayerFeedback } from './v11PlayerFeedback.js';

function action(
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown> = {},
): V11Action {
  return {
    protocolVersion: '1.1',
    actionId: `feedback-${type}`,
    type,
    ...(roundId ? { roundId } : {}),
    payload,
  };
}

describe('v1.2 player feedback', () => {
  it('does not repeat an in-page action result as a generic toast', () => {
    const message = v11PlayerFeedback(
      v11FullContent,
      action('visual_tested', 'r08', { testId: 'r08-sign-3-second' }),
    );
    expect(message).toBeUndefined();
    expect(
      v11PlayerFeedback(
        v11FullContent,
        action('stage_action_selected', 'r01', { actionId: 'r01-observe' }),
      ),
    ).toBeUndefined();
  });

  it('does not interrupt a player merely for previewing a choice', () => {
    expect(
      v11PlayerFeedback(
        v11FullContent,
        action('choice_previewed', 'r01', { choiceId: 'r01-neighbor' }),
      ),
    ).toBeUndefined();
  });

  it('does not show a redundant toast after evidence is already expanded in place', () => {
    expect(
      v11PlayerFeedback(
        v11FullContent,
        action('evidence_viewed', 'r01', { evidenceId: 'ev-r01-footfall' }),
      ),
    ).toBeUndefined();
  });

  it('does not show an empty concept or choice-completion toast over the next screen', () => {
    expect(
      v11PlayerFeedback(
        v11FullContent,
        action('terms_introduced', 'r05', { termIds: ['t-identity'] }),
      ),
    ).toBeUndefined();
    expect(
      v11PlayerFeedback(
        v11FullContent,
        action('choice_committed', 'r01', { choiceId: 'r01-neighbor' }),
      ),
    ).toBeUndefined();
  });
});
