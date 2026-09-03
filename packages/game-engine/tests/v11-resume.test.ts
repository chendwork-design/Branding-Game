import { describe, expect, it } from 'vitest';
import { createV11State, deriveV11ResumeScreen } from '../src/index.js';

describe('V11 resume state machine', () => {
  it('always prioritizes the next authoritative player obligation', () => {
    const state = createV11State('v1.2.0', 'resume');
    expect(deriveV11ResumeScreen(state, 12, false)).toBe('onboarding');

    state.decisions.push({ actionId: 'onboard', type: 'onboarding_completed', payload: {} });
    expect(deriveV11ResumeScreen(state, 12, false)).toBe('briefing');

    state.pendingRoundResult = {} as NonNullable<typeof state.pendingRoundResult>;
    expect(deriveV11ResumeScreen(state, 12, false)).toBe('round-result');
    state.pendingRoundResult = undefined;
    state.completedRoundIds.push('r02');
    state.roundIndex = 2;
    expect(deriveV11ResumeScreen(state, 12, false)).toBe('chapter-review');
    state.chapterReviews.push('r02');
    expect(deriveV11ResumeScreen(state, 12, false)).toBe('briefing');
    expect(deriveV11ResumeScreen(state, 12, true)).toBe('complete');
  });
});
