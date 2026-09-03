import { describe, expect, it } from 'vitest';
import { sampleContent } from '@laojie/content-schema/sample';
import { fullContent } from '@laojie/content-schema/full';
import {
  applyAction,
  createInitialState,
  deriveNumber,
  hashState,
  replay,
  type Action,
} from '../src/index.js';

const action = (
  n: number,
  type: Action['type'],
  roundId: string,
  payload: Action['payload'],
): Action => ({
  actionId: `a-${n}`,
  type,
  roundId,
  payload,
});

function sliceActions(
  choiceIds: string[] = ['r01-tourist', 'r05-promise', 'r08-system', 'r11-grow'],
): Action[] {
  const actions: Action[] = [];
  let n = 1;
  for (const round of sampleContent.rounds) {
    const evidence = round.evidence[0];
    if (evidence)
      actions.push(
        action(n++, 'evidence_viewed', round.roundId, { evidenceId: evidence.evidenceId }),
      );
    if (round.visualRequired) {
      actions.push(action(n++, 'visual_selected', round.roundId, { visualId: 'v-system' }));
      for (const test of round.visualTests)
        actions.push(action(n++, 'visual_tested', round.roundId, { testId: test.testId }));
    }
    actions.push(
      action(n++, 'choice_previewed', round.roundId, {
        choiceId: choiceIds[actions.length % choiceIds.length] ?? choiceIds[0] ?? '',
      }),
    );
    actions.push(action(n++, 'intent_selected', round.roundId, { intent: 'growth' }));
    actions.push(action(n++, 'risk_selected', round.roundId, { risk: 'trust' }));
    const choiceIndex =
      round === sampleContent.rounds[0]
        ? 0
        : round === sampleContent.rounds[1]
          ? 1
          : round === sampleContent.rounds[2]
            ? 2
            : 3;
    actions.push(
      action(n++, 'choice_selected', round.roundId, {
        choiceId: choiceIds[choiceIndex] ?? choiceIds[0] ?? '',
      }),
    );
  }
  return actions;
}

describe('deterministic game engine', () => {
  it('derives the same keyed random value for the same seed', () => {
    expect(deriveNumber('class-seed', 'event:e-r01-rain')).toBe(
      deriveNumber('class-seed', 'event:e-r01-rain'),
    );
    expect(deriveNumber('class-seed-a', 'event:e-r01-rain')).not.toBe(
      deriveNumber('class-seed-b', 'event:e-r01-rain'),
    );
  });

  it('runs the vertical slice with visual tests and delayed effects', () => {
    const finalState = replay(sampleContent, 'playthrough-1', 'class-seed', sliceActions());
    expect(finalState.completedRoundIds).toEqual(['r01', 'r05', 'r08', 'r11']);
    expect(finalState.visualTestResults).toHaveLength(4);
    expect(finalState.traces.some((trace) => trace.delayedEffects.length > 0)).toBe(true);
    expect(finalState.endingId).toBeDefined();
    expect(finalState.unlockedConceptIds).toContain('c-visual');
  });

  it('replays to the same snapshot hash and detects a changed choice', () => {
    const actions = sliceActions();
    const first = replay(sampleContent, 'playthrough-1', 'class-seed', actions);
    const second = replay(sampleContent, 'playthrough-1', 'class-seed', actions);
    const changed = replay(
      sampleContent,
      'playthrough-1',
      'class-seed',
      sliceActions(['r01-local', 'r05-simplify', 'r08-system', 'r11-steady']),
    );
    expect(hashState(first)).toBe(hashState(second));
    expect(hashState(first)).not.toBe(hashState(changed));
  });

  it('rejects a choice from the wrong round and a visual test before selection', () => {
    const initial = createInitialState(sampleContent, 'playthrough-1');
    expect(() =>
      applyAction(
        initial,
        sampleContent,
        action(1, 'choice_selected', 'r05', { choiceId: 'r05-simplify' }),
        'seed',
      ),
    ).toThrow('动作轮次错误');
    expect(() =>
      applyAction(
        initial,
        sampleContent,
        action(1, 'visual_tested', 'r01', { testId: 'sign_3_second' }),
        'seed',
      ),
    ).toThrow('当前轮次不存在视觉测试');
  });

  it('keeps production action hashes while allowing pure replay to skip them', () => {
    const initial = createInitialState(sampleContent, 'playthrough-hash');
    const first = applyAction(
      initial,
      sampleContent,
      action(1, 'choice_selected', 'r01', { choiceId: 'r01-tourist' }),
      'seed',
    );
    const replayed = applyAction(
      initial,
      sampleContent,
      action(1, 'choice_selected', 'r01', { choiceId: 'r01-tourist' }),
      'seed',
      { skipStateHash: true },
    );
    expect(first.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(replayed.stateHash).toBe('');
    expect(hashState(first.state)).toBe(hashState(replayed.state));
  });

  it('runs every full-content round and keeps the simulation path deterministic', () => {
    const actions: Action[] = [];
    let n = 1;
    for (const round of fullContent.rounds) {
      const firstEvidence = round.evidence[0];
      if (firstEvidence)
        actions.push(
          action(n++, 'evidence_viewed', round.roundId, { evidenceId: firstEvidence.evidenceId }),
        );
      if (round.visualRequired) {
        actions.push(action(n++, 'visual_selected', round.roundId, { visualId: 'v-modern' }));
        for (const test of round.visualTests)
          actions.push(action(n++, 'visual_tested', round.roundId, { testId: test.testId }));
      }
      const firstChoice = round.choices[0]!;
      actions.push(
        action(n++, 'choice_selected', round.roundId, { choiceId: firstChoice.choiceId }),
      );
    }
    const first = replay(fullContent, 'full-playthrough', 'full-seed', actions);
    const second = replay(fullContent, 'full-playthrough', 'full-seed', actions);
    expect(first.completedRoundIds).toHaveLength(12);
    expect(first.visualTestResults).toHaveLength(4);
    expect(hashState(first)).toBe(hashState(second));
  });
});
