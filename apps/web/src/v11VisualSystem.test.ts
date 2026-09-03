import { describe, expect, it } from 'vitest';
import {
  V11_CORE_VISUAL_ROUTES,
  coreVisualRouteLabel,
  isCoreVisualRoute,
} from './v11VisualSystem.js';

describe('r08 visual system contract', () => {
  it('keeps exactly three comparable routes', () => {
    expect(V11_CORE_VISUAL_ROUTES).toEqual(['v-line', 'v-symbol', 'v-hand']);
    expect(new Set(V11_CORE_VISUAL_ROUTES).size).toBe(3);
  });

  it('does not revive retired reference-driven visual routes', () => {
    expect(isCoreVisualRoute('v-line')).toBe(true);
    expect(isCoreVisualRoute('v-symbol')).toBe(true);
    expect(isCoreVisualRoute('v-hand')).toBe(true);
    expect(isCoreVisualRoute('v-seal')).toBe(false);
    expect(coreVisualRouteLabel('v-symbol')).toBe('杯影符号系统');
  });
});
