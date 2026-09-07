import { describe, expect, it } from 'vitest';
import { sampleContent } from '@laojie/content-schema/sample';
import { hashState, replay, resolveEngineVersion } from '../src/index.js';
import { createV11State, ENGINE_VERSION_V11 } from '../src/v11.js';

describe('v1.2 engine compatibility contract', () => {
  it('routes v1.0, v1.1 and v1.2/v1.3 content to separate engine implementations', () => {
    expect(resolveEngineVersion({ contentVersion: 'v1.0.0', engineVersion: '0.1.0' })).toBe(
      'legacy',
    );
    expect(
      resolveEngineVersion({ contentVersion: 'v1.2.0', engineVersion: ENGINE_VERSION_V11 }),
    ).toBe('v1.2');
    expect(
      resolveEngineVersion({ contentVersion: 'v1.3.0', engineVersion: ENGINE_VERSION_V11 }),
    ).toBe('v1.2');
    expect(resolveEngineVersion({ contentVersion: 'v1.1.0', engineVersion: '1.1.0' })).toBe('v1.1');
    expect(() =>
      resolveEngineVersion({ contentVersion: 'v1.2.0', engineVersion: '0.1.0' }),
    ).toThrow('内容版本与引擎版本不兼容');
  });

  it('creates a versioned v1.2 state envelope without applying gameplay rules yet', () => {
    const state = createV11State('v1.2.0', 'playthrough-v11');
    expect(state).toMatchObject({
      contentVersion: 'v1.2.0',
      engineVersion: ENGINE_VERSION_V11,
      playthroughId: 'playthrough-v11',
      roundIndex: 0,
      stageActionPoints: 8,
      elapsedDays: 0,
      cashYuan: 500000,
      completedRoundIds: [],
    });
    expect(state.financialLedger).toEqual([]);
    expect(state.introducedTermIds).toEqual([]);
    expect(state.pendingRoundResult).toBeUndefined();
  });

  it('keeps the v1.0 golden replay hash stable while adding v1.1 contracts', () => {
    const state = replay(sampleContent, 'golden-v1', 'golden-seed', [
      {
        actionId: 'golden-choice',
        type: 'choice_selected',
        roundId: 'r01',
        payload: { choiceId: 'r01-tourist' },
      },
    ]);

    expect(hashState(state)).toBe(
      '589e92320f375fe85695cfb558b039f63152410741d3c1bdb4fb78d1698e0735',
    );
  });
});
