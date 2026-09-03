import { fullContent } from '@laojie/content-schema/full';
import { applyAction, createInitialState, type Action, type GameState } from '@laojie/game-engine';
import type { GameReport } from '@laojie/report-engine';
import type { ActionResponse, StudentApi } from './api.js';
import type { OutboxStorage, QueuedActionPayload } from './offline/outbox.js';

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `action-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export interface StatePersistence {
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

const browserPersistence: StatePersistence = {
  read: (key) =>
    typeof localStorage === 'undefined' ? undefined : (localStorage.getItem(key) ?? undefined),
  write: (key, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
};

const stateKey = (playthroughId: string) => `laojie.student.state.${playthroughId}`;

export class StudentFlow {
  state: GameState;
  serverView?: ActionResponse['playthrough'];
  report?: GameReport;
  syncError: string | undefined;
  private syncPromise: Promise<void> | undefined;
  private writePromise: Promise<void> = Promise.resolve();
  constructor(
    readonly api: StudentApi,
    readonly outbox: OutboxStorage,
    readonly token: string,
    readonly playthroughId: string,
    readonly seed: string,
    initialState = createInitialState(fullContent, playthroughId),
    private readonly persistence: StatePersistence = browserPersistence,
    readonly kind: 'first_run' | 'replay' = 'first_run',
  ) {
    this.state = initialState;
    this.persistState();
  }

  static restore(
    api: StudentApi,
    outbox: OutboxStorage,
    token: string,
    playthroughId: string,
    seed: string,
    persistence: StatePersistence = browserPersistence,
    kind: 'first_run' | 'replay' = 'first_run',
  ): StudentFlow | undefined {
    const encoded = persistence.read(stateKey(playthroughId));
    if (!encoded) return undefined;
    try {
      const state = JSON.parse(encoded) as GameState;
      if (
        state.playthroughId !== playthroughId ||
        state.contentVersion !== fullContent.contentVersion
      )
        return undefined;
      return new StudentFlow(api, outbox, token, playthroughId, seed, state, persistence, kind);
    } catch {
      return undefined;
    }
  }

  async dispatch(type: Action['type'], roundId: string, payload: Action['payload']): Promise<void> {
    const action: Action = { actionId: uuid(), type, roundId, payload };
    const result = applyAction(this.state, fullContent, action, this.seed);
    this.state = result.state;
    this.persistState();
    const idempotencyKey = action.actionId;
    const item = {
      idempotencyKey,
      playthroughId: this.playthroughId,
      action,
      createdAt: Date.now(),
    };
    this.writePromise = this.writePromise.then(() => this.outbox.put(item));
    await this.writePromise;
    // Once a request has failed, keep subsequent local actions responsive instead of
    // retrying the same head item for every click. `sync()` is retried explicitly
    // after recovery (or by the online event handler in the screen).
    if (!this.syncError) await this.sync();
  }

  async sync(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    const run = this.syncQueue();
    this.syncPromise = run;
    try {
      await run;
    } finally {
      if (this.syncPromise === run) this.syncPromise = undefined;
    }
  }

  private async syncQueue(): Promise<void> {
    await this.writePromise;
    for (;;) {
      const queue = await this.outbox.list(this.playthroughId);
      if (queue.length === 0) return;
      if (!queue.some((item) => isLegacyAction(item.action))) return;
      this.syncError = undefined;
      for (const item of queue) {
        if (!isLegacyAction(item.action)) continue;
        try {
          const response = await this.api.submit(
            this.token,
            this.playthroughId,
            item.action,
            item.idempotencyKey,
          );
          this.serverView = response.playthrough;
          await this.outbox.remove(item.idempotencyKey);
          if (response.playthrough.reportAvailable) {
            try {
              this.report = await this.api.report(this.token, this.playthroughId);
            } catch {
              /* report can follow on a second sync */
            }
          }
        } catch (error) {
          this.syncError = error instanceof Error ? error.message : '等待网络恢复后同步';
          return;
        }
      }
    }
  }

  async submitReflection(text: string): Promise<void> {
    await this.api.reflection(this.token, this.playthroughId, text);
  }

  async startReplay(): Promise<StudentFlow> {
    const result = await this.api.replay(this.token, this.playthroughId);
    const next = new StudentFlow(
      this.api,
      this.outbox,
      this.token,
      result.playthrough.id,
      result.offlineContext.playthroughSeed,
      undefined,
      this.persistence,
      'replay',
    );
    next.serverView = result.playthrough;
    return next;
  }

  private persistState(): void {
    this.persistence.write(stateKey(this.playthroughId), JSON.stringify(this.state));
  }
}

function isLegacyAction(action: QueuedActionPayload): action is Action {
  return !('protocolVersion' in action);
}
