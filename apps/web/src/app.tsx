import { useEffect, useMemo, useState } from 'react';
import { v11FullContent, v11SliceContent } from '@laojie/content-schema';
import { fullContent } from '@laojie/content-schema/full';
import { buildReport } from '@laojie/report-engine';
import { FetchStudentApi } from './api.js';
import { createBrowserOutbox } from './offline/outbox.js';
import { StudentFlow } from './studentFlow.js';
import { CaseScreen, TeacherScreen } from './teacher.js';
import { V11StudentApp } from './v11App.js';
import { V11LiveStudentApp } from './v11LiveStudent.js';
import { V11CaseScreen, V11TeacherScreen } from './v11Teacher.js';

const api = new FetchStudentApi();
const outbox = createBrowserOutbox();

const resourceMetrics = [
  ['cash', '现金'],
  ['actionPoints', '行动力'],
] as const;

const marketMetrics = [
  ['awareness', '知名度'],
  ['conversion', '转化'],
  ['trust', '信任'],
  ['loyalty', '忠诚'],
] as const;

const stakeholdersByChapter: Record<string, string[]> = {
  c1: ['ch-founder', 'ch-barista'],
  c2: ['ch-designer', 'ch-illustrator', 'ch-regular'],
  c3: ['ch-supplier', 'ch-photographer'],
  c4: ['ch-landlord', 'ch-platform'],
};

const chapterTitles: Record<string, { title: string; subtitle: string }> = {
  c1: { title: '找对问题', subtitle: '先理解人，再决定做什么' },
  c2: { title: '让定位被看见', subtitle: '产品、价格和视觉要说同一种话' },
  c3: { title: '品牌离开门店', subtitle: '包装和关系会把品牌带到别处' },
  c4: { title: '把品牌交给明天', subtitle: '增长之后，系统能不能继续工作' },
};

function effectCopy(
  amount: number | undefined,
  positive: string,
  negative: string,
  neutral = '不直接改变',
): string {
  if (!amount) return neutral;
  return `${amount > 0 ? '+' : ''}${amount} ${amount > 0 ? positive : negative}`;
}

function choiceResourcePreview(choice: (typeof fullContent.rounds)[number]['choices'][number]) {
  const cash = choice.effects
    .filter((effect) => effect.key === 'cash' && effect.timing === 'immediate')
    .reduce((total, effect) => total + effect.amount, 0);
  const actionPoints = choice.effects
    .filter((effect) => effect.key === 'actionPoints' && effect.timing === 'immediate')
    .reduce((total, effect) => total + effect.amount, 0);
  return {
    cash: effectCopy(cash, '现金', '现金'),
    actionPoints: effectCopy(actionPoints, '行动力', '行动力'),
  };
}

export function App() {
  useEffect(() => {
    document.documentElement.dataset.laojieMounted = 'true';
  }, []);
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/teacher'))
    return <TeacherScreen />;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v11-teacher'))
    return <V11TeacherScreen />;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v11-case/'))
    return <V11CaseScreen caseId={window.location.pathname.split('/')[2] ?? ''} />;
  if (
    typeof window !== 'undefined' &&
    (window.location.pathname === '/v11' || window.location.pathname.startsWith('/v11-live'))
  )
    return <V11LiveStudentApp content={v11FullContent} />;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/case/'))
    return <CaseScreen caseId={window.location.pathname.split('/')[2] ?? ''} />;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v11-full'))
    return <V11StudentApp content={v11FullContent} />;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/v11-slice'))
    return <V11StudentApp content={v11SliceContent} />;
  return <StudentApp />;
}

function StudentApp() {
  const [flow, setFlow] = useState<StudentFlow | null>(() => {
    const encoded =
      typeof localStorage === 'undefined'
        ? undefined
        : localStorage.getItem('laojie.student.session');
    if (!encoded) return null;
    try {
      const session = JSON.parse(encoded) as {
        token: string;
        playthroughId: string;
        seed: string;
        kind?: 'first_run' | 'replay';
      };
      return (
        StudentFlow.restore(
          api,
          outbox,
          session.token,
          session.playthroughId,
          session.seed,
          undefined,
          session.kind === 'replay' ? 'replay' : 'first_run',
        ) ?? null
      );
    } catch {
      return null;
    }
  });
  const [version, setVersion] = useState(0);
  if (!flow)
    return (
      <JoinScreen
        onJoined={(next) => {
          setFlow(next);
          setVersion((value) => value + 1);
        }}
      />
    );
  return (
    <GameScreen
      flow={flow}
      version={version}
      onChange={() => setVersion((value) => value + 1)}
      onReplaceFlow={(next) => {
        setFlow(next);
        localStorage.setItem(
          'laojie.student.session',
          JSON.stringify({
            token: next.token,
            playthroughId: next.playthroughId,
            seed: next.seed,
            kind: next.kind,
          }),
        );
      }}
    />
  );
}

function JoinScreen({ onJoined }: { onJoined: (flow: StudentFlow) => void }) {
  const [classCode, setClassCode] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.join(classCode, studentNumber, name);
      const next = new StudentFlow(
        api,
        outbox,
        result.token,
        result.playthrough.id,
        result.offlineContext.playthroughSeed,
      );
      localStorage.setItem(
        'laojie.student.session',
        JSON.stringify({
          token: result.token,
          playthroughId: result.playthrough.id,
          seed: result.offlineContext.playthroughSeed,
          kind: next.kind,
        }),
      );
      onJoined(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加入失败，请检查班级码。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="shell">
      <section className="hero-card join-card" aria-labelledby="title">
        <p className="eyebrow">屯溪老街 · 品牌经营体验</p>
        <h1 id="title">老街品牌局</h1>
        <p className="lead">从一间还没开张的茶饮店开始，做出一套能被人记住、也能真正交付的品牌。</p>
        <form className="join-form" onSubmit={join}>
          <label>
            班级码
            <input
              required
              value={classCode}
              onChange={(event) => setClassCode(event.target.value.toUpperCase())}
              placeholder="例如 A1B2C3"
              autoComplete="off"
            />
          </label>
          <label>
            学号
            <input
              required
              value={studentNumber}
              onChange={(event) => setStudentNumber(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            姓名
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '正在加入…' : '进入品牌局'}
          </button>
        </form>
        <p className="privacy-note">
          你的决策过程会被保存用于课后报告；课堂投影默认匿名。首局完成后不能重置，之后可以单独重玩。
        </p>
      </section>
    </main>
  );
}

function GameScreen({
  flow,
  version,
  onChange,
  onReplaceFlow,
}: {
  flow: StudentFlow;
  version: number;
  onChange: () => void;
  onReplaceFlow: (flow: StudentFlow) => void;
}) {
  void version;
  const [pendingChoice, setPendingChoice] = useState<string>();
  const [intent, setIntent] = useState('');
  const [risk, setRisk] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const round = fullContent.rounds[flow.state.roundIndex];
  const report = useMemo(
    () => flow.report ?? (flow.state.endingId ? buildReport(flow.state, fullContent) : undefined),
    [flow, version],
  );
  useEffect(() => {
    const markOnline = () => {
      setOnline(true);
      void flow.sync().then(onChange);
    };
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);
  const dispatch = async (
    type: Parameters<StudentFlow['dispatch']>[0],
    roundId: string,
    payload: Parameters<StudentFlow['dispatch']>[2],
  ) => {
    try {
      setError('');
      const pending = flow.dispatch(type, roundId, payload);
      onChange();
      await pending;
      if (flow.syncError || flow.report) onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '这个动作暂时不能执行');
    }
  };
  if (!round || report)
    return (
      <ReportScreen flow={flow} report={report} onChange={onChange} onReplaceFlow={onReplaceFlow} />
    );
  const selectedChoice = round.choices.find((choice) => choice.choiceId === pendingChoice);
  const previousRound = fullContent.rounds[flow.state.roundIndex - 1];
  const chapter = chapterTitles[round.chapterId] ?? {
    title: '经营现场',
    subtitle: '一步一步把品牌做出来',
  };
  const chapterChanged = Boolean(previousRound && previousRound.chapterId !== round.chapterId);
  const previousChoice = chapterChanged
    ? [...flow.state.decisions]
        .reverse()
        .find(
          (decision) =>
            decision.type === 'choice_selected' && decision.roundId === previousRound?.roundId,
        )
    : undefined;
  const previousChoiceId = previousChoice?.payload.choiceId;
  const previousChoiceLabel = previousRound?.choices.find(
    (choice) => choice.choiceId === previousChoiceId,
  )?.label;
  const latestTrace = flow.state.traces[flow.state.traces.length - 1];
  const stakeholders = (stakeholdersByChapter[round.chapterId] ?? [])
    .map((characterId) =>
      fullContent.characters.find((character) => character.characterId === characterId),
    )
    .filter((character): character is (typeof fullContent.characters)[number] =>
      Boolean(character),
    );
  const syncLabel = flow.syncError
    ? '本机已保存 · 等待处理'
    : !online
      ? '网络断开 · 本机继续'
      : flow.serverView
        ? '已同步'
        : '已保存到本机';
  const confirmDecision = async () => {
    if (!selectedChoice) return;
    setBusy(true);
    try {
      await dispatch('intent_selected', round.roundId, { intent });
      await dispatch('risk_selected', round.roundId, { risk });
      await dispatch('choice_selected', round.roundId, { choiceId: selectedChoice.choiceId });
      setPendingChoice(undefined);
      setIntent('');
      setRisk('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <span className="chapter-label">
            {chapter.title} · {chapter.subtitle}
          </span>
          <span className="eyebrow">
            第 {flow.state.roundIndex + 1} / {fullContent.rounds.length} 回合
          </span>
          <h1>{round.title}</h1>
        </div>
        <div className="sync-status" aria-live="polite" data-online={online}>
          {syncLabel}
        </div>
      </header>
      <section className="metrics-groups" aria-label="经营指标">
        <div className="metric-group">
          <div className="metric-group-heading">
            <strong>你的资源</strong>
            <span>现在能做多少事</span>
          </div>
          <div className="metrics">
            {resourceMetrics.map(([key, label]) => (
              <div className="metric" key={key}>
                <span>{label}</span>
                <strong>{flow.state.metrics[key]}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="metric-group">
          <div className="metric-group-heading">
            <strong>顾客与市场信号</strong>
            <span>别人如何回应你的品牌</span>
          </div>
          <div className="metrics market-metrics">
            {marketMetrics.map(([key, label]) => (
              <div className="metric" key={key}>
                <span>{label}</span>
                <strong>{flow.state.metrics[key]}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      {flow.state.lastFeedback.length > 0 && (
        <aside className="feedback" aria-live="polite" aria-atomic="true">
          <div className="feedback-heading">
            <strong>经营反馈</strong>
            <span>这不是答案，是你刚刚选择留下的痕迹</span>
          </div>
          {flow.state.lastFeedback.map((item, index) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
          {latestTrace && (
            <div className="feedback-lanes">
              <div>
                <span>现在发生</span>
                <p>
                  {latestTrace.immediateEffects.map((effect) => effect.label).join('；') ||
                    '暂时没有明显变化'}
                </p>
              </div>
              <div>
                <span>先记在账上</span>
                <p>
                  {latestTrace.scheduledDelayedEffects.map((effect) => effect.label).join('；') ||
                    '这一步没有埋下延迟影响'}
                </p>
              </div>
              {latestTrace.settledDelayedEffects.length > 0 && (
                <div>
                  <span>今天结算</span>
                  <p>
                    {latestTrace.settledDelayedEffects.map((effect) => effect.label).join('；')}
                  </p>
                </div>
              )}
            </div>
          )}
        </aside>
      )}
      <section className="story-card">
        <div className="chapter-banner">
          <span>第 {round.chapterId.slice(1)} 章</span>
          <strong>{chapter.title}</strong>
          <small>{chapter.subtitle}</small>
        </div>
        {chapterChanged && (
          <details className="chapter-review" open>
            <summary>回看上一章：你的赌注已经带进来了</summary>
            <p>
              {previousChoiceLabel
                ? `上一章你选择了“${previousChoiceLabel}”。接下来看看，这个方向如何在新的触点和关系里继续产生影响。`
                : '上一章的选择已经进入现在的经营现场。接下来看看，它如何在新的触点和关系里继续产生影响。'}
            </p>
          </details>
        )}
        <div className="goal-heading">
          <div className="goal-icon" aria-hidden="true">
            {String(flow.state.roundIndex + 1).padStart(2, '0')}
          </div>
          <div>
            <p className="chapter-label">本轮目标</p>
            <h2>{round.goal}</h2>
          </div>
        </div>
        <p className="story-text">{round.openingScene}</p>
        {flow.state.decisions.length === 0 && (
          <div className="how-to-win">
            <strong>这局怎么赢？</strong>
            <p>
              没有一个固定的“赚到多少就通关”。你要让承诺、视觉、产品和团队能够彼此配合；最后的结局会根据整局路径、现金压力、信任和交付能力共同决定。
            </p>
          </div>
        )}
        {stakeholders.length > 0 && (
          <div className="stakeholder-dialogue" aria-label="利益相关者现场对话">
            <span className="dialogue-label">现场有人这样说</span>
            {stakeholders.map((character) => (
              <p key={character.characterId}>
                <strong>{character.name}</strong>：{character.agenda}
              </p>
            ))}
          </div>
        )}
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="evidence-card" aria-labelledby="evidence-title">
        <div className="section-heading">
          <div>
            <p className="chapter-label">可选信息</p>
            <h2 id="evidence-title">先看一眼现场</h2>
          </div>
          <span>行动力换信息</span>
        </div>
        {round.evidence.map((item) => (
          <button
            className="evidence"
            key={item.evidenceId}
            disabled={busy || flow.state.viewedEvidenceIds.includes(item.evidenceId)}
            onClick={() =>
              void dispatch('evidence_viewed', round.roundId, { evidenceId: item.evidenceId })
            }
          >
            <span>{item.title}</span>
            <small>
              {flow.state.viewedEvidenceIds.includes(item.evidenceId)
                ? item.body
                : `查看（-${item.cost} 行动力）`}
            </small>
          </button>
        ))}
      </section>
      {round.visualRequired && (
        <VisualPanel flow={flow} roundId={round.roundId} onDispatch={dispatch} />
      )}
      <section className="choice-grid" aria-labelledby="choice-title">
        <div className="section-heading">
          <div>
            <p className="chapter-label">战略选择</p>
            <h2 id="choice-title">你现在更愿意押注什么？</h2>
          </div>
          <span>没有标准答案</span>
        </div>
        {round.choices.map((choice) => (
          <button
            className={`choice ${pendingChoice === choice.choiceId ? 'selected' : ''}`}
            key={choice.choiceId}
            disabled={busy || (round.visualRequired && !flow.state.selectedVisualId)}
            onClick={() => {
              setPendingChoice(choice.choiceId);
              void dispatch('choice_previewed', round.roundId, { choiceId: choice.choiceId });
            }}
          >
            <strong>{choice.label}</strong>
            <span>{choice.temptation}</span>
            <small>选中后查看收益、代价与行动力占用</small>
          </button>
        ))}
      </section>
      {selectedChoice && (
        <section className="confirm-card" aria-labelledby="confirm-title">
          <p className="chapter-label">确认之前</p>
          <h2 id="confirm-title">你希望它带来什么？又最担心什么？</h2>
          <div className="choice-detail">
            <strong>{selectedChoice.label}</strong>
            <p>{selectedChoice.statedBenefit}</p>
            <p>需要留意：{selectedChoice.statedConcern}</p>
            <div className="choice-resources">
              <span>现金：{choiceResourcePreview(selectedChoice).cash}</span>
              <span>行动力：{choiceResourcePreview(selectedChoice).actionPoints}</span>
            </div>
          </div>
          <div className="predict-grid">
            <label>
              最希望获得
              <select
                value={intent}
                onChange={(event) => setIntent(event.target.value)}
                onInput={(event) => setIntent(event.currentTarget.value)}
              >
                <option value="">请选择</option>
                <option value="growth">增长</option>
                <option value="trust">信任</option>
                <option value="recognition">识别</option>
                <option value="stability">稳定交付</option>
              </select>
            </label>
            <label>
              最担心发生
              <select
                value={risk}
                onChange={(event) => setRisk(event.target.value)}
                onInput={(event) => setRisk(event.currentTarget.value)}
              >
                <option value="">请选择</option>
                <option value="trust">信任下降</option>
                <option value="cash">现金压力</option>
                <option value="delivery">交付失控</option>
                <option value="homogenization">同质化</option>
              </select>
            </label>
          </div>
          <button
            className="primary-button"
            disabled={busy || !intent || !risk}
            onClick={() => {
              void confirmDecision();
            }}
          >
            确认这个决定
          </button>
        </section>
      )}
    </main>
  );
}

function VisualPanel({
  flow,
  roundId,
  onDispatch,
}: {
  flow: StudentFlow;
  roundId: string;
  onDispatch: (
    type: Parameters<StudentFlow['dispatch']>[0],
    roundId: string,
    payload: Parameters<StudentFlow['dispatch']>[2],
  ) => Promise<void>;
}) {
  const [revision, setRevision] = useState('');
  const round = fullContent.rounds.find((item) => item.roundId === roundId)!;
  return (
    <section className="visual-panel" aria-labelledby="visual-title">
      <div className="section-heading">
        <div>
          <p className="chapter-label">视觉经营</p>
          <h2 id="visual-title">让品牌离开效果图</h2>
        </div>
        <span>店招 · 杯套 · 包装 · 头像</span>
      </div>
      <div className="visual-grid">
        {fullContent.visualSystems.map((visual) => (
          <button
            className={`visual-card ${flow.state.selectedVisualId === visual.visualId ? 'selected' : ''}`}
            key={visual.visualId}
            onClick={() =>
              void onDispatch('visual_selected', roundId, { visualId: visual.visualId })
            }
          >
            <div className={`visual-mark ${visual.visualId}`} aria-hidden="true">
              茶
            </div>
            <strong>{visual.name}</strong>
            <span>{visual.description}</span>
            <small>
              识别 {visual.attributes.recognitionStrength} · 适配{' '}
              {visual.attributes.touchpointAdaptability}
            </small>
          </button>
        ))}
      </div>
      {flow.state.selectedVisualId && (
        <div className="visual-inspector">
          <div className="visual-touchpoints" aria-label="四个真实品牌触点">
            <span>店招</span>
            <span>杯套</span>
            <span>包装</span>
            <span>头像</span>
          </div>
          <p className="visual-inspector-copy">
            先把方案放进真实触点，再做测试。效果图好看，不代表缩小、并置和生产时仍然好用。
          </p>
          <div className="tests">
            <p className="chapter-label">选择后做测试</p>
            {round.visualTests.map((test) => {
              const result = flow.state.visualTestResults.find(
                (item) => item.testId === test.testId,
              );
              return (
                <button
                  className="test-button"
                  key={test.testId}
                  disabled={Boolean(result)}
                  onClick={() => void onDispatch('visual_tested', roundId, { testId: test.testId })}
                >
                  <span>{test.title}</span>
                  <small>{result ? result.explanation : test.prompt}</small>
                </button>
              );
            })}
          </div>
          {flow.state.visualRevision ? (
            <p className="visual-revision-saved">已使用一次修订权：{flow.state.visualRevision}</p>
          ) : (
            <div className="visual-revision">
              <label>
                只改一次：你会先改哪个真实问题？
                <input
                  value={revision}
                  maxLength={40}
                  onChange={(event) => setRevision(event.target.value)}
                  placeholder="例如：把小尺寸下的字再减一层"
                />
              </label>
              <button
                className="secondary-button"
                disabled={!revision.trim()}
                onClick={() => {
                  void onDispatch('visual_revised', roundId, { revision: revision.trim() });
                  setRevision('');
                }}
              >
                记录这次有限修订
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReportScreen({
  flow,
  report,
  onChange,
  onReplaceFlow,
}: {
  flow: StudentFlow;
  report: ReturnType<typeof buildReport> | undefined;
  onChange: () => void;
  onReplaceFlow: (flow: StudentFlow) => void;
}) {
  const [reflection, setReflection] = useState('');
  const [saved, setSaved] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState('');
  if (!report)
    return (
      <main className="shell">
        <section className="hero-card">
          <h1>等待同步</h1>
          <p className="lead">本局已经在本机完成，联网后会生成正式报告。</p>
          <button
            className="primary-button"
            onClick={() => {
              void flow.sync().then(onChange);
            }}
          >
            尝试同步
          </button>
        </section>
      </main>
    );
  const copySummary = `${report.endingId ?? '你的品牌结果'}\n${report.maximumConsistency}\n${report.maximumContradiction}\n${report.counterfactual}`;
  const replay = async () => {
    setReplaying(true);
    setReplayError('');
    try {
      await flow.sync();
      onReplaceFlow(await flow.startReplay());
    } catch (cause) {
      setReplayError(cause instanceof Error ? cause.message : '重玩暂时不能开始');
    } finally {
      setReplaying(false);
    }
  };
  return (
    <main className="report-shell">
      <a className="skip-link" href="#report-details">
        跳到报告详情
      </a>
      <header className="report-header">
        <p className="eyebrow">
          本局报告 · {flow.serverView?.reportAvailable ? '服务端已确认' : '本机预览'}
        </p>
        <h1>{report.endingId ?? '你的品牌还在路上'}</h1>
        <p>{report.maximumConsistency}</p>
        <div className="report-actions">
          <button
            className="primary-button"
            onClick={() => {
              void navigator.clipboard?.writeText(copySummary);
            }}
          >
            复制匿名课堂摘要
          </button>
          {flow.kind === 'first_run' && (
            <button
              className="secondary-button"
              disabled={replaying}
              onClick={() => {
                void replay();
              }}
            >
              {replaying ? '准备重玩…' : '开始一次独立重玩'}
            </button>
          )}
        </div>
        {replayError && (
          <p className="error" role="alert">
            {replayError}
          </p>
        )}
      </header>
      <section className="report-grid" id="report-details">
        <article>
          <p className="chapter-label">12 回合路径</p>
          <h2>你做过的决定</h2>
          {report.path.map((item) => (
            <div className="report-row" key={item.roundId}>
              <strong>{item.roundId}</strong>
              <span>{item.choiceId ?? '观察/测试'}</span>
              <small>
                {report.expectedVsActual.find((actual) => actual.roundId === item.roundId)?.actual}
              </small>
            </div>
          ))}
        </article>
        <article>
          <p className="chapter-label">因果解释</p>
          <h2>为什么会这样</h2>
          {report.causalExplanations.map((item) => (
            <div className="causal" key={item.decisionId}>
              <strong>
                {item.roundId} · {item.action}
              </strong>
              <p>{item.mechanism}</p>
              <small>
                即时：{item.immediate.join('、') || '无'}
                <br />
                延迟：{item.delayed.join('、') || '无'}
                <br />
                理论：{item.transferPrompt}
              </small>
            </div>
          ))}
        </article>
      </section>
      <section className="report-grid">
        <article>
          <p className="chapter-label">课程概念</p>
          <h2>你解锁了什么</h2>
          {report.unlockedConceptIds.map((id) =>
            (() => {
              const card = fullContent.conceptCards.find((item) => item.conceptId === id);
              const theory = card
                ? fullContent.theories.find((item) => item.theoryId === card.sourceTheoryId)
                : undefined;
              return (
                <div className="report-row" key={id}>
                  <strong>{id}</strong>
                  <span>{card?.title}</span>
                  <small>
                    {card?.explanation}
                    {theory && (
                      <>
                        <br />
                        迁移问题：{theory.transferPrompt}
                      </>
                    )}
                  </small>
                </div>
              );
            })(),
          )}
        </article>
        <article>
          <p className="chapter-label">过程成就</p>
          <h2>你实际经历过的机制</h2>
          {report.earnedAchievementIds.map((id) => (
            <div className="report-row" key={id}>
              <strong>{id}</strong>
              <span>
                {
                  fullContent.achievements.find((achievement) => achievement.achievementId === id)
                    ?.title
                }
              </span>
              <small>
                {
                  fullContent.achievements.find((achievement) => achievement.achievementId === id)
                    ?.description
                }
              </small>
            </div>
          ))}
        </article>
      </section>
      <section className="report-grid">
        <article>
          <p className="chapter-label">视觉诊断</p>
          <h2>好看之外，哪里真正能用</h2>
          {report.visualDiagnosis.map((item) => (
            <div className="report-row" key={item}>
              <span>{item}</span>
            </div>
          ))}
          {report.visualDiagnosis.length === 0 && <p className="muted">本局还没有视觉测试记录。</p>}
        </article>
        <article>
          <p className="chapter-label">利益相关者</p>
          <h2>谁在替品牌解释</h2>
          {report.stakeholderNetwork.map((item) => (
            <div className="report-row" key={item}>
              <span>{item}</span>
            </div>
          ))}
        </article>
      </section>
      <section className="report-card">
        <p className="chapter-label">理论与作业迁移</p>
        <h2>把这局带回你的品牌作业</h2>
        {report.theoryMapping.map((item) => (
          <div className="report-row" key={item.theoryId}>
            <strong>{item.title}</strong>
            <span>{item.explanation}</span>
          </div>
        ))}
        {report.assignmentTransfer.map((item, index) => (
          <p className="transfer-prompt" key={`${item}-${index}`}>
            作业提醒：{item}
          </p>
        ))}
      </section>
      <section className="report-card">
        <p className="chapter-label">反事实</p>
        <h2>如果重来一次</h2>
        <p>{report.counterfactual}</p>
        <label>
          选一个你最想重做的决定，并说说原因
          <textarea
            maxLength={100}
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="例如：我会先确认交付能力，再决定要不要扩大传播。"
          />
        </label>
        <button
          className="primary-button"
          disabled={!reflection.trim() || saved}
          onClick={() => {
            void flow.submitReflection(reflection).then(() => setSaved(true));
          }}
        >
          {saved ? '已提交' : '提交反思'}
        </button>
      </section>
    </main>
  );
}
