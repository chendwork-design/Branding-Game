import { fullContent } from '@laojie/content-schema/full';
import { deriveNumber, replay, type Action } from './index.js';

const SIMULATION_RUNS = 50_000;
const endings = new Map<string, number>();
for (let run = 0; run < SIMULATION_RUNS; run += 1) {
  const actions: Action[] = [];
  let sequence = 1;
  for (let index = 0; index < fullContent.rounds.length; index += 1) {
    const round = fullContent.rounds[index]!;
    if (round.visualRequired) {
      const visual =
        fullContent.visualSystems[
          deriveNumber(
            `simulation-visual-${run}`,
            `round:${index}`,
            fullContent.visualSystems.length,
          )
        ] ?? fullContent.visualSystems[0]!;
      actions.push({
        actionId: `sim-${run}-${sequence++}`,
        type: 'visual_selected',
        roundId: round.roundId,
        payload: { visualId: visual.visualId },
      });
      for (const test of round.visualTests)
        actions.push({
          actionId: `sim-${run}-${sequence++}`,
          type: 'visual_tested',
          roundId: round.roundId,
          payload: { testId: test.testId },
        });
    }
    const choice =
      round.choices[
        deriveNumber(`simulation-choice-${run}`, `round:${index}`, round.choices.length)
      ] ?? round.choices[0]!;
    actions.push({
      actionId: `sim-${run}-${sequence++}`,
      type: 'choice_selected',
      roundId: round.roundId,
      payload: { choiceId: choice.choiceId },
    });
  }
  const result = replay(fullContent, `simulation-${run}`, `class-seed-${run % 7}`, actions);
  const ending = result.endingId ?? 'unfinished';
  endings.set(ending, (endings.get(ending) ?? 0) + 1);
}

console.log(
  JSON.stringify({ runs: SIMULATION_RUNS, endings: Object.fromEntries(endings) }, null, 2),
);
