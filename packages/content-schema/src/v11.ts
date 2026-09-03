import { z } from 'zod';

export const CONTENT_SCHEMA_VERSION_V11 = 'v1.2.0';
export const ENGINE_VERSION_V11 = '1.2.0';
export const REPORT_VERSION_V11 = '1.2.0';

export const V11MetricKey = z.enum([
  'awareness',
  'conversion',
  'trust',
  'loyalty',
  'segmentFit',
  'differentiation',
  'brandConsistency',
  'promiseCredibility',
  'productDelivery',
  'orgCapacity',
  'culturalCredibility',
  'visualRecognition',
  'visualAdaptability',
  'channelDependence',
  'reputationDebt',
]);
export type V11MetricKey = z.infer<typeof V11MetricKey>;

export const V11Effect = z.object({
  key: V11MetricKey,
  amount: z.number().int(),
  timing: z.enum(['immediate', 'delayed']),
  label: z.string().min(1),
  theoryId: z.string().min(1),
});
export type V11Effect = z.infer<typeof V11Effect>;

export const V11Condition = z.discriminatedUnion('type', [
  z.object({ type: z.literal('metric_at_least'), key: V11MetricKey, value: z.number().int() }),
  z.object({ type: z.literal('metric_at_most'), key: V11MetricKey, value: z.number().int() }),
  z.object({ type: z.literal('choice_was'), choiceId: z.string().min(1) }),
  z.object({ type: z.literal('evidence_viewed'), evidenceId: z.string().min(1) }),
  z.object({ type: z.literal('risk_plan_selected'), riskPlanId: z.string().min(1) }),
  z.object({ type: z.literal('visual_was'), visualId: z.string().min(1) }),
]);
export type V11Condition = z.infer<typeof V11Condition>;

export const V11Briefing = z.object({
  situation: z.string().min(1),
  whyNow: z.string().min(1),
  dilemma: z.string().min(1),
  mustComplete: z.string().min(1),
  imageKey: z.string().min(1),
});
export type V11Briefing = z.infer<typeof V11Briefing>;

export const V11Theory = z.object({
  theoryId: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().min(1),
  transferPrompt: z.string().min(1),
});
export type V11Theory = z.infer<typeof V11Theory>;

const V11Angle = z.enum(['customer', 'cost', 'competition', 'delivery', 'culture', 'visual']);

export const V11EvidenceRelation = z.object({
  targetType: z.enum(['choice', 'riskPlan', 'visualSystem']),
  targetId: z.string().min(1),
  relation: z.enum(['supports', 'warns', 'contradicts', 'context']),
  strength: z.number().int().min(0).max(100),
  explanation: z.string().min(1),
});
export type V11EvidenceRelation = z.infer<typeof V11EvidenceRelation>;

export const V11Evidence = z.object({
  evidenceId: z.string().min(1),
  title: z.string().min(1),
  fact: z.string().min(1),
  implication: z.string().min(1),
  unknown: z.string().min(1),
  cashCostYuan: z.number().int().min(0),
  actionPointCost: z.number().int().min(1),
  angle: V11Angle,
  relations: z.array(V11EvidenceRelation),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type V11Evidence = z.infer<typeof V11Evidence>;

export const V11StageAction = z.object({
  actionId: z.string().min(1),
  actionType: z.enum(['research', 'quote', 'test', 'negotiate', 'risk_mitigation']),
  label: z.string().min(1),
  description: z.string().min(1),
  cashCostYuan: z.number().int().min(0),
  actionPointCost: z.number().int().min(1),
  durationDays: z.number().int().min(0),
  workload: z.number().int().min(0).max(100),
  theoryIds: z.array(z.string().min(1)).min(1),
  questionId: z.string().min(1).optional(),
  outputType: z.enum(['evidence', 'readiness', 'quote']).optional(),
  revealsEvidenceIds: z.array(z.string().min(1)).optional(),
  readinessEffects: z.array(V11Effect).optional(),
  helpsCompareChoiceIds: z.array(z.string().min(1)).optional(),
  remainingUnknown: z.string().min(1).optional(),
});
export type V11StageAction = z.infer<typeof V11StageAction>;

export const V11Choice = z.object({
  choiceId: z.string().min(1),
  label: z.string().min(1),
  summary: z.string().min(1),
  detail: z.string().min(1),
  cashCostYuan: z.number().int().min(0),
  actionPointCost: z.number().int().min(1),
  durationDays: z.number().int().min(0),
  workload: z.number().int().min(0).max(100),
  primaryBenefit: z.string().min(1),
  primaryRisk: z.string().min(1),
  evidenceRelations: z.array(z.string().min(1)),
  effects: z.array(V11Effect).min(1),
  riskPlanIds: z.array(z.string().min(1)),
  conditions: z.array(V11Condition).default([]),
  theoryIds: z.array(z.string().min(1)).min(1),
  reportExplanation: z.string().min(1),
  transferPrompt: z.string().min(1),
  /** Player-facing consequence: who sees what change as this choice lands. */
  playerConsequence: z.string().min(1).optional(),
  /** Player-facing delayed risk: when the trade-off may return to the store. */
  delayedRisk: z.string().min(1).optional(),
  /** A visual route that this choice must carry into later touchpoint checks. */
  visualRouteId: z.string().min(1).optional(),
  resultArtKey: z.string().min(1),
  motionCue: z.string().min(1),
});
export type V11Choice = z.infer<typeof V11Choice>;

export const V11RiskPlan = z.object({
  riskPlanId: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  targetRisk: z.string().min(1),
  cashCostYuan: z.number().int().min(0),
  actionPointCost: z.number().int().min(1),
  mitigationRatio: z.number().int().min(0).max(100),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type V11RiskPlan = z.infer<typeof V11RiskPlan>;

export const V11CharacterReaction = z.object({
  characterId: z.string().min(1),
  text: z.string().min(1),
  conditions: z.array(V11Condition).default([]),
});
export type V11CharacterReaction = z.infer<typeof V11CharacterReaction>;

export const V11ResultPresentation = z.object({
  resultArtKey: z.string().min(1),
  motionCue: z.string().min(1),
  characterReactions: z.array(V11CharacterReaction),
});
export type V11ResultPresentation = z.infer<typeof V11ResultPresentation>;

export const V11VisualTest = z.object({
  testId: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type V11VisualTest = z.infer<typeof V11VisualTest>;

export const V11Event = z.object({
  eventId: z.string().min(1),
  triggerRoundId: z.string().regex(/^r\d{2}$/),
  eventType: z.enum(['choice_triggered', 'condition', 'public', 'comic']),
  title: z.string().min(1),
  text: z.string().min(1),
  conditions: z.array(V11Condition),
  effects: z.array(V11Effect),
  theoryIds: z.array(z.string().min(1)).min(1),
  sourceNote: z.string().min(1),
});
export type V11Event = z.infer<typeof V11Event>;

export const V11PriceBaseline = z.object({
  priceId: z.string().min(1),
  item: z.string().min(1),
  amountYuan: z.number().int().min(0),
  source: z.string().min(1),
  asOf: z.string().min(1),
  note: z.string().min(1),
});
export type V11PriceBaseline = z.infer<typeof V11PriceBaseline>;

export const V11AssetManifest = z.object({
  assetKey: z.string().min(1),
  assetType: z.enum(['scene', 'result', 'visual', 'touchpoint', 'character', 'icon']),
  fallbackKey: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  priority: z.enum(['critical', 'normal', 'deferred']),
  recipe: z
    .object({
      baseKey: z.string().min(1),
      overlayKeys: z.array(z.string().min(1)),
    })
    .optional(),
});
export type V11AssetManifest = z.infer<typeof V11AssetManifest>;

export const V11Round = z.object({
  roundId: z.string().regex(/^r\d{2}$/),
  chapterId: z.string().regex(/^c\d$/),
  title: z.string().min(1),
  timelineLabel: z.string().min(1),
  isKeyRound: z.boolean().default(false),
  businessPhase: z.enum(['pre_open', 'operating']).default('pre_open'),
  targetElapsedDay: z.number().int().min(0).default(9999),
  fixedCostPerDayYuan: z.number().int().min(0).default(0),
  overdueFixedCostPerDayYuan: z.number().int().min(0).default(0),
  baseRevenueYuan: z.number().int().min(0).default(0),
  briefing: V11Briefing,
  actionPointBudget: z.number().int().min(1),
  freeActionPointBudget: z.number().int().min(0).default(4),
  strategicActionPointBudget: z.number().int().min(1).default(4),
  skipPolicy: z.enum(['forbidden', 'allowed']).default('forbidden'),
  skipDurationDays: z.number().int().min(0).default(3),
  decisionQuestions: z
    .array(
      z.object({
        questionId: z.string().min(1),
        prompt: z.string().min(1),
        context: z.string().min(1),
        actionIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .max(3)
    .optional(),
  knownFacts: z
    .array(z.object({ factId: z.string().min(1), text: z.string().min(1) }))
    .max(3)
    .optional(),
  stageActions: z.array(V11StageAction).min(1),
  evidence: z.array(V11Evidence).min(1),
  choices: z.array(V11Choice).min(1),
  riskPlans: z.array(V11RiskPlan),
  visualTests: z.array(V11VisualTest),
  visualRequired: z.boolean(),
  eventIds: z.array(z.string().min(1)),
  theoryIds: z.array(z.string().min(1)).min(1),
  resultPresentation: V11ResultPresentation,
  /** Terms that this round deliberately introduces or reuses in the player UI. */
  termRefs: z.array(z.string().min(1)).max(8).optional(),
});
export type V11Round = z.infer<typeof V11Round>;

export const V11VisualSystem = z.object({
  visualId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  touchpoints: z
    .array(z.enum(['storefront', 'cup', 'packaging', 'avatar', 'menu', 'social']))
    .min(3),
  matchFactors: z.object({
    customerFit: z.number().int().min(0).max(100),
    positionFit: z.number().int().min(0).max(100),
    productFit: z.number().int().min(0).max(100),
    cultureFit: z.number().int().min(0).max(100),
    priceFit: z.number().int().min(0).max(100),
    touchpointFit: z.number().int().min(0).max(100),
  }),
});
export type V11VisualSystem = z.infer<typeof V11VisualSystem>;

export const V11Achievement = z.object({
  achievementId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  conditions: z.array(V11Condition).min(1),
  reasonTemplate: z.string().min(1),
});
export type V11Achievement = z.infer<typeof V11Achievement>;

export const V11Ending = z.object({
  endingId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  conditions: z.array(V11Condition),
  minimumRoundsRequired: z.number().int().min(1),
  minimumDimensionsRequired: z.number().int().min(1),
  fallback: z.boolean().default(false),
});
export type V11Ending = z.infer<typeof V11Ending>;

export const V11Dimension = z.object({
  key: z.enum(['survival', 'customer', 'brand', 'consistency']),
  label: z.string().min(1),
  weight: z.number().int().min(0).max(100),
});
export type V11Dimension = z.infer<typeof V11Dimension>;

export const V11VictoryConfig = z.object({
  dimensions: z.array(V11Dimension).length(4),
  successLevel: z.enum(['formed_brand', 'sustainable', 'benchmark']),
});
export type V11VictoryConfig = z.infer<typeof V11VictoryConfig>;

export const V11MetricGlossary = z.record(
  z.string().min(1),
  z.object({
    label: z.string().min(1),
    subject: z.string().min(1),
    explanation: z.string().min(1),
  }),
);

export const V11TermGlossaryEntry = z.object({
  termId: z.string().min(1),
  label: z.string().min(1),
  firstUseRoundId: z.string().regex(/^r\d{2}$/),
  plainDefinition: z.string().min(1).max(45),
  inGameMeaning: z.string().min(1).max(70),
  example: z.string().min(1).max(70),
  relatedMetricKeys: z.array(V11MetricKey).min(1).optional(),
  relatedTheoryIds: z.array(z.string().min(1)).min(1),
});
export type V11TermGlossaryEntry = z.infer<typeof V11TermGlossaryEntry>;

export const V11GameContent = z.object({
  contentVersion: z.literal(CONTENT_SCHEMA_VERSION_V11),
  engineVersion: z.literal(ENGINE_VERSION_V11),
  reportVersion: z.literal(REPORT_VERSION_V11),
  priceBaselineVersion: z.string().min(1),
  onboardingSlides: z
    .array(
      z.object({
        slideId: z.string().min(1),
        title: z.string().min(1),
        body: z.string().min(1),
        imageKey: z.string().min(1),
      }),
    )
    .min(1),
  victoryConfig: V11VictoryConfig,
  metricGlossary: V11MetricGlossary,
  termGlossary: z.array(V11TermGlossaryEntry).optional(),
  events: z.array(V11Event).default([]),
  priceBaseline: z.array(V11PriceBaseline).default([]),
  assetManifest: z.array(V11AssetManifest).default([]),
  theories: z.array(V11Theory).min(1),
  rounds: z.array(V11Round).min(1),
  visualSystems: z.array(V11VisualSystem),
  achievements: z.array(V11Achievement),
  endings: z.array(V11Ending),
});
export type GameContentV11 = z.infer<typeof V11GameContent>;

function ensureUnique(ids: string[], label: string): void {
  if (new Set(ids).size !== ids.length) throw new Error(`重复的${label} ID`);
}

function ensureTheoryReferences(theoryIds: string[], theories: Set<string>, owner: string): void {
  for (const theoryId of theoryIds) {
    if (!theories.has(theoryId)) throw new Error(`${owner}引用了不存在的理论：${theoryId}`);
  }
}

function ensureConditionReferences(
  conditions: V11Condition[],
  references: {
    evidenceIds: Set<string>;
    choiceIds: Set<string>;
    riskPlanIds: Set<string>;
    visualIds: Set<string>;
  },
  owner: string,
): void {
  for (const condition of conditions) {
    const exists =
      condition.type === 'evidence_viewed'
        ? references.evidenceIds.has(condition.evidenceId)
        : condition.type === 'choice_was'
          ? references.choiceIds.has(condition.choiceId)
          : condition.type === 'risk_plan_selected'
            ? references.riskPlanIds.has(condition.riskPlanId)
            : condition.type === 'visual_was'
              ? references.visualIds.has(condition.visualId)
              : true;
    if (!exists) {
      const target =
        condition.type === 'evidence_viewed'
          ? condition.evidenceId
          : condition.type === 'choice_was'
            ? condition.choiceId
            : condition.type === 'risk_plan_selected'
              ? condition.riskPlanId
              : condition.type === 'visual_was'
                ? condition.visualId
                : condition.key;
      throw new Error(`${owner}引用了不存在的条件对象：${target}`);
    }
  }
}

export function validateV11Content(content: unknown): GameContentV11 {
  const parsed = V11GameContent.parse(content);
  const totalWeight = parsed.victoryConfig.dimensions.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight !== 100) throw new Error('四维评价权重必须合计100');
  ensureUnique(
    parsed.victoryConfig.dimensions.map((item) => item.key),
    '评价维度',
  );
  ensureUnique(
    parsed.theories.map((theory) => theory.theoryId),
    '理论',
  );
  ensureUnique(
    parsed.rounds.map((round) => round.roundId),
    '轮次',
  );
  ensureUnique(
    parsed.visualSystems.map((visual) => visual.visualId),
    '视觉系统',
  );
  ensureUnique(
    parsed.achievements.map((item) => item.achievementId),
    '成就',
  );
  ensureUnique(
    parsed.endings.map((item) => item.endingId),
    '结局',
  );

  const theoryIds = new Set(parsed.theories.map((theory) => theory.theoryId));
  const visualIds = new Set(parsed.visualSystems.map((visual) => visual.visualId));
  const roundIds = new Set(parsed.rounds.map((round) => round.roundId));
  const terms = parsed.termGlossary ?? [];
  ensureUnique(
    terms.map((term) => term.termId),
    '术语',
  );
  const termsById = new Map(terms.map((term) => [term.termId, term]));
  const roundOrder = new Map(parsed.rounds.map((round, index) => [round.roundId, index]));
  const referencedTermIds = new Set(parsed.rounds.flatMap((round) => round.termRefs ?? []));
  for (const term of terms) {
    if (referencedTermIds.has(term.termId) && !roundIds.has(term.firstUseRoundId))
      throw new Error(`术语 ${term.termId} 的首次出现轮次不存在：${term.firstUseRoundId}`);
    ensureTheoryReferences(term.relatedTheoryIds, theoryIds, `术语 ${term.termId}`);
  }
  for (const round of parsed.rounds) {
    if (round.evidence.length < 2) {
      throw new Error(`轮次 ${round.roundId} 至少需要2条调查`);
    }
    if (round.isKeyRound && round.evidence.length < 3) {
      throw new Error(`关键轮 ${round.roundId} 至少需要3条调查`);
    }
    if (
      round.freeActionPointBudget + round.strategicActionPointBudget !==
      round.actionPointBudget
    ) {
      throw new Error(`轮次 ${round.roundId} 的双层行动力必须等于总行动力`);
    }
    if (round.stageActions.some((item) => item.actionPointCost > round.freeActionPointBudget)) {
      throw new Error(`轮次 ${round.roundId} 的自由行动消耗超过自由行动力上限`);
    }
    ensureUnique(
      round.stageActions.map((item) => item.actionId),
      `轮次 ${round.roundId} 的行动`,
    );
    ensureUnique(
      round.evidence.map((item) => item.evidenceId),
      `轮次 ${round.roundId} 的证据`,
    );
    ensureUnique(
      round.choices.map((item) => item.choiceId),
      `轮次 ${round.roundId} 的选择`,
    );
    ensureUnique(
      round.riskPlans.map((item) => item.riskPlanId),
      `轮次 ${round.roundId} 的预案`,
    );
    ensureUnique(round.termRefs ?? [], `轮次 ${round.roundId} 的术语引用`);
    for (const termId of round.termRefs ?? []) {
      const term = termsById.get(termId);
      if (!term) throw new Error(`轮次 ${round.roundId} 引用了不存在的术语：${termId}`);
      if ((roundOrder.get(round.roundId) ?? 0) < (roundOrder.get(term.firstUseRoundId) ?? 0)) {
        throw new Error(`轮次 ${round.roundId} 过早引用了术语：${termId}`);
      }
    }
    ensureTheoryReferences(round.theoryIds, theoryIds, `轮次 ${round.roundId}`);
    const evidenceIds = new Set(round.evidence.map((item) => item.evidenceId));
    const choiceIds = new Set(round.choices.map((item) => item.choiceId));
    const riskPlanIds = new Set(round.riskPlans.map((item) => item.riskPlanId));
    const roundConditionReferences = { evidenceIds, choiceIds, riskPlanIds, visualIds };
    for (const item of round.stageActions)
      ensureTheoryReferences(item.theoryIds, theoryIds, `行动 ${item.actionId}`);
    for (const item of round.evidence) {
      ensureTheoryReferences(item.theoryIds, theoryIds, `证据 ${item.evidenceId}`);
      for (const relation of item.relations) {
        const exists =
          relation.targetType === 'choice'
            ? choiceIds.has(relation.targetId)
            : relation.targetType === 'riskPlan'
              ? riskPlanIds.has(relation.targetId)
              : visualIds.has(relation.targetId);
        if (!exists)
          throw new Error(`证据 ${item.evidenceId} 引用了不存在的关系对象：${relation.targetId}`);
      }
    }
    for (const item of round.riskPlans)
      ensureTheoryReferences(item.theoryIds, theoryIds, `预案 ${item.riskPlanId}`);
    for (const item of round.choices) {
      ensureTheoryReferences(item.theoryIds, theoryIds, `选择 ${item.choiceId}`);
      if (item.visualRouteId && !visualIds.has(item.visualRouteId)) {
        throw new Error(`选择 ${item.choiceId} 引用了不存在的视觉路线：${item.visualRouteId}`);
      }
      for (const evidenceId of item.evidenceRelations) {
        if (!evidenceIds.has(evidenceId))
          throw new Error(`选择 ${item.choiceId} 引用了不存在的证据：${evidenceId}`);
      }
      for (const riskPlanId of item.riskPlanIds) {
        if (!riskPlanIds.has(riskPlanId))
          throw new Error(`选择 ${item.choiceId} 引用了不存在的预案：${riskPlanId}`);
      }
      const timings = new Set(item.effects.map((effect) => effect.timing));
      if (!timings.has('immediate') || !timings.has('delayed')) {
        throw new Error(`选择 ${item.choiceId} 必须同时包含即时效果和延迟效果`);
      }
      for (const effect of item.effects)
        ensureTheoryReferences([effect.theoryId], theoryIds, `选择 ${item.choiceId} 的效果`);
    }
    for (const test of round.visualTests)
      ensureTheoryReferences(test.theoryIds, theoryIds, `视觉测试 ${test.testId}`);
    for (const reaction of round.resultPresentation.characterReactions) {
      ensureConditionReferences(
        reaction.conditions,
        roundConditionReferences,
        `角色反应 ${reaction.characterId}`,
      );
    }
  }
  const allConditionReferences = {
    evidenceIds: new Set(
      parsed.rounds.flatMap((round) => round.evidence.map((item) => item.evidenceId)),
    ),
    choiceIds: new Set(
      parsed.rounds.flatMap((round) => round.choices.map((item) => item.choiceId)),
    ),
    riskPlanIds: new Set(
      parsed.rounds.flatMap((round) => round.riskPlans.map((item) => item.riskPlanId)),
    ),
    visualIds,
  };
  ensureUnique(
    parsed.events.map((event) => event.eventId),
    '事件',
  );
  for (const event of parsed.events) {
    if (!roundIds.has(event.triggerRoundId))
      throw new Error(`事件 ${event.eventId} 引用了不存在的触发轮次：${event.triggerRoundId}`);
    ensureTheoryReferences(event.theoryIds, theoryIds, `事件 ${event.eventId}`);
    for (const effect of event.effects)
      ensureTheoryReferences([effect.theoryId], theoryIds, `事件 ${event.eventId} 的效果`);
    ensureConditionReferences(event.conditions, allConditionReferences, `事件 ${event.eventId}`);
  }
  for (const round of parsed.rounds) {
    for (const eventId of round.eventIds) {
      if (!parsed.events.some((event) => event.eventId === eventId))
        throw new Error(`轮次 ${round.roundId} 引用了不存在的事件：${eventId}`);
    }
  }
  if (parsed.assetManifest.length > 0) {
    ensureUnique(
      parsed.assetManifest.map((asset) => asset.assetKey),
      '资产',
    );
    const assetKeys = new Set(parsed.assetManifest.map((asset) => asset.assetKey));
    for (const asset of parsed.assetManifest) {
      if (!assetKeys.has(asset.fallbackKey))
        throw new Error(`资产 ${asset.assetKey} 的降级键不存在：${asset.fallbackKey}`);
      if (asset.recipe) {
        if (!assetKeys.has(asset.recipe.baseKey))
          throw new Error(`资产 ${asset.assetKey} 的底图键不存在：${asset.recipe.baseKey}`);
        for (const overlayKey of asset.recipe.overlayKeys) {
          if (!assetKeys.has(overlayKey))
            throw new Error(`资产 ${asset.assetKey} 的叠层键不存在：${overlayKey}`);
        }
      }
    }
    const referencedAssetKeys = [
      ...parsed.onboardingSlides.map((slide) => slide.imageKey),
      ...parsed.rounds.flatMap((round) => [
        round.briefing.imageKey,
        round.resultPresentation.resultArtKey,
        ...round.choices.map((choice) => choice.resultArtKey),
      ]),
    ];
    for (const assetKey of referencedAssetKeys) {
      if (!assetKeys.has(assetKey)) throw new Error(`内容引用了未登记的资产：${assetKey}`);
    }
  }
  const priceIds = new Set<string>();
  for (const price of parsed.priceBaseline) {
    if (priceIds.has(price.priceId)) throw new Error(`重复的价格 ID：${price.priceId}`);
    priceIds.add(price.priceId);
  }
  for (const ending of parsed.endings) {
    if (ending.minimumRoundsRequired < 3 || ending.minimumDimensionsRequired < 2)
      throw new Error(`结局 ${ending.endingId} 的综合条件不足`);
    ensureConditionReferences(ending.conditions, allConditionReferences, `结局 ${ending.endingId}`);
  }
  for (const achievement of parsed.achievements) {
    ensureTheoryReferences([], theoryIds, `成就 ${achievement.achievementId}`);
    ensureConditionReferences(
      achievement.conditions,
      allConditionReferences,
      `成就 ${achievement.achievementId}`,
    );
  }
  return parsed;
}
