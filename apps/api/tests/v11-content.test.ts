import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  loadPublishedContent,
  loadPublishedContentCatalog,
  publishedV11ContentUrl,
  validatePublishedContentArtifact,
} from '../src/v11-content.js';

describe('V11 published content loading', () => {
  it('loads the compiled artifact and exposes its verified manifest', async () => {
    const loaded = await loadPublishedContent();

    expect(loaded.content.contentVersion).toBe('v1.4.0');
    expect(loaded.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(loaded.content.rounds).toHaveLength(12);
  });

  it('rejects a missing published artifact with a startup-safe error', async () => {
    await expect(
      loadPublishedContent(new URL('../missing-v1.4.0.json', import.meta.url)),
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

  it('keeps immutable historical packages available with their released checksums', async () => {
    const catalog = await loadPublishedContentCatalog();

    expect([...catalog.keys()]).toEqual(['v1.2.0', 'v1.3.0', 'v1.4.0']);
    expect(catalog.get('v1.2.0')?.checksum).toBe(
      '1fa7ba5a3e3f69556430d1f874332a5591edbcc91b822dc20a6144214de5830c',
    );
    expect(catalog.get('v1.3.0')?.checksum).toBe(
      'e2b97960bcf20b13cae55c8258d1ae66084c54dc718fa4f24812440b89bc4c5f',
    );
    expect(catalog.get('v1.4.0')?.checksum).toBe(
      'c5e517820bf970453dd30fb4c4d0c71646b82e9e28c1eaf903028e5442c1426b',
    );
  });
});
