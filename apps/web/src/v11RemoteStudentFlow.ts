import type { GameContentV11 } from '@laojie/content-schema';
import { deriveV11ResumeScreen, type V11Action, type V11GameState } from '@laojie/game-engine';
import type { GameReportV11 } from '@laojie/report-engine';
import type {
  V11PersistedFlowSnapshot,
  V11Screen,
  V11StudentSnapshot,
  V11StudentFlowLike,
} from './v11StudentFlow.js';
import type { V11RemotePlaythrough, V11RemoteStudentApi } from './v11RemoteStudentApi.js';
import { v11PlayerFeedback } from './v11PlayerFeedback.js';
import { createBrowserOutbox, type OutboxStorage } from './offline/outbox.js';

export class V11RemoteStudentFlow implements V11StudentFlowLike {
  readonly syncLabel = '进度已保存';
  readonly kind: V11RemotePlaythrough['kind'];
  private readonly listeners = new Set<() => void>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly outbox: OutboxStorage;
  private actionSequence = 0;
  private reportAvailable: boolean;
  private current: V11StudentSnapshot;
  private currentReport: GameReportV11 | undefined;

  constructor(
    readonly playthroughId: string,
    readonly seed: string,
    readonly token: string,
    readonly content: GameContentV11,
    private readonly api: V11RemoteStudentApi,
    playthrough: V11RemotePlaythrough,
    outbox: OutboxStorage = createBrowserOutbox(),
  ) {
    this.outbox = outbox;
    this.kind = playthrough.kind;
    this.reportAvailable = playthrough.reportAvailable;
    const resumeScreen =
      playthrough.resumeScreen ??
      deriveV11ResumeScreen(
        playthrough.state,
        content.rounds.map((round) => round.roundId),
        playthrough.reportAvailable,
      );
    const needsResultRecovery =
      resumeScreen === 'round-result' && !playthrough.state.pendingRoundResult;
    this.current = {
      state: clone(playthrough.state),
      screenStack: [
        resumeScreen === 'round-result' || needsResultRecovery
          ? { id: 'round-result' }
          : resumeScreen === 'chapter-review'
            ? { id: 'chapter-review' }
            : resumeScreen === 'complete'
              ? { id: 'complete' }
              : resumeScreen === 'briefing'
                ? { id: 'briefing' }
                : { id: 'onboarding' },
      ],
      ...(needsResultRecovery
        ? { error: '这一步已提交，正在核对结算结果。请不要重复提交；点击下方按钮重新载入。' }
        : {}),
    };
  }

  get snapshot(): V11StudentSnapshot {
    return this.current;
  }
  get state(): V11GameState {
    return this.current.state;
  }
  get report(): GameReportV11 | undefined {
    return this.currentReport;
  }

  async loadReport(): Promise<void> {
    if (!this.reportAvailable || this.currentReport) return;
    this.currentReport = await this.api.report(this.token, this.playthroughId);
    this.setSnapshot({ notice: '复盘报告已经准备好。' });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async flushPending(): Promise<void> {
    const pending = await this.outbox.list(this.playthroughId);
    for (const item of pending) {
      if (!isV11Action(item.action)) continue;
      await this.submitQueued(item.action, item.idempotencyKey);
    }
  }

  async completeOnboarding(): Promise<void> {
    await this.dispatch({ type: 'onboarding_completed', payload: {} });
    this.setSnapshot({ screenStack: [{ id: 'briefing' }] });
  }

  openActionCenter(): void {
    if (this.top.id !== 'action-center') this.push({ id: 'action-center' });
  }
  openDashboard(): void {
    if (this.top.id !== 'dashboard') {
      this.push({ id: 'dashboard' });
      this.setSnapshot({ returnFocusTarget: 'dashboard-button' });
    }
  }
  openVisualCompare(): void {
    this.push({ id: 'visual-compare' });
    this.setSnapshot({ returnFocusTarget: 'visual-compare-trigger' });
  }
  back(): void {
    if (this.current.screenStack.length <= 1) return;
    const returnFocusTarget = this.current.returnFocusTarget;
    this.setSnapshot({
      screenStack: this.current.screenStack.slice(0, -1),
      returnFocusTarget: undefined,
    });
    if (returnFocusTarget) this.setSnapshot({ focusRequest: returnFocusTarget });
  }

  openReport(): void {
    if (this.state.roundIndex < this.content.rounds.length || this.state.pendingRoundResult)
      throw new Error('完成全部经营回合后才能打开报告');
    if (this.top.id !== 'report') this.push({ id: 'report' });
  }

  async selectChoice(choiceId: string): Promise<void> {
    const roundId = this.requireRoundId();
    const choice = this.content.rounds[this.state.roundIndex]?.choices.find(
      (item) => item.choiceId === choiceId,
    );
    if (!choice) throw new Error(`当前轮次不存在选择：${choiceId}`);
    this.setSnapshot({
      selectedChoiceId: choiceId,
      returnFocusTarget: `choice-${choiceId}`,
      error: undefined,
      screenStack: [
        ...this.current.screenStack.filter((screen) => screen.id !== 'choice-detail'),
        { id: 'choice-detail', choiceId },
      ],
    });
    await this.dispatch({ type: 'choice_previewed', roundId, payload: { choiceId } });
  }

  setActionStep(step: 'actions' | 'choices'): void {
    const stack = this.current.screenStack.map((screen) => ({ ...screen }));
    let index = -1;
    for (let cursor = stack.length - 1; cursor >= 0; cursor -= 1) {
      if (stack[cursor]?.id === 'action-center') {
        index = cursor;
        break;
      }
    }
    if (index < 0) return;
    stack[index] =
      step === 'actions' ? { id: 'action-center' } : { id: 'action-center', actionStep: step };
    this.setSnapshot({ screenStack: stack });
  }

  clearFocusRequest(): void {
    if (this.current.focusRequest) this.setSnapshot({ focusRequest: undefined });
  }

  async skipChoice(reason = '本轮先维持现状'): Promise<void> {
    const roundId = this.requireRoundId();
    await this.dispatch({ type: 'choice_skipped', roundId, payload: { reason } });
    await this.openSettledResult(roundId);
  }

  async viewEvidence(evidenceId: string): Promise<void> {
    await this.dispatch({
      type: 'evidence_viewed',
      roundId: this.requireRoundId(),
      payload: { evidenceId },
    });
  }
  async declareBrandIdentity(input: {
    brandName: string;
    namingIntent: string;
    personality: string;
    identityArchitecture: 'wordmark' | 'symbol' | 'ip';
  }): Promise<void> {
    await this.dispatch({
      type: 'brand_identity_declared',
      roundId: this.requireRoundId(),
      payload: input,
    });
  }
  async selectKeyPrediction(
    expectedMetric: 'conversion' | 'visualRecognition' | 'productDelivery' | 'trust',
  ): Promise<void> {
    const roundId = this.requireRoundId();
    await this.dispatch({
      type: 'key_prediction_selected',
      roundId,
      payload: { predictionId: `prediction-${roundId}`, expectedMetric },
    });
  }
  async introduceTerms(termIds: string[]): Promise<void> {
    const unseen = termIds.filter((termId) => !this.state.introducedTermIds.includes(termId));
    if (unseen.length > 0)
      await this.dispatch({
        type: 'terms_introduced',
        roundId: this.requireRoundId(),
        payload: { termIds: unseen },
      });
  }
  async doStageAction(actionId: string): Promise<void> {
    await this.dispatch({
      type: 'question_action_executed',
      roundId: this.requireRoundId(),
      payload: { actionId },
    });
  }
  async selectVisual(visualId: string): Promise<void> {
    await this.dispatch({
      type: 'visual_selected',
      roundId: this.requireRoundId(),
      payload: { visualId },
    });
  }
  async testVisual(testId: string): Promise<void> {
    await this.dispatch({
      type: 'visual_tested',
      roundId: this.requireRoundId(),
      payload: { testId, visualId: this.state.visualState.selectedVisualId },
    });
  }

  async selectRiskPlan(riskPlanId: string): Promise<void> {
    await this.dispatch({
      type: 'risk_plan_selected',
      roundId: this.requireRoundId(),
      payload: { riskPlanId },
    });
    this.setSnapshot({ selectedRiskPlanId: riskPlanId });
  }

  async commitChoice(
    choiceId = this.current.selectedChoiceId ?? '',
    riskPlanId = this.current.selectedRiskPlanId,
  ): Promise<void> {
    const roundId = this.requireRoundId();
    const choice = this.content.rounds[this.state.roundIndex]?.choices.find(
      (item) => item.choiceId === choiceId,
    );
    if (!choice) throw new Error(`当前轮次不存在选择：${choiceId}`);
    const compatibleRiskPlanId =
      riskPlanId && choice.riskPlanIds.includes(riskPlanId) ? riskPlanId : undefined;
    if (compatibleRiskPlanId && !this.state.selectedRiskPlans.includes(compatibleRiskPlanId))
      await this.selectRiskPlan(compatibleRiskPlanId);
    await this.dispatch({
      type: 'choice_committed',
      roundId,
      payload: {
        choiceId,
        decisionGroupId: `dg-${roundId}`,
        ...(compatibleRiskPlanId ? { riskPlanId: compatibleRiskPlanId } : {}),
      },
    });
    await this.openSettledResult(roundId, {
      selectedChoiceId: choiceId,
      selectedRiskPlanId: compatibleRiskPlanId,
    });
  }

  async recoverPendingResult(): Promise<boolean> {
    try {
      const response = await this.api.me(this.token, this.playthroughId);
      this.setSnapshot({
        state: clone(response.playthrough.state),
        error: undefined,
        notice: undefined,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '网络暂时不可用，请稍后重试';
      this.setSnapshot({ error: message });
      return false;
    }
    const result = this.state.pendingRoundResult;
    if (!result) {
      this.setSnapshot({
        error: '这一步已提交，正在核对结算结果。请不要重复提交；稍后可再试一次重新载入。',
      });
      return false;
    }
    this.setSnapshot({
      screenStack: [
        ...this.current.screenStack.filter((screen) => screen.id !== 'choice-detail'),
        { id: 'round-result' },
      ],
      error: undefined,
    });
    return true;
  }

  async acknowledgeResult(): Promise<void> {
    const roundId = this.requireRoundId();
    await this.dispatch({
      type: 'round_result_acknowledged',
      roundId,
      payload: { resultId: `result-${roundId}` },
    });
    const needsChapterReview = ['r02', 'r06', 'r09', 'r12'].includes(roundId);
    if (this.state.roundIndex >= this.content.rounds.length && !needsChapterReview)
      await this.loadReport();
    this.setSnapshot({
      selectedChoiceId: undefined,
      selectedRiskPlanId: undefined,
      screenStack: [
        needsChapterReview
          ? { id: 'chapter-review' }
          : this.state.roundIndex >= this.content.rounds.length
            ? { id: 'complete' }
            : { id: 'briefing' },
      ],
    });
  }

  async continueAfterChapterReview(): Promise<void> {
    const roundId = this.current.state.completedRoundIds.at(-1);
    if (
      roundId &&
      ['r02', 'r06', 'r09', 'r12'].includes(roundId) &&
      !(this.current.state.chapterReviews ?? []).includes(roundId)
    ) {
      await this.dispatch({ type: 'chapter_review_acknowledged', roundId, payload: {} });
    }
    if (this.current.state.roundIndex >= this.content.rounds.length) await this.loadReport();
    this.setSnapshot({
      screenStack: [
        {
          id: this.current.state.roundIndex >= this.content.rounds.length ? 'complete' : 'briefing',
        },
      ],
    });
  }

  exportSnapshot(): V11PersistedFlowSnapshot {
    return {
      version: 1,
      playthroughId: this.playthroughId,
      state: clone(this.state),
      screenStack: this.current.screenStack.map((screen) => ({ ...screen })),
      ...(this.current.selectedChoiceId ? { selectedChoiceId: this.current.selectedChoiceId } : {}),
      ...(this.current.selectedRiskPlanId
        ? { selectedRiskPlanId: this.current.selectedRiskPlanId }
        : {}),
      actionSequence: this.actionSequence,
    };
  }

  restoreSnapshot(input: V11PersistedFlowSnapshot): void {
    if (
      input.version !== 1 ||
      input.playthroughId !== this.playthroughId ||
      input.state.contentVersion !== this.content.contentVersion
    )
      throw new Error('页面记录与当前游戏不匹配，请回到班级入口重新进入。');
    this.actionSequence = input.actionSequence;
    this.setSnapshot({
      state: clone(input.state),
      screenStack: input.screenStack.map((screen) => ({ ...screen })),
      ...(input.selectedChoiceId
        ? { selectedChoiceId: input.selectedChoiceId }
        : { selectedChoiceId: undefined }),
      ...(input.selectedRiskPlanId
        ? { selectedRiskPlanId: input.selectedRiskPlanId }
        : { selectedRiskPlanId: undefined }),
      notice: '已恢复页面，正在核对最近进度。',
    });
  }

  private async dispatch(input: Omit<V11Action, 'actionId' | 'protocolVersion'>): Promise<void> {
    const logicalKey = stableJson(input);
    const existing = this.inFlight.get(logicalKey);
    if (existing) return existing;
    const operation = this.dispatchOnce(input);
    this.inFlight.set(logicalKey, operation);
    try {
      await operation;
    } finally {
      this.inFlight.delete(logicalKey);
    }
  }

  private async dispatchOnce(
    input: Omit<V11Action, 'actionId' | 'protocolVersion'>,
  ): Promise<void> {
    const pending = (await this.outbox.list(this.playthroughId)).find((item) =>
      isSameV11Action(item.action, input),
    );
    const action: V11Action =
      pending && isV11Action(pending.action)
        ? pending.action
        : { protocolVersion: '1.2', actionId: this.newCommandId(), ...input };
    const idempotencyKey = pending?.idempotencyKey ?? action.actionId;
    if (!pending)
      await this.outbox.put({
        idempotencyKey,
        playthroughId: this.playthroughId,
        action,
        createdAt: Date.now(),
      });
    await this.submitQueued(action, idempotencyKey);
  }

  private async submitQueued(action: V11Action, idempotencyKey: string): Promise<void> {
    try {
      const response = await this.api.submit(
        this.token,
        this.playthroughId,
        action,
        idempotencyKey,
      );
      await this.outbox.remove(idempotencyKey);
      this.reportAvailable = response.playthrough.reportAvailable;
      this.setSnapshot({
        state: clone(response.playthrough.state),
        notice: v11PlayerFeedback(this.content, action) ?? '进度已保存。',
        error: undefined,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '网络暂时不可用，请稍后重试';
      this.setSnapshot({ error: message });
      throw cause;
    }
  }

  private newCommandId(): string {
    this.actionSequence += 1;
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) return `remote-action-${randomUuid}`;
    return `remote-action-${this.playthroughId}-${this.state.traces.length}-${String(this.actionSequence).padStart(5, '0')}`;
  }

  private async openSettledResult(
    roundId: string,
    patch: Pick<V11StudentSnapshot, 'selectedChoiceId' | 'selectedRiskPlanId'> = {},
  ): Promise<void> {
    const result = this.state.pendingRoundResult;
    if (!result || result.roundId !== roundId) await this.recoverPendingResult();
    const recovered = this.state.pendingRoundResult;
    const hasCurrentResult = Boolean(recovered && recovered.roundId === roundId);
    this.setSnapshot({
      ...patch,
      screenStack: [
        ...this.current.screenStack.filter((screen) => screen.id !== 'choice-detail'),
        { id: 'round-result' },
      ],
      ...(hasCurrentResult
        ? { error: undefined }
        : { error: '这一步已提交，正在核对结算结果。请不要重复提交；点击下方按钮重新载入。' }),
    });
  }

  private get top(): V11Screen {
    return this.current.screenStack.at(-1) ?? { id: 'onboarding' };
  }
  private push(screen: V11Screen): void {
    this.setSnapshot({ screenStack: [...this.current.screenStack, screen] });
  }
  private requireRoundId(): string {
    const roundId = this.content.rounds[this.state.roundIndex]?.roundId;
    if (!roundId) throw new Error('游戏已经完成');
    return roundId;
  }
  private setSnapshot(patch: Partial<V11StudentSnapshot>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener();
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function isV11Action(value: { type: string }): value is V11Action {
  return 'protocolVersion' in value && 'actionId' in value && 'payload' in value;
}

function isSameV11Action(
  value: { type: string },
  input: Omit<V11Action, 'actionId' | 'protocolVersion'>,
): boolean {
  if (!isV11Action(value)) return false;
  const candidate = {
    type: value.type,
    ...(value.roundId ? { roundId: value.roundId } : {}),
    payload: value.payload,
  };
  return stableJson(candidate) === stableJson(input);
}

export function createV11RemoteFlow(
  token: string,
  seed: string,
  content: GameContentV11,
  api: V11RemoteStudentApi,
  playthrough: V11RemotePlaythrough,
): V11RemoteStudentFlow {
  return new V11RemoteStudentFlow(playthrough.id, seed, token, content, api, playthrough);
}
