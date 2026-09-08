import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { GameContentV11, V11Choice, V11Round, V11VisualSystem } from '@laojie/content-schema';
import { V11StudentFlow, type V11Screen, type V11StudentFlowLike } from './v11StudentFlow.js';
import { buildV11Report } from '@laojie/report-engine';
import {
  createBrowserV11SnapshotStorage,
  decodeV11Snapshot,
  encodeV11Snapshot,
} from './v11Persistence.js';
import {
  actionAsset,
  chapterAsset,
  choiceVisualAsset,
  decisionAsset,
  resultSceneAsset,
  sceneAsset,
  touchpointAsset,
  touchpointPlacement,
  V11VisualAdditionalTouchpointIds,
  visualAssetObjectPosition,
  visualAssetPath,
  type V11OutcomeState,
} from './v11VisualAssets.js';
import { V11VisualMark, isCoreVisualRoute } from './v11VisualSystem.js';

const customerMetrics = [
  ['awareness', '知名度'],
  ['conversion', '购买转化'],
  ['trust', '信任'],
  ['loyalty', '复购'],
  ['segmentFit', '人群匹配'],
] as const;

const shopMetrics = [
  ['productDelivery', '交付能力'],
  ['orgCapacity', '组织承接力'],
  ['brandConsistency', '品牌一致性'],
  ['visualRecognition', '视觉识别'],
  ['visualAdaptability', '视觉适配'],
  ['culturalCredibility', '文化可信度'],
  ['channelDependence', '渠道依赖'],
  ['reputationDebt', '声誉负债'],
] as const;

const touchpointLabels: Record<string, string> = {
  storefront: '店招',
  'side-sign': '侧挂招',
  'door-info': '门贴',
  'menu-board': '室内菜单',
  'order-card': '点单卡',
  receipt: '小票',
  cup: '杯身',
  'cup-sleeve': '热饮杯套',
  packaging: '包装',
  avatar: '头像',
  menu: '菜单',
  social: '社交页面',
  'a-frame': '门口 A 字牌',
  'story-wall': '品牌故事墙',
  'pickup-token': '取杯号牌',
  'pickup-shelf-label': '取杯架标签',
  'price-tag': '价格/原料签',
  'tamper-seal': '封口防拆贴',
  'lid-marker': '杯盖口味贴',
  'coaster-napkin': '杯垫与餐巾',
  'tray-mat': '托盘交接垫',
  'double-carrier': '双杯提篮',
  'gift-box': '地方礼盒',
  'refill-pouch': '补充装袋',
  'tea-tin': '茶罐',
  'snack-carrier': '饮品点心组合',
  'apron-patch': '围裙胸前应用',
  'name-badge': '员工名牌',
  'customer-cards': '会员与投稿卡',
  'hotel-supply': '酒店供货',
  'delivery-crates': '配送箱',
  'popup-flag': '快闪桌旗',
  'sleeve-dispenser': '杯套收纳器',
};

const metricLabels: Record<string, string> = {
  awareness: '知名度',
  conversion: '购买转化',
  trust: '信任',
  loyalty: '复购',
  segmentFit: '人群匹配',
  differentiation: '差异化',
  brandConsistency: '品牌一致性',
  promiseCredibility: '承诺可信度',
  productDelivery: '交付能力',
  orgCapacity: '组织承接力',
  culturalCredibility: '文化可信度',
  visualRecognition: '视觉识别',
  visualAdaptability: '视觉适配',
  channelDependence: '渠道依赖',
  reputationDebt: '声誉负债',
};

const ledgerCategoryLabels: Record<string, string> = {
  research_cost: '调查 / 测试',
  strategic_investment: '战略投入或风险准备',
  fixed_cost: '固定经营成本',
  gross_profit: '经营毛利',
  event: '事件收入或损失',
  opening: '开店资金',
};

function formatCash(value: number): string {
  return `¥${value.toLocaleString('zh-CN')}`;
}

const evidenceAngleLabels: Record<string, string> = {
  customer: '顾客在意什么',
  cost: '钱花在哪里',
  competition: '同街店怎么做',
  delivery: '店里接不接得住',
  culture: '地方故事靠什么站住',
  visual: '设计放进真实场景后怎样',
};

function riskOutcomeLabel(status: string): string {
  const labels: Record<string, string> = {
    mitigated: '预案起作用了',
    partially_mitigated: '预案只挡住一部分',
    not_triggered: '预案暂时没有触发',
    missed: '这次没有覆盖风险',
    unexpected: '出现了预案没覆盖的变化',
    not_selected: '这次没有配置预案',
  };
  return labels[status] ?? '风险结果已记录';
}

function hasMeaningfulRiskOutcome(status: string): boolean {
  return ['mitigated', 'partially_mitigated', 'missed', 'unexpected'].includes(status);
}

function ActionSceneThumb({
  label,
  actionId,
  actionType,
}: {
  label: string;
  actionId: string;
  actionType: string;
}) {
  const asset = actionAsset(actionId, actionType);
  return (
    <figure className={`v11-action-scene-thumb ${actionType}`} aria-label={`${label}的现场示意`}>
      {asset && (
        <img
          src={visualAssetPath(asset)}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ objectPosition: visualAssetObjectPosition(asset) }}
        />
      )}
    </figure>
  );
}

function readableSource(flow: V11StudentFlowLike, sourceId: string): string {
  for (const round of flow.content.rounds) {
    const choice = round.choices.find((item) => item.choiceId === sourceId);
    if (choice) return `方案「${choice.label}」`;
    const evidence = round.evidence.find((item) => item.evidenceId === sourceId);
    if (evidence) return `情报「${evidence.title}」`;
    const riskPlan = round.riskPlans.find((item) => item.riskPlanId === sourceId);
    if (riskPlan) return `预案「${riskPlan.label}」`;
  }
  return '本轮经营记录';
}

function readableTheories(flow: V11StudentFlowLike, theoryIds: string[]): string {
  const titles = theoryIds
    .map((theoryId) => flow.content.theories.find((theory) => theory.theoryId === theoryId)?.title)
    .filter((title): title is string => Boolean(title));
  return titles.length > 0 ? titles.join(' · ') : '本轮经营判断';
}

function topScreen(flow: V11StudentFlowLike): V11Screen {
  return flow.snapshot.screenStack.at(-1) ?? { id: 'onboarding' };
}

function useV11Flow(content: GameContentV11): V11StudentFlow {
  const contentKey = content.rounds.length > 4 ? 'full' : 'slice';
  const [flow] = useState(() => {
    const next = new V11StudentFlow('student-ui-demo', 'v11-ui-demo-seed', undefined, content);
    if (typeof localStorage !== 'undefined') {
      const encoded = localStorage.getItem(`laojie.v11.student-ui-demo.${contentKey}`);
      const snapshot = encoded ? decodeV11Snapshot(encoded) : undefined;
      if (snapshot) {
        try {
          next.restoreSnapshot(snapshot);
        } catch {
          localStorage.removeItem(`laojie.v11.student-ui-demo.${contentKey}`);
        }
      }
    }
    return next;
  });
  useEffect(() => {
    const storage = createBrowserV11SnapshotStorage();
    const key = `student-ui-demo:${contentKey}:${flow.playthroughId}`;
    const persist = () => {
      const encoded = encodeV11Snapshot(flow.exportSnapshot());
      if (typeof localStorage !== 'undefined')
        localStorage.setItem(`laojie.v11.${flow.playthroughId}.${contentKey}`, encoded);
      void storage.put(key, encoded).catch(() => undefined);
    };
    const unsubscribe = flow.subscribe(persist);
    const localEncoded =
      typeof localStorage === 'undefined'
        ? undefined
        : localStorage.getItem(`laojie.v11.${flow.playthroughId}.${contentKey}`);
    if (!localEncoded) {
      void storage
        .get(key)
        .then((encoded) => {
          const snapshot = encoded ? decodeV11Snapshot(encoded) : undefined;
          if (!snapshot) return;
          try {
            flow.restoreSnapshot(snapshot);
          } catch {
            /* discard an incompatible local checkpoint */
          }
        })
        .catch(() => undefined);
    }
    return unsubscribe;
  }, [contentKey, flow]);
  return flow;
}

function useFlowAction(): [boolean, (work: () => Promise<void> | void) => Promise<void>] {
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await work();
    } catch {
      // The flow keeps the readable Chinese error in its observable snapshot.
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

function useV11AssetHints(round: V11Round | undefined, nextRound: V11Round | undefined): void {
  useEffect(() => {
    if (!round || typeof document === 'undefined') return undefined;
    const currentHref = sceneAsset(round.briefing.imageKey);
    if (!currentHref) return undefined;
    const current =
      document.querySelector<HTMLLinkElement>('link[data-v11-asset-hint="current"]') ??
      document.createElement('link');
    current.rel = 'preload';
    current.as = 'image';
    current.href = visualAssetPath(currentHref);
    current.dataset.v11AssetHint = 'current';
    if (!current.parentElement) document.head.appendChild(current);
    const nextHref = nextRound ? sceneAsset(nextRound.briefing.imageKey) : undefined;
    if (!nextHref) return () => undefined;
    const timer = window.setTimeout(() => {
      const nextHint =
        document.querySelector<HTMLLinkElement>('link[data-v11-asset-hint="next"]') ??
        document.createElement('link');
      nextHint.rel = 'prefetch';
      nextHint.as = 'image';
      nextHint.href = visualAssetPath(nextHref);
      nextHint.dataset.v11AssetHint = 'next';
      if (!nextHint.parentElement) document.head.appendChild(nextHint);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nextRound?.roundId, round?.roundId]);
}

export function V11StudentApp({
  content,
  flow: providedFlow,
  onReplay,
}: {
  content: GameContentV11;
  flow?: V11StudentFlowLike;
  onReplay?: () => Promise<void>;
}) {
  const flow = useV11Flow(content);
  const activeFlow = providedFlow ?? flow;
  const snapshot = useSyncExternalStore(
    (listener) => activeFlow.subscribe(listener),
    () => activeFlow.snapshot,
    () => activeFlow.snapshot,
  );
  const screen = topScreen(activeFlow);
  const round = activeFlow.content.rounds[activeFlow.state.roundIndex];
  useV11AssetHints(round, activeFlow.content.rounds[activeFlow.state.roundIndex + 1]);
  useEffect(() => {
    const focusTarget = snapshot.focusRequest;
    if (!focusTarget || typeof document === 'undefined') return;
    const target = document.querySelector<HTMLElement>(`[data-v11-focus-target="${focusTarget}"]`);
    if (!target) return;
    target.focus();
    activeFlow.clearFocusRequest();
  }, [activeFlow, screen.id, snapshot.focusRequest]);

  if (screen.id === 'onboarding') return <OnboardingScreen flow={activeFlow} />;
  if (screen.id === 'report') return <ReportScreen flow={activeFlow} />;
  if (screen.id === 'complete')
    return <CompletionScreen flow={activeFlow} {...(onReplay ? { onReplay } : {})} />;

  if (!round)
    return screen.id === 'chapter-review' ? (
      <ChapterReviewScreen flow={activeFlow} />
    ) : (
      <CompletionScreen flow={activeFlow} {...(onReplay ? { onReplay } : {})} />
    );

  return (
    <main className="v11-shell" data-v11-layout-mode="student" data-v11-screen={screen.id}>
      <V11Hud flow={activeFlow} round={round} />
      {snapshot.notice && (
        <div className="v11-toast" role="status" aria-live="polite">
          <span className="v11-toast-dot" aria-hidden="true" />
          {snapshot.notice}
        </div>
      )}
      {snapshot.error && (
        <p className="error v11-error" role="alert">
          {snapshot.error}
        </p>
      )}
      {screen.id === 'dashboard' && <DashboardDrawer flow={activeFlow} />}
      {screen.id === 'briefing' && <BriefingScreen flow={activeFlow} round={round} />}
      {screen.id === 'action-center' && <ActionCenterV14 flow={activeFlow} round={round} />}
      {screen.id === 'visual-compare' && <VisualCompareScreen flow={activeFlow} round={round} />}
      {screen.id === 'choice-detail' && (
        <>
          <ActionCenterV14 flow={activeFlow} round={round} />
          <ChoiceDetailScreen flow={activeFlow} round={round} choiceId={screen.choiceId ?? ''} />
        </>
      )}
      {screen.id === 'round-result' && <RoundResultScreen flow={activeFlow} round={round} />}
      {screen.id === 'chapter-review' && <ChapterReviewScreen flow={activeFlow} />}
    </main>
  );
}

function OnboardingScreen({ flow }: { flow: V11StudentFlowLike }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = flow.content.onboardingSlides;
  const slide = slides[slideIndex] ?? slides[0];
  if (!slide) return null;
  const last = slideIndex === slides.length - 1;
  return (
    <main className="v11-onboarding">
      <div className="v11-onboarding-top">
        <span className="v11-brand-lockup">老街品牌局</span>
        <span>
          序章 {slideIndex + 1} / {slides.length}
        </span>
      </div>
      <section className="v11-onboarding-card" aria-labelledby="v11-onboarding-title">
        <SceneArt imageKey={slide.imageKey} label={slide.title} />
        <p className="v11-kicker">屯溪老街 · 品牌经营体验</p>
        <h1 id="v11-onboarding-title">{slide.title}</h1>
        <p className="v11-onboarding-body">{slide.body}</p>
        {last && (
          <div className="v11-win-rule">
            <strong>赢法不是单项冲分</strong>
            <span>
              最后会一起看四件事：店能不能活下来、顾客会不会买和再来、品牌能不能被记住、店里能不能一直做到答应顾客的事。
            </span>
          </div>
        )}
        <div className="v11-onboarding-actions">
          {slideIndex > 0 && (
            <button
              className="v11-button secondary"
              type="button"
              onClick={() => setSlideIndex((index) => index - 1)}
            >
              返回
            </button>
          )}
          <button
            className="v11-button primary"
            type="button"
            onClick={() => (last ? flow.completeOnboarding() : setSlideIndex((index) => index + 1))}
          >
            {last ? '开始经营' : '继续'}
          </button>
        </div>
      </section>
      <div className="v11-progress" aria-label={`序章进度 ${slideIndex + 1} / ${slides.length}`}>
        {slides.map((item, index) => (
          <span className={index === slideIndex ? 'active' : ''} key={item.slideId} />
        ))}
      </div>
    </main>
  );
}

function V11Hud({ flow, round }: { flow: V11StudentFlowLike; round: V11Round }) {
  const state = flow.state;
  const chapterLabel =
    (
      {
        c1: '第一章 · 找到第一批顾客',
        c2: '第二章 · 产品与身份',
        c3: '第三章 · 服务与视觉',
        c4: '第四章 · 增长与明年',
      } as Record<string, string>
    )[round.chapterId] ?? '年度经营';
  return (
    <header className="v11-hud" data-v11-hud-screen="round">
      <div className="v11-hud-heading">
        <div>
          <p className="v11-kicker">
            第 {state.roundIndex + 1} / {flow.content.rounds.length} 回合 · {round.timelineLabel}
          </p>
          <h1>{round.title}</h1>
        </div>
        <div className="v11-hud-actions">
          <button
            className="v11-dashboard-button"
            data-v11-focus-target="dashboard-button"
            type="button"
            onClick={() => flow.openDashboard()}
            aria-label="打开经营看板"
          >
            看店铺状态
          </button>
        </div>
      </div>
      <div className="v11-resource-strip" aria-label="你的经营资源">
        <div className="v11-resource cash">
          <span className="v11-resource-label">现金</span>
          <strong className="v11-resource-value">{formatCash(state.cashYuan)}</strong>
        </div>
        <div className="v11-resource ap">
          <span className="v11-resource-label">可调查</span>
          <strong className="v11-resource-value">
            {state.freeActionPoints} / {round.freeActionPointBudget}
          </strong>
        </div>
        <div className="v11-resource ap strategic">
          <span className="v11-resource-label">战略余力</span>
          <strong className="v11-resource-value">
            {state.strategicActionPoints} / {round.strategicActionPointBudget}
          </strong>
        </div>
        <div className="v11-resource time">
          <span className="v11-resource-label">经营时间</span>
          <strong className="v11-resource-value">{round.timelineLabel}</strong>
        </div>
      </div>
      <div className="v11-chapter-strip" aria-label={`当前章节：${chapterLabel}`}>
        <span>{chapterLabel}</span>
        <span>
          第 {state.roundIndex + 1} / {flow.content.rounds.length} 回合
        </span>
      </div>
    </header>
  );
}

function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, flow: V11StudentFlowLike): void {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(selector));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        flow.back();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialogRef, flow]);
}

function DashboardDrawer({ flow }: { flow: V11StudentFlowLike }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [largeText, setLargeText] = useState(
    () =>
      typeof document !== 'undefined' && document.documentElement.dataset.v11TextScale === 'large',
  );
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.dataset.v11ReducedMotion === 'true',
  );
  useDialogFocus(dialogRef, flow);
  useEffect(() => {
    document.documentElement.dataset.v11TextScale = largeText ? 'large' : 'normal';
    document.documentElement.dataset.v11ReducedMotion = reducedMotion ? 'true' : 'false';
  }, [largeText, reducedMotion]);
  return (
    <div className="v11-dashboard-backdrop">
      <section
        ref={dialogRef}
        className="v11-dashboard-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="v11-dashboard-title"
      >
        <div className="v11-detail-heading v11-dashboard-heading">
          <div>
            <p className="v11-kicker">经营看板</p>
            <h2 id="v11-dashboard-title">谁在回应你，店里接得住吗？</h2>
          </div>
          <button
            className="v11-icon-button"
            type="button"
            onClick={() => flow.back()}
            aria-label="关闭经营看板"
          >
            ×
          </button>
        </div>
        <div className="v11-dashboard-scroll">
          <p className="v11-dashboard-lead">
            这里看的是两组不同对象的反应：顾客指标描述市场反应，店铺指标描述你有没有能力兑现承诺。它们不会自动互相替代。
          </p>
          <MetricGroup
            title="顾客怎么回应你"
            items={customerMetrics}
            metrics={flow.state.metrics}
            glossary={flow.content.metricGlossary}
            traces={flow.state.traces}
          />
          <MetricGroup
            title="店铺能否接住"
            items={shopMetrics}
            metrics={flow.state.metrics}
            glossary={flow.content.metricGlossary}
            traces={flow.state.traces}
          />
          <CapacityPressure metrics={flow.state.metrics} />
          <details className="v11-concept-cheatsheet">
            <summary>概念小抄：随时回来看这些词</summary>
            <div>
              {(flow.content.termGlossary ?? []).map((term) => (
                <article key={term.termId}>
                  <strong>{term.label}</strong>
                  <p>{term.plainDefinition}</p>
                  <small>放到这局里：{term.inGameMeaning}</small>
                </article>
              ))}
            </div>
          </details>
          <div className="v11-accessibility-settings">
            <strong>显示设置</strong>
            <button
              type="button"
              className={largeText ? 'active' : ''}
              onClick={() => setLargeText((value) => !value)}
              aria-pressed={largeText}
            >
              放大文字
            </button>
            <button
              type="button"
              className={reducedMotion ? 'active' : ''}
              onClick={() => setReducedMotion((value) => !value)}
              aria-pressed={reducedMotion}
            >
              减少动效
            </button>
          </div>
          <div className="v11-dashboard-note">
            <strong>小提醒</strong>
            <span>
              高声量不等于好品牌；如果交付、信任和一致性跟不上，热闹也可能变成下一轮的压力。
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricGroup({
  title,
  items,
  metrics,
  glossary,
  traces,
}: {
  title: string;
  items: readonly (readonly [string, string])[];
  metrics: Record<string, number>;
  glossary: Record<string, { label: string; subject: string; explanation: string }>;
  traces: V11StudentFlowLike['state']['traces'];
}) {
  const status = (key: string, value: number) => {
    const inverted = key === 'reputationDebt';
    const healthy = inverted ? 100 - value : value;
    if (healthy >= 85) return ['富余', 'excellent'] as const;
    if (healthy >= 65) return ['够用', 'good'] as const;
    if (healthy >= 45) return ['尚可', 'steady'] as const;
    if (healthy >= 25) return ['吃紧', 'watch'] as const;
    return ['危险', 'danger'] as const;
  };
  return (
    <div className="v11-signal-group">
      <span className="v11-signal-title">{title}</span>
      <div className="v11-signal-items">
        {items.map(([key, label]) => {
          const value = metrics[key] ?? 0;
          const [labelText, tone] = status(key, value);
          const sourceTrace = [...traces]
            .reverse()
            .find((trace) => trace.result?.metricChanges[key]);
          const delta = sourceTrace?.result?.metricChanges[key];
          return (
            <span key={key} title={`${label}：${value} / 100`}>
              <div className="v11-metric-top">
                <small>{label}</small>
                <strong>{value}</strong>
                <b className={tone}>{labelText}</b>
              </div>
              <i className={`v11-metric-bar ${tone}`}>
                <i style={{ width: `${key === 'reputationDebt' ? 100 - value : value}%` }} />
              </i>
              {glossary[key] && (
                <em>
                  {glossary[key].subject} · {glossary[key].explanation}
                </em>
              )}
              {delta !== undefined && (
                <small className="v11-metric-change">
                  最近变化 {delta > 0 ? '+' : ''}
                  {delta} · 来自{sourceTrace?.result?.choiceLabel ?? '本轮经营'}
                </small>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CapacityPressure({ metrics }: { metrics: Record<string, number> }) {
  const capacity = Math.round(((metrics.productDelivery ?? 0) + (metrics.orgCapacity ?? 0)) / 2);
  const pressure = Math.min(
    100,
    Math.max(0, (metrics.reputationDebt ?? 0) + Math.max(0, 60 - (metrics.productDelivery ?? 0))),
  );
  const safetyMargin = capacity - pressure;
  const marginMessage =
    safetyMargin >= 20
      ? '还有余量，可以承接适度的新变化。'
      : safetyMargin >= 0
        ? '基本够用；高峰期不适合再突然加码。'
        : '压力已经超过店里的承接能力，先减负再增长。';
  return (
    <section className="v11-capacity-pressure" aria-label="能力与压力关系">
      <div>
        <span>店里承接能力</span>
        <strong>{capacity}</strong>
        <i>
          <i style={{ width: `${capacity}%` }} />
        </i>
        <small>出杯和人手能否接住承诺</small>
      </div>
      <div>
        <span>当前经营压力</span>
        <strong>{pressure}</strong>
        <i className="pressure">
          <i style={{ width: `${pressure}%` }} />
        </i>
        <small>声誉负债和交付不足会把压力推高</small>
      </div>
      <div className={safetyMargin < 0 ? 'margin-warning' : 'margin-safe'}>
        <span>安全余量</span>
        <strong>
          {safetyMargin > 0 ? '+' : ''}
          {safetyMargin}
        </strong>
        <i className={safetyMargin < 0 ? 'pressure' : undefined}>
          <i style={{ width: `${Math.min(100, Math.abs(safetyMargin))}%` }} />
        </i>
        <small>{marginMessage}</small>
      </div>
    </section>
  );
}

function TermCards({ flow, roundId }: { flow: V11StudentFlowLike; roundId: string }) {
  const round = flow.content.rounds.find((item) => item.roundId === roundId);
  const terms = (flow.content.termGlossary ?? []).filter((term) =>
    (round?.termRefs ?? []).includes(term.termId),
  );
  const newTerms = terms
    .filter((term) => !flow.state.introducedTermIds.includes(term.termId))
    .slice(0, 2);
  const [activeTermId, setActiveTermId] = useState<string | undefined>();
  // 如果本轮没有新概念，不显示概念提示。
  if (newTerms.length === 0) return null;
  const activeTerm = newTerms.find((term) => term.termId === activeTermId);
  const closeTerm = () => {
    if (activeTerm) void flow.introduceTerms([activeTerm.termId]);
    setActiveTermId(undefined);
  };
  return (
    <section className="v11-term-cards" aria-label="本轮概念说明">
      <div className="v11-term-launcher">
        <strong>本轮概念提示</strong>
        <span>遇到不熟的词，点 ? 立刻看人话解释。</span>
        {newTerms.map((term) => (
          <button
            type="button"
            key={term.termId}
            className={term.termId === activeTermId ? 'active' : ''}
            aria-label={`解释${term.label}`}
            aria-pressed={term.termId === activeTermId}
            onClick={() => setActiveTermId(term.termId)}
          >
            ？<span>{term.label}</span>
          </button>
        ))}
      </div>
      {activeTerm && (
        <aside
          className="v11-term-sheet"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`term-${activeTerm.termId}`}
        >
          <p className="v11-kicker">先用人话说</p>
          <h3 id={`term-${activeTerm.termId}`}>{activeTerm.label}</h3>
          <p>{activeTerm.plainDefinition}</p>
          <small>放到这局里：{activeTerm.inGameMeaning}</small>
          <em>例：{activeTerm.example}</em>
          <button type="button" className="v11-button compact primary" onClick={closeTerm}>
            知道了，继续经营
          </button>
        </aside>
      )}
    </section>
  );
}

function roundBriefingForPlayer(flow: V11StudentFlowLike, round: V11Round): V11Round['briefing'] {
  if (round.roundId !== 'r12') return round.briefing;

  const selectedLabels = [
    ...new Set(
      flow.state.traces
        .filter((trace) => trace.actionType === 'choice_committed' && trace.result?.choiceLabel)
        .map((trace) => trace.result?.choiceLabel as string),
    ),
  ].slice(-3);
  const customerProof =
    (flow.state.metrics.loyalty ?? 0) >= 60 ? '熟客已经形成了回访习惯' : '熟客还没有稳定地回来';
  const teamProof =
    Math.min(flow.state.metrics.productDelivery ?? 0, flow.state.metrics.orgCapacity ?? 0) >= 60
      ? '团队目前接得住大部分交付'
      : '制作和交付仍有容易卡住的环节';
  const visual = flow.state.visualState.selectedVisualId
    ? flow.content.visualSystems.find(
        (item) => item.visualId === flow.state.visualState.selectedVisualId,
      )
    : undefined;
  const strongestAsset =
    (flow.state.metrics.loyalty ?? 0) >= (flow.state.metrics.awareness ?? 0)
      ? '熟客关系'
      : '被看见的机会';
  const nextPressure =
    (flow.state.metrics.productDelivery ?? 0) < (flow.state.metrics.orgCapacity ?? 0)
      ? '高峰期的制作和交付'
      : '顾客会不会继续回来';

  return {
    ...round.briefing,
    situation: `走到年末，店里已经做过${selectedLabels.length > 0 ? `「${selectedLabels.join('」「')}」` : '几次关键取舍'}；现在还剩 ${formatCash(flow.state.cashYuan)}，${customerProof}，${teamProof}。${visual ? `视觉方向「${visual.name}」已经选定。` : '视觉方向还没有定稿。'}`,
    whyNow: `明年的预算和人手有限，要把这一局已经验证过的做法留下，也要给还没验证的机会设好边界。`,
    dilemma: `继续放大${strongestAsset}，还是先处理${nextPressure}再接新的机会？`,
    mustComplete: '从这一局留下的做法里，选出明年要保留、停止和先试的一项。',
  };
}

function evidenceRelationTargetLabel(
  content: GameContentV11,
  round: V11Round,
  relation: V11Round['evidence'][number]['relations'][number],
): string | undefined {
  if (relation.targetType === 'choice') {
    return round.choices.find((choice) => choice.choiceId === relation.targetId)?.label;
  }
  if (relation.targetType === 'visualSystem') {
    return content.visualSystems.find((visual) => visual.visualId === relation.targetId)?.name;
  }
  if (relation.targetType === 'riskPlan') {
    return round.riskPlans?.find((plan) => plan.riskPlanId === relation.targetId)?.label;
  }
  return undefined;
}

function evidenceRelationCopy(
  content: GameContentV11,
  round: V11Round,
  relation: V11Round['evidence'][number]['relations'][number],
): string {
  const target = evidenceRelationTargetLabel(content, round, relation);
  if (relation.relation === 'supports') {
    return `${target ? `更适合「${target}」` : '更适合这项方案'}：${relation.explanation}`;
  }
  if (relation.relation === 'warns') {
    return `${target ? `选择「${target}」前要注意` : '选择前要注意'}：${relation.explanation}`;
  }
  return `${target ? `关于「${target}」` : '补充情况'}：${relation.explanation}`;
}

function BriefingScreen({ flow, round }: { flow: V11StudentFlowLike; round: V11Round }) {
  const briefing = roundBriefingForPlayer(flow, round);
  return (
    <section className="v11-briefing v11-panel" aria-labelledby="v11-briefing-title">
      <div className="v11-briefing-copy">
        <p className="v11-kicker">本轮目标</p>
        <h2 id="v11-briefing-title">{briefing.mustComplete}</h2>
        <div className="v11-briefing-facts">
          <div>
            <span>现场</span>
            <p>{briefing.situation}</p>
          </div>
          <div>
            <span>为什么现在</span>
            <p>{briefing.whyNow}</p>
          </div>
          <div>
            <span>两难</span>
            <p>{briefing.dilemma}</p>
          </div>
        </div>
        <TermCards flow={flow} roundId={round.roundId} />
        {round.roundId === 'r05' && <BrandIdentityPanel flow={flow} />}
        <button
          className="v11-button primary"
          type="button"
          onClick={() => flow.openActionCenter()}
        >
          进入经营现场 <span aria-hidden="true">→</span>
        </button>
      </div>
      <SceneArt imageKey={round.briefing.imageKey} label="本轮经营现场插图" />
    </section>
  );
}

function BrandIdentityPanel({ flow }: { flow: V11StudentFlowLike }) {
  const saved = flow.state.brandIdentity;
  const [brandName, setBrandName] = useState(saved?.brandName ?? '');
  const [namingIntent, setNamingIntent] = useState(saved?.namingIntent ?? '');
  const [personality, setPersonality] = useState(saved?.personality ?? '');
  const [identityArchitecture, setIdentityArchitecture] = useState<'wordmark' | 'symbol' | 'ip'>(
    saved?.identityArchitecture ?? 'wordmark',
  );
  const [busy, run] = useFlowAction();
  return (
    <section className="v11-brand-identity" aria-labelledby="brand-identity-title">
      <p className="v11-kicker">先给品牌一个起点</p>
      <h3 id="brand-identity-title">名字不是标准答案，但要能被后面的设计和经营接住</h3>
      <label>
        品牌名
        <input
          value={brandName}
          maxLength={24}
          onChange={(event) => setBrandName(event.target.value)}
          placeholder="例如：一盏屯溪"
        />
      </label>
      <label>
        你希望顾客从名字里感到什么？
        <input
          value={namingIntent}
          maxLength={80}
          onChange={(event) => setNamingIntent(event.target.value)}
          placeholder="例如：把老街茶带进每天的午后"
        />
      </label>
      <label>
        如果它像一个人，会怎样说话和待客？
        <input
          value={personality}
          maxLength={60}
          onChange={(event) => setPersonality(event.target.value)}
          placeholder="例如：松弛、可靠、有一点幽默"
        />
      </label>
      <div role="group" aria-label="先给设计师哪项工作排序">
        <span>先给设计师哪项工作排序？</span>
        {(
          [
            ['wordmark', '先让店名在招牌和小屏上读清楚'],
            ['symbol', '先让顾客认出这里属于这条街'],
            ['ip', '先让角色承担包装和互动'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            className={identityArchitecture === value ? 'active' : ''}
            key={value}
            onClick={() => setIdentityArchitecture(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        className="v11-button secondary"
        type="button"
        disabled={busy || Boolean(saved)}
        onClick={() =>
          void run(() =>
            flow.declareBrandIdentity({
              brandName,
              namingIntent,
              personality,
              identityArchitecture,
            }),
          )
        }
      >
        {saved ? `已记录：${saved.brandName}` : '把这份身份设定写进店铺档案'}
      </button>
    </section>
  );
}

function ActionCenterV14({ flow, round }: { flow: V11StudentFlowLike; round: V11Round }) {
  const [busy, run] = useFlowAction();
  const briefing = roundBriefingForPlayer(flow, round);
  const actionScreen = [...flow.snapshot.screenStack]
    .reverse()
    .find((screen) => screen.id === 'action-center');
  const step = actionScreen?.actionStep ?? 'actions';
  const [expandedEvidence, setExpandedEvidence] = useState<string>();
  const [newlyRevealedEvidenceId, setNewlyRevealedEvidenceId] = useState<string>();
  const [pendingActionId, setPendingActionId] = useState<string>();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const state = flow.state;
  const questionGroups =
    round.decisionQuestions && round.decisionQuestions.length > 0
      ? round.decisionQuestions
      : [
          {
            questionId: `question-${round.roundId}-fallback`,
            prompt: briefing.mustComplete,
            context: briefing.whyNow,
            actionIds: round.stageActions.map((item) => item.actionId),
          },
        ];
  const doneActions = new Set(
    state.decisions
      .filter(
        (item) => item.type === 'stage_action_selected' || item.type === 'question_action_executed',
      )
      .map((item) => item.payload.actionId),
  );
  const revealedEvidence = expandedEvidence
    ? round.evidence.find((item) => item.evidenceId === expandedEvidence)
    : undefined;
  const collectedEvidence = round.evidence.filter((item) =>
    state.viewedEvidenceIds.includes(item.evidenceId),
  );
  const revealAction = async (actionId: string) => {
    const action = round.stageActions.find((item) => item.actionId === actionId);
    await flow.doStageAction(actionId);
    const evidenceId = action?.revealsEvidenceIds?.[0];
    if (evidenceId) {
      await flow.viewEvidence(evidenceId);
      setExpandedEvidence(evidenceId);
      setNewlyRevealedEvidenceId(evidenceId);
    }
  };
  return (
    <section className="v11-step-surface" data-v11-primary={step} aria-label="本轮经营选择">
      <div className="v11-step-heading v11-step-heading-questions">
        <div className="v11-step-heading-copy">
          <p className="v11-kicker">
            {step === 'actions' ? '第 1 / 2 步 · 眼前发生了什么' : '第 2 / 2 步 · 现在要做的决定'}
          </p>
          <h2>
            {step === 'actions' ? briefing.mustComplete : `你会怎么处理：${briefing.dilemma}`}
          </h2>
          <p>
            {step === 'actions'
              ? `先查清：${round.decisionQuestions?.[0]?.prompt ?? briefing.dilemma}`
              : briefing.situation}
          </p>
          <small className="v11-step-heading-why">为什么现在：{briefing.whyNow}</small>
        </div>
      </div>
      {step === 'actions' ? (
        <>
          <section className="v11-step-card" aria-labelledby="v11-actions-title">
            <div className="v11-step-card-title">
              <div>
                <p className="v11-detail-label">先查清哪件事</p>
                <h3 id="v11-actions-title">
                  {questionGroups.length > 1
                    ? `把这轮现场拆成 ${questionGroups.length} 个要回答的问题`
                    : '先把这轮现场的问题查清楚'}
                </h3>
              </div>
              <span>
                {state.freeActionPoints <= 2
                  ? `还剩 ${state.freeActionPoints} 点，注意给战略选择留余力`
                  : `还剩 ${state.freeActionPoints} 点可调查`}
              </span>
            </div>
            {(round.knownFacts?.length ?? 0) > 0 && (
              <div className="v11-known-facts v11-known-facts-inline" aria-label="已知现场">
                <strong>已经知道</strong>
                {round.knownFacts?.map((fact) => (
                  <p key={fact.factId}>{fact.text}</p>
                ))}
              </div>
            )}
            <div className="v11-action-question-groups">
              {questionGroups.map((question) => {
                const actions = round.stageActions.filter((item) =>
                  question.actionIds.includes(item.actionId),
                );
                if (actions.length === 0) return null;
                return (
                  <section className="v11-action-question-group" key={question.questionId}>
                    <div className="v11-action-question-heading">
                      <div>
                        <span className="v11-detail-label">现场问题</span>
                        <h4>{question.prompt}</h4>
                      </div>
                      <p>{question.context}</p>
                    </div>
                    <div className="v11-action-list">
                      {actions.map((item) => {
                        const missingAp = Math.max(
                          0,
                          item.actionPointCost - state.freeActionPoints,
                        );
                        const missingCash = Math.max(0, item.cashCostYuan - state.cashYuan);
                        const requiresConfirm = item.actionPointCost >= state.freeActionPoints;
                        const actionEvidence = round.evidence.filter((evidence) =>
                          item.revealsEvidenceIds?.includes(evidence.evidenceId),
                        );
                        const comparisonChoices = [
                          ...new Set(
                            item.helpsCompareChoiceIds?.map(
                              (choiceId) =>
                                round.choices.find((choice) => choice.choiceId === choiceId)?.label,
                            ),
                          ),
                        ].filter((label): label is string => Boolean(label));
                        const outputCopy =
                          item.outputType === 'quote'
                            ? '一份可核对的投入与交付限制'
                            : actionEvidence[0]?.title
                              ? `${actionEvidence[0].title}中的具体客流、成本或现场记录`
                              : '一条具体的现场事实';
                        return (
                          <article
                            className={`v11-action-row ${doneActions.has(item.actionId) ? 'done' : ''}`}
                            key={item.actionId}
                          >
                            <ActionSceneThumb
                              label={item.label}
                              actionId={item.actionId}
                              actionType={item.actionType}
                            />
                            <div className="v11-action-row-copy">
                              <strong>{item.label}</strong>
                              <p>{item.description}</p>
                              <div className="v11-action-row-cost">
                                <b>{formatCash(item.cashCostYuan)}</b>
                                <b>{item.actionPointCost} 点可调查</b>
                                <b>{item.durationDays} 天</b>
                              </div>
                              <small>
                                查完会带回：{outputCopy}
                                {comparisonChoices.length > 0 && (
                                  <> · 帮助比较：{comparisonChoices.join('、')}</>
                                )}
                              </small>
                            </div>
                            <button
                              className="v11-button compact"
                              type="button"
                              disabled={
                                busy ||
                                doneActions.has(item.actionId) ||
                                missingAp > 0 ||
                                missingCash > 0
                              }
                              onClick={() =>
                                requiresConfirm && !doneActions.has(item.actionId)
                                  ? setPendingActionId(item.actionId)
                                  : void run(() => revealAction(item.actionId))
                              }
                            >
                              {doneActions.has(item.actionId)
                                ? '结果已到'
                                : missingAp > 0
                                  ? `还差 ${missingAp} 点`
                                  : missingCash > 0
                                    ? '现金不足'
                                    : '查这件事'}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
          {collectedEvidence.length > 0 && (
            <section
              className="v11-collected-evidence"
              aria-labelledby="v11-collected-evidence-title"
            >
              <div className="v11-collected-evidence-heading">
                <div>
                  <p className="v11-detail-label">已经查到的事</p>
                  <h3 id="v11-collected-evidence-title">随时回看，不重复扣资源</h3>
                </div>
                <span>{collectedEvidence.length} 条</span>
              </div>
              <div className="v11-collected-evidence-list">
                {collectedEvidence.map((item) => {
                  const expanded = item.evidenceId === expandedEvidence;
                  return (
                    <article className={expanded ? 'active' : ''} key={item.evidenceId}>
                      <div>
                        <span>{evidenceAngleLabels[item.angle] ?? '现场信息'}</span>
                        <strong>{item.title}</strong>
                      </div>
                      <button
                        className="v11-button compact outline"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => {
                          setExpandedEvidence(expanded ? undefined : item.evidenceId);
                          setNewlyRevealedEvidenceId(undefined);
                        }}
                      >
                        {expanded ? '收起' : '回看'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {revealedEvidence && (
            <article className="v11-fact-reveal" aria-live="polite">
              <div>
                <span className="v11-detail-label">
                  {newlyRevealedEvidenceId === revealedEvidence.evidenceId
                    ? '刚刚查到'
                    : '已经查到的事'}{' '}
                  · {evidenceAngleLabels[revealedEvidence.angle] ?? '现场信息'}
                </span>
                <h3>{revealedEvidence.title}</h3>
              </div>
              <p>
                <strong>现场事实</strong>
                {revealedEvidence.fact}
              </p>
              <p>
                <strong>它提醒你</strong>
                {revealedEvidence.implication}
              </p>
              <div className="v11-relation-tags">
                {revealedEvidence.relations.map((relation) => (
                  <span key={`${relation.targetType}-${relation.targetId}`}>
                    {evidenceRelationCopy(flow.content, round, relation)}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="v11-text-button"
                onClick={() => {
                  setExpandedEvidence(undefined);
                  setNewlyRevealedEvidenceId(undefined);
                }}
              >
                先收起来
              </button>
            </article>
          )}
          {round.visualRequired && <VisualPrompt flow={flow} />}
          <div className="v11-primary-action">
            <button
              className="v11-button primary v11-touch-target"
              data-v11-primary="next"
              type="button"
              onClick={() => flow.setActionStep('choices')}
            >
              带着信息做选择 <span aria-hidden="true">→</span>
            </button>
            <small>不调查也可以继续，但你会少一条判断依据。</small>
          </div>
        </>
      ) : (
        <>
          <section className="v11-step-card v11-choice-sheet" aria-labelledby="v11-choice-title">
            <div className="v11-step-card-title">
              <div>
                <p className="v11-detail-label">现在要怎么处理</p>
                <h3 id="v11-choice-title">{briefing.dilemma}</h3>
              </div>
              <span>不同方案会消耗 2—4 点战略行动力</span>
            </div>
            <div className="v11-choice-list">
              {round.choices.map((choice) => (
                <V11ChoiceRow
                  key={choice.choiceId}
                  choice={choice}
                  evidence={round.evidence}
                  viewedEvidenceIds={state.viewedEvidenceIds}
                  onOpen={() => void run(() => flow.selectChoice(choice.choiceId))}
                />
              ))}
            </div>
          </section>
          {round.skipPolicy === 'allowed' && (
            <section className="v11-skip-card" aria-label="跳过本轮战略选择">
              <div>
                <span className="v11-detail-label">也可以先不加新东西</span>
                <strong>跳过本轮战略选择</strong>
                <p>你不会新增战略方案，但本轮经营仍会结算；已经花掉的资源不会退回。</p>
              </div>
              <button
                className="v11-button compact outline"
                type="button"
                disabled={busy}
                onClick={() => setConfirmSkip(true)}
              >
                确认跳过
              </button>
            </section>
          )}
          {confirmSkip && round.skipPolicy === 'allowed' && (
            <div className="v11-confirm-inline" role="alert">
              <strong>确定跳过这轮战略选择吗？</strong>
              <p>这不是暂缓，而是本轮直接不新增方案。店铺会按当前状态继续经营。</p>
              <div>
                <button type="button" onClick={() => setConfirmSkip(false)}>
                  再看看方案
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await flow.skipChoice();
                      setConfirmSkip(false);
                    })
                  }
                >
                  确认跳过
                </button>
              </div>
            </div>
          )}
          <button
            className="v11-button secondary v11-back-step"
            type="button"
            onClick={() => flow.setActionStep('actions')}
          >
            ← 返回可选行动
          </button>
        </>
      )}
      {pendingActionId &&
        (() => {
          const action = round.stageActions.find((item) => item.actionId === pendingActionId);
          if (!action) return null;
          return (
            <div
              className="v11-confirm-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="v11-last-ap-title"
            >
              <section className="v11-confirm-card">
                <p className="v11-kicker">行动力提醒</p>
                <h2 id="v11-last-ap-title">这会用掉最后的可调查点数</h2>
                <p>
                  执行“{action.label}”会花掉 {action.actionPointCost}{' '}
                  点可调查点数，但不会动用已经保留的 4
                  点战略行动力。查完后，你仍能执行一项战略方案。
                </p>
                <div>
                  <button
                    className="v11-button secondary"
                    type="button"
                    onClick={() => setPendingActionId(undefined)}
                  >
                    先不查
                  </button>
                  <button
                    className="v11-button primary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await revealAction(action.actionId);
                        setPendingActionId(undefined);
                      })
                    }
                  >
                    确认查这件事
                  </button>
                </div>
              </section>
            </div>
          );
        })()}
    </section>
  );
}

// Kept as a source reference for the v1.3 migration; the live route uses ActionCenterV14.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ActionCenter({ flow, round }: { flow: V11StudentFlowLike; round: V11Round }) {
  const [busy, run] = useFlowAction();
  const [expandedEvidence, setExpandedEvidence] = useState<string>();
  const [pendingActionId, setPendingActionId] = useState<string>();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [comparedChoiceIds, setComparedChoiceIds] = useState<string[]>([]);
  const state = flow.state;
  const moveToNextStep = () => {
    const targetId =
      round.visualRequired && !state.visualState.selectedVisualId
        ? 'v11-visual-prompt'
        : 'v11-choice-section';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const doneActions = new Set(
    state.decisions
      .filter(
        (item) => item.type === 'stage_action_selected' || item.type === 'question_action_executed',
      )
      .map((item) => item.payload.actionId),
  );
  return (
    <>
      <div className="v11-screen-toolbar">
        <div>
          <span className="v11-kicker">经营现场</span>
          <strong>把有限的精力用在最值得验证的地方</strong>
        </div>
        <span className="v11-ap-badge">
          自由 {state.freeActionPoints} · 战略 {state.strategicActionPoints}
        </span>
      </div>
      <div className="v11-layout-grid v11-action-workspace">
        <aside className="v11-layout-context v11-context-panel" aria-label="当前现场和资源">
          <section className="v11-panel v11-context-card">
            <p className="v11-kicker">当前现场和资源</p>
            <h2>这一轮先把问题看清楚</h2>
            <p className="v11-context-situation">{round.briefing.situation}</p>
            <div className="v11-context-goal">
              <span>本轮要推进</span>
              <strong>{round.briefing.mustComplete}</strong>
            </div>
            {(round.knownFacts?.length ?? 0) > 0 && (
              <div className="v11-known-facts" aria-label="已知现场">
                <strong>已知现场</strong>
                {round.knownFacts?.map((fact) => (
                  <p key={fact.factId}>{fact.text}</p>
                ))}
              </div>
            )}
            <div className="v11-context-resource">
              <span>还剩多少余力</span>
              <strong>
                自由 {state.freeActionPoints} · 战略 {state.strategicActionPoints}
              </strong>
              <small>自由行动用来调查、测试和做预案；战略行动留给最后一次方案选择。</small>
            </div>
          </section>
        </aside>
        <div className="v11-layout-main">
          <section className="v11-panel v11-actions-panel" aria-labelledby="v11-actions-title">
            <div className="v11-section-title">
              <div>
                <p className="v11-kicker">先弄清什么</p>
                <h2 id="v11-actions-title">每次行动都会带回一条能用来比较方案的事实</h2>
              </div>
              <span>只消耗自由行动力；不会动用战略行动力</span>
            </div>
            {state.freeActionPoints <= 2 && (
              <p className={`v11-resource-warning ${state.freeActionPoints <= 1 ? 'urgent' : ''}`}>
                自由行动只剩 {state.freeActionPoints}{' '}
                点。战略行动力已单独保留，你仍然可以在本轮执行一项战略方案。
              </p>
            )}
            <div className="v11-question-groups">
              {(round.decisionQuestions ?? []).map((question) => {
                const actions = round.stageActions.filter((item) =>
                  question.actionIds.includes(item.actionId),
                );
                return (
                  <section className="v11-question-group" key={question.questionId}>
                    <p className="v11-detail-label">先判断</p>
                    <h3>{question.prompt}</h3>
                    <p>{question.context}</p>
                    {actions.map((item) => {
                      const missingAp = Math.max(0, item.actionPointCost - state.freeActionPoints);
                      const missingCash = Math.max(0, item.cashCostYuan - state.cashYuan);
                      const requiresConfirm = item.actionPointCost >= state.freeActionPoints;
                      const executeAndReveal = async () => {
                        await flow.doStageAction(item.actionId);
                        setExpandedEvidence(item.revealsEvidenceIds?.[0]);
                      };
                      return (
                        <article
                          className={`v11-action-card ${doneActions.has(item.actionId) ? 'done' : ''}`}
                          key={item.actionId}
                        >
                          <ActionSceneThumb
                            label={item.label}
                            actionId={item.actionId}
                            actionType={item.actionType}
                          />
                          <div className="v11-card-body">
                            <strong>{item.label}</strong>
                            <p>{item.description}</p>
                            <span className="v11-mini-cost">
                              {formatCash(item.cashCostYuan)} · {item.actionPointCost} 点自由行动 ·{' '}
                              {item.durationDays} 天
                            </span>
                            <small>
                              做完会得到：
                              {item.outputType === 'quote'
                                ? '投入范围与限制'
                                : '一条可用于比较方案的事实'}
                              {item.remainingUnknown ? `；仍不知道：${item.remainingUnknown}` : ''}
                            </small>
                          </div>
                          <button
                            className="v11-button compact"
                            type="button"
                            disabled={
                              busy ||
                              doneActions.has(item.actionId) ||
                              missingAp > 0 ||
                              missingCash > 0
                            }
                            onClick={() =>
                              requiresConfirm && !doneActions.has(item.actionId)
                                ? setPendingActionId(item.actionId)
                                : void run(executeAndReveal)
                            }
                          >
                            {doneActions.has(item.actionId)
                              ? '已拿到结果'
                              : missingAp > 0
                                ? `还差 ${missingAp} 点行动`
                                : missingCash > 0
                                  ? '现金不足'
                                  : '执行'}
                          </button>
                        </article>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </section>
          <section className="v11-panel v11-evidence-panel" aria-labelledby="v11-evidence-title">
            <div className="v11-section-title">
              <div>
                <p className="v11-kicker">行动结果</p>
                <h2 id="v11-evidence-title">事实不是答案，但能告诉你哪些方案更有依据</h2>
              </div>
              <span>执行行动后可随时阅读，不重复扣资源</span>
            </div>
            <div className="v11-evidence-list">
              {round.evidence.map((item) => {
                const viewed = state.viewedEvidenceIds.includes(item.evidenceId);
                const expanded = viewed && expandedEvidence === item.evidenceId;
                const sourceAction = round.stageActions.find((action) =>
                  action.revealsEvidenceIds?.includes(item.evidenceId),
                );
                return (
                  <article
                    className={`v11-evidence-card ${viewed ? 'viewed' : ''}`}
                    key={item.evidenceId}
                  >
                    <div className="v11-evidence-summary">
                      <div>
                        <span className="v11-angle">
                          {evidenceAngleLabels[item.angle] ?? '现场信息'}
                        </span>
                        <strong>{item.title}</strong>
                      </div>
                      <button
                        className="v11-button compact outline"
                        type="button"
                        disabled={busy || !viewed}
                        onClick={() =>
                          void run(async () => {
                            await flow.viewEvidence(item.evidenceId);
                            setExpandedEvidence(item.evidenceId);
                          })
                        }
                      >
                        {viewed ? '查看结果' : '尚未拿到'}
                      </button>
                    </div>
                    {!viewed && (
                      <small className="v11-evidence-locked">
                        先完成“{sourceAction?.label ?? '相关行动'}”，再回来查看这条结果。
                      </small>
                    )}
                    {viewed && (
                      <button
                        className="v11-evidence-reveal-toggle"
                        type="button"
                        onClick={() => setExpandedEvidence(expanded ? undefined : item.evidenceId)}
                      >
                        {expanded ? '收起详情 ↑' : '展开这条情报 ↓'}
                      </button>
                    )}
                    {expanded && (
                      <div className="v11-evidence-reveal">
                        <p>
                          <strong>事实</strong>
                          {item.fact}
                        </p>
                        <p>
                          <strong>意味着</strong>
                          {item.implication}
                        </p>
                        <p>
                          <strong>还不知道</strong>
                          {item.unknown}
                        </p>
                        <div className="v11-relation-tags">
                          {item.relations.map((relation) => (
                            <span key={`${relation.targetType}-${relation.targetId}`}>
                              {relation.relation === 'supports'
                                ? '更支持这样做'
                                : relation.relation === 'warns'
                                  ? '要注意这个风险'
                                  : '补充情况'}{' '}
                              · {relation.explanation}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          {round.visualRequired && <VisualPrompt flow={flow} />}
          <section
            id="v11-choice-section"
            className="v11-panel v11-choice-panel"
            aria-labelledby="v11-choice-title"
          >
            <div className="v11-section-title">
              <div>
                <p className="v11-kicker">战略选择</p>
                <h2 id="v11-choice-title">现在，你愿意押注哪条路？</h2>
              </div>
              <span>所有方案都能走，但代价不同</span>
            </div>
            <div className="v11-choice-list">
              {round.choices.map((choice) => (
                <ChoiceCompact
                  key={choice.choiceId}
                  choice={choice}
                  evidence={round.evidence}
                  viewedEvidenceIds={state.viewedEvidenceIds}
                  compared={comparedChoiceIds.includes(choice.choiceId)}
                  onToggleCompare={() =>
                    setComparedChoiceIds((ids) =>
                      ids.includes(choice.choiceId)
                        ? ids.filter((id) => id !== choice.choiceId)
                        : ids.length >= 2
                          ? ids
                          : [...ids, choice.choiceId],
                    )
                  }
                  onOpen={() => void run(() => flow.selectChoice(choice.choiceId))}
                />
              ))}
            </div>
            <ChoiceComparisonTray
              choices={round.choices}
              evidence={round.evidence}
              viewedEvidenceIds={state.viewedEvidenceIds}
              comparedIds={comparedChoiceIds}
              onRemove={(choiceId) =>
                setComparedChoiceIds((ids) => ids.filter((id) => id !== choiceId))
              }
            />
            {round.skipPolicy === 'allowed' && (
              <section className="v11-skip-card" aria-label="跳过本轮战略选择">
                <div>
                  <span className="v11-detail-label">还有一种选择</span>
                  <strong>本轮不新增战略方案</strong>
                  <p>
                    先不加新项目，保留当前方向。已经花掉的现金和自由行动不会退回，店铺照常结算。
                  </p>
                </div>
                <button
                  className="v11-button compact outline"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmSkip(true)}
                >
                  查看后果
                </button>
              </section>
            )}
            {confirmSkip && round.skipPolicy === 'allowed' && (
              <div className="v11-confirm-inline" role="alert">
                <strong>直接结算本轮？</strong>
                <p>
                  你不会启动新方案；已经花掉的资源不会退回，店铺仍会结算固定经营和已经埋下的影响。
                </p>
                <div>
                  <button type="button" onClick={() => setConfirmSkip(false)}>
                    继续比较
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await flow.skipChoice();
                        setConfirmSkip(false);
                      })
                    }
                  >
                    确认维持现状
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="v11-legacy-dossier v11-dossier-panel" aria-label="当前决策提示">
          <section className="v11-panel v11-dossier-card">
            <p className="v11-kicker">当前决策提示</p>
            <h2>先弄清，再下注</h2>
            <p>
              自由行动带回事实，战略行动用来执行方案。不要把所有精力花在看信息上，最后要给自己留下一次真正的经营选择。
            </p>
            <ol className="v11-step-list">
              <li className="active">
                <strong>1</strong>
                <span>调查或测试，弄清顾客、产品和店里的限制。</span>
              </li>
              <li>
                <strong>2</strong>
                <span>把事实带进方案比较，看哪条路更有依据。</span>
              </li>
              <li>
                <strong>3</strong>
                <span>执行一次战略选择；也可以选择本轮不新增方案。</span>
              </li>
            </ol>
          </section>
        </aside>
      </div>
      <div className="v11-legacy-mobile-navigation" aria-label="本轮导航">
        <span>
          下一步：
          {round.visualRequired && !state.visualState.selectedVisualId
            ? '检查视觉触点'
            : '比较战略方案'}
        </span>
        <button className="v11-button primary" type="button" onClick={moveToNextStep}>
          {round.visualRequired && !state.visualState.selectedVisualId
            ? '查看视觉检查'
            : '查看战略方案'}{' '}
          <span aria-hidden="true">↓</span>
        </button>
      </div>
      {pendingActionId &&
        (() => {
          const action = round.stageActions.find((item) => item.actionId === pendingActionId);
          if (!action) return null;
          return (
            <div
              className="v11-confirm-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="v11-last-ap-title"
            >
              <section className="v11-confirm-card">
                <p className="v11-kicker">行动力提醒</p>
                <h2 id="v11-last-ap-title">这会用掉最后的自由行动</h2>
                <p>
                  你将执行“{action.label}”。这会花掉 {action.actionPointCost}{' '}
                  点自由行动，但不会动用已经保留的 4 点战略行动力；本轮仍可执行一项战略方案。
                </p>
                <div>
                  <button
                    className="v11-button secondary"
                    type="button"
                    onClick={() => setPendingActionId(undefined)}
                  >
                    先不做
                  </button>
                  <button
                    className="v11-button primary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await flow.doStageAction(action.actionId);
                        setExpandedEvidence(action.revealsEvidenceIds?.[0]);
                        setPendingActionId(undefined);
                      })
                    }
                  >
                    确认执行
                  </button>
                </div>
              </section>
            </div>
          );
        })()}
    </>
  );
}

function VisualPrompt({ flow }: { flow: V11StudentFlowLike }) {
  const selected = flow.state.visualState.selectedVisualId;
  return (
    <section className="v11-visual-prompt v11-panel">
      <div>
        <p className="v11-kicker">这一轮先确定视觉方向</p>
        <h2>把 LOGO 和 VI 放进真实使用，再决定哪套能工作</h2>
        <p>
          先选一套视觉方向，再用有限行动力做小测试。测试不是找“最漂亮”，而是看它放进真实场景后还认不认得出、用得顺不顺。
        </p>
      </div>
      <button
        className="v11-button primary"
        data-v11-focus-target="visual-compare-trigger"
        type="button"
        onClick={() => flow.openVisualCompare()}
      >
        {selected ? '继续检查视觉系统' : '打开视觉提案'} <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function V11ChoiceRow({
  choice,
  evidence,
  viewedEvidenceIds,
  onOpen,
}: {
  choice: V11Choice;
  evidence: V11Round['evidence'];
  viewedEvidenceIds: string[];
  onOpen: () => void;
}) {
  const linkedEvidence = evidence.filter((item) =>
    choice.evidenceRelations.includes(item.evidenceId),
  );
  const viewedLinkedEvidence = linkedEvidence.filter((item) =>
    viewedEvidenceIds.includes(item.evidenceId),
  );
  const linkedRelations = linkedEvidence.flatMap((item) =>
    item.relations.filter(
      (relation) => relation.targetType === 'choice' && relation.targetId === choice.choiceId,
    ),
  );
  const supportCount = linkedRelations.filter(
    (relation) => relation.relation === 'supports',
  ).length;
  const warningCount = linkedRelations.filter((relation) => relation.relation === 'warns').length;
  return (
    <article className="v11-choice-row">
      <button
        className="v11-choice-compact"
        data-v11-focus-target={`choice-${choice.choiceId}`}
        type="button"
        onClick={onOpen}
      >
        <div className="v11-choice-copy">
          <strong>{choice.label}</strong>
          <span>{choice.summary}</span>
          <div className="v11-choice-costs">
            <b>{formatCash(choice.cashCostYuan)}</b>
            <b>{choice.actionPointCost} 点战略行动</b>
            <b>{choice.durationDays} 天</b>
            <em>{choice.workload > 3 ? '高工作量' : '可控工作量'}</em>
          </div>
          <div
            className="v11-choice-evidence-state"
            aria-label={`这条方案的依据：${supportCount} 条事实支持，${warningCount} 条风险提醒，已查看 ${viewedLinkedEvidence.length} 条`}
          >
            {supportCount > 0 && (
              <span className="v11-choice-support-count">
                支持依据 {supportCount} 条 · 已查看 {viewedLinkedEvidence.length} 条
              </span>
            )}
            {warningCount > 0 && (
              <span className="v11-choice-warning-count">需要留意的风险 {warningCount} 条</span>
            )}
            {linkedEvidence.length === 0 && (
              <span className="v11-choice-unknown-count">暂时没有直接依据</span>
            )}
          </div>
        </div>
        <span className="v11-choice-arrow">查看方案</span>
      </button>
    </article>
  );
}

function ChoiceVisualPreview({
  choiceId,
  label,
  context,
}: {
  choiceId: string;
  label: string;
  context: 'detail' | 'result';
}) {
  const asset = choiceVisualAsset(choiceId);
  if (!asset) return null;
  const isRoute = asset.endsWith('.svg');
  const alt = isRoute ? `${label}的视觉路线结构示意` : `${label}的方案物件或操作场景示意`;
  return (
    <figure
      className={`v11-choice-visual v11-choice-visual-${context} ${isRoute ? 'route' : 'object'}`}
      aria-label={`${label}的视觉示意`}
    >
      <img
        src={visualAssetPath(asset)}
        alt={alt}
        loading={context === 'result' ? 'eager' : 'lazy'}
        decoding="async"
        style={isRoute ? undefined : { objectPosition: visualAssetObjectPosition(asset) }}
        onError={(event) => {
          if (event.currentTarget.dataset.fallbackApplied) {
            event.currentTarget.hidden = true;
            event.currentTarget.parentElement?.classList.add('asset-missing');
            return;
          }
          event.currentTarget.dataset.fallbackApplied = 'true';
          event.currentTarget.src = visualAssetPath('asset-placeholder.svg');
        }}
      />
      <figcaption>
        {isRoute ? '视觉路线示意' : decisionAsset(choiceId) ? '方案物件示意' : '视觉应用示意'}
      </figcaption>
    </figure>
  );
}

function ChoiceCompact({
  choice,
  evidence,
  viewedEvidenceIds,
  compared,
  onToggleCompare,
  onOpen,
}: {
  choice: V11Choice;
  evidence: V11Round['evidence'];
  viewedEvidenceIds: string[];
  compared: boolean;
  onToggleCompare: () => void;
  onOpen: () => void;
}) {
  const linkedEvidence = evidence.filter((item) =>
    choice.evidenceRelations.includes(item.evidenceId),
  );
  const viewedLinkedEvidence = linkedEvidence.filter((item) =>
    viewedEvidenceIds.includes(item.evidenceId),
  );
  const linkedRelations = linkedEvidence.flatMap((item) =>
    item.relations.filter(
      (relation) => relation.targetType === 'choice' && relation.targetId === choice.choiceId,
    ),
  );
  const supportCount = linkedRelations.filter(
    (relation) => relation.relation === 'supports',
  ).length;
  const warningCount = linkedRelations.filter((relation) => relation.relation === 'warns').length;
  return (
    <article className="v11-choice-option">
      <button className="v11-choice-compact" type="button" onClick={onOpen}>
        <div className="v11-choice-copy">
          <strong>{choice.label}</strong>
          <span>{choice.summary}</span>
          <div className="v11-choice-costs">
            <b>{formatCash(choice.cashCostYuan)}</b>
            <b>{choice.actionPointCost} AP</b>
            <b>{choice.durationDays} 天</b>
            <em>{choice.workload > 3 ? '高工作量' : '可控工作量'}</em>
          </div>
          <div
            className="v11-choice-evidence-badge"
            aria-label={`这条方案的依据：${supportCount} 条事实支持，${warningCount} 条风险提醒，已查看 ${viewedLinkedEvidence.length} 条`}
          >
            <span className="v11-choice-support-count">
              支持依据 {supportCount} 条 · 已查看 {viewedLinkedEvidence.length} 条
            </span>
            {warningCount > 0 && (
              <span className="v11-choice-warning-count">需要留意的风险 {warningCount} 条</span>
            )}
            {linkedEvidence.length === 0 && (
              <span className="v11-choice-unknown-count">暂时没有直接依据</span>
            )}
          </div>
        </div>
        <span className="v11-choice-arrow">查看方案</span>
      </button>
      <button
        className="v11-legacy-choice-toggle"
        type="button"
        onClick={onToggleCompare}
        aria-pressed={compared}
      >
        {compared ? '移出旧版比较' : '放入旧版比较'}
      </button>
    </article>
  );
}

function ChoiceComparisonTray({
  choices,
  evidence,
  viewedEvidenceIds,
  comparedIds,
  onRemove,
}: {
  choices: V11Choice[];
  evidence: V11Round['evidence'];
  viewedEvidenceIds: string[];
  comparedIds: string[];
  onRemove: (choiceId: string) => void;
}) {
  const selected = comparedIds
    .map((choiceId) => choices.find((choice) => choice.choiceId === choiceId))
    .filter((choice): choice is V11Choice => Boolean(choice));
  return (
    <section className="v11-legacy-choice-tray" aria-live="polite" aria-label="战略方案对比盘">
      <div className="v11-choice-comparison-heading">
        <div>
          <span className="v11-detail-label">方案对比盘</span>
          <strong>把两条路放在一起看</strong>
        </div>
        <span>{selected.length} / 2</span>
      </div>
      {selected.length === 0 ? (
        <p>先把想比较的方案放进这里；这不会消耗资源，也不会替你做决定。</p>
      ) : (
        <div className="v11-choice-comparison-grid">
          {selected.map((choice) => {
            const linked = evidence.filter((item) =>
              choice.evidenceRelations.includes(item.evidenceId),
            );
            const viewed = linked.filter((item) => viewedEvidenceIds.includes(item.evidenceId));
            return (
              <article key={choice.choiceId}>
                <div>
                  <h3>{choice.label}</h3>
                  <button
                    type="button"
                    onClick={() => onRemove(choice.choiceId)}
                    aria-label={`移出${choice.label}`}
                  >
                    ×
                  </button>
                </div>
                <p>{choice.primaryBenefit}</p>
                <div className="v11-evidence-to-choice">
                  <span>事实连接</span>
                  <strong>
                    {viewed.length} / {linked.length} 条已查看
                  </strong>
                  <small>
                    {linked.length > 0
                      ? linked.map((item) => item.title).join('、')
                      : '暂无直接绑定事实'}
                  </small>
                </div>
                <div className="v11-choice-compare-costs">
                  <span>现金 {formatCash(choice.cashCostYuan)}</span>
                  <span>战略 {choice.actionPointCost} AP</span>
                  <span>准备 {choice.durationDays} 天</span>
                  <span>工作量 {choice.workload} / 5</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ChoiceDetailScreen({
  flow,
  round,
  choiceId,
}: {
  flow: V11StudentFlowLike;
  round: V11Round;
  choiceId: string;
}) {
  const [busy, run] = useFlowAction();
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, flow);
  const choice = round.choices.find((item) => item.choiceId === choiceId);
  if (!choice) return null;
  const selectedRisk =
    flow.snapshot.selectedRiskPlanId &&
    choice.riskPlanIds.includes(flow.snapshot.selectedRiskPlanId)
      ? flow.snapshot.selectedRiskPlanId
      : undefined;
  const riskPlans = round.riskPlans.filter((plan) => choice.riskPlanIds.includes(plan.riskPlanId));
  const requiredVisual = choice.visualRouteId
    ? flow.content.visualSystems.find((item) => item.visualId === choice.visualRouteId)
    : undefined;
  const visualRouteMatches =
    !choice.visualRouteId || flow.state.visualState.selectedVisualId === choice.visualRouteId;
  const canCommit =
    flow.state.cashYuan >= choice.cashCostYuan &&
    flow.state.strategicActionPoints >= choice.actionPointCost &&
    (!round.visualRequired || Boolean(flow.state.visualState.selectedVisualId)) &&
    visualRouteMatches;
  const supported = round.evidence.filter((item) =>
    choice.evidenceRelations.includes(item.evidenceId),
  );
  const relatedEvidence = supported.flatMap((item) =>
    item.relations
      .filter(
        (relation) => relation.targetType === 'choice' && relation.targetId === choice.choiceId,
      )
      .map((relation) => ({ evidence: item, relation })),
  );
  const remainingCash = flow.state.cashYuan - choice.cashCostYuan;
  const capacity = Math.round(
    ((flow.state.metrics.productDelivery ?? 0) + (flow.state.metrics.orgCapacity ?? 0)) / 2,
  );
  const workloadStatus =
    choice.workload >= 4 && capacity < 60
      ? '现有两人可能要在高峰期加班'
      : choice.workload >= 4
        ? '高峰期要专人盯住交付'
        : '现有排班可以完成';
  return (
    <div
      className="v11-choice-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v11-choice-detail-title"
    >
      <section ref={dialogRef} className="v11-choice-detail">
        <div className="v11-detail-heading">
          <div>
            <p className="v11-kicker">方案详情 · 先比较，再下决定</p>
            <h2 id="v11-choice-detail-title">{choice.label}</h2>
          </div>
          <button
            className="v11-icon-button"
            type="button"
            aria-label="返回经营现场"
            onClick={() => flow.back()}
          >
            ×
          </button>
        </div>
        <p className="v11-detail-lead">{choice.detail}</p>
        <ChoiceVisualPreview choiceId={choice.choiceId} label={choice.label} context="detail" />
        <div className="v11-detail-cost-grid">
          <span>
            <small>一次性现金</small>
            <strong>{formatCash(choice.cashCostYuan)}</strong>
          </span>
          <span>
            <small>战略行动力</small>
            <strong>{choice.actionPointCost} AP</strong>
          </span>
          <span>
            <small>准备时间</small>
            <strong>{choice.durationDays} 天</strong>
          </span>
          <span>
            <small>门店工作量</small>
            <strong>{choice.workload} / 5</strong>
          </span>
        </div>
        <div className="v11-benefit-risk">
          <div>
            <small>最可能得到</small>
            <p>{choice.primaryBenefit}</p>
          </div>
          <div>
            <small>最突出风险</small>
            <p>{choice.primaryRisk}</p>
          </div>
        </div>
        <div className="v11-detail-section">
          <span className="v11-detail-label">你掌握的信息怎么说</span>
          {relatedEvidence.length > 0 ? (
            <div className="v11-support-list">
              {relatedEvidence.map(({ evidence, relation }) => (
                <span
                  key={`${evidence.evidenceId}-${relation.relation}`}
                  className={
                    flow.state.viewedEvidenceIds.includes(evidence.evidenceId) ? 'read' : ''
                  }
                >
                  {flow.state.viewedEvidenceIds.includes(evidence.evidenceId)
                    ? '已查看：'
                    : '待查看：'}
                  {evidence.title}：{relation.explanation}
                </span>
              ))}
            </div>
          ) : (
            <p className="v11-detail-muted">
              这条方案目前没有直接绑定的情报；你会用更大的不确定性换取尝试空间。
            </p>
          )}
          {supported.some((item) => !flow.state.viewedEvidenceIds.includes(item.evidenceId)) && (
            <p className="v11-detail-muted">
              还没看完的相关信息：
              {supported
                .filter((item) => !flow.state.viewedEvidenceIds.includes(item.evidenceId))
                .map((item) => item.title)
                .join('、')}
              。
            </p>
          )}
        </div>
        {['r01', 'r05', 'r08', 'r11'].includes(round.roundId) && (
          <KeyPredictionPanel flow={flow} roundId={round.roundId} />
        )}
        {riskPlans.length > 0 && (
          <div className="v11-detail-section">
            <span className="v11-detail-label">要不要为风险留缓冲？</span>
            <div className="v11-risk-list">
              {riskPlans.map((plan) => {
                const active = selectedRisk === plan.riskPlanId;
                return (
                  <button
                    className={`v11-risk-card ${active ? 'active' : ''}`}
                    type="button"
                    key={plan.riskPlanId}
                    disabled={
                      busy ||
                      Boolean(selectedRisk) ||
                      flow.state.freeActionPoints < plan.actionPointCost ||
                      flow.state.cashYuan < plan.cashCostYuan
                    }
                    onClick={() => void run(() => flow.selectRiskPlan(plan.riskPlanId))}
                  >
                    <strong>
                      {active ? '已配置 · ' : ''}
                      {plan.label}
                    </strong>
                    <span>{plan.description}</span>
                    <small>
                      {formatCash(plan.cashCostYuan)} · {plan.actionPointCost} 点自由行动 · 风险缓冲{' '}
                      {plan.mitigationRatio}%
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <details className="v11-why-details">
          <summary>为什么会这样？</summary>
          <p>{choice.reportExplanation}</p>
          <p className="v11-transfer-prompt">带走一个问题：{choice.transferPrompt}</p>
          <small>关联课程概念：{readableTheories(flow, choice.theoryIds)}</small>
        </details>
        <section className="v11-submit-preview" aria-label="执行前检查">
          <strong>执行前检查</strong>
          <span>执行后现金：{remainingCash >= 0 ? formatCash(remainingCash) : '现金不足'}</span>
          <span>时间会推进：{choice.durationDays} 天</span>
          <span>
            工作量：{choice.workload} / 5 · {workloadStatus}
          </span>
          <span>
            {requiredVisual
              ? visualRouteMatches
                ? `这项方案会使用：${requiredVisual.name}`
                : `执行前还要选择：${requiredVisual.name}`
              : round.visualRequired
                ? flow.state.visualState.selectedVisualId
                  ? `已选${flow.content.visualSystems.find((item) => item.visualId === flow.state.visualState.selectedVisualId)?.name ?? '视觉方向'}，会进入本轮触点`
                  : '执行前需要先选一套视觉方向'
                : '本轮不需要先选视觉系统'}
          </span>
          {selectedRisk && <span>这项风险已经预留了缓冲。</span>}
        </section>
        {round.visualRequired && !flow.state.visualState.selectedVisualId && (
          <p className="v11-inline-warning">这轮要先选视觉系统，执行按钮会保持关闭。</p>
        )}
        {requiredVisual && !visualRouteMatches && (
          <p className="v11-inline-warning">
            这项方案需要“{requiredVisual.name}”。请返回经营现场，先选好这套视觉方向。
          </p>
        )}
        <div className="v11-detail-footer">
          <button className="v11-button secondary" type="button" onClick={() => flow.back()}>
            再看看其他方案
          </button>
          <button
            className="v11-button primary"
            type="button"
            disabled={busy || !canCommit}
            onClick={() => void run(() => flow.commitChoice(choice.choiceId, selectedRisk))}
          >
            执行这项决定 <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function KeyPredictionPanel({ flow, roundId }: { flow: V11StudentFlowLike; roundId: string }) {
  const [busy, run] = useFlowAction();
  const prediction = flow.state.predictions.find((item) => item.roundId === roundId);
  const options = [
    ['conversion', '顾客会更愿意买'],
    ['visualRecognition', '顾客会更容易认出'],
    ['productDelivery', '店里会更稳定地交付'],
    ['trust', '顾客会更愿意相信'],
  ] as const;
  return (
    <section className="v11-key-prediction">
      <span className="v11-detail-label">先押一个判断（不加分，也不扣分）</span>
      <p>你认为这次最先改善的会是什么？结果页会把你的直觉和实际变化放在一起看。</p>
      <div>
        {options.map(([key, label]) => (
          <button
            type="button"
            key={key}
            disabled={busy || Boolean(prediction)}
            className={prediction?.label === key ? 'active' : ''}
            onClick={() => void run(() => flow.selectKeyPrediction(key))}
          >
            {prediction?.label === key ? `已选择：${label}` : label}
          </button>
        ))}
      </div>
    </section>
  );
}

function VisualCompareScreen({ flow, round }: { flow: V11StudentFlowLike; round: V11Round }) {
  const [busy, run] = useFlowAction();
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, flow);
  const selectedId = flow.state.visualState.selectedVisualId;
  const selected = flow.content.visualSystems.find((item) => item.visualId === selectedId);
  const routeIsLocked = round.roundId !== 'r08' && Boolean(selected);
  const visibleVisuals =
    routeIsLocked && selected
      ? [selected]
      : flow.content.visualSystems
          .filter((item) => ['v-line', 'v-symbol', 'v-hand'].includes(item.visualId))
          .slice(0, 3);
  return (
    <div
      className="v11-choice-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v11-visual-title"
    >
      <section ref={dialogRef} className="v11-visual-compare v11-visual-workspace">
        <div className="v11-detail-heading">
          <div>
            <p className="v11-kicker">视觉提案比较</p>
            <h2 id="v11-visual-title">不要只看效果图，要看这套设计进店后好不好用</h2>
          </div>
          <button
            className="v11-icon-button"
            type="button"
            aria-label="返回经营现场"
            onClick={() => flow.back()}
          >
            ×
          </button>
        </div>
        <p className="v11-detail-lead">
          {routeIsLocked
            ? '这条视觉路线已经由上一轮的策略确定。现在只检查它放进店招、杯身、包装和头像后，是否仍然清楚、好做。'
            : '把这三套视觉方案放进店招、杯身、包装和头像里看看：它们不只是好不好看，还要在真实使用时让顾客认出来、让团队做得出来。'}
        </p>
        <div className="v11-visual-workspace-grid">
          <section className="v11-visual-catalog" aria-label="视觉方案目录">
            <div className="v11-visual-compare-summary">
              <div>
                <span className="v11-detail-label">先看系统差异</span>
                <strong>选一套，再放进真实触点</strong>
              </div>
              <span className="v11-visual-test-status">
                已测 {flow.state.visualState.testedTouchpoints.length} / {round.visualTests.length}{' '}
                个触点
              </span>
            </div>
            <div className="v11-visual-grid">
              {visibleVisuals.map((visual) => (
                <VisualSystemCard
                  key={visual.visualId}
                  visual={visual}
                  selected={visual.visualId === selectedId}
                  brandName={flow.state.brandIdentity?.brandName ?? ''}
                  locked={routeIsLocked}
                  onSelect={() => void run(() => flow.selectVisual(visual.visualId))}
                />
              ))}
            </div>
          </section>
          <section className="v11-visual-hero" aria-label="当前视觉方案检视">
            {selected ? (
              <VisualInspector
                flow={flow}
                round={round}
                selected={selected}
                busy={busy}
                run={run}
              />
            ) : (
              <div className="v11-visual-empty">
                <strong>先选一套视觉系统</strong>
                <p>
                  左侧方案卡会先展示差异。选中后，这里会把它放进店招、杯身、包装和头像，帮你检查它能不能一路用下去。
                </p>
              </div>
            )}
          </section>
        </div>
        <div className="v11-detail-footer">
          <button className="v11-button secondary" type="button" onClick={() => flow.back()}>
            返回经营现场
          </button>
          <span className="v11-detail-muted">
            已测 {flow.state.visualState.testedTouchpoints.length} / {round.visualTests.length}{' '}
            个触点
          </span>
        </div>
      </section>
    </div>
  );
}

function VisualInspector({
  flow,
  round,
  selected,
  busy,
  run,
}: {
  flow: V11StudentFlowLike;
  round: V11Round;
  selected: V11VisualSystem;
  busy: boolean;
  run: (work: () => Promise<void> | void) => Promise<void>;
}) {
  const [touchpoint, setTouchpoint] = useState<string>(selected.touchpoints[0] ?? 'storefront');
  const [showAdditionalTouchpoints, setShowAdditionalTouchpoints] = useState(false);
  const testedIds = flow.state.visualState.testedTouchpoints;
  const testResults = flow.state.visualState.testResults ?? [];
  const smallTested = testedIds.some((id) => id.includes('sign-3-second'));
  const monoTested = testedIds.some((id) => id.includes('mobile-shrink') || id.includes('wet'));
  const occludedTested = testedIds.some(
    (id) => id.includes('packaging-stress') || id.includes('occlusion') || id.includes('fold'),
  );
  const completedConstraintPreviews = [
    { key: 'mono', label: '黑白打印', tested: monoTested },
    { key: 'small', label: '24 px 缩小', tested: smallTested },
    { key: 'occluded', label: '35% 遮挡', tested: occludedTested },
  ].filter((preview) => preview.tested);
  const previewState = occludedTested
    ? 'occluded'
    : monoTested
      ? 'mono'
      : smallTested
        ? 'small'
        : 'normal';
  const touchpoints = selected.touchpoints
    .filter((item) => Boolean(touchpointAsset(item) && touchpointPlacement(item)))
    .slice(0, 10);
  const additionalTouchpoints = V11VisualAdditionalTouchpointIds.filter((item) =>
    Boolean(touchpointAsset(item) && touchpointPlacement(item)),
  );
  const availableTouchpoints: string[] = [...touchpoints, ...additionalTouchpoints];
  const activeTouchpoint = availableTouchpoints.includes(touchpoint)
    ? touchpoint
    : (touchpoints[0] ?? 'storefront');
  const touchpointFile = touchpointAsset(activeTouchpoint);
  const placement = touchpointPlacement(activeTouchpoint);
  const brandName = flow.state.brandIdentity?.brandName ?? '';
  return (
    <div className="v11-visual-inspector">
      <div className="v11-inspector-heading">
        <div>
          <span className="v11-detail-label">当前选中</span>
          <strong>{selected.name}</strong>
        </div>
        <span>先选一个触点，再检查它能不能一路用下去</span>
      </div>
      <div className="v11-touchpoint-tabs" role="tablist" aria-label="选择视觉触点">
        {touchpoints.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTouchpoint === item}
            className={activeTouchpoint === item ? 'active' : ''}
            key={item}
            onClick={() => setTouchpoint(item)}
          >
            {touchpointLabels[item] ?? item}
          </button>
        ))}
      </div>
      <figure
        className={`v11-touchpoint-preview v11-preview-${previewState}`}
        data-v11-preview-state={previewState}
        aria-label={`${touchpointLabels[activeTouchpoint] ?? activeTouchpoint}上的视觉系统预览`}
      >
        <div className="v11-touchpoint-stage">
          {touchpointFile && (
            <img
              className="v11-touchpoint-base"
              src={visualAssetPath(touchpointFile)}
              alt=""
              loading="eager"
              decoding="async"
              style={{ objectPosition: visualAssetObjectPosition(touchpointFile) }}
            />
          )}
          {placement && (
            <div
              className={`v11-touchpoint-brand-surface ${placement.surfaceClass}`}
              style={{
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                width: `${placement.width}%`,
                height: `${placement.height}%`,
              }}
            >
              <V11VisualMark visualId={selected.visualId} brandName={brandName} />
            </div>
          )}
        </div>
        <figcaption>
          {touchpointLabels[activeTouchpoint] ?? activeTouchpoint} ·{' '}
          {previewState === 'normal'
            ? '正常使用'
            : previewState === 'small'
              ? '24 px 缩小后'
              : previewState === 'mono'
                ? '单色检查'
                : '35% 遮挡检查'}
        </figcaption>
      </figure>
      <section className="v11-additional-touchpoints" aria-label="扩展品牌应用">
        <button
          type="button"
          className="v11-additional-touchpoints-toggle"
          aria-expanded={showAdditionalTouchpoints}
          onClick={() => setShowAdditionalTouchpoints((current) => !current)}
        >
          {showAdditionalTouchpoints
            ? '收起扩展应用'
            : `查看其余 ${additionalTouchpoints.length} 个真实应用`}
        </button>
        {showAdditionalTouchpoints && (
          <div className="v11-additional-touchpoints-grid" role="list">
            {additionalTouchpoints.map((item) => (
              <div key={item} role="listitem">
                <button
                  type="button"
                  className={item === activeTouchpoint ? 'active' : ''}
                  onClick={() => setTouchpoint(item)}
                >
                  {touchpointLabels[item] ?? item}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <p>{selected.description}</p>
      {completedConstraintPreviews.length > 0 && (
        <section className="v11-visual-constraint-preview" aria-label="已完成的视觉约束测试结果">
          {completedConstraintPreviews.map((preview) => (
            <div className={`v11-preview-${preview.key} active`} key={preview.key}>
              <span>{preview.label}</span>
              <V11VisualMark visualId={selected.visualId} brandName={brandName} />
            </div>
          ))}
        </section>
      )}
      <div className="v11-test-grid">
        {round.visualTests.map((test) => {
          const tested = testedIds.includes(test.testId);
          const diagnostic = testResults.find((item) => item.testId === test.testId);
          return (
            <button
              className="v11-test-card"
              type="button"
              key={test.testId}
              disabled={busy || tested}
              onClick={() => void run(() => flow.testVisual(test.testId))}
            >
              <strong>{tested ? `已完成：${test.title}` : test.title}</strong>
              <span>{test.prompt}</span>
              <small>
                {diagnostic
                  ? `${diagnostic.passed ? '通过' : '需要调整'} · 适配 ${diagnostic.score}`
                  : '测试成本 · 1 点自由行动力'}
              </small>
            </button>
          );
        })}
      </div>
      <p className="v11-test-hint">
        每项测试消耗 1 点自由行动力，结果会影响视觉适配，并在本轮结算和最终报告中保留。
      </p>
    </div>
  );
}

function VisualSystemCard({
  visual,
  selected,
  brandName,
  locked = false,
  onSelect,
}: {
  visual: V11VisualSystem;
  selected: boolean;
  brandName: string;
  locked?: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`v11-visual-system-card ${selected ? 'selected' : ''}`}>
      <button className="v11-visual-select" type="button" disabled={locked} onClick={onSelect}>
        <div className="v11-visual-system-mark">
          <V11VisualMark visualId={visual.visualId} brandName={brandName} />
        </div>
        <strong>{visual.name}</strong>
        <span>{visual.description}</span>
        <small>
          {locked
            ? '已由上一轮策略确定 · 现在检查真实触点'
            : selected
              ? '已选中 · 这套会进入五个触点'
              : '选择这套系统'}
        </small>
      </button>
    </article>
  );
}

function RoundResultScreen({ flow, round }: { flow: V11StudentFlowLike; round: V11Round }) {
  const [busy, run] = useFlowAction();
  const result = flow.state.pendingRoundResult;
  if (!result) return <RoundResultRecovery flow={flow} busy={busy} run={run} />;
  const choice = round.choices.find((item) => item.choiceId === result.choiceId);
  const metricChanges = Object.entries(result.metricChanges)
    .filter(([, amount]) => amount !== 0)
    .slice(0, 3);
  const netCashChange = result.ledgerEntries.reduce((sum, entry) => sum + entry.amountYuan, 0);
  const operatingIncome = result.ledgerEntries
    .filter((entry) => entry.category === 'gross_profit')
    .reduce((sum, entry) => sum + entry.amountYuan, 0);
  const hasOperatingIncome = operatingIncome > 0;
  const meaningfulRiskOutcome = hasMeaningfulRiskOutcome(result.riskOutcome.status);
  const resultCopy = choice?.resultCopy;
  return (
    <section
      className="v11-result-screen"
      aria-labelledby="v11-result-title"
      data-scene-key={result.sceneKey}
      data-outcome-state={result.outcomeState}
      data-route-overlay-key={result.routeOverlayKey}
    >
      <div className="v11-result-header">
        <div>
          <p className="v11-kicker">执行结果 · 第 {flow.state.roundIndex + 1} 回合</p>
          <h2 id="v11-result-title">{result.choiceLabel}</h2>
          <p>先看这项选择在店里造成的变化，再决定下一轮要盯住什么。</p>
          <ChoiceVisualPreview
            choiceId={result.choiceId}
            label={result.choiceLabel}
            context="result"
          />
        </div>
        <ResultArt
          roundId={round.roundId}
          motionCue={result.motionCue}
          artKey={result.resultArtKey}
          routeOverlayKey={result.routeOverlayKey}
          outcomeState={result.outcomeState}
          brandName={flow.state.brandIdentity?.brandName ?? ''}
        />
      </div>
      <div className="v11-result-feedback" aria-live="polite">
        <div>
          <strong>店里先发生了什么</strong>
          <span>
            {resultCopy?.sceneChange || '这一步暂时没有明显变化，但店里已经开始按这个决定准备。'}
          </span>
        </div>
      </div>
      <div className="v11-result-primary-changes">
        <div>
          <span>战略投入</span>
          <strong className="negative">− {formatCash(result.cashCostYuan)}</strong>
          <small>这次决定的直接投入</small>
        </div>
        <div>
          <span>经营收入</span>
          <strong className={operatingIncome > 0 ? 'positive' : ''}>
            {operatingIncome > 0 ? '+' : ''}
            {formatCash(operatingIncome)}
          </strong>
          <small>{operatingIncome > 0 ? '顾客购买带来的毛利' : '筹备期，尚未产生经营收入'}</small>
        </div>
        <div>
          <span>本轮净现金</span>
          <strong className={netCashChange > 0 ? 'positive' : 'negative'}>
            {netCashChange > 0 ? '+' : '−'} {formatCash(Math.abs(netCashChange))}
          </strong>
          <small>收入减去本轮所有支出</small>
        </div>
      </div>
      {hasOperatingIncome && (
        <section className="v11-cashflow-reward" aria-live="polite">
          <img
            src="/assets/v11/rewards/positive-cashflow-v1.jpg"
            alt="金币向上浮起的经营收入奖励图"
            loading="eager"
            decoding="async"
          />
          <div>
            <span>这轮店里有真实收入了</span>
            <strong>经营毛利 + {formatCash(operatingIncome)}</strong>
            <small>
              {netCashChange >= 0
                ? `扣除本轮投入后，现金仍增加 ${formatCash(netCashChange)}。`
                : `这轮虽然有顾客购买，但投入暂时多于收入，净现金 ${formatCash(Math.abs(netCashChange))}。`}
            </small>
          </div>
        </section>
      )}
      {meaningfulRiskOutcome && (
        <section
          className={`v11-result-risk ${result.riskOutcome.status}`}
          aria-label="本轮风险处理结果"
        >
          <div>
            <span className="v11-detail-label">风险处理</span>
            <strong>{riskOutcomeLabel(result.riskOutcome.status)}</strong>
          </div>
          <p>{result.riskOutcome.explanation}</p>
        </section>
      )}
      {result.visualDiagnostics.length > 0 && (
        <section className="v11-result-visual-diagnostics" aria-label="本轮视觉测试诊断">
          <span className="v11-detail-label">视觉测试带回的诊断</span>
          {result.visualDiagnostics.map((diagnostic) => (
            <article
              className={diagnostic.passed ? 'passed' : 'needs-work'}
              key={diagnostic.testId}
            >
              <strong>
                {diagnostic.passed ? '通过' : '需要调整'} · {diagnostic.title}
              </strong>
              <span>{diagnostic.explanation}</span>
            </article>
          ))}
        </section>
      )}
      {result.newAchievements.length > 0 && (
        <section className="v11-result-achievements" aria-label="本轮新成就">
          <span className="v11-detail-label">这轮新做成的事</span>
          <div>
            {result.newAchievements.map((id) => {
              const achievement = flow.content.achievements.find(
                (item) => item.achievementId === id,
              );
              return (
                <article key={id}>
                  <strong>{achievement?.title ?? '一项经营成就'}</strong>
                  <span>{achievement?.description ?? '这项做法已经留下可回看的记录。'}</span>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <details className="v11-result-ledger">
        <summary>展开看完整账本和团队压力</summary>
        <div>
          <p className="v11-result-detail-line">
            <span>本轮工作量</span>
            <strong>{result.workload} / 5</strong>
          </p>
          {result.ledgerEntries.length > 0 ? (
            result.ledgerEntries.map((entry) => (
              <p key={entry.entryId}>
                <span>
                  {ledgerCategoryLabels[entry.category] ?? '本轮经营'} · {entry.descriptionKey}
                </span>
                <strong className={entry.amountYuan >= 0 ? 'positive' : 'negative'}>
                  {entry.amountYuan >= 0 ? '+' : '−'} {formatCash(Math.abs(entry.amountYuan))}
                </strong>
              </p>
            ))
          ) : (
            <p>这一轮没有新增现金流水。</p>
          )}
        </div>
      </details>
      <div className="v11-result-columns">
        <div className="v11-result-card">
          <span className="v11-detail-label">经营指标变化</span>
          {metricChanges.length > 0 ? (
            metricChanges.map(([key, amount]) => (
              <div className="v11-change-row" key={key}>
                <span>{metricLabels[key] ?? key}</span>
                <strong className={amount > 0 ? 'positive' : 'negative'}>
                  {amount > 0 ? '+' : ''}
                  {amount}
                </strong>
              </div>
            ))
          ) : (
            <p>这一刻没有明显的数值变化，但决策已经留下记录。</p>
          )}
        </div>
        <div className="v11-result-card">
          <span className="v11-detail-label">谁先有反应</span>
          {result.characterReactions.map((reaction, index) => (
            <p className="v11-reaction" key={`${reaction}-${index}`}>
              “{reaction}”
            </p>
          ))}
          {resultCopy?.delayedGain && (
            <p>
              <strong>接下来可能得到：</strong> {resultCopy.delayedGain}
            </p>
          )}
          {resultCopy?.riskToWatch && (
            <p>
              <strong>需要留意：</strong> {resultCopy.riskToWatch}
            </p>
          )}
        </div>
      </div>
      <details className="v11-result-followup">
        <summary>展开看后续影响和判断复盘</summary>
        {result.triggeredEvents.length > 0 && (
          <section className="v11-event-card" aria-labelledby="v11-event-title">
            <span className="v11-detail-label">现场插曲</span>
            {result.triggeredEvents.map((event) => (
              <div key={event.eventId}>
                <h3 id="v11-event-title">{event.title}</h3>
                <p>{event.text}</p>
              </div>
            ))}
          </section>
        )}
        <div className="v11-cause-lanes">
          <div>
            <span>接下来可能得到</span>
            <p>
              {resultCopy?.delayedGain ||
                result.scheduledEffects.map((effect) => effect.label).join('；') ||
                '这一步没有明确的延迟收益，先观察门店是否真的接得住。'}
            </p>
          </div>
          <div>
            <span>需要留意</span>
            <p>
              {resultCopy?.riskToWatch ||
                (meaningfulRiskOutcome
                  ? result.riskOutcome.explanation
                  : '这一步暂时没有额外风险提示。')}
            </p>
          </div>
          {result.maturedEffects.length > 0 && (
            <div>
              <span>本轮兑现</span>
              <p>{result.maturedEffects.map((effect) => effect.label).join('；')}</p>
            </div>
          )}
        </div>
        {(() => {
          const prediction = flow.state.predictions.find((item) => item.roundId === round.roundId);
          if (!prediction) return null;
          const actualMetric = metricChanges[0]?.[0];
          const hit = Boolean(actualMetric) && prediction.label === actualMetric;
          return (
            <p className={`v11-prediction-result ${hit ? 'hit' : 'miss'}`}>
              <strong>{hit ? '判断命中' : '判断复盘'}</strong> 你押的是“
              {metricLabels[prediction.label] ?? prediction.label}”；实际最先变化的是“
              {actualMetric
                ? (metricLabels[actualMetric] ?? actualMetric)
                : '这一刻没有明显指标变化'}
              ”。{hit ? '你的直觉被这次结果支持了。' : '这不是对错题：下次先用相关事实校正判断。'}
            </p>
          );
        })()}
      </details>
      <details className="v11-why-details">
        <summary>为什么会这样？</summary>
        <p>
          {choice?.reportExplanation ??
            '这项结果由现金投入、选择效果、已查看证据和延迟效果共同形成。'}
        </p>
        <p className="v11-transfer-prompt">
          下一次复盘时问自己：{choice?.transferPrompt ?? '这项决策改变了谁的体验？'}
        </p>
        <small>
          因果证据：
          {result.causeSources.map((sourceId) => readableSource(flow, sourceId)).join(' · ')} ·
          课程概念：{choice ? readableTheories(flow, choice.theoryIds) : '本轮经营判断'}
        </small>
      </details>
      <button
        className="v11-button primary v11-result-ack"
        type="button"
        disabled={busy}
        onClick={() => void run(() => flow.acknowledgeResult())}
      >
        确认结果，进入下一轮 <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function RoundResultRecovery({
  flow,
  busy,
  run,
}: {
  flow: V11StudentFlowLike;
  busy: boolean;
  run: (work: () => Promise<void> | void) => Promise<void>;
}) {
  return (
    <section
      className="v11-result-screen v11-result-recovery"
      aria-labelledby="v11-result-recovery-title"
      role="status"
    >
      <p className="v11-kicker">正在核对本轮结算</p>
      <h2 id="v11-result-recovery-title">这一步已经提交，结果还没回到页面</h2>
      <p>
        先不要重复选择。系统会重新载入这一步的结算记录；结果回来后，你可以继续查看顾客和店里的变化。
      </p>
      <button
        className="v11-button primary v11-result-ack"
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await flow.recoverPendingResult();
          })
        }
      >
        重新载入结果
      </button>
    </section>
  );
}

function V11AchievementBadge({ title }: { title: string }) {
  return (
    <span className="v11-achievement-badge">
      <strong>{title}</strong>
    </span>
  );
}

function resolveSceneAsset(imageKey: string): string {
  return `/assets/v11/scene-atlas.svg#${imageKey}`;
}

function resolveResultAsset(roundId: string, artKey: string): string {
  const assetPrefix = artKey ? 'result' : 'fallback';
  return `/assets/v11/scene-atlas.svg#${assetPrefix}-${roundId}`;
}

function SceneArt({ imageKey, label }: { imageKey: string; label: string }) {
  const [assetFailed, setAssetFailed] = useState(false);
  const asset = sceneAsset(imageKey);
  return (
    <div
      className={`v11-scene-art ${imageKey} ${asset && !assetFailed ? 'photo-ready' : 'photo-failed'}`}
      role="img"
      aria-label={label}
      data-image-key={imageKey}
      data-asset-path={asset ?? ''}
    >
      {asset && (
        <img
          src={visualAssetPath(asset)}
          alt=""
          loading="eager"
          decoding="async"
          style={{ objectPosition: visualAssetObjectPosition(asset) }}
          onError={() => setAssetFailed(true)}
        />
      )}
      <svg viewBox="0 0 640 420" aria-hidden="true">
        <use href={resolveSceneAsset(imageKey)} />
      </svg>
      <span className="v11-art-fallback" aria-hidden="true">
        经营现场
      </span>
    </div>
  );
}

function ResultArt({
  roundId,
  motionCue,
  artKey,
  routeOverlayKey,
  outcomeState,
  brandName,
}: {
  roundId: string;
  motionCue: string;
  artKey: string;
  routeOverlayKey: string;
  outcomeState: V11OutcomeState;
  brandName: string;
}) {
  const routeId = routeOverlayKey.startsWith('route-')
    ? routeOverlayKey.slice('route-'.length)
    : undefined;
  const visualRouteVisible = Boolean(routeId) && Number(roundId.slice(1)) >= 8;
  const [assetFailed, setAssetFailed] = useState(false);
  const asset = resultSceneAsset(roundId, outcomeState);
  return (
    <div
      className={`v11-result-art motion-${motionCue} ${visualRouteVisible ? 'visual-route' : ''} ${asset && !assetFailed ? 'photo-ready' : 'photo-failed'}`}
      data-art-key={artKey}
      data-motion-cue={motionCue}
      data-outcome-state={outcomeState}
      data-route-overlay-key={routeOverlayKey}
      data-asset-path={asset ?? ''}
    >
      {asset && (
        <img
          className="v11-result-photo"
          src={visualAssetPath(asset)}
          alt=""
          loading="eager"
          decoding="async"
          style={{ objectPosition: visualAssetObjectPosition(asset) }}
          onError={() => setAssetFailed(true)}
        />
      )}
      {visualRouteVisible && routeId && isCoreVisualRoute(routeId) && (
        <V11VisualMark className="v11-result-route" visualId={routeId} brandName={brandName} />
      )}
      <svg viewBox="0 0 640 420" aria-label="本轮经营现场发生变化">
        <use href={resolveResultAsset(roundId, artKey)} />
      </svg>
      <span className="v11-art-fallback" aria-hidden="true">
        现场反馈
      </span>
      <small>{visualRouteVisible ? '视觉路线进入现场' : '现场反馈'}</small>
    </div>
  );
}

function ChapterReviewScreen({ flow }: { flow: V11StudentFlowLike }) {
  const lastRoundId = flow.state.completedRoundIds.at(-1);
  const chapterLabel =
    lastRoundId === 'r02'
      ? '第一章体检'
      : lastRoundId === 'r06'
        ? '第二章体检'
        : lastRoundId === 'r09'
          ? '第三章体检'
          : '年度体检';
  const recent = flow.state.traces
    .filter(
      (trace) => trace.actionType === 'choice_committed' || trace.actionType === 'choice_skipped',
    )
    .slice(-2);
  const recentChoiceCopies = recent.map((trace) => {
    const sourceRound = flow.content.rounds.find((round) => round.roundId === trace.roundId);
    return sourceRound?.choices.find((choice) => choice.choiceId === trace.result?.choiceId)
      ?.resultCopy;
  });
  const chapterIntro =
    recent.length > 0
      ? `你刚刚做出的选择已经进入现场：${recent
          .map((trace) => trace.result?.choiceLabel ?? '维持现状')
          .join('、')}。现在回看顾客的回应和店里的变化。`
      : '这一章还没有形成可回看的决定，先从眼前的现场开始。';
  const customerStatus = Math.round(
    ['awareness', 'conversion', 'trust', 'loyalty', 'segmentFit'].reduce(
      (sum, key) => sum + (flow.state.metrics[key] ?? 0),
      0,
    ) / 5,
  );
  const shopStatus = Math.round(
    ((flow.state.metrics.productDelivery ?? 0) + (flow.state.metrics.orgCapacity ?? 0)) / 2,
  );
  const pressurePoint =
    (flow.state.metrics.reputationDebt ?? 0) >= 35
      ? '顾客已经开始怀疑承诺能不能做到'
      : shopStatus < 55
        ? '高峰期的制作和交付还不够稳'
        : shopStatus < customerStatus
          ? '顾客期待已经跑在店里能力前面'
          : '下一步要继续观察顾客是否真的回来';
  const futureRisk =
    flow.state.pendingEffects[0]?.label ??
    (shopStatus < customerStatus
      ? '顾客期待正在跑在店里能力前面'
      : '下一章会遇到更多顾客和更复杂的现场，看看店员能不能继续做到答应顾客的事');
  const visual = flow.state.visualState.selectedVisualId
    ? flow.content.visualSystems.find(
        (item) => item.visualId === flow.state.visualState.selectedVisualId,
      )
    : undefined;
  const chapterId =
    flow.content.rounds.find((round) => round.roundId === lastRoundId)?.chapterId ?? 'c1';
  const chapterImage = chapterAsset(chapterId);
  return (
    <main className="v11-chapter-review">
      <p className="v11-kicker">{chapterLabel}</p>
      <h1>这一章，顾客和店里已经怎样回应？</h1>
      <p>{chapterIntro}</p>
      {chapterImage && (
        <figure className="v11-chapter-scene">
          <img
            src={visualAssetPath(chapterImage)}
            alt={`${chapterLabel}的门店现场`}
            loading="eager"
            decoding="async"
            style={{ objectPosition: visualAssetObjectPosition(chapterImage) }}
          />
        </figure>
      )}
      <section className="v11-chapter-achievements">
        <span className="v11-detail-label">你在这一章做成的事</span>
        {flow.state.achievements.length > 0 ? (
          <div>
            {flow.state.achievements.map((id) => (
              <V11AchievementBadge
                key={id}
                title={
                  flow.content.achievements.find((achievement) => achievement.achievementId === id)
                    ?.title ?? '一项经营成就'
                }
              />
            ))}
          </div>
        ) : (
          <p>这章还没有解锁记录；先记住刚刚做出的那次取舍。</p>
        )}
      </section>
      {visual && (
        <figure className="v11-chapter-route-mark">
          <V11VisualMark
            visualId={visual.visualId}
            brandName={flow.state.brandIdentity?.brandName ?? ''}
          />
          <figcaption>你的视觉路线：{visual.name}</figcaption>
        </figure>
      )}
      <section className="v11-chapter-strength">
        <span>顾客已经怎样回应</span>
        <strong>
          {recentChoiceCopies.filter(Boolean)[0]?.sceneChange ?? '还没有足够的现场结果可以回看。'}
        </strong>
        <small>先看具体回应，再用下面的状态条判断它是否已经变成稳定能力。</small>
      </section>
      <section className="v11-chapter-health" aria-label="本章经营状态">
        <div>
          <span>顾客状态</span>
          <strong>{customerStatus}</strong>
          <i>
            <i style={{ width: `${customerStatus}%` }} />
          </i>
          <small>认知、转化、信任、复购和客群匹配的综合状态。</small>
        </div>
        <div>
          <span>店铺状态</span>
          <strong>{shopStatus}</strong>
          <i>
            <i style={{ width: `${shopStatus}%` }} />
          </i>
          <small>产品交付和组织能力能否接住顾客期待。</small>
        </div>
      </section>
      <section className="v11-chapter-contradiction">
        <span>店里目前最容易卡住哪里</span>
        <strong>{pressurePoint}</strong>
        <p>下一轮马上会遇到：{futureRisk}</p>
      </section>
      <div>
        {recent.map((trace, index) => (
          <article key={trace.actionId}>
            <strong>{trace.result?.choiceLabel ?? '本轮经营'}</strong>
            <span>
              {trace.result?.resultType === 'skip'
                ? '你选择维持现状，既有经营继续结算。'
                : (recentChoiceCopies[index]?.sceneChange ??
                  '这一刻没有立刻看得见的变化，但店里已经开始按这个决定准备。')}
            </span>
          </article>
        ))}
      </div>
      <button
        className="v11-button primary"
        type="button"
        onClick={() => void flow.continueAfterChapterReview()}
      >
        {lastRoundId === 'r12' ? '查看年度结局' : '进入下一章'} <span aria-hidden="true">→</span>
      </button>
    </main>
  );
}

function CompletionScreen({
  flow,
  onReplay,
}: {
  flow: V11StudentFlowLike;
  onReplay?: () => Promise<void>;
}) {
  const state = flow.state;
  const report = flow.report ?? buildV11Report(state, flow.content);
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState('');
  const levelLabels: Record<string, string> = {
    benchmark: '标杆路径',
    sustainable: '可持续路径',
    formed_brand: '品牌已成形',
    barely_alive: '勉强站住',
    out_of_control: '需要重新稳住',
  };
  const causes = report.causalExplanations.slice(0, 2);
  const startReplay = async () => {
    if (!onReplay) return;
    setReplaying(true);
    setReplayError('');
    try {
      await onReplay();
    } catch (cause) {
      setReplayError(cause instanceof Error ? cause.message : '重玩暂时无法开始，请稍后再试。');
    } finally {
      setReplaying(false);
    }
  };
  return (
    <main className="v11-complete">
      <div className="v11-complete-mark">完成</div>
      <p className="v11-kicker">{flow.content.rounds.length} 轮经营完成</p>
      <h1>你的品牌已经有了一条路径</h1>
      <p>
        这不是一个“选对答案”的结论，而是这一局的经营结果：等级看整体表现，路线看取舍组合，结局看这些取舍最后留下了什么。
      </p>
      <section className="v11-complete-outcome" aria-label="本局经营结果">
        <div>
          <span>经营等级</span>
          <strong>{levelLabels[report.scoreBreakdown.level] ?? report.scoreBreakdown.level}</strong>
          <small>综合表现 {Math.round(report.scoreBreakdown.overall)} / 100</small>
        </div>
        <div>
          <span>形成的路线</span>
          <strong>{report.routeProfile?.title ?? '实验探索型品牌'}</strong>
          <small>
            {report.routeProfile
              ? `路径置信度 ${Math.round(report.routeProfile.confidence)}%`
              : '还没有明显偏向单一路线'}
          </small>
        </div>
        <div>
          <span>这一局的结局</span>
          <strong>{report.endingTitle ?? '留下了一家还在学习的店'}</strong>
          <small>由本局多轮选择和经营状态共同形成</small>
        </div>
      </section>
      <div className="v11-complete-stats">
        <span>
          <small>剩余现金</small>
          <strong>{formatCash(state.cashYuan)}</strong>
        </span>
        <span>
          <small>经历时间</small>
          <strong>第 {state.elapsedDays} 天</strong>
        </span>
        <span>
          <small>已做决定</small>
          <strong>
            {state.decisions.filter((item) => item.type === 'choice_committed').length} 次
          </strong>
        </span>
      </div>
      {causes.length > 0 && (
        <section className="v11-complete-causes" aria-label="本局因果回指">
          <span className="v11-detail-label">为什么会得到这个结果</span>
          {causes.map((cause) => (
            <article key={cause.traceRefs.join('-')}>
              <strong>{cause.roundTitle}</strong>
              <span>{cause.mechanism}</span>
            </article>
          ))}
        </section>
      )}
      <div className="v11-complete-actions">
        <button className="v11-button primary" type="button" onClick={() => flow.openReport()}>
          打开我的复盘报告 <span aria-hidden="true">→</span>
        </button>
        {onReplay && (
          <button
            className="v11-button secondary"
            type="button"
            disabled={replaying}
            onClick={() => void startReplay()}
          >
            {replaying ? '正在准备再来一局…' : '再来一局（从头开始）'}
          </button>
        )}
      </div>
      {replayError && (
        <p className="error" role="alert">
          {replayError}
        </p>
      )}
      <p className="v11-complete-note">
        重玩会新建一条独立记录，不会覆盖本局成绩。报告会把每次选择、证据使用和结果串起来，带到课堂讨论。
      </p>
    </main>
  );
}

function ReportScreen({ flow }: { flow: V11StudentFlowLike }) {
  const report = flow.report ?? buildV11Report(flow.state, flow.content);
  return (
    <main className="v11-report-screen" aria-labelledby="v11-report-title">
      <div className="v11-report-heading">
        <div>
          <p className="v11-kicker">经营复盘报告</p>
          <h1 id="v11-report-title">这条品牌路径，是怎么形成的？</h1>
          <p>
            报告把“你做了什么—改变了什么—为什么—何时显现”串起来。它不是标准答案，而是对本局证据的解释。
          </p>
        </div>
        <button className="v11-button secondary" type="button" onClick={() => flow.back()}>
          返回结局
        </button>
      </div>
      <section className="v11-report-score">
        <div>
          <span className="v11-detail-label">综合经营表现</span>
          <strong>{Math.round(report.scoreBreakdown.overall)}</strong>
          <small>
            {report.scoreBreakdown.level === 'benchmark'
              ? '标杆路径'
              : report.scoreBreakdown.level === 'sustainable'
                ? '可持续路径'
                : report.scoreBreakdown.level === 'formed_brand'
                  ? '品牌已成形'
                  : '勉强站住'}
          </small>
        </div>
        <div>
          <span className="v11-detail-label">品牌路线</span>
          <strong>{report.routeProfile?.title ?? '还没有形成单一路线'}</strong>
          <small>
            {report.routeProfile
              ? `路径置信度 ${Math.round(report.routeProfile.confidence)}%`
              : '继续观察不同选择如何叠加'}
          </small>
        </div>
        <div>
          <span className="v11-detail-label">现金结果</span>
          <strong>{formatCash(report.financialSummary.finalCashYuan)}</strong>
          <small>总投入 {formatCash(report.financialSummary.totalCostYuan)}</small>
        </div>
      </section>
      <section className="v11-report-card">
        <div className="v11-section-title">
          <div>
            <p className="v11-kicker">每轮因果链</p>
            <h2>选择不会只影响当下</h2>
          </div>
          <span>{report.roundReviews.length} 次经营决定</span>
        </div>
        <div className="v11-report-rounds">
          {report.roundReviews.map((review, index) => (
            <article key={`${review.roundTitle}-${index}`} className="v11-report-round">
              <div className="v11-report-round-top">
                <span>0{index + 1}</span>
                <div>
                  <h3>{review.roundTitle}</h3>
                  <strong>你选择了：{review.choiceLabel}</strong>
                </div>
              </div>
              <p>{review.mechanism}</p>
              <div className="v11-report-resource">
                <small>这一步的投入</small>
                <span>
                  {formatCash(review.resourceImpact.cashCostYuan)} ·{' '}
                  {review.resourceImpact.actionPointCost} 点战略行动 ·{' '}
                  {review.resourceImpact.durationDays} 天准备 · 工作量{' '}
                  {review.resourceImpact.workload} / 5
                </span>
              </div>
              <p className="v11-report-evidence">
                <b>证据判断：</b>
                {review.decisionReason} · {review.evidenceUse}
              </p>
              <p className="v11-report-evidence">
                <b>风险结果：</b>
                {review.riskOutcome}
              </p>
              {review.triggeredEvents.length > 0 && (
                <p className="v11-report-evidence">
                  <b>现场插曲：</b>
                  {review.triggeredEvents.join('；')}
                </p>
              )}
              <small className="v11-report-theory">
                课程连接：{review.theoryLinks.join(' · ') || '本轮经营判断'}
              </small>
            </article>
          ))}
        </div>
      </section>
      <section className="v11-report-two-col">
        <div className="v11-report-card">
          <span className="v11-detail-label">视觉系统诊断</span>
          <h2>{report.visualDiagnosis.selectedSystem ?? '未选择视觉系统'}</h2>
          <p>{report.visualDiagnosis.explanation}</p>
          <small>已做触点测试：{report.visualDiagnosis.testedTouchpoints} 次</small>
          {report.visualDiagnosis.testResults.length > 0 && (
            <div className="v11-report-visual-tests">
              {report.visualDiagnosis.testResults.map((test) => (
                <span className={test.passed ? 'passed' : 'needs-work'} key={test.title}>
                  {test.passed ? '通过' : '需调整'} · {test.title} · {test.score}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="v11-report-card">
          <span className="v11-detail-label">预判复盘</span>
          <h2>
            命中 {report.predictionDiagnosis.matched} 次 · 偏差{' '}
            {report.predictionDiagnosis.differed} 次
          </h2>
          <p>{report.predictionDiagnosis.explanation}</p>
        </div>
        <div className="v11-report-card">
          <span className="v11-detail-label">带到课堂的问题</span>
          <h2>{report.replayReflection.mostConsequentialRound ?? '本局整体路径'}</h2>
          <p>{report.replayReflection.explanation}</p>
          <p className="v11-transfer-prompt">{report.replayReflection.prompt}</p>
        </div>
      </section>
    </main>
  );
}
