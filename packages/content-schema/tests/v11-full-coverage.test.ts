import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateV11Content } from '../src/index.js';
import { compileV11Content } from '../src/compile-contract.js';
import { v11FullContent } from '../src/v11-full.js';

describe('v1.2 full course content coverage', () => {
  it('contains twelve rounds and sixty independently motivated choices', () => {
    const content = validateV11Content(v11FullContent);
    expect(content.rounds).toHaveLength(12);
    expect(content.rounds.every((round) => round.choices.length > 0)).toBe(true);
    expect(content.rounds.every((round) => round.choices.length === 5)).toBe(true);
    expect(content.rounds.flatMap((round) => round.choices)).toHaveLength(60);
    expect(
      new Set(content.rounds.flatMap((round) => round.choices.map((choice) => choice.choiceId)))
        .size,
    ).toBe(60);
    expect(
      new Set(content.rounds.flatMap((round) => round.choices.map((choice) => choice.label))).size,
    ).toBe(60);
  });

  it('keeps four strategic points for 2-4 point choices and exposes skipping only on the five optional rounds', () => {
    const content = validateV11Content(v11FullContent);
    expect(
      content.rounds.every(
        (round) =>
          round.freeActionPointBudget === 4 &&
          round.strategicActionPointBudget === 4 &&
          round.actionPointBudget === 8,
      ),
    ).toBe(true);
    expect(
      content.rounds.every((round) =>
        round.choices.every((choice) => choice.actionPointCost >= 2 && choice.actionPointCost <= 4),
      ),
    ).toBe(true);
    expect(
      new Set(
        content.rounds.flatMap((round) => round.choices.map((choice) => choice.actionPointCost)),
      ),
    ).toEqual(new Set([2, 3, 4]));
    expect(
      content.rounds
        .filter((round) => round.skipPolicy === 'allowed')
        .map((round) => round.roundId),
    ).toEqual(['r06', 'r07', 'r09', 'r10', 'r11']);
    expect(
      content.rounds
        .filter((round) => round.skipPolicy === 'forbidden')
        .map((round) => round.roundId),
    ).toEqual(['r01', 'r02', 'r03', 'r04', 'r05', 'r08', 'r12']);
  });

  it('provides plain-language first-use explanations for the visual and brand terms used in play', () => {
    const content = validateV11Content(v11FullContent);
    const terms = content.termGlossary ?? [];
    expect(terms.map((term) => term.label)).toEqual(
      expect.arrayContaining([
        '目标顾客',
        '人群匹配',
        '用户洞察',
        '品牌定位',
        '差异化',
        '品牌承诺',
        '品牌人格',
        '视觉语义',
        'LOGO',
        'VI',
        'IP',
        '品牌触点',
        '品牌一致性',
        '交付能力',
        '组织承接力',
        '文化可信度',
        '视觉识别',
        '视觉适配',
        '渠道依赖',
        '声誉负债',
        '购买转化',
        '复购',
        '风险预案',
      ]),
    );
    expect(
      terms.every((term) => term.plainDefinition.length <= 45 && term.example.length > 0),
    ).toBe(true);
    expect(
      terms.every(
        (term) => (term.relatedMetricKeys?.length ?? 0) > 0 && term.relatedTheoryIds.length > 0,
      ),
    ).toBe(true);
    expect(
      terms.every((term) =>
        content.rounds
          .find((round) => round.roundId === term.firstUseRoundId)
          ?.termRefs?.includes(term.termId),
      ),
    ).toBe(true);
  });

  it('keeps evidence, events, prices, visual systems and asset fallbacks publishable', () => {
    const content = validateV11Content(v11FullContent);
    expect(content.rounds.every((round) => round.evidence.length >= 2)).toBe(true);
    expect(
      content.rounds
        .filter((round) => round.isKeyRound)
        .every((round) => round.evidence.length >= 3),
    ).toBe(true);
    expect(content.events.length).toBeGreaterThanOrEqual(30);
    expect(
      content.events.filter((event) => event.conditions.length > 0).length / content.events.length,
    ).toBeGreaterThanOrEqual(0.7);
    expect(content.priceBaseline.length).toBeGreaterThanOrEqual(12);
    expect(
      content.priceBaseline.every((price) => price.source.length > 0 && price.asOf.length > 0),
    ).toBe(true);
    expect(content.visualSystems).toHaveLength(3);
    expect(
      content.visualSystems.every((visual) =>
        (
          [
            'storefront',
            'side-sign',
            'door-info',
            'menu-board',
            'order-card',
            'receipt',
            'cup',
            'cup-sleeve',
            'packaging',
            'avatar',
          ] as const
        ).every((touchpoint) => visual.touchpoints.includes(touchpoint)),
      ),
    ).toBe(true);
    const packagingRound = content.rounds.find((round) => round.roundId === 'r09');
    expect(packagingRound?.visualRequired).toBe(true);
    expect(packagingRound?.visualTests.map((test) => test.testId)).toEqual([
      'r09-package-carry',
      'r09-package-wet',
      'r09-package-fold',
      'r09-package-occlusion',
    ]);
    expect(content.assetManifest.length).toBeGreaterThan(0);
    expect(content.assetManifest.every((asset) => asset.fallbackKey.length > 0)).toBe(true);
    expect(content.assetManifest.filter((asset) => asset.assetType === 'visual')).toHaveLength(3);
    expect(content.endings.length).toBeGreaterThanOrEqual(15);
    expect(new Set(content.endings.map((ending) => ending.endingId)).size).toBe(
      content.endings.length,
    );
    expect(content.endings.every((ending) => ending.fallback || ending.conditions.length > 0)).toBe(
      true,
    );
    expect(content.endings.filter((ending) => ending.fallback)).toHaveLength(1);
    const visualStrategyRound = content.rounds.find((round) => round.roundId === 'r08');
    expect(visualStrategyRound?.choices.every((choice) => Boolean(choice.visualRouteId))).toBe(
      true,
    );
  });

  it('does not publish generic choice copy and compiles reproducibly', () => {
    const content = validateV11Content(v11FullContent);
    const visibleCopy = content.rounds
      .flatMap((round) => [
        round.title,
        round.briefing.situation,
        round.briefing.whyNow,
        round.briefing.dilemma,
        ...round.choices.flatMap((choice) => [
          choice.label,
          choice.summary,
          choice.detail,
          choice.primaryBenefit,
          choice.primaryRisk,
          choice.reportExplanation,
        ]),
      ])
      .join('\n');
    expect(visibleCopy).not.toMatch(
      /当前方案|primary|secondary|choiceId|cashCost|actionPointCost|该方案让团队获得|会在后续经营中继续检验这项取舍|你的品牌作业能否说明|洞察、产品和视觉形成闭环|共享体验会共享声誉风险|把承诺钉在一个日常场景|过窄的表达暂时限制扩散/,
    );
    expect(
      content.rounds.every((round) =>
        round.choices.every(
          (choice) => Boolean(choice.playerConsequence) && Boolean(choice.delayedRisk),
        ),
      ),
    ).toBe(true);
    const first = compileV11Content(content);
    const second = compileV11Content(content);
    expect(first.checksum).toBe(second.checksum);
  });

  it('gives every round concrete questions, actions and player-facing language', () => {
    const content = validateV11Content(v11FullContent);
    expect(content.rounds.every((round) => (round.decisionQuestions?.length ?? 0) >= 2)).toBe(true);
    const incompleteActions = content.rounds.flatMap((round) =>
      round.stageActions
        .filter(
          (action) =>
            !action.questionId ||
            !action.outputType ||
            !(
              (action.revealsEvidenceIds?.length ?? 0) > 0 ||
              (action.helpsCompareChoiceIds?.length ?? 0) > 0 ||
              Boolean(action.remainingUnknown)
            ),
        )
        .map((action) => `${round.roundId}:${action.actionId}`),
    );
    expect(incompleteActions).toEqual([]);
    for (const round of content.rounds) {
      const revealed = new Set(
        round.stageActions.flatMap((action) => action.revealsEvidenceIds ?? []),
      );
      expect(
        round.stageActions.every((action) => (action.revealsEvidenceIds?.length ?? 0) > 0),
      ).toBe(true);
      expect(round.evidence.every((evidence) => revealed.has(evidence.evidenceId))).toBe(true);
    }
    const firstRound = content.rounds.find((round) => round.roundId === 'r01');
    expect(
      firstRound?.stageActions.find((action) => action.actionId === 'r01-interview-neighbors')
        ?.revealsEvidenceIds,
    ).toEqual(['ev-r01-neighbor-interviews']);
    const playerCopy = JSON.stringify(content);
    for (const banned of [
      '做一次现场观察',
      '做一个小范围测试',
      '把投入和限制问清楚',
      '模拟老师要求',
      '服务端',
      '客户端',
      '正式结算',
      '内容版本',
      '本机存档',
      '后台也开始',
    ]) {
      expect(playerCopy).not.toContain(banned);
    }
    expect(
      content.rounds.every(
        (round) =>
          !round.resultPresentation.characterReactions.some((reaction) =>
            reaction.text.includes('这一步先记下来'),
          ),
      ),
    ).toBe(true);
    expect(content.achievements.map((achievement) => achievement.title)).not.toEqual(
      expect.arrayContaining(['先问再做', '先问再承诺']),
    );
  });

  it('keeps the checked-in published artifact aligned with the source content', async () => {
    const artifact = JSON.parse(
      await readFile(new URL('../../../content/compiled/v1.2.0.json', import.meta.url), 'utf8'),
    ) as { checksum: string };
    expect(artifact.checksum).toBe(compileV11Content(v11FullContent).checksum);
  });
});
