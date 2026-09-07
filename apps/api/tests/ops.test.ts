import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('operations contracts', () => {
  it('keeps backup and restore commands explicit and non-shell based', async () => {
    const backup = await readFile(new URL('../../../scripts/backup.mjs', import.meta.url), 'utf8');
    const restore = await readFile(
      new URL('../../../scripts/restore.mjs', import.meta.url),
      'utf8',
    );
    const runbook = await readFile(
      new URL('../../../docs/ops-runbook.md', import.meta.url),
      'utf8',
    );
    const compose = await readFile(new URL('../../../compose.yaml', import.meta.url), 'utf8');
    expect(backup).toContain('shell: false');
    expect(backup).toContain('contentChecksum');
    expect(backup).toContain("process.env.CONTENT_VERSION ?? 'v1.3.0'");
    expect(backup).toContain('content/compiled/${contentVersion}.json');
    expect(backup).toContain('contentManifest.contentVersion !== contentVersion');
    expect(restore).toContain("CONFIRM_RESTORE !== 'YES'");
    expect(restore).toContain('--clean');
    expect(restore).toContain("process.env.CONTENT_VERSION ?? 'v1.3.0'");
    expect(restore).toContain('manifest.contentVersion !== contentVersion');
    expect(restore).toContain('manifest.contentChecksum !== contentChecksum');
    expect(restore).toContain('verifiedContentFile');
    expect(runbook).toContain('随机抽取学生的决策日志');
    expect(compose).toContain('image: postgres:18');
    expect(compose).toContain('pg_isready');
    expect(compose).toContain('laojie-postgres');
    const rootPackage = JSON.parse(
      await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { scripts?: Record<string, string> };
    expect(rootPackage.scripts?.['release:check']).toBe(
      'pnpm --filter @laojie/game-engine release:v11',
    );
    const pilotPreflight = await readFile(
      new URL('../../../scripts/pilot-preflight.mjs', import.meta.url),
      'utf8',
    );
    expect(pilotPreflight).toContain("organizedPilot: 'deferred-by-product-decision'");
    expect(pilotPreflight).toContain('docs/v1.2-发布候选验收包.md');
    expect(pilotPreflight).toContain('manualValidationPending: true');
  });
});
