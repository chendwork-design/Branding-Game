import type { GameContentV11, V11VisualSystem } from '@laojie/content-schema';
import type { RouteProfileV11, ScoreBreakdownV11, V11GameState } from './v11.js';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function metric(state: V11GameState, key: string): number {
  return state.metrics[key] ?? 0;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function routeMetrics(state: V11GameState): Record<string, number> {
  return {
    survival: average([
      metric(state, 'productDelivery'),
      metric(state, 'orgCapacity'),
      clamp((state.cashYuan / 500_000) * 100),
    ]),
    customer: average([
      metric(state, 'awareness'),
      metric(state, 'conversion'),
      metric(state, 'trust'),
      metric(state, 'loyalty'),
      metric(state, 'segmentFit'),
    ]),
    brand: average([
      metric(state, 'differentiation'),
      metric(state, 'promiseCredibility'),
      metric(state, 'culturalCredibility'),
      metric(state, 'visualRecognition'),
    ]),
    consistency: clamp(
      average([
        metric(state, 'brandConsistency'),
        metric(state, 'productDelivery'),
        metric(state, 'orgCapacity'),
        metric(state, 'visualAdaptability'),
      ]) -
        metric(state, 'reputationDebt') * 0.5 -
        metric(state, 'channelDependence') * 0.25,
    ),
  };
}

function visualMatchScore(state: V11GameState, visual: V11VisualSystem): number {
  const factors = visual.matchFactors;
  return clamp(
    average([
      100 - Math.abs(factors.customerFit - metric(state, 'segmentFit')),
      100 - Math.abs(factors.positionFit - metric(state, 'differentiation')),
      100 - Math.abs(factors.productFit - metric(state, 'productDelivery')),
      100 - Math.abs(factors.cultureFit - metric(state, 'culturalCredibility')),
      100 - Math.abs(factors.priceFit - metric(state, 'conversion')),
      100 -
        Math.abs(
          factors.touchpointFit -
            average([metric(state, 'brandConsistency'), metric(state, 'visualAdaptability')]),
        ),
    ]),
  );
}

export interface V11ScoreResult extends ScoreBreakdownV11 {
  visualMatchScore: number;
}

export function scoreV11State(
  state: V11GameState,
  content: GameContentV11,
  visual?: V11VisualSystem,
): V11ScoreResult {
  const dimensions = routeMetrics(state);
  const overall = clamp(
    content.victoryConfig.dimensions.reduce(
      (sum, dimension) => sum + (dimensions[dimension.key] ?? 0) * dimension.weight,
      0,
    ) / 100,
  );
  const level: ScoreBreakdownV11['level'] =
    overall < 30
      ? 'out_of_control'
      : overall < 45
        ? 'barely_alive'
        : overall < 60
          ? 'formed_brand'
          : overall < 78
            ? 'sustainable'
            : 'benchmark';
  return {
    survival: clamp(dimensions.survival ?? 0),
    customer: clamp(dimensions.customer ?? 0),
    brand: clamp(dimensions.brand ?? 0),
    consistency: clamp(dimensions.consistency ?? 0),
    overall,
    level,
    visualMatchScore: visual ? visualMatchScore(state, visual) : 0,
  };
}

interface RouteRule {
  id: string;
  title: string;
  preferred: string[];
}

const ROUTE_RULES: RouteRule[] = [
  {
    id: 'community_steward',
    title: '社区关系型品牌',
    preferred: ['r01-neighbor', 'r03-stable', 'r08-hand', 'r11-steady'],
  },
  {
    id: 'visual_system',
    title: '视觉系统型品牌',
    preferred: ['r01-tourist', 'r03-local-special', 'r08-line', 'r11-steady'],
  },
  {
    id: 'platform_scaler',
    title: '平台增长型品牌',
    preferred: ['r01-tourist', 'r03-complex', 'r08-symbol', 'r11-platform'],
  },
  { id: 'experimental_blend', title: '实验探索型品牌', preferred: [] },
];

export function deriveV11RouteProfile(
  state: V11GameState,
  content: GameContentV11,
): RouteProfileV11 {
  const choices = state.decisions
    .filter((decision) => decision.type === 'choice_committed')
    .map((decision) =>
      typeof decision.payload.choiceId === 'string' ? decision.payload.choiceId : '',
    )
    .filter(Boolean);
  const contributingRounds = content.rounds
    .filter((round) =>
      state.decisions.some(
        (decision) => decision.type === 'choice_committed' && decision.roundId === round.roundId,
      ),
    )
    .map((round) => round.roundId);
  if (choices.length === 0) {
    return {
      routeId: 'experimental_blend',
      title: '实验探索型品牌',
      confidence: 0,
      contributingRounds,
    };
  }
  const scored = ROUTE_RULES.slice(0, -1).map((rule) => ({
    rule,
    hits: choices.filter((choiceId) => rule.preferred.includes(choiceId)).length,
  }));
  scored.sort((a, b) => b.hits - a.hits);
  const winner = scored[0];
  if (!winner || winner.hits === 0) {
    return {
      routeId: 'experimental_blend',
      title: '实验探索型品牌',
      confidence: Math.min(65, 35 + choices.length * 5),
      contributingRounds,
    };
  }
  return {
    routeId: winner.rule.id,
    title: winner.rule.title,
    confidence: Math.min(92, 35 + winner.hits * 16 + Math.max(0, choices.length - 1) * 6),
    contributingRounds,
  };
}
