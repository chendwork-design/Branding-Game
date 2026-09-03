import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Action, V11Action } from '@laojie/game-engine';

export type QueuedActionPayload = Action | V11Action;

export interface QueuedAction {
  idempotencyKey: string;
  playthroughId: string;
  action: QueuedActionPayload;
  createdAt: number;
}

export interface OutboxStorage {
  put(item: QueuedAction): Promise<void>;
  list(playthroughId: string): Promise<QueuedAction[]>;
  remove(idempotencyKey: string): Promise<void>;
}

export class MemoryOutboxStorage implements OutboxStorage {
  private readonly items = new Map<string, QueuedAction>();
  async put(item: QueuedAction): Promise<void> {
    this.items.set(item.idempotencyKey, item);
  }
  async list(playthroughId: string): Promise<QueuedAction[]> {
    return [...this.items.values()]
      .filter((item) => item.playthroughId === playthroughId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  async remove(idempotencyKey: string): Promise<void> {
    this.items.delete(idempotencyKey);
  }
}

interface OutboxDb extends DBSchema {
  actionQueue: {
    key: string;
    value: QueuedAction;
    indexes: { byPlaythrough: string };
  };
}

export class IndexedDbOutboxStorage implements OutboxStorage {
  private readonly db: Promise<IDBPDatabase<OutboxDb>>;
  constructor(name = 'laojie-brand-game') {
    this.db = openDB<OutboxDb>(name, 1, {
      upgrade(database) {
        const store = database.createObjectStore('actionQueue', { keyPath: 'idempotencyKey' });
        store.createIndex('byPlaythrough', 'playthroughId');
      },
    });
  }
  async put(item: QueuedAction): Promise<void> {
    await (await this.db).put('actionQueue', item);
  }
  async list(playthroughId: string): Promise<QueuedAction[]> {
    const items = await (
      await this.db
    ).getAllFromIndex('actionQueue', 'byPlaythrough', playthroughId);
    return items.sort((a, b) => a.createdAt - b.createdAt);
  }
  async remove(idempotencyKey: string): Promise<void> {
    await (await this.db).delete('actionQueue', idempotencyKey);
  }
}

export function createBrowserOutbox(): OutboxStorage {
  return typeof indexedDB === 'undefined'
    ? new MemoryOutboxStorage()
    : new IndexedDbOutboxStorage();
}
