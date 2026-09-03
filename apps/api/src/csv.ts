import type { ClassRecord, PlaythroughRecord, StudentIdentity } from './store/types.js';

const safeCell = (value: unknown): string => {
  const text =
    value === undefined || value === null
      ? ''
      : typeof value === 'string'
        ? value
        : JSON.stringify(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};
const row = (values: unknown[]) =>
  values
    .map((value) => {
      const text = safeCell(value).replaceAll('"', '""');
      return /[",\r\n]/.test(text) ? `"${text}"` : text;
    })
    .join(',');

type Bundle = { identity: StudentIdentity; playthroughs: PlaythroughRecord[] };

export function exportCsv(
  kind: 'progress' | 'decisions' | 'states' | 'reports',
  classRecord: ClassRecord,
  bundles: Bundle[],
): string {
  const lines: string[] = [];
  if (kind === 'progress') {
    lines.push(
      row([
        'studentNumber',
        'displayName',
        'kind',
        'status',
        'roundIndex',
        'endingId',
        'startedAt',
        'completedAt',
      ]),
    );
    for (const bundle of bundles)
      for (const playthrough of bundle.playthroughs)
        lines.push(
          row([
            bundle.identity.studentNumber,
            bundle.identity.displayName,
            playthrough.kind,
            playthrough.status,
            playthrough.state.roundIndex,
            playthrough.state.endingId,
            playthrough.startedAt,
            playthrough.completedAt,
          ]),
        );
  } else if (kind === 'decisions') {
    lines.push(
      row([
        'studentNumber',
        'displayName',
        'kind',
        'sequenceNo',
        'roundId',
        'actionType',
        'payload',
        'explanation',
        'theoryIds',
        'stateHash',
        'createdAt',
      ]),
    );
    for (const bundle of bundles)
      for (const playthrough of bundle.playthroughs)
        for (const log of playthrough.logs)
          lines.push(
            row([
              bundle.identity.studentNumber,
              bundle.identity.displayName,
              playthrough.kind,
              log.sequenceNo,
              log.action.roundId,
              log.action.type,
              log.action.payload,
              log.trace.explanation,
              log.trace.theoryIds,
              log.stateHash,
              log.createdAt,
            ]),
          );
  } else if (kind === 'states') {
    lines.push(
      row([
        'studentNumber',
        'displayName',
        'kind',
        'sequenceNo',
        'roundId',
        'actionType',
        'beforeVisibleMetrics',
        'afterVisibleMetrics',
        'events',
        'immediateEffects',
        'delayedEffects',
      ]),
    );
    for (const bundle of bundles)
      for (const playthrough of bundle.playthroughs)
        for (const log of playthrough.logs)
          lines.push(
            row([
              bundle.identity.studentNumber,
              bundle.identity.displayName,
              playthrough.kind,
              log.sequenceNo,
              log.action.roundId,
              log.action.type,
              log.trace.before,
              log.trace.after,
              log.trace.events.map((event) => event.eventId),
              log.trace.immediateEffects,
              log.trace.delayedEffects,
            ]),
          );
  } else {
    lines.push(
      row([
        'studentNumber',
        'displayName',
        'kind',
        'endingId',
        'maximumConsistency',
        'maximumContradiction',
        'reflection',
        'reportVersion',
        'reportViewedAt',
        'reportReadDepth',
      ]),
    );
    for (const bundle of bundles)
      for (const playthrough of bundle.playthroughs)
        if (playthrough.report)
          lines.push(
            row([
              bundle.identity.studentNumber,
              bundle.identity.displayName,
              playthrough.kind,
              playthrough.report.endingId,
              playthrough.report.maximumConsistency,
              playthrough.report.maximumContradiction,
              playthrough.reflection?.text,
              playthrough.report.reportVersion,
              playthrough.reportViewedAt,
              playthrough.reportReadDepth,
            ]),
          );
  }
  lines.unshift(row(['classId', classRecord.id, 'contentVersion', classRecord.contentVersion]));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export const exportDictionary = {
  progress: 'studentNumber/displayName/kind/status/roundIndex/endingId/startedAt/completedAt',
  decisions:
    'studentNumber/displayName/kind/sequenceNo/roundId/actionType/payload/explanation/theoryIds/stateHash/createdAt',
  states:
    'studentNumber/displayName/kind/sequenceNo/roundId/actionType/beforeVisibleMetrics/afterVisibleMetrics/events/immediateEffects/delayedEffects',
  reports:
    'studentNumber/displayName/kind/endingId/maximumConsistency/maximumContradiction/reflection/reportVersion/reportViewedAt/reportReadDepth',
} as const;
