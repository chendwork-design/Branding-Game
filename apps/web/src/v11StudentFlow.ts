import { v11SliceContent, type GameContentV11 } from '@laojie/content-schema';
import {
  applyV11Action,
  createV11State,
  type V11Action,
  type V11GameState,
} from '@laojie/game-engine';
import type { GameReportV11 } from '@laojie/report-engine';
import { v11PlayerFeedback } from './v11PlayerFeedback.js';

export type V11ScreenId =
  | 'onboarding'
  | 'briefing'
  | 'action-center'
  | 'dashboard'
  | 'visual-compare'
  | 'choice-detail'
  | 'round-result'
  | 'chapter-review'
  | 'complete'
  | 'report';

export interface V11Screen {
  id: V11ScreenId;
  choiceId?: string;
  actionStep?: 'actions' | 'choices';
}

export interface V11StudentSnapshot {
  state: V11GameState;
  screenStack: V11Screen[];
  selectedChoiceId?: string | undefined;
  selectedRiskPlanId?: string | undefined;
  returnFocusTarget?: string | undefined;
  focusRequest?: string | undefined;
  notice?: string | undefined;
  error?: string | undefined;
}

export interface V11PersistedFlowSnapshot {
  version: 1;
  playthroughId: string;
  state: V11GameState;
  screenStack: V11Screen[];
  selectedChoiceId?: string;
  selectedRiskPlanId?: string;
  actionSequence: number;
}

export interface V11StudentFlowLike {
  readonly playthroughId: string;
  readonly content: GameContentV11;
  readonly snapshot: V11StudentSnapshot;
  readonly state: V11GameState;
  readonly report: GameReportV11 | undefined;
  readonly syncLabel?: string;
  subscribe(listener: Listener): () => void;
  completeOnboarding(): void | Promise<void>;
  openActionCenter(): void;
  openDashboard(): void;
  openReport(): void;
  openVisualCompare(): void;
  back(): void;
  selectChoice(choiceId: string): void | Promise<void>;
  setActionStep(step: 'actions' | 'choices'): void;
  clearFocusRequest(): void;
  selectKeyPrediction(
    expectedMetric: 'conversion' | 'visualRecognition' | 'productDelivery' | 'trust',
  ): Promise<void>;
  introduceTerms(termIds: string[]): Promise<void>;
  declareBrandIdentity(input: {
    brandName: string;
    namingIntent: string;
    personality: string;
    identityArchitecture: 'wordmark' | 'symbol' | 'ip';
  }): Promise<void>;
  skipChoice(reason?: string): void | Promise<void>;
  viewEvidence(evidenceId: string): Promise<void>;
  doStageAction(actionId: string): Promise<void>;
  selectVisual(visualId: string): Promise<void>;
  testVisual(testId: string): Promise<void>;
  selectRiskPlan(riskPlanId: string): Promise<void>;
  commitChoice(choiceId?: string, riskPlanId?: string): Promise<void>;
  recoverPendingResult(): Promise<boolean>;
  acknowledgeResult(): Promise<void>;
  continueAfterChapterReview(): void | Promise<void>;
  exportSnapshot(): V11PersistedFlowSnapshot;
  restoreSnapshot(input: V11PersistedFlowSnapshot): void;
}

type Listener = () => void;

/**
 * A small event-driven adapter for the student UI.
 *
 * It deliberately has no persistence, clock, network, or random source. The
 * API/server adapter can use the same action methods later; the visible
 * interaction is already tested against the authoritative v1.1 engine.
 */
export class V11StudentFlow {
  readonly content: GameContentV11;
  private readonly listeners = new Set<Listener>();
  private actionSequence = 0;
  private current: V11StudentSnapshot;

  get report(): GameReportV11 | undefined {
    return undefined;
  }

  constructor(
    readonly playthroughId: string,
    readonly seed = 'v11-ui-demo-seed',
    initialState?: V11GameState,
    content: GameContentV11 = v11SliceContent,
  ) {
    this.content = content;
    this.current = {
      state: initialState ?? createV11State(content.contentVersion, playthroughId),
      screenStack: [{ id: 'onboarding' }],
    };
  }

  get snapshot(): V11StudentSnapshot {
    return this.current;
  }

  get state(): V11GameState {
    return this.current.state;
  }

  get currentRound() {
    return this.content.rounds[this.state.roundIndex];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  completeOnboarding(): void {
    this.dispatch({ type: 'onboarding_completed', payload: {} });
    this.replaceStack([{ id: 'briefing' }]);
  }

  openActionCenter(): void {
    if (this.topScreen.id !== 'action-center') this.push({ id: 'action-center' });
  }

  openDashboard(): void {
    if (this.topScreen.id !== 'dashboard') {
      this.push({ id: 'dashboard' });
      this.setSnapshot({ returnFocusTarget: 'dashboard-button' });
    }
  }

  openReport(): void {
    if (this.state.roundIndex < this.content.rounds.length || this.state.pendingRoundResult) {
      throw new Error('完成全部经营回合后才能打开报告');
    }
    if (this.topScreen.id !== 'report') this.push({ id: 'report' });
  }

  openVisualCompare(): void {
    this.push({ id: 'visual-compare' });
    this.setSnapshot({ returnFocusTarget: 'visual-compare-trigger' });
  }

  back(): void {
    if (this.current.screenStack.length <= 1) return;
    const returnFocusTarget = this.current.returnFocusTarget;
    this.replaceStack(this.current.screenStack.slice(0, -1));
    if (returnFocusTarget)
      this.setSnapshot({ focusRequest: returnFocusTarget, returnFocusTarget: undefined });
  }

  selectChoice(choiceId: string): void {
    if (this.current.selectedChoiceId !== choiceId) {
      const roundId = this.currentRound?.roundId;
      if (!roundId) throw new Error('游戏已经完成');
      this.dispatch({
        type: 'choice_previewed',
        roundId,
        payload: { choiceId },
      });
    }
    this.setSnapshot({
      selectedChoiceId: choiceId,
      returnFocusTarget: `choice-${choiceId}`,
      error: undefined,
      screenStack: [
        ...this.current.screenStack.filter((screen) => screen.id !== 'choice-detail'),
        { id: 'choice-detail', choiceId },
      ],
    });
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

  async viewEvidence(evidenceId: string): Promise<void> {
    this.dispatch({
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
    this.dispatch({
      type: 'brand_identity_declared',
      roundId: this.requireRoundId(),
      payload: input,
    });
  }

  async selectKeyPrediction(
    expectedMetric: 'conversion' | 'visualRecognition' | 'productDelivery' | 'trust',
  ): Promise<void> {
    const roundId = this.requireRoundId();
    this.dispatch({
      type: 'key_prediction_selected',
      roundId,
      payload: { predictionId: `prediction-${roundId}`, expectedMetric },
    });
  }

  async introduceTerms(termIds: string[]): Promise<void> {
    const unseen = termIds.filter((termId) => !this.state.introducedTermIds.includes(termId));
    if (unseen.length === 0) return;
    this.dispatch({
      type: 'terms_introduced',
      roundId: this.requireRoundId(),
      payload: { termIds: unseen },
    });
  }

  async doStageAction(actionId: string): Promise<void> {
    this.dispatch({
      type: 'question_action_executed',
      roundId: this.requireRoundId(),
      payload: { actionId },
    });
  }

  async selectVisual(visualId: string): Promise<void> {
    this.dispatch({
      type: 'visual_selected',
      roundId: this.requireRoundId(),
      payload: { visualId },
    });
  }

  async testVisual(testId: string): Promise<void> {
    this.dispatch({
      type: 'visual_tested',
      roundId: this.requireRoundId(),
      payload: { testId, visualId: this.state.visualState.selectedVisualId },
    });
  }

  async selectRiskPlan(riskPlanId: string): Promise<void> {
    this.dispatch({
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
    if (compatibleRiskPlanId && !this.state.selectedRiskPlans.includes(compatibleRiskPlanId)) {
      await this.selectRiskPlan(compatibleRiskPlanId);
    }
    this.dispatch({
      type: 'choice_committed',
      roundId,
      payload: {
        choiceId,
        decisionGroupId: `dg-${roundId}`,
        ...(compatibleRiskPlanId ? { riskPlanId: compatibleRiskPlanId } : {}),
      },
    });
    this.setSnapshot({
      selectedChoiceId: choiceId,
      selectedRiskPlanId: compatibleRiskPlanId,
      screenStack: [
        ...this.current.screenStack.filter((screen) => screen.id !== 'choice-detail'),
        { id: 'round-result' },
      ],
    });
  }

  async skipChoice(reason = '本轮先维持现状'): Promise<void> {
    const roundId = this.requireRoundId();
    this.dispatch({ type: 'choice_skipped', roundId, payload: { reason } });
    this.setSnapshot({
      screenStack: [
        ...this.current.screenStack.filter((screen) => screen.id !== 'choice-detail'),
        { id: 'round-result' },
      ],
    });
  }

  async recoverPendingResult(): Promise<boolean> {
    if (this.state.pendingRoundResult) return true;
    this.setSnapshot({ error: '这一步的结算结果暂时没有读取到，请返回班级入口后重新进入本局。' });
    return false;
  }

  async acknowledgeResult(): Promise<void> {
    const roundId = this.requireRoundId();
    this.dispatch({
      type: 'round_result_acknowledged',
      roundId,
      payload: { resultId: `result-${roundId}` },
    });
    const needsChapterReview = ['r02', 'r06', 'r09', 'r12'].includes(roundId);
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

  continueAfterChapterReview(): void {
    const roundId = this.state.completedRoundIds.at(-1);
    if (
      roundId &&
      ['r02', 'r06', 'r09', 'r12'].includes(roundId) &&
      !(this.state.chapterReviews ?? []).includes(roundId)
    ) {
      this.dispatch({ type: 'chapter_review_acknowledged', roundId, payload: {} });
    }
    this.replaceStack([
      { id: this.state.roundIndex >= this.content.rounds.length ? 'complete' : 'briefing' },
    ]);
  }

  exportSnapshot(): V11PersistedFlowSnapshot {
    return {
      version: 1,
      playthroughId: this.playthroughId,
      state: JSON.parse(JSON.stringify(this.state)) as V11GameState,
      screenStack: this.current.screenStack.map((screen) => ({ ...screen })),
      ...(this.current.selectedChoiceId ? { selectedChoiceId: this.current.selectedChoiceId } : {}),
      ...(this.current.selectedRiskPlanId
        ? { selectedRiskPlanId: this.current.selectedRiskPlanId }
        : {}),
      actionSequence: this.actionSequence,
    };
  }

  restoreSnapshot(input: V11PersistedFlowSnapshot): void {
    if (input.version !== 1) throw new Error('当前进度无法继续使用，请重新开始这一局。');
    if (input.playthroughId !== this.playthroughId)
      throw new Error('这份进度不属于当前这局游戏，请从最近一次进度进入。');
    if (input.state.contentVersion !== this.content.contentVersion)
      throw new Error('课程内容已更新，请重新开始这一局。');
    const validScreenIds = new Set<V11ScreenId>([
      'onboarding',
      'briefing',
      'action-center',
      'dashboard',
      'visual-compare',
      'choice-detail',
      'round-result',
      'chapter-review',
      'complete',
      'report',
    ]);
    if (
      input.screenStack.length === 0 ||
      input.screenStack.some((screen) => !validScreenIds.has(screen.id))
    )
      throw new Error('当前页面进度无效，请重新进入游戏。');
    this.actionSequence = input.actionSequence;
    this.setSnapshot({
      state: JSON.parse(JSON.stringify(input.state)) as V11GameState,
      screenStack: input.screenStack.map((screen) => ({ ...screen })),
      ...(input.selectedChoiceId
        ? { selectedChoiceId: input.selectedChoiceId }
        : { selectedChoiceId: undefined }),
      ...(input.selectedRiskPlanId
        ? { selectedRiskPlanId: input.selectedRiskPlanId }
        : { selectedRiskPlanId: undefined }),
      error: undefined,
      notice: '已恢复本机进度。',
    });
  }

  private get topScreen(): V11Screen {
    return this.current.screenStack[this.current.screenStack.length - 1] ?? { id: 'onboarding' };
  }

  private requireRoundId(): string {
    const roundId = this.currentRound?.roundId;
    if (!roundId) throw new Error('游戏已经完成');
    return roundId;
  }

  private dispatch(input: Omit<V11Action, 'actionId' | 'protocolVersion'>): void {
    const action: V11Action = {
      protocolVersion: '1.2',
      actionId: `ui-action-${String(++this.actionSequence).padStart(4, '0')}`,
      ...input,
    };
    try {
      const result = applyV11Action(this.state, this.content, action, this.seed);
      this.setSnapshot({
        state: result.state,
        notice: v11PlayerFeedback(this.content, action),
        error: undefined,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '这个动作暂时不能执行';
      this.setSnapshot({ error: message });
      throw cause;
    }
  }

  private push(screen: V11Screen): void {
    this.setSnapshot({ screenStack: [...this.current.screenStack, screen], error: undefined });
  }

  private replaceStack(screenStack: V11Screen[]): void {
    this.setSnapshot({ screenStack, error: undefined });
  }

  private setSnapshot(patch: Partial<V11StudentSnapshot>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener();
  }
}
