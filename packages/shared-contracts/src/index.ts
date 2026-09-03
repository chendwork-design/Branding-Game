import { z } from 'zod';

export const GamePhase = z.enum(['onboarding', 'playing', 'completed', 'replay']);
export type GamePhase = z.infer<typeof GamePhase>;

export const Id = z.string().uuid();
export const RoundId = z.string().regex(/^r\d{2}$/);

export const VisibleMetrics = z.object({
  cash: z.number().int().min(0).max(100),
  awareness: z.number().int().min(0).max(100),
  conversion: z.number().int().min(0).max(100),
  trust: z.number().int().min(0).max(100),
  loyalty: z.number().int().min(0).max(100),
  actionPoints: z.number().int().min(0).max(100),
});
export type VisibleMetrics = z.infer<typeof VisibleMetrics>;

export const AnalyticsEventName = z.enum([
  'class_joined',
  'playthrough_started',
  'chapter_started',
  'round_started',
  'evidence_opened',
  'choice_previewed',
  'choice_selected',
  'intent_selected',
  'risk_selected',
  'visual_proposal_viewed',
  'visual_proposal_selected',
  'visual_revision_selected',
  'visual_test_run',
  'event_triggered',
  'round_completed',
  'playthrough_completed',
  'report_viewed',
  'reflection_submitted',
  'replay_started',
]);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventName>;

export const ActionInput = z.object({
  actionId: z.string().min(1),
  type: z.enum([
    'evidence_viewed',
    'choice_previewed',
    'intent_selected',
    'risk_selected',
    'choice_selected',
    'visual_selected',
    'visual_revised',
    'visual_tested',
  ]),
  roundId: RoundId,
  payload: z.record(z.string(), z.unknown()),
});
export type ActionInput = z.infer<typeof ActionInput>;

export const ProtocolVersion = z.enum(['1.0', '1.1', '1.2']);
export type ProtocolVersion = z.infer<typeof ProtocolVersion>;

export const V11ActionType = z.enum([
  'onboarding_completed',
  'stage_action_selected',
  'question_action_executed',
  'evidence_viewed',
  'choice_previewed',
  'key_prediction_selected',
  'risk_plan_selected',
  'choice_committed',
  'choice_skipped',
  'brand_identity_declared',
  'terms_introduced',
  'visual_selected',
  'visual_tested',
  'round_result_acknowledged',
  'chapter_review_acknowledged',
]);
export type V11ActionType = z.infer<typeof V11ActionType>;

export const V11ActionInput = z
  .object({
    // 1.1 remains readable so a released first run can be replayed.  New
    // student clients send 1.2, which is the protocol carrying the v1.2 UX.
    protocolVersion: z.enum(['1.1', '1.2']),
    actionId: z.string().min(1),
    type: V11ActionType,
    roundId: RoundId.optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .superRefine((action, context) => {
    if (action.type !== 'onboarding_completed' && !action.roundId) {
      context.addIssue({
        code: 'custom',
        path: ['roundId'],
        message: '动作轮次不能为空',
      });
    }
  });
export type V11ActionInput = z.infer<typeof V11ActionInput>;

export type VersionedActionInput = (ActionInput & { protocolVersion?: '1.0' }) | V11ActionInput;

export function parseVersionedActionInput(input: unknown): VersionedActionInput {
  if (!input || typeof input !== 'object') return ActionInput.parse(input);
  const protocolVersion = (input as { protocolVersion?: unknown }).protocolVersion;
  if (protocolVersion === '1.1' || protocolVersion === '1.2') return V11ActionInput.parse(input);
  if (protocolVersion === undefined || protocolVersion === '1.0') return ActionInput.parse(input);
  throw new Error(`不支持的动作协议版本：${String(protocolVersion)}`);
}

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
});
