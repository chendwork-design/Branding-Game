import { describe, expect, it } from 'vitest';
import { ActionInput, VisibleMetrics } from '../src/index.js';

describe('shared contracts', () => {
  it('accepts a bounded visible state', () => {
    expect(
      VisibleMetrics.parse({
        cash: 80,
        awareness: 0,
        conversion: 20,
        trust: 50,
        loyalty: 5,
        actionPoints: 100,
      }),
    ).toMatchObject({ cash: 80 });
  });

  it('rejects unbounded metrics and malformed round ids', () => {
    expect(() => VisibleMetrics.parse({ cash: 101 })).toThrow();
    expect(() =>
      ActionInput.parse({
        type: 'choice_selected',
        roundId: 'round-1',
        payload: {},
      }),
    ).toThrow();
  });
});
