import { describe, expect, it } from 'vitest';
import { v11FullContent, v11SliceContent } from '@laojie/content-schema';
import {
  applyV11Action,
  createV11State,
  deriveV11ResumeScreen,
  type V11Action,
  type V11GameState,
} from '@laojie/game-engine';
import { V11RemoteStudentFlow } from './v11RemoteStudentFlow.js';
import { MemoryOutboxStorage } from './offline/outbox.js';
import type { V11RemotePlaythrough, V11RemoteStudentApi } from './v11RemoteStudentApi.js';
import type { GameReportV11 } from '@laojie/report-engine';

function playthrough(state: V11GameState, rounds = v11SliceContent.rounds): V11RemotePlaythrough {
  const reportAvailable =
    state.roundIndex >= rounds.length &&
    !state.pendingRoundResult &&
    !(rounds.at(-1)?.roundId === 'r12' && !(state.chapterReviews ?? []).includes('r12'));
  const resumeScreen = deriveV11ResumeScreen(
    state,
    rounds.map((round) => round.roundId),
    reportAvailable,
  );
  return {
    id: state.playthroughId,
    kind: 'first_run',
    status: 'active',
    roundIndex: state.roundIndex,
    completedRoundIds: state.completedRoundIds,
    visibleMetrics: {
      cashYuan: state.cashYuan,
      stageActionPoints: state.stageActionPoints,
      elapsedDays: state.elapsedDays,
    },
    lastFeedback: [],
    reportAvailable,
    contentVersion: state.contentVersion,
    contentChecksum: 'test-content-checksum',
    resumeScreen,
    nextActionSequence: state.decisions.length + 1,
    state,
  };
}

describe('v1.1 remote student flow', () => {
  it('uses the server response as the only source of settled state', async () => {
    let serverState = createV11State('v1.1.0', 'remote-test');
    const submitted: V11Action['type'][] = [];
    const api: V11RemoteStudentApi = {
      async join() {
        throw new Error('not used');
      },
      async replay() {
        throw new Error('not used');
      },
      async me() {
        return { playthrough: playthrough(serverState) };
      },
      async report() {
        throw new Error('not used');
      },
      async submit(_token, _playthroughId, action) {
        submitted.push(action.type);
        serverState = applyV11Action(serverState, v11SliceContent, action, 'remote-seed').state;
        return { playthrough: playthrough(serverState) };
      },
    };
    const flow = new V11RemoteStudentFlow(
      'remote-test',
      'remote-seed',
      'student-token',
      v11SliceContent,
      api,
      playthrough(serverState),
    );
    await flow.completeOnboarding();
    flow.openActionCenter();
    await flow.doStageAction('r01-observe-footfall');
    await flow.viewEvidence('ev-r01-footfall');
    const cashBeforePreview = flow.state.cashYuan;
    await flow.selectChoice('r01-neighbor');
    expect(flow.state.cashYuan).toBe(cashBeforePreview);
    await flow.commitChoice('r01-neighbor');
    expect(flow.state.cashYuan).toBe(serverState.cashYuan);
    expect(submitted).toEqual([
      'onboarding_completed',
      'question_action_executed',
      'evidence_viewed',
      'choice_previewed',
      'choice_committed',
    ]);
    expect(flow.snapshot.screenStack.at(-1)).toEqual({ id: 'round-result' });
    expect(flow.state.pendingRoundResult?.roundId).toBe('r01');
  });

  it('rehydrates the authoritative result before entering the result screen when a submit response is incomplete', async () => {
    let serverState = createV11State('v1.1.0', 'remote-rehydrate');
    let readCount = 0;
    const api: V11RemoteStudentApi = {
      async join() {
        throw new Error('not used');
      },
      async replay() {
        throw new Error('not used');
      },
      async me() {
        readCount += 1;
        return { playthrough: playthrough(serverState) };
      },
      async report() {
        throw new Error('not used');
      },
      async submit(_token, _playthroughId, action) {
        serverState = applyV11Action(
          serverState,
          v11SliceContent,
          action,
          'remote-rehydrate-seed',
        ).state;
        const incomplete = JSON.parse(JSON.stringify(serverState)) as V11GameState;
        if (action.type === 'choice_committed') incomplete.pendingRoundResult = undefined;
        return { playthrough: playthrough(incomplete) };
      },
    };
    const flow = new V11RemoteStudentFlow(
      'remote-rehydrate',
      'remote-rehydrate-seed',
      'student-token',
      v11SliceContent,
      api,
      playthrough(serverState),
    );

    await flow.completeOnboarding();
    flow.openActionCenter();
    await flow.commitChoice('r01-neighbor');

    expect(readCount).toBe(1);
    expect(flow.state.pendingRoundResult?.roundId).toBe('r01');
    expect(flow.snapshot.screenStack.at(-1)).toEqual({ id: 'round-result' });
    expect(flow.snapshot.error).toBeUndefined();
  });

  it('keeps the result screen recoverable instead of entering a blank page when the result is unavailable after rehydration', async () => {
    let serverState = createV11State('v1.1.0', 'remote-recovery-needed');
    const api: V11RemoteStudentApi = {
      async join() {
        throw new Error('not used');
      },
      async replay() {
        throw new Error('not used');
      },
      async me() {
        return { playthrough: playthrough(serverState) };
      },
      async report() {
        throw new Error('not used');
      },
      async submit(_token, _playthroughId, action) {
        serverState = applyV11Action(
          serverState,
          v11SliceContent,
          action,
          'remote-recovery-needed-seed',
        ).state;
        const incomplete = JSON.parse(JSON.stringify(serverState)) as V11GameState;
        if (action.type === 'choice_committed') incomplete.pendingRoundResult = undefined;
        serverState = incomplete;
        return { playthrough: playthrough(incomplete) };
      },
    };
    const flow = new V11RemoteStudentFlow(
      'remote-recovery-needed',
      'remote-recovery-needed-seed',
      'student-token',
      v11SliceContent,
      api,
      playthrough(serverState),
    );

    await flow.completeOnboarding();
    flow.openActionCenter();
    await flow.commitChoice('r01-neighbor');

    expect(flow.snapshot.screenStack.at(-1)).toEqual({ id: 'round-result' });
    expect(flow.state.pendingRoundResult).toBeUndefined();
    expect(flow.snapshot.error).toContain('正在核对');
  });

  it('returns a refreshed incomplete settlement to the recovery screen instead of a normal briefing', () => {
    let serverState = createV11State('v1.1.0', 'remote-refresh-recovery');
    serverState = applyV11Action(
      serverState,
      v11SliceContent,
      {
        protocolVersion: '1.2',
        actionId: 'refresh-onboarding',
        type: 'onboarding_completed',
        payload: {},
      },
      'remote-refresh-seed',
    ).state;
    serverState = applyV11Action(
      serverState,
      v11SliceContent,
      {
        protocolVersion: '1.2',
        actionId: 'refresh-commit',
        type: 'choice_committed',
        roundId: 'r01',
        payload: { choiceId: 'r01-neighbor', decisionGroupId: 'dg-r01' },
      },
      'remote-refresh-seed',
    ).state;
    const incomplete = JSON.parse(JSON.stringify(serverState)) as V11GameState;
    incomplete.pendingRoundResult = undefined;
    const api: V11RemoteStudentApi = {
      async join() {
        throw new Error('not used');
      },
      async replay() {
        throw new Error('not used');
      },
      async me() {
        return { playthrough: playthrough(serverState) };
      },
      async report() {
        throw new Error('not used');
      },
      async submit() {
        throw new Error('not used');
      },
    };

    const flow = new V11RemoteStudentFlow(
      'remote-refresh-recovery',
      'remote-refresh-seed',
      'student-token',
      v11SliceContent,
      api,
      playthrough(incomplete),
    );

    expect(flow.snapshot.screenStack).toEqual([{ id: 'round-result' }]);
    expect(flow.snapshot.error).toContain('正在核对');
  });

  it('waits for annual review acknowledgement before requesting the final report', async () => {
    const finalRound = v11FullContent.rounds.find((round) => round.roundId === 'r12');
    if (!finalRound) throw new Error('缺少年度方向回合');
    const content = { ...v11FullContent, rounds: [finalRound] };
    let serverState = createV11State(content.contentVersion, 'remote-annual-review');
    let reportCalls = 0;
    const submitted: V11Action['type'][] = [];
    const api: V11RemoteStudentApi = {
      async join() {
        throw new Error('not used');
      },
      async replay() {
        throw new Error('not used');
      },
      async me() {
        return { playthrough: playthrough(serverState, content.rounds) };
      },
      async report() {
        reportCalls += 1;
        return {} as GameReportV11;
      },
      async submit(_token, _playthroughId, action) {
        submitted.push(action.type);
        serverState = applyV11Action(serverState, content, action, 'remote-annual-seed').state;
        return { playthrough: playthrough(serverState, content.rounds) };
      },
    };
    const flow = new V11RemoteStudentFlow(
      'remote-annual-review',
      'remote-annual-seed',
      'student-token',
      content,
      api,
      playthrough(serverState, content.rounds),
    );
    await flow.completeOnboarding();
    flow.openActionCenter();
    await flow.commitChoice('r12-steady-renewal');
    await flow.acknowledgeResult();

    expect(flow.snapshot.screenStack).toEqual([{ id: 'chapter-review' }]);
    expect(reportCalls).toBe(0);
    await flow.continueAfterChapterReview();
    expect(submitted.at(-1)).toBe('chapter_review_acknowledged');
    expect(reportCalls).toBe(1);
    expect(flow.snapshot.screenStack).toEqual([{ id: 'complete' }]);
  });

  it('reuses the queued command when the server committed but the response was lost', async () => {
    let serverState = createV11State('v1.1.0', 'remote-outbox');
    let lostResponse = true;
    const submitted: Array<{ actionId: string; idempotencyKey: string }> = [];
    const receipts = new Map<string, V11RemotePlaythrough>();
    const outbox = new MemoryOutboxStorage();
    const api: V11RemoteStudentApi = {
      async join() {
        throw new Error('not used');
      },
      async replay() {
        throw new Error('not used');
      },
      async me() {
        return { playthrough: playthrough(serverState) };
      },
      async report() {
        throw new Error('not used');
      },
      async submit(_token, _playthroughId, action, idempotencyKey) {
        submitted.push({ actionId: action.actionId, idempotencyKey });
        const previous = receipts.get(idempotencyKey);
        if (previous) return { playthrough: previous };
        serverState = applyV11Action(
          serverState,
          v11SliceContent,
          action,
          'remote-outbox-seed',
        ).state;
        const response = playthrough(serverState);
        receipts.set(idempotencyKey, response);
        if (lostResponse) {
          lostResponse = false;
          throw new Error('网络响应暂时不可用');
        }
        return { playthrough: response };
      },
    };
    const flow = new V11RemoteStudentFlow(
      'remote-outbox',
      'remote-outbox-seed',
      'student-token',
      v11SliceContent,
      api,
      playthrough(serverState),
      outbox,
    );

    await expect(flow.completeOnboarding()).rejects.toThrow('网络响应');
    const resumedFlow = new V11RemoteStudentFlow(
      'remote-outbox',
      'remote-outbox-seed',
      'student-token',
      v11SliceContent,
      api,
      playthrough(serverState),
      outbox,
    );
    await resumedFlow.flushPending();

    expect(submitted).toHaveLength(2);
    expect(submitted[0]).toEqual(submitted[1]);
    expect(await outbox.list('remote-outbox')).toEqual([]);
    expect(
      resumedFlow.state.decisions.filter((decision) => decision.type === 'onboarding_completed'),
    ).toHaveLength(1);
  });
});
