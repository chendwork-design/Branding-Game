import { describe, expect, it } from 'vitest';
import { v11FullContent, v11SliceContent } from '@laojie/content-schema';
import { applyV11Action, createV11State, type V11Action } from '@laojie/game-engine';
import { buildV11Report } from '../src/v11-report.js';

function action(
  actionId: string,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown>,
): V11Action {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

function oneRoundState(content = v11SliceContent) {
  let state = createV11State(content.contentVersion, 'report-fixture');
  const actions: V11Action[] = [
    action('a1', 'onboarding_completed', undefined, {}),
    action('a2', 'stage_action_selected', 'r01', { actionId: 'r01-observe-footfall' }),
    action('a3', 'evidence_viewed', 'r01', { evidenceId: 'ev-r01-footfall' }),
    action('a4', 'choice_previewed', 'r01', { choiceId: 'r01-neighbor' }),
    action('a5', 'choice_committed', 'r01', {
      choiceId: 'r01-neighbor',
      decisionGroupId: 'dg-r01',
    }),
    action('a6', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
  ];
  for (const current of actions)
    state = applyV11Action(state, content, current, 'report-seed').state;
  return state;
}

describe('v1.1 slice report', () => {
  it('explains a decision in natural language and keeps its audit reference', () => {
    const report = buildV11Report(oneRoundState(), v11SliceContent);
    expect(report.reportVersion).toBe('1.2.0');
    expect(report.evidenceDiagnosis[0]).toMatchObject({
      roundTitle: '先别急着做 Logo',
      evidenceTitle: '一周客流观察',
      choiceLabel: '先做附近居民的日常茶饮',
      status: '用上了一部分相关信息',
    });
    expect(report.causalExplanations[0]?.mechanism).toContain('服务对象变清楚了');
    expect(report.causalExplanations[0]?.traceRefs).toEqual(['第5条决策记录']);
    expect(report.roundReviews[0]).toMatchObject({
      roundTitle: '先别急着做 Logo',
      choiceLabel: '先做附近居民的日常茶饮',
      decisionReason: '用上了一部分相关信息',
      evidenceUse: '一周客流观察',
      resourceImpact: { cashCostYuan: 18000, actionPointCost: 3, durationDays: 5, workload: 3 },
    });
    expect(report.replayReflection.prompt).toContain('重来一次');
    expect(report.predictionDiagnosis).toMatchObject({ matched: 0, differed: 0 });
    expect(report.predictionDiagnosis.explanation).toContain('预判');
    expect(report.visualDiagnosis.selectedSystem).toBeNull();
    expect(JSON.stringify(report)).not.toContain('r01-neighbor');
    expect(JSON.stringify(report)).not.toContain('ev-r01-footfall');
  });

  it('keeps the financial summary traceable to the v1.1 ledger', () => {
    const report = buildV11Report(oneRoundState(), v11SliceContent);
    expect(report.financialSummary).toMatchObject({
      openingCashYuan: 500000,
      finalCashYuan: 482000,
      totalCostYuan: 18000,
    });
  });

  it('uses the score already confirmed by the rules engine', () => {
    const state = oneRoundState();
    state.scoreBreakdown = {
      survival: 11,
      customer: 22,
      brand: 33,
      consistency: 44,
      overall: 55,
      level: 'sustainable',
    };
    expect(buildV11Report(state, v11SliceContent).scoreBreakdown).toEqual(state.scoreBreakdown);
  });

  it('keeps the full-content report as one readable decision chain', () => {
    const report = buildV11Report(oneRoundState(v11FullContent), v11FullContent);
    const mechanism = report.roundReviews[0]?.mechanism ?? '';
    expect(mechanism).toContain('你选择了「先做附近居民的日常茶饮」');
    expect(mechanism).toContain('当时参考了「一周客流观察」');
    expect(mechanism).toContain('店里先发生：');
    expect(mechanism).toContain('最先有回应的是：');
    expect(mechanism).toContain('接下来要留意：');
    expect(mechanism).not.toContain('即时后果');
    expect(mechanism).not.toContain('延迟后果');
  });
});
