import type { GameContentV11, V11Choice, V11Round } from '@laojie/content-schema';
import { scoreV11State, type V11GameState, type V11RoundResult } from '@laojie/game-engine';
import type { GameReportV11 } from './v11.js';

function score(state: V11GameState, content: GameContentV11): GameReportV11['scoreBreakdown'] {
  if (state.scoreBreakdown) return state.scoreBreakdown;
  const breakdown = scoreV11State(state, content);
  return {
    survival: breakdown.survival,
    customer: breakdown.customer,
    brand: breakdown.brand,
    consistency: breakdown.consistency,
    overall: breakdown.overall,
    level: breakdown.level,
  };
}

function resultOf(trace: V11GameState['traces'][number]): V11RoundResult | undefined {
  return trace.result;
}

function choiceFor(round: V11Round, result: V11RoundResult | undefined): V11Choice | undefined {
  return round.choices.find((choice) => choice.choiceId === result?.choiceId);
}

function evidenceStatus(
  state: V11GameState,
  round: V11Round,
  choice: V11Choice | undefined,
): { status: string; evidenceTitle?: string } {
  if (!choice) return { status: '尚未形成正式选择' };
  const relevant = round.evidence.filter((evidence) =>
    choice.evidenceRelations.includes(evidence.evidenceId),
  );
  const viewed = relevant.filter((evidence) =>
    state.viewedEvidenceIds.includes(evidence.evidenceId),
  );
  if (viewed.length === relevant.length && viewed.length > 0)
    return {
      status: '看过并用上了相关信息',
      evidenceTitle: viewed.map((item) => item.title).join('、'),
    };
  if (viewed.length > 0)
    return {
      status: '用上了一部分相关信息',
      evidenceTitle: viewed.map((item) => item.title).join('、'),
    };
  const anyRoundEvidence = round.evidence.find((evidence) =>
    state.viewedEvidenceIds.includes(evidence.evidenceId),
  );
  return {
    status: anyRoundEvidence ? '看过相关信息，但选择了另一条路' : '没有查看直接相关的信息',
    ...(anyRoundEvidence ? { evidenceTitle: anyRoundEvidence.title } : {}),
  };
}

function financialSummary(state: V11GameState): GameReportV11['financialSummary'] {
  const openingCashYuan =
    state.financialLedger.find((entry) => entry.category === 'opening')?.amountYuan ?? 500_000;
  const income = state.financialLedger
    .filter((entry) => entry.amountYuan > 0)
    .reduce((sum, entry) => sum + entry.amountYuan, 0);
  const costs = state.financialLedger
    .filter((entry) => entry.amountYuan < 0)
    .reduce((sum, entry) => sum - entry.amountYuan, 0);
  return {
    openingCashYuan,
    finalCashYuan: state.cashYuan,
    totalIncomeYuan: income,
    totalCostYuan: costs,
  };
}

function theoryTitles(content: GameContentV11, theoryIds: string[]): string[] {
  return theoryIds
    .map((theoryId) => content.theories.find((theory) => theory.theoryId === theoryId)?.title)
    .filter((title): title is string => Boolean(title));
}

export function buildV11Report(state: V11GameState, content: GameContentV11): GameReportV11 {
  const choiceTraces = state.traces.filter(
    (trace) => trace.actionType === 'choice_committed' || trace.actionType === 'choice_skipped',
  );
  const evidenceDiagnosis: GameReportV11['evidenceDiagnosis'] = [];
  const riskDiagnosis: GameReportV11['riskDiagnosis'] = [];
  const causalExplanations: GameReportV11['causalExplanations'] = [];
  const roundReviews: GameReportV11['roundReviews'] = [];

  for (const trace of choiceTraces) {
    const round = content.rounds.find((item) => item.roundId === trace.roundId);
    const result = resultOf(trace);
    if (!round || !result) continue;
    const choice = choiceFor(round, result);
    const skipped = result.resultType === 'skip';
    const evidence = skipped
      ? { status: '本轮没有执行战略方案' }
      : evidenceStatus(state, round, choice);
    evidenceDiagnosis.push({
      roundTitle: round.title,
      status: evidence.status,
      ...(evidence.evidenceTitle ? { evidenceTitle: evidence.evidenceTitle } : {}),
      ...(choice ? { choiceLabel: choice.label } : {}),
    });
    riskDiagnosis.push({
      roundTitle: round.title,
      outcome: result.riskOutcome.status === 'not_selected' ? '未配置预案' : '已配置预案',
      explanation: result.riskOutcome.explanation,
    });
    const immediate = result.immediateEffects.map((effect) => effect.label);
    const delayed = [...result.scheduledEffects, ...result.maturedEffects].map(
      (effect) => effect.label,
    );
    const mechanism =
      [
        skipped ? '你没有执行新的战略方案，店里仍在结算既有经营和前面埋下的影响' : '',
        immediate.length > 0 ? `马上：${immediate.join('、')}` : '',
        delayed.length > 0 ? `随后：${delayed.join('、')}` : '',
      ]
        .filter(Boolean)
        .join('；') ||
      '这项决定先改变了店里的资源安排；接下来的顾客、店员和账本会继续显示它带来的后果。';
    causalExplanations.push({
      roundTitle: round.title,
      mechanism,
      traceRefs: [`第${trace.sequence}条决策记录`],
    });
    const immediateConsequences = result.immediateEffects.map((effect) => effect.label);
    const delayedConsequences = [...result.scheduledEffects, ...result.maturedEffects].map(
      (effect) => effect.label,
    );
    const theoryLinks = theoryTitles(content, choice?.theoryIds ?? round.theoryIds);
    roundReviews.push({
      roundTitle: round.title,
      choiceLabel: result.choiceLabel,
      decisionReason: evidence.status,
      mechanism,
      immediateConsequences,
      delayedConsequences,
      evidenceUse: skipped
        ? '你主动不执行新方案；此前查看的信息仍保留在本局记录中'
        : (evidence.evidenceTitle ?? '没有查看与本方案直接相关的情报'),
      riskOutcome: result.riskOutcome.explanation,
      theoryLinks,
      triggeredEvents: result.triggeredEvents.map((event) => `${event.title}：${event.text}`),
      traceRefs: [`第${trace.sequence}条决策记录`],
      resourceImpact: {
        cashCostYuan: result.cashCostYuan,
        actionPointCost: result.actionPointCost,
        durationDays: result.durationDays,
        workload: result.workload,
      },
    });
  }

  const ending = content.endings.find((item) => item.endingId === state.ending);
  const visual = state.visualState.selectedVisualId
    ? content.visualSystems.find((item) => item.visualId === state.visualState.selectedVisualId)
    : undefined;
  const mostConsequential = choiceTraces
    .map((trace) => ({
      trace,
      magnitude: Object.values(trace.result?.metricChanges ?? {}).reduce(
        (sum, amount) => sum + Math.abs(amount),
        0,
      ),
    }))
    .sort((left, right) => right.magnitude - left.magnitude)[0];
  const mostConsequentialRound = content.rounds.find(
    (round) => round.roundId === mostConsequential?.trace.roundId,
  );
  const predictionOutcomes = state.predictions
    .map((prediction) => {
      const result = choiceTraces.find((trace) => trace.roundId === prediction.roundId)?.result;
      const firstChangedMetric = Object.entries(result?.metricChanges ?? {}).find(
        ([, amount]) => amount !== 0,
      )?.[0];
      return { prediction, firstChangedMetric };
    })
    .filter((item) => item.firstChangedMetric);
  const matchedPredictions = predictionOutcomes.filter(
    (item) => item.prediction.label === item.firstChangedMetric,
  ).length;
  const differedPredictions = predictionOutcomes.length - matchedPredictions;
  return {
    reportVersion: '1.2.0',
    contentVersion: state.contentVersion,
    engineVersion: state.engineVersion,
    endingTitle: ending?.title ?? null,
    scoreBreakdown: score(state, content),
    routeProfile: state.routeProfile
      ? {
          title: state.routeProfile.title,
          confidence: state.routeProfile.confidence,
          contributingRounds: state.routeProfile.contributingRounds.map(
            (roundId) =>
              content.rounds.find((round) => round.roundId === roundId)?.title ?? '一轮经营',
          ),
        }
      : null,
    financialSummary: financialSummary(state),
    evidenceDiagnosis,
    riskDiagnosis,
    causalExplanations,
    roundReviews,
    visualDiagnosis: {
      selectedSystem: visual?.name ?? null,
      testedTouchpoints: state.visualState.testedTouchpoints.length,
      matchScore: state.visualState.matchScore ?? null,
      explanation: visual
        ? `${visual.name}在店招、杯身、包装和头像上的适配分为 ${state.visualState.matchScore ?? 0}。这不是单独看好不好看，而是看它是否适合你的顾客、产品和真实使用场景。`
        : '本局没有选择一套视觉方向，因此报告无法分析它会怎样影响顾客识别和门店使用。',
      testResults: (state.visualState.testResults ?? []).map((item) => ({
        title: item.title,
        score: item.score,
        passed: item.passed,
        explanation: item.explanation,
      })),
    },
    predictionDiagnosis: {
      matched: matchedPredictions,
      differed: differedPredictions,
      explanation:
        predictionOutcomes.length === 0
          ? '本局没有形成可对照的预判记录。下次可以先押一个最先变化的指标，再用结果校正直觉。'
          : matchedPredictions > differedPredictions
            ? `你有 ${matchedPredictions} 次预判与即时变化一致。你不是在猜标准答案，而是在用结果检验自己的经营判断。`
            : `你有 ${differedPredictions} 次预判与即时变化不同。这不是失分；它提示你下次可先查看与方案直接相关的事实，再决定押注什么。`,
    },
    replayReflection: {
      mostConsequentialRound: mostConsequentialRound?.title ?? null,
      prompt: mostConsequentialRound
        ? '如果重来一次，你会先补哪条证据，或为哪项风险留出缓冲？'
        : '如果重来一次，你会先验证什么？',
      explanation: mostConsequentialRound
        ? `“${mostConsequentialRound.title}”带来的可观察变化最多，适合拿来复盘这次选择怎样造成之后的结果。`
        : '本局还没有足够的正式决策记录可供复盘。',
    },
  };
}
