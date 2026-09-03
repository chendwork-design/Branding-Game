import type { ClassRecord, PlaythroughRecord, StudentIdentity } from './store/types.js';

export interface ClassAnalytics {
  classId: string;
  contentVersion: string;
  scope: { denominator: number; excludedReplays: boolean; generatedAt: string };
  progress: {
    totalStudents: number;
    started: number;
    inProgress: number;
    completed: number;
    completionRate: number;
    successfulEntryRate: number;
    exitRate: number;
    medianDurationSeconds: number;
  };
  engagement: {
    reportsOpened: number;
    reportOpenRate: number;
    replayStarted: number;
    replayRate: number;
    replayStrategyChanges: number;
  };
  roundProgress: Record<string, number>;
  choiceDistribution: Record<string, number>;
  evidenceOpenRate: Record<string, number>;
  endingDistribution: Record<string, number>;
  visualDistribution: Record<string, number>;
  eventDistribution: Record<string, number>;
  visualTestDistribution: Record<string, { passed: number; total: number }>;
  visualRevisionCount: number;
  visualSystemImpact: Record<
    string,
    {
      count: number;
      averageCulturalCredibility: number;
      averageVisualRecognition: number;
      averageVisualAdaptability: number;
    }
  >;
  predictionCount: number;
  topPaths: Array<{ path: string; count: number }>;
}

type StudentBundle = { identity: StudentIdentity; playthroughs: PlaythroughRecord[] };

export function buildClassAnalytics(
  classRecord: ClassRecord,
  bundles: StudentBundle[],
  generatedAt = new Date().toISOString(),
): ClassAnalytics {
  const firstRuns = bundles.flatMap((bundle) =>
    bundle.playthroughs
      .filter((playthrough) => playthrough.kind === 'first_run')
      .map((playthrough) => ({ bundle, playthrough })),
  );
  const denominator = firstRuns.length;
  const choiceDistribution: Record<string, number> = {};
  const evidenceOpenRate: Record<string, number> = {};
  const endingDistribution: Record<string, number> = {};
  const visualDistribution: Record<string, number> = {};
  const eventDistribution: Record<string, number> = {};
  const visualTestDistribution: Record<string, { passed: number; total: number }> = {};
  const visualImpact = new Map<
    string,
    {
      count: number;
      culturalCredibility: number;
      visualRecognition: number;
      visualAdaptability: number;
    }
  >();
  const roundProgress: Record<string, number> = {};
  const pathCounts = new Map<string, number>();
  let completed = 0;
  let predictions = 0;
  let visualRevisionCount = 0;

  for (const { playthrough } of firstRuns) {
    if (playthrough.status === 'completed') completed += 1;
    for (const roundId of playthrough.state.completedRoundIds)
      roundProgress[roundId] = (roundProgress[roundId] ?? 0) + 1;
    const path = playthrough.logs
      .filter((log) => log.action.type === 'choice_selected')
      .map((log) => String(log.action.payload.choiceId ?? ''))
      .join(' → ');
    if (path) pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
    for (const log of playthrough.logs) {
      if (log.action.type === 'choice_selected') {
        const choiceId = String(log.action.payload.choiceId ?? 'unknown');
        choiceDistribution[choiceId] = (choiceDistribution[choiceId] ?? 0) + 1;
      }
      if (log.action.type === 'evidence_viewed') {
        const evidenceId = String(log.action.payload.evidenceId ?? 'unknown');
        evidenceOpenRate[evidenceId] = (evidenceOpenRate[evidenceId] ?? 0) + 1;
      }
      if (log.action.type === 'intent_selected' || log.action.type === 'risk_selected')
        predictions += 1;
      if (log.action.type === 'visual_selected') {
        const visualId = String(log.action.payload.visualId ?? 'unknown');
        visualDistribution[visualId] = (visualDistribution[visualId] ?? 0) + 1;
      }
      for (const event of log.trace.events)
        eventDistribution[event.eventId] = (eventDistribution[event.eventId] ?? 0) + 1;
    }
    if (playthrough.state.endingId)
      endingDistribution[playthrough.state.endingId] =
        (endingDistribution[playthrough.state.endingId] ?? 0) + 1;
    for (const result of playthrough.state.visualTestResults) {
      const current = visualTestDistribution[result.testId] ?? { passed: 0, total: 0 };
      visualTestDistribution[result.testId] = {
        passed: current.passed + (result.passed ? 1 : 0),
        total: current.total + 1,
      };
    }
    visualRevisionCount += playthrough.logs.filter(
      (log) => log.action.type === 'visual_revised',
    ).length;
    if (playthrough.state.selectedVisualId) {
      const current = visualImpact.get(playthrough.state.selectedVisualId) ?? {
        count: 0,
        culturalCredibility: 0,
        visualRecognition: 0,
        visualAdaptability: 0,
      };
      current.count += 1;
      current.culturalCredibility += playthrough.state.metrics.culturalCredibility;
      current.visualRecognition += playthrough.state.metrics.visualRecognition;
      current.visualAdaptability += playthrough.state.metrics.visualAdaptability;
      visualImpact.set(playthrough.state.selectedVisualId, current);
    }
  }

  const topPaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));
  const durations = firstRuns
    .flatMap(({ playthrough }) =>
      playthrough.completedAt
        ? [
            Math.max(
              0,
              (Date.parse(playthrough.completedAt) - Date.parse(playthrough.startedAt)) / 1000,
            ),
          ]
        : [],
    )
    .sort((a, b) => a - b);
  const medianDurationSeconds = durations.length
    ? durations[Math.floor((durations.length - 1) / 2)]!
    : 0;
  const replays = bundles.flatMap((bundle) =>
    bundle.playthroughs.filter((playthrough) => playthrough.kind === 'replay'),
  );
  let replayStrategyChanges = 0;
  for (const bundle of bundles) {
    const first = bundle.playthroughs.find((playthrough) => playthrough.kind === 'first_run');
    const replay = bundle.playthroughs.find((playthrough) => playthrough.kind === 'replay');
    if (first && replay) {
      const firstPath = first.logs
        .filter((log) => log.action.type === 'choice_selected')
        .map((log) => log.action.payload.choiceId)
        .join('|');
      const replayPath = replay.logs
        .filter((log) => log.action.type === 'choice_selected')
        .map((log) => log.action.payload.choiceId)
        .join('|');
      if (firstPath && replayPath && firstPath !== replayPath) replayStrategyChanges += 1;
    }
  }
  return {
    classId: classRecord.id,
    contentVersion: classRecord.contentVersion,
    scope: { denominator, excludedReplays: true, generatedAt },
    progress: {
      totalStudents: bundles.length,
      started: firstRuns.length,
      inProgress: firstRuns.filter(({ playthrough }) => playthrough.status === 'active').length,
      completed,
      completionRate: denominator === 0 ? 0 : completed / denominator,
      successfulEntryRate: bundles.length === 0 ? 0 : firstRuns.length / bundles.length,
      exitRate:
        denominator === 0
          ? 0
          : firstRuns.filter(({ playthrough }) => playthrough.status === 'active').length /
            denominator,
      medianDurationSeconds,
    },
    engagement: {
      reportsOpened: firstRuns.filter(({ playthrough }) => Boolean(playthrough.reportViewedAt))
        .length,
      reportOpenRate:
        completed === 0
          ? 0
          : firstRuns.filter(({ playthrough }) => Boolean(playthrough.reportViewedAt)).length /
            completed,
      replayStarted: replays.length,
      replayRate: denominator === 0 ? 0 : replays.length / denominator,
      replayStrategyChanges,
    },
    roundProgress,
    choiceDistribution,
    evidenceOpenRate: Object.fromEntries(
      Object.entries(evidenceOpenRate).map(([key, value]) => [
        key,
        denominator === 0 ? 0 : value / denominator,
      ]),
    ),
    endingDistribution,
    visualDistribution,
    eventDistribution,
    visualTestDistribution,
    visualRevisionCount,
    visualSystemImpact: Object.fromEntries(
      [...visualImpact.entries()].map(([key, value]) => [
        key,
        {
          count: value.count,
          averageCulturalCredibility: value.culturalCredibility / value.count,
          averageVisualRecognition: value.visualRecognition / value.count,
          averageVisualAdaptability: value.visualAdaptability / value.count,
        },
      ]),
    ),
    predictionCount: predictions,
    topPaths,
  };
}

export function buildAnonymousCase(bundles: StudentBundle[]) {
  const firstRuns = bundles.flatMap(({ playthroughs }) =>
    playthroughs.filter(
      (playthrough) => playthrough.kind === 'first_run' && playthrough.status === 'completed',
    ),
  );
  const candidate = [...firstRuns].sort(
    (a, b) =>
      b.state.metrics.reputationDebt - a.state.metrics.reputationDebt ||
      b.state.metrics.awareness - a.state.metrics.awareness,
  )[0];
  if (!candidate) return undefined;
  const collapse = candidate.state.metrics.reputationDebt >= 25;
  return {
    title: collapse ? '先被看见，后被追问' : '一个选择如何托住品牌',
    summary: collapse
      ? '这条匿名路径先获得了注意力，随后在承诺、交付和关系之间出现摩擦。'
      : '这条匿名路径没有依赖单一爆点，而是在几个触点之间逐步形成一致性。',
    endingId: candidate.state.endingId ?? null,
    finalMetrics: {
      cash: candidate.state.metrics.cash,
      awareness: candidate.state.metrics.awareness,
      trust: candidate.state.metrics.trust,
      loyalty: candidate.state.metrics.loyalty,
      brandConsistency: candidate.state.metrics.brandConsistency,
      reputationDebt: candidate.state.metrics.reputationDebt,
    },
    path: candidate.state.decisions
      .filter((decision) => decision.type === 'choice_selected')
      .map((decision) => ({
        roundId: decision.roundId,
        choiceId: String(decision.payload.choiceId ?? ''),
      })),
    discussionPrompt: collapse
      ? '哪一个早期承诺让后面的交付压力变大？'
      : '哪些看似保守的选择共同构成了品牌一致性？',
  };
}
