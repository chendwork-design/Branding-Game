import { describe, expect, it } from 'vitest';
import { sampleContent } from '@laojie/content-schema/sample';
import { replay, type Action } from '@laojie/game-engine';
import { buildReport } from '../src/index.js';

const actions: Action[] = [
  {
    actionId: 'r1-choice',
    type: 'choice_selected',
    roundId: 'r01',
    payload: { choiceId: 'r01-local' },
  },
  {
    actionId: 'r5-choice',
    type: 'choice_selected',
    roundId: 'r05',
    payload: { choiceId: 'r05-simplify' },
  },
  {
    actionId: 'visual',
    type: 'visual_selected',
    roundId: 'r08',
    payload: { visualId: 'v-system' },
  },
  {
    actionId: 'visual-test',
    type: 'visual_tested',
    roundId: 'r08',
    payload: { testId: 'sign_3_second' },
  },
  {
    actionId: 'r8-choice',
    type: 'choice_selected',
    roundId: 'r08',
    payload: { choiceId: 'r08-system' },
  },
  {
    actionId: 'r11-choice',
    type: 'choice_selected',
    roundId: 'r11',
    payload: { choiceId: 'r11-steady' },
  },
];

describe('causal report', () => {
  it('explains actual decisions, delayed effects, theory and transfer', () => {
    const state = replay(sampleContent, 'report-playthrough', 'seed', actions);
    const report = buildReport(state, sampleContent);

    expect(report.path).toHaveLength(4);
    expect(report.causalExplanations).toHaveLength(4);
    expect(report.theoryMapping.map((theory) => theory.theoryId)).toEqual(
      expect.arrayContaining(['t-segment', 't-promise', 't-identity', 't-growth']),
    );
    expect(report.assignmentTransfer.length).toBeGreaterThan(0);
    expect(report.expectedVsActual[0]?.actual).toContain('排长队');
    expect(report.visualDiagnosis).toHaveLength(1);
    expect(report.stakeholderNetwork).toHaveLength(3);
  });
});
