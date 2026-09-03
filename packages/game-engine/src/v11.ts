import type { V11Condition, V11Effect } from '@laojie/content-schema';
import type { V11ActionInput } from '@laojie/shared-contracts';

export const ENGINE_VERSION_V11 = '1.2.0';
export type V11Action = V11ActionInput;
export const V11_FREE_ACTION_POINT_BUDGET = 4;
export const V11_STRATEGIC_ACTION_POINT_BUDGET = 4;

export interface FinancialLedgerEntryV11 {
  entryId: string;
  roundId: string;
  decisionGroupId?: string | undefined;
  category:
    'opening' | 'gross_profit' | 'fixed_cost' | 'strategic_investment' | 'research_cost' | 'event';
  amountYuan: number;
  elapsedDay: number;
  sourceType: 'system' | 'stage_action' | 'choice' | 'risk_plan' | 'event';
  sourceId: string;
  descriptionKey: string;
}

export interface ScoreBreakdownV11 {
  survival: number;
  customer: number;
  brand: number;
  consistency: number;
  overall: number;
  level: 'out_of_control' | 'barely_alive' | 'formed_brand' | 'sustainable' | 'benchmark';
}

export interface RouteProfileV11 {
  routeId: string;
  title: string;
  confidence: number;
  contributingRounds: string[];
}

export interface RiskOutcomeV11 {
  riskPlanId?: string;
  predictionId?: string;
  status:
    | 'not_selected'
    | 'mitigated'
    | 'not_triggered'
    | 'missed'
    | 'partially_mitigated'
    | 'unexpected';
  explanation: string;
}

export interface V11EvidenceAdjustment {
  evidenceId: string;
  choiceId: string;
  relation: 'supports' | 'warns' | 'contradicts' | 'context';
  amount: number;
  explanation: string;
}

export interface V11TriggeredEvent {
  eventId: string;
  title: string;
  text: string;
  sourceRoundId: string;
  effects: V11Effect[];
}

export interface V11VisualDiagnostic {
  roundId: string;
  testId: string;
  title: string;
  score: number;
  passed: boolean;
  explanation: string;
  metricChanges: Record<string, number>;
}

export interface PendingEffectV11 extends V11Effect {
  sourceActionId: string;
  sourceRoundId: string;
  dueRoundIndex: number;
}

export interface V11ResourceSnapshot {
  cashYuan: number;
  stageActionPoints: number;
  freeActionPoints: number;
  strategicActionPoints: number;
  elapsedDays: number;
  metrics: Record<string, number>;
}

export interface V11RoundResult {
  resultType: 'choice' | 'skip';
  roundId: string;
  choiceId: string;
  choiceLabel: string;
  decisionGroupId: string;
  cashCostYuan: number;
  actionPointCost: number;
  durationDays: number;
  workload: number;
  ledgerEntries: FinancialLedgerEntryV11[];
  metricChanges: Record<string, number>;
  causeSources: string[];
  evidenceAdjustments: V11EvidenceAdjustment[];
  immediateEffects: V11Effect[];
  maturedEffects: PendingEffectV11[];
  scheduledEffects: PendingEffectV11[];
  riskOutcome: RiskOutcomeV11;
  triggeredEvents: V11TriggeredEvent[];
  characterReactions: string[];
  sceneKey: string;
  outcomeState: 'stable' | 'strained' | 'crisis';
  routeOverlayKey: string;
  resultArtKey: string;
  motionCue: string;
  newAchievements: string[];
  visualDiagnostics: V11VisualDiagnostic[];
}

export interface V11TraceEntry {
  sequence: number;
  actionId: string;
  actionType: V11Action['type'];
  roundId?: string;
  decisionGroupId?: string | undefined;
  before: V11ResourceSnapshot;
  after: V11ResourceSnapshot;
  ledgerEntries: FinancialLedgerEntryV11[];
  evidenceRelations: string[];
  evidenceAdjustments: V11EvidenceAdjustment[];
  riskOutcome?: RiskOutcomeV11;
  triggeredEvents: V11TriggeredEvent[];
  immediateEffects: V11Effect[];
  scheduledEffects: PendingEffectV11[];
  maturedEffects: PendingEffectV11[];
  visualDiagnostics?: V11VisualDiagnostic[];
  result?: V11RoundResult;
  explanation: string;
}

export interface V11GameState {
  contentVersion: string;
  engineVersion: string;
  playthroughId: string;
  roundIndex: number;
  completedRoundIds: string[];
  elapsedDays: number;
  stageActionPoints: number;
  freeActionPoints: number;
  strategicActionPoints: number;
  cashYuan: number;
  metrics: Record<string, number>;
  financialLedger: FinancialLedgerEntryV11[];
  viewedEvidenceIds: string[];
  evidenceSignals: Array<{
    evidenceId: string;
    viewedAtRoundIndex: number;
    relationIds: string[];
  }>;
  /** Terms that have been expanded for the player at least once. */
  introducedTermIds: string[];
  selectedRiskPlans: string[];
  predictions: Array<{
    predictionId: string;
    roundId: string;
    label: string;
    expectedRisk: string;
  }>;
  brandIdentity?: {
    brandName: string;
    namingIntent: string;
    personality: string;
    identityArchitecture: 'wordmark' | 'symbol' | 'ip';
  };
  visualState: {
    selectedVisualId?: string;
    testedTouchpoints: string[];
    testResults?: V11VisualDiagnostic[];
    matchScore?: number;
  };
  storeVisualState: Record<string, string | number>;
  pendingEffects: PendingEffectV11[];
  pendingRoundResult?: V11RoundResult | undefined;
  scoreBreakdown?: ScoreBreakdownV11;
  routeProfile?: RouteProfileV11;
  achievements: string[];
  chapterReviews: string[];
  decisions: Array<{
    actionId: string;
    type: string;
    roundId?: string;
    payload: Record<string, unknown>;
  }>;
  traces: V11TraceEntry[];
  ending?: string;
}

export type V11ResumeScreen =
  'onboarding' | 'briefing' | 'round-result' | 'chapter-review' | 'complete';

const V11_CHAPTER_REVIEW_ROUNDS = new Set(['r02', 'r06', 'r09', 'r12']);

export function deriveV11ResumeScreen(
  state: V11GameState,
  roundIdsOrCount: readonly string[] | number,
  reportAvailable: boolean,
): V11ResumeScreen {
  const roundCount = typeof roundIdsOrCount === 'number' ? roundIdsOrCount : roundIdsOrCount.length;
  if (state.pendingRoundResult) return 'round-result';
  const currentRoundId =
    typeof roundIdsOrCount === 'number' ? undefined : roundIdsOrCount[state.roundIndex];
  if (currentRoundId && state.completedRoundIds.includes(currentRoundId)) return 'round-result';
  const lastCompletedRound = state.completedRoundIds.at(-1);
  if (
    lastCompletedRound &&
    V11_CHAPTER_REVIEW_ROUNDS.has(lastCompletedRound) &&
    !(state.chapterReviews ?? []).includes(lastCompletedRound)
  )
    return 'chapter-review';
  if (reportAvailable || state.roundIndex >= roundCount) return 'complete';
  if (!state.decisions.some((decision) => decision.type === 'onboarding_completed'))
    return 'onboarding';
  return 'briefing';
}

export function createV11State(contentVersion: string, playthroughId: string): V11GameState {
  return {
    contentVersion,
    engineVersion: ENGINE_VERSION_V11,
    playthroughId,
    roundIndex: 0,
    completedRoundIds: [],
    elapsedDays: 0,
    stageActionPoints: V11_FREE_ACTION_POINT_BUDGET + V11_STRATEGIC_ACTION_POINT_BUDGET,
    freeActionPoints: V11_FREE_ACTION_POINT_BUDGET,
    strategicActionPoints: V11_STRATEGIC_ACTION_POINT_BUDGET,
    cashYuan: 500_000,
    metrics: {
      awareness: 10,
      conversion: 15,
      trust: 50,
      loyalty: 5,
      segmentFit: 30,
      differentiation: 50,
      brandConsistency: 30,
      promiseCredibility: 30,
      productDelivery: 40,
      orgCapacity: 50,
      culturalCredibility: 40,
      visualRecognition: 20,
      visualAdaptability: 20,
      channelDependence: 0,
      reputationDebt: 0,
    },
    financialLedger: [],
    viewedEvidenceIds: [],
    evidenceSignals: [],
    introducedTermIds: [],
    selectedRiskPlans: [],
    predictions: [],
    visualState: { testedTouchpoints: [], testResults: [] },
    storeVisualState: {},
    pendingEffects: [],
    achievements: [],
    chapterReviews: [],
    decisions: [],
    traces: [],
  };
}

export function validateV11Condition(condition: V11Condition): V11Condition {
  return condition;
}
