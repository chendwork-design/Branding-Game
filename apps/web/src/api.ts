import type { Action, GameState } from '@laojie/game-engine';
import type { GameReport } from '@laojie/report-engine';

export interface OfflineContext {
  contentVersion: string;
  contentChecksum: string;
  playthroughSeed: string;
}

export interface PublicPlaythroughView {
  id: string;
  kind: 'first_run' | 'replay';
  status: 'active' | 'completed';
  roundIndex: number;
  completedRoundIds: string[];
  visibleMetrics: Record<string, number>;
  lastFeedback: string[];
  endingId?: string;
  reportAvailable: boolean;
}

export interface JoinResponse {
  token: string;
  identity: { id: string; studentNumber: string; displayName: string };
  contentVersion: string;
  offlineContext: OfflineContext;
  playthrough: PublicPlaythroughView;
}

export interface ActionResponse {
  playthrough: PublicPlaythroughView;
  log: { sequenceNo: number; stateHash: string };
}
export interface ReplayResponse {
  playthrough: PublicPlaythroughView;
  offlineContext: OfflineContext;
}

export interface StudentApi {
  join(classCode: string, studentNumber: string, name: string): Promise<JoinResponse>;
  submit(
    token: string,
    playthroughId: string,
    action: Action,
    idempotencyKey: string,
  ): Promise<ActionResponse>;
  report(token: string, playthroughId: string): Promise<GameReport>;
  reflection(token: string, playthroughId: string, text: string): Promise<void>;
  replay(token: string, firstRunId: string): Promise<ReplayResponse>;
}

function defaultApiBase(): string {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  const runtimeBase = (
    globalThis as typeof globalThis & { __LAOJIE_RUNTIME_CONFIG__?: { apiBase?: string } }
  ).__LAOJIE_RUNTIME_CONFIG__?.apiBase;
  if (runtimeBase) return runtimeBase;
  if (typeof window !== 'undefined')
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  return 'http://127.0.0.1:3000';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? '网络请求失败');
  return body;
}

export class FetchStudentApi implements StudentApi {
  constructor(private readonly baseUrl = defaultApiBase()) {}
  async join(classCode: string, studentNumber: string, name: string): Promise<JoinResponse> {
    return parseResponse(
      await fetch(`${this.baseUrl}/api/student/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classCode, studentNumber, name }),
      }),
    );
  }
  async submit(
    token: string,
    playthroughId: string,
    action: Action,
    idempotencyKey: string,
  ): Promise<ActionResponse> {
    return parseResponse(
      await fetch(`${this.baseUrl}/api/student/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-student-token': token },
        body: JSON.stringify({ playthroughId, action, idempotencyKey }),
      }),
    );
  }
  async report(token: string, playthroughId: string): Promise<GameReport> {
    return parseResponse(
      await fetch(`${this.baseUrl}/api/student/reports/${playthroughId}`, {
        headers: { 'x-student-token': token },
      }),
    );
  }
  async reflection(token: string, playthroughId: string, text: string): Promise<void> {
    await parseResponse(
      await fetch(`${this.baseUrl}/api/student/reflections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-student-token': token },
        body: JSON.stringify({ playthroughId, text }),
      }),
    );
  }
  async replay(token: string, firstRunId: string): Promise<ReplayResponse> {
    return parseResponse(
      await fetch(`${this.baseUrl}/api/student/replay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-student-token': token },
        body: JSON.stringify({ firstRunId }),
      }),
    );
  }
}

export interface LocalSession {
  token: string;
  playthroughId: string;
  offlineContext: OfflineContext;
  state: GameState;
}
