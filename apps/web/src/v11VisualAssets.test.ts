import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { v11FullContent } from '@laojie/content-schema';
import { describe, expect, it } from 'vitest';
import {
  actionAsset,
  chapterAsset,
  choiceVisualAsset,
  decisionAsset,
  resultSceneAsset,
  sceneAsset,
  touchpointAsset,
  touchpointPlacement,
  V11VisualAssetManifest,
} from './v11VisualAssets.js';

const assetRoot = fileURLToPath(new URL('../public/assets/v11/', import.meta.url));

describe('v11 visual asset production contract', () => {
  it('maps all runtime scene and result states to raster assets', () => {
    expect(sceneAsset('onboarding-place')).toBe('scenes/onboarding/onboarding-place-v19.jpg');
    expect(sceneAsset('briefing-r08-visual')).toBe('scenes/briefing/briefing-r08-v19.jpg');
    expect(resultSceneAsset('r08', 'stable')).toBe('scenes/results/result-r08-v19-stable.jpg');
    expect(resultSceneAsset('r01', 'stable')).toBe('scenes/results/result-r01-v19-stable.jpg');
    expect(resultSceneAsset('r01', 'strained')).toBe('scenes/results/result-r01-v19-strained.jpg');
    expect(resultSceneAsset('r01', 'crisis')).toBe('scenes/results/result-r01-v19-crisis.jpg');
    expect(sceneAsset('briefing-r03-product')).toBe('scenes/briefing/briefing-r03-v19.jpg');
    expect(sceneAsset('briefing-r04')).toBe('scenes/briefing/briefing-r04-v19.jpg');
    expect(sceneAsset('briefing-r05')).toBe('scenes/briefing/briefing-r05-v19.jpg');
    expect(sceneAsset('briefing-r07')).toBe('scenes/briefing/briefing-r07-v19.jpg');
    expect(resultSceneAsset('r03', 'stable')).toBe('scenes/results/result-r03-v19-stable.jpg');
    expect(resultSceneAsset('r03', 'strained')).toBe('scenes/results/result-r03-v19-strained.jpg');
    expect(resultSceneAsset('r03', 'crisis')).toBe('scenes/results/result-r03-v19-crisis.jpg');
    expect(resultSceneAsset('r04', 'stable')).toBe('scenes/results/result-r04-v19-stable.jpg');
    expect(resultSceneAsset('r04', 'strained')).toBe('scenes/results/result-r04-v19-strained.jpg');
    expect(resultSceneAsset('r04', 'crisis')).toBe('scenes/results/result-r04-v19-crisis.jpg');
    expect(resultSceneAsset('r05', 'stable')).toBe('scenes/results/result-r05-v19-stable.jpg');
    expect(resultSceneAsset('r05', 'strained')).toBe('scenes/results/result-r05-v19-strained.jpg');
    expect(resultSceneAsset('r05', 'crisis')).toBe('scenes/results/result-r05-v19-crisis.jpg');
    expect(resultSceneAsset('r06', 'stable')).toBe('scenes/results/result-r06-v19-stable.jpg');
    expect(resultSceneAsset('r06', 'strained')).toBe('scenes/results/result-r06-v19-strained.jpg');
    expect(resultSceneAsset('r06', 'crisis')).toBe('scenes/results/result-r06-v19-crisis.jpg');
    expect(resultSceneAsset('r09', 'stable')).toBe('scenes/results/result-r09-v19-stable.jpg');
    expect(resultSceneAsset('r09', 'strained')).toBe('scenes/results/result-r09-v19-strained.jpg');
    expect(resultSceneAsset('r09', 'crisis')).toBe('scenes/results/result-r09-v19-crisis.jpg');
    expect(resultSceneAsset('r12', 'stable')).toBe('scenes/results/result-r12-v19-stable.jpg');
    expect(resultSceneAsset('r12', 'strained')).toBe('scenes/results/result-r12-v19-strained.jpg');
    expect(resultSceneAsset('r12', 'crisis')).toBe('scenes/results/result-r12-v19-crisis.jpg');
    expect(sceneAsset('briefing-r11-growth')).toBe('scenes/briefing/briefing-r11-v19.jpg');
    expect(resultSceneAsset('r11', 'stable')).toBe('scenes/results/result-r11-v19-stable.jpg');
    expect(resultSceneAsset('r11', 'strained')).toBe('scenes/results/result-r11-v19-strained.jpg');
    expect(resultSceneAsset('r11', 'crisis')).toBe('scenes/results/result-r11-v19-crisis.jpg');
    expect(resultSceneAsset('r07', 'stable')).toBe('scenes/results/result-r07-v19-stable.jpg');
    expect(resultSceneAsset('r12', 'crisis')).toBe('scenes/results/result-r12-v19-crisis.jpg');
    expect(sceneAsset('not-a-real-scene')).toBeUndefined();
  });

  it('maps course-specific decision, touchpoint and chapter visuals without inflating compact cards', () => {
    expect(actionAsset('r01-observe-footfall', 'research')).toBe(
      'actions/v19/action-r01-observe-footfall.jpg',
    );
    expect(actionAsset('r01-interview-neighbors', 'research')).toBe(
      'actions/v19/action-r01-interview-neighbors.jpg',
    );
    expect(actionAsset('r01-quote-rent', 'quote')).toBe('actions/v19/action-r01-quote-rent.jpg');
    expect(
      new Set([
        actionAsset('r01-observe-footfall', 'research'),
        actionAsset('r01-interview-neighbors', 'research'),
        actionAsset('r01-quote-rent', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r02-observe', 'research')).toBe(
      'actions/v19/action-r02-interview-segments.jpg',
    );
    expect(actionAsset('r02-test', 'test')).toBe('actions/v19/action-r02-test-promise.jpg');
    expect(actionAsset('r02-quote', 'quote')).toBe('actions/v19/action-r02-quote-staffing.jpg');
    expect(
      new Set([
        actionAsset('r02-observe', 'research'),
        actionAsset('r02-test', 'test'),
        actionAsset('r02-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r03-test-recipe', 'test')).toBe('actions/v19/action-r03-test-recipe.jpg');
    expect(actionAsset('r03-quote-packaging', 'quote')).toBe(
      'actions/v19/action-r03-quote-packaging.jpg',
    );
    expect(actionAsset('r03-negotiate-supply', 'negotiate')).toBe(
      'actions/v19/action-r03-negotiate-supply.jpg',
    );
    expect(actionAsset('r08-negotiate-production', 'negotiate')).toBe(
      'actions/v19/action-r08-negotiate-production.jpg',
    );
    expect(
      new Set([
        actionAsset('r03-test-recipe', 'test'),
        actionAsset('r03-quote-packaging', 'quote'),
        actionAsset('r03-negotiate-supply', 'negotiate'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r04-observe', 'research')).toBe('actions/v19/action-r04-observe-price.jpg');
    expect(actionAsset('r04-test', 'test')).toBe('actions/v19/action-r04-test-gift-box.jpg');
    expect(actionAsset('r04-quote', 'quote')).toBe('actions/v19/action-r04-quote-full-cost.jpg');
    expect(
      new Set([
        actionAsset('r04-observe', 'research'),
        actionAsset('r04-test', 'test'),
        actionAsset('r04-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r05-observe', 'research')).toBe(
      'actions/v19/action-r05-observe-sign-read.jpg',
    );
    expect(actionAsset('r05-test', 'test')).toBe('actions/v19/action-r05-test-avatar.jpg');
    expect(actionAsset('r05-quote', 'quote')).toBe('actions/v19/action-r05-quote-print.jpg');
    expect(
      new Set([
        actionAsset('r05-observe', 'research'),
        actionAsset('r05-test', 'test'),
        actionAsset('r05-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r06-observe', 'research')).toBe(
      'actions/v19/action-r06-observe-entrance.jpg',
    );
    expect(actionAsset('r06-test', 'test')).toBe('actions/v19/action-r06-test-video-visit.jpg');
    expect(actionAsset('r06-quote', 'quote')).toBe('actions/v19/action-r06-quote-partner.jpg');
    expect(
      new Set([
        actionAsset('r06-observe', 'research'),
        actionAsset('r06-test', 'test'),
        actionAsset('r06-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r07-observe', 'research')).toBe(
      'actions/v19/action-r07-observe-peak-order.jpg',
    );
    expect(actionAsset('r07-test', 'test')).toBe('actions/v19/action-r07-test-order-dots.jpg');
    expect(actionAsset('r07-quote', 'quote')).toBe('actions/v19/action-r07-quote-staff-roles.jpg');
    expect(
      new Set([
        actionAsset('r07-observe', 'research'),
        actionAsset('r07-test', 'test'),
        actionAsset('r07-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r08-test-sign', 'test')).toBe('actions/v19/action-r08-test-sign.jpg');
    expect(actionAsset('r08-test-packaging', 'test')).toBe(
      'actions/v19/action-r08-test-packaging.jpg',
    );
    expect(
      new Set([
        actionAsset('r08-test-sign', 'test'),
        actionAsset('r08-test-packaging', 'test'),
        actionAsset('r08-negotiate-production', 'negotiate'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r09-observe', 'research')).toBe(
      'actions/v19/action-r09-observe-customer-shares.jpg',
    );
    expect(actionAsset('r09-test', 'test')).toBe('actions/v19/action-r09-test-story-invite.jpg');
    expect(actionAsset('r09-quote', 'quote')).toBe('actions/v19/action-r09-quote-review-roles.jpg');
    expect(
      new Set([
        actionAsset('r09-observe', 'research'),
        actionAsset('r09-test', 'test'),
        actionAsset('r09-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r10-observe', 'research')).toBe(
      'actions/v19/action-r10-observe-delivery.jpg',
    );
    expect(actionAsset('r10-test', 'test')).toBe('actions/v19/action-r10-test-small-batch.jpg');
    expect(actionAsset('r10-quote', 'quote')).toBe('actions/v19/action-r10-quote-fixed-costs.jpg');
    expect(
      new Set([
        actionAsset('r10-observe', 'research'),
        actionAsset('r10-test', 'test'),
        actionAsset('r10-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r11-observe', 'research')).toBe(
      'actions/v19/action-r11-observe-peak-hour.jpg',
    );
    expect(actionAsset('r11-test', 'test')).toBe('actions/v19/action-r11-test-platform-batch.jpg');
    expect(actionAsset('r11-quote', 'quote')).toBe(
      'actions/v19/action-r11-quote-supplier-capacity.jpg',
    );
    expect(
      new Set([
        actionAsset('r11-observe', 'research'),
        actionAsset('r11-test', 'test'),
        actionAsset('r11-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('r12-observe', 'research')).toBe(
      'actions/v19/action-r12-observe-regulars.jpg',
    );
    expect(actionAsset('r12-test', 'test')).toBe('actions/v19/action-r12-test-inventory-retro.jpg');
    expect(actionAsset('r12-quote', 'quote')).toBe('actions/v19/action-r12-quote-next-plan.jpg');
    expect(
      new Set([
        actionAsset('r12-observe', 'research'),
        actionAsset('r12-test', 'test'),
        actionAsset('r12-quote', 'quote'),
      ]),
    ).toHaveLength(3);
    expect(actionAsset('unknown-action', 'unknown-action')).toBeUndefined();
    expect(decisionAsset('r03-stable')).toBe('decisions/products/product-r03-v18-stable.jpg');
    expect(decisionAsset('r03-complex')).toBe('decisions/products/product-r03-v18-complex.jpg');
    expect(decisionAsset('r03-local-special')).toBe('decisions/products/product-r03-v18-local.jpg');
    expect(decisionAsset('r03-seasonal-ritual')).toBe(
      'decisions/products/product-r03-v18-seasonal-ritual.jpg',
    );
    expect(decisionAsset('r03-modular-menu')).toBe(
      'decisions/products/product-r03-v18-modular-menu.jpg',
    );
    expect(decisionAsset('r04-everyday-cup')).toBe(
      'decisions/packaging/package-r04-v18-everyday-cup.jpg',
    );
    expect(decisionAsset('r04-gift-box')).toBe('decisions/packaging/package-r04-v18-gift-box.jpg');
    expect(decisionAsset('r04-refill')).toBe('decisions/packaging/package-r04-v18-refill.jpg');
    expect(decisionAsset('r04-price-ladder')).toBe(
      'decisions/packaging/package-r04-v18-price-ladder.jpg',
    );
    expect(decisionAsset('r04-bundle')).toBe('decisions/packaging/package-r04-v18-bundle.jpg');
    expect(decisionAsset('r05-tea-character')).toBe(
      'decisions/ip-objects/ip-object-tea-clip-v19.jpg',
    );
    expect(choiceVisualAsset('r05-plain-word')).toBe('visual-wordmark.svg');
    expect(choiceVisualAsset('r08-hand')).toBe('visual-ip.svg');
    expect(choiceVisualAsset('r08-wordmark')).toBe('visual-wordmark.svg');
    expect(choiceVisualAsset('r08-ip-stamp')).toBe('visual-ip.svg');
    expect(choiceVisualAsset('r12-seasonal-new')).toBeUndefined();
    expect(touchpointAsset('storefront')).toBe('touchpoints/v19/touchpoint-storefront.jpg');
    expect(touchpointAsset('side-sign')).toBe('touchpoints/v19/touchpoint-side-sign-v19.jpg');
    expect(touchpointAsset('door-info')).toBe('touchpoints/v19/touchpoint-glass-door-v19.jpg');
    expect(touchpointAsset('menu-board')).toBe('touchpoints/v19/touchpoint-menu-board-v19.jpg');
    expect(touchpointAsset('order-card')).toBe('touchpoints/v19/touchpoint-order-card-v19.jpg');
    expect(touchpointAsset('receipt')).toBe('touchpoints/v19/touchpoint-receipt.jpg');
    expect(touchpointAsset('cup')).toBe('touchpoints/v19/touchpoint-cup.jpg');
    expect(touchpointAsset('cup-sleeve')).toBe('touchpoints/v19/touchpoint-hot-cup-sleeve-v19.jpg');
    expect(touchpointAsset('packaging')).toBe('touchpoints/v19/touchpoint-bag.jpg');
    expect(touchpointAsset('avatar')).toBe('touchpoints/v19/touchpoint-avatar.jpg');
    expect(touchpointAsset('menu')).toBe('touchpoints/v19/touchpoint-receipt.jpg');
    expect(touchpointPlacement('storefront')).toMatchObject({
      surfaceClass: 'storefront',
      x: 30.3,
      y: 14.1,
    });
    expect(touchpointPlacement('side-sign')).toMatchObject({
      surfaceClass: 'side-sign',
      x: 39.8,
      y: 18.4,
    });
    expect(touchpointPlacement('cup')).toMatchObject({ surfaceClass: 'cup', x: 35.2, y: 38.8 });
    expect(touchpointPlacement('cup-sleeve')).toMatchObject({
      surfaceClass: 'cup-sleeve',
      x: 30.8,
      y: 31.1,
    });
    expect(touchpointPlacement('avatar')).toMatchObject({
      surfaceClass: 'avatar',
      x: 43.6,
      y: 29.5,
    });
    expect(touchpointPlacement('receipt')).toMatchObject({
      surfaceClass: 'receipt',
      x: 20.2,
      y: 23.4,
    });
    expect(chapterAsset('c2')).toBe('scenes/chapters/chapter-02-product-identity-v19.jpg');
    expect(chapterAsset('c3')).toBe('scenes/chapters/chapter-03-service-v19.jpg');
    expect(chapterAsset('c3')).not.toBe(sceneAsset('briefing-r07'));
    expect(choiceVisualAsset('r01-local')).toBeUndefined();
  });

  it('keeps the planned asset families complete on disk', async () => {
    const allAssets = [
      ...Object.values(V11VisualAssetManifest.scene),
      ...Object.values(V11VisualAssetManifest.action),
      ...Object.values(V11VisualAssetManifest.result),
      ...Object.values(V11VisualAssetManifest.decision),
      ...Object.values(V11VisualAssetManifest.touchpoint),
      ...Object.values(V11VisualAssetManifest.chapter),
    ];
    expect(new Set(allAssets).size).toBe(allAssets.length);
    await Promise.all(allAssets.map((relativePath) => access(`${assetRoot}/${relativePath}`)));
  });

  it('keeps the 28-category touchpoint library complete and non-duplicated', async () => {
    const touchpointAssets = Object.values(V11VisualAssetManifest.touchpoint);

    expect(touchpointAssets).toHaveLength(31);
    expect(new Set(touchpointAssets).size).toBe(touchpointAssets.length);
    await Promise.all(
      touchpointAssets.map((relativePath) => access(`${assetRoot}/${relativePath}`)),
    );

    const hashes = await Promise.all(
      touchpointAssets.map(async (relativePath) =>
        createHash('sha256')
          .update(await readFile(`${assetRoot}/${relativePath}`))
          .digest('hex'),
      ),
    );
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('gives every live stage action a unique, non-duplicated production photograph', async () => {
    const actions = v11FullContent.rounds.flatMap((round) => round.stageActions);
    const mappedAssets = actions.map((action) => actionAsset(action.actionId, action.actionType));
    const assets = mappedAssets.filter((asset): asset is string => asset !== undefined);

    expect(actions).toHaveLength(36);
    expect(assets).toHaveLength(actions.length);
    expect(new Set(assets).size).toBe(actions.length);

    const hashes = await Promise.all(
      assets.map(async (relativePath) =>
        createHash('sha256')
          .update(await readFile(`${assetRoot}/${relativePath}`))
          .digest('hex'),
      ),
    );
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('gives every course round three distinct v19 result-state scenes', async () => {
    const states = ['stable', 'strained', 'crisis'] as const;
    const assets = v11FullContent.rounds.flatMap((round) =>
      states.map((state) => resultSceneAsset(round.roundId, state)),
    );
    const resolvedAssets = assets.filter((asset): asset is string => asset !== undefined);

    expect(resolvedAssets).toHaveLength(36);
    expect(resolvedAssets.every((asset) => asset.includes('-v19-'))).toBe(true);
    expect(new Set(resolvedAssets).size).toBe(resolvedAssets.length);
    await Promise.all(resolvedAssets.map((relativePath) => access(`${assetRoot}/${relativePath}`)));

    const hashes = await Promise.all(
      resolvedAssets.map(async (relativePath) =>
        createHash('sha256')
          .update(await readFile(`${assetRoot}/${relativePath}`))
          .digest('hex'),
      ),
    );
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('uses image elements for photos while retaining SVG fallback hooks', async () => {
    const source = await readFile(new URL('./v11App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('v11-result-photo');
    expect(source).toContain('photo-ready');
    expect(source).toContain('photo-failed');
    expect(source).toContain('resolveResultAsset(roundId, artKey)');
    expect(source).toContain('ChoiceVisualPreview');
    expect(source).toContain('v11-touchpoint-base');
    expect(source).toContain('v11-touchpoint-brand-surface');
    expect(source).toContain('v11-chapter-scene');
  });

  it('keeps all VISUAL-023 briefing, onboarding and chapter scenes distinct', async () => {
    const visual023Assets = [
      [
        'briefing-r01-street',
        'briefing-r02',
        'briefing-r03-product',
        'briefing-r04',
        'briefing-r05',
        'briefing-r06',
        'briefing-r07',
        'briefing-r08-visual',
        'briefing-r09',
        'briefing-r10',
        'briefing-r11-growth',
        'briefing-r12',
      ],
      [
        'onboarding-place',
        'onboarding-goal',
        'onboarding-operation',
        'onboarding-loop-observe',
        'onboarding-loop-decide',
        'onboarding-loop-result',
      ],
    ].flatMap((keys) => keys.map((key) => sceneAsset(key)!));
    const chapters = ['c1', 'c2', 'c3', 'c4'].map((chapterId) => chapterAsset(chapterId)!);
    const allAssets = [...visual023Assets, ...chapters];

    expect(new Set(allAssets).size).toBe(allAssets.length);

    const hashes = await Promise.all(
      allAssets.map(async (relativePath) =>
        createHash('sha256')
          .update(await readFile(`${assetRoot}/${relativePath}`))
          .digest('hex'),
      ),
    );
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
