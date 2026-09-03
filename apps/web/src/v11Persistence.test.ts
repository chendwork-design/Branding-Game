import { describe, expect, it } from 'vitest';
import { createV11State } from '@laojie/game-engine';
import {
  MemoryV11SnapshotStorage,
  decodeV11Snapshot,
  encodeV11Snapshot,
} from './v11Persistence.js';
import { V11StudentFlow } from './v11StudentFlow.js';

describe('v1.1 IndexedDB snapshot contract', () => {
  it('persists and restores an encoded UI checkpoint without storing PII fields', async () => {
    const flow = new V11StudentFlow('persist-flow');
    const snapshot = flow.exportSnapshot();
    const storage = new MemoryV11SnapshotStorage();
    await storage.put('persist-flow', encodeV11Snapshot(snapshot));
    const restored = decodeV11Snapshot((await storage.get('persist-flow'))!);
    expect(restored?.playthroughId).toBe('persist-flow');
    expect(JSON.stringify(restored)).not.toContain('姓名');
    expect(JSON.stringify(restored)).not.toContain('学号');
  });

  it('rejects malformed or incompatible checkpoints before hydration', () => {
    expect(decodeV11Snapshot('{"version":2}')).toBeUndefined();
    expect(decodeV11Snapshot('{"version":1,"playthroughId":"x"}')).toBeUndefined();
    expect(createV11State('v1.1.0', 'fixture').cashYuan).toBe(500000);
  });
});
