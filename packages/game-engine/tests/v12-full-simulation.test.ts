import { describe, expect, it } from 'vitest';
import { v11FullContent } from '@laojie/content-schema';
import { simulateV11, simulateV11Strategies } from '../src/index.js';

describe('v1.2 full-course balance release gate', () => {
  it(
    'finishes 50,000 deterministic full-course paths without a cash deadlock or dominant choice',
    { timeout: 240_000 },
    () => {
      const report = simulateV11(v11FullContent, 50_000);
      expect(report.completedRuns).toBe(50_000);
      expect(report.minimumFinalCashYuan).toBeGreaterThan(0);
      // Choices are sampled from the options the shop can actually afford on
      // that path. A small tolerance above the ideal 20% keeps this gate about
      // dominant strategies rather than pretending resource constraints do not
      // exist; 22% is still close to an even five-way split.
      expect(Math.max(...Object.values(report.choiceShares))).toBeLessThanOrEqual(0.22);
      expect(report.distinctRouteIds).toBeGreaterThanOrEqual(2);
      expect(report.distinctEndingIds).toBeGreaterThanOrEqual(10);
    },
  );

  it(
    'runs the six deterministic player-value strategies through legal exits',
    { timeout: 120_000 },
    () => {
      const report = simulateV11Strategies(v11FullContent, 120);
      expect(report.completedRuns).toBe(720);
      expect(report.deadlockedRuns).toBe(0);
      expect(
        Object.values(report.strategies).every((strategy) => strategy.invalidActionRuns === 0),
      ).toBe(true);
      expect(
        Object.values(report.strategies).every((strategy) => strategy.incomeRuns === 120),
      ).toBe(true);
      expect(report.distinctRouteIds).toBeGreaterThanOrEqual(3);
      // Strategy agents intentionally pursue different values, so this gate
      // checks that their union reaches multiple real endings; the broader
      // 50,000-path distribution gate above covers content-wide ending reach.
      expect(report.distinctEndingIds).toBeGreaterThanOrEqual(3);
      expect(report.strategies['skip-when-stretched']?.skippedRounds).toBeGreaterThan(0);
      expect(
        new Set(
          Object.values(report.strategies).map((strategy) => strategy.actionSequenceFingerprint),
        ).size,
      ).toBeGreaterThanOrEqual(3);

      const repeat = simulateV11Strategies(v11FullContent, 120);
      for (const strategy of Object.keys(report.strategies) as Array<
        keyof typeof report.strategies
      >) {
        expect(repeat.strategies[strategy]?.actionSequenceFingerprint).toBe(
          report.strategies[strategy]?.actionSequenceFingerprint,
        );
        expect(repeat.strategies[strategy]?.finalStateFingerprint).toBe(
          report.strategies[strategy]?.finalStateFingerprint,
        );
      }
    },
  );
});
