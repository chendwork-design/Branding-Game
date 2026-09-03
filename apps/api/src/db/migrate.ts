import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for db:migrate');
const pool = new Pool({ connectionString: databaseUrl });
const initialSql = await readFile(
  new URL('../../../../db/migrations/0001_initial.sql', import.meta.url),
  'utf8',
);
const reportReadingSql = await readFile(
  new URL('../../../../db/migrations/0002_report_reading.sql', import.meta.url),
  'utf8',
);
const firstRunConstraintSql = await readFile(
  new URL('../../../../db/migrations/0003_first_run_constraint.sql', import.meta.url),
  'utf8',
);
const immutableDataSql = await readFile(
  new URL('../../../../db/migrations/0004_immutable_published_data.sql', import.meta.url),
  'utf8',
);
const gameplayObjectsSql = await readFile(
  new URL('../../../../db/migrations/0005_gameplay_objects.sql', import.meta.url),
  'utf8',
);
const v11ProtocolSql = await readFile(
  new URL('../../../../db/migrations/0006_v11_protocol.sql', import.meta.url),
  'utf8',
);
const v11FormalStorageSql = await readFile(
  new URL('../../../../db/migrations/0007_v11_formal_storage.sql', import.meta.url),
  'utf8',
);
await pool.query(initialSql);
await pool.query(reportReadingSql);
await pool.query(firstRunConstraintSql);
await pool.query(immutableDataSql);
await pool.query(gameplayObjectsSql);
await pool.query(v11ProtocolSql);
await pool.query(v11FormalStorageSql);
await pool.end();
console.log(
  'database migrated: 0001_initial, 0002_report_reading, 0003_first_run_constraint, 0004_immutable_published_data, 0005_gameplay_objects, 0006_v11_protocol, 0007_v11_formal_storage',
);
