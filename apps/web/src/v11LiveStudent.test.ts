import { describe, expect, it } from 'vitest';
import { v11FullContent, type GameContentV11 } from '@laojie/content-schema';
import { hashV11Content } from '@laojie/game-engine';
import { resolveRemoteContent } from './v11LiveStudent.js';

describe('live student content recovery', () => {
  it('loads the exact historical package required by an existing class session', async () => {
    const historicalContent: GameContentV11 = { ...v11FullContent, contentVersion: 'v1.2.0' };
    const historicalChecksum = hashV11Content(historicalContent);
    const resolved = await resolveRemoteContent(
      v11FullContent,
      { contentVersion: historicalContent.contentVersion, contentChecksum: historicalChecksum },
      {
        content: async (version) => {
          expect(version).toBe('v1.2.0');
          return { ...historicalContent, contentChecksum: historicalChecksum };
        },
      },
    );

    expect(resolved).toEqual(historicalContent);
  });

  it('does not request a second copy when the current package already matches the session', async () => {
    const resolved = await resolveRemoteContent(
      v11FullContent,
      {
        contentVersion: v11FullContent.contentVersion,
        contentChecksum: hashV11Content(v11FullContent),
      },
      { content: async () => Promise.reject(new Error('must not fetch')) },
    );

    expect(resolved).toBe(v11FullContent);
  });
});
