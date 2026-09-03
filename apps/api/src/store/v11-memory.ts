import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { v11SliceContent, type GameContentV11 } from '@laojie/content-schema';
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
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
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

export interface V11MemoryStoreOptions {
  trialClassCode?: string;
  content?: GameContentV11;
}

export class V11MemoryStore implements V11Store {
  readonly content: GameContentV11;
  private readonly contentChecksum: string;
  private readonly classes = new Map<string, V11ClassRecord>();
  private readonly students = new Map<string, V11StudentIdentity>();
  private readonly sessions = new Map<string, V11StudentSession>();
  private readonly teacherSessions = new Map<string, V11TeacherSession>();
  private readonly playthroughs = new Map<string, V11PlaythroughRecord>();
  private readonly auditRecords: Array<{
    action: 'class_deleted';
    targetType: 'class';
    targetId: string;
    actorId?: string;
    createdAt: string;
  }> = [];

  constructor(options: V11MemoryStoreOptions = {}) {
    this.content = options.content ?? v11SliceContent;
    this.contentChecksum = digest(this.content);
    const code = options.trialClassCode?.trim().toUpperCase();
    if (!code) return;
    if (!/^[A-Z0-9-]{4,32}$/.test(code))
      throw new Error('试运行班级码只能包含大写字母、数字或连字符，长度为4至32位');
    this.classes.set('v11-trial-class', {
      id: 'v11-trial-class',
      code,
      name: this.content.rounds.length > 4 ? 'v1.2 十二轮正式候选班' : 'v1.2 四轮切片试运行班级',
      contentVersion: this.content.contentVersion,
      contentChecksum: this.contentChecksum,
      seed: `v11-trial:${code}`,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  }

  async checkReadiness(): Promise<void> {
    return;
  }

  async authenticateTeacher(email: string, password: string): Promise<string | undefined> {
    if (normalize(email) !== 'teacher@example.test' || password !== 'change-me-in-production')
      return undefined;
    const token = randomBytes(32).toString('base64url');
    this.teacherSessions.set(token, {
      token,
      teacherId: 'teacher-local',
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
    return token;
  }

  async getTeacherSession(token: string): Promise<V11TeacherSession | undefined> {
    const session = this.teacherSessions.get(token);
    if (!session || session.expiresAt < Date.now()) return undefined;
    return session;
  }

  async createClass(name: string): Promise<V11ClassRecord> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('班级名称不能为空');
    let code = '';
    do code = randomBytes(4).toString('hex').toUpperCase();
    while ([...this.classes.values()].some((item) => item.code === code));
    const record: V11ClassRecord = {
      id: `v11-class-${randomUUID()}`,
      code,
      name: trimmedName,
      contentVersion: this.content.contentVersion,
      contentChecksum: this.contentChecksum,
      seed: randomBytes(32).toString('hex'),
      status: 'active',
      createdAt: NOW(),
    };
    this.classes.set(record.id, record);
    return record;
  }

  async listClasses(): Promise<V11ClassRecord[]> {
    return [...this.classes.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async updateClassStatus(
    id: string,
    status: V11ClassRecord['status'],
  ): Promise<V11ClassRecord | undefined> {
    const record = this.classes.get(id);
    if (!record) return undefined;
    record.status = status;
    return record;
  }

  async deleteClass(id: string, actorId?: string): Promise<boolean> {
    if (!this.classes.delete(id)) return false;
    const studentIds = [...this.students.values()]
      .filter((student) => student.classId === id)
      .map((student) => student.id);
    for (const studentId of studentIds) this.students.delete(studentId);
    for (const [playthroughId, playthrough] of this.playthroughs)
      if (playthrough.classId === id) this.playthroughs.delete(playthroughId);
    for (const [token, session] of this.sessions)
      if (studentIds.includes(session.studentIdentityId)) this.sessions.delete(token);
    this.auditRecords.push({
      action: 'class_deleted',
      targetType: 'class',
      targetId: id,
      ...(actorId ? { actorId } : {}),
      createdAt: NOW(),
    });
    return true;
  }

  async getClassById(id: string): Promise<V11ClassRecord | undefined> {
    return this.classes.get(id);
  }

  async joinStudent(classCode: string, studentNumber: string, displayName: string) {
    const classRecord = [...this.classes.values()].find(
      (item) => item.code === classCode.trim().toUpperCase() && item.status === 'active',
    );
    if (!classRecord) throw new Error('班级不存在或已关闭');
    const normalizedStudentNumber = normalize(studentNumber);
    const name = displayName.trim();
    if (!normalizedStudentNumber || !name) throw new Error('学号和姓名不能为空');
    let identity = [...this.students.values()].find(
      (item) =>
        item.classId === classRecord.id && item.normalizedStudentNumber === normalizedStudentNumber,
    );
    if (identity && identity.displayName !== name) throw new Error('该学号已经绑定了不同姓名');
    if (!identity) {
      identity = {
        id: randomUUID(),
        classId: classRecord.id,
        studentNumber: studentNumber.trim(),
        normalizedStudentNumber,
        displayName: name,
        createdAt: NOW(),
      };
      this.students.set(identity.id, identity);
    }
    let playthrough = [...this.playthroughs.values()].find(
      (item) => item.studentIdentityId === identity?.id && item.kind === 'first_run',
    );
    if (!playthrough) playthrough = this.newPlaythrough(classRecord, identity, 'first_run');
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, {
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

  async getStudentSession(token: string): Promise<V11StudentSession | undefined> {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt < Date.now()) return undefined;
    return session;
  }

  async startReplay(token: string, firstRunId: string) {
    const session = await this.getStudentSession(token);
    const firstRun = this.playthroughs.get(firstRunId);
    if (!session || !firstRun || firstRun.studentIdentityId !== session.studentIdentityId)
      throw new Error('首局经营记录不存在');
    if (firstRun.kind !== 'first_run' || firstRun.status !== 'completed' || !firstRun.report)
      throw new Error('完成首局后才能开始独立重玩');
    const classRecord = this.classes.get(firstRun.classId);
    if (!classRecord) throw new Error('班级不存在');
    const replay = this.newPlaythrough(classRecord, { id: firstRun.studentIdentityId }, 'replay');
    return {
      playthrough: this.publicPlaythrough(replay),
      offlineContext: this.offlineContext(classRecord, replay.id),
    };
  }

  async getPlaythroughForStudent(
    token: string,
    playthroughId: string,
  ): Promise<V11PlaythroughRecord | undefined> {
    const session = await this.getStudentSession(token);
    const playthrough = this.playthroughs.get(playthroughId);
    return session && playthrough && playthrough.studentIdentityId === session.studentIdentityId
      ? playthrough
      : undefined;
  }

  async submitAction(
    token: string,
    playthroughId: string,
    action: V11Action,
    idempotencyKey: string,
  ) {
    const playthrough = await this.getPlaythroughForStudent(token, playthroughId);
    if (!playthrough) throw new Error('游戏记录不存在');
    const actionHash = actionDigest(action);
    const oldLog = playthrough.logs.find((log) => log.idempotencyKey === idempotencyKey);
    if (oldLog) {
      if (oldLog.actionHash !== actionHash) throw new Error('幂等键已用于另一动作，拒绝复用');
      return { playthrough: this.publicPlaythrough(playthrough), log: oldLog };
    }
    const oldAction = playthrough.logs.find((log) => log.action.actionId === action.actionId);
    if (oldAction) throw new Error('动作 ID 已用于另一请求，拒绝重复执行');
    if (playthrough.status === 'completed') throw new Error('首局已经完成，不能覆盖');
    const classRecord = this.classes.get(playthrough.classId);
    if (!classRecord) throw new Error('班级不存在');
    const result = applyV11Action(
      playthrough.state,
      this.content,
      action,
      this.playthroughSeed(classRecord, playthrough.id),
    );
    const log: V11DecisionLog = {
      sequenceNo: playthrough.logs.length + 1,
      idempotencyKey,
      actionHash,
      action,
      trace: result.trace,
      stateHash: result.stateHash,
      createdAt: NOW(),
    };
    playthrough.logs.push(log);
    playthrough.state = result.state;
    playthrough.stateHash = result.stateHash;
    const annualReviewPending =
      this.content.rounds.at(-1)?.roundId === 'r12' &&
      !(playthrough.state.chapterReviews ?? []).includes('r12');
    if (
      playthrough.state.roundIndex >= this.content.rounds.length &&
      !playthrough.state.pendingRoundResult &&
      !annualReviewPending
    ) {
      playthrough.status = 'completed';
      playthrough.completedAt = NOW();
      playthrough.report = buildV11Report(playthrough.state, this.content);
    }
    return { playthrough: this.publicPlaythrough(playthrough), log };
  }

  async getReport(token: string, playthroughId: string) {
    const playthrough = await this.getPlaythroughForStudent(token, playthroughId);
    return playthrough?.report;
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
    classRecord: V11ClassRecord,
    identity: Pick<V11StudentIdentity, 'id'>,
    kind: 'first_run' | 'replay',
  ) {
    const id = randomUUID();
    const state = createV11State(this.content.contentVersion, id);
    const record: V11PlaythroughRecord = {
      id,
      classId: classRecord.id,
      studentIdentityId: identity.id,
      kind,
      status: 'active',
      state,
      stateHash: hashV11State(state),
      logs: [],
      startedAt: NOW(),
    };
    this.playthroughs.set(id, record);
    return record;
  }

  private playthroughSeed(classRecord: V11ClassRecord, playthroughId: string) {
    return digest(`${classRecord.seed}:${playthroughId}`);
  }

  private offlineContext(classRecord: V11ClassRecord, playthroughId: string) {
    return {
      contentVersion: this.content.contentVersion,
      contentChecksum: this.contentChecksum,
      playthroughSeed: this.playthroughSeed(classRecord, playthroughId),
    };
  }

  private publicPlaythrough(playthrough: V11PlaythroughRecord): V11PublicPlaythroughView {
    const resumeScreen = deriveV11ResumeScreen(
      playthrough.state,
      this.content.rounds.map((round) => round.roundId),
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
      contentVersion: this.content.contentVersion,
      contentChecksum: this.contentChecksum,
      resumeScreen,
      nextActionSequence: playthrough.logs.length + 1,
      ...(pendingChapterReview ? { chapterReviewPending: pendingChapterReview } : {}),
      state: JSON.parse(JSON.stringify(playthrough.state)) as V11GameState,
    };
  }
}
