import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  loadPublishedContent,
  publishedV11ContentUrl,
  validatePublishedContentArtifact,
} from '../src/v11-content.js';

describe('v1.3 published content loading', () => {
  it('loads the compiled artifact and exposes its verified manifest', async () => {
    const loaded = await loadPublishedContent();

    expect(loaded.content.contentVersion).toBe('v1.3.0');
    expect(loaded.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(loaded.content.rounds).toHaveLength(12);
  });

  it('rejects a missing published artifact with a startup-safe error', async () => {
    await expect(
      loadPublishedContent(new URL('../missing-v1.3.0.json', import.meta.url)),
    ).rejects.toThrow('正式内容包');
  });

  it('rejects a published artifact whose checksum was tampered with', async () => {
    const artifact = JSON.parse(await readFile(publishedV11ContentUrl, 'utf8')) as Record<
      string,
      unknown
    >;

    expect(() =>
      validatePublishedContentArtifact({ ...artifact, checksum: '0'.repeat(64) }),
    ).toThrow('校验和不匹配');
  });
});
