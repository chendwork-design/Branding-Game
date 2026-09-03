import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { fullContent } from '@laojie/content-schema/full';
import { hashTeacherPassword } from '../store/postgres.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for db:seed:test');
const email = process.env.TEST_TEACHER_EMAIL ?? 'teacher@example.test';
const password = process.env.TEST_TEACHER_PASSWORD ?? 'change-me-in-production';
const pool = new Pool({ connectionString: databaseUrl });
const checksum = createHash('sha256').update(JSON.stringify(fullContent)).digest('hex');
await pool.query(
  'INSERT INTO teachers (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash',
  [email, hashTeacherPassword(password)],
);
await pool.query(
  "INSERT INTO content_versions (version, engine_version, checksum, status, content_json, published_at) VALUES ($1, $2, $3, 'published', $4::jsonb, now()) ON CONFLICT (version) DO NOTHING",
  [fullContent.contentVersion, fullContent.engineVersion, checksum, JSON.stringify(fullContent)],
);
await pool.end();
console.log(`test database seeded: ${email}, content ${fullContent.contentVersion}`);
