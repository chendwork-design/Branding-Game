import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('database object contract', () => {
  it('defines every append-only gameplay object required by M2', async () => {
    const initial = await readFile(
      new URL('../../../db/migrations/0001_initial.sql', import.meta.url),
      'utf8',
    );
    const gameplay = await readFile(
      new URL('../../../db/migrations/0005_gameplay_objects.sql', import.meta.url),
      'utf8',
    );
    const allSql = `${initial}\n${gameplay}`;
    for (const table of [
      'evidence_views',
      'visual_choices',
      'game_events',
      'state_snapshots',
      'endings',
      'reports',
      'reflections',
      'sync_receipts',
    ]) {
      expect(allSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(gameplay).toContain('UNIQUE (playthrough_id, evidence_id)');
    expect(gameplay).toContain('UNIQUE (playthrough_id, sequence_no)');
    expect(gameplay).toContain('UNIQUE (playthrough_id, idempotency_key)');
    expect(gameplay).toContain('ON DELETE CASCADE');
  });

  it('applies the gameplay-object migration from the migration entry point', async () => {
    const migrate = await readFile(new URL('../src/db/migrate.ts', import.meta.url), 'utf8');
    expect(migrate).toContain('0005_gameplay_objects.sql');
    expect(migrate).toContain('gameplayObjectsSql');
  });

  it('adds version metadata without rewriting historical playthroughs', async () => {
    const v11 = await readFile(
      new URL('../../../db/migrations/0006_v11_protocol.sql', import.meta.url),
      'utf8',
    );
    expect(v11).toContain('CREATE TABLE IF NOT EXISTS playthrough_protocols');
    expect(v11).toContain('protocol_version');
    expect(v11).toContain('content_checksum');
    expect(v11).toContain('UNIQUE (playthrough_id)');
    const executableSql = v11.replace(/ON DELETE CASCADE/gi, '');
    expect(executableSql).not.toMatch(/\b(UPDATE|DELETE|DROP)\b/i);

    const migrate = await readFile(new URL('../src/db/migrate.ts', import.meta.url), 'utf8');
    expect(migrate).toContain('0006_v11_protocol.sql');
    expect(migrate).toContain('v11ProtocolSql');
  });

  it('applies the additive V11 formal-storage migration', async () => {
    const formal = await readFile(
      new URL('../../../db/migrations/0007_v11_formal_storage.sql', import.meta.url),
      'utf8',
    );
    expect(formal).toContain('action_hash');
    expect(formal).toContain("'1.2'");
    expect(formal).toContain('decision_logs_playthrough_action_id_idx');
    expect(formal).not.toMatch(/\b(UPDATE|DELETE|DROP TABLE|DROP INDEX)\b/i);
    const migrate = await readFile(new URL('../src/db/migrate.ts', import.meta.url), 'utf8');
    expect(migrate).toContain('v11FormalStorageSql');
  });

  it('projects accepted actions into append-only teaching objects', async () => {
    const postgres = await readFile(new URL('../src/store/postgres.ts', import.meta.url), 'utf8');
    for (const table of [
      'state_snapshots',
      'evidence_views',
      'visual_choices',
      'game_events',
      'endings',
      'reports',
      'sync_receipts',
    ])
      expect(postgres).toContain(`INSERT INTO ${table}`);
  });
});
