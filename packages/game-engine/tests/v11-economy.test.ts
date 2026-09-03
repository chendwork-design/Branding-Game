import { describe, expect, it } from 'vitest';
import { v11FullContent, v11SliceContent, validateV11Content } from '@laojie/content-schema';
import { applyV11Action, createV11State, type V11Action } from '../src/index.js';

function action(
  actionId: string,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown>,
): V11Action {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

function playToR11(content = v11SliceContent) {
  let state = createV11State(content.contentVersion, 'economy-fixture');
  const actions: V11Action[] = [
    action('a0', 'onboarding_completed', undefined, {}),
    action('a1', 'choice_committed', 'r01', {
      choiceId: 'r01-neighbor',
      decisionGroupId: 'dg-r01',
    }),
    action('a2', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
    action('a3', 'choice_committed', 'r03', { choiceId: 'r03-stable', decisionGroupId: 'dg-r03' }),
    action('a4', 'round_result_acknowledged', 'r03', { resultId: 'result-r03' }),
    action('a5', 'visual_selected', 'r08', { visualId: 'v-line' }),
    action('a6', 'choice_committed', 'r08', { choiceId: 'r08-line', decisionGroupId: 'dg-r08' }),
    action('a7', 'round_result_acknowledged', 'r08', { resultId: 'result-r08' }),
  ];
  for (const current of actions)
    state = applyV11Action(state, content, current, 'economy-seed').state;
  return state;
}

describe('v1.1 economy and evidence rules', () => {
  it('records overdue fixed costs and operating gross profit in the ledger', () => {
    const content = validateV11Content({
      ...v11SliceContent,
      rounds: v11SliceContent.rounds.map((round) =>
        round.roundId === 'r01'
          ? { ...round, targetElapsedDay: 2, overdueFixedCostPerDayYuan: 1000 }
          : round.roundId === 'r11'
            ? {
                ...round,
                businessPhase: 'operating',
                baseRevenueYuan: 120000,
                fixedCostPerDayYuan: 1000,
              }
            : round,
      ),
    });
    const state = playToR11(content);
    const beforeChoice = state.cashYuan;
    const result = applyV11Action(
      state,
      content,
      action('a8', 'choice_committed', 'r11', {
        choiceId: 'r11-steady',
        decisionGroupId: 'dg-r11',
      }),
      'economy-seed',
    );
    const categories = result.state.financialLedger.map((entry) => entry.category);
    expect(categories).toContain('fixed_cost');
    expect(categories).toContain('gross_profit');
    expect(result.state.cashYuan).toBeGreaterThan(beforeChoice - 26000);
    expect(result.state.financialLedger.reduce((sum, entry) => sum + entry.amountYuan, 0)).toBe(
      result.state.cashYuan,
    );
  });

  it('reports only metric changes applied in the current settlement', () => {
    let state = createV11State(v11FullContent.contentVersion, 'metric-change-fixture');
    state = applyV11Action(
      state,
      v11FullContent,
      action('metric-onboard', 'onboarding_completed', undefined, {}),
      'metric-change-seed',
    ).state;
    const before = { ...state.metrics };
    const applied = applyV11Action(
      state,
      v11FullContent,
      action('metric-choice', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'metric-change-seed',
    );
    const result = applied.state.pendingRoundResult;
    if (!result) throw new Error('缺少本轮结算结果');
    const actualChanges = Object.fromEntries(
      Object.keys(before)
        .map((key) => [key, (applied.state.metrics[key] ?? 0) - (before[key] ?? 0)])
        .filter(([, amount]) => amount !== 0),
    );
    expect(result.metricChanges).toEqual(actualChanges);
    expect(result.metricChanges.loyalty).toBeUndefined();
    expect(result.scheduledEffects.some((effect) => effect.key === 'loyalty')).toBe(true);
  });

  it('does not report a metric change that was absorbed by the 0-100 clamp', () => {
    let state = createV11State(v11SliceContent.contentVersion, 'metric-clamp-fixture');
    state = applyV11Action(
      state,
      v11SliceContent,
      action('clamp-onboard', 'onboarding_completed', undefined, {}),
      'metric-clamp-seed',
    ).state;
    state.metrics.segmentFit = 100;
    const applied = applyV11Action(
      state,
      v11SliceContent,
      action('clamp-choice', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'metric-clamp-seed',
    );
    expect(applied.state.pendingRoundResult?.metricChanges.segmentFit).toBeUndefined();
    expect(
      applied.state.pendingRoundResult?.immediateEffects.some(
        (effect) => effect.key === 'segmentFit',
      ),
    ).toBe(true);
  });

  it('keeps a low-delivery shop financially playable while preserving the delivery penalty', () => {
    const content = validateV11Content({
      ...v11SliceContent,
      rounds: v11SliceContent.rounds.map((round) =>
        round.roundId === 'r11'
          ? {
              ...round,
              businessPhase: 'operating',
              baseRevenueYuan: 120000,
              fixedCostPerDayYuan: 1000,
            }
          : round,
      ),
    });
    const state = playToR11(content);
    state.metrics.productDelivery = 0;
    const result = applyV11Action(
      state,
      content,
      action('low-delivery', 'choice_committed', 'r11', {
        choiceId: 'r11-steady',
        decisionGroupId: 'dg-low-delivery',
      }),
      'economy-seed',
    );
    const grossProfit =
      result.state.financialLedger.find((entry) => entry.category === 'gross_profit')?.amountYuan ??
      0;
    expect(grossProfit).toBeGreaterThan(0);
    expect(grossProfit).toBeLessThan(120000);
    expect(result.state.cashYuan).toBeGreaterThan(0);
  });

  it('turns customer demand, visual recognition, delivery and reputation into distinct operating income', () => {
    const content = validateV11Content({
      ...v11SliceContent,
      rounds: v11SliceContent.rounds.map((round) =>
        round.roundId === 'r11'
          ? {
              ...round,
              businessPhase: 'operating',
              baseRevenueYuan: 180000,
              fixedCostPerDayYuan: 1000,
            }
          : round,
      ),
    });
    const weak = playToR11(content);
    const strong = structuredClone(weak);
    Object.assign(weak.metrics, {
      awareness: 10,
      conversion: 35,
      trust: 55,
      loyalty: 20,
      visualRecognition: 10,
      brandConsistency: 15,
      culturalCredibility: 20,
      productDelivery: 75,
      orgCapacity: 25,
      reputationDebt: 45,
      channelDependence: 30,
    });
    Object.assign(strong.metrics, {
      awareness: 75,
      conversion: 35,
      trust: 55,
      loyalty: 20,
      visualRecognition: 80,
      brandConsistency: 75,
      culturalCredibility: 70,
      productDelivery: 75,
      orgCapacity: 75,
      reputationDebt: 0,
      channelDependence: 0,
    });
    const settle = (state: typeof weak, actionId: string) =>
      applyV11Action(
        state,
        content,
        action(actionId, 'choice_committed', 'r11', {
          choiceId: 'r11-steady',
          decisionGroupId: actionId,
        }),
        'economy-seed',
      ).state.financialLedger.find((entry) => entry.category === 'gross_profit')?.amountYuan ?? 0;
    expect(settle(strong, 'strong-income')).toBeGreaterThan(settle(weak, 'weak-income'));
  });

  it('uses viewed evidence as a bounded adjustment without hiding any choice', () => {
    const noEvidence = playToR11(v11SliceContent);
    const evidenceContent = v11SliceContent;
    let withEvidence = createV11State(evidenceContent.contentVersion, 'evidence-fixture');
    withEvidence = applyV11Action(
      withEvidence,
      evidenceContent,
      action('e0', 'onboarding_completed', undefined, {}),
      'evidence-seed',
    ).state;
    withEvidence = applyV11Action(
      withEvidence,
      evidenceContent,
      action('e1', 'stage_action_selected', 'r01', { actionId: 'r01-observe-footfall' }),
      'evidence-seed',
    ).state;
    withEvidence = applyV11Action(
      withEvidence,
      evidenceContent,
      action('e2', 'evidence_viewed', 'r01', { evidenceId: 'ev-r01-footfall' }),
      'evidence-seed',
    ).state;
    withEvidence = applyV11Action(
      withEvidence,
      evidenceContent,
      action('e3', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'evidence-seed',
    ).state;
    const plainResult = noEvidence.traces.find(
      (trace) => trace.actionType === 'choice_committed' && trace.roundId === 'r01',
    );
    const evidenceResult = withEvidence.traces.find(
      (trace) => trace.actionType === 'choice_committed' && trace.roundId === 'r01',
    );
    expect(evidenceResult?.evidenceAdjustments.length).toBeGreaterThan(0);
    expect(evidenceResult?.evidenceAdjustments[0]?.evidenceId).toBe('ev-r01-footfall');
    expect(
      Math.abs(
        (evidenceResult?.after.metrics.segmentFit ?? 0) -
          (plainResult?.after.metrics.segmentFit ?? 0),
      ),
    ).toBeGreaterThan(0);
    expect(
      Math.abs(
        (evidenceResult?.after.metrics.segmentFit ?? 0) -
          (plainResult?.after.metrics.segmentFit ?? 0),
      ),
    ).toBeLessThan(10);
  });

  it('reduces a negative delayed consequence when the compatible risk plan is selected', () => {
    const content = validateV11Content({
      ...v11SliceContent,
      rounds: v11SliceContent.rounds.map((round) =>
        round.roundId === 'r03'
          ? {
              ...round,
              choices: round.choices.map((choice) =>
                choice.choiceId === 'r03-stable'
                  ? {
                      ...choice,
                      effects: [
                        ...choice.effects,
                        {
                          key: 'productDelivery',
                          amount: -10,
                          timing: 'delayed',
                          label: '排队压力变成交付损耗',
                          theoryId: 't-product',
                        },
                      ],
                    }
                  : choice,
              ),
            }
          : round,
      ),
    });
    let noPlan = createV11State(content.contentVersion, 'risk-no-plan');
    noPlan = applyV11Action(
      noPlan,
      content,
      action('n0', 'onboarding_completed', undefined, {}),
      'risk-seed',
    ).state;
    noPlan = applyV11Action(
      noPlan,
      content,
      action('n1', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'risk-seed',
    ).state;
    noPlan = applyV11Action(
      noPlan,
      content,
      action('n2', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
      'risk-seed',
    ).state;
    noPlan = applyV11Action(
      noPlan,
      content,
      action('n3', 'choice_committed', 'r03', {
        choiceId: 'r03-stable',
        decisionGroupId: 'dg-r03',
      }),
      'risk-seed',
    ).state;
    let withPlan = createV11State(content.contentVersion, 'risk-with-plan');
    withPlan = applyV11Action(
      withPlan,
      content,
      action('p0', 'onboarding_completed', undefined, {}),
      'risk-seed',
    ).state;
    withPlan = applyV11Action(
      withPlan,
      content,
      action('p1', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'risk-seed',
    ).state;
    withPlan = applyV11Action(
      withPlan,
      content,
      action('p2', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
      'risk-seed',
    ).state;
    withPlan = applyV11Action(
      withPlan,
      content,
      action('p3', 'risk_plan_selected', 'r03', { riskPlanId: 'risk-r03-supply' }),
      'risk-seed',
    ).state;
    const planned = applyV11Action(
      withPlan,
      content,
      action('p4', 'choice_committed', 'r03', {
        choiceId: 'r03-stable',
        decisionGroupId: 'dg-r03',
        riskPlanId: 'risk-r03-supply',
      }),
      'risk-seed',
    );
    const plainDelayed = noPlan.pendingEffects.find(
      (effect) => effect.key === 'productDelivery' && effect.amount < 0,
    );
    const mitigatedDelayed = planned.state.pendingEffects.find(
      (effect) => effect.key === 'productDelivery' && effect.amount < 0,
    );
    expect(plainDelayed?.amount).toBe(-10);
    expect(mitigatedDelayed?.amount).toBeGreaterThan(-10);
    expect(planned.trace.riskOutcome?.status).toBe('mitigated');
  });
});
