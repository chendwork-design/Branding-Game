import type { GameContentV11 } from '@laojie/content-schema';
import type { V11Action, V11GameState, V11ResumeScreen, V11RoundResult } from '@laojie/game-engine';
import type { GameReportV11 } from '@laojie/report-engine';

export interface V11ClassRecord {
  id: string;
  code: string;
  name: string;
  contentVersion: string;
  contentChecksum: string;
  seed: string;
  status: 'active' | 'closed' | 'archived';
  createdAt: string;
}

export interface V11StudentIdentity {
  id: string;
  classId: string;
  studentNumber: string;
  normalizedStudentNumber: string;
  displayName: string;
  createdAt: string;
}

export interface V11DecisionLog {
  sequenceNo: number;
  idempotencyKey: string;
  actionHash: string;
  action: V11Action;
  trace: V11GameState['traces'][number];
  stateHash: string;
  createdAt: string;
}

export interface V11PlaythroughRecord {
  id: string;
  classId: string;
  studentIdentityId: string;
  kind: 'first_run' | 'replay';
  status: 'active' | 'completed';
  state: V11GameState;
  stateHash: string;
  logs: V11DecisionLog[];
  report?: GameReportV11 | undefined;
  startedAt: string;
  completedAt?: string | undefined;
}

export interface V11StudentSession {
  token: string;
  studentIdentityId: string;
  expiresAt: number;
}

export interface V11TeacherSession {
  token: string;
  expiresAt: number;
  teacherId?: string;
}

export interface V11PublicPlaythroughView {
  id: string;
  kind: V11PlaythroughRecord['kind'];
  status: V11PlaythroughRecord['status'];
  roundIndex: number;
  completedRoundIds: string[];
  visibleMetrics: Record<string, number>;
  pendingRoundResult?: V11RoundResult | undefined;
  lastFeedback: string[];
  reportAvailable: boolean;
  contentVersion: string;
  contentChecksum: string;
  resumeScreen: V11ResumeScreen;
  nextActionSequence: number;
  chapterReviewPending?: string | undefined;
  state: V11GameState;
}

export interface V11Store {
  readonly content: GameContentV11;
  checkReadiness(): Promise<void>;
  authenticateTeacher(email: string, password: string): Promise<string | undefined>;
  getTeacherSession(token: string): Promise<V11TeacherSession | undefined>;
  createClass(name: string): Promise<V11ClassRecord>;
  listClasses(): Promise<V11ClassRecord[]>;
  updateClassStatus(
    id: string,
    status: V11ClassRecord['status'],
  ): Promise<V11ClassRecord | undefined>;
  deleteClass(id: string, actorId?: string): Promise<boolean>;
  getClassById(id: string): Promise<V11ClassRecord | undefined>;
  joinStudent(
    classCode: string,
    studentNumber: string,
    displayName: string,
  ): Promise<{
    token: string;
    identity: V11StudentIdentity;
    playthrough: V11PublicPlaythroughView;
    offlineContext: { contentVersion: string; contentChecksum: string; playthroughSeed: string };
  }>;
  startReplay(
    token: string,
    firstRunId: string,
  ): Promise<{
    playthrough: V11PublicPlaythroughView;
    offlineContext: { contentVersion: string; contentChecksum: string; playthroughSeed: string };
  }>;
  getStudentSession(token: string): Promise<V11StudentSession | undefined>;
  getPlaythroughForStudent(
    token: string,
    playthroughId: string,
  ): Promise<V11PlaythroughRecord | undefined>;
  submitAction(
    token: string,
    playthroughId: string,
    action: V11Action,
    idempotencyKey: string,
  ): Promise<{ playthrough: V11PublicPlaythroughView; log: V11DecisionLog }>;
  getReport(token: string, playthroughId: string): Promise<GameReportV11 | undefined>;
  getClassStudents(
    classId: string,
  ): Promise<Array<{ identity: V11StudentIdentity; playthroughs: V11PlaythroughRecord[] }>>;
}
