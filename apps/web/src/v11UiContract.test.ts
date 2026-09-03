import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const appPath = new URL('./v11App.tsx', import.meta.url);
const rootPath = new URL('./app.tsx', import.meta.url);
const stylesPath = new URL('./styles.css', import.meta.url);

describe('M10 v1.1 student vertical-slice UI contract', () => {
  it('routes the v1.1 slice through an explicit student surface', async () => {
    const app = await readFile(rootPath, 'utf8');
    expect(app).toContain("'/v11-slice'");
    expect(app).toContain('V11StudentApp');
    expect(app).toContain("'/v11-full'");
    expect(app).toContain("'/v11-teacher'");
    expect(app).toContain("window.location.pathname === '/v11'");
  });

  it('keeps the major teaching interactions visible in the student surface', async () => {
    const app = await readFile(appPath, 'utf8');
    for (const text of [
      '行动结果',
      '自由行动',
      '战略行动',
      '现金',
      '视觉提案',
      '执行结果',
      '为什么会这样',
      '看店铺状态',
      '经营看板',
    ]) {
      expect(app).toContain(text);
    }
    expect(app).toContain('choice-detail');
    expect(app).toContain('visual-compare');
    expect(app).toContain('round-result');
    expect(app).toContain('打开我的复盘报告');
    expect(app).toContain('每轮因果链');
    expect(app).toContain('这一步的投入');
    expect(app).toContain('执行前检查');
    expect(app).toContain('提交后现金');
    expect(app).toContain('你掌握的信息怎么说');
    expect(app).toContain('已知现场');
    expect(app).toContain('先完成“');
    expect(app).toContain('安全余量');
    expect(app).toContain('当前最大矛盾');
    expect(app).toContain('下一轮风险');
    expect(app).toContain('判断命中');
    expect(app).toContain('预判复盘');
    expect(app).toContain('完整账本和团队压力');
    expect(app).toContain('v11-skip-card');
    expect(app).toContain('确认跳过');
    expect(app).toContain('v11-step-surface');
    expect(app).toContain('可选行动');
    expect(app).toContain('刚刚查到');
  });

  it('uses compact responsive rules and a result motion cue instead of a long survey page', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('.v11-choice-detail');
    expect(styles).toContain('.v11-result-art');
    expect(styles).toContain('@media (max-width: 680px)');
    expect(styles).toContain('env(safe-area-inset-bottom)');
  });

  it('defines the responsive shell tokens required by the v1.3 UIX plan', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    for (const token of [
      '--v11-space-',
      '--v11-touch-min',
      '--v11-content-max',
      '--v11-safe-top',
      '--v11-safe-bottom',
      '--v11-grid-columns',
      '.v11-layout-grid',
      '.v11-step-surface',
      '.v11-primary-action',
    ]) {
      expect(styles).toContain(token);
    }
    expect(styles).toContain('@media (min-width: 900px)');
    expect(styles).toContain('@media (min-width: 1440px)');
    expect(styles).toContain('min-height: var(--v11-touch-min)');
  });

  it('defines the compact HUD information hierarchy for mobile play', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    for (const text of ['v11-resource-value', '可调查', '可提交', 'v11-chapter-strip']) {
      expect(app).toContain(text);
    }
    expect(styles).toContain('.v11-resource-strip');
    expect(styles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
  });

  it('uses the v1.4 single-task surface instead of a multi-column action workspace', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    for (const text of [
      'v11-step-surface',
      'v11-action-row',
      'v11-fact-reveal',
      'v11-choice-sheet',
      '带着信息做选择',
    ]) {
      expect(app).toContain(text);
    }
    expect(app).not.toContain('v11-layout-dossier');
    expect(app).not.toContain('v11-mobile-action-bar');
    expect(styles).toContain('.v11-action-row');
    expect(styles).toContain('.v11-fact-reveal');
    expect(styles).toContain('@media (max-width: 680px)');
  });

  it('binds evidence signals to strategic choices without adding a comparison tray', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    for (const text of [
      'v11-choice-evidence-state',
      'v11-choice-support-count',
      '支持依据',
      '需要留意的风险',
      'v11-fact-reveal',
    ]) {
      expect(app).toContain(text);
    }
    expect(app).not.toContain('v11-choice-comparison-tray');
    expect(app).not.toContain('加入方案对比');
    expect(styles).toContain('.v11-choice-evidence-state');
    expect(styles).toContain('.v11-fact-reveal');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) auto');
  });

  it('exposes a visual comparison workspace with a clear selection hierarchy', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    for (const text of [
      'v11-visual-workspace',
      'v11-visual-hero',
      'v11-visual-compare-summary',
      'v11-visual-test-status',
      '当前选中',
      '先选一个触点',
      'visibleVisuals',
    ]) {
      expect(app).toContain(text);
    }
    expect(app).not.toContain('加入对比');
    expect(styles).toContain('.v11-visual-workspace');
    expect(styles).toContain('.v11-visual-hero');
    expect(styles).toContain('.v11-visual-compare-summary');
    expect(styles).toContain('.v11-visual-test-status');
    expect(styles).toContain('grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr)');
  });

  it('makes visual tests change the preview instead of only recording a click', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    for (const text of [
      'v11-touchpoint-tabs',
      'data-v11-preview-state',
      'v11-preview-mono',
      'v11-preview-small',
      'v11-preview-occluded',
    ]) {
      expect(app).toContain(text);
    }
    expect(styles).toContain('.v11-touchpoint-tabs');
    expect(styles).toContain('.v11-preview-mono');
    expect(styles).toContain('.v11-preview-small');
    expect(styles).toContain('.v11-preview-occluded');
  });

  it('keeps result feedback visual-first and defers achievements and theory', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    for (const text of [
      'sceneKey',
      'outcomeState',
      'routeOverlayKey',
      'data-outcome-state',
      'v11-result-primary-changes',
      'v11-result-followup',
      '你在这一章做成的事',
      'playerEffectSentence',
    ]) {
      expect(app).toContain(text);
    }
    expect(app).not.toContain('v11-achievement-toast');
    expect(app).toContain('<details className="v11-result-ledger">');
    expect(app).toContain('<details className="v11-why-details">');
    expect(styles).toContain('.v11-result-primary-changes');
    expect(styles).toMatch(/\[data-outcome-state=['"]crisis['"]\]/);
  });

  it('preloads the current atlas, idles the next hint, and keeps a readable asset fallback', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('useV11AssetHints');
    expect(app).toContain("current.rel = 'preload'");
    expect(app).toContain("nextHint.rel = 'prefetch'");
    expect(app).toContain('asset-placeholder.svg');
    expect(app).toContain('asset-missing');
    expect(styles).toContain('.asset-missing::after');
  });

  it('uses vector-driven wordmark, symbol and IP routes on the actual touchpoint surface', async () => {
    const app = await readFile(appPath, 'utf8');
    const assets = ['visual-wordmark.svg', 'visual-symbol.svg', 'visual-ip.svg'];
    for (const asset of assets) {
      expect(app).toContain(asset);
      await expect(
        readFile(new URL(`../public/assets/v11/${asset}`, import.meta.url), 'utf8'),
      ).resolves.toContain('<svg');
    }
    expect(app).toContain('V11VisualMark');
    expect(app).toContain('v11-touchpoint-brand-surface');
    expect(app).not.toContain('v11-touchpoint-brand-name');
    expect(app).toContain('scene-atlas.svg');
    expect(app).toContain('resolveSceneAsset');
    expect(app).toContain('resolveResultAsset');
    await expect(
      readFile(new URL('../public/assets/v11/scene-atlas.svg', import.meta.url), 'utf8'),
    ).resolves.toContain('id="briefing-r01"');
    expect(app).toContain('v11-visual-constraint-preview');
    expect(app).toContain('黑白打印');
    expect(app).toContain('35% 遮挡');
    expect(app).toContain('v11-chapter-route-mark');
    expect(app).toContain('visual-route');
  });

  it('uses words and scene images instead of ambiguous action or status icons', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('function ActionSceneThumb');
    expect(app).toContain('支持依据 {supportCount} 条');
    expect(app).toContain('需要留意的风险 {warningCount} 条');
    expect(app).not.toContain('function V11Icon');
    expect(app).not.toContain('v11-choice-number');
    expect(app).not.toMatch(/[✓△○]/);
    expect(styles).not.toMatch(/\.v11-icon\s*\{/);
    expect(styles).not.toContain('.v11-card-icon');
    expect(styles).not.toContain('.v11-action-row-icon');
  });

  it('turns round results and process achievements into immediate visual feedback', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('v11-result-feedback');
    expect(app).toContain('v11-achievement-badge');
    expect(app).toContain('function V11AchievementBadge');
    expect(app).not.toContain('v11-result-feedback-icon');
    expect(app).not.toContain('v11-achievement-badge-icon');
    expect(app).toContain('aria-live="polite"');
    expect(styles).toContain('.v11-result-feedback');
    expect(styles).toContain('.v11-achievement-badge');
    expect(styles).toContain('@keyframes v11-badge-pop');
  });

  it('uses scene thumbnails for actions and rewards positive operating cash flow from the formal ledger', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    await expect(
      readFile(new URL('../public/assets/v11/rewards/positive-cashflow-v1.jpg', import.meta.url)),
    ).resolves.toBeInstanceOf(Buffer);
    expect(app).toContain('function ActionSceneThumb');
    expect(app).toContain('const asset = actionAsset(actionId, actionType)');
    expect(app).toContain('v11-action-scene-thumb');
    expect(app).not.toContain('<V11Icon name={actionIcon} />');
    expect(app).toContain('const netCashChange = result.ledgerEntries.reduce');
    expect(app).toContain('const hasOperatingIncome = operatingIncome > 0');
    expect(app).toContain('/assets/v11/rewards/positive-cashflow-v1.jpg');
    expect(styles).toContain('.v11-cashflow-reward');
    expect(styles).toContain('.v11-action-scene-thumb');
    expect(styles).toContain('grid-template-columns: 54px minmax(0, 1fr) auto');
  });

  it('keeps each investigated fact available for resource-free review during the action step', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('const collectedEvidence = round.evidence.filter');
    expect(app).toContain('随时回看，不重复扣资源');
    expect(app).toContain('newlyRevealedEvidenceId === revealedEvidence.evidenceId');
    expect(app).toContain("'刚刚查到'");
    expect(app).toContain("'已经查到的事'");
    expect(app).toContain("expanded ? '收起' : '回看'");
    expect(styles).toContain('.v11-collected-evidence');
    expect(styles).toContain('.v11-collected-evidence-list');
  });

  it('defines the final accessibility, projection and responsive release gate', async () => {
    const app = await readFile(appPath, 'utf8');
    const teacher = await readFile(new URL('./v11Teacher.tsx', import.meta.url), 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    for (const text of [
      'data-v11-layout-mode',
      'data-v11-screen',
      'useDialogFocus',
      'v11-touch-target',
      'aria-live="polite"',
    ]) {
      expect(app).toContain(text);
    }
    expect(teacher).toContain('data-v11-projection="anonymous"');
    expect(teacher).toContain('projection-screen');
    expect(teacher).toContain('此页面不含学生姓名、学号或 playthrough 标识');
    for (const text of [
      'env(safe-area-inset-top)',
      '@media (prefers-reduced-motion: reduce)',
      '@media (min-width: 1440px)',
      '.v11-touch-target',
      '.projection-screen',
    ]) {
      expect(styles).toContain(text);
    }
  });

  it('keeps the v11 asset budget and lazy-loading policy executable', async () => {
    const packageJson = await readFile(new URL('../../../package.json', import.meta.url), 'utf8');
    const assetCheck = await readFile(
      new URL('../../../scripts/check-v11-assets.mjs', import.meta.url),
      'utf8',
    );
    expect(packageJson).toContain('assets:check:v11');
    expect(assetCheck).toContain('MAX_RUNTIME_RASTER_BYTES');
    expect(assetCheck).toContain('MAX_INITIAL_BYTES');
    expect(assetCheck).toContain('visual-wordmark.svg');
    expect(assetCheck).toContain('process.exitCode = 1');
  });

  it('defines the M12 interaction and recovery contracts', async () => {
    const app = await readFile(appPath, 'utf8');
    const flow = await readFile(new URL('./v11StudentFlow.ts', import.meta.url), 'utf8');
    const persistence = await readFile(new URL('./v11Persistence.ts', import.meta.url), 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('useDialogFocus');
    expect(app).toContain('aria-modal="true"');
    expect(flow).toContain("| 'dashboard'");
    expect(flow).toContain('exportSnapshot');
    expect(flow).toContain('introduceTerms');
    expect(app).toContain('概念小抄：随时回来看这些词');
    expect(persistence).toContain('IndexedDbV11SnapshotStorage');
    expect(styles).toContain('position: sticky');
    expect(styles).toContain('@media (max-width: 360px)');
    expect(styles).toContain('button:focus-visible');
  });

  it('defines the M14 teacher timeline, anonymous case and read-only analytics surface', async () => {
    const teacher = await readFile(new URL('./v11Teacher.tsx', import.meta.url), 'utf8');
    const teacherApi = await readFile(new URL('./v11TeacherApi.ts', import.meta.url), 'utf8');
    expect(teacher).toContain('实名仅教师可见');
    expect(teacher).toContain('生成匿名案例');
    expect(teacher).toContain('学生决策时间线');
    expect(teacher).toContain('调查结果被打开');
    expect(teacher).toContain('风险与事件');
    expect(teacher).toContain('timeline-action-detail');
    expect(teacherApi).toContain('/api/v11/teacher/classes/');
    expect(teacherApi).toContain('downloadCsv');
  });

  it('renders anonymous process awards without identity fields', async () => {
    const teacher = await readFile(new URL('./v11Teacher.tsx', import.meta.url), 'utf8');
    const teacherApi = await readFile(new URL('./v11TeacherApi.ts', import.meta.url), 'utf8');
    expect(teacher).toContain('匿名过程奖项');
    expect(teacher).toContain('只显示人数，不显示姓名');
    expect(teacherApi).toContain('anonymousAwards');
  });

  it('enforces the v1.4 subtraction contract for the student decision surface', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('v11-step-surface');
    expect(app).toContain('v11-choice-sheet');
    expect(app).toContain('data-v11-primary');
    expect(app).not.toContain('v11-layout-dossier');
    expect(app).not.toContain('v11-choice-comparison-tray');
    expect(app).not.toContain('v11-choice-compare-toggle');
    expect(app).not.toContain('跳到战略选择');
    expect(styles).toContain('.v11-step-surface');
    expect(styles).toContain('.v11-choice-sheet');
    expect(styles).toContain('.v11-primary-action');
    expect(styles).toContain('max-height: 78svh');
  });

  it('keeps the current scene visible while the player makes the main decision', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('v11-step-heading-visual');
    expect(app).toContain(
      '<SceneArt imageKey={round.briefing.imageKey} label="本轮经营现场插图" />',
    );
    expect(app).toContain('const questionGroups =');
    expect(app).toContain('round.decisionQuestions && round.decisionQuestions.length > 0');
    expect(app).toContain(
      "step === 'actions' ? '第 1 / 2 步 · 眼前发生了什么' : '第 2 / 2 步 · 现在要做的决定'",
    );
    expect(app).toContain('round.briefing.situation');
    expect(app).not.toContain('actionQuestion?.context ?? round.briefing.whyNow');
    expect(app).not.toContain('v11-step-heading-meta');
    expect(app).not.toContain(
      "step === 'actions' ? '先看清一个问题，再做决定' : '现在，把事实带进你的方案'",
    );
    expect(styles).toContain('.v11-step-heading-visual');
    expect(styles).toContain('.v11-step-heading-visual .v11-scene-art');
    expect(styles).toContain('grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.8fr)');
    expect(styles).toContain('aspect-ratio: 2.15');
    expect(styles).not.toContain('.v11-step-heading-meta');
  });

  it('keeps the mobile decision surface compact and visually anchored', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('.v11-chapter-strip');
    expect(styles).toContain('margin-top: 10px');
    expect(styles).toContain('width: 100%');
    expect(styles).toContain('grid-template-columns: 54px minmax(0, 1fr) auto');
    expect(styles).toContain('grid-column: auto');
  });

  it('keeps the chapter review title in the same visual hierarchy as the game screens', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('.v11-chapter-review h1');
    expect(styles).toContain('font-size: clamp(1.65rem, 5vw, 2.15rem)');
    expect(styles).toContain('line-height: 1.15');
  });

  it('does not expose internal scene captions on the chapter review surface', async () => {
    const app = await readFile(appPath, 'utf8');
    expect(app).not.toContain('这一章的门店现场');
  });

  it('separates recent chapter decisions from the next-chapter action', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('.v11-chapter-review > div:last-of-type');
    expect(styles).toContain('.v11-chapter-review > div:last-of-type > article');
    expect(styles).toContain('margin: 18px 0 22px');
  });

  it('shows the concept launcher only when a round has terms, and always names the available terms', async () => {
    const app = await readFile(appPath, 'utf8');
    expect(app).toContain('if (terms.length === 0) return null;');
    expect(app).toContain('terms.map((term) =>');
    expect(app).toContain('aria-pressed={term.termId === activeTermId}');
  });

  it('never renders an empty result screen when a submitted round is awaiting recovery', async () => {
    const app = await readFile(appPath, 'utf8');
    expect(app).not.toContain('if (!result) return null;');
    expect(app).toContain('function RoundResultRecovery');
    expect(app).toContain('重新载入结果');
  });

  it('keeps the operating dashboard close control outside its scrolling content and removes duplicate round resources', async () => {
    const app = await readFile(appPath, 'utf8');
    const styles = await readFile(stylesPath, 'utf8');
    expect(app).toContain('className="v11-detail-heading v11-dashboard-heading"');
    expect(app).toContain('className="v11-dashboard-scroll"');
    expect(app).not.toContain('className="v11-step-resource"');
    expect(styles).toContain('.v11-dashboard-scroll');
    expect(styles).toContain('overflow-y: auto;');
  });

  it('binds each scene and result key to an explicit asset resolver instead of a generic fallback', async () => {
    const app = await readFile(appPath, 'utf8');
    const assetCheck = await readFile(
      new URL('../../../scripts/check-v11-assets.mjs', import.meta.url),
      'utf8',
    );
    expect(app).toContain('resolveSceneAsset');
    expect(app).toContain('resolveResultAsset');
    expect(app).toContain('v11-art-fallback');
    expect(app).not.toContain("'result-audience.svg'");
    expect(app).not.toContain("'result-product.svg'");
    expect(app).not.toContain("'result-identity.svg'");
    expect(app).not.toContain("'result-growth.svg'");
    expect(assetCheck).toContain('runtimeAssets');
  });
});
