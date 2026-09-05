import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
    expect(sceneAsset('onboarding-place')).toBe('scenes/onboarding/onboarding-place.jpg');
    expect(sceneAsset('briefing-r08-visual')).toBe('scenes/briefing/briefing-r08-v19.jpg');
    expect(resultSceneAsset('r08', 'stable')).toBe('scenes/results/result-r08-v18-stable.jpg');
    expect(resultSceneAsset('r01', 'stable')).toBe('scenes/results/result-r01-v18-neighbor.jpg');
    expect(resultSceneAsset('r01', 'strained')).toBe('scenes/results/result-r01-v18-hybrid.jpg');
    expect(resultSceneAsset('r01', 'crisis')).toBe('scenes/results/result-r01-v18-tourist.jpg');
    expect(sceneAsset('briefing-r03-product')).toBe('scenes/briefing/briefing-r03-v18.jpg');
    expect(sceneAsset('briefing-r04')).toBe('scenes/briefing/briefing-r04-v19.jpg');
    expect(sceneAsset('briefing-r05')).toBe('scenes/briefing/briefing-r05-v19.jpg');
    expect(sceneAsset('briefing-r07')).toBe('scenes/briefing/briefing-r07-v19.jpg');
    expect(resultSceneAsset('r03', 'stable')).toBe('scenes/results/result-r03-v18-stable.jpg');
    expect(resultSceneAsset('r03', 'strained')).toBe('scenes/results/result-r03-v18-strained.jpg');
    expect(resultSceneAsset('r03', 'crisis')).toBe('scenes/results/result-r03-v18-crisis.jpg');
    expect(resultSceneAsset('r05', 'stable')).toBe('scenes/results/result-r05-v19-stable.jpg');
    expect(resultSceneAsset('r05', 'strained')).toBe('scenes/results/result-r05-v19-strained.jpg');
    expect(resultSceneAsset('r05', 'crisis')).toBe('scenes/results/result-r05-v19-crisis.jpg');
    expect(sceneAsset('briefing-r11-growth')).toBe('scenes/briefing/briefing-r11-v18.jpg');
    expect(resultSceneAsset('r11', 'stable')).toBe('scenes/results/result-r11-v18-stable.jpg');
    expect(resultSceneAsset('r11', 'strained')).toBe('scenes/results/result-r11-v18-strained.jpg');
    expect(resultSceneAsset('r11', 'crisis')).toBe('scenes/results/result-r11-v18-crisis.jpg');
    expect(resultSceneAsset('r07', 'stable')).toBe('scenes/results/result-r07-stable.jpg');
    expect(resultSceneAsset('r12', 'crisis')).toBe('scenes/results/result-r12-crisis.jpg');
    expect(sceneAsset('not-a-real-scene')).toBeUndefined();
  });

  it('maps course-specific decision, touchpoint and chapter visuals without inflating compact cards', () => {
    expect(actionAsset('r01-observe-footfall', 'research')).toBe('actions/action-observe-v1.webp');
    expect(actionAsset('r01-interview-neighbors', 'research')).toBe('actions/action-test-v1.webp');
    expect(actionAsset('r01-quote-rent', 'quote')).toBe('actions/action-quote-v1.webp');
    expect(actionAsset('r08-negotiate-production', 'negotiate')).toBe(
      'actions/action-quote-v1.webp',
    );
    expect(
      new Set([
        actionAsset('r03-test-recipe', 'test'),
        actionAsset('r03-quote-packaging', 'quote'),
        actionAsset('r03-negotiate-supply', 'negotiate'),
      ]),
    ).toHaveLength(3);
    expect(
      new Set([
        actionAsset('r08-test-sign', 'test'),
        actionAsset('r08-test-packaging', 'test'),
        actionAsset('r08-negotiate-production', 'negotiate'),
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
    expect(decisionAsset('r05-tea-character')).toBe('decisions/ip-objects/ip-object-tea-clip.jpg');
    expect(choiceVisualAsset('r05-plain-word')).toBe('visual-wordmark.svg');
    expect(choiceVisualAsset('r08-hand')).toBe('visual-ip.svg');
    expect(choiceVisualAsset('r08-wordmark')).toBe('visual-wordmark.svg');
    expect(choiceVisualAsset('r08-ip-stamp')).toBe('visual-ip.svg');
    expect(choiceVisualAsset('r12-seasonal-new')).toBeUndefined();
    expect(touchpointAsset('storefront')).toBe('touchpoints/v19/touchpoint-storefront.jpg');
    expect(touchpointAsset('cup')).toBe('touchpoints/v19/touchpoint-cup.jpg');
    expect(touchpointAsset('packaging')).toBe('touchpoints/v19/touchpoint-bag.jpg');
    expect(touchpointAsset('avatar')).toBe('touchpoints/v19/touchpoint-avatar.jpg');
    expect(touchpointAsset('menu')).toBe('touchpoints/v19/touchpoint-receipt.jpg');
    expect(touchpointPlacement('storefront')).toMatchObject({
      surfaceClass: 'storefront',
      x: 30.3,
      y: 14.1,
    });
    expect(touchpointPlacement('cup')).toMatchObject({ surfaceClass: 'cup', x: 35.2, y: 38.8 });
    expect(touchpointPlacement('avatar')).toMatchObject({
      surfaceClass: 'avatar',
      x: 43.6,
      y: 29.5,
    });
    expect(touchpointPlacement('menu')).toMatchObject({ surfaceClass: 'menu', x: 20.2, y: 23.4 });
    expect(chapterAsset('c2')).toBe('scenes/chapters/chapter-02-product-identity.jpg');
    expect(chapterAsset('c3')).toBe('scenes/chapters/chapter-03-service-v2.jpg');
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

  it('keeps active briefing and chapter-review scenes visually distinct', async () => {
    const briefing = await readFile(`${assetRoot}/${sceneAsset('briefing-r07')}`);
    const chapter = await readFile(`${assetRoot}/${chapterAsset('c3')}`);
    expect(chapter.equals(briefing)).toBe(false);
  });
});
