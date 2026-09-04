import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { createHash, randomUUID } from 'node:crypto';
import { V11ActionInput } from '@laojie/shared-contracts';
import { deriveV11ResumeScreen } from '@laojie/game-engine';
import { V11MemoryStore } from './store/v11-memory.js';
import type { V11Action } from '@laojie/game-engine';
import type {
  V11ClassRecord,
  V11PlaythroughRecord,
  V11PublicPlaythroughView,
  V11Store,
} from './store/v11-types.js';
import { buildV11AnonymousCase, buildV11ClassAnalytics } from './v11-analytics.js';
import { exportV11Csv, v11ExportDictionary } from './v11-csv.js';

function studentToken(request: FastifyRequest): string | undefined {
  const token = request.headers['x-student-token'];
  return typeof token === 'string' ? token : undefined;
}

function teacherToken(request: FastifyRequest): string | undefined {
  return request.cookies.v11_teacher_session;
}

type V11PlayerErrorCode =
  | 'CLASS_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'PLAYTHROUGH_NOT_FOUND'
  | 'CONTENT_VERSION_MISMATCH'
  | 'REPORT_NOT_READY'
  | 'REPLAY_NOT_READY'
  | 'JOIN_INVALID'
  | 'IDEMPOTENCY_CONFLICT'
  | 'ACTION_REJECTED'
  | 'INTERNAL_ERROR';

const playerErrorCopy: Record<
  V11PlayerErrorCode,
  { playerMessage: string; retryable: boolean; recoveryAction: string }
> = {
  CLASS_NOT_FOUND: {
    playerMessage: '没找到这个可加入的班级。请核对班级码，或问问任课教师是否已经开放。',
    retryable: true,
    recoveryAction: '核对班级码后再试',
  },
  UNAUTHORIZED: {
    playerMessage: '这次进入信息已经失效，请重新输入班级信息。',
    retryable: false,
    recoveryAction: '重新进入班级',
  },
  PLAYTHROUGH_NOT_FOUND: {
    playerMessage: '没找到你上次的经营进度。请重新进入班级；如果仍有问题，请联系任课教师。',
    retryable: true,
    recoveryAction: '重新进入班级',
  },
  CONTENT_VERSION_MISMATCH: {
    playerMessage: '页面内容刚刚更新，请刷新后重新进入。你的已保存进度不会因此改变。',
    retryable: true,
    recoveryAction: '刷新页面',
  },
  REPORT_NOT_READY: {
    playerMessage: '完成全部经营后，复盘报告才会生成。',
    retryable: false,
    recoveryAction: '继续完成经营',
  },
  REPLAY_NOT_READY: {
    playerMessage: '先完成首局经营，才能开始一次不会影响首局记录的独立重玩。',
    retryable: false,
    recoveryAction: '继续完成首局',
  },
  JOIN_INVALID: {
    playerMessage: '请检查班级码、学号和姓名后再试。',
    retryable: true,
    recoveryAction: '检查输入',
  },
  IDEMPOTENCY_CONFLICT: {
    playerMessage: '这次请求编号已经对应另一项操作。请刷新进度后再继续，系统不会重复扣款。',
    retryable: false,
    recoveryAction: '刷新进度',
  },
  ACTION_REJECTED: {
    playerMessage: '这一步现在无法执行。请看看行动力、现金或本轮前置条件，再选择下一步。',
    retryable: true,
    recoveryAction: '回到经营现场',
  },
  INTERNAL_ERROR: {
    playerMessage: '店铺暂时没能载入。请点“再试一次”；如果仍失败，再联系任课教师。',
    retryable: true,
    recoveryAction: '再试一次',
  },
};

// The classroom preview is served from a separate static-server port. Keep the
// documented LAN preview origin available when no deployment-specific CORS
// policy has been supplied; production still overrides this via CORS_ORIGINS.
const defaultV11CorsOrigins = [
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:4180',
  'http://localhost:4180',
  'http://192.168.1.103:4180',
].join(',');

function playerError(code: V11PlayerErrorCode, technicalCode: string = code) {
  const copy = playerErrorCopy[code];
  return {
    code,
    message: copy.playerMessage,
    playerMessage: copy.playerMessage,
    technicalCode,
    retryable: copy.retryable,
    recoveryAction: copy.recoveryAction,
  };
}

function contentChecksum(content: V11Store['content']): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function publicV11Class(record: V11ClassRecord) {
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

const payloadKeys: Record<V11Action['type'], readonly string[]> = {
  onboarding_completed: [],
  stage_action_selected: ['actionId'],
  question_action_executed: ['actionId'],
  evidence_viewed: ['evidenceId'],
  choice_previewed: ['choiceId'],
  key_prediction_selected: ['predictionId', 'expectedMetric'],
  risk_plan_selected: ['riskPlanId', 'predictionId'],
  choice_committed: ['choiceId', 'decisionGroupId', 'riskPlanId'],
  choice_skipped: ['reason'],
  brand_identity_declared: ['brandName', 'namingIntent', 'personality', 'identityArchitecture'],
  terms_introduced: ['termIds'],
  visual_selected: ['visualId'],
  visual_tested: ['visualId', 'testId'],
  round_result_acknowledged: ['resultId'],
  chapter_review_acknowledged: [],
};

function actionFromInput(value: unknown): V11Action {
  const parsed = V11ActionInput.parse(value);
  if (parsed.type === 'onboarding_completed' && parsed.roundId)
    throw new Error('序章动作不能带轮次');
  const allowed = payloadKeys[parsed.type];
  for (const key of Object.keys(parsed.payload))
    if (!allowed.includes(key)) throw new Error(`动作参数 ${key} 不允许由客户端提交`);
  return parsed;
}

function publicV11Playthrough(
  playthrough: V11PlaythroughRecord,
  content: V11Store['content'],
): V11PublicPlaythroughView {
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
    contentChecksum: contentChecksum(content),
    resumeScreen,
    nextActionSequence: playthrough.logs.length + 1,
    ...(pendingChapterReview ? { chapterReviewPending: pendingChapterReview } : {}),
    state: JSON.parse(JSON.stringify(playthrough.state)) as V11PublicPlaythroughView['state'],
  };
}

export function buildV11App(store: V11Store = new V11MemoryStore()): FastifyInstance {
  const app = Fastify({ logger: false });
  const anonymousCases = new Map<
    string,
    { classId: string; expiresAt: number; data: ReturnType<typeof buildV11AnonymousCase> }
  >();
  const configuredOrigins = process.env.CORS_ORIGINS ?? defaultV11CorsOrigins;
  const allowAllOrigins = configuredOrigins.trim() === '*';
  const allowedOrigins = new Set(
    configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  app.register(cookie);
  app.register(cors, {
    origin: (origin, callback) =>
      callback(null, !origin || allowAllOrigins || allowedOrigins.has(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'DELETE', 'OPTIONS'],
  });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !allowAllOrigins && !allowedOrigins.has(origin))
        return reply.code(403).send({ code: 'ORIGIN_REJECTED', message: '请求来源不受信任' });
    }
  });

  app.get('/health', async () => ({ status: 'ok', service: 'laojie-api-v1.1' }));
  app.get('/ready', async (_request, reply) => {
    try {
      await store.checkReadiness();
      return {
        status: 'ready',
        service: 'laojie-api-v1.1',
        contentVersion: store.content.contentVersion,
        contentChecksum: contentChecksum(store.content),
      };
    } catch {
      return reply.code(503).send({
        status: 'not_ready',
        service: 'laojie-api-v1.1',
        recoveryAction: '检查数据库连接和正式内容包后再重试',
      });
    }
  });
  app.get('/api/v11/content', async (_request, reply) => {
    const checksum = contentChecksum(store.content);
    reply.header('x-v11-content-version', store.content.contentVersion);
    reply.header('x-v11-content-checksum', checksum);
    return { ...store.content, contentChecksum: checksum };
  });

  app.post<{ Body: { email?: string; password?: string } }>(
    '/api/v11/teacher/login',
    async (request, reply) => {
      const token = await store.authenticateTeacher(
        request.body.email ?? '',
        request.body.password ?? '',
      );
      if (!token)
        return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: '教师账号或密码错误' });
      reply.setCookie('v11_teacher_session', token, {
        httpOnly: true,
        // The Pages UI and API live on different sites in production, so the
        // session must be explicitly allowed on credentialed cross-site fetches.
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 8 * 60 * 60,
      });
      return { ok: true };
    },
  );

  app.post<{ Body: { name?: string } }>('/api/v11/teacher/classes', async (request, reply) => {
    if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
    const name = request.body.name?.trim();
    if (!name || name.length > 80)
      return reply
        .code(400)
        .send({ code: 'INVALID_CLASS_NAME', message: '班级名称不能为空且不能超过80字' });
    try {
      return publicV11Class(await store.createClass(name));
    } catch (error) {
      return reply.code(400).send({
        code: 'CLASS_CREATE_FAILED',
        message: error instanceof Error ? error.message : '班级创建失败',
      });
    }
  });

  app.get('/api/v11/teacher/classes', async (request, reply) => {
    if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
    return { classes: (await store.listClasses()).map(publicV11Class) };
  });

  app.post<{
    Params: { classId: string };
    Body: { status?: V11ClassRecord['status'] };
  }>('/api/v11/teacher/classes/:classId/status', async (request, reply) => {
    if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
    const status = request.body.status;
    if (!status || !['active', 'closed', 'archived'].includes(status))
      return reply.code(400).send({ code: 'INVALID_STATUS', message: '班级状态无效' });
    const updated = await store.updateClassStatus(request.params.classId, status);
    if (!updated) return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
    return publicV11Class(updated);
  });

  app.delete<{
    Params: { classId: string };
    Body?: { confirmation?: string };
  }>('/api/v11/teacher/classes/:classId', async (request, reply) => {
    const session = await store.getTeacherSession(teacherToken(request) ?? '');
    if (!session)
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
    if (request.body?.confirmation !== 'DELETE_CLASS')
      return reply
        .code(400)
        .send({ code: 'DELETE_CONFIRMATION_REQUIRED', message: '请确认整班删除' });
    const classRecord = await store.getClassById(request.params.classId);
    if (!classRecord)
      return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
    const deleted = await store.deleteClass(request.params.classId, session.teacherId);
    if (!deleted) return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
    for (const [caseId, entry] of anonymousCases)
      if (entry.classId === request.params.classId) anonymousCases.delete(caseId);
    return { ok: true };
  });

  app.get<{ Querystring: { playthroughId?: string } }>(
    '/api/v11/student/me',
    async (request, reply) => {
      const token = studentToken(request);
      if (!token || !request.query.playthroughId)
        return reply.code(401).send(playerError('UNAUTHORIZED'));
      const playthrough = await store.getPlaythroughForStudent(token, request.query.playthroughId);
      if (!playthrough) return reply.code(404).send(playerError('PLAYTHROUGH_NOT_FOUND'));
      return { playthrough: publicV11Playthrough(playthrough, store.content) };
    },
  );

  app.post<{ Body: { classCode?: string; studentNumber?: string; name?: string } }>(
    '/api/v11/student/join',
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
        const technicalCode = error instanceof Error ? error.message : 'JOIN_FAILED';
        const code: V11PlayerErrorCode = /班级|class/i.test(technicalCode)
          ? 'CLASS_NOT_FOUND'
          : 'JOIN_INVALID';
        return reply.code(400).send(playerError(code, technicalCode));
      }
    },
  );

  app.post<{ Body: { firstRunId?: string } }>('/api/v11/student/replay', async (request, reply) => {
    const token = studentToken(request);
    if (!token) return reply.code(401).send(playerError('UNAUTHORIZED'));
    try {
      if (!request.body.firstRunId || request.body.firstRunId.length > 80)
        throw new Error('缺少首局记录编号');
      return await store.startReplay(token, request.body.firstRunId);
    } catch (error) {
      return reply
        .code(400)
        .send(
          playerError(
            'REPLAY_NOT_READY',
            error instanceof Error ? error.message : 'REPLAY_NOT_READY',
          ),
        );
    }
  });

  app.post<{ Body: { playthroughId?: string; action?: unknown; idempotencyKey?: string } }>(
    '/api/v11/student/actions',
    async (request, reply) => {
      const token = studentToken(request);
      if (!token) return reply.code(401).send(playerError('UNAUTHORIZED'));
      try {
        const playthroughId = request.body.playthroughId;
        const idempotencyKey = request.body.idempotencyKey;
        if (
          !playthroughId ||
          !request.body.action ||
          !idempotencyKey ||
          idempotencyKey.length > 128
        )
          throw new Error('缺少动作字段或幂等键过长');
        const action = actionFromInput(request.body.action);
        if (action.actionId !== idempotencyKey) throw new Error('动作 ID 必须与幂等键一致');
        return await store.submitAction(token, playthroughId, action, idempotencyKey);
      } catch (error) {
        const technicalCode = error instanceof Error ? error.message : 'ACTION_REJECTED';
        if (/幂等键|动作 ID/.test(technicalCode))
          return reply.code(409).send(playerError('IDEMPOTENCY_CONFLICT', technicalCode));
        return reply.code(400).send(playerError('ACTION_REJECTED', technicalCode));
      }
    },
  );

  app.get<{ Params: { playthroughId: string } }>(
    '/api/v11/student/reports/:playthroughId',
    async (request, reply) => {
      const token = studentToken(request);
      if (!token) return reply.code(401).send(playerError('UNAUTHORIZED'));
      const report = await store.getReport(token, request.params.playthroughId);
      if (!report) return reply.code(404).send(playerError('REPORT_NOT_READY'));
      return report;
    },
  );

  app.get<{ Params: { classId: string } }>(
    '/api/v11/teacher/classes/:classId/students',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录教师后台' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      const students = await store.getClassStudents(classRecord.id);
      return {
        class: {
          id: classRecord.id,
          code: classRecord.code,
          name: classRecord.name,
          contentVersion: classRecord.contentVersion,
          contentChecksum: classRecord.contentChecksum,
          status: classRecord.status,
          createdAt: classRecord.createdAt,
        },
        students: students.map(({ identity, playthroughs }) => ({
          identity: {
            id: identity.id,
            studentNumber: identity.studentNumber,
            displayName: identity.displayName,
          },
          playthroughs,
        })),
      };
    },
  );

  app.get<{ Params: { classId: string } }>(
    '/api/v11/teacher/classes/:classId/analytics',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '教师会话无效' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      return buildV11ClassAnalytics(
        classRecord,
        await store.getClassStudents(classRecord.id),
        store.content,
      );
    },
  );

  app.get<{ Params: { classId: string; kind: string } }>(
    '/api/v11/teacher/classes/:classId/export/:kind',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '教师会话无效' });
      const kinds = ['progress', 'decisions', 'states', 'reports'] as const;
      if (!kinds.includes(request.params.kind as (typeof kinds)[number]))
        return reply.code(400).send({ code: 'EXPORT_KIND_INVALID', message: '导出类型不支持' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      const kind = request.params.kind as (typeof kinds)[number];
      reply.header('content-type', 'text/csv; charset=utf-8');
      reply.header(
        'content-disposition',
        `attachment; filename="laojie-v11-${kind}-${classRecord.code}.csv"`,
      );
      return reply.send(
        exportV11Csv(kind, classRecord, await store.getClassStudents(classRecord.id)),
      );
    },
  );

  app.get<{ Params: { classId: string } }>(
    '/api/v11/teacher/classes/:classId/export-dictionary',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '教师会话无效' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      return {
        classId: classRecord.id,
        contentVersion: classRecord.contentVersion,
        dictionary: v11ExportDictionary,
      };
    },
  );

  app.post<{ Params: { classId: string } }>(
    '/api/v11/teacher/classes/:classId/cases',
    async (request, reply) => {
      if (!(await store.getTeacherSession(teacherToken(request) ?? '')))
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '教师会话无效' });
      const classRecord = await store.getClassById(request.params.classId);
      if (!classRecord)
        return reply.code(404).send({ code: 'CLASS_NOT_FOUND', message: '班级不存在' });
      const bundles = await store.getClassStudents(classRecord.id);
      const existingVariantCount = [...anonymousCases.values()].filter(
        (entry) => entry.classId === classRecord.id,
      ).length;
      const data = buildV11AnonymousCase(bundles, store.content, existingVariantCount);
      if (!data)
        return reply
          .code(404)
          .send({ code: 'CASE_NOT_READY', message: '暂无可用的已决策首局案例' });
      const caseId = randomUUID();
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
      anonymousCases.set(caseId, { classId: classRecord.id, expiresAt, data });
      return { caseId, expiresAt, ...data };
    },
  );

  app.get<{ Params: { caseId: string } }>('/api/v11/cases/:caseId', async (request, reply) => {
    const entry = anonymousCases.get(request.params.caseId);
    if (!entry || entry.expiresAt < Date.now()) {
      anonymousCases.delete(request.params.caseId);
      return reply.code(404).send({ code: 'CASE_NOT_FOUND', message: '匿名案例不存在或已过期' });
    }
    return { caseId: request.params.caseId, expiresAt: entry.expiresAt, ...entry.data };
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply
      .status(500)
      .send(
        playerError('INTERNAL_ERROR', error instanceof Error ? error.message : 'INTERNAL_ERROR'),
      );
  });
  return app;
}
