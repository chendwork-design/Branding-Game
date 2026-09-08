import type { GameContentV11 } from '@laojie/content-schema';
import type { V11Action } from '@laojie/game-engine';

/**
 * Player-facing feedback is deliberately derived from the action and published
 * content, never from an engine trace. Traces remain precise audit records for
 * reports and teachers, while the student sees what changed and what to do
 * next in ordinary Chinese.
 */
export function v11PlayerFeedback(content: GameContentV11, action: V11Action): string | undefined {
  const value = (key: string) =>
    typeof action.payload[key] === 'string' ? action.payload[key] : undefined;

  switch (action.type) {
    case 'onboarding_completed':
      return '准备好了。先看清眼前的情况，再决定第一步怎么做。';
    case 'question_action_executed':
    case 'stage_action_selected':
    case 'evidence_viewed':
    case 'choice_previewed':
    case 'visual_tested':
    case 'terms_introduced':
    case 'choice_committed':
    case 'round_result_acknowledged':
      return undefined;
    case 'key_prediction_selected':
      return '你的判断已经记下。结果页会把你的直觉和实际变化放在一起看。';
    case 'brand_identity_declared':
      return '品牌身份已经写进店铺档案。后面的店招、杯身和包装会用上这个名字。';
    case 'risk_plan_selected':
      return '这份预案已经准备好。它会占用资源，并在对应风险发生时发挥作用。';
    case 'visual_selected': {
      const visual = content.visualSystems.find((item) => item.visualId === value('visualId'));
      return visual
        ? `已选“${visual.name}”。接下来看看它放进真实触点后是否还清楚、好用。`
        : '视觉方案已经选好。接下来检查它在真实触点中的表现。';
    }
    case 'choice_skipped':
      return '这轮不新增方案。既有经营和已经发生的投入会照常结算。';
    default:
      return undefined;
  }
}
