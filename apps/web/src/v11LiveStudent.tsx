import { useEffect, useState } from 'react';
import { validateV11Content, type GameContentV11 } from '@laojie/content-schema';
import { hashV11Content } from '@laojie/game-engine';
import { V11StudentApp } from './v11App.js';
import { createV11RemoteFlow, type V11RemoteStudentFlow } from './v11RemoteStudentFlow.js';
import { FetchV11RemoteStudentApi, type V11RemoteContentApi } from './v11RemoteStudentApi.js';

const api = new FetchV11RemoteStudentApi();
const sessionKey = 'laojie.v11.live.student-session';

interface LiveSession {
  token: string;
  playthroughId: string;
  seed: string;
  firstRunId?: string;
}

interface LiveFlow {
  flow: V11RemoteStudentFlow;
  content: GameContentV11;
}

interface RemoteContentIdentity {
  contentVersion: string;
  contentChecksum: string;
}

export function V11LiveStudentApp({ content }: { content: GameContentV11 }) {
  const [liveFlow, setLiveFlow] = useState<LiveFlow | null>(null);
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
        const matchedContent = await resolveRemoteContent(content, response.playthrough, api);
        const next = createV11RemoteFlow(
          session.token,
          session.seed,
          matchedContent,
          api,
          response.playthrough,
        );
        await next.flushPending();
        await next.loadReport();
        setLiveFlow({ flow: next, content: matchedContent });
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
  if (liveFlow) {
    const replay = sessionReplay(liveFlow.content, liveFlow.flow, setLiveFlow);
    return (
      <V11StudentApp
        content={liveFlow.content}
        flow={liveFlow.flow}
        {...(replay ? { onReplay: replay } : {})}
      />
    );
  }
  return <V11LiveJoinScreen content={content} onJoined={setLiveFlow} initialError={restoreError} />;
}

function sessionReplay(
  content: GameContentV11,
  flow: V11RemoteStudentFlow,
  setLiveFlow: (liveFlow: LiveFlow) => void,
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
    const matchedContent = await resolveRemoteContent(
      content,
      {
        contentVersion: response.playthrough.contentVersion,
        contentChecksum:
          response.playthrough.contentChecksum || response.offlineContext.contentChecksum,
      },
      api,
    );
    const next = createV11RemoteFlow(
      session.token,
      response.offlineContext.playthroughSeed,
      matchedContent,
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
    setLiveFlow({ flow: next, content: matchedContent });
  };
}

function V11LiveJoinScreen({
  content,
  onJoined,
  initialError = '',
}: {
  content: GameContentV11;
  onJoined: (liveFlow: LiveFlow) => void;
  initialError?: string;
}) {
  const [classCode, setClassCode] = useState('');
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
      const matchedContent = await resolveRemoteContent(
        content,
        {
          contentVersion: response.contentVersion,
          contentChecksum:
            response.playthrough.contentChecksum || response.offlineContext.contentChecksum,
        },
        api,
      );
      const flow = createV11RemoteFlow(
        response.token,
        response.offlineContext.playthroughSeed,
        matchedContent,
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
      onJoined({ flow, content: matchedContent });
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
          每一步都会保存到这局经营进度。刷新页面后，你可以从上次停下的地方继续。
        </p>
        <form className="join-form" onSubmit={join}>
          <label>
            班级码
            <input
              required
              value={classCode}
              onChange={(event) => setClassCode(event.target.value.toUpperCase())}
              placeholder="请输入教师提供的班级码"
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

export async function resolveRemoteContent(
  currentContent: GameContentV11,
  remote: RemoteContentIdentity,
  remoteApi: V11RemoteContentApi,
): Promise<GameContentV11> {
  const localChecksum = hashV11Content(currentContent);
  if (
    remote.contentVersion === currentContent.contentVersion &&
    remote.contentChecksum === localChecksum
  )
    return currentContent;

  const fetched = await remoteApi.content(remote.contentVersion);
  const { contentChecksum, ...rawContent } = fetched;
  const resolved = validateV11Content(rawContent);
  if (
    resolved.contentVersion !== remote.contentVersion ||
    contentChecksum !== remote.contentChecksum ||
    hashV11Content(resolved) !== contentChecksum
  )
    throw new Error('本节课的游戏资料暂时无法核验，请稍后再试或联系任课教师。');
  return resolved;
}
