import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type {
  GameContentV11,
  V11Choice,
  V11Condition,
  V11Evidence,
  V11Effect,
  V11RiskPlan,
  V11Round,
} from '@laojie/content-schema';
import type {
  FinancialLedgerEntryV11,
  PendingEffectV11,
  RiskOutcomeV11,
  V11Action,
  V11EvidenceAdjustment,
  V11GameState,
  V11ResourceSnapshot,
  V11RoundResult,
  V11TraceEntry,
  V11TriggeredEvent,
  V11VisualDiagnostic,
} from './v11.js';
import { ENGINE_VERSION_V11, createV11State } from './v11.js';
import { deriveV11RouteProfile, scoreV11State } from './v11-scoring.js';

export interface V11ApplyResult {
  state: V11GameState;
  trace: V11TraceEntry;
  stateHash: string;
}

function cloneState(state: V11GameState): V11GameState {
  return JSON.parse(JSON.stringify(state)) as V11GameState;
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`)
    .join(',')}}`;
}

export function hashV11State(state: V11GameState): string {
  return bytesToHex(sha256(utf8ToBytes(stableValue(state))));
}

export function hashV11Content(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(value))));
}

function currentRound(state: V11GameState, content: GameContentV11): V11Round {
  const round = content.rounds[state.roundIndex];
  if (!round) throw new Error('游戏已经完成');
  return round;
}

function actionValue(action: V11Action, key: string): unknown {
  return action.payload[key];
}

function stringValue(action: V11Action, key: string): string | undefined {
  const value = actionValue(action, key);
  return typeof value === 'string' ? value : undefined;
}

function stringArrayValue(action: V11Action, key: string): string[] | undefined {
  const value = actionValue(action, key);
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

/**
 * This is deliberately a local format check, not a quality judgement.  The
 * game must never call an external model to decide whether a student's name
 * is "good"; it only keeps the generated touchpoint text safe and readable.
 */
function isValidBrandName(value: string): boolean {
  const characters = [...value];
  return (
    characters.length >= 2 &&
    characters.length <= 24 &&
    /^[\p{L}\p{N}\s·&-]+$/u.test(value) &&
    !/^\s|\s$/.test(value)
  );
}

function resourceSnapshot(state: V11GameState): V11ResourceSnapshot {
  return {
    cashYuan: state.cashYuan,
    stageActionPoints: state.stageActionPoints,
    freeActionPoints: state.freeActionPoints,
    strategicActionPoints: state.strategicActionPoints,
    elapsedDays: state.elapsedDays,
    metrics: { ...state.metrics },
  };
}

function syncActionPointTotal(state: V11GameState): void {
  state.stageActionPoints = state.freeActionPoints + state.strategicActionPoints;
}

function resetRoundActionPoints(state: V11GameState, round: V11Round | undefined): void {
  state.freeActionPoints = round?.freeActionPointBudget ?? 0;
  state.strategicActionPoints = round?.strategicActionPointBudget ?? 0;
  syncActionPointTotal(state);
}

function ensureOpeningLedger(state: V11GameState): void {
  if (state.financialLedger.length > 0) return;
  state.financialLedger.push({
    entryId: 'ledger-opening',
    roundId: 'r00',
    category: 'opening',
    amountYuan: 500_000,
    elapsedDay: 0,
    sourceType: 'system',
    sourceId: 'initial-capital',
    descriptionKey: '初始创业资金',
  });
}

function spend(
  state: V11GameState,
  ledgerEntries: FinancialLedgerEntryV11[],
  input: {
    roundId: string;
    cashCostYuan: number;
    actionPointCost: number;
    actionPool: 'free' | 'strategy';
    durationDays: number;
    category: FinancialLedgerEntryV11['category'];
    sourceType: FinancialLedgerEntryV11['sourceType'];
    sourceId: string;
    decisionGroupId?: string;
    descriptionKey: string;
  },
): void {
  const availablePoints =
    input.actionPool === 'free' ? state.freeActionPoints : state.strategicActionPoints;
  if (availablePoints < input.actionPointCost) {
    throw new Error(
      input.actionPool === 'free'
        ? '自由行动力不够；已为战略选择保留 4 点行动力。'
        : '战略行动力不足；本轮只能执行一次战略方案。',
    );
  }
  if (state.cashYuan < input.cashCostYuan) throw new Error('现金不够，不能执行这项投入');
  ensureOpeningLedger(state);
  if (input.actionPool === 'free') state.freeActionPoints -= input.actionPointCost;
  else state.strategicActionPoints -= input.actionPointCost;
  syncActionPointTotal(state);
  state.cashYuan -= input.cashCostYuan;
  state.elapsedDays += input.durationDays;
  const entry: FinancialLedgerEntryV11 = {
    entryId: `ledger-${state.traces.length + 1}-${input.sourceId}`,
    roundId: input.roundId,
    ...(input.decisionGroupId ? { decisionGroupId: input.decisionGroupId } : {}),
    category: input.category,
    amountYuan: -input.cashCostYuan,
    elapsedDay: state.elapsedDays,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    descriptionKey: input.descriptionKey,
  };
  state.financialLedger.push(entry);
  ledgerEntries.push(entry);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function applyMetricEffects(
  state: V11GameState,
  effects: Array<{ key: string; amount: number }>,
): void {
  for (const effect of effects)
    state.metrics[effect.key] = clamp((state.metrics[effect.key] ?? 0) + effect.amount);
}

function conditionMatches(condition: V11Condition, state: V11GameState): boolean {
  switch (condition.type) {
    case 'metric_at_least':
      return (state.metrics[condition.key] ?? 0) >= condition.value;
    case 'metric_at_most':
      return (state.metrics[condition.key] ?? 0) <= condition.value;
    case 'choice_was':
      return state.decisions.some((decision) => decision.payload.choiceId === condition.choiceId);
    case 'evidence_viewed':
      return state.viewedEvidenceIds.includes(condition.evidenceId);
    case 'risk_plan_selected':
      return state.selectedRiskPlans.includes(condition.riskPlanId);
    case 'visual_was':
      return state.visualState.selectedVisualId === condition.visualId;
  }
}

function allConditionsMatch(conditions: V11Condition[], state: V11GameState): boolean {
  return conditions.every((condition) => conditionMatches(condition, state));
}

const CHAPTER_REVIEW_ROUND_IDS = new Set(['r02', 'r06', 'r09', 'r12']);

function findChoice(round: V11Round, choiceId: string): V11Choice {
  const choice = round.choices.find((item) => item.choiceId === choiceId);
  if (!choice) throw new Error(`当前轮次不存在选择：${choiceId}`);
  return choice;
}

function findEvidence(round: V11Round, evidenceId: string): V11Evidence {
  const evidence = round.evidence.find((item) => item.evidenceId === evidenceId);
  if (!evidence) throw new Error(`当前轮次不存在调查：${evidenceId}`);
  return evidence;
}

function findRiskPlan(round: V11Round, riskPlanId: string): V11RiskPlan {
  const riskPlan = round.riskPlans.find((item) => item.riskPlanId === riskPlanId);
  if (!riskPlan) throw new Error(`当前轮次不存在风险预案：${riskPlanId}`);
  return riskPlan;
}

export function canExecuteV11Action(
  state: V11GameState,
  content: GameContentV11,
  actionId: string,
): { ok: boolean; reason?: string } {
  const action = currentRound(state, content).stageActions.find(
    (item) => item.actionId === actionId,
  );
  if (!action) return { ok: false, reason: '当前没有这项行动。' };
  if (state.freeActionPoints < action.actionPointCost) {
    return {
      ok: false,
      reason: `还差 ${action.actionPointCost - state.freeActionPoints} 点自由行动力；战略行动力不能用于调查。`,
    };
  }
  if (state.cashYuan < action.cashCostYuan)
    return { ok: false, reason: '现金不足，暂时无法执行这项行动。' };
  return { ok: true };
}

export function canCommitV11Choice(
  state: V11GameState,
  content: GameContentV11,
  choiceId: string,
): { ok: boolean; reason?: string } {
  const choice = currentRound(state, content).choices.find((item) => item.choiceId === choiceId);
  if (!choice) return { ok: false, reason: '当前没有这个战略方案。' };
  if (state.strategicActionPoints < choice.actionPointCost) {
    return { ok: false, reason: '本轮的战略行动力不足以执行这个方案。' };
  }
  if (state.cashYuan < choice.cashCostYuan)
    return { ok: false, reason: '现金不足，暂时无法启动这个方案。' };
  if (currentRound(state, content).visualRequired && !state.visualState.selectedVisualId) {
    return { ok: false, reason: '先确定视觉系统，才能让本轮方案落地。' };
  }
  if (choice.visualRouteId && state.visualState.selectedVisualId !== choice.visualRouteId) {
    return { ok: false, reason: '这条方案需要使用对应的视觉路线，请先回到视觉检查中确认。' };
  }
  return { ok: true };
}

export function getV11RoundExitOptions(
  state: V11GameState,
  content: GameContentV11,
): { canCommit: boolean; canSkip: boolean } {
  const round = currentRound(state, content);
  return {
    canCommit: round.choices.some(
      (choice) => canCommitV11Choice(state, content, choice.choiceId).ok,
    ),
    canSkip: round.skipPolicy === 'allowed',
  };
}

function appendDecision(state: V11GameState, action: V11Action): void {
  state.decisions.push({
    actionId: action.actionId,
    type: action.type,
    ...(action.roundId ? { roundId: action.roundId } : {}),
    payload: { ...action.payload },
  });
}

function revealEvidence(state: V11GameState, evidence: V11Evidence): string[] {
  if (state.viewedEvidenceIds.includes(evidence.evidenceId)) return [];
  state.viewedEvidenceIds.push(evidence.evidenceId);
  state.evidenceSignals.push({
    evidenceId: evidence.evidenceId,
    viewedAtRoundIndex: state.roundIndex,
    relationIds: evidence.relations.map(
      (relation) => `${relation.targetType}:${relation.targetId}`,
    ),
  });
  return evidence.relations.map((relation) => relation.targetId);
}

function pendingEffect(
  effect: V11Choice['effects'][number],
  action: V11Action,
  dueRoundIndex: number,
): PendingEffectV11 {
  return {
    ...effect,
    sourceActionId: action.actionId,
    sourceRoundId: action.roundId ?? 'unknown',
    dueRoundIndex,
  };
}

function riskOutcome(round: V11Round, action: V11Action, choice: V11Choice): RiskOutcomeV11 {
  const riskPlanId = stringValue(action, 'riskPlanId');
  const predictionId = stringValue(action, 'predictionId');
  const hasDelayedDownside = choice.effects.some(
    (effect) => effect.timing === 'delayed' && effect.amount < 0,
  );
  if (riskPlanId && hasDelayedDownside) {
    return {
      riskPlanId,
      ...(predictionId ? { predictionId } : {}),
      status: 'mitigated',
      explanation: `你提前配置了“${round.riskPlans.find((plan) => plan.riskPlanId === riskPlanId)?.label ?? '风险预案'}”，延迟风险会被压低。`,
    };
  }
  if (riskPlanId) {
    return {
      riskPlanId,
      ...(predictionId ? { predictionId } : {}),
      status: 'not_triggered',
      explanation: '预案已经准备好，但这次经营没有触发它针对的主要风险。',
    };
  }
  return {
    ...(predictionId ? { predictionId } : {}),
    status: hasDelayedDownside ? 'missed' : 'not_selected',
    explanation: hasDelayedDownside
      ? '你没有配置风险预案，延迟风险会在后续阶段显现。'
      : '这次选择没有额外配置风险预案。',
  };
}

function makeTrace(
  state: V11GameState,
  action: V11Action,
  before: V11ResourceSnapshot,
  fields: Omit<
    V11TraceEntry,
    'sequence' | 'actionId' | 'actionType' | 'roundId' | 'before' | 'after'
  >,
): V11TraceEntry {
  return {
    sequence: state.traces.length + 1,
    actionId: action.actionId,
    actionType: action.type,
    ...(action.roundId ? { roundId: action.roundId } : {}),
    before,
    after: resourceSnapshot(state),
    ...fields,
  };
}

function evidenceAdjustmentsForChoice(
  state: V11GameState,
  round: V11Round,
  choice: V11Choice,
): V11EvidenceAdjustment[] {
  const adjustments: V11EvidenceAdjustment[] = [];
  for (const evidence of round.evidence) {
    if (!state.viewedEvidenceIds.includes(evidence.evidenceId)) continue;
    if (!choice.evidenceRelations.includes(evidence.evidenceId)) continue;
    for (const relation of evidence.relations) {
      if (relation.targetType !== 'choice' || relation.targetId !== choice.choiceId) continue;
      const direction =
        relation.relation === 'supports'
          ? 1
          : relation.relation === 'warns'
            ? -1
            : relation.relation === 'contradicts'
              ? -1
              : 0;
      const amount =
        direction === 0 ? 0 : direction * Math.max(1, Math.round((relation.strength / 100) * 4));
      adjustments.push({
        evidenceId: evidence.evidenceId,
        choiceId: choice.choiceId,
        relation: relation.relation,
        amount,
        explanation: relation.explanation,
      });
    }
  }
  return adjustments;
}

function mitigationRatio(round: V11Round, action: V11Action, choice: V11Choice): number {
  const riskPlanId = stringValue(action, 'riskPlanId');
  if (!riskPlanId || !choice.riskPlanIds.includes(riskPlanId)) return 0;
  return round.riskPlans.find((plan) => plan.riskPlanId === riskPlanId)?.mitigationRatio ?? 0;
}

function visualDiagnostic(
  round: V11Round,
  content: GameContentV11,
  visualId: string,
  testId: string,
): V11VisualDiagnostic {
  const visual = content.visualSystems.find((item) => item.visualId === visualId);
  const test = round.visualTests.find((item) => item.testId === testId);
  if (!visual || !test) throw new Error('视觉测试对象不存在');
  const factors = visual.matchFactors;
  const score = Math.round(
    testId.includes('sign-3-second')
      ? factors.touchpointFit
      : testId.includes('mobile-shrink')
        ? (factors.touchpointFit + factors.priceFit) / 2
        : testId.includes('wet')
          ? (factors.productFit + factors.touchpointFit) / 2
          : testId.includes('fold')
            ? (factors.touchpointFit + factors.productFit + factors.priceFit) / 3
            : testId.includes('occlusion') || testId.includes('packaging-stress')
              ? (factors.touchpointFit + factors.customerFit) / 2
              : (factors.touchpointFit + factors.productFit) / 2,
  );
  const passed = score >= 70;
  const metricChanges = passed ? { visualAdaptability: 2 } : { visualAdaptability: -2 };
  return {
    roundId: round.roundId,
    testId,
    title: test.title,
    score,
    passed,
    explanation: passed
      ? `“${visual.name}”在${test.title}中仍然清楚，当前适配得分为 ${score}。`
      : `“${visual.name}”在${test.title}中开始失效，当前适配得分为 ${score}；需要收紧触点规则。`,
    metricChanges,
  };
}

function applyRoundEconomy(
  state: V11GameState,
  round: V11Round,
  ledgerEntries: FinancialLedgerEntryV11[],
  decisionGroupId: string,
  durationDays: number,
): void {
  const addLedgerEntry = (
    input: Omit<FinancialLedgerEntryV11, 'entryId' | 'roundId' | 'decisionGroupId' | 'elapsedDay'>,
  ): void => {
    ensureOpeningLedger(state);
    state.cashYuan += input.amountYuan;
    const entry: FinancialLedgerEntryV11 = {
      ...input,
      entryId: `ledger-${state.traces.length + 1}-${input.sourceId}`,
      roundId: round.roundId,
      decisionGroupId,
      elapsedDay: state.elapsedDays,
    };
    state.financialLedger.push(entry);
    ledgerEntries.push(entry);
  };

  const fixedCost = round.fixedCostPerDayYuan * Math.max(0, durationDays);
  const overdueDays = Math.max(0, state.elapsedDays - round.targetElapsedDay);
  const overdueCost = round.overdueFixedCostPerDayYuan * overdueDays;
  if (fixedCost > 0) {
    addLedgerEntry({
      category: 'fixed_cost',
      amountYuan: -fixedCost,
      sourceType: 'event',
      sourceId: `fixed-cost-${round.roundId}`,
      descriptionKey: '门店固定经营成本',
    });
  }
  if (overdueCost > 0) {
    addLedgerEntry({
      category: 'fixed_cost',
      amountYuan: -overdueCost,
      sourceType: 'event',
      sourceId: `overdue-cost-${round.roundId}`,
      descriptionKey: '延期带来的额外固定成本',
    });
  }
  if (round.businessPhase === 'operating' && round.baseRevenueYuan > 0) {
    // A brand earns only when several real conditions work together. This
    // keeps visual, product, service and relationship decisions meaningful
    // without pretending that any single abstract metric is a cash button.
    const demandFactor =
      0.42 +
      (state.metrics.awareness ?? 0) * 0.0012 +
      (state.metrics.visualRecognition ?? 0) * 0.0008 +
      (state.metrics.conversion ?? 0) * 0.002 +
      (state.metrics.trust ?? 0) * 0.001 +
      (state.metrics.loyalty ?? 0) * 0.001;
    const valueFactor =
      0.9 +
      (state.metrics.culturalCredibility ?? 0) * 0.001 +
      (state.metrics.promiseCredibility ?? 0) * 0.0007 +
      (state.metrics.brandConsistency ?? 0) * 0.0004;
    // A struggling shop still has some sellable business, but cannot turn
    // demand into income indefinitely when its production or team is weak.
    const deliveryFactor = Math.max(
      0.35,
      Math.min(
        1,
        0.25 +
          (state.metrics.productDelivery ?? 0) * 0.006 +
          (state.metrics.orgCapacity ?? 0) * 0.002,
      ),
    );
    const reputationFactor = Math.max(
      0.65,
      1 -
        (state.metrics.reputationDebt ?? 0) * 0.0025 -
        (state.metrics.channelDependence ?? 0) * 0.001,
    );
    const revenue = Math.max(
      0,
      Math.round(
        round.baseRevenueYuan * demandFactor * valueFactor * deliveryFactor * reputationFactor,
      ),
    );
    addLedgerEntry({
      category: 'gross_profit',
      amountYuan: revenue,
      sourceType: 'event',
      sourceId: `gross-profit-${round.roundId}`,
      descriptionKey: '开店后的经营毛利',
    });
  }
}

function actualMetricChanges(
  before: Record<string, number>,
  after: Record<string, number>,
): Record<string, number> {
  const changes: Record<string, number> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const amount = (after[key] ?? 0) - (before[key] ?? 0);
    if (amount !== 0) changes[key] = amount;
  }
  return changes;
}

function endingFor(state: V11GameState, content: GameContentV11): string | undefined {
  const score = state.scoreBreakdown ?? scoreV11State(state, content);
  const dimensions = [score.survival, score.customer, score.brand, score.consistency];
  const matched = content.endings
    .filter((ending) => state.completedRoundIds.length >= ending.minimumRoundsRequired)
    .filter(
      (ending) =>
        dimensions.filter((value) => value >= 35).length >= ending.minimumDimensionsRequired,
    )
    .find((ending) => !ending.fallback && allConditionsMatch(ending.conditions, state));
  return matched?.endingId ?? content.endings.find((ending) => ending.fallback)?.endingId;
}

function settleResult(
  state: V11GameState,
  content: GameContentV11,
  round: V11Round,
  choice: V11Choice,
  action: V11Action,
  ledgerEntries: FinancialLedgerEntryV11[],
): {
  result: V11RoundResult;
  scheduledEffects: PendingEffectV11[];
  maturedEffects: PendingEffectV11[];
} {
  const metricsBeforeSettlement = { ...state.metrics };
  const maturedEffects = state.pendingEffects.filter(
    (effect) => effect.dueRoundIndex <= state.roundIndex,
  );
  state.pendingEffects = state.pendingEffects.filter(
    (effect) => effect.dueRoundIndex > state.roundIndex,
  );
  applyMetricEffects(state, maturedEffects);

  const ratio = mitigationRatio(round, action, choice);
  const effectiveEffects = choice.effects.map((effect) =>
    effect.timing === 'delayed' && effect.amount < 0 && ratio > 0
      ? { ...effect, amount: Math.ceil((effect.amount * (100 - ratio)) / 100) }
      : effect,
  );
  const immediateEffects = effectiveEffects.filter((effect) => effect.timing === 'immediate');
  const scheduledEffects = effectiveEffects
    .filter((effect) => effect.timing === 'delayed')
    .map((effect) => pendingEffect(effect, action, state.roundIndex + 1));
  applyMetricEffects(state, immediateEffects);
  state.pendingEffects.push(...scheduledEffects);

  const choiceEvidence = round.evidence
    .filter((evidence) => state.viewedEvidenceIds.includes(evidence.evidenceId))
    .filter((evidence) => choice.evidenceRelations.includes(evidence.evidenceId))
    .map((evidence) => evidence.evidenceId);
  const evidenceAdjustments = evidenceAdjustmentsForChoice(state, round, choice);
  applyMetricEffects(
    state,
    evidenceAdjustments.map((adjustment) => ({
      key: choice.effects[0]?.key ?? 'segmentFit',
      amount: adjustment.amount,
    })),
  );
  const decisionGroupId = stringValue(action, 'decisionGroupId') ?? `dg-${round.roundId}`;
  const risk = riskOutcome(round, action, choice);
  const triggeredEvents: V11TriggeredEvent[] = content.events
    .filter((event) => event.triggerRoundId === round.roundId)
    .filter((event) => allConditionsMatch(event.conditions, state))
    .map((event) => ({
      eventId: event.eventId,
      title: event.title,
      text: event.text,
      sourceRoundId: event.triggerRoundId,
      effects: event.effects,
    }));
  for (const triggeredEvent of triggeredEvents) {
    const eventImmediate = triggeredEvent.effects.filter((effect) => effect.timing === 'immediate');
    const eventScheduled = triggeredEvent.effects
      .filter((effect) => effect.timing === 'delayed')
      .map((effect) => pendingEffect(effect, action, state.roundIndex + 1));
    applyMetricEffects(state, eventImmediate);
    state.pendingEffects.push(...eventScheduled);
    immediateEffects.push(...eventImmediate);
    scheduledEffects.push(...eventScheduled);
  }
  const newAchievements = content.achievements
    .filter((achievement) => !state.achievements.includes(achievement.achievementId))
    .filter((achievement) => allConditionsMatch(achievement.conditions, state))
    .map((achievement) => achievement.achievementId);
  state.achievements.push(...newAchievements);
  const reactions = round.resultPresentation.characterReactions
    .filter((reaction) => allConditionsMatch(reaction.conditions, state))
    .map((reaction) => reaction.text);
  const outcomeState = resultOutcomeState(state);
  const result: V11RoundResult = {
    resultType: 'choice',
    roundId: round.roundId,
    choiceId: choice.choiceId,
    choiceLabel: choice.label,
    decisionGroupId,
    cashCostYuan: choice.cashCostYuan,
    actionPointCost: choice.actionPointCost,
    durationDays: choice.durationDays,
    workload: choice.workload,
    ledgerEntries: [...ledgerEntries],
    metricChanges: actualMetricChanges(metricsBeforeSettlement, state.metrics),
    causeSources: [choice.choiceId, ...choiceEvidence],
    evidenceAdjustments,
    immediateEffects,
    maturedEffects,
    scheduledEffects,
    riskOutcome: risk,
    triggeredEvents,
    characterReactions: reactions,
    sceneKey: `result-${round.roundId}`,
    outcomeState,
    routeOverlayKey: state.visualState.selectedVisualId
      ? `route-${state.visualState.selectedVisualId}`
      : 'route-none',
    resultArtKey: choice.resultArtKey || round.resultPresentation.resultArtKey,
    motionCue: choice.motionCue || round.resultPresentation.motionCue,
    newAchievements,
    visualDiagnostics: (state.visualState.testResults ?? []).filter(
      (item) => item.roundId === round.roundId,
    ),
  };
  return { result, scheduledEffects, maturedEffects };
}

function resultOutcomeState(state: V11GameState): 'stable' | 'strained' | 'crisis' {
  const delivery = state.metrics.productDelivery ?? 0;
  const capacity = state.metrics.orgCapacity ?? 0;
  const reputationDebt = state.metrics.reputationDebt ?? 0;
  if (delivery < 25 || capacity < 25 || reputationDebt >= 70) return 'crisis';
  if (delivery < 50 || capacity < 50 || reputationDebt >= 35) return 'strained';
  return 'stable';
}

function settleSkippedRound(
  state: V11GameState,
  content: GameContentV11,
  round: V11Round,
  action: V11Action,
  ledgerEntries: FinancialLedgerEntryV11[],
): V11RoundResult {
  const metricsBeforeSettlement = { ...state.metrics };
  const maturedEffects = state.pendingEffects.filter(
    (effect) => effect.dueRoundIndex <= state.roundIndex,
  );
  state.pendingEffects = state.pendingEffects.filter(
    (effect) => effect.dueRoundIndex > state.roundIndex,
  );
  applyMetricEffects(state, maturedEffects);
  const decisionGroupId = `skip-${round.roundId}`;
  applyRoundEconomy(state, round, ledgerEntries, decisionGroupId, round.skipDurationDays);
  const triggeredEvents: V11TriggeredEvent[] = content.events
    .filter((event) => event.triggerRoundId === round.roundId)
    .filter((event) => allConditionsMatch(event.conditions, state))
    .map((event) => ({
      eventId: event.eventId,
      title: event.title,
      text: event.text,
      sourceRoundId: event.triggerRoundId,
      effects: event.effects,
    }));
  const immediateEffects = triggeredEvents.flatMap((event) =>
    event.effects.filter((effect) => effect.timing === 'immediate'),
  );
  const scheduledEffects = triggeredEvents
    .flatMap((event) => event.effects.filter((effect) => effect.timing === 'delayed'))
    .map((effect) => pendingEffect(effect, action, state.roundIndex + 1));
  applyMetricEffects(state, immediateEffects);
  state.pendingEffects.push(...scheduledEffects);
  const newAchievements = content.achievements
    .filter((achievement) => !state.achievements.includes(achievement.achievementId))
    .filter((achievement) => allConditionsMatch(achievement.conditions, state))
    .map((achievement) => achievement.achievementId);
  state.achievements.push(...newAchievements);
  return {
    resultType: 'skip',
    roundId: round.roundId,
    choiceId: 'choice-skipped',
    choiceLabel: '本轮不新增战略方案',
    decisionGroupId,
    cashCostYuan: 0,
    actionPointCost: 0,
    durationDays: round.skipDurationDays,
    workload: 0,
    ledgerEntries: [...ledgerEntries],
    metricChanges: actualMetricChanges(metricsBeforeSettlement, state.metrics),
    causeSources: maturedEffects.map((effect) => effect.sourceActionId),
    evidenceAdjustments: [],
    immediateEffects,
    maturedEffects,
    scheduledEffects,
    riskOutcome: {
      status: 'not_selected',
      explanation: '本轮没有启动新的战略方案；既有经营仍照常结算。',
    },
    triggeredEvents,
    characterReactions: [],
    sceneKey: `result-${round.roundId}`,
    outcomeState: resultOutcomeState(state),
    routeOverlayKey: state.visualState.selectedVisualId
      ? `route-${state.visualState.selectedVisualId}`
      : 'route-none',
    resultArtKey: round.resultPresentation.resultArtKey,
    motionCue: 'round-skip-settlement',
    newAchievements,
    visualDiagnostics: [],
  };
}

export function applyV11Action(
  inputState: V11GameState,
  content: GameContentV11,
  action: V11Action,
  _seed: string,
  options?: { skipStateHash?: boolean; mutateInputState?: boolean },
): V11ApplyResult {
  // The slice is deterministic from the action/content stream; keep the seed
  // in the protocol for future bounded event rolls without reading time,
  // randomness, or external state here.
  void _seed;
  const state = options?.mutateInputState ? inputState : cloneState(inputState);
  // Snapshots created before the chapter-review action was introduced remain
  // readable; initialize the additive field when such a snapshot resumes.
  state.chapterReviews ??= [];
  state.visualState.testResults ??= [];
  const before = resourceSnapshot(state);
  const ledgerEntries: FinancialLedgerEntryV11[] = [];
  const immediateEffects: V11RoundResult['immediateEffects'] = [];
  const scheduledEffects: PendingEffectV11[] = [];
  const maturedEffects: PendingEffectV11[] = [];
  const evidenceRelations: string[] = [];
  const evidenceAdjustments: V11EvidenceAdjustment[] = [];
  const triggeredEvents: V11TriggeredEvent[] = [];
  const visualDiagnostics: V11VisualDiagnostic[] = [];
  let risk: RiskOutcomeV11 | undefined;
  let result: V11RoundResult | undefined;
  let explanation = '记录了一次经营操作。';

  if (state.pendingRoundResult && action.type !== 'round_result_acknowledged')
    throw new Error('请先确认本轮结果');
  if (state.decisions.some((decision) => decision.actionId === action.actionId))
    throw new Error(`动作已经提交过：${action.actionId}`);

  if (action.type === 'onboarding_completed') {
    appendDecision(state, action);
    explanation = '完成了游戏序章。';
  } else if (action.type === 'chapter_review_acknowledged') {
    const reviewRoundId = action.roundId;
    if (!reviewRoundId || !CHAPTER_REVIEW_ROUND_IDS.has(reviewRoundId)) {
      throw new Error('当前没有需要确认的章节体检。');
    }
    if (state.completedRoundIds.at(-1) !== reviewRoundId) {
      throw new Error('请先完成上一轮结果，再确认章节体检。');
    }
    if (state.chapterReviews.includes(reviewRoundId)) {
      throw new Error('这一章已经确认过了。');
    }
    appendDecision(state, action);
    state.chapterReviews.push(reviewRoundId);
    explanation = '看完了这一章的经营体检，记下当前矛盾，继续进入下一阶段。';
  } else {
    const round = currentRound(state, content);
    if (action.roundId !== round.roundId) throw new Error(`动作轮次错误，当前是 ${round.roundId}`);

    switch (action.type) {
      case 'stage_action_selected':
      case 'question_action_executed': {
        const actionId = stringValue(action, 'actionId');
        const stageAction = round.stageActions.find((item) => item.actionId === actionId);
        if (!stageAction) throw new Error(`当前轮次不存在行动：${actionId ?? '未填写'}`);
        appendDecision(state, action);
        spend(state, ledgerEntries, {
          roundId: round.roundId,
          cashCostYuan: stageAction.cashCostYuan,
          actionPointCost: stageAction.actionPointCost,
          actionPool: 'free',
          durationDays: stageAction.durationDays,
          category:
            stageAction.actionType === 'research' ? 'research_cost' : 'strategic_investment',
          sourceType: 'stage_action',
          sourceId: stageAction.actionId,
          descriptionKey: stageAction.label,
        });
        const revealed = (stageAction.revealsEvidenceIds ?? [])
          .map((evidenceId) => findEvidence(round, evidenceId))
          .flatMap((evidence) => {
            const relations = revealEvidence(state, evidence);
            return relations.length > 0 ? [{ evidence, relations }] : [];
          });
        for (const item of revealed) evidenceRelations.push(...item.relations);
        explanation =
          revealed.length > 0
            ? `完成“${stageAction.label}”，拿到了${revealed.map((item) => `“${item.evidence.title}”`).join('、')}。现在可以据此比较相关方案。`
            : `完成了“${stageAction.label}”。这一步把投入和限制核算清楚了。`;
        break;
      }
      case 'evidence_viewed': {
        const evidenceId = stringValue(action, 'evidenceId');
        if (!evidenceId) throw new Error('缺少调查 ID');
        const evidence = findEvidence(round, evidenceId);
        const requiresActionToReveal = round.stageActions.some((stageAction) =>
          stageAction.revealsEvidenceIds?.includes(evidence.evidenceId),
        );
        if (requiresActionToReveal && !state.viewedEvidenceIds.includes(evidence.evidenceId)) {
          throw new Error('先完成能带回这条结果的行动，再来查看。');
        }
        appendDecision(state, action);
        evidenceRelations.push(
          ...(state.viewedEvidenceIds.includes(evidence.evidenceId)
            ? evidence.relations.map((relation) => relation.targetId)
            : revealEvidence(state, evidence)),
        );
        explanation = `查看了“${evidence.title}”。阅读结果不再重复花费资源。`;
        break;
      }
      case 'choice_previewed': {
        const choiceId = stringValue(action, 'choiceId');
        if (!choiceId) throw new Error('缺少选择 ID');
        findChoice(round, choiceId);
        appendDecision(state, action);
        explanation = '比较了一项方案，但还没有正式提交。';
        break;
      }
      case 'key_prediction_selected': {
        if (!['r01', 'r05', 'r08', 'r11'].includes(round.roundId))
          throw new Error('这一轮不需要额外做结果判断。');
        const predictionId = stringValue(action, 'predictionId');
        const expectedMetric = stringValue(action, 'expectedMetric');
        if (!predictionId || !expectedMetric) throw new Error('请选择你认为最先会变化的一项。');
        if (
          !['conversion', 'visualRecognition', 'productDelivery', 'trust'].includes(expectedMetric)
        ) {
          throw new Error('请选择顾客购买、品牌识别、交付稳定或顾客信任。');
        }
        if (state.predictions.some((prediction) => prediction.roundId === round.roundId))
          throw new Error('这一轮已经记录过判断。');
        appendDecision(state, action);
        state.predictions.push({
          predictionId,
          roundId: round.roundId,
          label: expectedMetric,
          expectedRisk: expectedMetric,
        });
        explanation = '已记下你的判断。结果页会拿它和实际变化对照。';
        break;
      }
      case 'terms_introduced': {
        const termIds = stringArrayValue(action, 'termIds');
        const permitted = new Set(
          (content.termGlossary ?? [])
            .filter((term) => term.firstUseRoundId === round.roundId)
            .map((term) => term.termId),
        );
        if (!termIds || termIds.length === 0 || termIds.some((termId) => !permitted.has(termId))) {
          throw new Error('这轮没有可介绍的课程词。');
        }
        appendDecision(state, action);
        state.introducedTermIds = [...new Set([...state.introducedTermIds, ...termIds])];
        explanation = '已用日常说法解释本轮需要用到的品牌概念。';
        break;
      }
      case 'brand_identity_declared': {
        if (round.roundId !== 'r05') throw new Error('品牌名和品牌人格需要在品牌身份阶段确认。');
        const brandName = stringValue(action, 'brandName')?.trim();
        const namingIntent = stringValue(action, 'namingIntent')?.trim();
        const personality = stringValue(action, 'personality')?.trim();
        const identityArchitecture = stringValue(action, 'identityArchitecture');
        if (!brandName || !isValidBrandName(brandName))
          throw new Error('品牌名请用 2—24 个中英文、数字或常用连接符填写。');
        if (!namingIntent || namingIntent.length > 80)
          throw new Error('请用不超过 80 个字说明命名想表达什么。');
        if (!personality || personality.length > 60)
          throw new Error('请用不超过 60 个字说明品牌人格。');
        if (
          identityArchitecture !== 'wordmark' &&
          identityArchitecture !== 'symbol' &&
          identityArchitecture !== 'ip'
        ) {
          throw new Error('请选择文字标志、符号标志或 IP 作为身份架构。');
        }
        appendDecision(state, action);
        state.brandIdentity = { brandName, namingIntent, personality, identityArchitecture };
        explanation = `品牌名“${brandName}”已写入店铺档案；后续视觉触点会沿用这份身份设定。`;
        break;
      }
      case 'risk_plan_selected': {
        const riskPlanId = stringValue(action, 'riskPlanId');
        if (!riskPlanId) throw new Error('缺少风险预案 ID');
        const riskPlan = findRiskPlan(round, riskPlanId);
        if (state.selectedRiskPlans.includes(riskPlanId))
          throw new Error('这份风险预案已经选择过了');
        if (
          state.decisions.some(
            (decision) =>
              decision.type === 'risk_plan_selected' && decision.roundId === round.roundId,
          )
        ) {
          throw new Error('本轮已经配置过一项风险预案，请把资源留给战略选择。');
        }
        appendDecision(state, action);
        spend(state, ledgerEntries, {
          roundId: round.roundId,
          cashCostYuan: riskPlan.cashCostYuan,
          actionPointCost: riskPlan.actionPointCost,
          actionPool: 'free',
          durationDays: 0,
          category: 'strategic_investment',
          sourceType: 'risk_plan',
          sourceId: riskPlan.riskPlanId,
          descriptionKey: riskPlan.label,
        });
        state.selectedRiskPlans.push(riskPlan.riskPlanId);
        explanation = `为“${riskPlan.targetRisk}”留了一份预案。`;
        break;
      }
      case 'visual_selected': {
        const visualId = stringValue(action, 'visualId');
        if (!visualId || !content.visualSystems.some((visual) => visual.visualId === visualId))
          throw new Error(`不存在的视觉方案：${visualId ?? '未填写'}`);
        if (
          state.completedRoundIds.includes('r08') &&
          state.visualState.selectedVisualId &&
          state.visualState.selectedVisualId !== visualId
        ) {
          throw new Error('视觉路线已在上一轮确定；这里请继续检查它在真实触点中的表现。');
        }
        appendDecision(state, action);
        state.visualState.selectedVisualId = visualId;
        state.storeVisualState.visualId = visualId;
        const visual = content.visualSystems.find((item) => item.visualId === visualId);
        if (visual) {
          const visualMatchScore = scoreV11State(state, content, visual).visualMatchScore;
          state.visualState.matchScore = visualMatchScore;
          state.storeVisualState.matchScore = visualMatchScore;
        }
        explanation = '选定了一套视觉系统，接下来要看它能不能进入真实触点。';
        break;
      }
      case 'visual_tested': {
        const visualId = stringValue(action, 'visualId') ?? state.visualState.selectedVisualId;
        const testId = stringValue(action, 'testId');
        if (!visualId || !state.visualState.selectedVisualId) throw new Error('请先选择视觉方案');
        if (visualId !== state.visualState.selectedVisualId)
          throw new Error('视觉测试方案与当前选择不一致');
        if (!testId || !round.visualTests.some((test) => test.testId === testId))
          throw new Error(`当前轮次不存在视觉测试：${testId ?? '未填写'}`);
        if (state.visualState.testedTouchpoints.includes(testId))
          throw new Error('这个视觉测试已经完成了');
        appendDecision(state, action);
        spend(state, ledgerEntries, {
          roundId: round.roundId,
          cashCostYuan: 0,
          actionPointCost: 1,
          actionPool: 'free',
          durationDays: 0,
          category: 'research_cost',
          sourceType: 'stage_action',
          sourceId: testId,
          descriptionKey: `视觉测试：${testId}`,
        });
        state.visualState.testedTouchpoints.push(testId);
        const diagnostic = visualDiagnostic(round, content, visualId, testId);
        state.visualState.testResults.push(diagnostic);
        const diagnosticEffects = Object.entries(diagnostic.metricChanges).map(([key, amount]) => ({
          key: key as V11Effect['key'],
          amount,
          timing: 'immediate' as const,
          label: diagnostic.passed
            ? `视觉测试通过：${diagnostic.title}`
            : `视觉测试暴露问题：${diagnostic.title}`,
          theoryId: 't-touchpoint',
        }));
        applyMetricEffects(state, diagnosticEffects);
        visualDiagnostics.push(diagnostic);
        immediateEffects.push(...diagnosticEffects);
        explanation = `${diagnostic.explanation}`;
        break;
      }
      case 'choice_committed': {
        const choiceId = stringValue(action, 'choiceId');
        const decisionGroupId = stringValue(action, 'decisionGroupId');
        if (!choiceId) throw new Error('缺少选择 ID');
        if (!decisionGroupId) throw new Error('正式选择必须带有决策组');
        if (round.visualRequired && !state.visualState.selectedVisualId)
          throw new Error('请先选择视觉方案');
        const choice = findChoice(round, choiceId);
        if (choice.visualRouteId && state.visualState.selectedVisualId !== choice.visualRouteId) {
          throw new Error('这条视觉策略和当前选中的视觉路线不一致；请返回视觉检查后再提交。');
        }
        const riskPlanId = stringValue(action, 'riskPlanId');
        if (riskPlanId && !choice.riskPlanIds.includes(riskPlanId))
          throw new Error('这份风险预案不适用于当前方案');
        appendDecision(state, action);
        spend(state, ledgerEntries, {
          roundId: round.roundId,
          cashCostYuan: choice.cashCostYuan,
          actionPointCost: choice.actionPointCost,
          actionPool: 'strategy',
          durationDays: choice.durationDays,
          category: 'strategic_investment',
          sourceType: 'choice',
          sourceId: choice.choiceId,
          decisionGroupId,
          descriptionKey: choice.label,
        });
        applyRoundEconomy(state, round, ledgerEntries, decisionGroupId, choice.durationDays);
        const settled = settleResult(state, content, round, choice, action, ledgerEntries);
        result = settled.result;
        scheduledEffects.push(...settled.scheduledEffects);
        maturedEffects.push(...settled.maturedEffects);
        immediateEffects.push(...result.immediateEffects);
        evidenceAdjustments.push(...result.evidenceAdjustments);
        triggeredEvents.push(...result.triggeredEvents);
        risk = result.riskOutcome;
        state.completedRoundIds.push(round.roundId);
        state.pendingRoundResult = result;
        state.storeVisualState.roundId = round.roundId;
        explanation = `执行了“${choice.label}”，结果等待确认。`;
        break;
      }
      case 'choice_skipped': {
        if (round.skipPolicy !== 'allowed')
          throw new Error('本轮需要完成一项战略选择，不能直接跳过。');
        appendDecision(state, action);
        result = settleSkippedRound(state, content, round, action, ledgerEntries);
        immediateEffects.push(...result.immediateEffects);
        scheduledEffects.push(...result.scheduledEffects);
        maturedEffects.push(...result.maturedEffects);
        triggeredEvents.push(...result.triggeredEvents);
        risk = result.riskOutcome;
        state.completedRoundIds.push(round.roundId);
        state.pendingRoundResult = result;
        explanation = '本轮没有启动新方案。已花的资源不会退回，既有经营和到期影响照常结算。';
        break;
      }
      case 'round_result_acknowledged': {
        if (!state.pendingRoundResult) throw new Error('当前没有待确认的经营结果');
        if (
          stringValue(action, 'resultId') &&
          stringValue(action, 'resultId') !== `result-${round.roundId}`
        )
          throw new Error('结果确认对象错误');
        appendDecision(state, action);
        state.pendingRoundResult = undefined;
        state.roundIndex += 1;
        const nextRound = content.rounds[state.roundIndex];
        resetRoundActionPoints(state, nextRound);
        if (state.roundIndex >= content.rounds.length) {
          state.scoreBreakdown = scoreV11State(state, content);
          state.routeProfile = deriveV11RouteProfile(state, content);
          const ending = endingFor(state, content);
          if (ending) state.ending = ending;
        }
        explanation = '确认了本轮结果，准备进入下一阶段。';
        break;
      }
    }
  }

  const trace = makeTrace(state, action, before, {
    ...(stringValue(action, 'decisionGroupId')
      ? { decisionGroupId: stringValue(action, 'decisionGroupId') }
      : {}),
    ledgerEntries,
    evidenceRelations,
    evidenceAdjustments,
    triggeredEvents,
    ...(risk ? { riskOutcome: risk } : {}),
    immediateEffects,
    scheduledEffects,
    maturedEffects,
    ...(visualDiagnostics.length > 0 ? { visualDiagnostics } : {}),
    ...(result ? { result } : {}),
    explanation,
  });
  state.traces.push(trace);
  return { state, trace, stateHash: options?.skipStateHash ? '' : hashV11State(state) };
}

export function replayV11(
  content: GameContentV11,
  playthroughId: string,
  seed: string,
  actions: V11Action[],
): V11GameState {
  let state = createV11State(content.contentVersion, playthroughId);
  for (const action of actions) state = applyV11Action(state, content, action, seed).state;
  return state;
}

export { ENGINE_VERSION_V11 };
