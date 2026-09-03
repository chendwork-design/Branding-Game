import { describe, expect, it } from 'vitest';
import { fullContent } from '@laojie/content-schema/full';
import { MemoryOutboxStorage } from './offline/outbox.js';
import { StudentFlow } from './studentFlow.js';
import type { ActionResponse, StudentApi } from './api.js';

function fakeApi(online: { value: boolean }, calls: string[] = []): StudentApi {
  const responses: ActionResponse[] = [];
  return {
    async join() {
      throw new Error('not used');
    },
    async submit(_token, playthroughId, action, idempotencyKey) {
      calls.push(action.type);
      if (!online.value) throw new Error('网络断开');
      const response = {
        playthrough: {
          id: playthroughId,
          kind: 'first_run' as const,
          status: 'active' as const,
          roundIndex: action.type === 'choice_selected' ? 1 : 0,
          completedRoundIds: [],
          visibleMetrics: {},
          lastFeedback: [],
          reportAvailable: false,
        },
        log: { sequenceNo: responses.length + 1, stateHash: idempotencyKey },
      };
      responses.push(response);
      return response;
    },
    async report() {
      throw new Error('not used');
    },
    async reflection() {
      return undefined;
    },
    async replay() {
      throw new Error('not used');
    },
  };
}

describe('student offline flow', () => {
  it('finishes an online dispatch only after the server has attempted the action', async () => {
    const flow = new StudentFlow(
      fakeApi({ value: true }),
      new MemoryOutboxStorage(),
      'student-token',
      'awaited-sync-playthrough',
      'derived-seed',
    );
    await flow.dispatch('choice_selected', 'r01', { choiceId: 'r01-local' });
    expect(flow.serverView?.roundIndex).toBe(1);
    expect(flow.syncError).toBeUndefined();
  });

  it('keeps local progress and queues actions while offline, then syncs in order', async () => {
    const online = { value: false };
    const outbox = new MemoryOutboxStorage();
    const flow = new StudentFlow(
      fakeApi(online),
      outbox,
      'student-token',
      'playthrough',
      'derived-seed',
    );
    await flow.dispatch('choice_selected', 'r01', { choiceId: 'r01-local' });
    await flow.sync();
    expect(flow.state.roundIndex).toBe(1);
    expect(await outbox.list('playthrough')).toHaveLength(1);
    expect(flow.syncError).toContain('网络');

    online.value = true;
    await flow.sync();
    expect(await outbox.list('playthrough')).toHaveLength(0);
    expect(flow.serverView?.roundIndex).toBe(1);
  });

  it('does not retry a failed head action for every later local action', async () => {
    const online = { value: false };
    const calls: string[] = [];
    const flow = new StudentFlow(
      fakeApi(online, calls),
      new MemoryOutboxStorage(),
      'student-token',
      'offline-burst-playthrough',
      'derived-seed',
    );

    await flow.dispatch('intent_selected', 'r01', { intent: 'growth' });
    await flow.dispatch('risk_selected', 'r01', { risk: 'trust' });
    await flow.dispatch('choice_selected', 'r01', { choiceId: 'r01-local' });

    expect(calls).toEqual(['intent_selected']);
    expect(flow.state.roundIndex).toBe(1);
    online.value = true;
    await flow.sync();
    expect(calls).toEqual([
      'intent_selected',
      'intent_selected',
      'risk_selected',
      'choice_selected',
    ]);
  });

  it('uses the same content contract for visual actions', async () => {
    const online = { value: true };
    const flow = new StudentFlow(
      fakeApi(online),
      new MemoryOutboxStorage(),
      'student-token',
      'playthrough',
      'derived-seed',
    );
    flow.state = {
      ...flow.state,
      roundIndex: 7,
      completedRoundIds: ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07'],
    };
    await flow.dispatch('visual_selected', 'r08', { visualId: 'v-system' });
    await flow.dispatch('visual_tested', 'r08', { testId: 'sign_3_second' });
    await flow.sync();
    expect(flow.state.visualTestResults[0]?.passed).toBe(true);
    expect(fullContent.rounds.find((round) => round.roundId === 'r08')?.visualTests).toHaveLength(
      4,
    );
  });

  it('records one bounded visual revision alongside the visual tests', async () => {
    const flow = new StudentFlow(
      fakeApi({ value: true }),
      new MemoryOutboxStorage(),
      'student-token',
      'visual-revision-playthrough',
      'derived-seed',
    );
    flow.state = {
      ...flow.state,
      roundIndex: 7,
      completedRoundIds: ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07'],
    };
    await flow.dispatch('visual_selected', 'r08', { visualId: 'v-system' });
    await flow.dispatch('visual_revised', 'r08', { revision: '缩小后删掉一层文字' });
    await flow.sync();
    expect(flow.state.visualRevision).toBe('缩小后删掉一层文字');
    expect(flow.state.traces.at(-1)?.actionType).toBe('visual_revised');
  });

  it('persists a local snapshot and restores it without changing the server contract', async () => {
    const values = new Map<string, string>();
    const persistence = {
      read: (key: string) => values.get(key),
      write: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const outbox = new MemoryOutboxStorage();
    const flow = new StudentFlow(
      fakeApi({ value: true }),
      outbox,
      'student-token',
      'persisted-playthrough',
      'derived-seed',
      undefined,
      persistence,
    );
    await flow.dispatch('choice_selected', 'r01', { choiceId: 'r01-local' });
    await flow.sync();
    const restored = StudentFlow.restore(
      fakeApi({ value: true }),
      outbox,
      'student-token',
      'persisted-playthrough',
      'derived-seed',
      persistence,
    );
    expect(restored?.state.roundIndex).toBe(1);
    expect(restored?.state.completedRoundIds).toEqual(['r01']);
  });

  it('restores a replay as a separate run kind', () => {
    const values = new Map<string, string>();
    const persistence = {
      read: (key: string) => values.get(key),
      write: (key: string, value: string) => values.set(key, value),
    };
    const flow = new StudentFlow(
      fakeApi({ value: true }),
      new MemoryOutboxStorage(),
      'student-token',
      'replay-kind-playthrough',
      'derived-seed',
      undefined,
      persistence,
      'replay',
    );
    const restored = StudentFlow.restore(
      fakeApi({ value: true }),
      new MemoryOutboxStorage(),
      'student-token',
      flow.playthroughId,
      flow.seed,
      persistence,
      'replay',
    );
    expect(restored?.kind).toBe('replay');
  });
});
