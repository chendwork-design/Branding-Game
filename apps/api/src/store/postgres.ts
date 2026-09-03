import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { fullContent } from '@laojie/content-schema/full';
import {
  applyAction,
  createInitialState,
  hashState,
  visibleMetrics,
  type Action,
} from '@laojie/game-engine';
import { buildReport } from '@laojie/report-engine';
import type {
  ClassRecord,
  DecisionLog,
  OfflineContext,
  PlaythroughRecord,
  PublicPlaythroughView,
  Store,
  StudentIdentity,
  StudentSession,
  TeacherSession,
} from './types.js';

const NOW = () => new Date().toISOString();
const normalizeStudentNumber = (value: string) => value.trim().toLocaleLowerCase('zh-CN');
const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase('en-US');
const checksum = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function passwordHash(password: string, salt = randomBytes(16).toString('hex')): string {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function encryptionKey(): Buffer {
  const raw = process.env.SEED_ENCRYPTION_KEY;
  if (!raw) throw new Error('SEED_ENCRYPTION_KEY is required when PostgreSQL storage is enabled');
  const key = Buffer.from(raw, /^[0-9a-fA-F]{64}$/.test(raw) ? 'hex' : 'base64');
  if (key.length !== 32) throw new Error('SEED_ENCRYPTION_KEY must encode 32 bytes');
  return key;
}
function encryptSeed(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function decryptSeed(value: string): string {
  const packed = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
}

type ClassRow = {
  id: string;
  code: string;
  name: string;
  content_version: string;
  content_checksum: string;
  seed_ciphertext: string;
  status: ClassRecord['status'];
  created_at: Date | string;
};
type IdentityRow = {
  id: string;
  class_id: string;
  student_number: string;
  normalized_student_number: string;
  display_name: string;
  created_at: Date | string;
};
type PlaythroughRow = {
  id: string;
  class_id: string;
  student_identity_id: string;
  kind: 'first_run' | 'replay';
  status: 'active' | 'completed';
  state_json: PlaythroughRecord['state'];
  state_hash: string;
  report_json: PlaythroughRecord['report'] | null;
  reflection_json: PlaythroughRecord['reflection'] | null;
  report_viewed_at: Date | string | null;
  report_read_depth: number;
  started_at: Date | string;
  completed_at: Date | string | null;
};
type LogRow = {
  sequence_no: number;
  idempotency_key: string;
  action_json: Action;
  trace_json: DecisionLog['trace'];
  state_hash: string;
  created_at: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class PostgresStore implements Store {
  readonly content = fullContent;
  private readonly pool: Pool;
  private readonly teacherSessions = new Map<string, TeacherSession>();

  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL storage');
    encryptionKey();
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 20),
      idleTimeoutMillis: 30_000,
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async authenticateTeacher(email: string, password: string): Promise<string | undefined> {
    const result = await this.pool.query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM teachers WHERE email = $1',
      [normalizeEmail(email)],
    );
    const teacher = result.rows[0];
    if (!teacher || !verifyPassword(password, teacher.password_hash)) return undefined;
    const token = randomBytes(32).toString('base64url');
    this.teacherSessions.set(token, {
      token,
      teacherId: teacher.id,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
    return token;
  }

  async getTeacherSession(token: string): Promise<TeacherSession | undefined> {
    const session = this.teacherSessions.get(token);
    if (!session || session.expiresAt < Date.now()) return undefined;
    return session;
  }

  private async ensureContentVersion(
    client: PoolClient,
  ): Promise<{ id: string; checksum: string }> {
    const contentChecksum = checksum(this.content);
    const found = await client.query<{ id: string; checksum: string; status: string }>(
      'SELECT id, checksum, status FROM content_versions WHERE version = $1',
      [this.content.contentVersion],
    );
    if (found.rows[0]) {
      if (found.rows[0].checksum !== contentChecksum || found.rows[0].status !== 'published')
        throw new Error('configured content version is not the expected published package');
      return found.rows[0];
    }
    const inserted = await client.query<{ id: string; checksum: string }>(
      'INSERT INTO content_versions (version, engine_version, checksum, status, content_json, published_at) VALUES ($1, $2, $3, $4, $5::jsonb, now()) RETURNING id, checksum',
      [
        this.content.contentVersion,
        this.content.engineVersion,
        contentChecksum,
        'published',
        JSON.stringify(this.content),
      ],
    );
    return inserted.rows[0]!;
  }

  private classFromRow(row: ClassRow): ClassRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      contentVersion: row.content_version,
      contentChecksum: row.content_checksum,
      seed: decryptSeed(row.seed_ciphertext),
      status: row.status,
      createdAt: toIso(row.created_at),
    };
  }

  async createClass(name: string): Promise<ClassRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const contentVersion = await this.ensureContentVersion(client);
      let code = '';
      for (;;) {
        code = randomBytes(3).toString('hex').toUpperCase();
        const exists = await client.query('SELECT 1 FROM classes WHERE code = $1', [code]);
        if (!exists.rowCount) break;
      }
      const seed = randomBytes(32).toString('hex');
      const result = await client.query<ClassRow>(
        'INSERT INTO classes (code, name, content_version_id, seed_ciphertext) VALUES ($1, $2, $3, $4) RETURNING id, code, name, $5::text AS content_version, $6::text AS content_checksum, seed_ciphertext, status, created_at',
        [
          code,
          name.trim(),
          contentVersion.id,
          encryptSeed(seed),
          this.content.contentVersion,
          contentVersion.checksum,
        ],
      );
      await client.query('COMMIT');
      return this.classFromRow(result.rows[0]!);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listClasses(): Promise<ClassRecord[]> {
    const result = await this.pool.query<ClassRow>(
      'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id ORDER BY c.created_at DESC',
    );
    return result.rows.map((row) => this.classFromRow(row));
  }
  async getClassById(id: string): Promise<ClassRecord | undefined> {
    const result = await this.pool.query<ClassRow>(
      'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id WHERE c.id = $1',
      [id],
    );
    return result.rows[0] ? this.classFromRow(result.rows[0]) : undefined;
  }
  async getClassByCode(code: string): Promise<ClassRecord | undefined> {
    const result = await this.pool.query<ClassRow>(
      'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id WHERE c.code = $1',
      [code.trim().toUpperCase()],
    );
    return result.rows[0] ? this.classFromRow(result.rows[0]) : undefined;
  }
  async updateClassStatus(
    id: string,
    status: ClassRecord['status'],
  ): Promise<ClassRecord | undefined> {
    const result = await this.pool.query(
      "UPDATE classes SET status = $2, closed_at = CASE WHEN $2 = 'active' THEN NULL ELSE now() END WHERE id = $1 RETURNING id",
      [id, status],
    );
    return result.rowCount ? this.getClassById(id) : undefined;
  }
  async deleteClass(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM classes WHERE id = $1', [id]);
    return Boolean(result.rowCount);
  }

  private async rowToPlaythrough(row: PlaythroughRow): Promise<PlaythroughRecord> {
    const logs = await this.pool.query<LogRow>(
      'SELECT sequence_no, idempotency_key, action_json, trace_json, state_hash, created_at FROM decision_logs WHERE playthrough_id = $1 ORDER BY sequence_no',
      [row.id],
    );
    const reflections = await this.pool.query<{
      revision: number;
      text: string;
      created_at: Date | string;
    }>(
      'SELECT revision, text, created_at FROM reflections WHERE playthrough_id = $1 ORDER BY revision',
      [row.id],
    );
    const reflectionHistory = reflections.rows.map((reflection) => ({
      revision: reflection.revision,
      text: reflection.text,
      submittedAt: toIso(reflection.created_at),
    }));
    return {
      id: row.id,
      classId: row.class_id,
      studentIdentityId: row.student_identity_id,
      kind: row.kind,
      status: row.status,
      state: row.state_json,
      stateHash: row.state_hash,
      logs: logs.rows.map((log) => ({
        sequenceNo: log.sequence_no,
        idempotencyKey: log.idempotency_key,
        action: log.action_json,
        trace: log.trace_json,
        stateHash: log.state_hash,
        createdAt: toIso(log.created_at),
      })),
      ...(row.report_json ? { report: row.report_json } : {}),
      ...(row.report_viewed_at ? { reportViewedAt: toIso(row.report_viewed_at) } : {}),
      reportReadDepth: row.report_read_depth,
      ...(row.reflection_json ? { reflection: row.reflection_json } : {}),
      ...(reflectionHistory.length > 0 ? { reflectionHistory } : {}),
      startedAt: toIso(row.started_at),
      ...(row.completed_at ? { completedAt: toIso(row.completed_at) } : {}),
    };
  }
  private async playthroughRow(id: string): Promise<PlaythroughRecord | undefined> {
    const result = await this.pool.query<PlaythroughRow>(
      'SELECT id, class_id, student_identity_id, kind, status, state_json, state_hash, report_json, reflection_json, report_viewed_at, report_read_depth, started_at, completed_at FROM playthroughs WHERE id = $1',
      [id],
    );
    return result.rows[0] ? this.rowToPlaythrough(result.rows[0]) : undefined;
  }

  async joinStudent(
    classCode: string,
    studentNumber: string,
    displayName: string,
  ): Promise<{
    token: string;
    identity: StudentIdentity;
    playthrough: PublicPlaythroughView;
    offlineContext: OfflineContext;
  }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const classResult = await client.query<ClassRow>(
        'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id WHERE c.code = $1 FOR UPDATE',
        [classCode.trim().toUpperCase()],
      );
      const classRow = classResult.rows[0];
      if (!classRow || classRow.status !== 'active') throw new Error('班级不存在或已关闭');
      const normalized = normalizeStudentNumber(studentNumber);
      const name = displayName.trim();
      if (!normalized || !name) throw new Error('学号和姓名不能为空');
      let identityResult = await client.query<IdentityRow>(
        'SELECT id, class_id, student_number, normalized_student_number, display_name, created_at FROM student_identities WHERE class_id = $1 AND normalized_student_number = $2 FOR UPDATE',
        [classRow.id, normalized],
      );
      let identity = identityResult.rows[0];
      if (identity && identity.display_name !== name) throw new Error('该学号已经绑定了不同姓名');
      if (!identity) {
        identityResult = await client.query<IdentityRow>(
          'INSERT INTO student_identities (class_id, student_number, normalized_student_number, display_name) VALUES ($1, $2, $3, $4) RETURNING id, class_id, student_number, normalized_student_number, display_name, created_at',
          [classRow.id, studentNumber.trim(), normalized, name],
        );
        identity = identityResult.rows[0]!;
      }
      let playthrough = (
        await client.query<PlaythroughRow>(
          "SELECT id, class_id, student_identity_id, kind, status, state_json, state_hash, report_json, reflection_json, report_viewed_at, report_read_depth, started_at, completed_at FROM playthroughs WHERE student_identity_id = $1 AND kind = 'first_run'",
          [identity.id],
        )
      ).rows[0];
      if (!playthrough) {
        const state = createInitialState(this.content, randomUUID());
        const created = await client.query<PlaythroughRow>(
          "INSERT INTO playthroughs (id, class_id, student_identity_id, kind, state_json, state_hash) VALUES ($1, $2, $3, 'first_run', $4::jsonb, $5) RETURNING id, class_id, student_identity_id, kind, status, state_json, state_hash, report_json, reflection_json, report_viewed_at, report_read_depth, started_at, completed_at",
          [state.playthroughId, classRow.id, identity.id, JSON.stringify(state), hashState(state)],
        );
        playthrough = created.rows[0]!;
      }
      const token = randomBytes(32).toString('base64url');
      await client.query(
        "INSERT INTO student_sessions (token_hash, student_identity_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
        [tokenHash(token), identity.id],
      );
      await client.query('COMMIT');
      const record = await this.rowToPlaythrough(playthrough);
      return {
        token,
        identity: {
          id: identity.id,
          classId: identity.class_id,
          studentNumber: identity.student_number,
          normalizedStudentNumber: identity.normalized_student_number,
          displayName: identity.display_name,
          createdAt: toIso(identity.created_at),
        },
        playthrough: this.publicPlaythrough(record),
        offlineContext: this.offlineContext(this.classFromRow(classRow), record.id),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getStudentSession(token: string): Promise<StudentSession | undefined> {
    const result = await this.pool.query<{
      student_identity_id: string;
      expires_at: Date | string;
    }>(
      'SELECT student_identity_id, expires_at FROM student_sessions WHERE token_hash = $1 AND expires_at > now()',
      [tokenHash(token)],
    );
    const row = result.rows[0];
    return row
      ? {
          token,
          studentIdentityId: row.student_identity_id,
          expiresAt: new Date(row.expires_at).getTime(),
        }
      : undefined;
  }
  async getStudentIdentity(id: string): Promise<StudentIdentity | undefined> {
    const result = await this.pool.query<IdentityRow>(
      'SELECT id, class_id, student_number, normalized_student_number, display_name, created_at FROM student_identities WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          classId: row.class_id,
          studentNumber: row.student_number,
          normalizedStudentNumber: row.normalized_student_number,
          displayName: row.display_name,
          createdAt: toIso(row.created_at),
        }
      : undefined;
  }
  async getPlaythroughForStudent(
    token: string,
    playthroughId: string,
  ): Promise<PlaythroughRecord | undefined> {
    const session = await this.getStudentSession(token);
    if (!session) return undefined;
    const result = await this.pool.query<PlaythroughRow>(
      'SELECT id, class_id, student_identity_id, kind, status, state_json, state_hash, report_json, reflection_json, report_viewed_at, report_read_depth, started_at, completed_at FROM playthroughs WHERE id = $1 AND student_identity_id = $2',
      [playthroughId, session.studentIdentityId],
    );
    return result.rows[0] ? this.rowToPlaythrough(result.rows[0]) : undefined;
  }

  async submitAction(
    token: string,
    playthroughId: string,
    action: Action,
    idempotencyKey: string,
  ): Promise<{ playthrough: PublicPlaythroughView; log: DecisionLog }> {
    const session = await this.getStudentSession(token);
    if (!session) throw new Error('学生会话无效');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<PlaythroughRow>(
        'SELECT id, class_id, student_identity_id, kind, status, state_json, state_hash, report_json, reflection_json, report_viewed_at, report_read_depth, started_at, completed_at FROM playthroughs WHERE id = $1 AND student_identity_id = $2 FOR UPDATE',
        [playthroughId, session.studentIdentityId],
      );
      const row = result.rows[0];
      if (!row) throw new Error('游戏记录不存在');
      const existing = (
        await client.query<LogRow>(
          'SELECT sequence_no, idempotency_key, action_json, trace_json, state_hash, created_at FROM decision_logs WHERE playthrough_id = $1 AND idempotency_key = $2',
          [playthroughId, idempotencyKey],
        )
      ).rows[0];
      if (existing) {
        await client.query('ROLLBACK');
        const record = await this.rowToPlaythrough(row);
        return {
          playthrough: this.publicPlaythrough(record),
          log: {
            sequenceNo: existing.sequence_no,
            idempotencyKey: existing.idempotency_key,
            action: existing.action_json,
            trace: existing.trace_json,
            stateHash: existing.state_hash,
            createdAt: toIso(existing.created_at),
          },
        };
      }
      if (row.status === 'completed') throw new Error('首局已经完成，不能覆盖');
      const classRecord = await this.getClassById(row.class_id);
      if (!classRecord) throw new Error('班级不存在');
      const current = await this.rowToPlaythrough(row);
      const resultState = applyAction(
        current.state,
        this.content,
        action,
        checksum(`${classRecord.seed}:${playthroughId}`),
      );
      const log: DecisionLog = {
        sequenceNo: current.logs.length + 1,
        idempotencyKey,
        action,
        trace: resultState.trace,
        stateHash: resultState.stateHash,
        createdAt: NOW(),
      };
      await client.query(
        'INSERT INTO decision_logs (playthrough_id, sequence_no, idempotency_key, action_json, trace_json, state_hash) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)',
        [
          playthroughId,
          log.sequenceNo,
          idempotencyKey,
          JSON.stringify(action),
          JSON.stringify(resultState.trace),
          resultState.stateHash,
        ],
      );
      await client.query(
        'INSERT INTO state_snapshots (playthrough_id, sequence_no, state_json, state_hash) VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT DO NOTHING',
        [playthroughId, log.sequenceNo, JSON.stringify(resultState.state), resultState.stateHash],
      );
      if (action.type === 'evidence_viewed') {
        const evidenceId = String(action.payload.evidenceId ?? '');
        const evidence = this.content.rounds
          .find((round) => round.roundId === action.roundId)
          ?.evidence.find((item) => item.evidenceId === evidenceId);
        if (evidence)
          await client.query(
            'INSERT INTO evidence_views (playthrough_id, sequence_no, evidence_id, cost) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [playthroughId, log.sequenceNo, evidence.evidenceId, evidence.cost],
          );
      }
      if (action.type === 'visual_selected' || action.type === 'visual_revised') {
        await client.query(
          'INSERT INTO visual_choices (playthrough_id, sequence_no, visual_id, revision_text) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [
            playthroughId,
            log.sequenceNo,
            String(
              action.type === 'visual_selected'
                ? action.payload.visualId
                : (current.state.selectedVisualId ?? ''),
            ),
            action.type === 'visual_revised' ? String(action.payload.revision ?? '') : null,
          ],
        );
      }
      for (const event of resultState.trace.events) {
        const definition = this.content.events.find((item) => item.eventId === event.eventId);
        await client.query(
          'INSERT INTO game_events (playthrough_id, sequence_no, event_id, class_wide, trace_json) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING',
          [
            playthroughId,
            log.sequenceNo,
            event.eventId,
            definition?.classWide ?? false,
            JSON.stringify(event),
          ],
        );
      }
      const report = resultState.state.endingId
        ? buildReport(resultState.state, this.content)
        : null;
      await client.query(
        "UPDATE playthroughs SET state_json = $2::jsonb, state_hash = $3, status = $4, report_json = $5::jsonb, completed_at = CASE WHEN $4 = 'completed' THEN now() ELSE completed_at END WHERE id = $1",
        [
          playthroughId,
          JSON.stringify(resultState.state),
          resultState.stateHash,
          resultState.state.endingId ? 'completed' : 'active',
          JSON.stringify(report),
        ],
      );
      if (report)
        await client.query(
          'INSERT INTO reports (playthrough_id, state_hash, report_json) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING',
          [playthroughId, resultState.stateHash, JSON.stringify(report)],
        );
      if (resultState.state.endingId) {
        const ending = this.content.endings.find(
          (item) => item.endingId === resultState.state.endingId,
        );
        if (ending)
          await client.query(
            'INSERT INTO endings (playthrough_id, ending_id, state_hash, ending_json) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT DO NOTHING',
            [playthroughId, ending.endingId, resultState.stateHash, JSON.stringify(ending)],
          );
      }
      await client.query(
        'INSERT INTO sync_receipts (playthrough_id, idempotency_key, sequence_no, status, response_json) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING',
        [
          playthroughId,
          idempotencyKey,
          log.sequenceNo,
          'accepted',
          JSON.stringify({ sequenceNo: log.sequenceNo, stateHash: resultState.stateHash }),
        ],
      );
      await client.query('COMMIT');
      const updated = await this.playthroughRow(playthroughId);
      if (!updated) throw new Error('游戏记录保存失败');
      return { playthrough: this.publicPlaythrough(updated), log };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async startReplay(
    token: string,
    firstRunId: string,
  ): Promise<{ playthrough: PublicPlaythroughView; offlineContext: OfflineContext }> {
    const firstRun = await this.getPlaythroughForStudent(token, firstRunId);
    if (!firstRun || firstRun.kind !== 'first_run' || firstRun.status !== 'completed')
      throw new Error('首局尚未完成，不能开始重玩');
    const identity = await this.getStudentIdentity(firstRun.studentIdentityId);
    const classRecord = await this.getClassById(firstRun.classId);
    if (!identity || !classRecord) throw new Error('游戏记录不完整');
    const state = createInitialState(this.content, randomUUID());
    const inserted = await this.pool.query<PlaythroughRow>(
      "INSERT INTO playthroughs (id, class_id, student_identity_id, kind, state_json, state_hash) VALUES ($1, $2, $3, 'replay', $4::jsonb, $5) RETURNING id, class_id, student_identity_id, kind, status, state_json, state_hash, report_json, reflection_json, report_viewed_at, report_read_depth, started_at, completed_at",
      [state.playthroughId, classRecord.id, identity.id, JSON.stringify(state), hashState(state)],
    );
    const replay = await this.rowToPlaythrough(inserted.rows[0]!);
    return {
      playthrough: this.publicPlaythrough(replay),
      offlineContext: this.offlineContext(classRecord, replay.id),
    };
  }
  async getReport(token: string, playthroughId: string) {
    const playthrough = await this.getPlaythroughForStudent(token, playthroughId);
    if (!playthrough?.report) return undefined;
    await this.pool.query(
      'UPDATE playthroughs SET report_viewed_at = COALESCE(report_viewed_at, now()), report_read_depth = GREATEST(report_read_depth, 1) WHERE id = $1',
      [playthroughId],
    );
    return playthrough.report;
  }
  async saveReflection(token: string, playthroughId: string, text: string): Promise<void> {
    const playthrough = await this.getPlaythroughForStudent(token, playthroughId);
    if (!playthrough || playthrough.status !== 'completed')
      throw new Error('完成游戏后才能提交反思');
    const clean = text.trim();
    if (clean.length > 100) throw new Error('反思不能超过100字');
    const reflection = {
      text: clean,
      submittedAt: NOW(),
      revision: (playthrough.reflection?.revision ?? 0) + 1,
    };
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO reflections (playthrough_id, revision, text, created_at) VALUES ($1, $2, $3, $4)',
        [playthroughId, reflection.revision, reflection.text, reflection.submittedAt],
      );
      await client.query('UPDATE playthroughs SET reflection_json = $2::jsonb WHERE id = $1', [
        playthroughId,
        JSON.stringify(reflection),
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getClassStudents(classId: string) {
    const identities = await this.pool.query<IdentityRow>(
      'SELECT id, class_id, student_number, normalized_student_number, display_name, created_at FROM student_identities WHERE class_id = $1 ORDER BY created_at',
      [classId],
    );
    const output: Array<{ identity: StudentIdentity; playthroughs: PlaythroughRecord[] }> = [];
    for (const row of identities.rows) {
      const records = await this.pool.query<PlaythroughRow>(
        'SELECT id, class_id, student_identity_id, kind, status, state_json, state_hash, report_json, reflection_json, report_viewed_at, report_read_depth, started_at, completed_at FROM playthroughs WHERE student_identity_id = $1 ORDER BY started_at',
        [row.id],
      );
      output.push({
        identity: {
          id: row.id,
          classId: row.class_id,
          studentNumber: row.student_number,
          normalizedStudentNumber: row.normalized_student_number,
          displayName: row.display_name,
          createdAt: toIso(row.created_at),
        },
        playthroughs: await Promise.all(
          records.rows.map((record) => this.rowToPlaythrough(record)),
        ),
      });
    }
    return output;
  }

  private offlineContext(classRecord: ClassRecord, playthroughId: string): OfflineContext {
    return {
      contentVersion: this.content.contentVersion,
      contentChecksum: checksum(this.content),
      playthroughSeed: checksum(`${classRecord.seed}:${playthroughId}`),
    };
  }
  private publicPlaythrough(playthrough: PlaythroughRecord): PublicPlaythroughView {
    return {
      id: playthrough.id,
      kind: playthrough.kind,
      status: playthrough.status,
      roundIndex: playthrough.state.roundIndex,
      completedRoundIds: [...playthrough.state.completedRoundIds],
      visibleMetrics: visibleMetrics(playthrough.state) as Record<string, number>,
      lastFeedback: [...playthrough.state.lastFeedback],
      ...(playthrough.state.endingId ? { endingId: playthrough.state.endingId } : {}),
      reportAvailable: Boolean(playthrough.report),
    };
  }
}

export function hashTeacherPassword(password: string): string {
  return passwordHash(password);
}
