import { useEffect, useState } from 'react';
import type { GameContentV11 } from '@laojie/content-schema';
import { hashV11Content } from '@laojie/game-engine';
import { V11StudentApp } from './v11App.js';
import { createV11RemoteFlow, type V11RemoteStudentFlow } from './v11RemoteStudentFlow.js';
import { FetchV11RemoteStudentApi } from './v11RemoteStudentApi.js';

const api = new FetchV11RemoteStudentApi();
const sessionKey = 'laojie.v11.live.student-session';

interface LiveSession {
  token: string;
  playthroughId: string;
  seed: string;
  firstRunId?: string;
}

export function V11LiveStudentApp({ content }: { content: GameContentV11 }) {
  const [flow, setFlow] = useState<V11RemoteStudentFlow | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    const encoded =
      typeof localStorage === 'undefined' ? undefined : localStorage.getItem(sessionKey);
    if (!encoded) {
      setRestoring(false);
      return;
    }
    let session: LiveSession;
    try {
      session = JSON.parse(encoded) as LiveSession;
    } catch {
      localStorage.removeItem(sessionKey);
      setRestoring(false);
      return;
    }
    void api
      .me(session.token, session.playthroughId)
      .then(async (response) => {
        await assertContentMatch(
          content,
          response.playthrough.contentVersion,
          response.playthrough.contentChecksum,
        );
        const next = createV11RemoteFlow(
          session.token,
          session.seed,
          content,
          api,
          response.playthrough,
        );
        await next.flushPending();
        await next.loadReport();
        setFlow(next);
      })
      .catch((cause) =>
        setRestoreError(
          cause instanceof Error ? cause.message : '暂时无法找回经营现场，请稍后重试。',
        ),
      )
      .finally(() => setRestoring(false));
  }, [content]);

  if (restoring)
    return (
      <main className="shell">
        <section className="hero-card">
          <p className="eyebrow">老街品牌局</p>
          <h1>正在找回你的经营现场</h1>
          <p className="lead">请稍候，系统正在核对你的上次进度。</p>
        </section>
      </main>
    );
  if (flow) {
    const replay = sessionReplay(content, flow, setFlow);
    return (
      <V11StudentApp content={content} flow={flow} {...(replay ? { onReplay: replay } : {})} />
    );
  }
  return <V11LiveJoinScreen content={content} onJoined={setFlow} initialError={restoreError} />;
}

function sessionReplay(
  content: GameContentV11,
  flow: V11RemoteStudentFlow,
  setFlow: (flow: V11RemoteStudentFlow) => void,
): (() => Promise<void>) | undefined {
  const encoded =
    typeof localStorage === 'undefined' ? undefined : localStorage.getItem(sessionKey);
  if (!encoded) return undefined;
  let session: LiveSession;
  try {
    session = JSON.parse(encoded) as LiveSession;
  } catch {
    return undefined;
  }
  const firstRunId =
    session.firstRunId ?? (flow.kind === 'first_run' ? flow.playthroughId : undefined);
  if (!firstRunId) return undefined;
  return async () => {
    const response = await api.replay(session.token, firstRunId);
    await assertContentMatch(
      content,
      response.playthrough.contentVersion,
      response.playthrough.contentChecksum || response.offlineContext.contentChecksum,
    );
    const next = createV11RemoteFlow(
      session.token,
      response.offlineContext.playthroughSeed,
      content,
      api,
      response.playthrough,
    );
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        ...session,
        playthroughId: response.playthrough.id,
        seed: response.offlineContext.playthroughSeed,
      } satisfies LiveSession),
    );
    setFlow(next);
  };
}

function V11LiveJoinScreen({
  content,
  onJoined,
  initialError = '',
}: {
  content: GameContentV11;
  onJoined: (flow: V11RemoteStudentFlow) => void;
  initialError?: string;
}) {
  const [classCode, setClassCode] = useState('LAOJIE11');
  const [studentNumber, setStudentNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.join(classCode, studentNumber, name);
      await assertContentMatch(
        content,
        response.contentVersion,
        response.playthrough.contentChecksum || response.offlineContext.contentChecksum,
      );
      const flow = createV11RemoteFlow(
        response.token,
        response.offlineContext.playthroughSeed,
        content,
        api,
        response.playthrough,
      );
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          token: response.token,
          playthroughId: response.playthrough.id,
          seed: response.offlineContext.playthroughSeed,
          firstRunId: response.playthrough.id,
        } satisfies LiveSession),
      );
      onJoined(flow);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加入失败，请检查班级码和输入信息');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="v11-onboarding">
      <section
        className="v11-onboarding-card v11-live-join-card"
        aria-labelledby="v11-live-join-title"
      >
        <p className="v11-kicker">屯溪老街 · 品牌经营体验</p>
        <h1 id="v11-live-join-title">加入老街品牌局</h1>
        <p className="v11-onboarding-body">
          每一步都会记入你的首局经营记录。刷新页面后，你可以从上次停下的地方继续。
        </p>
        <form className="join-form" onSubmit={join}>
          <label>
            班级码
            <input
              required
              value={classCode}
              onChange={(event) => setClassCode(event.target.value.toUpperCase())}
              placeholder="例如 LAOJIE11"
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
          <button className="v11-button primary" type="submit" disabled={busy}>
            {busy ? '正在加入…' : '进入品牌局'}
          </button>
        </form>
        <p className="v11-complete-note">
          姓名和学号只用于教师查看学习过程，不会出现在匿名课堂案例、公开页面或网址中。
        </p>
      </section>
    </main>
  );
}

function assertContentMatch(
  content: GameContentV11,
  remoteVersion: string,
  remoteChecksum: string,
): void {
  const localChecksum = hashV11Content(content);
  if (remoteVersion !== content.contentVersion || remoteChecksum !== localChecksum) {
    throw new Error('游戏资料与经营服务不一致，请刷新页面后重新进入。已保存的经营进度不会被覆盖。');
  }
}
