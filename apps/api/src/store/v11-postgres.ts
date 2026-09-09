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
import type { GameContentV11 } from '@laojie/content-schema';
import {
  applyV11Action,
  createV11State,
  deriveV11ResumeScreen,
  hashV11State,
  type V11Action,
  type V11GameState,
} from '@laojie/game-engine';
import { buildV11Report } from '@laojie/report-engine';
import type {
  V11ClassRecord,
  V11DecisionLog,
  V11PlaythroughRecord,
  V11PublicPlaythroughView,
  V11Store,
  V11StudentIdentity,
  V11StudentSession,
  V11TeacherSession,
} from './v11-types.js';

const NOW = () => new Date().toISOString();
const normalize = (value: string) => value.trim().toLocaleLowerCase('zh-CN');
const checksum = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const actionDigest = (action: V11Action) =>
  createHash('sha256').update(stableJson(action)).digest('hex');
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function passwordHash(password: string, salt = randomBytes(16).toString('hex')): string {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function encryptionKey(): Buffer {
  const raw = process.env.SEED_ENCRYPTION_KEY;
  if (!raw)
    throw new Error('SEED_ENCRYPTION_KEY is required when V11 PostgreSQL storage is enabled');
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

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

type ClassRow = {
  id: string;
  code: string;
  name: string;
  content_version: string;
  content_checksum: string;
  seed_ciphertext: string;
  status: V11ClassRecord['status'];
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
  state_json: V11GameState;
  state_hash: string;
  report_json: V11PlaythroughRecord['report'] | null;
  started_at: Date | string;
  completed_at: Date | string | null;
};

type LogRow = {
  sequence_no: number;
  idempotency_key: string;
  action_hash: string | null;
  action_json: V11Action;
  trace_json: V11DecisionLog['trace'];
  state_hash: string;
  created_at: Date | string;
};

const playthroughColumns = `
  id, class_id, student_identity_id, kind, status, state_json, state_hash,
  report_json, started_at, completed_at`;

export interface V11PostgresStoreOptions {
  content: GameContentV11;
  additionalContents?: readonly GameContentV11[];
  connectionString?: string;
}

export class V11PostgresStore implements V11Store {
  readonly content: GameContentV11;
  private readonly contents: ReadonlyMap<string, GameContentV11>;
  private readonly pool: Pool;
  private readonly teacherSessions = new Map<string, V11TeacherSession>();

  constructor(options: V11PostgresStoreOptions) {
    this.content = options.content;
    const contents = new Map<string, GameContentV11>();
    for (const candidate of [this.content, ...(options.additionalContents ?? [])]) {
      const prior = contents.get(candidate.contentVersion);
      if (prior && checksum(prior) !== checksum(candidate))
        throw new Error(`同一内容版本不能对应多个内容包：${candidate.contentVersion}`);
      contents.set(candidate.contentVersion, candidate);
    }
    this.contents = contents;
    const connectionString = options.connectionString ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required for V11 PostgreSQL storage');
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

  async checkReadiness(): Promise<void> {
    await this.pool.query('SELECT 1');
    const required = await this.pool.query<{ version: string; checksum: string; status: string }>(
      'SELECT version, checksum, status FROM content_versions WHERE version = $1',
      [this.content.contentVersion],
    );
    const current = required.rows[0];
    if (!current || current.status !== 'published' || current.checksum !== checksum(this.content))
      throw new Error('当前内容不是数据库中的已发布候选版本');
    const classVersions = await this.pool.query<{ version: string; checksum: string }>(
      'SELECT DISTINCT cv.version, cv.checksum FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id',
    );
    for (const classVersion of classVersions.rows) {
      const content = this.getContent(classVersion.version);
      if (!content || checksum(content) !== classVersion.checksum)
        throw new Error(`班级绑定的内容包未随服务发布：${classVersion.version}`);
    }
  }

  getContent(version: string): GameContentV11 | undefined {
    return this.contents.get(version);
  }

  async authenticateTeacher(email: string, password: string): Promise<string | undefined> {
    const result = await this.pool.query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM teachers WHERE email = $1',
      [normalize(email)],
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

  async getTeacherSession(token: string): Promise<V11TeacherSession | undefined> {
    const session = this.teacherSessions.get(token);
    if (!session || session.expiresAt < Date.now()) return undefined;
    return session;
  }

  private async ensureContentVersion(
    client: PoolClient,
    content: GameContentV11 = this.content,
  ): Promise<{ id: string; checksum: string }> {
    const contentChecksum = checksum(content);
    const found = await client.query<{ id: string; checksum: string; status: string }>(
      'SELECT id, checksum, status FROM content_versions WHERE version = $1',
      [content.contentVersion],
    );
    if (found.rows[0]) {
      if (found.rows[0].checksum !== contentChecksum || found.rows[0].status !== 'published')
        throw new Error('当前内容不是数据库中的已发布候选版本');
      return found.rows[0];
    }
    const inserted = await client.query<{ id: string; checksum: string }>(
      "INSERT INTO content_versions (version, engine_version, checksum, status, content_json, published_at) VALUES ($1, $2, $3, 'published', $4::jsonb, now()) RETURNING id, checksum",
      [content.contentVersion, content.engineVersion, contentChecksum, JSON.stringify(content)],
    );
    return inserted.rows[0]!;
  }

  async createClass(name: string): Promise<V11ClassRecord> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('班级名称不能为空');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const contentVersion = await this.ensureContentVersion(client);
      let code = '';
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = randomBytes(4).toString('hex').toUpperCase();
        const exists = await client.query('SELECT 1 FROM classes WHERE code = $1', [candidate]);
        if (!exists.rowCount) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('无法生成唯一班级码，请稍后再试');
      const seed = randomBytes(32).toString('hex');
      const created = await client.query<ClassRow>(
        'INSERT INTO classes (code, name, content_version_id, seed_ciphertext) VALUES ($1, $2, $3, $4) RETURNING id, code, name, $5::text AS content_version, $6::text AS content_checksum, seed_ciphertext, status, created_at',
        [
          code,
          trimmedName,
          contentVersion.id,
          encryptSeed(seed),
          this.content.contentVersion,
          contentVersion.checksum,
        ],
      );
      await client.query('COMMIT');
      return this.classFromRow(created.rows[0]!);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listClasses(): Promise<V11ClassRecord[]> {
    const result = await this.pool.query<ClassRow>(
      'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id ORDER BY c.created_at DESC',
    );
    return result.rows.map((row) => this.classFromRow(row));
  }

  async updateClassStatus(
    id: string,
    status: V11ClassRecord['status'],
  ): Promise<V11ClassRecord | undefined> {
    const result = await this.pool.query<ClassRow>(
      "UPDATE classes SET status = $2, closed_at = CASE WHEN $2 = 'active' THEN NULL ELSE now() END WHERE id = $1 RETURNING id, code, name, (SELECT version FROM content_versions WHERE id = content_version_id) AS content_version, (SELECT checksum FROM content_versions WHERE id = content_version_id) AS content_checksum, seed_ciphertext, status, created_at",
      [id, status],
    );
    return result.rows[0] ? this.classFromRow(result.rows[0]) : undefined;
  }

  async deleteClass(id: string, actorId?: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM classes WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!existing.rowCount) {
        await client.query('COMMIT');
        return false;
      }
      await client.query(
        "INSERT INTO audit_logs (teacher_id, action, target_type, target_id, metadata_json) VALUES ($1, 'class_deleted', 'class', $2, $3::jsonb)",
        [
          actorId ?? null,
          id,
          JSON.stringify({ scope: 'class', contentVersion: this.content.contentVersion }),
        ],
      );
      const deleted = await client.query('DELETE FROM classes WHERE id = $1', [id]);
      await client.query('COMMIT');
      return Boolean(deleted.rowCount);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getClassById(id: string): Promise<V11ClassRecord | undefined> {
    const result = await this.pool.query<ClassRow>(
      'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id WHERE c.id = $1',
      [id],
    );
    return result.rows[0] ? this.classFromRow(result.rows[0]) : undefined;
  }

  private contentForClassRow(row: ClassRow): GameContentV11 {
    const content = this.getContent(row.content_version);
    if (!content || checksum(content) !== row.content_checksum)
      throw new Error(`班级绑定的内容包未随服务发布：${row.content_version}`);
    return content;
  }

  async joinStudent(classCode: string, studentNumber: string, displayName: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const classResult = await client.query<ClassRow>(
        'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id WHERE c.code = $1 FOR UPDATE',
        [classCode.trim().toUpperCase()],
      );
      const classRow = classResult.rows[0];
      if (!classRow || classRow.status !== 'active') throw new Error('班级不存在或已关闭');
      const content = this.contentForClassRow(classRow);
      const normalizedStudentNumber = normalize(studentNumber);
      const name = displayName.trim();
      if (!normalizedStudentNumber || !name) throw new Error('学号和姓名不能为空');
      let identity = (
        await client.query<IdentityRow>(
          'SELECT id, class_id, student_number, normalized_student_number, display_name, created_at FROM student_identities WHERE class_id = $1 AND normalized_student_number = $2 FOR UPDATE',
          [classRow.id, normalizedStudentNumber],
        )
      ).rows[0];
      if (identity && identity.display_name !== name) throw new Error('该学号已经绑定了不同姓名');
      if (!identity) {
        identity = (
          await client.query<IdentityRow>(
            'INSERT INTO student_identities (class_id, student_number, normalized_student_number, display_name) VALUES ($1, $2, $3, $4) RETURNING id, class_id, student_number, normalized_student_number, display_name, created_at',
            [classRow.id, studentNumber.trim(), normalizedStudentNumber, name],
          )
        ).rows[0]!;
      }
      let playthrough = (
        await client.query<PlaythroughRow>(
          `SELECT ${playthroughColumns} FROM playthroughs WHERE student_identity_id = $1 AND kind = 'first_run'`,
          [identity.id],
        )
      ).rows[0];
      if (!playthrough) {
        const state = createV11State(content.contentVersion, randomUUID());
        playthrough = (
          await client.query<PlaythroughRow>(
            `INSERT INTO playthroughs (id, class_id, student_identity_id, kind, state_json, state_hash) VALUES ($1, $2, $3, 'first_run', $4::jsonb, $5) RETURNING ${playthroughColumns}`,
            [
              state.playthroughId,
              classRow.id,
              identity.id,
              JSON.stringify(state),
              hashV11State(state),
            ],
          )
        ).rows[0]!;
        await client.query(
          'INSERT INTO playthrough_protocols (playthrough_id, protocol_version, engine_version, report_version, content_version, content_checksum) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            playthrough.id,
            '1.2',
            content.engineVersion,
            content.reportVersion,
            content.contentVersion,
            checksum(content),
          ],
        );
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
        identity: this.identityFromRow(identity),
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

  async getStudentSession(token: string): Promise<V11StudentSession | undefined> {
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

  async startReplay(token: string, firstRunId: string) {
    const session = await this.getStudentSession(token);
    if (!session) throw new Error('学生会话无效');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const firstRun = (
        await client.query<PlaythroughRow>(
          `SELECT ${playthroughColumns} FROM playthroughs WHERE id = $1 AND student_identity_id = $2 AND kind = 'first_run' FOR UPDATE`,
          [firstRunId, session.studentIdentityId],
        )
      ).rows[0];
      if (!firstRun || firstRun.status !== 'completed' || !firstRun.report_json)
        throw new Error('完成首局后才能开始独立重玩');
      const classRow = (
        await client.query<ClassRow>(
          'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id WHERE c.id = $1 FOR SHARE',
          [firstRun.class_id],
        )
      ).rows[0];
      if (!classRow || classRow.status !== 'active') throw new Error('班级不存在或已关闭');
      const content = this.contentForClassRow(classRow);
      const state = createV11State(content.contentVersion, randomUUID());
      const replay = (
        await client.query<PlaythroughRow>(
          `INSERT INTO playthroughs (id, class_id, student_identity_id, kind, state_json, state_hash) VALUES ($1, $2, $3, 'replay', $4::jsonb, $5) RETURNING ${playthroughColumns}`,
          [
            state.playthroughId,
            firstRun.class_id,
            session.studentIdentityId,
            JSON.stringify(state),
            hashV11State(state),
          ],
        )
      ).rows[0]!;
      await client.query(
        'INSERT INTO playthrough_protocols (playthrough_id, protocol_version, engine_version, report_version, content_version, content_checksum) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          replay.id,
          '1.2',
          content.engineVersion,
          content.reportVersion,
          content.contentVersion,
          checksum(content),
        ],
      );
      await client.query('COMMIT');
      const record = await this.rowToPlaythrough(replay);
      return {
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

  async getPlaythroughForStudent(
    token: string,
    playthroughId: string,
  ): Promise<V11PlaythroughRecord | undefined> {
    const session = await this.getStudentSession(token);
    if (!session) return undefined;
    const result = await this.pool.query<PlaythroughRow>(
      `SELECT ${playthroughColumns} FROM playthroughs WHERE id = $1 AND student_identity_id = $2`,
      [playthroughId, session.studentIdentityId],
    );
    return result.rows[0] ? this.rowToPlaythrough(result.rows[0]) : undefined;
  }

  async submitAction(
    token: string,
    playthroughId: string,
    action: V11Action,
    idempotencyKey: string,
  ) {
    const session = await this.getStudentSession(token);
    if (!session) throw new Error('学生会话无效');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<PlaythroughRow>(
        `SELECT ${playthroughColumns} FROM playthroughs WHERE id = $1 AND student_identity_id = $2 FOR UPDATE`,
        [playthroughId, session.studentIdentityId],
      );
      const row = result.rows[0];
      if (!row) throw new Error('游戏记录不存在');
      const existing = (
        await client.query<LogRow>(
          'SELECT sequence_no, idempotency_key, action_hash, action_json, trace_json, state_hash, created_at FROM decision_logs WHERE playthrough_id = $1 AND idempotency_key = $2',
          [playthroughId, idempotencyKey],
        )
      ).rows[0];
      if (existing) {
        if ((existing.action_hash ?? actionDigest(existing.action_json)) !== actionDigest(action))
          throw new Error('幂等键已用于另一动作，拒绝复用');
        await client.query('ROLLBACK');
        const record = await this.rowToPlaythrough(row);
        return { playthrough: this.publicPlaythrough(record), log: this.logFromRow(existing) };
      }
      const existingAction = (
        await client.query(
          "SELECT 1 FROM decision_logs WHERE playthrough_id = $1 AND action_json ->> 'actionId' = $2 LIMIT 1",
          [playthroughId, action.actionId],
        )
      ).rowCount;
      if (existingAction) throw new Error('动作 ID 已用于另一请求，拒绝重复执行');
      if (row.status === 'completed') throw new Error('首局已经完成，不能覆盖');
      const classRow = (
        await client.query<ClassRow>(
          'SELECT c.id, c.code, c.name, cv.version AS content_version, cv.checksum AS content_checksum, c.seed_ciphertext, c.status, c.created_at FROM classes c JOIN content_versions cv ON cv.id = c.content_version_id WHERE c.id = $1',
          [row.class_id],
        )
      ).rows[0];
      if (!classRow) throw new Error('班级不存在');
      const content = this.contentForClassRow(classRow);
      const currentLogs = await client.query<LogRow>(
        'SELECT sequence_no, idempotency_key, action_hash, action_json, trace_json, state_hash, created_at FROM decision_logs WHERE playthrough_id = $1 ORDER BY sequence_no',
        [playthroughId],
      );
      const resultState = applyV11Action(
        row.state_json,
        content,
        action,
        checksum(`${decryptSeed(classRow.seed_ciphertext)}:${playthroughId}`),
      );
      const log: V11DecisionLog = {
        sequenceNo: currentLogs.rows.length + 1,
        idempotencyKey,
        actionHash: actionDigest(action),
        action,
        trace: resultState.trace,
        stateHash: resultState.stateHash,
        createdAt: NOW(),
      };
      await client.query(
        'INSERT INTO decision_logs (playthrough_id, sequence_no, idempotency_key, action_hash, action_json, trace_json, state_hash) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)',
        [
          playthroughId,
          log.sequenceNo,
          idempotencyKey,
          log.actionHash,
          JSON.stringify(action),
          JSON.stringify(resultState.trace),
          resultState.stateHash,
        ],
      );
      await client.query(
        'INSERT INTO state_snapshots (playthrough_id, sequence_no, state_json, state_hash) VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT DO NOTHING',
        [playthroughId, log.sequenceNo, JSON.stringify(resultState.state), resultState.stateHash],
      );
      await this.insertTeachingProjections(
        client,
        playthroughId,
        action,
        log.sequenceNo,
        resultState,
        content,
      );
      const annualReviewPending =
        content.rounds.at(-1)?.roundId === 'r12' &&
        !(resultState.state.chapterReviews ?? []).includes('r12');
      const report =
        resultState.state.roundIndex >= content.rounds.length &&
        !resultState.state.pendingRoundResult &&
        !annualReviewPending
          ? buildV11Report(resultState.state, content)
          : undefined;
      await client.query(
        "UPDATE playthroughs SET state_json = $2::jsonb, state_hash = $3, status = $4, report_json = $5::jsonb, completed_at = CASE WHEN $4 = 'completed' THEN now() ELSE completed_at END WHERE id = $1",
        [
          playthroughId,
          JSON.stringify(resultState.state),
          resultState.stateHash,
          report ? 'completed' : 'active',
          report ? JSON.stringify(report) : null,
        ],
      );
      if (report) {
        await client.query(
          'INSERT INTO reports (playthrough_id, state_hash, report_json) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING',
          [playthroughId, resultState.stateHash, JSON.stringify(report)],
        );
      }
      if (resultState.state.ending) {
        const ending = content.endings.find((item) => item.endingId === resultState.state.ending);
        if (ending) {
          await client.query(
            'INSERT INTO endings (playthrough_id, ending_id, state_hash, ending_json) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT DO NOTHING',
            [playthroughId, ending.endingId, resultState.stateHash, JSON.stringify(ending)],
          );
        }
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

  async getReport(token: string, playthroughId: string) {
    const playthrough = await this.getPlaythroughForStudent(token, playthroughId);
    return playthrough?.report;
  }

  async getClassStudents(classId: string) {
    const identities = await this.pool.query<IdentityRow>(
      'SELECT id, class_id, student_number, normalized_student_number, display_name, created_at FROM student_identities WHERE class_id = $1 ORDER BY created_at',
      [classId],
    );
    return Promise.all(
      identities.rows.map(async (identity) => {
        const records = await this.pool.query<PlaythroughRow>(
          `SELECT ${playthroughColumns} FROM playthroughs WHERE student_identity_id = $1 ORDER BY started_at`,
          [identity.id],
        );
        return {
          identity: this.identityFromRow(identity),
          playthroughs: await Promise.all(records.rows.map((row) => this.rowToPlaythrough(row))),
        };
      }),
    );
  }

  private async insertTeachingProjections(
    client: PoolClient,
    playthroughId: string,
    action: V11Action,
    sequenceNo: number,
    resultState: { state: V11GameState; trace: V11GameState['traces'][number] },
    content: GameContentV11,
  ) {
    if (action.type === 'evidence_viewed') {
      const evidenceId = String(action.payload.evidenceId ?? '');
      const evidence = content.rounds
        .find((round) => round.roundId === action.roundId)
        ?.evidence.find((item) => item.evidenceId === evidenceId);
      if (evidence) {
        await client.query(
          'INSERT INTO evidence_views (playthrough_id, sequence_no, evidence_id, cost) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [playthroughId, sequenceNo, evidence.evidenceId, evidence.actionPointCost],
        );
      }
    }
    if (action.type === 'visual_selected') {
      await client.query(
        'INSERT INTO visual_choices (playthrough_id, sequence_no, visual_id, revision_text) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [playthroughId, sequenceNo, String(action.payload.visualId ?? ''), null],
      );
    }
    for (const event of resultState.trace.triggeredEvents) {
      await client.query(
        'INSERT INTO game_events (playthrough_id, sequence_no, event_id, class_wide, trace_json) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING',
        [playthroughId, sequenceNo, event.eventId, false, JSON.stringify(event)],
      );
    }
  }

  private async rowToPlaythrough(row: PlaythroughRow): Promise<V11PlaythroughRecord> {
    const logs = await this.pool.query<LogRow>(
      'SELECT sequence_no, idempotency_key, action_hash, action_json, trace_json, state_hash, created_at FROM decision_logs WHERE playthrough_id = $1 ORDER BY sequence_no',
      [row.id],
    );
    return {
      id: row.id,
      classId: row.class_id,
      studentIdentityId: row.student_identity_id,
      kind: row.kind,
      status: row.status,
      state: row.state_json,
      stateHash: row.state_hash,
      logs: logs.rows.map((log) => this.logFromRow(log)),
      ...(row.report_json ? { report: row.report_json } : {}),
      startedAt: toIso(row.started_at),
      ...(row.completed_at ? { completedAt: toIso(row.completed_at) } : {}),
    };
  }

  private async playthroughRow(id: string): Promise<V11PlaythroughRecord | undefined> {
    const result = await this.pool.query<PlaythroughRow>(
      `SELECT ${playthroughColumns} FROM playthroughs WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.rowToPlaythrough(result.rows[0]) : undefined;
  }

  private logFromRow(log: LogRow): V11DecisionLog {
    return {
      sequenceNo: log.sequence_no,
      idempotencyKey: log.idempotency_key,
      actionHash: log.action_hash ?? actionDigest(log.action_json),
      action: log.action_json,
      trace: log.trace_json,
      stateHash: log.state_hash,
      createdAt: toIso(log.created_at),
    };
  }

  private classFromRow(row: ClassRow): V11ClassRecord {
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

  private identityFromRow(row: IdentityRow): V11StudentIdentity {
    return {
      id: row.id,
      classId: row.class_id,
      studentNumber: row.student_number,
      normalizedStudentNumber: row.normalized_student_number,
      displayName: row.display_name,
      createdAt: toIso(row.created_at),
    };
  }

  private offlineContext(classRecord: V11ClassRecord, playthroughId: string) {
    const content = this.getContent(classRecord.contentVersion);
    if (!content || checksum(content) !== classRecord.contentChecksum)
      throw new Error(`班级绑定的内容包未随服务发布：${classRecord.contentVersion}`);
    return {
      contentVersion: content.contentVersion,
      contentChecksum: checksum(content),
      playthroughSeed: checksum(`${classRecord.seed}:${playthroughId}`),
    };
  }

  private publicPlaythrough(playthrough: V11PlaythroughRecord): V11PublicPlaythroughView {
    const content = this.getContent(playthrough.state.contentVersion);
    if (!content)
      throw new Error(`游戏记录绑定的内容包未随服务发布：${playthrough.state.contentVersion}`);
    const resumeScreen = deriveV11ResumeScreen(
      playthrough.state,
      content.rounds.map((round) => round.roundId),
      Boolean(playthrough.report),
    );
    const pendingChapterReview =
      resumeScreen === 'chapter-review' ? playthrough.state.completedRoundIds.at(-1) : undefined;
    return {
      id: playthrough.id,
      kind: playthrough.kind,
      status: playthrough.status,
      roundIndex: playthrough.state.roundIndex,
      completedRoundIds: [...playthrough.state.completedRoundIds],
      visibleMetrics: {
        cashYuan: playthrough.state.cashYuan,
        stageActionPoints: playthrough.state.stageActionPoints,
        elapsedDays: playthrough.state.elapsedDays,
        ...playthrough.state.metrics,
      },
      ...(playthrough.state.pendingRoundResult
        ? { pendingRoundResult: playthrough.state.pendingRoundResult }
        : {}),
      lastFeedback: playthrough.state.traces.at(-1)?.explanation
        ? [playthrough.state.traces.at(-1)!.explanation]
        : [],
      reportAvailable: Boolean(playthrough.report),
      contentVersion: content.contentVersion,
      contentChecksum: checksum(content),
      resumeScreen,
      nextActionSequence: playthrough.logs.length + 1,
      ...(pendingChapterReview ? { chapterReviewPending: pendingChapterReview } : {}),
      state: JSON.parse(JSON.stringify(playthrough.state)) as V11GameState,
    };
  }
}

export function hashV11Content(content: GameContentV11): string {
  return checksum(content);
}

export function hashV11Password(password: string): string {
  return passwordHash(password);
}

export function encryptV11Seed(seed: string): string {
  return encryptSeed(seed);
}
