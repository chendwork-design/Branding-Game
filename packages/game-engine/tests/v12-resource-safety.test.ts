import { describe, expect, it } from 'vitest';
import { v11FullContent, v11SliceContent, validateV11Content } from '@laojie/content-schema';
import {
  applyV11Action,
  canCommitV11Choice,
  createV11State,
  getV11RoundExitOptions,
  type V11Action,
} from '../src/index.js';

function action(
  actionId: string,
  type: V11Action['type'],
  roundId: string | undefined,
  payload: Record<string, unknown>,
): V11Action {
  return { protocolVersion: '1.1', actionId, type, ...(roundId ? { roundId } : {}), payload };
}

function oneRound(roundId: string) {
  const round = v11FullContent.rounds.find((item) => item.roundId === roundId);
  if (!round) throw new Error(`缺少测试轮次：${roundId}`);
  return validateV11Content({
    ...v11FullContent,
    rounds: [{ ...round, eventIds: [] }],
    events: [],
    achievements: [],
    endings: [],
  });
}

describe('v1.2 resource safety and exit rules', () => {
  it('keeps the strategic pool available when free actions use up the free budget', () => {
    const content = validateV11Content({
      ...v11SliceContent,
      events: [],
      achievements: [],
      endings: [],
      rounds: [v11SliceContent.rounds[0]!],
    });
    let state = createV11State(content.contentVersion, 'resource-safety');
    state = applyV11Action(
      state,
      content,
      action('intro', 'onboarding_completed', undefined, {}),
      'resource-seed',
    ).state;
    for (const [index, actionId] of [
      'r01-observe-footfall',
      'r01-interview-neighbors',
      'r01-quote-rent',
    ].entries()) {
      state = applyV11Action(
        state,
        content,
        action(`free-${index}`, 'stage_action_selected', 'r01', { actionId }),
        'resource-seed',
      ).state;
    }

    expect(state.freeActionPoints).toBe(0);
    expect(state.strategicActionPoints).toBe(4);
    expect(canCommitV11Choice(state, content, 'r01-neighbor').ok).toBe(true);
    expect(canCommitV11Choice(state, content, 'r01-hybrid').ok).toBe(true);

    state = applyV11Action(
      state,
      content,
      action('commit', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'resource-seed',
    ).state;
    expect(state.strategicActionPoints).toBe(1);
    expect(canCommitV11Choice(state, content, 'r01-hybrid').ok).toBe(false);
    expect(state.pendingRoundResult?.resultType).toBe('choice');
  });

  it('only exposes a skip exit on the five expressly optional rounds and records a real settlement', () => {
    const forbiddenContent = oneRound('r01');
    const forbiddenState = createV11State(forbiddenContent.contentVersion, 'skip-forbidden');
    expect(getV11RoundExitOptions(forbiddenState, forbiddenContent)).toEqual({
      canCommit: true,
      canSkip: false,
    });
    expect(() =>
      applyV11Action(
        forbiddenState,
        forbiddenContent,
        action('skip-r01', 'choice_skipped', 'r01', {}),
        'skip-seed',
      ),
    ).toThrow('本轮需要完成一项战略选择');

    const allowedContent = oneRound('r11');
    let allowedState = createV11State(allowedContent.contentVersion, 'skip-allowed');
    allowedState = applyV11Action(
      allowedState,
      allowedContent,
      action('intro-r11', 'onboarding_completed', undefined, {}),
      'skip-seed',
    ).state;
    expect(getV11RoundExitOptions(allowedState, allowedContent)).toEqual({
      canCommit: true,
      canSkip: true,
    });

    allowedState = applyV11Action(
      allowedState,
      allowedContent,
      action('skip-r11', 'choice_skipped', 'r11', { reason: '本轮先维持现状' }),
      'skip-seed',
    ).state;
    expect(allowedState.pendingRoundResult).toMatchObject({
      resultType: 'skip',
      choiceLabel: '本轮不新增战略方案',
    });
    expect(allowedState.completedRoundIds).toEqual(['r11']);
  });

  it('stores the student-declared brand identity as a deterministic game record', () => {
    const content = oneRound('r05');
    let state = createV11State(content.contentVersion, 'identity-record');
    state = applyV11Action(
      state,
      content,
      action('intro-r05', 'onboarding_completed', undefined, {}),
      'identity-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('identity-r05', 'brand_identity_declared', 'r05', {
        brandName: '一盏屯溪',
        namingIntent: '让通勤者把老街茶带进每天的午后',
        personality: '松弛、可靠、有一点幽默',
        identityArchitecture: 'wordmark',
      }),
      'identity-seed',
    ).state;

    expect(state.brandIdentity).toMatchObject({
      brandName: '一盏屯溪',
      identityArchitecture: 'wordmark',
    });
    expect(state.traces.at(-1)?.explanation).toContain('品牌名');
  });

  it('accepts readable Chinese and English brand names locally, without judging their quality', () => {
    const content = oneRound('r05');
    let state = createV11State(content.contentVersion, 'identity-format');
    state = applyV11Action(
      state,
      content,
      action('intro-r05-format', 'onboarding_completed', undefined, {}),
      'identity-seed',
    ).state;
    for (const [index, brandName] of ['一盏屯溪', 'Old Street Tea'].entries()) {
      const current =
        index === 0 ? state : createV11State(content.contentVersion, `identity-format-${index}`);
      const ready =
        index === 0
          ? current
          : applyV11Action(
              current,
              content,
              action(`intro-r05-format-${index}`, 'onboarding_completed', undefined, {}),
              'identity-seed',
            ).state;
      const result = applyV11Action(
        ready,
        content,
        action(`identity-format-${index}`, 'brand_identity_declared', 'r05', {
          brandName,
          namingIntent: '让顾客看见名称与日常场景的联系',
          personality: '可靠、松弛',
          identityArchitecture: 'wordmark',
        }),
        'identity-seed',
      ).state;
      expect(result.brandIdentity?.brandName).toBe(brandName);
    }
    expect(() =>
      applyV11Action(
        state,
        content,
        action('identity-unsafe', 'brand_identity_declared', 'r05', {
          brandName: '☕☕',
          namingIntent: '测试',
          personality: '可靠',
          identityArchitecture: 'wordmark',
        }),
        'identity-seed',
      ),
    ).toThrow('品牌名请用');
  });

  it('records first-use terms once and rejects a term from another round', () => {
    const content = oneRound('r05');
    let state = createV11State(content.contentVersion, 'term-record');
    state = applyV11Action(
      state,
      content,
      action('intro-term', 'onboarding_completed', undefined, {}),
      'term-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('terms-r05', 'terms_introduced', 'r05', {
        termIds: ['brand-personality', 'logo'],
      }),
      'term-seed',
    ).state;
    expect(state.introducedTermIds).toEqual(['brand-personality', 'logo']);
    expect(() =>
      applyV11Action(
        state,
        content,
        action('terms-invalid', 'terms_introduced', 'r05', {
          termIds: ['brand-promise'],
        }),
        'term-seed',
      ),
    ).toThrow('没有可介绍');
  });

  it('allows at most one paid risk plan in the same round', () => {
    const r01 = v11FullContent.rounds.find((round) => round.roundId === 'r01')!;
    const primary = r01.riskPlans[0]!;
    const content = validateV11Content({
      ...v11FullContent,
      rounds: [
        {
          ...r01,
          riskPlans: [
            primary,
            { ...primary, riskPlanId: 'risk-r01-second', label: '第二份备用预案' },
          ],
          eventIds: [],
        },
      ],
      events: [],
      achievements: [],
      endings: [],
    });
    let state = createV11State(content.contentVersion, 'one-risk-per-round');
    state = applyV11Action(
      state,
      content,
      action('intro-risk', 'onboarding_completed', undefined, {}),
      'risk-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('risk-primary', 'risk_plan_selected', 'r01', { riskPlanId: primary.riskPlanId }),
      'risk-seed',
    ).state;
    expect(() =>
      applyV11Action(
        state,
        content,
        action('risk-second', 'risk_plan_selected', 'r01', { riskPlanId: 'risk-r01-second' }),
        'risk-seed',
      ),
    ).toThrow('本轮已经配置过一项风险预案');
  });

  it('records one lightweight prediction only on the four key rounds without changing settlement', () => {
    const content = oneRound('r01');
    let state = createV11State(content.contentVersion, 'prediction-record');
    state = applyV11Action(
      state,
      content,
      action('intro-prediction', 'onboarding_completed', undefined, {}),
      'prediction-seed',
    ).state;
    const before = { cash: state.cashYuan, ap: state.stageActionPoints };
    state = applyV11Action(
      state,
      content,
      action('prediction-r01', 'key_prediction_selected', 'r01', {
        predictionId: 'prediction-r01',
        expectedMetric: 'conversion',
      }),
      'prediction-seed',
    ).state;
    expect(state.predictions).toEqual([
      {
        predictionId: 'prediction-r01',
        roundId: 'r01',
        label: 'conversion',
        expectedRisk: 'conversion',
      },
    ]);
    expect({ cash: state.cashYuan, ap: state.stageActionPoints }).toEqual(before);
  });

  it('records chapter-review acknowledgement without changing resources or advancing the next round', () => {
    const content = validateV11Content({
      ...v11FullContent,
      events: [],
      achievements: [],
      endings: [],
      rounds: v11FullContent.rounds.slice(0, 2).map((round) => ({ ...round, eventIds: [] })),
    });
    let state = createV11State(content.contentVersion, 'chapter-review');
    state = applyV11Action(
      state,
      content,
      action('chapter-intro', 'onboarding_completed', undefined, {}),
      'chapter-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('chapter-r01', 'choice_committed', 'r01', {
        choiceId: 'r01-neighbor',
        decisionGroupId: 'dg-r01',
      }),
      'chapter-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('chapter-r01-ack', 'round_result_acknowledged', 'r01', { resultId: 'result-r01' }),
      'chapter-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('chapter-r02', 'choice_committed', 'r02', {
        choiceId: 'r02-anchor',
        decisionGroupId: 'dg-r02',
      }),
      'chapter-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('chapter-r02-ack', 'round_result_acknowledged', 'r02', { resultId: 'result-r02' }),
      'chapter-seed',
    ).state;
    const before = {
      cash: state.cashYuan,
      elapsedDays: state.elapsedDays,
      roundIndex: state.roundIndex,
    };

    const result = applyV11Action(
      state,
      content,
      action('chapter-review-ack', 'chapter_review_acknowledged', 'r02', {}),
      'chapter-seed',
    );

    expect(result.state.chapterReviews).toEqual(['r02']);
    expect(result.state.roundIndex).toBe(before.roundIndex);
    expect(result.state.cashYuan).toBe(before.cash);
    expect(result.state.elapsedDays).toBe(before.elapsedDays);
    expect(result.trace.explanation).toContain('经营体检');
    expect(() =>
      applyV11Action(
        result.state,
        content,
        action('chapter-review-duplicate', 'chapter_review_acknowledged', 'r02', {}),
        'chapter-seed',
      ),
    ).toThrow('已经确认过');
  });

  it('derives a deterministic scene recipe for each result on the server side', () => {
    const content = oneRound('r08');
    const choice = content.rounds[0]!.choices[0]!;
    let state = createV11State(content.contentVersion, 'result-recipe');
    state = applyV11Action(
      state,
      content,
      action('intro-recipe', 'onboarding_completed', undefined, {}),
      'recipe-seed',
    ).state;
    state = applyV11Action(
      state,
      content,
      action('visual-recipe', 'visual_selected', 'r08', { visualId: 'v-line' }),
      'recipe-seed',
    ).state;
    const first = applyV11Action(
      state,
      content,
      action('commit-recipe', 'choice_committed', 'r08', {
        choiceId: choice.choiceId,
        decisionGroupId: 'dg-r08',
      }),
      'recipe-seed',
    ).state.pendingRoundResult;
    const second = applyV11Action(
      state,
      content,
      action('commit-recipe-again', 'choice_committed', 'r08', {
        choiceId: choice.choiceId,
        decisionGroupId: 'dg-r08',
      }),
      'recipe-seed',
    ).state.pendingRoundResult;

    expect(first).toMatchObject({
      sceneKey: 'result-r08',
      routeOverlayKey: 'route-v-line',
    });
    expect(['stable', 'strained', 'crisis']).toContain(first?.outcomeState);
    expect(first?.sceneKey).toBe(second?.sceneKey);
    expect(first?.outcomeState).toBe(second?.outcomeState);
    expect(first?.routeOverlayKey).toBe(second?.routeOverlayKey);
  });
});
