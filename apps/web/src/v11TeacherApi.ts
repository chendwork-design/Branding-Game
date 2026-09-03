export interface V11TeacherClass {
  id: string;
  code: string;
  name: string;
  contentVersion: string;
  contentChecksum: string;
  status: 'active' | 'closed' | 'archived';
  createdAt: string;
}

export interface V11TeacherAnalytics {
  contentVersion: string;
  progress: {
    totalStudents: number;
    started: number;
    inProgress: number;
    completed: number;
    completionRate: number;
    medianDurationSeconds: number;
  };
  roundProgress: Record<string, number>;
  choiceDistribution: Record<string, number>;
  skipDistribution: Record<string, number>;
  freeActionAllocation: Record<string, number>;
  questionActionRate: Record<string, number>;
  evidenceOpenRate: Record<string, number>;
  eventDistribution: Record<string, number>;
  visualDistribution: Record<string, number>;
  visualTestDistribution: Record<string, { passed: number; total: number }>;
  riskDistribution: Record<string, number>;
  endingDistribution: Record<string, number>;
  routeDistribution: Record<string, number>;
  brandIdentityDistribution: Record<'wordmark' | 'symbol' | 'ip', number>;
  predictionSummary: {
    submitted: number;
    matchedTopChange: number;
    matchRate: number;
    byMetric: Record<string, number>;
  };
  topPaths: Array<{ path: string; count: number }>;
  anonymousAwards: Array<{ awardId: string; title: string; description: string; count: number }>;
}

export interface V11TeacherLog {
  sequenceNo: number;
  action: { type: string; roundId?: string; payload: Record<string, unknown> };
  trace: {
    explanation: string;
    triggeredEvents: Array<{ title: string; text: string }>;
    immediateEffects: Array<{ label: string; amount: number }>;
    scheduledEffects: Array<{ label: string; amount: number }>;
    riskOutcome?: { status: string; explanation: string };
    before: {
      cashYuan: number;
      freeActionPoints: number;
      strategicActionPoints: number;
      elapsedDays: number;
    };
    after: {
      cashYuan: number;
      freeActionPoints: number;
      strategicActionPoints: number;
      elapsedDays: number;
    };
  };
  createdAt: string;
}

export interface V11TeacherStudent {
  identity: { id: string; studentNumber: string; displayName: string };
  playthroughs: Array<{
    id: string;
    kind: 'first_run' | 'replay';
    status: 'active' | 'completed';
    roundIndex: number;
    state: {
      cashYuan: number;
      elapsedDays: number;
      ending?: string;
      routeProfile?: { title: string };
      brandIdentity?: { brandName: string; identityArchitecture: 'wordmark' | 'symbol' | 'ip' };
      visualState?: { selectedVisualId?: string; testedTouchpoints: string[] };
      decisions: unknown[];
    };
    logs: V11TeacherLog[];
    report?: { scoreBreakdown: { overall: number }; routeProfile?: { title: string } | null };
  }>;
}

export interface V11AnonymousCase {
  caseId: string;
  expiresAt: number;
  title: string;
  summary: string;
  endingTitle: string | null;
  routeTitle: string | null;
  path: Array<{ roundTitle: string; choiceLabel: string }>;
  discussionPrompt: string;
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'v1.1 教师后台请求失败');
  return body;
}

function defaultV11ApiBase(): string {
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

export class FetchV11TeacherApi {
  constructor(private readonly baseUrl = defaultV11ApiBase()) {}

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
    await this.json('/api/v11/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async classes(): Promise<{ classes: V11TeacherClass[] }> {
    return this.json('/api/v11/teacher/classes');
  }

  async createClass(name: string): Promise<V11TeacherClass> {
    return this.json('/api/v11/teacher/classes', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateClassStatus(
    classId: string,
    status: V11TeacherClass['status'],
  ): Promise<V11TeacherClass> {
    return this.json(`/api/v11/teacher/classes/${classId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async deleteClass(classId: string): Promise<void> {
    await this.json(`/api/v11/teacher/classes/${classId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation: 'DELETE_CLASS' }),
    });
  }

  async students(
    classId: string,
  ): Promise<{ class: V11TeacherClass; students: V11TeacherStudent[] }> {
    return this.json(`/api/v11/teacher/classes/${classId}/students`);
  }

  async analytics(classId: string): Promise<V11TeacherAnalytics> {
    return this.json(`/api/v11/teacher/classes/${classId}/analytics`);
  }

  async createCase(classId: string): Promise<V11AnonymousCase> {
    return this.json(`/api/v11/teacher/classes/${classId}/cases`, { method: 'POST' });
  }

  async getCase(caseId: string): Promise<V11AnonymousCase> {
    return this.json(`/api/v11/cases/${caseId}`);
  }

  async downloadCsv(
    classId: string,
    kind: 'progress' | 'decisions' | 'states' | 'reports',
  ): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/api/v11/teacher/classes/${classId}/export/${kind}`,
      { credentials: 'include' },
    );
    if (!response.ok) throw new Error('导出失败');
    return response.blob();
  }
}
