import type { GameContentV11 } from '@laojie/content-schema';
import type {
  V11ClassRecord,
  V11PlaythroughRecord,
  V11StudentIdentity,
} from './store/v11-types.js';

type V11StudentBundle = { identity: V11StudentIdentity; playthroughs: V11PlaythroughRecord[] };

export interface V11ClassAnalytics {
  classId: string;
  contentVersion: string;
  scope: { denominator: number; excludedReplays: true; generatedAt: string };
  progress: {
    totalStudents: number;
    started: number;
    inProgress: number;
    completed: number;
    completionRate: number;
    medianDurationSeconds: number;
  };
  roundProgress: Record<string, number>;
  choiceDistribution: Record<string, number>;
  skipDistribution: Record<string, number>;
  freeActionAllocation: Record<string, number>;
  questionActionRate: Record<string, number>;
  evidenceOpenRate: Record<string, number>;
  eventDistribution: Record<string, number>;
  visualDistribution: Record<string, number>;
  visualTestDistribution: Record<string, { passed: number; total: number }>;
  riskDistribution: Record<string, number>;
  endingDistribution: Record<string, number>;
  routeDistribution: Record<string, number>;
  brandIdentityDistribution: Record<'wordmark' | 'symbol' | 'ip', number>;
  predictionSummary: {
    submitted: number;
    matchedTopChange: number;
    matchRate: number;
    byMetric: Record<string, number>;
  };
  topPaths: Array<{ path: string; count: number }>;
  anonymousAwards: V11AnonymousAward[];
}

export interface V11AnonymousAward {
  awardId: 'evidence-led' | 'visual-operator' | 'risk-buffer' | 'traceable-decisions';
  title: string;
  description: string;
  count: number;
}

function ratio(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100) / 100;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!,
  );
}

function increment(target: Record<string, number>, key: string, amount = 1): void {
  target[key] = (target[key] ?? 0) + amount;
}

function firstRuns(bundles: V11StudentBundle[]): V11PlaythroughRecord[] {
  return bundles.flatMap((bundle) =>
    bundle.playthroughs.filter((playthrough) => playthrough.kind === 'first_run'),
  );
}

function buildAnonymousAwards(runs: V11PlaythroughRecord[]): V11AnonymousAward[] {
  const completed = runs.filter((run) => run.status === 'completed');
  return [
    {
      awardId: 'evidence-led',
      title: '先问再做',
      description: '完成首局前至少查看两条现场证据。',
      count: completed.filter((run) => run.state.viewedEvidenceIds.length >= 2).length,
    },
    {
      awardId: 'visual-operator',
      title: '视觉触点侦察员',
      description: '完成首局前至少做两次视觉触点测试。',
      count: completed.filter((run) => run.state.visualState.testedTouchpoints.length >= 2).length,
    },
    {
      awardId: 'risk-buffer',
      title: '风险缓冲手',
      description: '至少一次用预案把风险从“会发生”变成“可控”。',
      count: completed.filter((run) =>
        run.state.traces.some((trace) => trace.riskOutcome?.status === 'mitigated'),
      ).length,
    },
    {
      awardId: 'traceable-decisions',
      title: '因果链追踪员',
      description: '完成首局，并留下至少一条证据支持的正式决策。',
      count: completed.filter((run) =>
        run.state.traces.some(
          (trace) =>
            trace.actionType === 'choice_committed' && trace.evidenceAdjustments.length > 0,
        ),
      ).length,
    },
  ];
}

export function buildV11ClassAnalytics(
  classRecord: V11ClassRecord,
  bundles: V11StudentBundle[],
  content: GameContentV11,
  now = new Date().toISOString(),
): V11ClassAnalytics {
  const runs = firstRuns(bundles);
  const completed = runs.filter((run) => run.status === 'completed');
  const roundProgress: Record<string, number> = {};
  const choiceDistribution: Record<string, number> = {};
  const skipDistribution: Record<string, number> = {};
  const freeActionAllocation: Record<string, number> = {};
  const questionActionCount: Record<string, number> = {};
  const evidenceOpenRate: Record<string, number> = {};
  const eventDistribution: Record<string, number> = {};
  const visualDistribution: Record<string, number> = {};
  const visualTestDistribution: Record<string, { passed: number; total: number }> = {};
  const riskDistribution: Record<string, number> = {};
  const endingDistribution: Record<string, number> = {};
  const routeDistribution: Record<string, number> = {};
  const brandIdentityDistribution: Record<'wordmark' | 'symbol' | 'ip', number> = {
    wordmark: 0,
    symbol: 0,
    ip: 0,
  };
  const predictionByMetric: Record<string, number> = {};
  let predictionSubmitted = 0;
  let predictionMatchedTopChange = 0;
  const pathCounts: Record<string, number> = {};

  for (const run of runs) {
    for (const roundId of run.state.completedRoundIds) increment(roundProgress, roundId);
    for (const evidenceId of run.state.viewedEvidenceIds) increment(evidenceOpenRate, evidenceId);
    for (const decision of run.state.decisions.filter((item) => item.type === 'visual_selected')) {
      const visualId =
        typeof decision.payload.visualId === 'string' ? decision.payload.visualId : undefined;
      if (visualId) increment(visualDistribution, visualId);
    }
    if (run.state.brandIdentity)
      increment(brandIdentityDistribution, run.state.brandIdentity.identityArchitecture);
    for (const trace of run.state.traces) {
      const freeSpent = Math.max(0, trace.before.freeActionPoints - trace.after.freeActionPoints);
      if (freeSpent > 0) increment(freeActionAllocation, trace.actionType, freeSpent);
      if (
        trace.actionType === 'stage_action_selected' ||
        trace.actionType === 'question_action_executed'
      ) {
        const actionId = run.state.decisions.find(
          (decision) => decision.actionId === trace.actionId,
        )?.payload.actionId;
        const round = content.rounds.find((item) => item.roundId === trace.roundId);
        const stageAction =
          typeof actionId === 'string'
            ? round?.stageActions.find((item) => item.actionId === actionId)
            : undefined;
        if (stageAction?.questionId) increment(questionActionCount, stageAction.questionId);
      }
      if (trace.actionType === 'choice_committed') {
        const choiceId =
          typeof trace.result?.choiceId === 'string' ? trace.result.choiceId : undefined;
        if (choiceId) increment(choiceDistribution, choiceId);
        for (const event of trace.triggeredEvents) increment(eventDistribution, event.eventId);
        if (trace.riskOutcome) increment(riskDistribution, trace.riskOutcome.status);
      }
      if (trace.actionType === 'choice_skipped' && trace.roundId)
        increment(skipDistribution, trace.roundId);
      for (const effect of trace.result?.immediateEffects ?? []) {
        if (effect.key === 'visualRecognition' || effect.key === 'visualAdaptability') {
          const current = visualTestDistribution[effect.label] ?? { passed: 0, total: 0 };
          current.total += 1;
          if (effect.amount > 0) current.passed += 1;
          visualTestDistribution[effect.label] = current;
        }
      }
    }
    for (const prediction of run.state.predictions) {
      predictionSubmitted += 1;
      increment(predictionByMetric, prediction.label);
      const result = run.state.traces.find(
        (trace) => trace.actionType === 'choice_committed' && trace.roundId === prediction.roundId,
      )?.result;
      const ranked = Object.entries(result?.metricChanges ?? {}).sort(
        (left, right) => Math.abs(right[1]) - Math.abs(left[1]),
      );
      if (ranked[0]?.[0] === prediction.label) predictionMatchedTopChange += 1;
    }
    if (run.state.ending) increment(endingDistribution, run.state.ending);
    if (run.state.routeProfile?.title) increment(routeDistribution, run.state.routeProfile.title);
    const path = run.state.traces
      .filter((trace) => trace.actionType === 'choice_committed')
      .map((trace) => trace.result?.choiceLabel ?? '未命名选择')
      .join(' → ');
    if (path) increment(pathCounts, path);
  }

  const studentsStarted = bundles.filter((bundle) =>
    bundle.playthroughs.some((run) => run.kind === 'first_run'),
  ).length;
  const durations = completed
    .filter((run) => run.completedAt)
    .map(
      (run) => (new Date(run.completedAt!).getTime() - new Date(run.startedAt).getTime()) / 1000,
    );
  return {
    classId: classRecord.id,
    contentVersion: classRecord.contentVersion,
    scope: { denominator: runs.length, excludedReplays: true, generatedAt: now },
    progress: {
      totalStudents: bundles.length,
      started: studentsStarted,
      inProgress: runs.filter((run) => run.status === 'active').length,
      completed: completed.length,
      completionRate: ratio(completed.length, runs.length),
      medianDurationSeconds: median(durations),
    },
    roundProgress,
    choiceDistribution,
    skipDistribution,
    freeActionAllocation,
    questionActionRate: Object.fromEntries(
      Object.entries(questionActionCount).map(([key, value]) => [key, ratio(value, runs.length)]),
    ),
    evidenceOpenRate: Object.fromEntries(
      Object.entries(evidenceOpenRate).map(([key, value]) => [key, ratio(value, runs.length)]),
    ),
    eventDistribution,
    visualDistribution,
    visualTestDistribution,
    riskDistribution,
    endingDistribution,
    routeDistribution,
    brandIdentityDistribution,
    predictionSummary: {
      submitted: predictionSubmitted,
      matchedTopChange: predictionMatchedTopChange,
      matchRate: ratio(predictionMatchedTopChange, predictionSubmitted),
      byMetric: predictionByMetric,
    },
    topPaths: Object.entries(pathCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count })),
    anonymousAwards: buildAnonymousAwards(runs),
  };
}

export interface V11AnonymousCase {
  title: string;
  summary: string;
  endingTitle: string | null;
  routeTitle: string | null;
  finalMetrics: Record<string, number>;
  path: Array<{ roundTitle: string; choiceLabel: string }>;
  discussionPrompt: string;
}

function anonymousCaseFromRun(
  selected: V11PlaythroughRecord,
  content: GameContentV11,
): V11AnonymousCase {
  const path = selected.state.traces
    .filter((trace) => trace.actionType === 'choice_committed')
    .map((trace) => ({
      roundTitle:
        content.rounds.find((round) => round.roundId === trace.roundId)?.title ?? '一轮经营',
      choiceLabel: trace.result?.choiceLabel ?? '未命名选择',
    }));
  const endingTitle =
    content.endings.find((ending) => ending.endingId === selected.state.ending)?.title ?? null;
  return {
    title: selected.state.routeProfile?.title
      ? `匿名路径：${selected.state.routeProfile.title}`
      : '匿名路径：一间店的选择链',
    summary: `这条路径完成了 ${path.length} 次正式决策，最后现金为 ¥${selected.state.cashYuan.toLocaleString('zh-CN')}。请讨论：哪些结果来自单次选择，哪些其实是多轮叠加？`,
    endingTitle,
    routeTitle: selected.state.routeProfile?.title ?? null,
    finalMetrics: {
      ...selected.state.metrics,
      cashYuan: selected.state.cashYuan,
      elapsedDays: selected.state.elapsedDays,
    },
    path,
    discussionPrompt: '如果你是这家店的品牌负责人，下一轮最应该补哪条证据，或修复哪项交付能力？',
  };
}

export function buildV11AnonymousCases(
  bundles: V11StudentBundle[],
  content: GameContentV11,
  limit = 3,
): V11AnonymousCase[] {
  const candidates = firstRuns(bundles).filter((run) =>
    run.state.traces.some((trace) => trace.actionType === 'choice_committed'),
  );
  const sorted = [...candidates].sort((left, right) => {
    const completion = right.state.completedRoundIds.length - left.state.completedRoundIds.length;
    if (completion !== 0) return completion;
    const leftPath = left.state.traces
      .filter((trace) => trace.actionType === 'choice_committed')
      .map((trace) => trace.result?.choiceLabel ?? '')
      .join('→');
    const rightPath = right.state.traces
      .filter((trace) => trace.actionType === 'choice_committed')
      .map((trace) => trace.result?.choiceLabel ?? '')
      .join('→');
    return leftPath.localeCompare(rightPath, 'zh-CN');
  });
  const seenPaths = new Set<string>();
  const cases: V11AnonymousCase[] = [];
  for (const run of sorted) {
    const pathKey = run.state.traces
      .filter((trace) => trace.actionType === 'choice_committed')
      .map((trace) => trace.result?.choiceLabel ?? '')
      .join('→');
    if (seenPaths.has(pathKey)) continue;
    seenPaths.add(pathKey);
    cases.push(anonymousCaseFromRun(run, content));
    if (cases.length >= limit) break;
  }
  return cases;
}

export function buildV11AnonymousCase(
  bundles: V11StudentBundle[],
  content: GameContentV11,
  offset = 0,
): V11AnonymousCase | undefined {
  return buildV11AnonymousCases(bundles, content, offset + 1)[offset];
}
