import { describe, expect, it } from 'vitest';
import { sampleContent } from '../src/sample.js';
import { validateContent } from '../src/index.js';

describe('content contract integrity', () => {
  it('rejects duplicate choice ids across rounds', () => {
    const firstRound = sampleContent.rounds[0];
    const secondRound = sampleContent.rounds[1];
    const firstChoice = firstRound?.choices[0];
    const secondChoice = secondRound?.choices[0];
    if (!firstRound || !secondRound || !firstChoice || !secondChoice)
      throw new Error('测试内容不完整');

    expect(() =>
      validateContent({
        ...sampleContent,
        rounds: [
          firstRound,
          {
            ...secondRound,
            choices: [
              { ...secondChoice, choiceId: firstChoice.choiceId },
              ...secondRound.choices.slice(1),
            ],
          },
          ...sampleContent.rounds.slice(2),
        ],
      }),
    ).toThrow('重复的选择 ID');
  });

  it('rejects effect and visual-test theory references that do not exist', () => {
    const firstRound = sampleContent.rounds[0];
    const firstChoice = firstRound?.choices[0];
    if (!firstRound || !firstChoice) throw new Error('测试内容不完整');

    expect(() =>
      validateContent({
        ...sampleContent,
        rounds: [
          {
            ...firstRound,
            choices: [
              {
                ...firstChoice,
                effects: [
                  { ...firstChoice.effects[0]!, theoryId: 'missing-theory' },
                  ...firstChoice.effects.slice(1),
                ],
              },
              ...firstRound.choices.slice(1),
            ],
          },
          ...sampleContent.rounds.slice(1),
        ],
      }),
    ).toThrow('不存在的理论');
  });

  it('requires every choice to expose both an immediate and a delayed consequence', () => {
    const firstRound = sampleContent.rounds[0];
    const firstChoice = firstRound?.choices[0];
    if (!firstRound || !firstChoice) throw new Error('测试内容不完整');

    expect(() =>
      validateContent({
        ...sampleContent,
        rounds: [
          {
            ...firstRound,
            choices: [
              {
                ...firstChoice,
                effects: firstChoice.effects.map((effect) => ({
                  ...effect,
                  timing: 'immediate' as const,
                })),
              },
              ...firstRound.choices.slice(1),
            ],
          },
          ...sampleContent.rounds.slice(1),
        ],
      }),
    ).toThrow('即时效果和延迟效果');
  });
});
