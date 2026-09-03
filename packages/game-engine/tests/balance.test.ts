import { describe, expect, it } from 'vitest';
import { fullContent } from '@laojie/content-schema/full';
import { deriveNumber, replay, type Action } from '../src/index.js';

describe('full content balance', () => {
  it('produces multiple meaningful endings across varied deterministic paths', () => {
    const counts = new Map<string, number>();
    for (let run = 0; run < 1_000; run += 1) {
      const actions: Action[] = [];
      let sequence = 1;
      for (const [roundIndex, round] of fullContent.rounds.entries()) {
        const evidence = round.evidence[0];
        if (evidence)
          actions.push({
            actionId: `balance-${run}-${sequence++}`,
            type: 'evidence_viewed',
            roundId: round.roundId,
            payload: { evidenceId: evidence.evidenceId },
          });
        if (round.visualRequired) {
          const visual =
            fullContent.visualSystems[
              deriveNumber(
                `balance-${run}`,
                `visual:${roundIndex}`,
                fullContent.visualSystems.length,
              )
            ] ?? fullContent.visualSystems[0]!;
          actions.push({
            actionId: `balance-${run}-${sequence++}`,
            type: 'visual_selected',
            roundId: round.roundId,
            payload: { visualId: visual.visualId },
          });
          for (const visualTest of round.visualTests)
            actions.push({
              actionId: `balance-${run}-${sequence++}`,
              type: 'visual_tested',
              roundId: round.roundId,
              payload: { testId: visualTest.testId },
            });
        }
        const choice =
          round.choices[
            deriveNumber(`balance-${run}`, `choice:${roundIndex}`, round.choices.length)
          ] ?? round.choices[0]!;
        actions.push({
          actionId: `balance-${run}-${sequence++}`,
          type: 'choice_selected',
          roundId: round.roundId,
          payload: { choiceId: choice.choiceId },
        });
      }
      const state = replay(fullContent, `balance-${run}`, `balance-class-${run % 11}`, actions);
      const ending = state.endingId ?? 'unfinished';
      counts.set(ending, (counts.get(ending) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThanOrEqual(5);
    expect([...counts.values()].filter((count) => count >= 30).length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...counts.values())).toBeLessThan(400);
  }, 120_000);
});
