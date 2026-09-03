import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('PostgreSQL migration contract', () => {
  it('contains the immutable class, first-run and append-only log constraints', async () => {
    const sql = await readFile(
      new URL('../../../db/migrations/0001_initial.sql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS content_versions');
    expect(sql).toContain('UNIQUE (class_id, normalized_student_number)');
    expect(sql).toContain('UNIQUE (playthrough_id, sequence_no)');
    expect(sql).toContain('UNIQUE (playthrough_id, idempotency_key)');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain("CHECK (kind IN ('first_run', 'replay'))");
    expect(sql).toContain("CHECK (status IN ('active', 'closed', 'archived'))");
    const reportReading = await readFile(
      new URL('../../../db/migrations/0002_report_reading.sql', import.meta.url),
      'utf8',
    );
    expect(reportReading).toContain('report_viewed_at');
    expect(reportReading).toContain('report_read_depth');
    const firstRun = await readFile(
      new URL('../../../db/migrations/0003_first_run_constraint.sql', import.meta.url),
      'utf8',
    );
    expect(firstRun).toContain('one_first_run_per_student');
    expect(firstRun).toContain("kind = 'first_run'");
    const immutable = await readFile(
      new URL('../../../db/migrations/0004_immutable_published_data.sql', import.meta.url),
      'utf8',
    );
    expect(immutable).toContain('classes_rule_immutable');
    expect(immutable).toContain('published_content_immutable');
  });
});
