import type {
  V11ClassRecord,
  V11PlaythroughRecord,
  V11StudentIdentity,
} from './store/v11-types.js';

type Bundle = { identity: V11StudentIdentity; playthroughs: V11PlaythroughRecord[] };

function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function csv(rows: unknown[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function runs(
  bundles: Bundle[],
): Array<{ identity: V11StudentIdentity; run: V11PlaythroughRecord }> {
  return bundles.flatMap((bundle) =>
    bundle.playthroughs
      .filter((run) => run.kind === 'first_run')
      .map((run) => ({ identity: bundle.identity, run })),
  );
}

export function exportV11Csv(
  kind: 'progress' | 'decisions' | 'states' | 'reports',
  classRecord: V11ClassRecord,
  bundles: Bundle[],
): string {
  const header = [
    'classId',
    'classCode',
    'contentVersion',
    'studentNumber',
    'displayName',
    'playthroughId',
    'kind',
  ];
  const entries = runs(bundles);
  if (kind === 'progress') {
    return csv([
      [
        ...header,
        'status',
        'roundIndex',
        'completedRoundCount',
        'endingId',
        'startedAt',
        'completedAt',
      ],
      ...entries.map(({ identity, run }) => [
        ...headerValues(classRecord, identity, run),
        run.status,
        run.state.roundIndex,
        run.state.completedRoundIds.length,
        run.state.ending ?? '',
        run.startedAt,
        run.completedAt ?? '',
      ]),
    ]);
  }
  if (kind === 'decisions') {
    return csv([
      [...header, 'sequenceNo', 'actionType', 'roundId', 'payload', 'stateHash', 'createdAt'],
      ...entries.flatMap(({ identity, run }) =>
        run.logs.map((log) => [
          ...headerValues(classRecord, identity, run),
          log.sequenceNo,
          log.action.type,
          log.action.roundId ?? '',
          log.action.payload,
          log.stateHash,
          log.createdAt,
        ]),
      ),
    ]);
  }
  if (kind === 'states') {
    return csv([
      [
        ...header,
        'stateHash',
        'roundIndex',
        'visibleMetrics',
        'financialLedgerCount',
        'viewedEvidenceCount',
        'visualSystem',
        'eventCount',
      ],
      ...entries.map(({ identity, run }) => [
        ...headerValues(classRecord, identity, run),
        run.stateHash,
        run.state.roundIndex,
        {
          cashYuan: run.state.cashYuan,
          freeActionPoints: run.state.freeActionPoints,
          strategicActionPoints: run.state.strategicActionPoints,
          metrics: run.state.metrics,
        },
        run.state.financialLedger.length,
        run.state.viewedEvidenceIds.length,
        run.state.visualState.selectedVisualId ?? '',
        run.state.traces.flatMap((trace) => trace.triggeredEvents).length,
      ]),
    ]);
  }
  return csv([
    [
      ...header,
      'reportAvailable',
      'endingTitle',
      'overall',
      'routeTitle',
      'financialSummary',
      'evidenceDiagnosis',
      'riskDiagnosis',
      'causalExplanations',
    ],
    ...entries.map(({ identity, run }) => [
      ...headerValues(classRecord, identity, run),
      Boolean(run.report),
      run.report?.endingTitle ?? '',
      run.report?.scoreBreakdown.overall ?? '',
      run.report?.routeProfile?.title ?? '',
      run.report?.financialSummary ?? '',
      run.report?.evidenceDiagnosis ?? '',
      run.report?.riskDiagnosis ?? '',
      run.report?.causalExplanations ?? '',
    ]),
  ]);
}

function headerValues(
  classRecord: V11ClassRecord,
  identity: V11StudentIdentity,
  run: V11PlaythroughRecord,
): unknown[] {
  return [
    classRecord.id,
    classRecord.code,
    classRecord.contentVersion,
    identity.studentNumber,
    identity.displayName,
    run.id,
    run.kind,
  ];
}

export const v11ExportDictionary = {
  progress: '班级、学生、首局状态、轮次、结局和时间',
  decisions: '班级、学生、逐条动作、轮次、动作参数、状态哈希和时间',
  states: '班级、学生、状态哈希、轮次、公开指标、账本/证据/视觉/事件计数',
  reports: '班级、学生、报告可用性、结局、综合表现、路线、财务、证据、风险和因果摘要',
};
