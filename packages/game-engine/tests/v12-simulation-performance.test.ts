import { describe, expect, it } from 'vitest';
import { v11FullContent } from '@laojie/content-schema';
import { applyV11Action, createV11State } from '../src/index.js';

describe('v1.2 simulation-only hash bypass', () => {
  it('does not change the production hash path and keeps the bypass opt-in', () => {
    const state = createV11State(v11FullContent.contentVersion, 'hash-check');
    const action = {
      protocolVersion: '1.1' as const,
      actionId: 'intro',
      type: 'onboarding_completed' as const,
      payload: {},
    };
    expect(applyV11Action(state, v11FullContent, action, 'seed').stateHash).not.toBe('');
    expect(
      applyV11Action(state, v11FullContent, action, 'seed', { skipStateHash: true }).stateHash,
    ).toBe('');
    const mutable = createV11State(v11FullContent.contentVersion, 'mutable-hash-check');
    expect(
      applyV11Action(mutable, v11FullContent, action, 'seed', {
        skipStateHash: true,
        mutateInputState: true,
      }).state,
    ).toBe(mutable);
  });
});
