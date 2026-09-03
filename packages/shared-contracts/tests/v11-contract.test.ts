import { describe, expect, it } from 'vitest';
import { parseVersionedActionInput, V11ActionInput } from '../src/index.js';

describe('v1.2 shared action contract', () => {
  it('accepts an atomic choice commitment with a decision group', () => {
    const action = parseVersionedActionInput({
      protocolVersion: '1.2',
      actionId: 'a-choice-1',
      type: 'choice_committed',
      roundId: 'r03',
      payload: {
        choiceId: 'r03-local',
        riskPlanId: 'risk-r03-delivery',
        predictionId: 'prediction-r03-delivery',
        decisionGroupId: 'dg-r03',
      },
    });

    expect(action.protocolVersion).toBe('1.2');
    expect(action.type).toBe('choice_committed');
    expect(action.payload).toMatchObject({ decisionGroupId: 'dg-r03' });
  });

  it('requires a round for gameplay actions but allows onboarding without one', () => {
    expect(() =>
      V11ActionInput.parse({
        protocolVersion: '1.1',
        actionId: 'a-invalid',
        type: 'choice_committed',
        payload: { choiceId: 'r01-local' },
      }),
    ).toThrow('动作轮次不能为空');

    expect(
      V11ActionInput.parse({
        protocolVersion: '1.1',
        actionId: 'a-onboarding',
        type: 'onboarding_completed',
        payload: {},
      }),
    ).toMatchObject({ type: 'onboarding_completed' });
  });

  it('accepts the v1.2-compatible skip and brand identity actions without accepting a missing round', () => {
    expect(
      V11ActionInput.parse({
        protocolVersion: '1.1',
        actionId: 'skip-r11',
        type: 'choice_skipped',
        roundId: 'r11',
        payload: { reason: '本轮先维持现状' },
      }).type,
    ).toBe('choice_skipped');
    expect(
      V11ActionInput.parse({
        protocolVersion: '1.1',
        actionId: 'identity-r05',
        type: 'brand_identity_declared',
        roundId: 'r05',
        payload: { brandName: '一盏屯溪' },
      }).type,
    ).toBe('brand_identity_declared');
    expect(
      V11ActionInput.parse({
        protocolVersion: '1.2',
        actionId: 'terms-r05',
        type: 'terms_introduced',
        roundId: 'r05',
        payload: { termIds: ['brand-personality'] },
      }).type,
    ).toBe('terms_introduced');
  });

  it('does not silently treat unknown protocol versions as legacy', () => {
    expect(() =>
      parseVersionedActionInput({
        protocolVersion: '1.3',
        actionId: 'a-unknown',
        type: 'choice_committed',
        roundId: 'r01',
        payload: {},
      }),
    ).toThrow();
  });
});
