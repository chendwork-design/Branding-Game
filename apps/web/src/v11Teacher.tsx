import { useEffect, useState } from 'react';
import { v11FullContent } from '@laojie/content-schema';
import {
  FetchV11TeacherApi,
  type V11AnonymousCase,
  type V11TeacherAnalytics,
  type V11TeacherClass,
  type V11TeacherStudent,
} from './v11TeacherApi.js';

const api = new FetchV11TeacherApi();
const actionLabels: Record<string, string> = {
  onboarding_completed: '完成新手引导',
  stage_action_selected: '执行现场行动',
  evidence_viewed: '查看情报',
  choice_previewed: '预览方案',
  question_action_executed: '执行现场行动',
  key_prediction_selected: '记录经营判断',
  risk_plan_selected: '配置风险预案',
  choice_committed: '提交经营选择',
  choice_skipped: '本轮维持现状',
  brand_identity_declared: '确定品牌身份方向',
  terms_introduced: '查看本轮概念说明',
  visual_selected: '选择视觉系统',
  visual_tested: '测试视觉触点',
  round_result_acknowledged: '确认轮次结果',
  chapter_review_acknowledged: '确认章节体检',
};

const metricNames: Record<string, string> = {
  conversion: '成交',
  visualRecognition: '识别',
  productDelivery: '出品承接',
  trust: '信任',
};
const riskOutcomeNames: Record<string, string> = {
  mitigated: '预案发挥作用',
  hit: '风险已发生',
  not_selected: '没有配置预案',
  not_triggered: '本轮未触发',
};

function roundFor(roundId?: string) {
  return roundId ? v11FullContent.rounds.find((round) => round.roundId === roundId) : undefined;
}

function contentLabel(
  kind: 'choice' | 'evidence' | 'stageAction' | 'riskPlan' | 'visualTest',
  id: string,
  roundId?: string,
): string {
  const round = roundFor(roundId);
  if (kind === 'choice') return round?.choices.find((entry) => entry.choiceId === id)?.label ?? id;
  if (kind === 'evidence')
    return round?.evidence.find((entry) => entry.evidenceId === id)?.title ?? id;
  if (kind === 'stageAction')
    return round?.stageActions.find((entry) => entry.actionId === id)?.label ?? id;
  if (kind === 'riskPlan')
    return round?.riskPlans.find((entry) => entry.riskPlanId === id)?.label ?? id;
  return round?.visualTests.find((entry) => entry.testId === id)?.title ?? id;
}

function actionDetail(
  log: V11TeacherStudent['playthroughs'][number]['logs'][number],
): string | undefined {
  const value = (key: string) =>
    typeof log.action.payload[key] === 'string' ? log.action.payload[key] : undefined;
  switch (log.action.type) {
    case 'stage_action_selected':
    case 'question_action_executed': {
      const actionId = value('actionId');
      return actionId
        ? `完成：${contentLabel('stageAction', actionId, log.action.roundId)}`
        : undefined;
    }
    case 'evidence_viewed': {
      const evidenceId = value('evidenceId');
      return evidenceId
        ? `查看：${contentLabel('evidence', evidenceId, log.action.roundId)}`
        : undefined;
    }
    case 'choice_previewed':
    case 'choice_committed': {
      const choiceId = value('choiceId');
      return choiceId
        ? `${log.action.type === 'choice_previewed' ? '比较' : '执行'}：${contentLabel('choice', choiceId, log.action.roundId)}`
        : undefined;
    }
    case 'key_prediction_selected': {
      const metric = value('metricKey') ?? value('label');
      return metric ? `预判最先变化：${metricNames[metric] ?? metric}` : undefined;
    }
    case 'risk_plan_selected': {
      const riskPlanId = value('riskPlanId');
      return riskPlanId
        ? `准备：${contentLabel('riskPlan', riskPlanId, log.action.roundId)}`
        : undefined;
    }
    case 'brand_identity_declared':
      return `品牌名：${value('brandName') ?? '未填写'}；身份路线：${value('identityArchitecture') ?? '未选择'}`;
    case 'visual_selected': {
      const visualId = value('visualId');
      return visualId
        ? `选定：${v11FullContent.visualSystems.find((visual) => visual.visualId === visualId)?.name ?? visualId}`
        : undefined;
    }
    case 'visual_tested': {
      const testId = value('testId');
      return testId ? `测试：${contentLabel('visualTest', testId, log.action.roundId)}` : undefined;
    }
    default:
      return undefined;
  }
}

export function V11TeacherScreen() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('teacher@example.test');
  const [password, setPassword] = useState('change-me-in-production');
  const [classId, setClassId] = useState('v11-trial-class');
  const [classes, setClasses] = useState<V11TeacherClass[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [classRecord, setClassRecord] = useState<V11TeacherClass>();
  const [analytics, setAnalytics] = useState<V11TeacherAnalytics>();
  const [students, setStudents] = useState<V11TeacherStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [caseCard, setCaseCard] = useState<V11AnonymousCase>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedStudent = students.find((student) => student.identity.id === selectedStudentId);

  const refresh = async (targetClassId = classId) => {
    if (!targetClassId) return;
    if (targetClassId !== classId) setCaseCard(undefined);
    setBusy(true);
    setError('');
    try {
      const [studentResponse, analyticsResponse] = await Promise.all([
        api.students(targetClassId),
        api.analytics(targetClassId),
      ]);
      setClassId(targetClassId);
      setClassRecord(studentResponse.class);
      setStudents(studentResponse.students);
      setAnalytics(analyticsResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '班级数据读取失败');
    } finally {
      setBusy(false);
    }
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(email, password);
      setAuthenticated(true);
      const available = await api.classes();
      setClasses(available.classes);
      const selected =
        available.classes.find((item) => item.id === classId) ?? available.classes[0];
      if (selected) await refresh(selected.id);
      else setError('当前还没有班级，请先创建一个班级。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      // 首次登录时可能还没有任何班级；无论是否需要继续读取班级数据，
      // 都必须结束登录态，避免创建班级按钮永久禁用。
      setBusy(false);
    }
  };

  if (!authenticated)
    return (
      <main className="shell teacher-shell">
        <section className="hero-card">
          <p className="eyebrow">老街品牌局 · v1.2 教师后台</p>
          <h1>课程观察台</h1>
          <p className="lead">
            查看十二轮经营路径、逐条决策和匿名课堂案例。已发布班级的内容、权重、种子和学生结果不能在这里修改。
          </p>
          <form className="join-form" onSubmit={login}>
            <label>
              教师账号
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? '读取中…' : '进入 v1.2 后台'}
            </button>
          </form>
        </section>
      </main>
    );

  const generateCase = async () => {
    setBusy(true);
    setError('');
    try {
      setCaseCard(await api.createCase(classId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂无可用案例');
    } finally {
      setBusy(false);
    }
  };
  const createClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api.createClass(newClassName);
      setClasses((current) => [created, ...current]);
      setNewClassName('');
      setClassId(created.id);
      setClassRecord(created);
      setStudents([]);
      setAnalytics(undefined);
      setSelectedStudentId('');
      setCaseCard(undefined);
      await refresh(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '班级创建失败');
    } finally {
      setBusy(false);
    }
  };
  const updateClassStatus = async (status: V11TeacherClass['status']) => {
    if (!classRecord) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api.updateClassStatus(classRecord.id, status);
      setClasses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setClassRecord(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '班级状态更新失败');
    } finally {
      setBusy(false);
    }
  };
  const deleteClass = async () => {
    if (
      !classRecord ||
      !window.confirm(
        `确定删除“${classRecord.name}”吗？这会删除该班级的身份、首局、重玩、报告和反思，且不可恢复。`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api.deleteClass(classRecord.id);
      const remaining = classes.filter((item) => item.id !== classRecord.id);
      setClasses(remaining);
      setStudents([]);
      setAnalytics(undefined);
      setSelectedStudentId('');
      setCaseCard(undefined);
      const next = remaining[0];
      if (next) await refresh(next.id);
      else {
        setClassId('');
        setClassRecord(undefined);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '班级删除失败');
    } finally {
      setBusy(false);
    }
  };
  const download = async (kind: 'progress' | 'decisions' | 'states' | 'reports') => {
    try {
      const url = URL.createObjectURL(await api.downloadCsv(classId, kind));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `laojie-v11-${kind}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出失败');
    }
  };

  return (
    <main className="teacher-shell">
      <header className="teacher-header">
        <div>
          <p className="eyebrow">老街品牌局 · v1.2 教师后台</p>
          <h1>课程观察台</h1>
        </div>
        <button className="secondary-button" type="button" onClick={() => setAuthenticated(false)}>
          退出
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="teacher-layout">
        <aside className="teacher-sidebar">
          <form className="teacher-card compact" onSubmit={createClass}>
            <p className="chapter-label">新建正式班级</p>
            <label>
              班级名称
              <input
                required
                maxLength={80}
                value={newClassName}
                onChange={(event) => setNewClassName(event.target.value)}
                placeholder="例如：品牌经营课 2026 秋"
              />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              创建班级并生成班级码
            </button>
          </form>
          {classes.length > 0 && (
            <label className="teacher-card compact">
              切换班级
              <select
                value={classId}
                disabled={busy}
                onChange={(event) => void refresh(event.target.value)}
              >
                {classes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.code}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="section-heading">
            <h2>当前班级</h2>
            <span>
              {classRecord?.status === 'active' ? '进行中' : (classRecord?.status ?? '未知')}
            </span>
          </div>
          <p className="muted">{classRecord?.name}</p>
          <p className="muted">
            班级码 <strong>{classRecord?.code}</strong>
          </p>
          <p className="muted">内容 {classRecord?.contentVersion}</p>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
          >
            刷新数据
          </button>
          {classRecord && (
            <div className="teacher-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() =>
                  void updateClassStatus(classRecord.status === 'active' ? 'closed' : 'active')
                }
              >
                {classRecord.status === 'active' ? '关闭班级' : '重新开放班级'}
              </button>
              {classRecord.status === 'closed' && (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void updateClassStatus('archived')}
                >
                  归档班级
                </button>
              )}
              {classRecord.status === 'archived' && (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void updateClassStatus('closed')}
                >
                  恢复为关闭
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void deleteClass()}
              >
                删除当前班级
              </button>
            </div>
          )}
          <div className="teacher-card compact">
            <p className="chapter-label">课堂工具</p>
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => void generateCase()}
            >
              生成匿名案例
            </button>
            {caseCard && (
              <p className="muted">
                案例已生成，可打开{' '}
                <a href={`/v11-case/${caseCard.caseId}`} target="_blank" rel="noreferrer">
                  匿名投影
                </a>
              </p>
            )}
          </div>
        </aside>
        <section className="teacher-main">
          {analytics && <V11AnalyticsPanel analytics={analytics} />}
          {caseCard && (
            <section className="teacher-card case-card">
              <strong>{caseCard.title}</strong>
              <p>{caseCard.summary}</p>
              <p>
                <b>讨论提示：</b>
                {caseCard.discussionPrompt}
              </p>
              <div className="case-path">
                {caseCard.path.map((item, index) => (
                  <span key={`${item.roundTitle}-${index}`}>
                    第 {index + 1} 轮 · {item.choiceLabel}
                  </span>
                ))}
              </div>
            </section>
          )}
          <section className="teacher-card">
            <div className="section-heading">
              <div>
                <p className="chapter-label">数据导出</p>
                <h2>下载课程记录</h2>
              </div>
              <span>首局 · UTF-8 BOM</span>
            </div>
            <div className="export-buttons">
              {(['progress', 'decisions', 'states', 'reports'] as const).map((kind) => (
                <button
                  className="secondary-button"
                  type="button"
                  key={kind}
                  onClick={() => void download(kind)}
                >
                  {kind}.csv
                </button>
              ))}
            </div>
          </section>
          <section className="teacher-card">
            <div className="section-heading">
              <div>
                <p className="chapter-label">实名仅教师可见</p>
                <h2>学生决策时间线</h2>
              </div>
              <span>{students.length} 名</span>
            </div>
            <div className="student-list">
              {students.map((student) => (
                <button
                  className={`student-item ${student.identity.id === selectedStudentId ? 'selected' : ''}`}
                  type="button"
                  key={student.identity.id}
                  onClick={() => setSelectedStudentId(student.identity.id)}
                >
                  <strong>
                    {student.identity.studentNumber} · {student.identity.displayName}
                  </strong>
                  <span>
                    {student.playthroughs.some(
                      (run) => run.kind === 'first_run' && run.status === 'completed',
                    )
                      ? '首局已完成'
                      : '进行中'}{' '}
                    · {student.playthroughs.length} 次记录
                  </span>
                </button>
              ))}
            </div>
            {selectedStudent && <V11StudentTimeline student={selectedStudent} />}
          </section>
        </section>
      </section>
    </main>
  );
}

function V11AnalyticsPanel({ analytics }: { analytics: V11TeacherAnalytics }) {
  const freeActionNames: Record<string, string> = {
    stage_action_selected: '调查与准备',
    question_action_executed: '调查与准备',
    risk_plan_selected: '风险预案',
    visual_tested: '视觉测试',
  };
  const identityNames: Record<string, string> = {
    wordmark: '文字 LOGO 路线',
    symbol: '符号 LOGO 路线',
    ip: 'IP 路线',
  };
  const evidenceName = (evidenceId: string) =>
    v11FullContent.rounds
      .flatMap((round) => round.evidence)
      .find((evidence) => evidence.evidenceId === evidenceId)?.title ?? evidenceId;
  const choiceName = (choiceId: string) =>
    v11FullContent.rounds
      .flatMap((round) => round.choices)
      .find((choice) => choice.choiceId === choiceId)?.label ?? choiceId;
  const eventName = (eventId: string) =>
    v11FullContent.events.find((event) => event.eventId === eventId)?.title ?? eventId;
  return (
    <section className="teacher-card">
      <div className="section-heading">
        <div>
          <p className="chapter-label">首局聚合</p>
          <h2>全班正在形成什么路径？</h2>
        </div>
        <span>排除 replay</span>
      </div>
      <div className="teacher-stats">
        <span>
          <small>已开始</small>
          <strong>
            {analytics.progress.started} / {analytics.progress.totalStudents}
          </strong>
        </span>
        <span>
          <small>已完成</small>
          <strong>{analytics.progress.completed}</strong>
        </span>
        <span>
          <small>完成率</small>
          <strong>{Math.round(analytics.progress.completionRate * 100)}%</strong>
        </span>
        <span>
          <small>中位时长</small>
          <strong>{Math.round(analytics.progress.medianDurationSeconds / 60)} 分钟</strong>
        </span>
      </div>
      <div className="v11-teacher-analytics-grid">
        <div>
          <b>路线分布</b>
          {Object.entries(analytics.routeDistribution).map(([title, count]) => (
            <p key={title}>
              {title} · {count}
            </p>
          ))}
        </div>
        <div>
          <b>行动力花在何处</b>
          {Object.entries(analytics.freeActionAllocation).map(([type, count]) => (
            <p key={type}>
              {freeActionNames[type] ?? type} · {count} AP
            </p>
          ))}
        </div>
        <div>
          <b>主动维持现状</b>
          {Object.entries(analytics.skipDistribution).map(([roundId, count]) => (
            <p key={roundId}>
              {roundId.toUpperCase()} · {count} 人
            </p>
          ))}
          {!Object.keys(analytics.skipDistribution).length && (
            <p className="muted">目前没有人跳过战略选择</p>
          )}
        </div>
        <div>
          <b>高频决策</b>
          {Object.entries(analytics.choiceDistribution)
            .slice(0, 8)
            .map(([choiceId, count]) => (
              <p key={choiceId}>
                {choiceName(choiceId)} · {count} 人
              </p>
            ))}
        </div>
      </div>
      <div className="v11-teacher-analytics-grid">
        <div>
          <b>关键判断</b>
          <p>
            {analytics.predictionSummary.submitted} 次判断，
            {analytics.predictionSummary.matchedTopChange} 次与最先变化的指标一致。
          </p>
          <p>一致率 · {Math.round(analytics.predictionSummary.matchRate * 100)}%</p>
          {Object.entries(analytics.predictionSummary.byMetric).map(([metric, count]) => (
            <p key={metric}>
              {metricNames[metric] ?? metric} · {count} 次
            </p>
          ))}
        </div>
        <div>
          <b>调查结果被打开</b>
          {Object.entries(analytics.evidenceOpenRate).map(([evidenceId, rate]) => (
            <p key={evidenceId}>
              {evidenceName(evidenceId)} · {Math.round(rate * 100)}%
            </p>
          ))}
          {!Object.keys(analytics.evidenceOpenRate).length && (
            <p className="muted">还没有完成调查后的结果查看记录</p>
          )}
        </div>
        <div>
          <b>风险与事件</b>
          {Object.entries(analytics.riskDistribution).map(([status, count]) => (
            <p key={status}>
              {riskOutcomeNames[status] ?? status} · {count} 次
            </p>
          ))}
          {Object.entries(analytics.eventDistribution).map(([eventId, count]) => (
            <p key={eventId}>
              {eventName(eventId)} · {count} 次
            </p>
          ))}
          {!Object.keys(analytics.riskDistribution).length &&
            !Object.keys(analytics.eventDistribution).length && (
              <p className="muted">还没有进入可统计的经营结果</p>
            )}
        </div>
        <div>
          <b>视觉身份路线</b>
          {Object.entries(analytics.brandIdentityDistribution).map(([route, count]) => (
            <p key={route}>
              {identityNames[route] ?? route} · {count} 人
            </p>
          ))}
          {Object.entries(analytics.visualTestDistribution).map(([label, result]) => (
            <p key={label}>
              {label} · 通过 {result.passed} / {result.total}
            </p>
          ))}
        </div>
        <div>
          <b>问题行动完成率</b>
          {Object.entries(analytics.questionActionRate).map(([questionId, value]) => (
            <p key={questionId}>
              {questionId} · {Math.round(value * 100)}%
            </p>
          ))}
        </div>
      </div>
      <div className="v11-awards">
        <b>匿名过程奖项</b>
        <p className="muted">只显示人数，不显示姓名；用于课堂讨论，不参与成绩结算。</p>
        {analytics.anonymousAwards.map((award) => (
          <div className="v11-award" key={award.awardId}>
            <strong>
              {award.title} · {award.count} 人
            </strong>
            <span>{award.description}</span>
          </div>
        ))}
      </div>
      {analytics.topPaths.length > 0 && (
        <details>
          <summary>查看高频完整路径</summary>
          {analytics.topPaths.map((path) => (
            <p key={path.path}>
              {path.count} 人 · {path.path}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}

function V11StudentTimeline({ student }: { student: V11TeacherStudent }) {
  const firstRun = student.playthroughs.find((run) => run.kind === 'first_run');
  if (!firstRun) return null;
  return (
    <div className="teacher-timeline">
      <div className="section-heading">
        <h3>{student.identity.displayName} 的首局过程</h3>
        <span>
          {firstRun.status === 'completed' ? '已完成' : `第 ${firstRun.roundIndex + 1} / 12 轮`}
        </span>
      </div>
      {firstRun.state.brandIdentity && (
        <p className="muted">
          品牌名：{firstRun.state.brandIdentity.brandName} · 身份方向：
          {firstRun.state.brandIdentity.identityArchitecture}
        </p>
      )}
      {firstRun.logs.map((log) => {
        const detail = actionDetail(log);
        return (
          <article className="timeline-item" key={`${log.sequenceNo}-${log.createdAt}`}>
            <strong>
              第 {log.sequenceNo} 步 · {actionLabels[log.action.type] ?? log.action.type}
            </strong>
            {detail && <p className="timeline-action-detail">{detail}</p>}
            <p>{log.trace.explanation}</p>
            <small>
              现金 ¥{log.trace.before.cashYuan.toLocaleString('zh-CN')} → ¥
              {log.trace.after.cashYuan.toLocaleString('zh-CN')} · 自由行动{' '}
              {log.trace.before.freeActionPoints} → {log.trace.after.freeActionPoints} · 战略行动{' '}
              {log.trace.before.strategicActionPoints} → {log.trace.after.strategicActionPoints} ·
              第 {log.trace.before.elapsedDays} 天 → 第 {log.trace.after.elapsedDays} 天
            </small>
            {log.trace.immediateEffects.length > 0 && (
              <p className="timeline-effects">
                即时：
                {log.trace.immediateEffects
                  .map(
                    (effect) => `${effect.label}${effect.amount > 0 ? ' +' : ' '}${effect.amount}`,
                  )
                  .join('；')}
              </p>
            )}
            {log.trace.scheduledEffects.length > 0 && (
              <p className="timeline-effects">
                后续：
                {log.trace.scheduledEffects
                  .map(
                    (effect) => `${effect.label}${effect.amount > 0 ? ' +' : ' '}${effect.amount}`,
                  )
                  .join('；')}
              </p>
            )}
            {log.trace.triggeredEvents.map((event) => (
              <p className="v11-reaction" key={`${log.sequenceNo}-${event.title}`}>
                现场插曲：{event.title} · {event.text}
              </p>
            ))}
            {log.trace.riskOutcome && (
              <p className="timeline-effects">
                风险结果：
                {riskOutcomeNames[log.trace.riskOutcome.status] ??
                  log.trace.riskOutcome.status} · {log.trace.riskOutcome.explanation}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function V11CaseScreen({ caseId }: { caseId: string }) {
  const [caseCard, setCaseCard] = useState<V11AnonymousCase>();
  const [error, setError] = useState('');
  useEffect(() => {
    void api
      .getCase(caseId)
      .then(setCaseCard)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '案例不存在或已过期'));
  }, [caseId]);
  if (error)
    return (
      <main className="shell">
        <section className="hero-card">
          <p className="eyebrow">老街品牌局 · 匿名课堂案例</p>
          <h1>案例已关闭</h1>
          <p className="lead">这个匿名案例链接已经过期或已被清理。</p>
        </section>
      </main>
    );
  if (!caseCard)
    return (
      <main className="shell">
        <section className="hero-card">
          <p className="eyebrow">老街品牌局 · 匿名课堂案例</p>
          <h1>正在打开</h1>
          <p className="lead">正在读取匿名路径…</p>
        </section>
      </main>
    );
  return (
    <main className="case-screen projection-screen" data-v11-projection="anonymous">
      <section className="case-card case-card-large">
        <p className="eyebrow">老街品牌局 · 匿名课堂案例</p>
        <h1>{caseCard.title}</h1>
        <p className="lead">{caseCard.summary}</p>
        <div className="case-path">
          {caseCard.path.map((item, index) => (
            <span key={`${item.roundTitle}-${index}`}>
              第 {index + 1} 轮 · {item.roundTitle} · {item.choiceLabel}
            </span>
          ))}
        </div>
        <p>
          <b>讨论提示：</b>
          {caseCard.discussionPrompt}
        </p>
        <small>此页面不含学生姓名、学号或 playthrough 标识。</small>
      </section>
    </main>
  );
}
