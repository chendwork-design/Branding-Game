import { describe, expect, it } from 'vitest';
import { v11SliceContent } from '../src/v11-slice.js';
import { validateV11Content } from '../src/v11.js';

describe('v1.1 vertical slice content', () => {
  it('contains the four planned teaching rounds in order', () => {
    const content = validateV11Content(v11SliceContent);
    expect(content.rounds.map((round) => round.roundId)).toEqual(['r01', 'r03', 'r08', 'r11']);
    expect(content.rounds.every((round) => round.stageActions.length >= 3)).toBe(true);
    expect(content.rounds.every((round) => round.choices.length >= 3)).toBe(true);
  });

  it('makes the visual round a higher-information decision', () => {
    const visualRound = v11SliceContent.rounds.find((round) => round.roundId === 'r08');
    expect(visualRound?.isKeyRound).toBe(true);
    expect(visualRound?.evidence.length).toBeGreaterThanOrEqual(3);
    expect(visualRound?.visualTests.length).toBeGreaterThanOrEqual(3);
    expect(v11SliceContent.visualSystems.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps every choice explainable with immediate and delayed effects', () => {
    for (const round of v11SliceContent.rounds) {
      for (const choice of round.choices) {
        expect(choice.cashCostYuan).toBeGreaterThanOrEqual(0);
        expect(choice.actionPointCost).toBeGreaterThan(0);
        expect(choice.durationDays).toBeGreaterThanOrEqual(0);
        expect(choice.effects.map((effect) => effect.timing)).toEqual(
          expect.arrayContaining(['immediate', 'delayed']),
        );
      }
    }
  });

  it('rejects unknown or dangling Condition DSL references before publication', () => {
    const unknownCondition = {
      ...v11SliceContent,
      achievements: [
        {
          ...v11SliceContent.achievements[0]!,
          conditions: [{ type: 'unknown_condition' }],
        },
      ],
    };
    expect(() => validateV11Content(unknownCondition)).toThrow();

    const danglingCondition = {
      ...v11SliceContent,
      endings: [
        {
          ...v11SliceContent.endings[0]!,
          conditions: [{ type: 'choice_was', choiceId: 'choice-does-not-exist' }],
        },
      ],
    };
    expect(() => validateV11Content(danglingCondition)).toThrow('不存在的条件对象');
  });
});
