export interface TeacherClass {
  id: string;
  code: string;
  name: string;
  contentVersion: string;
  contentChecksum: string;
  status: 'active' | 'closed' | 'archived';
  createdAt: string;
}

export interface TeacherAnalytics {
  classId: string;
  contentVersion: string;
  scope: { denominator: number; excludedReplays: boolean; generatedAt: string };
  progress: {
    totalStudents: number;
    started: number;
    inProgress: number;
    completed: number;
    completionRate: number;
    successfulEntryRate: number;
    exitRate: number;
    medianDurationSeconds: number;
  };
  engagement: {
    reportsOpened: number;
    reportOpenRate: number;
    replayStarted: number;
    replayRate: number;
    replayStrategyChanges: number;
  };
  roundProgress: Record<string, number>;
  choiceDistribution: Record<string, number>;
  evidenceOpenRate: Record<string, number>;
  endingDistribution: Record<string, number>;
  visualDistribution: Record<string, number>;
  eventDistribution: Record<string, number>;
  visualTestDistribution: Record<string, { passed: number; total: number }>;
  visualRevisionCount: number;
  visualSystemImpact: Record<
    string,
    {
      count: number;
      averageCulturalCredibility: number;
      averageVisualRecognition: number;
      averageVisualAdaptability: number;
    }
  >;
  predictionCount: number;
  topPaths: Array<{ path: string; count: number }>;
}

export interface TeacherLog {
  sequenceNo: number;
  action: { type: string; roundId: string; payload: Record<string, unknown> };
  trace: {
    before: Record<string, number>;
    after: Record<string, number>;
    events: Array<{
      eventId: string;
      title: string;
      effects: Array<{ label: string; amount: number }>;
    }>;
    immediateEffects: Array<{ label: string; amount: number }>;
    delayedEffects: Array<{ label: string; amount: number }>;
    scheduledDelayedEffects?: Array<{ label: string; amount: number }>;
    settledDelayedEffects?: Array<{ label: string; amount: number }>;
    visualTest?: { testId: string; visualId: string; passed: boolean; score: number };
    explanation: string;
    theoryIds: string[];
  };
  stateHash: string;
  createdAt: string;
}

export interface TeacherPlaythrough {
  id: string;
  kind: 'first_run' | 'replay';
  status: 'active' | 'completed';
  startedAt: string;
  completedAt?: string;
  roundIndex: number;
  completedRoundIds: string[];
  state: {
    roundIndex: number;
    metrics: Record<string, number>;
    completedRoundIds: string[];
    endingId?: string;
    visualTestResults: Array<{
      testId: string;
      visualId: string;
      passed: boolean;
      score: number;
      explanation: string;
    }>;
    selectedVisualId?: string;
    visualRevision?: string;
    decisions: Array<{ type: string; roundId: string; payload: Record<string, unknown> }>;
    traces: unknown[];
    triggeredEventIds: string[];
  };
  logs: TeacherLog[];
  report?: {
    endingId: string | null;
    maximumConsistency: string;
    maximumContradiction: string;
    causalExplanations: Array<{
      roundId: string;
      action: string;
      immediate: string[];
      delayed: string[];
      theoryIds: string[];
    }>;
    counterfactual: string;
    theoryMapping: Array<{ title: string; explanation: string }>;
  };
  reportViewedAt?: string;
  reportReadDepth?: number;
  reflection?: { text: string; submittedAt: string; revision: number };
}

export interface TeacherStudent {
  identity: { id: string; studentNumber: string; displayName: string };
  playthroughs: TeacherPlaythrough[];
}

export interface AnonymousCase {
  caseId: string;
  expiresAt: number;
  title: string;
  summary: string;
  endingId: string | null;
  finalMetrics: Record<string, number>;
  path: Array<{ roundId: string; choiceId: string }>;
  discussionPrompt: string;
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? '教师后台请求失败');
  return body;
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

export class FetchTeacherApi {
  constructor(private readonly baseUrl = defaultApiBase()) {}
  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    return parse<T>(
      await fetch(`${this.baseUrl}${url}`, {
        ...init,
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      }),
    );
  }
  async login(email: string, password: string): Promise<void> {
    await this.json('/api/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }
  async logout(): Promise<void> {
    await this.json('/api/teacher/logout', { method: 'POST' });
  }
  async classes(): Promise<TeacherClass[]> {
    return (await this.json<{ classes: TeacherClass[] }>('/api/teacher/classes')).classes;
  }
  async createClass(name: string): Promise<TeacherClass> {
    return this.json<TeacherClass>('/api/teacher/classes', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }
  async students(classId: string): Promise<{ class: TeacherClass; students: TeacherStudent[] }> {
    return this.json(`/api/teacher/classes/${classId}/students`);
  }
  async analytics(classId: string): Promise<TeacherAnalytics> {
    return this.json(`/api/teacher/classes/${classId}/analytics`);
  }
  async updateStatus(classId: string, status: TeacherClass['status']): Promise<TeacherClass> {
    return this.json(`/api/teacher/classes/${classId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }
  async deleteClass(classId: string): Promise<void> {
    await this.json(`/api/teacher/classes/${classId}`, { method: 'DELETE' });
  }
  async createCase(classId: string): Promise<AnonymousCase> {
    return this.json(`/api/teacher/classes/${classId}/cases`, { method: 'POST' });
  }
  async getCase(caseId: string): Promise<AnonymousCase> {
    return this.json(`/api/teacher/cases/${caseId}`);
  }
  async downloadCsv(
    classId: string,
    kind: 'progress' | 'decisions' | 'states' | 'reports',
  ): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/teacher/classes/${classId}/export/${kind}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('导出失败');
    return response.blob();
  }
}
