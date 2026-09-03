import { describe, expect, it } from 'vitest';
import { fullContent } from '../src/full.js';

describe('M4 content coverage candidate', () => {
  it('contains the planned course-scale content set', () => {
    expect(fullContent.rounds).toHaveLength(12);
    expect(
      fullContent.rounds.reduce((total, round) => total + round.choices.length, 0),
    ).toBeGreaterThanOrEqual(50);
    expect(
      fullContent.rounds.reduce((total, round) => total + round.choices.length, 0),
    ).toBeLessThanOrEqual(70);
    expect(fullContent.events.length).toBeGreaterThanOrEqual(30);
    expect(fullContent.events.length).toBeLessThanOrEqual(40);
    expect(fullContent.visualSystems).toHaveLength(6);
    expect(fullContent.endings.length).toBeGreaterThanOrEqual(15);
    expect(fullContent.conceptCards.length).toBeGreaterThanOrEqual(15);
    expect(fullContent.achievements.length).toBeGreaterThanOrEqual(8);
    expect(fullContent.discussionTopics.length).toBeGreaterThanOrEqual(8);
  });

  it('has several explainable condition and class-wide event branches', () => {
    expect(
      fullContent.events.filter((event) => event.conditions.length).length,
    ).toBeGreaterThanOrEqual(6);
    expect(fullContent.events.filter((event) => event.classWide).length).toBeGreaterThanOrEqual(10);
    expect(fullContent.events.filter((event) => event.once).length).toBe(fullContent.events.length);
  });

  it('makes the visual round a comparable four-test teaching interaction', () => {
    const visualRounds = fullContent.rounds.filter((round) => round.visualRequired);
    expect(visualRounds).toHaveLength(1);
    expect(visualRounds[0]?.visualTests.map((test) => test.testId)).toEqual([
      'sign_3_second',
      'mobile_shrink',
      'competitor_comparison',
      'packaging_stress',
    ]);
  });
});
