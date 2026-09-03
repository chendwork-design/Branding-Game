import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
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

export interface MemoryStoreOptions {
  /**
   * A deliberately opt-in class for local, disposable trial runs.  This is
   * never a substitute for the PostgreSQL-backed production store.
   */
  trialClassCode?: string;
}

function passwordHash(password: string, salt = randomBytes(16).toString('hex')): string {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function classCode(existing: Map<string, ClassRecord>): string {
  for (;;) {
    const code = randomBytes(3).toString('hex').toUpperCase();
    if (![...existing.values()].some((record) => record.code === code)) return code;
  }
}

export class MemoryStore implements Store {
  readonly content = fullContent;
  private readonly teacher = {
    id: 'teacher-1',
    email: 'teacher@example.test',
    passwordHash: passwordHash('change-me-in-production'),
  };
  private readonly teacherSessions = new Map<string, TeacherSession>();
  private readonly studentSessions = new Map<string, StudentSession>();
  private readonly classes = new Map<string, ClassRecord>();
  private readonly students = new Map<string, StudentIdentity>();
  private readonly playthroughs = new Map<string, PlaythroughRecord>();

  constructor(options: MemoryStoreOptions = {}) {
    const code = options.trialClassCode?.trim().toUpperCase();
    if (!code) return;
    if (!/^[A-Z0-9-]{4,32}$/.test(code))
      throw new Error('试运行班级码只能包含大写字母、数字或连字符，长度为4至32位');
    this.classes.set('local-trial-class', {
      id: 'local-trial-class',
      code,
      name: '本机试运行班级',
      contentVersion: this.content.contentVersion,
      contentChecksum: checksum(this.content),
      seed: `local-trial:${code}`,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  }

  async authenticateTeacher(email: string, password: string): Promise<string | undefined> {
    if (
      normalizeEmail(email) !== this.teacher.email ||
      !verifyPassword(password, this.teacher.passwordHash)
    )
      return undefined;
    const token = randomBytes(32).toString('base64url');
    this.teacherSessions.set(token, {
      token,
      teacherId: this.teacher.id,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
    return token;
  }

  async getTeacherSession(token: string): Promise<TeacherSession | undefined> {
    const session = this.teacherSessions.get(token);
    if (!session || session.expiresAt < Date.now()) return undefined;
    return session;
  }

  async createClass(name: string): Promise<ClassRecord> {
    const record: ClassRecord = {
      id: randomUUID(),
      code: classCode(this.classes),
      name: name.trim(),
      contentVersion: this.content.contentVersion,
      contentChecksum: checksum(this.content),
      seed: randomBytes(32).toString('hex'),
      status: 'active',
      createdAt: NOW(),
    };
    this.classes.set(record.id, record);
    return record;
  }

  async listClasses(): Promise<ClassRecord[]> {
    return [...this.classes.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getClassById(id: string): Promise<ClassRecord | undefined> {
    return this.classes.get(id);
  }
  async getClassByCode(code: string): Promise<ClassRecord | undefined> {
    return [...this.classes.values()].find((record) => record.code === code.trim().toUpperCase());
  }
  async updateClassStatus(
    id: string,
    status: ClassRecord['status'],
  ): Promise<ClassRecord | undefined> {
    const record = this.classes.get(id);
    if (!record) return undefined;
    record.status = status;
    return record;
  }
  async deleteClass(id: string): Promise<boolean> {
    if (!this.classes.delete(id)) return false;
    const studentIds = [...this.students.values()]
      .filter((student) => student.classId === id)
      .map((student) => student.id);
    for (const studentId of studentIds) this.students.delete(studentId);
    for (const [playthroughId, playthrough] of this.playthroughs)
      if (playthrough.classId === id) this.playthroughs.delete(playthroughId);
    for (const [token, session] of this.studentSessions)
      if (studentIds.includes(session.studentIdentityId)) this.studentSessions.delete(token);
    return true;
  }

  async joinStudent(
    classCodeInput: string,
    studentNumber: string,
    displayName: string,
  ): Promise<{
    token: string;
    identity: StudentIdentity;
    playthrough: PublicPlaythroughView;
    offlineContext: { contentVersion: string; contentChecksum: string; playthroughSeed: string };
  }> {
    const classRecord = await this.getClassByCode(classCodeInput);
    if (!classRecord || classRecord.status !== 'active') throw new Error('班级不存在或已关闭');
    const number = normalizeStudentNumber(studentNumber);
    const name = displayName.trim();
    if (number.length < 1 || name.length < 1) throw new Error('学号和姓名不能为空');
    let identity = [...this.students.values()].find(
      (student) => student.classId === classRecord.id && student.normalizedStudentNumber === number,
    );
    if (identity && identity.displayName !== name) throw new Error('该学号已经绑定了不同姓名');
    if (!identity) {
      identity = {
        id: randomUUID(),
        classId: classRecord.id,
        studentNumber: studentNumber.trim(),
        normalizedStudentNumber: number,
        displayName: name,
        createdAt: NOW(),
      };
      this.students.set(identity.id, identity);
    }
    let playthrough = [...this.playthroughs.values()].find(
      (item) => item.studentIdentityId === identity!.id && item.kind === 'first_run',
    );
    if (!playthrough) playthrough = this.newPlaythrough(classRecord, identity, 'first_run');
    const token = randomBytes(32).toString('base64url');
    this.studentSessions.set(token, {
      token,
      studentIdentityId: identity.id,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return {
      token,
      identity,
      playthrough: this.publicPlaythrough(playthrough),
      offlineContext: this.offlineContext(classRecord, playthrough.id),
    };
  }

  async getStudentSession(token: string): Promise<StudentSession | undefined> {
    const session = this.studentSessions.get(token);
    if (!session || session.expiresAt < Date.now()) return undefined;
    return session;
  }

  async getStudentIdentity(id: string): Promise<StudentIdentity | undefined> {
    return this.students.get(id);
  }

  async getPlaythroughForStudent(
    token: string,
    playthroughId: string,
  ): Promise<PlaythroughRecord | undefined> {
    const session = await this.getStudentSession(token);
    const playthrough = this.playthroughs.get(playthroughId);
    if (!session || !playthrough || playthrough.studentIdentityId !== session.studentIdentityId)
      return undefined;
    return playthrough;
  }

  async submitAction(
    token: string,
    playthroughId: string,
    action: Action,
    idempotencyKey: string,
  ): Promise<{ playthrough: PublicPlaythroughView; log: DecisionLog }> {
    const playthrough = await this.getPlaythroughForStudent(token, playthroughId);
    if (!playthrough) throw new Error('游戏记录不存在');
    const oldLog = playthrough.logs.find((log) => log.idempotencyKey === idempotencyKey);
    if (oldLog) return { playthrough: this.publicPlaythrough(playthrough), log: oldLog };
    if (playthrough.status === 'completed') throw new Error('首局已经完成，不能覆盖');
    const classRecord = this.classes.get(playthrough.classId);
    if (!classRecord) throw new Error('班级不存在');
    const result = applyAction(
      playthrough.state,
      this.content,
      action,
      this.playthroughSeed(classRecord, playthrough.id),
    );
    const log: DecisionLog = {
      sequenceNo: playthrough.logs.length + 1,
      idempotencyKey,
      action,
      trace: result.trace,
      stateHash: result.stateHash,
      createdAt: NOW(),
    };
    playthrough.logs.push(log);
    playthrough.state = result.state;
    playthrough.stateHash = result.stateHash;
    if (result.state.endingId) {
      playthrough.status = 'completed';
      playthrough.completedAt = NOW();
      playthrough.report = buildReport(result.state, this.content);
    }
    return { playthrough: this.publicPlaythrough(playthrough), log };
  }

  async startReplay(
    token: string,
    firstRunId: string,
  ): Promise<{
    playthrough: PublicPlaythroughView;
    offlineContext: { contentVersion: string; contentChecksum: string; playthroughSeed: string };
  }> {
    const firstRun = await this.getPlaythroughForStudent(token, firstRunId);
    if (!firstRun || firstRun.kind !== 'first_run' || firstRun.status !== 'completed')
      throw new Error('首局尚未完成，不能开始重玩');
    const identity = this.students.get(firstRun.studentIdentityId);
    const classRecord = this.classes.get(firstRun.classId);
    if (!identity || !classRecord) throw new Error('游戏记录不完整');
    const replay = this.newPlaythrough(classRecord, identity, 'replay');
    return {
      playthrough: this.publicPlaythrough(replay),
      offlineContext: this.offlineContext(classRecord, replay.id),
    };
  }

  async getReport(token: string, playthroughId: string) {
    const playthrough = await this.getPlaythroughForStudent(token, playthroughId);
    if (playthrough?.report) {
      playthrough.reportViewedAt ??= NOW();
      playthrough.reportReadDepth = Math.max(playthrough.reportReadDepth ?? 0, 1);
    }
    return playthrough?.report;
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
    playthrough.reflection = reflection;
    playthrough.reflectionHistory = [...(playthrough.reflectionHistory ?? []), reflection];
  }

  async getClassStudents(classId: string) {
    return [...this.students.values()]
      .filter((identity) => identity.classId === classId)
      .map((identity) => ({
        identity,
        playthroughs: [...this.playthroughs.values()].filter(
          (playthrough) => playthrough.studentIdentityId === identity.id,
        ),
      }));
  }

  private newPlaythrough(
    classRecord: ClassRecord,
    identity: StudentIdentity,
    kind: 'first_run' | 'replay',
  ): PlaythroughRecord {
    const id = randomUUID();
    const state = createInitialState(this.content, id);
    const record: PlaythroughRecord = {
      id,
      classId: classRecord.id,
      studentIdentityId: identity.id,
      kind,
      status: 'active',
      state,
      stateHash: hashState(state),
      logs: [],
      startedAt: NOW(),
    };
    this.playthroughs.set(id, record);
    return record;
  }

  private playthroughSeed(classRecord: ClassRecord, playthroughId: string): string {
    return checksum(`${classRecord.seed}:${playthroughId}`);
  }

  private offlineContext(classRecord: ClassRecord, playthroughId: string) {
    return {
      contentVersion: this.content.contentVersion,
      contentChecksum: checksum(this.content),
      playthroughSeed: this.playthroughSeed(classRecord, playthroughId),
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
