import { describe, expect, it } from 'vitest';
import { v11FullContent, v11SliceContent } from '@laojie/content-schema';
import { V11StudentFlow } from './v11StudentFlow.js';

describe('v1.1 student state stack', () => {
  it('keeps onboarding, briefing, choice detail, and result as explicit screens', async () => {
    const flow = new V11StudentFlow('ui-round-flow');

    expect(flow.snapshot.screenStack).toEqual([{ id: 'onboarding' }]);
    flow.completeOnboarding();
    flow.openActionCenter();
    expect(flow.snapshot.screenStack).toEqual([{ id: 'briefing' }, { id: 'action-center' }]);

    await flow.doStageAction('r01-observe-footfall');
    await flow.viewEvidence('ev-r01-footfall');
    flow.selectChoice('r01-neighbor');
    expect(flow.snapshot.screenStack.at(-1)).toEqual({
      id: 'choice-detail',
      choiceId: 'r01-neighbor',
    });

    await flow.commitChoice('r01-neighbor');
    expect(flow.snapshot.state.pendingRoundResult?.choiceId).toBe('r01-neighbor');
    expect(flow.snapshot.screenStack.at(-1)).toEqual({ id: 'round-result' });

    await flow.acknowledgeResult();
    expect(flow.snapshot.state.roundIndex).toBe(1);
    expect(flow.snapshot.screenStack).toEqual([{ id: 'briefing' }]);
  });

  it('does not change cash or action points when previewing a choice', () => {
    const flow = new V11StudentFlow('preview-flow');
    flow.completeOnboarding();
    flow.openActionCenter();
    const before = {
      cashYuan: flow.snapshot.state.cashYuan,
      actionPoints: flow.snapshot.state.stageActionPoints,
    };

    flow.selectChoice('r01-tourist');

    expect(flow.snapshot.state.cashYuan).toBe(before.cashYuan);
    expect(flow.snapshot.state.stageActionPoints).toBe(before.actionPoints);
    expect(flow.snapshot.state.decisions.at(-1)?.type).toBe('choice_previewed');
  });

  it('returns to the initiating choice after closing its detail screen', () => {
    const flow = new V11StudentFlow('choice-focus-flow');
    flow.completeOnboarding();
    flow.openActionCenter();
    flow.setActionStep('choices');
    flow.selectChoice('r01-tourist');

    expect(flow.snapshot.returnFocusTarget).toBe('choice-r01-tourist');
    flow.back();
    expect(flow.snapshot.screenStack.at(-1)).toEqual({
      id: 'action-center',
      actionStep: 'choices',
    });
    expect(flow.snapshot.focusRequest).toBe('choice-r01-tourist');
  });

  it('requires a visual system before committing the key visual round', async () => {
    const flow = new V11StudentFlow('visual-flow');
    flow.completeOnboarding();
    flow.openActionCenter();
    await flow.commitChoice('r01-hybrid');
    await flow.acknowledgeResult();
    flow.openActionCenter();
    await flow.commitChoice('r03-stable');
    await flow.acknowledgeResult();
    flow.openActionCenter();

    await expect(flow.commitChoice('r08-line')).rejects.toThrow('请先选择视觉方案');
    flow.openVisualCompare();
    await flow.selectVisual('v-line');
    await flow.testVisual('r08-sign-3-second');
    expect(flow.snapshot.state.visualState.selectedVisualId).toBe('v-line');
    expect(flow.snapshot.state.visualState.testedTouchpoints).toContain('r08-sign-3-second');
  });

  it('uses the four-round slice content rather than a hidden UI copy', () => {
    const flow = new V11StudentFlow('content-contract');
    expect(flow.content).toBe(v11SliceContent);
    expect(flow.content.rounds.map((round) => round.roundId)).toEqual(['r01', 'r03', 'r08', 'r11']);
  });

  it('treats the dashboard as a modal stack state and restores it without changing the game state', () => {
    const flow = new V11StudentFlow('dashboard-flow');
    flow.completeOnboarding();
    flow.openActionCenter();
    const before = flow.state;
    flow.openDashboard();
    expect(flow.snapshot.screenStack.at(-1)).toEqual({ id: 'dashboard' });
    expect(flow.state).toEqual(before);
    flow.back();
    expect(flow.snapshot.screenStack.at(-1)).toEqual({ id: 'action-center' });
    expect(flow.snapshot.focusRequest).toBe('dashboard-button');
    flow.clearFocusRequest();
    flow.setActionStep('choices');
    flow.openDashboard();
    flow.back();
    expect(flow.snapshot.screenStack.at(-1)).toEqual({
      id: 'action-center',
      actionStep: 'choices',
    });
  });

  it('round-trips a local snapshot including the pending result screen', async () => {
    const flow = new V11StudentFlow('snapshot-flow');
    flow.completeOnboarding();
    flow.openActionCenter();
    await flow.commitChoice('r01-neighbor');
    const encoded = JSON.stringify(flow.exportSnapshot());
    const restored = new V11StudentFlow('snapshot-flow');
    restored.restoreSnapshot(JSON.parse(encoded));
    expect(restored.snapshot.screenStack.at(-1)).toEqual({ id: 'round-result' });
    expect(restored.state.pendingRoundResult?.choiceId).toBe('r01-neighbor');
    expect(restored.state.cashYuan).toBe(flow.state.cashYuan);
  });

  it('does not open the generated report before the completed state', () => {
    const flow = new V11StudentFlow('report-screen-flow');
    expect(() => flow.openReport()).toThrow('完成全部经营回合');
  });

  it('audits chapter-review acknowledgement before entering the next chapter', async () => {
    const flow = new V11StudentFlow(
      'chapter-review-flow',
      'chapter-review-seed',
      undefined,
      v11FullContent,
    );
    flow.completeOnboarding();
    flow.openActionCenter();
    await flow.commitChoice('r01-neighbor');
    await flow.acknowledgeResult();
    flow.openActionCenter();
    await flow.commitChoice('r02-anchor');
    await flow.acknowledgeResult();

    expect(flow.snapshot.screenStack.at(-1)).toEqual({ id: 'chapter-review' });
    await flow.continueAfterChapterReview();
    expect(flow.snapshot.state.chapterReviews).toEqual(['r02']);
    expect(flow.snapshot.state.decisions.at(-1)?.type).toBe('chapter_review_acknowledged');
    expect(flow.snapshot.screenStack).toEqual([{ id: 'briefing' }]);
  });

  it('shows the annual review before the final completion screen', async () => {
    const finalRound = v11FullContent.rounds.find((round) => round.roundId === 'r12');
    if (!finalRound) throw new Error('缺少年度方向回合');
    const finalContent = { ...v11FullContent, rounds: [finalRound] };
    const flow = new V11StudentFlow(
      'annual-review-flow',
      'annual-review-seed',
      undefined,
      finalContent,
    );
    flow.completeOnboarding();
    flow.openActionCenter();
    await flow.commitChoice('r12-steady-renewal');
    await flow.acknowledgeResult();

    expect(flow.snapshot.screenStack).toEqual([{ id: 'chapter-review' }]);
    await flow.continueAfterChapterReview();
    expect(flow.snapshot.state.chapterReviews).toEqual(['r12']);
    expect(flow.snapshot.screenStack).toEqual([{ id: 'complete' }]);
  });
});
