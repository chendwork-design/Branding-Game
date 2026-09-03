import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('V11 formal PostgreSQL storage contract', () => {
  it('adds the 1.2 action hash contract without rewriting historical data', async () => {
    const migration = await readFile(
      new URL('../../../db/migrations/0007_v11_formal_storage.sql', import.meta.url),
      'utf8',
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS action_hash');
    expect(migration).toContain("protocol_version IN ('1.0', '1.1', '1.2')");
    expect(migration).toContain('decision_logs_playthrough_action_id_idx');
    expect(migration).not.toMatch(/\b(UPDATE|DELETE|DROP TABLE|DROP INDEX)\b/i);

    const migrate = await readFile(new URL('../src/db/migrate.ts', import.meta.url), 'utf8');
    expect(migrate).toContain('0007_v11_formal_storage.sql');
    expect(migrate).toContain('v11FormalStorageSql');
  });

  it('uses a transaction and the V11 engine in the formal store', async () => {
    const store = await readFile(new URL('../src/store/v11-postgres.ts', import.meta.url), 'utf8');
    expect(store).toContain('export class V11PostgresStore');
    expect(store).toContain('async checkReadiness');
    expect(store).toContain("await this.pool.query('SELECT 1')");
    expect(store).toContain('async createClass');
    expect(store).toContain('async listClasses');
    expect(store).toContain('async updateClassStatus');
    expect(store).toContain('async deleteClass');
    expect(store).toContain('audit_logs');
    expect(store).toContain('ensureContentVersion');
    expect(store).toContain('SELECT ${playthroughColumns} FROM playthroughs');
    expect(store).toContain('FOR UPDATE');
    expect(store).toContain('action_hash');
    expect(store).toContain('applyV11Action');
    expect(store).toContain("await client.query('COMMIT')");
    expect(store).toContain("await client.query('ROLLBACK')");

    const server = await readFile(new URL('../src/v11-server.ts', import.meta.url), 'utf8');
    expect(server).toContain('V11PostgresStore');
    expect(server).toContain('process.env.DATABASE_URL');
  });
});
