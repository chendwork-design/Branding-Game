import { useEffect, useMemo, useState } from 'react';
import type {
  AnonymousCase,
  TeacherAnalytics,
  TeacherClass,
  TeacherStudent,
} from './teacherApi.js';
import { FetchTeacherApi } from './teacherApi.js';

const teacherApi = new FetchTeacherApi();

export function TeacherScreen() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('teacher@example.test');
  const [password, setPassword] = useState('change-me-in-production');
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [analytics, setAnalytics] = useState<TeacherAnalytics>();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [caseCard, setCaseCard] = useState<AnonymousCase>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [studentFilter, setStudentFilter] = useState('');
  const [studentPage, setStudentPage] = useState(0);

  const selectedClass = classes.find((item) => item.id === selectedId);
  const selectedStudent = students.find((item) => item.identity.id === selectedStudentId);
  const filteredStudents = students.filter((student) => {
    const query = studentFilter.trim().toLowerCase();
    if (!query) return true;
    return `${student.identity.studentNumber} ${student.identity.displayName}`
      .toLowerCase()
      .includes(query);
  });
  const studentPageSize = 20;
  const studentPageCount = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const safeStudentPage = Math.min(studentPage, studentPageCount - 1);
  const visibleStudents = filteredStudents.slice(
    safeStudentPage * studentPageSize,
    (safeStudentPage + 1) * studentPageSize,
  );

  useEffect(() => {
    void teacherApi
      .classes()
      .then((next) => {
        setClasses(next);
        setSelectedId((current) => current || next[0]?.id || '');
        setAuthenticated(true);
      })
      .catch(() => undefined);
  }, []);

  const refreshClasses = async () => {
    const next = await teacherApi.classes();
    setClasses(next);
    if (!selectedId && next[0]) setSelectedId(next[0].id);
    if (selectedId && !next.some((item) => item.id === selectedId))
      setSelectedId(next[0]?.id ?? '');
  };
  const refreshSelected = async (classId = selectedId) => {
    if (!classId) return;
    const [studentResponse, analyticsResponse] = await Promise.all([
      teacherApi.students(classId),
      teacherApi.analytics(classId),
    ]);
    setStudents(studentResponse.students);
    setAnalytics(analyticsResponse);
  };
  const inspectStudent = async (studentId: string) => {
    setSelectedStudentId(studentId);
    try {
      await refreshSelected();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '学生过程读取失败');
    }
  };
  useEffect(() => {
    if (!authenticated) return;
    void refreshClasses().catch((cause) =>
      setError(cause instanceof Error ? cause.message : '班级读取失败'),
    );
  }, [authenticated]);
  useEffect(() => {
    if (!authenticated || !selectedId) return;
    void refreshSelected().catch((cause) =>
      setError(cause instanceof Error ? cause.message : '班级数据读取失败'),
    );
  }, [authenticated, selectedId]);
  useEffect(() => {
    setStudentPage(0);
  }, [selectedId, studentFilter]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await teacherApi.login(email, password);
      setAuthenticated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setBusy(false);
    }
  };
  if (!authenticated)
    return (
      <main className="shell teacher-shell">
        <section className="hero-card">
          <p className="eyebrow">老街品牌局 · 教师后台</p>
          <h1>课程观察台</h1>
          <p className="lead">
            查看学生如何做出选择、哪些路径产生分歧，并生成不带身份信息的课堂案例。
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
              {busy ? '登录中…' : '进入后台'}
            </button>
          </form>
          <p className="privacy-note">
            内容版本在发布前固定；本后台没有内容、权重、种子或学生结果编辑入口。
          </p>
        </section>
      </main>
    );

  const createClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newClassName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await teacherApi.createClass(newClassName);
      setNewClassName('');
      await refreshClasses();
      setSelectedId(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '开班失败');
    } finally {
      setBusy(false);
    }
  };
  const updateStatus = async (status: TeacherClass['status']) => {
    if (!selectedClass) return;
    setBusy(true);
    setError('');
    try {
      const updated = await teacherApi.updateStatus(selectedClass.id, status);
      setClasses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await refreshSelected(updated.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '班级状态更新失败');
    } finally {
      setBusy(false);
    }
  };
  const deleteSelectedClass = async () => {
    if (
      !selectedClass ||
      !window.confirm(
        `确定删除“${selectedClass.name}”吗？这会删除该班级的身份、首局、重玩、报告和反思，且不可恢复。`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await teacherApi.deleteClass(selectedClass.id);
      setStudents([]);
      setAnalytics(undefined);
      setSelectedStudentId('');
      await refreshClasses();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '班级删除失败');
    } finally {
      setBusy(false);
    }
  };
  const generateCase = async () => {
    if (!selectedClass) return;
    setBusy(true);
    setError('');
    try {
      setCaseCard(await teacherApi.createCase(selectedClass.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂无可用案例');
    } finally {
      setBusy(false);
    }
  };
  const download = async (kind: 'progress' | 'decisions' | 'states' | 'reports') => {
    if (!selectedClass) return;
    try {
      const url = URL.createObjectURL(await teacherApi.downloadCsv(selectedClass.id, kind));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `laojie-${kind}-${selectedClass.code}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出失败');
    }
  };
  const logout = async () => {
    await teacherApi.logout().catch(() => undefined);
    setAuthenticated(false);
  };

  return (
    <main className="teacher-shell">
      <header className="teacher-header">
        <div>
          <p className="eyebrow">老街品牌局 · 教师后台</p>
          <h1>课程观察台</h1>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            void logout();
          }}
        >
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
          <div className="section-heading">
            <h2>班级</h2>
            <span>{classes.length} 个</span>
          </div>
          <form className="teacher-create" onSubmit={createClass}>
            <input
              required
              value={newClassName}
              onChange={(event) => setNewClassName(event.target.value)}
              placeholder="例如 2026 春季"
              aria-label="新班级名称"
            />
            <button className="primary-button" type="submit" disabled={busy}>
              开班
            </button>
          </form>
          {classes.map((item) => (
            <button
              className={`class-item ${item.id === selectedId ? 'selected' : ''}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <strong>{item.name}</strong>
              <span>
                {item.code} ·{' '}
                {item.status === 'active'
                  ? '进行中'
                  : item.status === 'closed'
                    ? '已关闭'
                    : '已归档'}
              </span>
            </button>
          ))}
        </aside>
        <section className="teacher-main">
          {selectedClass ? (
            <>
              <div className="teacher-title-row">
                <div>
                  <p className="chapter-label">当前班级</p>
                  <h2>{selectedClass.name}</h2>
                  <p className="muted">
                    班级码 <strong>{selectedClass.code}</strong> · 内容{' '}
                    {selectedClass.contentVersion} · 不展示种子
                  </p>
                </div>
                <div className="teacher-actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      void updateStatus('closed');
                    }}
                  >
                    关闭班级
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      void updateStatus('archived');
                    }}
                  >
                    归档
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      void refreshSelected();
                    }}
                  >
                    刷新
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      void deleteSelectedClass();
                    }}
                  >
                    删除整班
                  </button>
                </div>
              </div>
              {analytics && <AnalyticsPanel analytics={analytics} />}
              <section className="teacher-card">
                <div className="section-heading">
                  <div>
                    <p className="chapter-label">匿名课堂案例</p>
                    <h2>找一条值得讨论的路径</h2>
                  </div>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => {
                      void generateCase();
                    }}
                  >
                    生成匿名案例
                  </button>
                </div>
                {caseCard && (
                  <div className="case-card">
                    <strong>{caseCard.title}</strong>
                    <p>{caseCard.summary}</p>
                    <p>
                      <b>讨论提示：</b>
                      {caseCard.discussionPrompt}
                    </p>
                    <small>
                      临时只读编号：{caseCard.caseId} · 有效至{' '}
                      {new Date(caseCard.expiresAt).toLocaleString()}
                    </small>
                    <p>
                      <a href={`/case/${caseCard.caseId}`} target="_blank" rel="noreferrer">
                        打开匿名投影页
                      </a>
                    </p>
                    <div className="case-path">
                      {caseCard.path.map((item) => (
                        <span key={item.roundId}>
                          {item.roundId} · {item.choiceId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <section className="teacher-card">
                <div className="section-heading">
                  <div>
                    <p className="chapter-label">数据导出</p>
                    <h2>下载课程记录</h2>
                  </div>
                  <span>UTF-8 BOM · 公式注入防护</span>
                </div>
                <div className="export-buttons">
                  {(['progress', 'decisions', 'states', 'reports'] as const).map((kind) => (
                    <button
                      className="secondary-button"
                      key={kind}
                      onClick={() => {
                        void download(kind);
                      }}
                    >
                      {kind}.csv
                    </button>
                  ))}
                </div>
              </section>
              <section className="teacher-card">
                <p className="chapter-label">实名仅教师可见</p>
                <h2>学生决策时间线</h2>
                <label className="student-filter">
                  筛选学生
                  <input
                    value={studentFilter}
                    onChange={(event) => setStudentFilter(event.target.value)}
                    placeholder="输入学号或姓名"
                  />
                </label>
                <p className="muted">
                  显示 {visibleStudents.length} / {filteredStudents.length} 名学生 · 第{' '}
                  {safeStudentPage + 1} / {studentPageCount} 页
                </p>
                <div className="student-list">
                  {visibleStudents.map((student) => (
                    <button
                      className={`student-item ${student.identity.id === selectedStudentId ? 'selected' : ''}`}
                      key={student.identity.id}
                      onClick={() => {
                        void inspectStudent(student.identity.id);
                      }}
                    >
                      <strong>
                        {student.identity.studentNumber} · {student.identity.displayName}
                      </strong>
                      <span>
                        {student.playthroughs.filter(
                          (item) => item.kind === 'first_run' && item.status === 'completed',
                        ).length
                          ? '首局已完成'
                          : '进行中'}{' '}
                        · {student.playthroughs.length} 次记录
                      </span>
                    </button>
                  ))}
                </div>
                <div className="pagination" aria-label="学生分页">
                  <button
                    className="secondary-button"
                    disabled={safeStudentPage === 0}
                    onClick={() => setStudentPage((page) => Math.max(0, page - 1))}
                  >
                    上一页
                  </button>
                  <button
                    className="secondary-button"
                    disabled={safeStudentPage >= studentPageCount - 1}
                    onClick={() =>
                      setStudentPage((page) => Math.min(studentPageCount - 1, page + 1))
                    }
                  >
                    下一页
                  </button>
                </div>
                {selectedStudent && <StudentTimeline student={selectedStudent} />}
              </section>
            </>
          ) : (
            <div className="teacher-card">
              <h2>请先创建或选择班级</h2>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export function CaseScreen({ caseId }: { caseId: string }) {
  const [caseCard, setCaseCard] = useState<AnonymousCase>();
  const [error, setError] = useState('');
  useEffect(() => {
    void teacherApi
      .getCase(caseId)
      .then(setCaseCard)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '案例不存在或已过期'));
  }, [caseId]);
  if (error)
    return (
      <main className="shell">
        <section className="hero-card">
          <p className="eyebrow">老街品牌局 · 课堂案例</p>
          <h1>案例已关闭</h1>
          <p className="lead">这个匿名案例链接已经过期或被清理。</p>
        </section>
      </main>
    );
  if (!caseCard)
    return (
      <main className="shell">
        <section className="hero-card">
          <p className="eyebrow">老街品牌局 · 课堂案例</p>
          <h1>正在打开</h1>
          <p className="lead">正在读取匿名路径…</p>
        </section>
      </main>
    );
  return (
    <main className="case-screen">
      <section className="case-card case-card-large">
        <p className="eyebrow">老街品牌局 · 匿名课堂案例</p>
        <h1>{caseCard.title}</h1>
        <p className="lead">{caseCard.summary}</p>
        <div className="case-metrics">
          {Object.entries(caseCard.finalMetrics).map(([key, value]) => (
            <span key={key}>
              <small>{key}</small>
              <strong>{value}</strong>
            </span>
          ))}
        </div>
        <h2>路径</h2>
        <div className="case-path">
          {caseCard.path.map((item) => (
            <span key={item.roundId}>
              {item.roundId} · {item.choiceId}
            </span>
          ))}
        </div>
        <div className="discussion-prompt">
          <strong>讨论提示</strong>
          <p>{caseCard.discussionPrompt}</p>
        </div>
      </section>
    </main>
  );
}

function AnalyticsPanel({ analytics }: { analytics: TeacherAnalytics }) {
  const progress = analytics.progress;
  const percentages = useMemo(
    () =>
      Object.entries(analytics.endingDistribution).map(
        ([key, value]) => `${key}: ${value}/${analytics.scope.denominator || 0}`,
      ),
    [analytics],
  );
  return (
    <section className="teacher-card">
      <div className="section-heading">
        <div>
          <p className="chapter-label">班级聚合 · 首局</p>
          <h2>这群人如何做决定</h2>
        </div>
        <span>分母：{analytics.scope.denominator} 局，重玩已排除</span>
      </div>
      <div className="teacher-stats">
        <div>
          <span>学生</span>
          <strong>{progress.totalStudents}</strong>
        </div>
        <div>
          <span>已开始</span>
          <strong>{progress.started}</strong>
        </div>
        <div>
          <span>进行中</span>
          <strong>{progress.inProgress}</strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>{progress.completed}</strong>
        </div>
        <div>
          <span>完成率</span>
          <strong>{Math.round(progress.completionRate * 100)}%</strong>
        </div>
        <div>
          <span>进入率</span>
          <strong>{Math.round(progress.successfulEntryRate * 100)}%</strong>
        </div>
        <div>
          <span>退出率</span>
          <strong>{Math.round(progress.exitRate * 100)}%</strong>
        </div>
        <div>
          <span>完成中位时长</span>
          <strong>{progress.medianDurationSeconds}s</strong>
        </div>
        <div>
          <span>报告打开</span>
          <strong>{Math.round(analytics.engagement.reportOpenRate * 100)}%</strong>
        </div>
        <div>
          <span>重玩率</span>
          <strong>{Math.round(analytics.engagement.replayRate * 100)}%</strong>
        </div>
        <div>
          <span>预测记录</span>
          <strong>{analytics.predictionCount}</strong>
        </div>
        <div>
          <span>视觉修订</span>
          <strong>{analytics.visualRevisionCount}</strong>
        </div>
      </div>
      <div className="distribution-grid">
        <div>
          <h3>结局分布</h3>
          {percentages.length ? (
            percentages.map((item) => <p key={item}>{item}</p>)
          ) : (
            <p className="muted">尚无完成首局</p>
          )}
        </div>
        <div>
          <h3>视觉方案使用</h3>
          {Object.entries(analytics.visualDistribution).map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))}
          {!Object.keys(analytics.visualDistribution).length && (
            <p className="muted">尚无视觉记录</p>
          )}
          <h3>视觉测试</h3>
          {Object.entries(analytics.visualTestDistribution).map(([key, value]) => (
            <p key={key}>
              {key}: {value.passed}/{value.total} 通过
            </p>
          ))}
        </div>
        <div>
          <h3>每轮完成</h3>
          {Object.entries(analytics.roundProgress)
            .slice(-6)
            .map(([key, value]) => (
              <p key={key}>
                {key}: {value}/{analytics.scope.denominator}
              </p>
            ))}
          <h3>报告与重玩</h3>
          <p>已打开报告：{analytics.engagement.reportsOpened}</p>
          <p>策略发生变化：{analytics.engagement.replayStrategyChanges}</p>
        </div>
        <div>
          <h3>高频路径</h3>
          {analytics.topPaths.slice(0, 3).map((item) => (
            <p key={item.path}>
              {item.count} 局 · {item.path}
            </p>
          ))}
          {!analytics.topPaths.length && <p className="muted">尚无路径</p>}
          <h3>视觉后续影响</h3>
          {Object.entries(analytics.visualSystemImpact).map(([key, value]) => (
            <p key={key}>
              {key}：识别 {Math.round(value.averageVisualRecognition)} · 文化{' '}
              {Math.round(value.averageCulturalCredibility)} · 适配{' '}
              {Math.round(value.averageVisualAdaptability)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function StudentTimeline({ student }: { student: TeacherStudent }) {
  return (
    <div className="timeline">
      {student.playthroughs.map((playthrough) => (
        <article className="timeline-run" key={playthrough.id}>
          <div className="section-heading">
            <div>
              <h3>
                {playthrough.kind === 'first_run' ? '首局' : '独立重玩'} ·{' '}
                {playthrough.status === 'completed' ? '已完成' : '进行中'}
              </h3>
              <small>
                {playthrough.startedAt} · {playthrough.roundIndex} 回合
              </small>
            </div>
            <span>{playthrough.state.endingId ?? '尚无结局'}</span>
          </div>
          {playthrough.logs.map((log) => (
            <div className="timeline-entry" key={`${playthrough.id}-${log.sequenceNo}`}>
              <strong>
                {log.sequenceNo}. {log.action.roundId} · {log.action.type}
              </strong>
              <span>{JSON.stringify(log.action.payload)}</span>
              <p>{log.trace.explanation}</p>
              {log.trace.events.map((event) => (
                <small key={event.eventId}>
                  事件：{event.title} ·{' '}
                  {event.effects
                    .map(
                      (effect) => `${effect.label}${effect.amount > 0 ? '+' : ''}${effect.amount}`,
                    )
                    .join('、')}
                </small>
              ))}
              {(log.trace.scheduledDelayedEffects?.length ?? 0) > 0 && (
                <small>
                  先记在账上：
                  {log.trace.scheduledDelayedEffects
                    ?.map(
                      (effect) => `${effect.label}${effect.amount > 0 ? '+' : ''}${effect.amount}`,
                    )
                    .join('、')}
                </small>
              )}
              {(log.trace.settledDelayedEffects?.length ?? 0) > 0 && (
                <small>
                  之后结算：
                  {log.trace.settledDelayedEffects
                    ?.map(
                      (effect) => `${effect.label}${effect.amount > 0 ? '+' : ''}${effect.amount}`,
                    )
                    .join('、')}
                </small>
              )}
              {log.trace.visualTest && (
                <small>
                  视觉测试：{log.trace.visualTest.testId} ·{' '}
                  {log.trace.visualTest.passed ? '通过' : '暴露问题'}（{log.trace.visualTest.score}
                  ）
                </small>
              )}
              <small>
                状态：现金 {log.trace.before.cash} → {log.trace.after.cash} · 信任{' '}
                {log.trace.before.trust} → {log.trace.after.trust} · 理论{' '}
                {log.trace.theoryIds.join('、') || '无'}
              </small>
            </div>
          ))}
          {playthrough.report && (
            <div className="timeline-report">
              <strong>报告：{playthrough.report.endingId ?? '未命名结局'}</strong>
              <p>{playthrough.report.maximumConsistency}</p>
              <p>{playthrough.report.maximumContradiction}</p>
              <p>{playthrough.report.counterfactual}</p>
            </div>
          )}
          {playthrough.reflection && (
            <div className="timeline-reflection">
              <strong>反思（第 {playthrough.reflection.revision} 次）</strong>
              <p>{playthrough.reflection.text}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
