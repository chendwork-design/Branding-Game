import { describe, expect, it } from 'vitest';
import { v11SliceContent } from '@laojie/content-schema';
import { simulateV11 } from '../src/index.js';

describe('v1.1 deterministic balance simulation', () => {
  it(
    'runs 10,000 slice paths without a dominant choice or cash deadlock',
    { timeout: 120_000 },
    () => {
      const report = simulateV11(v11SliceContent, 10_000);
      expect(report.completedRuns).toBe(10_000);
      expect(report.minimumFinalCashYuan).toBeGreaterThan(0);
      expect(Math.max(...Object.values(report.choiceShares))).toBeLessThan(0.6);
      expect(report.distinctRouteIds).toBeGreaterThanOrEqual(2);
    },
  );
});
