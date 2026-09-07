import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha256.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type {
  Choice,
  Condition,
  Effect,
  GameContent,
  MetricKey,
  Round,
  VisualTest,
} from '@laojie/content-schema';

export const ENGINE_VERSION = '0.1.0';

export type EngineRoute = 'legacy' | 'v1.1' | 'v1.2';

export function resolveEngineVersion(input: {
  contentVersion: string;
  engineVersion: string;
}): EngineRoute {
  if (input.contentVersion === 'v1.0.0' && input.engineVersion === ENGINE_VERSION) return 'legacy';
  if (input.contentVersion === 'v1.1.0' && input.engineVersion === '1.1.0') return 'v1.1';
  if (
    (input.contentVersion === 'v1.2.0' || input.contentVersion === 'v1.3.0') &&
    input.engineVersion === '1.2.0'
  )
    return 'v1.2';
  throw new Error('内容版本与引擎版本不兼容');
}

export type { V11GameState, V11ResumeScreen } from './v11.js';
export { createV11State, deriveV11ResumeScreen, ENGINE_VERSION_V11 } from './v11.js';
export {
  applyV11Action,
  canCommitV11Choice,
  canExecuteV11Action,
  getV11RoundExitOptions,
  hashV11Content,
  hashV11State,
  replayV11,
  type V11ApplyResult,
} from './v11-runtime.js';
export { deriveV11RouteProfile, scoreV11State, type V11ScoreResult } from './v11-scoring.js';
export {
  simulateV11,
  simulateV11Strategies,
  type V11SimulationReport,
  type V11SimulationStrategy,
  type V11StrategyReport,
  type V11StrategySimulationReport,
} from './v11-simulation.js';
export type {
  FinancialLedgerEntryV11,
  PendingEffectV11,
  RiskOutcomeV11,
  RouteProfileV11,
  ScoreBreakdownV11,
  V11Action,
  V11EvidenceAdjustment,
  V11RoundResult,
  V11TraceEntry,
  V11TriggeredEvent,
  V11VisualDiagnostic,
} from './v11.js';

export type Metrics = Record<MetricKey, number>;

export interface Action {
  actionId: string;
  type:
    | 'evidence_viewed'
    | 'choice_previewed'
    | 'intent_selected'
    | 'risk_selected'
    | 'choice_selected'
    | 'visual_selected'
    | 'visual_revised'
    | 'visual_tested';
  roundId: string;
  payload: Record<string, string | number | boolean>;
}

export interface DecisionRecord extends Action {
  sequence: number;
  atRoundIndex: number;
}

export interface EffectTrace {
  key: MetricKey;
  amount: number;
  timing: 'immediate' | 'delayed';
  label: string;
  theoryId: string;
  sourceDecisionId: string;
  dueRoundIndex?: number;
}

export interface EventTrace {
  eventId: string;
  title: string;
  sourceDecisionId: string;
  effects: EffectTrace[];
}

export interface VisualTestResult {
  testId: VisualTest['testId'];
  visualId: string;
  passed: boolean;
  score: number;
  explanation: string;
}

export interface TraceEntry {
  sequence: number;
  actionId: string;
  roundId: string;
  actionType: Action['type'];
  before: Metrics;
  after: Metrics;
  immediateEffects: EffectTrace[];
  delayedEffects: EffectTrace[];
  scheduledDelayedEffects: EffectTrace[];
  settledDelayedEffects: EffectTrace[];
  events: EventTrace[];
  visualTest?: VisualTestResult;
  explanation: string;
  theoryIds: string[];
}

export interface GameState {
  contentVersion: string;
  engineVersion: string;
  playthroughId: string;
  roundIndex: number;
  completedRoundIds: string[];
  metrics: Metrics;
  viewedEvidenceIds: string[];
  selectedVisualId?: string;
  visualRevision?: string;
  visualTestResults: VisualTestResult[];
  pendingEffects: EffectTrace[];
  triggeredEventIds: string[];
  tags: string[];
  decisions: DecisionRecord[];
  traces: TraceEntry[];
  lastFeedback: string[];
  unlockedConceptIds: string[];
  earnedAchievementIds: string[];
  endingId?: string;
}

export interface ApplyResult {
  state: GameState;
  trace: TraceEntry;
  stateHash: string;
}

export interface ApplyOptions {
  skipStateHash?: boolean;
}

const VISIBLE_KEYS = new Set<MetricKey>([
  'cash',
  'awareness',
  'conversion',
  'trust',
  'loyalty',
  'actionPoints',
]);

const INITIAL_METRICS: Metrics = {
  cash: 80,
  awareness: 10,
  conversion: 15,
  trust: 50,
  loyalty: 5,
  actionPoints: 100,
  segmentFit: 30,
  differentiation: 50,
  brandConsistency: 30,
  promiseCredibility: 30,
  productDelivery: 40,
  orgCapacity: 50,
  culturalCredibility: 40,
  visualRecognition: 20,
  visualAdaptability: 20,
  channelDependence: 0,
  reputationDebt: 0,
};

function cloneMetrics(metrics: Metrics): Metrics {
  return { ...metrics };
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`)
    .join(',')}}`;
}

export function hashState(state: GameState): string {
  return bytesToHex(sha256(utf8ToBytes(stableValue(state))));
}

export function deriveNumber(seed: string, key: string, max = 100): number {
  const digest = hmac(sha256, utf8ToBytes(seed), utf8ToBytes(key));
  const number =
    (digest[0] ?? 0) * 2 ** 24 +
    (digest[1] ?? 0) * 2 ** 16 +
    (digest[2] ?? 0) * 2 ** 8 +
    (digest[3] ?? 0);
  return number % max;
}

export function createInitialState(content: GameContent, playthroughId: string): GameState {
  return {
    contentVersion: content.contentVersion,
    engineVersion: content.engineVersion,
    playthroughId,
    roundIndex: 0,
    completedRoundIds: [],
    metrics: cloneMetrics(INITIAL_METRICS),
    viewedEvidenceIds: [],
    visualTestResults: [],
    pendingEffects: [],
    triggeredEventIds: [],
    tags: [],
    decisions: [],
    traces: [],
    lastFeedback: [],
    unlockedConceptIds: [],
    earnedAchievementIds: [],
  };
}

function currentRound(state: GameState, content: GameContent): Round {
  const round = content.rounds[state.roundIndex];
  if (!round) throw new Error('游戏已经完成');
  return round;
}

function actionValue(action: Action, key: string): string | number | boolean | undefined {
  return action.payload[key];
}

function numericMetric(state: GameState, key: MetricKey): number {
  return state.metrics[key];
}

function conditionMatches(condition: Condition, state: GameState): boolean {
  switch (condition.type) {
    case 'metric_at_least':
      return numericMetric(state, condition.key) >= condition.value;
    case 'metric_at_most':
      return numericMetric(state, condition.key) <= condition.value;
    case 'tag_present':
      return state.tags.includes(condition.tag);
    case 'choice_was':
      return state.decisions.some(
        (decision) => actionValue(decision, 'choiceId') === condition.choiceId,
      );
  }
}

function allConditionsMatch(conditions: Condition[], state: GameState): boolean {
  return conditions.every((condition) => conditionMatches(condition, state));
}

function clampMetric(key: MetricKey, value: number): number {
  if (key === 'cash' || key === 'actionPoints') return Math.max(0, Math.min(100, value));
  if (key === 'reputationDebt' || key === 'channelDependence')
    return Math.max(0, Math.min(100, value));
  return Math.max(0, Math.min(100, value));
}

function makeEffect(effect: Effect, sourceDecisionId: string, dueRoundIndex?: number): EffectTrace {
  return { ...effect, sourceDecisionId, ...(dueRoundIndex === undefined ? {} : { dueRoundIndex }) };
}

function applyEffects(state: GameState, effects: EffectTrace[]): void {
  for (const effect of effects) {
    state.metrics[effect.key] = clampMetric(effect.key, state.metrics[effect.key] + effect.amount);
  }
}

function selectChoice(round: Round, choiceId: string): Choice {
  const choice = round.choices.find((candidate) => candidate.choiceId === choiceId);
  if (!choice) throw new Error(`当前轮次不存在选择：${choiceId}`);
  return choice;
}

function settleDelayed(state: GameState, roundIndex: number): EffectTrace[] {
  const due = state.pendingEffects.filter(
    (effect) => effect.dueRoundIndex !== undefined && effect.dueRoundIndex <= roundIndex,
  );
  state.pendingEffects = state.pendingEffects.filter((effect) => !due.includes(effect));
  applyEffects(state, due);
  return due;
}

function triggerEvents(
  state: GameState,
  round: Round,
  content: GameContent,
  seed: string,
  sourceDecisionId: string,
): EventTrace[] {
  const traces: EventTrace[] = [];
  for (const eventId of round.eventIds) {
    const event = content.events.find((candidate) => candidate.eventId === eventId);
    if (
      !event ||
      state.triggeredEventIds.includes(event.eventId) ||
      !allConditionsMatch(event.conditions, state)
    )
      continue;
    const roll = deriveNumber(
      seed,
      `${state.playthroughId}:${event.eventId}:${state.decisions.length}`,
    );
    if (roll >= event.probability) continue;
    const effects = event.effects.map((effect) =>
      makeEffect(
        effect,
        sourceDecisionId,
        effect.timing === 'delayed' ? state.roundIndex + 1 : undefined,
      ),
    );
    const immediate = effects.filter((effect) => effect.timing === 'immediate');
    applyEffects(state, immediate);
    state.pendingEffects.push(...effects.filter((effect) => effect.timing === 'delayed'));
    state.triggeredEventIds.push(event.eventId);
    traces.push({ eventId: event.eventId, title: event.title, sourceDecisionId, effects });
    if (event.once) state.tags.push(`event:${event.eventId}`);
  }
  return traces;
}

function updateProgressTags(state: GameState, round: Round, action: Action): void {
  if (action.type === 'choice_selected') {
    if (round.chapterId === 'c1') state.tags.push('segment_decided');
    if (round.chapterId === 'c2') state.tags.push('promise_tested');
    if (round.chapterId === 'c4') state.tags.push('growth_event');
  }
  if (action.type === 'visual_tested') state.tags.push('visual_tested');
  state.tags = [...new Set(state.tags)];
}

function applyVisualTestWithContent(
  state: GameState,
  round: Round,
  action: Action,
  content: GameContent,
): VisualTestResult {
  const testId = actionValue(action, 'testId');
  if (typeof testId !== 'string') throw new Error('缺少视觉测试类型');
  const visualTest = round.visualTests.find((test) => test.testId === testId);
  if (!visualTest) throw new Error(`当前轮次不存在视觉测试：${testId}`);
  const visualId = state.selectedVisualId;
  if (!visualId) throw new Error('请先选择视觉方案');
  if (state.visualTestResults.some((result) => result.testId === visualTest.testId))
    throw new Error('该视觉测试已经完成');
  const visual = content.visualSystems.find((candidate) => candidate.visualId === visualId);
  if (!visual) throw new Error(`不存在的视觉方案：${visualId}`);
  const score =
    visualTest.testId === 'sign_3_second'
      ? visual.attributes.recognitionStrength
      : visualTest.testId === 'mobile_shrink'
        ? visual.attributes.smallSizeLegibility
        : visualTest.testId === 'competitor_comparison'
          ? visual.attributes.storefrontDistinctiveness
          : visual.attributes.packagingRobustness;
  const passed = score >= 65;
  const result: VisualTestResult = {
    testId: visualTest.testId,
    visualId,
    passed,
    score,
    explanation: passed
      ? `${visual.name} 在这项测试中可以继续工作。`
      : `${visual.name} 在这项测试中暴露了适配问题。`,
  };
  state.visualTestResults.push(result);
  const key: MetricKey =
    visualTest.testId === 'competitor_comparison'
      ? 'differentiation'
      : visualTest.testId === 'packaging_stress'
        ? 'visualAdaptability'
        : 'visualRecognition';
  state.metrics[key] = clampMetric(key, state.metrics[key] + (passed ? 5 : -3));
  return result;
}

function endingFor(state: GameState, content: GameContent): string | undefined {
  return [...content.endings]
    .sort((a, b) => b.priority - a.priority)
    .find((ending) => allConditionsMatch(ending.conditions, state))?.endingId;
}

function updateUnlocks(state: GameState, content: GameContent): void {
  for (const card of content.conceptCards)
    if (state.tags.includes(card.unlockTag) && !state.unlockedConceptIds.includes(card.conceptId))
      state.unlockedConceptIds.push(card.conceptId);
  for (const achievement of content.achievements)
    if (
      state.tags.includes(achievement.unlockTag) &&
      !state.earnedAchievementIds.includes(achievement.achievementId)
    )
      state.earnedAchievementIds.push(achievement.achievementId);
}

export function applyAction(
  stateInput: GameState,
  content: GameContent,
  action: Action,
  seed: string,
  options: ApplyOptions = {},
): ApplyResult {
  const state: GameState = structuredClone(stateInput);
  const round = currentRound(state, content);
  if (action.roundId !== round.roundId) throw new Error(`动作轮次错误，当前是 ${round.roundId}`);
  const before = cloneMetrics(state.metrics);
  const sequence = state.decisions.length + 1;
  const record: DecisionRecord = { ...action, sequence, atRoundIndex: state.roundIndex };
  const immediateEffects: EffectTrace[] = [];
  const delayedEffects: EffectTrace[] = [];
  const scheduledDelayedEffects: EffectTrace[] = [];
  const settledDelayedEffects: EffectTrace[] = [];
  const events: EventTrace[] = [];
  let visualTest: VisualTestResult | undefined;
  let explanation = '你记录了一个经营动作。';

  if (action.type === 'evidence_viewed') {
    const evidenceId = actionValue(action, 'evidenceId');
    const evidence = round.evidence.find((item) => item.evidenceId === evidenceId);
    if (!evidence) throw new Error('当前轮次不存在该证据');
    if (!state.viewedEvidenceIds.includes(evidence.evidenceId)) {
      state.viewedEvidenceIds.push(evidence.evidenceId);
      state.metrics.actionPoints = clampMetric(
        'actionPoints',
        state.metrics.actionPoints - evidence.cost,
      );
      explanation = `你花费 ${evidence.cost} 点行动力换取了现场信息。`;
    }
  } else if (
    action.type === 'choice_previewed' ||
    action.type === 'intent_selected' ||
    action.type === 'risk_selected'
  ) {
    explanation =
      action.type === 'choice_previewed'
        ? '你比较了这个方案的诱因和顾虑。'
        : '你记录了对结果的预判。';
  } else if (action.type === 'visual_selected') {
    if (!round.visualRequired) throw new Error('当前轮次不需要视觉方案');
    const visualId = actionValue(action, 'visualId');
    if (
      typeof visualId !== 'string' ||
      !content.visualSystems.some((visual) => visual.visualId === visualId)
    )
      throw new Error('视觉方案不存在');
    state.selectedVisualId = visualId;
    explanation = '你把一个视觉系统放进了真实触点，而不是只看一张效果图。';
  } else if (action.type === 'visual_revised') {
    if (!state.selectedVisualId) throw new Error('请先选择视觉方案');
    if (state.visualRevision) throw new Error('每局视觉方案只能修改一次');
    const revision = actionValue(action, 'revision');
    if (typeof revision !== 'string' || revision.length < 2)
      throw new Error('视觉修改说明不能为空');
    state.visualRevision = revision;
    explanation = '你使用了唯一一次修改权，承认方案需要进入现实后再调整。';
  } else if (action.type === 'visual_tested') {
    visualTest = applyVisualTestWithContent(state, round, action, content);
    explanation = visualTest.explanation;
  } else if (action.type === 'choice_selected') {
    if (round.visualRequired && !state.selectedVisualId)
      throw new Error('完成本轮前必须选择视觉方案');
    const choiceId = actionValue(action, 'choiceId');
    if (typeof choiceId !== 'string') throw new Error('缺少选择');
    const choice = selectChoice(round, choiceId);
    if (!allConditionsMatch(choice.conditions, state))
      throw new Error('当前状态尚未满足该选择条件');
    const settled = settleDelayed(state, state.roundIndex);
    delayedEffects.push(...settled);
    settledDelayedEffects.push(...settled);
    const effects = choice.effects.map((effect) =>
      makeEffect(
        effect,
        action.actionId,
        effect.timing === 'delayed' ? state.roundIndex + 1 : undefined,
      ),
    );
    immediateEffects.push(...effects.filter((effect) => effect.timing === 'immediate'));
    const scheduledChoiceEffects = effects.filter((effect) => effect.timing === 'delayed');
    delayedEffects.push(...scheduledChoiceEffects);
    scheduledDelayedEffects.push(...scheduledChoiceEffects);
    applyEffects(state, immediateEffects);
    state.pendingEffects.push(...scheduledChoiceEffects);
    events.push(...triggerEvents(state, round, content, seed, action.actionId));
    const eventEffects = events.flatMap((event) => event.effects);
    const eventImmediateEffects = eventEffects.filter((effect) => effect.timing === 'immediate');
    const scheduledEventEffects = eventEffects.filter((effect) => effect.timing === 'delayed');
    immediateEffects.push(...eventImmediateEffects);
    delayedEffects.push(...scheduledEventEffects);
    scheduledDelayedEffects.push(...scheduledEventEffects);
    state.completedRoundIds.push(round.roundId);
    state.roundIndex += 1;
    explanation = choice.consequenceText;
  }

  state.decisions.push(record);
  updateProgressTags(state, round, action);
  updateUnlocks(state, content);
  if (state.roundIndex >= content.rounds.length) {
    const ending = endingFor(state, content);
    if (ending) state.endingId = ending;
  }
  const trace: TraceEntry = {
    sequence,
    actionId: action.actionId,
    roundId: action.roundId,
    actionType: action.type,
    before,
    after: cloneMetrics(state.metrics),
    immediateEffects,
    delayedEffects,
    scheduledDelayedEffects,
    settledDelayedEffects,
    events,
    ...(visualTest ? { visualTest } : {}),
    explanation,
    theoryIds: round.theoryIds,
  };
  state.traces.push(trace);
  state.lastFeedback = [explanation, ...events.map((event) => event.title)].slice(0, 3);
  return { state, trace, stateHash: options.skipStateHash ? '' : hashState(state) };
}

export function replay(
  content: GameContent,
  playthroughId: string,
  seed: string,
  actions: Action[],
): GameState {
  let state = createInitialState(content, playthroughId);
  for (const action of actions)
    state = applyAction(state, content, action, seed, { skipStateHash: true }).state;
  return state;
}

export function getCurrentRound(state: GameState, content: GameContent): Round | undefined {
  return content.rounds[state.roundIndex];
}

export function visibleMetrics(state: GameState): Partial<Metrics> {
  return Object.fromEntries(
    Object.entries(state.metrics).filter(([key]) => VISIBLE_KEYS.has(key as MetricKey)),
  ) as Partial<Metrics>;
}
