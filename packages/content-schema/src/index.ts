import { z } from 'zod';

export const CONTENT_SCHEMA_VERSION = '0.1.0';

export const MetricKey = z.enum([
  'cash',
  'awareness',
  'conversion',
  'trust',
  'loyalty',
  'actionPoints',
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
export type MetricKey = z.infer<typeof MetricKey>;

export const Effect = z.object({
  key: MetricKey,
  amount: z.number().int(),
  timing: z.enum(['immediate', 'delayed']),
  label: z.string().min(1),
  theoryId: z.string().min(1),
});
export type Effect = z.infer<typeof Effect>;

export const Condition = z.discriminatedUnion('type', [
  z.object({ type: z.literal('metric_at_least'), key: MetricKey, value: z.number().int() }),
  z.object({ type: z.literal('metric_at_most'), key: MetricKey, value: z.number().int() }),
  z.object({ type: z.literal('tag_present'), tag: z.string().min(1) }),
  z.object({ type: z.literal('choice_was'), choiceId: z.string().min(1) }),
]);
export type Condition = z.infer<typeof Condition>;

export const Evidence = z.object({
  evidenceId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  cost: z.number().int().min(0),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type Evidence = z.infer<typeof Evidence>;

export const Choice = z.object({
  choiceId: z.string().min(1),
  label: z.string().min(1),
  temptation: z.string().min(1),
  statedBenefit: z.string().min(1),
  statedConcern: z.string().min(1),
  effects: z.array(Effect).min(1),
  conditions: z.array(Condition).default([]),
  consequenceText: z.string().min(1),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type Choice = z.infer<typeof Choice>;

export const VisualSystem = z.object({
  visualId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  attributes: z.object({
    recognitionStrength: z.number().int().min(0).max(100),
    smallSizeLegibility: z.number().int().min(0).max(100),
    storefrontDistinctiveness: z.number().int().min(0).max(100),
    packagingRobustness: z.number().int().min(0).max(100),
    culturalCredibility: z.number().int().min(0).max(100),
    brandConsistency: z.number().int().min(0).max(100),
    touchpointAdaptability: z.number().int().min(0).max(100),
    productionCost: z.number().int().min(0).max(100),
  }),
  touchpoints: z.array(z.enum(['storefront', 'cup', 'packaging', 'avatar'])).min(4),
});
export type VisualSystem = z.infer<typeof VisualSystem>;

export const VisualTest = z.object({
  testId: z.enum(['sign_3_second', 'mobile_shrink', 'competitor_comparison', 'packaging_stress']),
  title: z.string().min(1),
  prompt: z.string().min(1),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type VisualTest = z.infer<typeof VisualTest>;

export const GameEvent = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  conditions: z.array(Condition).default([]),
  probability: z.number().int().min(0).max(100),
  effects: z.array(Effect).min(1),
  classWide: z.boolean(),
  once: z.boolean().default(true),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type GameEvent = z.infer<typeof GameEvent>;

export const Theory = z.object({
  theoryId: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().min(1),
  transferPrompt: z.string().min(1),
});
export type Theory = z.infer<typeof Theory>;

export const Round = z.object({
  roundId: z.string().regex(/^r\d{2}$/),
  chapterId: z.string().regex(/^c\d$/),
  title: z.string().min(1),
  openingScene: z.string().min(1),
  goal: z.string().min(1),
  evidence: z.array(Evidence),
  choices: z.array(Choice).min(2),
  visualTests: z.array(VisualTest),
  visualRequired: z.boolean(),
  eventIds: z.array(z.string().min(1)),
  theoryIds: z.array(z.string().min(1)).min(1),
});
export type Round = z.infer<typeof Round>;

export const Ending = z.object({
  endingId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  conditions: z.array(Condition),
  priority: z.number().int(),
});
export type Ending = z.infer<typeof Ending>;

export const ConceptCard = z.object({
  conceptId: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().min(1),
  sourceTheoryId: z.string().min(1),
  unlockTag: z.string().min(1),
});
export type ConceptCard = z.infer<typeof ConceptCard>;

export const Achievement = z.object({
  achievementId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  unlockTag: z.string().min(1),
});
export type Achievement = z.infer<typeof Achievement>;

export const Character = z.object({
  characterId: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  agenda: z.string().min(1),
});
export type Character = z.infer<typeof Character>;

export const DiscussionTopic = z.object({
  topicId: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  relatedTheoryIds: z.array(z.string().min(1)).min(1),
});
export type DiscussionTopic = z.infer<typeof DiscussionTopic>;

export const GameContent = z.object({
  contentVersion: z.string().min(1),
  engineVersion: z.string().min(1),
  rounds: z.array(Round).min(1),
  events: z.array(GameEvent),
  visualSystems: z.array(VisualSystem).min(1),
  theories: z.array(Theory).min(1),
  endings: z.array(Ending).min(1),
  conceptCards: z.array(ConceptCard),
  achievements: z.array(Achievement),
  characters: z.array(Character).default([]),
  discussionTopics: z.array(DiscussionTopic).default([]),
});
export type GameContent = z.infer<typeof GameContent>;

export { v11SliceContent } from './v11-slice.js';
export { v11FullContent } from './v11-full.js';

export {
  CONTENT_SCHEMA_VERSION_V11,
  ENGINE_VERSION_V11 as CONTENT_ENGINE_VERSION_V11,
  REPORT_VERSION_V11,
  V11Achievement,
  V11Briefing,
  V11Choice,
  V11Condition,
  V11Dimension,
  V11Effect,
  V11Ending,
  V11Event,
  V11Evidence,
  V11EvidenceRelation,
  V11GameContent,
  V11MetricGlossary,
  V11MetricKey,
  V11AssetManifest,
  V11PriceBaseline,
  V11ResultPresentation,
  V11RiskPlan,
  V11Round,
  V11StageAction,
  V11Theory,
  V11VisualSystem,
  V11VisualTest,
  validateV11Content,
} from './v11.js';

export type {
  GameContentV11,
  V11Achievement as V11AchievementType,
  V11Briefing as V11BriefingType,
  V11Choice as V11ChoiceType,
  V11Condition as V11ConditionType,
  V11Dimension as V11DimensionType,
  V11Effect as V11EffectType,
  V11Ending as V11EndingType,
  V11Event as V11EventType,
  V11Evidence as V11EvidenceType,
  V11EvidenceRelation as V11EvidenceRelationType,
  V11MetricKey as V11MetricKeyType,
  V11AssetManifest as V11AssetManifestType,
  V11PriceBaseline as V11PriceBaselineType,
  V11ResultPresentation as V11ResultPresentationType,
  V11RiskPlan as V11RiskPlanType,
  V11Round as V11RoundType,
  V11StageAction as V11StageActionType,
  V11Theory as V11TheoryType,
  V11VisualSystem as V11VisualSystemType,
  V11VisualTest as V11VisualTestType,
} from './v11.js';

function ensureUnique(ids: string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`重复的${label} ID：${id}`);
    seen.add(id);
  }
}

function ensureTheoryReferences(theoryIds: string[], theories: Set<string>, owner: string): void {
  for (const theoryId of theoryIds) {
    if (!theories.has(theoryId)) throw new Error(`${owner}引用了不存在的理论：${theoryId}`);
  }
}

function ensureConditionReferences(
  conditions: Condition[],
  choiceIds: Set<string>,
  owner: string,
): void {
  for (const condition of conditions) {
    if (condition.type === 'choice_was' && !choiceIds.has(condition.choiceId)) {
      throw new Error(`${owner}引用了不存在的历史选择：${condition.choiceId}`);
    }
  }
}

export function validateContent(content: unknown): GameContent {
  const parsed = GameContent.parse(content);
  ensureUnique(
    parsed.rounds.map((round) => round.roundId),
    '轮次',
  );
  ensureUnique(
    parsed.events.map((event) => event.eventId),
    '事件',
  );
  ensureUnique(
    parsed.visualSystems.map((visual) => visual.visualId),
    '视觉系统',
  );
  ensureUnique(
    parsed.theories.map((theory) => theory.theoryId),
    '理论',
  );
  ensureUnique(
    parsed.endings.map((ending) => ending.endingId),
    '结局',
  );
  ensureUnique(
    parsed.conceptCards.map((card) => card.conceptId),
    '概念卡',
  );
  ensureUnique(
    parsed.achievements.map((achievement) => achievement.achievementId),
    '成就',
  );
  ensureUnique(
    parsed.characters.map((character) => character.characterId),
    '角色',
  );
  ensureUnique(
    parsed.discussionTopics.map((topic) => topic.topicId),
    '讨论主题',
  );

  const theoryIds = new Set(parsed.theories.map((theory) => theory.theoryId));
  const eventIds = new Set(parsed.events.map((event) => event.eventId));
  const choiceIds = new Set<string>();

  for (const round of parsed.rounds) {
    ensureUnique(
      round.evidence.map((item) => item.evidenceId),
      `轮次 ${round.roundId} 的证据`,
    );
    ensureUnique(
      round.choices.map((choice) => choice.choiceId),
      `轮次 ${round.roundId} 的选择`,
    );
    ensureUnique(
      round.visualTests.map((test) => test.testId),
      `轮次 ${round.roundId} 的视觉测试`,
    );
    for (const choice of round.choices) {
      if (choiceIds.has(choice.choiceId)) throw new Error(`重复的选择 ID：${choice.choiceId}`);
      choiceIds.add(choice.choiceId);
    }
  }

  for (const round of parsed.rounds) {
    ensureTheoryReferences(round.theoryIds, theoryIds, `轮次 ${round.roundId}`);
    for (const eventId of round.eventIds) {
      if (!eventIds.has(eventId)) throw new Error(`轮次引用了不存在的事件：${eventId}`);
    }
    for (const evidence of round.evidence) {
      ensureTheoryReferences(evidence.theoryIds, theoryIds, `证据 ${evidence.evidenceId}`);
    }
    for (const choice of round.choices) {
      ensureTheoryReferences(choice.theoryIds, theoryIds, `选择 ${choice.choiceId}`);
      ensureConditionReferences(choice.conditions, choiceIds, `选择 ${choice.choiceId}`);
      const timings = new Set(choice.effects.map((effect) => effect.timing));
      if (!timings.has('immediate') || !timings.has('delayed')) {
        throw new Error(`选择 ${choice.choiceId} 必须同时包含即时效果和延迟效果`);
      }
      for (const effect of choice.effects) {
        ensureTheoryReferences(
          effect.theoryId ? [effect.theoryId] : [],
          theoryIds,
          `选择 ${choice.choiceId} 的效果`,
        );
      }
    }
    for (const visualTest of round.visualTests) {
      ensureTheoryReferences(visualTest.theoryIds, theoryIds, `视觉测试 ${visualTest.testId}`);
    }
  }
  for (const event of parsed.events) {
    ensureTheoryReferences(event.theoryIds, theoryIds, `事件 ${event.eventId}`);
    ensureConditionReferences(event.conditions, choiceIds, `事件 ${event.eventId}`);
    for (const effect of event.effects) {
      ensureTheoryReferences(
        effect.theoryId ? [effect.theoryId] : [],
        theoryIds,
        `事件 ${event.eventId} 的效果`,
      );
    }
  }
  for (const ending of parsed.endings) {
    ensureConditionReferences(ending.conditions, choiceIds, `结局 ${ending.endingId}`);
  }
  for (const card of parsed.conceptCards) {
    ensureTheoryReferences([card.sourceTheoryId], theoryIds, `概念卡 ${card.conceptId}`);
  }
  for (const topic of parsed.discussionTopics) {
    ensureTheoryReferences(topic.relatedTheoryIds, theoryIds, `讨论主题 ${topic.topicId}`);
  }
  return parsed;
}
