import { describe, expect, it } from 'vitest';
import { canAddVisualComparison, toggleVisualComparison } from './v11VisualCompare.js';

describe('visual comparison tray', () => {
  it('lets a player compare up to three systems without changing the selected system', () => {
    const first = toggleVisualComparison([], 'v-line');
    const second = toggleVisualComparison(first, 'v-symbol');
    const third = toggleVisualComparison(second, 'v-hand');

    expect(third).toEqual(['v-line', 'v-symbol', 'v-hand']);
    expect(canAddVisualComparison(third, 'v-grid')).toBe(false);
    expect(toggleVisualComparison(third, 'v-grid')).toEqual(third);
  });

  it('removes a compared system and makes a slot available again', () => {
    const current = ['v-line', 'v-symbol', 'v-hand'];
    expect(toggleVisualComparison(current, 'v-symbol')).toEqual(['v-line', 'v-hand']);
    expect(canAddVisualComparison(['v-line', 'v-hand'], 'v-grid')).toBe(true);
  });
});
