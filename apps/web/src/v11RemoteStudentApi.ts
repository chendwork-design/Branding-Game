import type { GameContentV11 } from '@laojie/content-schema';
import type { V11Action, V11GameState, V11ResumeScreen } from '@laojie/game-engine';
import type { GameReportV11 } from '@laojie/report-engine';

export interface V11RemotePlaythrough {
  id: string;
  kind: 'first_run' | 'replay';
  status: 'active' | 'completed';
  roundIndex: number;
  completedRoundIds: string[];
  visibleMetrics: Record<string, number>;
  pendingRoundResult?: V11GameState['pendingRoundResult'];
  lastFeedback: string[];
  reportAvailable: boolean;
  contentVersion: string;
  contentChecksum: string;
  resumeScreen: V11ResumeScreen;
  nextActionSequence: number;
  chapterReviewPending?: string;
  state: V11GameState;
}

export interface V11RemoteJoinResponse {
  token: string;
  contentVersion: string;
  offlineContext: { contentVersion: string; contentChecksum: string; playthroughSeed: string };
  playthrough: V11RemotePlaythrough;
}

export interface V11RemoteReplayResponse {
  offlineContext: { contentVersion: string; contentChecksum: string; playthroughSeed: string };
  playthrough: V11RemotePlaythrough;
}

export interface V11RemoteStudentApi {
  content?: (version: string) => Promise<GameContentV11 & { contentChecksum: string }>;
  join(classCode: string, studentNumber: string, name: string): Promise<V11RemoteJoinResponse>;
  replay(token: string, firstRunId: string): Promise<V11RemoteReplayResponse>;
  me(token: string, playthroughId: string): Promise<{ playthrough: V11RemotePlaythrough }>;
  submit(
    token: string,
    playthroughId: string,
    action: V11Action,
    idempotencyKey: string,
  ): Promise<{ playthrough: V11RemotePlaythrough }>;
  report(token: string, playthroughId: string): Promise<GameReportV11>;
}

export interface V11RemoteContentApi {
  content(version: string): Promise<GameContentV11 & { contentChecksum: string }>;
}

async function parse<T>(response: Response): Promise<T> {
  let body: T & { message?: string; playerMessage?: string };
  try {
    body = (await response.json()) as T & { message?: string; playerMessage?: string };
  } catch {
    throw new Error('经营服务返回了无法读取的结果，请确认网页和 V11 服务使用同一版本。');
  }
  if (!response.ok)
    throw new Error(body.playerMessage ?? body.message ?? '网络暂时不可用，请稍后重试');
  return body;
}

function defaultV11StudentApiBase(): string {
  if (import.meta.env.VITE_V11_API_BASE) return import.meta.env.VITE_V11_API_BASE;
  const runtimeBase = (
    globalThis as typeof globalThis & { __LAOJIE_RUNTIME_CONFIG__?: { v11ApiBase?: string } }
  ).__LAOJIE_RUNTIME_CONFIG__?.v11ApiBase;
  if (runtimeBase) return runtimeBase;
  if (typeof window !== 'undefined') {
    const metaPort = document
      .querySelector('meta[name="laojie-v11-api-port"]')
      ?.getAttribute('content');
    if (metaPort && /^\d+$/.test(metaPort))
      return `${window.location.protocol}//${window.location.hostname}:${metaPort}`;
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://127.0.0.1:3001';
}

export class FetchV11RemoteStudentApi implements V11RemoteStudentApi {
  constructor(private readonly baseUrl = defaultV11StudentApiBase()) {}

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    try {
      return await parse<T>(
        await fetch(`${this.baseUrl}${url}`, {
          ...init,
          headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
        }),
      );
    } catch (cause) {
      if (cause instanceof Error && /failed to fetch|network|fetch/i.test(cause.message)) {
        throw new Error('无法连接经营服务，请确认 V11 服务已启动、API 端口可访问后再重试。');
      }
      throw cause;
    }
  }

  async content(version: string): Promise<GameContentV11 & { contentChecksum: string }> {
    return this.json(`/api/v11/content?version=${encodeURIComponent(version)}`);
  }

  async join(
    classCode: string,
    studentNumber: string,
    name: string,
  ): Promise<V11RemoteJoinResponse> {
    return this.json('/api/v11/student/join', {
      method: 'POST',
      body: JSON.stringify({ classCode, studentNumber, name }),
    });
  }

  async replay(token: string, firstRunId: string): Promise<V11RemoteReplayResponse> {
    return this.json('/api/v11/student/replay', {
      method: 'POST',
      headers: { 'x-student-token': token },
      body: JSON.stringify({ firstRunId }),
    });
  }

  async me(token: string, playthroughId: string): Promise<{ playthrough: V11RemotePlaythrough }> {
    return this.json(`/api/v11/student/me?playthroughId=${encodeURIComponent(playthroughId)}`, {
      headers: { 'x-student-token': token },
    });
  }

  async submit(
    token: string,
    playthroughId: string,
    action: V11Action,
    idempotencyKey: string,
  ): Promise<{ playthrough: V11RemotePlaythrough }> {
    return this.json('/api/v11/student/actions', {
      method: 'POST',
      headers: { 'x-student-token': token },
      body: JSON.stringify({ playthroughId, action, idempotencyKey }),
    });
  }

  async report(token: string, playthroughId: string): Promise<GameReportV11> {
    return this.json(`/api/v11/student/reports/${encodeURIComponent(playthroughId)}`, {
      headers: { 'x-student-token': token },
    });
  }
}
