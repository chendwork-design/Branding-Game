import type { GameContent } from '@laojie/content-schema';
import type { Action, GameState, TraceEntry } from '@laojie/game-engine';
import type { GameReport } from '@laojie/report-engine';

export interface ClassRecord {
  id: string;
  code: string;
  name: string;
  contentVersion: string;
  contentChecksum: string;
  seed: string;
  status: 'active' | 'closed' | 'archived';
  createdAt: string;
}

export interface StudentIdentity {
  id: string;
  classId: string;
  studentNumber: string;
  normalizedStudentNumber: string;
  displayName: string;
  createdAt: string;
}

export interface DecisionLog {
  sequenceNo: number;
  idempotencyKey: string;
  action: Action;
  trace: TraceEntry;
  stateHash: string;
  createdAt: string;
}

export interface ReflectionRecord {
  text: string;
  submittedAt: string;
  revision: number;
}

export interface PlaythroughRecord {
  id: string;
  classId: string;
  studentIdentityId: string;
  kind: 'first_run' | 'replay';
  status: 'active' | 'completed';
  state: GameState;
  stateHash: string;
  logs: DecisionLog[];
  report?: GameReport;
  reportViewedAt?: string;
  reportReadDepth?: number;
  reflection?: ReflectionRecord;
  reflectionHistory?: ReflectionRecord[];
  startedAt: string;
  completedAt?: string;
}

export interface StudentSession {
  token: string;
  studentIdentityId: string;
  expiresAt: number;
}

export interface OfflineContext {
  contentVersion: string;
  contentChecksum: string;
  playthroughSeed: string;
}

export interface TeacherSession {
  token: string;
  teacherId: string;
  expiresAt: number;
}

export interface PublicPlaythroughView {
  id: string;
  kind: PlaythroughRecord['kind'];
  status: PlaythroughRecord['status'];
  roundIndex: number;
  completedRoundIds: string[];
  visibleMetrics: Record<string, number>;
  lastFeedback: string[];
  endingId?: string;
  reportAvailable: boolean;
}

export interface Store {
  readonly content: GameContent;
  authenticateTeacher(email: string, password: string): Promise<string | undefined>;
  getTeacherSession(token: string): Promise<TeacherSession | undefined>;
  createClass(name: string): Promise<ClassRecord>;
  listClasses(): Promise<ClassRecord[]>;
  getClassById(id: string): Promise<ClassRecord | undefined>;
  getClassByCode(code: string): Promise<ClassRecord | undefined>;
  updateClassStatus(id: string, status: ClassRecord['status']): Promise<ClassRecord | undefined>;
  deleteClass(id: string): Promise<boolean>;
  joinStudent(
    classCode: string,
    studentNumber: string,
    displayName: string,
  ): Promise<{
    token: string;
    identity: StudentIdentity;
    playthrough: PublicPlaythroughView;
    offlineContext: OfflineContext;
  }>;
  getStudentSession(token: string): Promise<StudentSession | undefined>;
  getStudentIdentity(id: string): Promise<StudentIdentity | undefined>;
  getPlaythroughForStudent(
    token: string,
    playthroughId: string,
  ): Promise<PlaythroughRecord | undefined>;
  submitAction(
    token: string,
    playthroughId: string,
    action: Action,
    idempotencyKey: string,
  ): Promise<{ playthrough: PublicPlaythroughView; log: DecisionLog }>;
  startReplay(
    token: string,
    firstRunId: string,
  ): Promise<{ playthrough: PublicPlaythroughView; offlineContext: OfflineContext }>;
  getReport(token: string, playthroughId: string): Promise<GameReport | undefined>;
  saveReflection(token: string, playthroughId: string, text: string): Promise<void>;
  getClassStudents(
    classId: string,
  ): Promise<Array<{ identity: StudentIdentity; playthroughs: PlaythroughRecord[] }>>;
}
