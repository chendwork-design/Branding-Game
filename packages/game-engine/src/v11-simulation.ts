import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { GameContentV11, V11Choice, V11Round, V11StageAction } from '@laojie/content-schema';
import {
  applyV11Action,
  canCommitV11Choice,
  canExecuteV11Action,
  getV11RoundExitOptions,
  hashV11State,
} from './v11-runtime.js';
import { createV11State, type V11Action, type V11GameState } from './v11.js';
import { deriveV11RouteProfile } from './v11-scoring.js';

/**
 * Deterministic policy agents exercise the same legal exits as the student
 * client. They make balance checks answer a useful question: what happens
 * when a player values evidence, cash, growth, risk, skipping, or visuals?
 */
export type V11SimulationStrategy =
  | 'evidence-first'
  | 'cash-conservative'
  | 'growth-first'
  | 'risk-manager'
  | 'skip-when-stretched'
  | 'visual-first';

const STRATEGIES: readonly V11SimulationStrategy[] = [
  'evidence-first',
  'cash-conservative',
  'growth-first',
  'risk-manager',
  'skip-when-stretched',
  'visual-first',
];

export interface V11SimulationReport {
  completedRuns: number;
  minimumFinalCashYuan: number;
  choiceShares: Record<string, number>;
  distinctRouteIds: number;
  endingShares: Record<string, number>;
  distinctEndingIds: number;
}

export interface V11StrategyReport extends V11SimulationReport {
  strategy: V11SimulationStrategy;
  iterations: number;
  deadlockedRuns: number;
  invalidActionRuns: number;
  skippedRounds: number;
  incomeRuns: number;
  averageOperatingIncomeYuan: number;
  averageNetCashChangeYuan: number;
  averageActionCount: number;
  distinctChoiceIds: number;
  actionSequenceFingerprint: string;
  finalStateFingerprint: string;
}

export interface V11StrategySimulationReport {
  iterationsPerStrategy: number;
  strategies: Record<V11SimulationStrategy, V11StrategyReport>;
  completedRuns: number;
  deadlockedRuns: number;
  distinctRouteIds: number;
  distinctEndingIds: number;
}

function deriveIndex(seed: string, key: string, max: number): number {
  const digest = hmac(sha256, utf8ToBytes(seed), utf8ToBytes(key));
  const number = Number.parseInt(bytesToHex(digest.slice(0, 4)), 16);
  return number % Math.max(1, max);
}

function simulationAction(
  run: number,
  step: number,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown>,
  prefix: string,
): V11Action {
  return {
    protocolVersion: '1.2',
    actionId: `${prefix}-${run}-${step}`,
    type,
    ...(roundId ? { roundId } : {}),
    payload,
  };
}

function applySimulationAction(
  state: V11GameState,
  content: GameContentV11,
  action: V11Action,
  seed: string,
): V11GameState {
  const next = applyV11Action(state, content, action, seed, {
    skipStateHash: true,
    mutateInputState: true,
  }).state;
  // A balance sweep only needs the resulting state. Discard the in-memory
  // trace payload between actions so 50,000 replays remain bounded.
  next.traces = [];
  return next;
}

function immediateValue(choice: V11Choice, key: string): number {
  return choice.effects
    .filter((effect) => effect.timing === 'immediate' && effect.key === key)
    .reduce((sum, effect) => sum + effect.amount, 0);
}

function delayedDownside(choice: V11Choice): number {
  return choice.effects
    .filter((effect) => effect.timing === 'delayed' && effect.amount < 0)
    .reduce((sum, effect) => sum + Math.abs(effect.amount), 0);
}

function evidenceValue(round: V11Round, state: V11GameState, choice: V11Choice): number {
  return round.evidence
    .filter((evidence) => state.viewedEvidenceIds.includes(evidence.evidenceId))
    .filter((evidence) => choice.evidenceRelations.includes(evidence.evidenceId))
    .flatMap((evidence) => evidence.relations)
    .filter((relation) => relation.targetType === 'choice' && relation.targetId === choice.choiceId)
    .reduce(
      (score, relation) =>
        score +
        (relation.relation === 'supports'
          ? relation.strength
          : relation.relation === 'warns' || relation.relation === 'contradicts'
            ? -relation.strength
            : Math.round(relation.strength / 3)),
      0,
    );
}

function choiceScore(
  strategy: V11SimulationStrategy,
  round: V11Round,
  state: V11GameState,
  choice: V11Choice,
): number {
  const totalImmediate = choice.effects
    .filter((effect) => effect.timing === 'immediate')
    .reduce((sum, effect) => sum + effect.amount, 0);
  const totalDelayed = choice.effects
    .filter((effect) => effect.timing === 'delayed')
    .reduce((sum, effect) => sum + effect.amount, 0);
  switch (strategy) {
    case 'evidence-first':
      return (
        evidenceValue(round, state, choice) * 5 +
        totalImmediate * 2 +
        totalDelayed -
        choice.cashCostYuan / 20_000
      );
    case 'cash-conservative':
      return (
        -choice.cashCostYuan / 1_000 + totalImmediate + totalDelayed - choice.actionPointCost * 4
      );
    case 'growth-first':
      return (
        immediateValue(choice, 'awareness') * 3 +
        immediateValue(choice, 'conversion') * 3 +
        immediateValue(choice, 'differentiation') * 2 +
        immediateValue(choice, 'loyalty') +
        totalImmediate -
        delayedDownside(choice) * 0.5
      );
    case 'risk-manager':
      return (
        (choice.riskPlanIds.length > 0 ? 18 : 0) +
        totalImmediate * 2 +
        totalDelayed -
        delayedDownside(choice) * 2 -
        choice.cashCostYuan / 25_000
      );
    case 'skip-when-stretched':
      return totalImmediate * 2 + totalDelayed - choice.cashCostYuan / 18_000 - choice.workload * 2;
    case 'visual-first':
      return (
        immediateValue(choice, 'visualRecognition') * 4 +
        immediateValue(choice, 'visualAdaptability') * 3 +
        immediateValue(choice, 'brandConsistency') * 2 +
        totalImmediate
      );
  }
}

function stageActionScore(strategy: V11SimulationStrategy, action: V11StageAction): number {
  const evidence =
    (action.revealsEvidenceIds?.length ?? 0) * 12 + (action.helpsCompareChoiceIds?.length ?? 0) * 5;
  const cost = action.cashCostYuan / 2_000 + action.actionPointCost * 3;
  if (strategy === 'evidence-first' || strategy === 'risk-manager') return evidence * 2 - cost;
  if (strategy === 'cash-conservative')
    return (action.cashCostYuan === 0 ? 12 : 0) + evidence - cost;
  if (strategy === 'visual-first') return (action.actionType === 'test' ? 16 : 0) + evidence - cost;
  return evidence - cost;
}

function shouldSkip(
  strategy: V11SimulationStrategy,
  run: number,
  round: V11Round,
  state: V11GameState,
): boolean {
  if (round.skipPolicy !== 'allowed') return false;
  const stretched = state.cashYuan < Math.max(120_000, round.baseRevenueYuan * 1.3);
  if (strategy === 'skip-when-stretched')
    return stretched || deriveIndex(`skip-${run}`, round.roundId, 4) === 0;
  if (strategy === 'cash-conservative')
    return stretched && deriveIndex(`cash-skip-${run}`, round.roundId, 3) === 0;
  return false;
}

function selectVisualId(
  strategy: V11SimulationStrategy,
  run: number,
  round: V11Round,
  content: GameContentV11,
  choice?: V11Choice,
): string | undefined {
  if (choice?.visualRouteId) return choice.visualRouteId;
  if (content.visualSystems.length === 0) return undefined;
  if (strategy === 'visual-first') {
    const ranked = [...content.visualSystems].sort((left, right) => {
      const leftScore =
        left.matchFactors.touchpointFit +
        left.matchFactors.productFit +
        left.matchFactors.cultureFit;
      const rightScore =
        right.matchFactors.touchpointFit +
        right.matchFactors.productFit +
        right.matchFactors.cultureFit;
      return rightScore - leftScore;
    });
    return ranked[deriveIndex(`visual-${run}`, round.roundId, ranked.length)]?.visualId;
  }
  return content.visualSystems[
    deriveIndex(`visual-${run}`, round.roundId, content.visualSystems.length)
  ]?.visualId;
}

function usedStageActionIds(state: V11GameState, round: V11Round): Set<string> {
  return new Set(
    state.decisions
      .filter((decision) => decision.roundId === round.roundId)
      .map((decision) => decision.payload.actionId)
      .filter((actionId): actionId is string => typeof actionId === 'string'),
  );
}

interface RunResult {
  state: V11GameState;
  choices: string[];
  skippedRounds: number;
  operatingIncomeYuan: number;
  deadlocked: boolean;
  invalidAction: boolean;
  actionCount: number;
  actionSequenceFingerprint: string;
  finalStateHash: string;
}

function runSimulation(
  content: GameContentV11,
  run: number,
  strategy: V11SimulationStrategy,
): RunResult {
  const seed = `simulation-seed-${strategy}-${run}`;
  const prefix = `sim-${strategy}`;
  let state = createV11State(content.contentVersion, `simulation-${strategy}-${run}`);
  let step = 0;
  const choices: string[] = [];
  let skippedRounds = 0;
  let deadlocked = false;
  let invalidAction = false;
  const actionSequence: string[] = [];
  const dispatch = (
    type: V11Action['type'],
    roundId: string | undefined,
    payload: Record<string, unknown>,
  ): boolean => {
    try {
      actionSequence.push(`${type}:${roundId ?? ''}:${JSON.stringify(payload)}`);
      state = applySimulationAction(
        state,
        content,
        simulationAction(run, step++, type, roundId, payload, prefix),
        seed,
      );
      return true;
    } catch {
      invalidAction = true;
      return false;
    }
  };

  if (!dispatch('onboarding_completed', undefined, {})) {
    return {
      state,
      choices,
      skippedRounds,
      operatingIncomeYuan: 0,
      deadlocked: true,
      invalidAction,
      actionCount: actionSequence.length,
      actionSequenceFingerprint: hashSequence(actionSequence),
      finalStateHash: hashV11State(state),
    };
  }

  while (state.roundIndex < content.rounds.length && !deadlocked) {
    const round = content.rounds[state.roundIndex];
    if (!round) {
      deadlocked = true;
      break;
    }

    // Visual-required rounds gate choice legality. Pick a route before
    // querying the exit contract; otherwise the simulator would report a
    // false deadlock at R08/R09.
    if (round.visualRequired && !state.visualState.selectedVisualId) {
      const plannedChoice =
        round.choices[deriveIndex(`visual-choice-${run}`, round.roundId, round.choices.length)];
      const visualId = selectVisualId(strategy, run, round, content, plannedChoice);
      if (!visualId || !dispatch('visual_selected', round.roundId, { visualId })) {
        deadlocked = true;
        break;
      }
    }

    const legalChoices = round.choices.filter(
      (choice) => canCommitV11Choice(state, content, choice.choiceId).ok,
    );
    const rankedChoices = [...legalChoices].sort((left, right) => {
      const scoreDifference =
        choiceScore(strategy, round, state, right) - choiceScore(strategy, round, state, left);
      if (scoreDifference !== 0) return scoreDifference;
      return (
        deriveIndex(`choice-tie-${run}`, `${round.roundId}:${right.choiceId}`, 2) -
        deriveIndex(`choice-tie-${run}`, `${round.roundId}:${left.choiceId}`, 2)
      );
    });
    const preferredChoice = rankedChoices[0];

    if (shouldSkip(strategy, run, round, state) && getV11RoundExitOptions(state, content).canSkip) {
      if (!dispatch('choice_skipped', round.roundId, { reason: '本轮先维持现状' })) {
        deadlocked = true;
        break;
      }
      skippedRounds += 1;
    } else if (!preferredChoice || !getV11RoundExitOptions(state, content).canCommit) {
      if (
        round.skipPolicy === 'allowed' &&
        dispatch('choice_skipped', round.roundId, { reason: '没有可承受的方案' })
      ) {
        skippedRounds += 1;
      } else {
        deadlocked = true;
        break;
      }
    } else {
      if (round.roundId === 'r05' && !state.brandIdentity) {
        if (
          !dispatch('brand_identity_declared', round.roundId, {
            brandName: '一盏屯溪',
            namingIntent: '让顾客在日常买茶时记住老街的来处',
            personality:
              strategy === 'growth-first' ? '清楚、外向、有行动力' : '松弛、可靠、愿意把话做实',
            identityArchitecture: strategy === 'visual-first' ? 'symbol' : 'wordmark',
          })
        ) {
          deadlocked = true;
          break;
        }
      }

      const reservedFreePoints = strategy === 'risk-manager' ? 1 : 0;
      const actionBudget = Math.max(0, state.freeActionPoints - reservedFreePoints);
      const usedActionIds = usedStageActionIds(state, round);
      const stageActions = [...round.stageActions]
        .filter((candidate) => !usedActionIds.has(candidate.actionId))
        .filter((candidate) => canExecuteV11Action(state, content, candidate.actionId).ok)
        .sort(
          (left, right) => stageActionScore(strategy, right) - stageActionScore(strategy, left),
        );
      let usedFreePoints = 0;
      const actionCount = strategy === 'growth-first' ? 0 : strategy === 'visual-first' ? 1 : 2;
      for (const stageAction of stageActions) {
        if (usedFreePoints + stageAction.actionPointCost > actionBudget) continue;
        if (usedFreePoints > 0 && actionCount <= 1) break;
        if (
          !dispatch('question_action_executed', round.roundId, { actionId: stageAction.actionId })
        ) {
          deadlocked = true;
          break;
        }
        usedFreePoints += stageAction.actionPointCost;
        if (usedFreePoints >= actionBudget || usedFreePoints >= actionCount) break;
      }
      if (deadlocked) break;

      if (strategy === 'evidence-first') {
        for (const evidence of round.evidence) {
          if (!state.viewedEvidenceIds.includes(evidence.evidenceId)) continue;
          if (!dispatch('evidence_viewed', round.roundId, { evidenceId: evidence.evidenceId })) {
            deadlocked = true;
            break;
          }
        }
      }
      if (deadlocked) break;

      if (
        strategy === 'risk-manager' &&
        preferredChoice.riskPlanIds.length > 0 &&
        state.freeActionPoints > 0
      ) {
        const riskPlanId = preferredChoice.riskPlanIds[0];
        const riskPlan = round.riskPlans.find((candidate) => candidate.riskPlanId === riskPlanId);
        if (
          riskPlanId &&
          riskPlan &&
          !state.selectedRiskPlans.includes(riskPlanId) &&
          state.freeActionPoints >= riskPlan.actionPointCost &&
          state.cashYuan >= riskPlan.cashCostYuan
        ) {
          if (!dispatch('risk_plan_selected', round.roundId, { riskPlanId })) {
            deadlocked = true;
            break;
          }
        }
      }
      if (deadlocked) break;

      if (round.visualRequired && !state.visualState.selectedVisualId) {
        const visualId = selectVisualId(strategy, run, round, content, preferredChoice);
        if (!visualId || !dispatch('visual_selected', round.roundId, { visualId })) {
          deadlocked = true;
          break;
        }
      }
      if (strategy === 'visual-first' || round.visualRequired) {
        for (const visualTest of round.visualTests.slice(0, strategy === 'visual-first' ? 2 : 1)) {
          if (
            state.freeActionPoints < 1 ||
            state.visualState.testedTouchpoints.includes(visualTest.testId)
          )
            continue;
          if (
            !dispatch('visual_tested', round.roundId, {
              visualId: state.visualState.selectedVisualId,
              testId: visualTest.testId,
            })
          ) {
            deadlocked = true;
            break;
          }
        }
      }
      if (deadlocked) break;

      const riskPlanId = preferredChoice.riskPlanIds.find((candidate) =>
        state.selectedRiskPlans.includes(candidate),
      );
      if (
        !dispatch('choice_committed', round.roundId, {
          choiceId: preferredChoice.choiceId,
          decisionGroupId: `sim-dg-${strategy}-${run}-${round.roundId}`,
          ...(riskPlanId ? { riskPlanId } : {}),
        })
      ) {
        deadlocked = true;
        break;
      }
      choices.push(preferredChoice.choiceId);
    }

    if (deadlocked) break;
    if (
      !dispatch('round_result_acknowledged', round.roundId, { resultId: `result-${round.roundId}` })
    ) {
      deadlocked = true;
      break;
    }
    if (
      ['r02', 'r06', 'r09', 'r12'].includes(round.roundId) &&
      !dispatch('chapter_review_acknowledged', round.roundId, {})
    ) {
      deadlocked = true;
      break;
    }
  }

  const operatingIncomeYuan = state.financialLedger
    .filter((entry) => entry.category === 'gross_profit')
    .reduce((sum, entry) => sum + Math.max(0, entry.amountYuan), 0);
  return {
    state,
    choices,
    skippedRounds,
    operatingIncomeYuan,
    deadlocked,
    invalidAction,
    actionCount: actionSequence.length,
    actionSequenceFingerprint: hashSequence(actionSequence),
    finalStateHash: hashV11State(state),
  };
}

function runUniformSimulation(content: GameContentV11, run: number): RunResult {
  const seed = `simulation-seed-uniform-${run}`;
  let state = createV11State(content.contentVersion, `simulation-uniform-${run}`);
  let step = 0;
  const choices: string[] = [];
  let deadlocked = false;
  let invalidAction = false;
  const actionSequence: string[] = [];
  const dispatch = (
    type: V11Action['type'],
    roundId: string | undefined,
    payload: Record<string, unknown>,
  ): boolean => {
    try {
      actionSequence.push(`${type}:${roundId ?? ''}:${JSON.stringify(payload)}`);
      state = applySimulationAction(
        state,
        content,
        simulationAction(run, step++, type, roundId, payload, 'sim-uniform'),
        seed,
      );
      return true;
    } catch {
      invalidAction = true;
      return false;
    }
  };
  if (!dispatch('onboarding_completed', undefined, {})) {
    return {
      state,
      choices,
      skippedRounds: 0,
      operatingIncomeYuan: 0,
      deadlocked: true,
      invalidAction,
      actionCount: actionSequence.length,
      actionSequenceFingerprint: hashSequence(actionSequence),
      finalStateHash: hashV11State(state),
    };
  }
  while (state.roundIndex < content.rounds.length && !deadlocked) {
    const round = content.rounds[state.roundIndex];
    if (!round) {
      deadlocked = true;
      break;
    }
    if (round.visualRequired && !state.visualState.selectedVisualId) {
      const plannedChoice =
        round.choices[
          deriveIndex(`simulation-choice-${run}`, `visual:${round.roundId}`, round.choices.length)
        ];
      const visualId =
        plannedChoice?.visualRouteId ??
        content.visualSystems[
          deriveIndex(`simulation-visual-${run}`, round.roundId, content.visualSystems.length)
        ]?.visualId;
      if (!visualId || !dispatch('visual_selected', round.roundId, { visualId })) {
        deadlocked = true;
        break;
      }
    }
    const legalChoices = round.choices.filter(
      (choice) => canCommitV11Choice(state, content, choice.choiceId).ok,
    );
    if (legalChoices.length === 0) {
      if (
        round.skipPolicy === 'allowed' &&
        dispatch('choice_skipped', round.roundId, { reason: '没有可承受的方案' })
      ) {
        if (
          !dispatch('round_result_acknowledged', round.roundId, {
            resultId: `result-${round.roundId}`,
          })
        )
          deadlocked = true;
      } else {
        deadlocked = true;
      }
    } else {
      const choice =
        legalChoices[
          deriveIndex(`simulation-choice-${run}`, `round:${state.roundIndex}`, legalChoices.length)
        ];
      if (
        !choice ||
        !dispatch('choice_committed', round.roundId, {
          choiceId: choice.choiceId,
          decisionGroupId: `sim-dg-uniform-${run}-${round.roundId}`,
        }) ||
        !dispatch('round_result_acknowledged', round.roundId, {
          resultId: `result-${round.roundId}`,
        })
      ) {
        deadlocked = true;
      } else {
        choices.push(choice.choiceId);
      }
    }
    if (deadlocked) break;
    if (
      ['r02', 'r06', 'r09', 'r12'].includes(round.roundId) &&
      !dispatch('chapter_review_acknowledged', round.roundId, {})
    )
      deadlocked = true;
  }
  const operatingIncomeYuan = state.financialLedger
    .filter((entry) => entry.category === 'gross_profit')
    .reduce((sum, entry) => sum + Math.max(0, entry.amountYuan), 0);
  return {
    state,
    choices,
    skippedRounds: 0,
    operatingIncomeYuan,
    deadlocked,
    invalidAction,
    actionCount: actionSequence.length,
    actionSequenceFingerprint: hashSequence(actionSequence),
    finalStateHash: hashV11State(state),
  };
}

function hashSequence(sequence: string[]): string {
  return bytesToHex(sha256(utf8ToBytes(sequence.join('|'))));
}

type SimulationRunner = (
  content: GameContentV11,
  run: number,
  strategy: V11SimulationStrategy,
) => RunResult;

function reportForRuns(
  content: GameContentV11,
  strategy: V11SimulationStrategy,
  iterations: number,
  runner: SimulationRunner = runSimulation,
): V11StrategyReport {
  const choices: Record<string, number> = {};
  const routeIds = new Set<string>();
  const endingIds = new Set<string>();
  const endings: Record<string, number> = {};
  let minimumFinalCashYuan = Number.POSITIVE_INFINITY;
  let completedRuns = 0;
  let deadlockedRuns = 0;
  let invalidActionRuns = 0;
  let skippedRounds = 0;
  let incomeRuns = 0;
  let operatingIncomeYuan = 0;
  let netCashChangeYuan = 0;
  let actionCount = 0;
  const choiceIds = new Set<string>();
  const actionFingerprints: string[] = [];
  const stateFingerprints: string[] = [];
  for (let run = 0; run < iterations; run += 1) {
    const result = runner(content, run, strategy);
    deadlockedRuns += result.deadlocked ? 1 : 0;
    invalidActionRuns += result.invalidAction ? 1 : 0;
    skippedRounds += result.skippedRounds;
    actionCount += result.actionCount;
    actionFingerprints.push(result.actionSequenceFingerprint);
    stateFingerprints.push(result.finalStateHash);
    result.choices.forEach((choiceId) => choiceIds.add(choiceId));
    result.choices.forEach((choiceId) => {
      choices[choiceId] = (choices[choiceId] ?? 0) + 1;
    });
    operatingIncomeYuan += result.operatingIncomeYuan;
    if (result.operatingIncomeYuan > 0) incomeRuns += 1;
    if (result.state.roundIndex === content.rounds.length && !result.deadlocked) {
      completedRuns += 1;
      minimumFinalCashYuan = Math.min(minimumFinalCashYuan, result.state.cashYuan);
      netCashChangeYuan += result.state.cashYuan - 500_000;
      routeIds.add(deriveRouteId(result.state, content));
      const endingId = result.state.ending ?? 'unfinished';
      endingIds.add(endingId);
      endings[endingId] = (endings[endingId] ?? 0) + 1;
    }
  }
  if (completedRuns === 0) minimumFinalCashYuan = 0;
  return {
    strategy,
    iterations,
    completedRuns,
    minimumFinalCashYuan,
    choiceShares: Object.fromEntries(
      Object.entries(choices).map(([choiceId, count]) => [
        choiceId,
        count / Math.max(1, completedRuns),
      ]),
    ),
    distinctRouteIds: routeIds.size,
    endingShares: Object.fromEntries(
      Object.entries(endings).map(([endingId, count]) => [
        endingId,
        count / Math.max(1, completedRuns),
      ]),
    ),
    distinctEndingIds: endingIds.size,
    deadlockedRuns,
    invalidActionRuns,
    skippedRounds,
    incomeRuns,
    averageOperatingIncomeYuan: operatingIncomeYuan / Math.max(1, completedRuns),
    averageNetCashChangeYuan: netCashChangeYuan / Math.max(1, completedRuns),
    averageActionCount: actionCount / Math.max(1, iterations),
    distinctChoiceIds: choiceIds.size,
    actionSequenceFingerprint: hashSequence(actionFingerprints),
    finalStateFingerprint: hashSequence(stateFingerprints),
  };
}

function deriveRouteId(state: V11GameState, content: GameContentV11): string {
  return deriveV11RouteProfile(state, content).routeId;
}

/** Keep the fast deterministic gate's stable public shape. */
export function simulateV11(content: GameContentV11, iterations = 10_000): V11SimulationReport {
  const report = reportForRuns(content, 'cash-conservative', iterations, (candidate, run) =>
    runUniformSimulation(candidate, run),
  );
  return {
    completedRuns: report.completedRuns,
    minimumFinalCashYuan: report.minimumFinalCashYuan,
    choiceShares: report.choiceShares,
    distinctRouteIds: report.distinctRouteIds,
    endingShares: report.endingShares,
    distinctEndingIds: report.distinctEndingIds,
  };
}

export function simulateV11Strategies(
  content: GameContentV11,
  iterations = 2_000,
): V11StrategySimulationReport {
  const reports = Object.fromEntries(
    STRATEGIES.map((strategy) => [strategy, reportForRuns(content, strategy, iterations)]),
  ) as Record<V11SimulationStrategy, V11StrategyReport>;
  const endingIds = new Set<string>();
  let completedRuns = 0;
  let deadlockedRuns = 0;
  for (const report of Object.values(reports)) {
    completedRuns += report.completedRuns;
    deadlockedRuns += report.deadlockedRuns;
    Object.keys(report.endingShares).forEach((endingId) => endingIds.add(endingId));
  }
  return {
    iterationsPerStrategy: iterations,
    strategies: reports,
    completedRuns,
    deadlockedRuns,
    distinctRouteIds: Math.max(
      ...Object.values(reports).map((report) => report.distinctRouteIds),
      0,
    ),
    distinctEndingIds: endingIds.size,
  };
}
