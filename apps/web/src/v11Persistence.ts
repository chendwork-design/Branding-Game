import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { V11PersistedFlowSnapshot } from './v11StudentFlow.js';

export interface V11SnapshotStorage {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryV11SnapshotStorage implements V11SnapshotStorage {
  private readonly snapshots = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.snapshots.get(key);
  }

  async put(key: string, value: string): Promise<void> {
    this.snapshots.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.snapshots.delete(key);
  }
}

interface V11SnapshotDb extends DBSchema {
  snapshots: {
    key: string;
    value: { key: string; value: string; updatedAt: number };
  };
}

export class IndexedDbV11SnapshotStorage implements V11SnapshotStorage {
  private readonly db: Promise<IDBPDatabase<V11SnapshotDb>>;

  constructor(name = 'laojie-brand-game-v11') {
    this.db = openDB<V11SnapshotDb>(name, 1, {
      upgrade(database) {
        database.createObjectStore('snapshots', { keyPath: 'key' });
      },
    });
  }

  async get(key: string): Promise<string | undefined> {
    return (await (await this.db).get('snapshots', key))?.value;
  }

  async put(key: string, value: string): Promise<void> {
    await (await this.db).put('snapshots', { key, value, updatedAt: Date.now() });
  }

  async remove(key: string): Promise<void> {
    await (await this.db).delete('snapshots', key);
  }
}

export function createBrowserV11SnapshotStorage(): V11SnapshotStorage {
  return typeof indexedDB === 'undefined'
    ? new MemoryV11SnapshotStorage()
    : new IndexedDbV11SnapshotStorage();
}

export function encodeV11Snapshot(snapshot: V11PersistedFlowSnapshot): string {
  return JSON.stringify(snapshot);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function decodeV11Snapshot(encoded: string): V11PersistedFlowSnapshot | undefined {
  try {
    const value: unknown = JSON.parse(encoded);
    if (!record(value) || value.version !== 1 || typeof value.playthroughId !== 'string')
      return undefined;
    if (
      !Array.isArray(value.screenStack) ||
      !record(value.state) ||
      typeof value.actionSequence !== 'number'
    )
      return undefined;
    return value as unknown as V11PersistedFlowSnapshot;
  } catch {
    return undefined;
  }
}
