import type { GameContentV11 } from '@laojie/content-schema';
import type { V11Action } from '@laojie/game-engine';

/**
 * Player-facing feedback is deliberately derived from the action and published
 * content, never from an engine trace. Traces remain precise audit records for
 * reports and teachers, while the student sees what changed and what to do
 * next in ordinary Chinese.
 */
export function v11PlayerFeedback(content: GameContentV11, action: V11Action): string | undefined {
  const round = action.roundId
    ? content.rounds.find((item) => item.roundId === action.roundId)
    : undefined;
  const value = (key: string) =>
    typeof action.payload[key] === 'string' ? action.payload[key] : undefined;

  switch (action.type) {
    case 'onboarding_completed':
      return '准备好了。先看清眼前的情况，再决定第一步怎么做。';
    case 'question_action_executed':
    case 'stage_action_selected': {
      const stageAction = round?.stageActions.find((item) => item.actionId === value('actionId'));
      return stageAction
        ? `“${stageAction.label}”做完了。现在可以看它带回的事实，再比较哪些方案更合适。`
        : '行动做完了。现在可以看看它带回的事实，再比较不同方案。';
    }
    case 'evidence_viewed':
      return undefined;
    case 'choice_previewed':
      return undefined;
    case 'key_prediction_selected':
      return '你的判断已经记下。结果页会把你的直觉和实际变化放在一起看。';
    case 'terms_introduced':
      return '先把这几个词说清楚了，后面的判断就不会只靠感觉。';
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
    case 'visual_tested': {
      const test = round?.visualTests.find((item) => item.testId === value('testId'));
      return test ? `“${test.title}”完成了。${test.prompt}` : '视觉测试完成了，结果已经记下。';
    }
    case 'choice_committed':
      return '方案已经开始执行。先看看顾客和店里发生了什么。';
    case 'choice_skipped':
      return '这轮不新增方案。既有经营和已经发生的投入会照常结算。';
    case 'round_result_acknowledged':
      return '这一轮结果已确认，继续处理下一个现场问题。';
    default:
      return undefined;
  }
}
