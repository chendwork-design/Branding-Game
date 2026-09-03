import { describe, expect, it } from 'vitest';
import { CONTENT_SCHEMA_VERSION, validateContent } from '../src/index.js';
import { sampleContent } from '../src/sample.js';
import { fullContent } from '../src/full.js';

describe('content schema package', () => {
  it('has a versioned contract entry point', () => {
    expect(CONTENT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('validates the four-round vertical slice and all references', () => {
    expect(validateContent(sampleContent).rounds.map((round) => round.roundId)).toEqual([
      'r01',
      'r05',
      'r08',
      'r11',
    ]);
    expect(sampleContent.rounds.find((round) => round.roundId === 'r08')?.visualTests).toHaveLength(
      4,
    );
  });

  it('rejects dangling theory references', () => {
    expect(() =>
      validateContent({
        ...sampleContent,
        rounds: [{ ...sampleContent.rounds[0], theoryIds: ['missing'] }],
      }),
    ).toThrow('不存在的理论');
  });

  it('ships the complete twelve-round course content contract', () => {
    expect(fullContent.contentVersion).toBe('v1.0.0');
    expect(fullContent.rounds).toHaveLength(12);
    expect(fullContent.rounds.flatMap((round) => round.choices)).toHaveLength(60);
    expect(fullContent.events.length).toBeGreaterThanOrEqual(30);
    expect(fullContent.events.length).toBeLessThanOrEqual(40);
    expect(fullContent.visualSystems.length).toBeGreaterThanOrEqual(6);
    expect(fullContent.endings.length).toBeGreaterThanOrEqual(15);
    expect(fullContent.conceptCards.length).toBeGreaterThanOrEqual(15);
    expect(fullContent.characters).toHaveLength(9);
    expect(fullContent.discussionTopics).toHaveLength(10);
    expect(fullContent.rounds.map((round) => round.roundId)).toEqual([
      'r01',
      'r02',
      'r03',
      'r04',
      'r05',
      'r06',
      'r07',
      'r08',
      'r09',
      'r10',
      'r11',
      'r12',
    ]);
  });

  it('keeps all full-content references resolvable', () => {
    expect(() => validateContent(fullContent)).not.toThrow();
    const theoryIds = new Set(fullContent.theories.map((theory) => theory.theoryId));
    for (const topic of fullContent.discussionTopics)
      for (const theoryId of topic.relatedTheoryIds) expect(theoryIds.has(theoryId)).toBe(true);
    for (const card of fullContent.conceptCards)
      expect(theoryIds.has(card.sourceTheoryId)).toBe(true);
  });
});
