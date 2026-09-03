import type { GameContent } from '@laojie/content-schema';
import type { GameState, Metrics, TraceEntry } from '@laojie/game-engine';

export const REPORT_ENGINE_VERSION = '0.1.0';

export type ReportRoute = 'legacy' | 'v1.1' | 'v1.2';

export function resolveReportVersion(input: {
  contentVersion: string;
  engineVersion: string;
}): ReportRoute {
  if (input.contentVersion === 'v1.0.0' && input.engineVersion === '0.1.0') return 'legacy';
  if (input.contentVersion === 'v1.1.0' && input.engineVersion === '1.1.0') return 'v1.1';
  if (input.contentVersion === 'v1.2.0' && input.engineVersion === '1.2.0') return 'v1.2';
  throw new Error('报告版本与内容版本不兼容');
}

export { REPORT_ENGINE_VERSION_V11 } from './v11.js';
export type { GameReportV11 } from './v11.js';
export { buildV11Report } from './v11-report.js';

export interface CausalExplanation {
  decisionId: string;
  roundId: string;
  action: string;
  mechanism: string;
  immediate: string[];
  delayed: string[];
  theoryIds: string[];
  transferPrompt: string;
}

export interface GameReport {
  reportVersion: string;
  endingId: string | null;
  startingMetrics: Metrics;
  finalMetrics: Metrics;
  path: Array<{ roundId: string; choiceId?: string; expectation?: string; risk?: string }>;
  expectedVsActual: Array<{ roundId: string; expectation: string; actual: string }>;
  maximumConsistency: string;
  maximumContradiction: string;
  visualDiagnosis: string[];
  stakeholderNetwork: string[];
  theoryMapping: Array<{ theoryId: string; title: string; explanation: string }>;
  causalExplanations: CausalExplanation[];
  counterfactual: string;
  assignmentTransfer: string[];
  unlockedConceptIds: string[];
  earnedAchievementIds: string[];
}

const roundChoice = (trace: TraceEntry, state: GameState) =>
  state.decisions.find(
    (decision) => decision.actionId === trace.actionId && decision.type === 'choice_selected',
  );

function metricDelta(trace: TraceEntry, key: keyof Metrics): number {
  return trace.after[key] - trace.before[key];
}

function formatEffects(trace: TraceEntry, timing: 'immediate' | 'delayed'): string[] {
  const effects = timing === 'immediate' ? trace.immediateEffects : trace.delayedEffects;
  return effects.map(
    (effect) => `${effect.label}（${effect.amount > 0 ? '+' : ''}${effect.amount}）`,
  );
}

export function buildReport(state: GameState, content: GameContent): GameReport {
  const theoryMap = new Map(content.theories.map((theory) => [theory.theoryId, theory]));
  const choiceTraces = state.traces.filter((trace) => trace.actionType === 'choice_selected');
  const path = choiceTraces.map((trace) => {
    const decision = roundChoice(trace, state);
    const intent = state.decisions.find(
      (item) => item.actionId === trace.actionId && item.type === 'intent_selected',
    );
    const risk = state.decisions.find(
      (item) => item.actionId === trace.actionId && item.type === 'risk_selected',
    );
    return {
      roundId: trace.roundId,
      ...(typeof decision?.payload.choiceId === 'string'
        ? { choiceId: decision.payload.choiceId }
        : {}),
      ...(typeof intent?.payload.intent === 'string' ? { expectation: intent.payload.intent } : {}),
      ...(typeof risk?.payload.risk === 'string' ? { risk: risk.payload.risk } : {}),
    };
  });
  const bestConsistency = [...choiceTraces].sort(
    (a, b) => metricDelta(b, 'brandConsistency') - metricDelta(a, 'brandConsistency'),
  )[0];
  const worstContradiction = [...choiceTraces].sort(
    (a, b) => metricDelta(a, 'reputationDebt') - metricDelta(b, 'reputationDebt'),
  )[0];
  const visualDiagnosis = state.visualTestResults.map(
    (result) => `${result.testId}：${result.explanation}（${result.score}分）`,
  );
  const stakeholderNetwork = [
    state.metrics.trust >= 55 ? '老客与社区获得了更多话语权。' : '老客仍在观察你是否兑现承诺。',
    state.metrics.orgCapacity >= 55
      ? '内部团队有余力承接增长。'
      : '内部能力成为品牌体验的隐形边界。',
    state.metrics.channelDependence >= 30
      ? '平台渠道开始影响品牌关系。'
      : '品牌仍保有较多直接关系。',
  ];
  const usedTheoryIds = [...new Set(state.traces.flatMap((trace) => trace.theoryIds))];
  const theoryMapping = usedTheoryIds.flatMap((theoryId) => {
    const theory = theoryMap.get(theoryId);
    return theory ? [{ theoryId, title: theory.title, explanation: theory.explanation }] : [];
  });
  const causalExplanations = choiceTraces.map((trace) => {
    const theory = theoryMap.get(trace.theoryIds[0] ?? '');
    return {
      decisionId: trace.actionId,
      roundId: trace.roundId,
      action: trace.explanation,
      mechanism: `状态从现金/注意力/关系等经营条件发生变化；本轮品牌一致性变化 ${metricDelta(trace, 'brandConsistency')}。`,
      immediate: formatEffects(trace, 'immediate'),
      delayed: formatEffects(trace, 'delayed'),
      theoryIds: trace.theoryIds,
      transferPrompt: theory?.transferPrompt ?? '把这个机制迁移到你的品牌作业中。',
    };
  });
  const expectedVsActual = path.map((item) => {
    const trace = choiceTraces.find((candidate) => candidate.roundId === item.roundId);
    return {
      roundId: item.roundId,
      expectation: item.expectation ?? '未记录预期',
      actual: trace?.explanation ?? '无结算反馈',
    };
  });
  const counterfactual = worstContradiction
    ? `如果在 ${worstContradiction.roundId} 先处理交付/关系而不是继续放大承诺，最可能减少的是后续的声誉债务；这不是标准答案，而是基于本局状态的反事实。`
    : '本局没有足够的矛盾证据生成反事实。';

  return {
    reportVersion: REPORT_ENGINE_VERSION,
    endingId: state.endingId ?? null,
    startingMetrics: state.traces[0]?.before ?? state.metrics,
    finalMetrics: state.metrics,
    path,
    expectedVsActual,
    maximumConsistency: bestConsistency
      ? `${bestConsistency.roundId}：${bestConsistency.explanation}`
      : '尚未形成明显的一致性高点。',
    maximumContradiction: worstContradiction
      ? `${worstContradiction.roundId}：${worstContradiction.explanation}`
      : '尚未形成明显的承诺—行动矛盾。',
    visualDiagnosis,
    stakeholderNetwork,
    theoryMapping,
    causalExplanations,
    counterfactual,
    assignmentTransfer: theoryMapping.map((theory) => theory.explanation),
    unlockedConceptIds: state.unlockedConceptIds,
    earnedAchievementIds: state.earnedAchievementIds,
  };
}
