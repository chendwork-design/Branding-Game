import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { ActionInput } from '@laojie/shared-contracts';
import { visibleMetrics, type Action } from '@laojie/game-engine';
import { MemoryStore } from './store/memory.js';
import type { PlaythroughRecord, PublicPlaythroughView, Store } from './store/types.js';
import { buildAnonymousCase, buildClassAnalytics } from './analytics.js';
import { exportCsv, exportDictionary } from './csv.js';
import { randomUUID } from 'node:crypto';

function studentToken(request: FastifyRequest): string | undefined {
  const token = request.headers['x-student-token'];
  return typeof token === 'string' ? token : undefined;
}

function teacherToken(request: FastifyRequest): string | undefined {
  return request.cookies.teacher_session;
}

function actionFromInput(value: unknown): Action {
  const parsed = ActionInput.parse(value);
  const payload: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(parsed.payload)) {
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean')
      throw new Error(`动作参数 ${key} 类型不受支持`);
    payload[key] = item;
  }
  return { ...parsed, payload } as Action;
}

function publicClass(record: Awaited<ReturnType<Store['createClass']>>) {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    contentVersion: record.contentVersion,
    contentChecksum: record.contentChecksum,
    status: record.status,
    createdAt: record.createdAt,
  };
}

function publicPlaythrough(record: PlaythroughRecord): PublicPlaythroughView {
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    roundIndex: record.state.roundIndex,
    completedRoundIds: [...record.state.completedRoundIds],
    visibleMetrics: visibleMetrics(record.state) as Record<string, number>,
    lastFeedback: [...record.state.lastFeedback],
    ...(record.state.endingId ? { endingId: record.state.endingId } : {}),
    reportAvailable: Boolean(record.report),
  };
}

export function buildApp(store: Store = new MemoryStore()): FastifyInstance {
  const app = Fastify({ logger: false });
  const anonymousCases = new Map<
    string,
    { classId: string; expiresAt: number; data: ReturnType<typeof buildAnonymousCase> }
  >();
  const configuredOrigins =
    process.env.CORS_ORIGINS ?? 'http://127.0.0.1:4173,http://localhost:4173';
  const allowAllOrigins = configuredOrigins.trim() === '*';
  const allowedOrigins = new Set(
    configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  app.register(cookie);
  app.register(cors, {
    origin: (origin, callback) => {
      callback(null, !origin || allowAllOrigins || allowedOrigins.has(origin));
    },
    credentials: true,
  });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !allowAllOrigins && !allowedOrigins.has(origin))
        return reply.code(403).send({ code: 'ORIGIN_REJECTED', message: '请求来源不受信任' });
    }
  });

  app.get('/health', async () => ({ status: 'ok', service: 'laojie-api' }));

  app.post<{ Body: { email?: string; password?: string } }>(
    '/api/teacher/login',
    async (request, reply) => {
      const key = request.ip;
      const attempt = loginAttempts.get(key);
      if (attempt && attempt.resetAt > Date.now() && attempt.count >= 5)
        return reply
          .code(429)
          .send({ code: 'LOGIN_RATE_LIMITED', message: '登录尝试过于频繁，请稍后再试' });
      const token = await store.authenticateTeacher(
        request.body.email ?? '',
        request.body.password ?? '',
      );
      if (!token) {
        const next =
          attempt && attempt.resetAt > Date.now()
            ? attempt
            : { count: 0, resetAt: Date.now() + 60_000 };
        next.count += 1;
        loginAttempts.set(key, next);
        return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: '教师账号或密码错误' });
      }
      loginAttempts.delete(key);
      reply.setCookie('teacher_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60,
      });
      return { ok: true };
    },
  );

  app.post('/api/teacher/logout', async (_request, reply) => {
    reply.clearCookie('teacher_session', { path: '/' });
    return { ok: true };
  });

  app.post<{ Body: { name?: string } }>('/api/teacher/classes', async (request, reply) => {
    if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
    const name = request.body.name?.trim();
    if (!name || name.length > 80)
      return reply
        .code(400)
        .send({ code: 'INVALID_CLASS_NAME', message: '班级名称不能为空且不能超过80字' });
    return publicClass(await store.createClass(name));
  });

  app.get('/api/teacher/classes', async (request, reply) => {
    if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
    return { classes: (await store.listClasses()).map(publicClass) };
  });

  app.get<{ Params: { classId: string } }>(
    '/api/teacher/classes/:classId/analytics',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      return buildClassAnalytics(classRecord, await store.getClassStudents(classRecord.id));
    },
  );

  app.get<{ Params: { classId: string; kind: string } }>(
    '/api/teacher/classes/:classId/export/:kind',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      const kinds = ['progress', 'decisions', 'states', 'reports'] as const;
      if (!kinds.includes(request.params.kind as (typeof kinds)[number]))
        return reply.code(400).send({ code: 'INVALID_EXPORT_KIND', message: '不支持的导出类型' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      const csv = exportCsv(
        request.params.kind as (typeof kinds)[number],
        classRecord,
        await store.getClassStudents(classRecord.id),
      );
      reply.header('content-type', 'text/csv; charset=utf-8');
      reply.header(
        'content-disposition',
        `attachment; filename="laojie-${request.params.kind}-${classRecord.code}.csv"`,
      );
      return reply.send(csv);
    },
  );

  app.get<{ Params: { classId: string } }>(
    '/api/teacher/classes/:classId/export-dictionary',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      return {
        classId: classRecord.id,
        contentVersion: classRecord.contentVersion,
        dictionary: exportDictionary,
      };
    },
  );

  app.post<{ Params: { classId: string } }>(
    '/api/teacher/classes/:classId/cases',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      const data = buildAnonymousCase(await store.getClassStudents(classRecord.id));
      if (!data)
        return reply
          .code(409)
          .send({ code: 'NO_COMPLETED_CASE', message: '还没有可供讨论的完成案例' });
      const caseId = randomUUID();
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
      anonymousCases.set(caseId, { classId: classRecord.id, expiresAt, data });
      return { caseId, expiresAt, ...data };
    },
  );

  app.get<{ Params: { caseId: string } }>('/api/teacher/cases/:caseId', async (request, reply) => {
    const entry = anonymousCases.get(request.params.caseId);
    if (!entry || entry.expiresAt < Date.now()) {
      anonymousCases.delete(request.params.caseId);
      return reply.code(404).send({ code: 'CASE_NOT_FOUND', message: '匿名案例不存在或已过期' });
    }
    return { caseId: request.params.caseId, expiresAt: entry.expiresAt, ...entry.data };
  });

  app.post<{ Params: { classId: string }; Body: { status?: 'active' | 'closed' | 'archived' } }>(
    '/api/teacher/classes/:classId/status',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      const status = request.body.status;
      if (!status || !['active', 'closed', 'archived'].includes(status))
        return reply.code(400).send({ code: 'INVALID_STATUS', message: '班级状态无效' });
      const record = await store.updateClassStatus(request.params.classId, status);
      if (!record) return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      return publicClass(record);
    },
  );

  app.delete<{ Params: { classId: string } }>(
    '/api/teacher/classes/:classId',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      if (!(await store.deleteClass(request.params.classId)))
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      return { ok: true };
    },
  );

  app.get<{ Params: { classId: string } }>(
    '/api/teacher/classes/:classId/students',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      const students = await store.getClassStudents(classRecord.id);
      return {
        class: publicClass(classRecord),
        students: students.map(({ identity, playthroughs }) => ({
          identity: {
            id: identity.id,
            studentNumber: identity.studentNumber,
            displayName: identity.displayName,
          },
          playthroughs: playthroughs.map((playthrough) => ({
            id: playthrough.id,
            kind: playthrough.kind,
            status: playthrough.status,
            startedAt: playthrough.startedAt,
            completedAt: playthrough.completedAt,
            roundIndex: playthrough.state.roundIndex,
            completedRoundIds: playthrough.state.completedRoundIds,
            state: playthrough.state,
            logs: playthrough.logs,
            report: playthrough.report,
            reportViewedAt: playthrough.reportViewedAt,
            reportReadDepth: playthrough.reportReadDepth,
            reflection: playthrough.reflection,
            reflectionHistory: playthrough.reflectionHistory,
          })),
        })),
      };
    },
  );

  app.post<{ Body: { classCode?: string; studentNumber?: string; name?: string } }>(
    '/api/student/join',
    async (request, reply) => {
      try {
        if (
          (request.body.classCode?.length ?? 0) > 32 ||
          (request.body.studentNumber?.length ?? 0) > 64 ||
          (request.body.name?.length ?? 0) > 80
        )
          throw new Error('输入内容超出长度限制');
        const result = await store.joinStudent(
          request.body.classCode ?? '',
          request.body.studentNumber ?? '',
          request.body.name ?? '',
        );
        return {
          token: result.token,
          identity: {
            id: result.identity.id,
            studentNumber: result.identity.studentNumber,
            displayName: result.identity.displayName,
          },
          contentVersion: store.content.contentVersion,
          offlineContext: result.offlineContext,
          playthrough: result.playthrough,
        };
      } catch (error) {
        return reply.code(400).send({
          code: 'JOIN_FAILED',
          message: error instanceof Error ? error.message : '加入失败',
        });
      }
    },
  );

  app.get<{ Querystring: { playthroughId?: string } }>(
    '/api/student/me',
    async (request, reply) => {
      const token = studentToken(request);
      if (!token || !request.query.playthroughId)
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '学生会话无效' });
      const playthrough = await store.getPlaythroughForStudent(token, request.query.playthroughId);
      if (!playthrough)
        return reply.code(404).send({ code: 'PLAYTHROUGH_NOT_FOUND', message: '游戏记录不存在' });
      return {
        id: playthrough.id,
        kind: playthrough.kind,
        status: playthrough.status,
        roundIndex: playthrough.state.roundIndex,
        completedRoundIds: playthrough.state.completedRoundIds,
        reportAvailable: Boolean(playthrough.report),
        visibleMetrics: Object.fromEntries(
          Object.entries(playthrough.state.metrics).filter(([key]) =>
            ['cash', 'awareness', 'conversion', 'trust', 'loyalty', 'actionPoints'].includes(key),
          ),
        ),
        lastFeedback: playthrough.state.lastFeedback,
        endingId: playthrough.state.endingId,
      };
    },
  );

  app.post<{ Body: { playthroughId?: string; action?: unknown; idempotencyKey?: string } }>(
    '/api/student/actions',
    async (request, reply) => {
      const token = studentToken(request);
      if (!token) return reply.code(401).send({ code: 'UNAUTHORIZED', message: '学生会话无效' });
      try {
        if (
          !request.body.playthroughId ||
          !request.body.action ||
          !request.body.idempotencyKey ||
          request.body.idempotencyKey.length > 128
        )
          throw new Error('缺少动作字段或幂等键过长');
        const action = actionFromInput(request.body.action);
        return await store.submitAction(
          token,
          request.body.playthroughId,
          action,
          request.body.idempotencyKey,
        );
      } catch (error) {
        return reply.code(400).send({
          code: 'ACTION_REJECTED',
          message: error instanceof Error ? error.message : '动作被拒绝',
        });
      }
    },
  );

  app.post<{
    Body: {
      playthroughId?: string;
      actions?: Array<{ idempotencyKey?: string; action?: unknown }>;
    };
  }>('/api/student/sync', async (request, reply) => {
    const token = studentToken(request);
    if (!token) return reply.code(401).send({ code: 'UNAUTHORIZED', message: '学生会话无效' });
    const playthroughId = request.body.playthroughId;
    const items = request.body.actions;
    if (!playthroughId || !Array.isArray(items) || items.length > 100) {
      return reply
        .code(400)
        .send({ code: 'SYNC_INVALID', message: '同步批次不能为空且不能超过100个动作' });
    }
    const current = await store.getPlaythroughForStudent(token, playthroughId);
    if (!current)
      return reply.code(404).send({ code: 'PLAYTHROUGH_NOT_FOUND', message: '游戏记录不存在' });

    const knownKeys = new Set(current.logs.map((log) => log.idempotencyKey));
    let authoritative = publicPlaythrough(current);
    const results: Array<{
      idempotencyKey: string;
      status: 'accepted' | 'duplicate' | 'rejected';
      sequenceNo?: number;
      message?: string;
    }> = [];
    for (const item of items) {
      const idempotencyKey = item.idempotencyKey;
      if (!idempotencyKey || idempotencyKey.length > 128 || !item.action) {
        results.push({
          idempotencyKey: idempotencyKey ?? '',
          status: 'rejected',
          message: '同步项缺少幂等键或动作',
        });
        continue;
      }
      if (knownKeys.has(idempotencyKey)) {
        const existing = current.logs.find((log) => log.idempotencyKey === idempotencyKey);
        results.push({
          idempotencyKey,
          status: 'duplicate',
          ...(existing ? { sequenceNo: existing.sequenceNo } : {}),
        });
        continue;
      }
      try {
        const action = actionFromInput(item.action);
        const saved = await store.submitAction(token, playthroughId, action, idempotencyKey);
        knownKeys.add(idempotencyKey);
        authoritative = saved.playthrough;
        results.push({
          idempotencyKey,
          status: 'accepted',
          sequenceNo: saved.log.sequenceNo,
        });
      } catch (error) {
        results.push({
          idempotencyKey,
          status: 'rejected',
          message: error instanceof Error ? error.message : '动作被拒绝',
        });
      }
    }
    return { playthrough: authoritative, results };
  });

  app.post<{ Body: { firstRunId?: string } }>('/api/student/replay', async (request, reply) => {
    const token = studentToken(request);
    if (!token || !request.body.firstRunId)
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '学生会话无效' });
    try {
      return await store.startReplay(token, request.body.firstRunId);
    } catch (error) {
      return reply.code(400).send({
        code: 'REPLAY_FAILED',
        message: error instanceof Error ? error.message : '不能开始重玩',
      });
    }
  });

  app.get<{ Params: { playthroughId: string } }>(
    '/api/student/reports/:playthroughId',
    async (request, reply) => {
      const token = studentToken(request);
      if (!token) return reply.code(401).send({ code: 'UNAUTHORIZED', message: '学生会话无效' });
      const report = await store.getReport(token, request.params.playthroughId);
      if (!report)
        return reply.code(404).send({ code: 'REPORT_NOT_READY', message: '报告尚未生成' });
      return report;
    },
  );

  app.post<{ Body: { playthroughId?: string; text?: string } }>(
    '/api/student/reflections',
    async (request, reply) => {
      const token = studentToken(request);
      if (!token || !request.body.playthroughId)
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '学生会话无效' });
      try {
        if ((request.body.text?.length ?? 0) > 100) throw new Error('反思不能超过100字');
        await store.saveReflection(token, request.body.playthroughId, request.body.text ?? '');
        return { ok: true };
      } catch (error) {
        return reply.code(400).send({
          code: 'REFLECTION_FAILED',
          message: error instanceof Error ? error.message : '反思提交失败',
        });
      }
    },
  );

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: '服务暂时不可用' });
  });

  return app;
}
