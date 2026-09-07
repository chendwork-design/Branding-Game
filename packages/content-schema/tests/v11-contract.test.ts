import { describe, expect, it } from 'vitest';
import { compileV11Content } from '../src/compile-contract.js';
import { V11AssetManifest, validateV11Content, type GameContentV11 } from '../src/v11.js';

const effect = {
  key: 'trust' as const,
  amount: 4,
  timing: 'immediate' as const,
  label: '顾客愿意再试一次',
  theoryId: 't-trust',
};

const delayedEffect = {
  ...effect,
  amount: 3,
  timing: 'delayed' as const,
  label: '熟客关系逐渐稳定',
};

const v11Fixture: GameContentV11 = {
  contentVersion: 'v1.3.0',
  engineVersion: '1.2.0',
  reportVersion: '1.2.0',
  priceBaselineVersion: 'prices-2026-08',
  onboardingSlides: [
    {
      slideId: 's1',
      title: '你的处境',
      body: '你接手了屯溪老街的一间空铺。',
      imageKey: 'onboarding-place',
    },
  ],
  victoryConfig: {
    dimensions: [
      { key: 'survival', label: '经营生存', weight: 25 },
      { key: 'customer', label: '顾客资产', weight: 25 },
      { key: 'brand', label: '品牌资产', weight: 30 },
      { key: 'consistency', label: '系统一致性', weight: 20 },
    ],
    successLevel: 'formed_brand',
  },
  metricGlossary: {
    trust: { label: '信任', subject: '顾客', explanation: '顾客是否相信你的承诺。' },
  },
  events: [],
  priceBaseline: [],
  assetManifest: [],
  theories: [
    {
      theoryId: 't-trust',
      title: '承诺要能交付',
      explanation: '说出口的承诺最终会回到体验。',
      transferPrompt: '你的作业如何证明承诺被兑现？',
    },
  ],
  rounds: [
    {
      roundId: 'r01',
      chapterId: 'c1',
      title: '先确定服务谁',
      timelineLabel: '第1月上旬',
      isKeyRound: false,
      businessPhase: 'pre_open',
      targetElapsedDay: 9999,
      fixedCostPerDayYuan: 0,
      overdueFixedCostPerDayYuan: 0,
      baseRevenueYuan: 0,
      briefing: {
        situation: '空铺即将装修。',
        whyNow: '如果现在不确定客群，后面的产品和视觉都会摇摆。',
        dilemma: '服务附近居民，还是先追游客流量？',
        mustComplete: '确定第一批要服务的人。',
        imageKey: 'briefing-r01',
      },
      actionPointBudget: 6,
      freeActionPointBudget: 4,
      strategicActionPointBudget: 2,
      skipPolicy: 'forbidden',
      skipDurationDays: 3,
      stageActions: [
        {
          actionId: 'research-r01-footfall',
          actionType: 'research',
          label: '观察客流',
          description: '记录不同时间段的人流和停留理由。',
          cashCostYuan: 0,
          actionPointCost: 1,
          durationDays: 1,
          workload: 1,
          theoryIds: ['t-trust'],
        },
      ],
      evidence: [
        {
          evidenceId: 'ev-r01-footfall',
          title: '一周客流观察',
          fact: '周末游客多，工作日居民更稳定。',
          implication: '两类人的购买理由并不相同。',
          unknown: '还不知道哪类人愿意复购。',
          cashCostYuan: 0,
          actionPointCost: 1,
          angle: 'customer',
          relations: [
            {
              targetType: 'choice',
              targetId: 'r01-local',
              relation: 'supports',
              strength: 60,
              explanation: '居民客流支持日常复购路线。',
            },
          ],
          theoryIds: ['t-trust'],
        },
        {
          evidenceId: 'ev-r01-competition',
          title: '同街门店观察',
          fact: '相邻门店已经在争夺拍照客流。',
          implication: '单靠醒目不一定形成差异。',
          unknown: '尚未知道游客会比较什么。',
          cashCostYuan: 0,
          actionPointCost: 1,
          angle: 'competition',
          relations: [],
          theoryIds: ['t-trust'],
        },
      ],
      choices: [
        {
          choiceId: 'r01-local',
          label: '先服务附近居民',
          summary: '从日常复购开始建立关系。',
          detail: '先做稳定、容易复购的茶饮和服务。',
          cashCostYuan: 18000,
          actionPointCost: 3,
          durationDays: 5,
          workload: 3,
          primaryBenefit: '复购基础更稳',
          primaryRisk: '前期声量较慢',
          evidenceRelations: ['ev-r01-footfall'],
          effects: [effect, delayedEffect],
          riskPlanIds: [],
          conditions: [],
          theoryIds: ['t-trust'],
          reportExplanation: '聚焦客群可以让承诺和服务更具体。',
          transferPrompt: '你的品牌方案为谁服务？',
          resultArtKey: 'result-r01-local',
          motionCue: 'counter-warm',
        },
      ],
      riskPlans: [
        {
          riskPlanId: 'risk-r01-repeat',
          label: '先做一周复购观察',
          description: '用小范围试卖确认居民是否愿意回来。',
          targetRisk: '复购不足',
          cashCostYuan: 2000,
          actionPointCost: 1,
          mitigationRatio: 30,
          theoryIds: ['t-trust'],
        },
      ],
      visualTests: [],
      visualRequired: false,
      eventIds: [],
      theoryIds: ['t-trust'],
      resultPresentation: {
        resultArtKey: 'result-r01-local',
        motionCue: 'counter-warm',
        characterReactions: [],
      },
    },
  ],
  visualSystems: [],
  achievements: [],
  endings: [],
};

describe('v1.3 content contract', () => {
  it('accepts the smallest complete round with multi-angle evidence and costs', () => {
    const parsed = validateV11Content(v11Fixture);
    expect(parsed.contentVersion).toBe('v1.3.0');
    expect(parsed.rounds[0]?.evidence).toHaveLength(2);
    expect(parsed.rounds[0]?.choices[0]?.cashCostYuan).toBe(18000);
  });

  it('compiles a validated v1.3 content fixture with a stable checksum', () => {
    const first = compileV11Content(v11Fixture);
    const second = compileV11Content(v11Fixture);
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(first.checksum).toBe(second.checksum);
  });

  it('rejects a round with only one investigation', () => {
    expect(() =>
      validateV11Content({
        ...v11Fixture,
        rounds: [
          {
            ...v11Fixture.rounds[0]!,
            evidence: [v11Fixture.rounds[0]!.evidence[0]!],
          },
        ],
      }),
    ).toThrow('至少需要2条调查');
  });

  it('rejects a choice without an immediate and a delayed consequence', () => {
    expect(() =>
      validateV11Content({
        ...v11Fixture,
        rounds: [
          {
            ...v11Fixture.rounds[0]!,
            choices: [
              {
                ...v11Fixture.rounds[0]!.choices[0]!,
                effects: [effect],
              },
            ],
          },
        ],
      }),
    ).toThrow('即时效果和延迟效果');
  });

  it('accepts composited asset recipes with a base and explicit overlays', () => {
    const asset = V11AssetManifest.parse({
      assetKey: 'briefing-r01',
      assetType: 'scene',
      fallbackKey: 'asset-placeholder',
      width: 640,
      height: 420,
      priority: 'critical',
      recipe: { baseKey: 'scene-atlas.svg', overlayKeys: ['briefing-r01'] },
    });
    expect(asset.recipe).toEqual({ baseKey: 'scene-atlas.svg', overlayKeys: ['briefing-r01'] });
  });
});
