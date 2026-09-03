import { describe, expect, it } from 'vitest';
import { fullContent } from '@laojie/content-schema/full';
import { applyAction, createInitialState, hashState, type Action } from '@laojie/game-engine';
import { buildAnonymousCase, buildClassAnalytics } from '../src/analytics.js';
import { exportCsv } from '../src/csv.js';
import type {
  ClassRecord,
  DecisionLog,
  PlaythroughRecord,
  StudentIdentity,
} from '../src/store/types.js';

const classRecord: ClassRecord = {
  id: 'class-analytics',
  code: 'ABC123',
  name: '分析测试班',
  contentVersion: fullContent.contentVersion,
  contentChecksum: 'checksum',
  seed: 'seed',
  status: 'active',
  createdAt: '2026-08-21T00:00:00.000Z',
};

const identity = (id: string, number: string, name: string): StudentIdentity => ({
  id,
  classId: classRecord.id,
  studentNumber: number,
  normalizedStudentNumber: number.toLowerCase(),
  displayName: name,
  createdAt: classRecord.createdAt,
});

function makePlaythrough(
  id: string,
  studentIdentityId: string,
  kind: 'first_run' | 'replay',
  completed: boolean,
): PlaythroughRecord {
  let state = createInitialState(fullContent, id);
  const logs: DecisionLog[] = [];
  for (const [index, round] of fullContent.rounds.entries()) {
    if (round.visualRequired) {
      const visualAction: Action = {
        actionId: `${id}-visual`,
        type: 'visual_selected',
        roundId: round.roundId,
        payload: { visualId: 'v-system' },
      };
      const visualResult = applyAction(state, fullContent, visualAction, 'analytics-seed');
      state = visualResult.state;
      logs.push({
        sequenceNo: logs.length + 1,
        idempotencyKey: visualAction.actionId,
        action: visualAction,
        trace: visualResult.trace,
        stateHash: visualResult.stateHash,
        createdAt: classRecord.createdAt,
      });
    }
    if (index === fullContent.rounds.length - 1 && !completed) break;
    const choice = round.choices[0]!;
    const action: Action = {
      actionId: `${id}-${round.roundId}`,
      type: 'choice_selected',
      roundId: round.roundId,
      payload: { choiceId: choice.choiceId },
    };
    const result = applyAction(state, fullContent, action, 'analytics-seed');
    state = result.state;
    logs.push({
      sequenceNo: logs.length + 1,
      idempotencyKey: action.actionId,
      action,
      trace: result.trace,
      stateHash: result.stateHash,
      createdAt: classRecord.createdAt,
    });
  }
  return {
    id,
    classId: classRecord.id,
    studentIdentityId,
    kind,
    status: completed ? 'completed' : 'active',
    state,
    stateHash: hashState(state),
    logs,
    startedAt: classRecord.createdAt,
    ...(completed ? { completedAt: classRecord.createdAt } : {}),
  };
}

describe('teacher analytics and export', () => {
  it('excludes replays and reports progress, decisions, paths and endings', () => {
    const firstRun = makePlaythrough('first-run', 'student-1', 'first_run', true);
    const active = makePlaythrough('active-run', 'student-2', 'first_run', false);
    const replay = makePlaythrough('replay', 'student-1', 'replay', true);
    const analytics = buildClassAnalytics(
      classRecord,
      [
        { identity: identity('student-1', '001', '甲'), playthroughs: [firstRun, replay] },
        { identity: identity('student-2', '002', '乙'), playthroughs: [active] },
      ],
      classRecord.createdAt,
    );

    expect(analytics.scope).toEqual({
      denominator: 2,
      excludedReplays: true,
      generatedAt: classRecord.createdAt,
    });
    expect(analytics.progress).toMatchObject({
      totalStudents: 2,
      started: 2,
      completed: 1,
      inProgress: 1,
      completionRate: 0.5,
    });
    expect(analytics.progress.successfulEntryRate).toBe(1);
    expect(analytics.progress.exitRate).toBe(0.5);
    expect(analytics.engagement).toMatchObject({
      replayStarted: 1,
      replayRate: 0.5,
      reportsOpened: 0,
      reportOpenRate: 0,
    });
    expect(analytics.choiceDistribution['r01-local']).toBe(2);
    expect(Object.values(analytics.endingDistribution).reduce((sum, value) => sum + value, 0)).toBe(
      1,
    );
    expect(analytics.topPaths).toHaveLength(2);
    expect(analytics.predictionCount).toBe(0);
    expect(analytics.visualSystemImpact['v-system']?.count).toBe(2);

    const anonymous = buildAnonymousCase([
      { identity: identity('student-1', '001', '甲'), playthroughs: [firstRun] },
    ]);
    expect(anonymous).toBeDefined();
    expect(JSON.stringify(anonymous)).not.toContain('001');
    expect(JSON.stringify(anonymous)).not.toContain('甲');
  });

  it('exports all teacher datasets as formula-safe UTF-8 CSV', () => {
    const playthrough = makePlaythrough('csv-run', 'student-1', 'first_run', false);
    const bundle = [
      { identity: identity('student-1', '=1+1', '=cmd'), playthroughs: [playthrough] },
    ];
    const csv = exportCsv('progress', classRecord, bundle);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'=cmd");
    expect(csv).toContain('classId,class-analytics,contentVersion');
    expect(exportCsv('decisions', classRecord, bundle)).toContain('actionType');
    expect(exportCsv('states', classRecord, bundle)).toContain('beforeVisibleMetrics');
    expect(exportCsv('reports', classRecord, bundle)).toContain('reportVersion');
  });
});
