export type V11OutcomeState = 'stable' | 'strained' | 'crisis';

export type V11TouchpointId = 'storefront' | 'cup' | 'packaging' | 'avatar' | 'menu';

export type V11TouchpointPlacement = {
  asset: string;
  label: string;
  surfaceClass: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const V11VisualTouchpointPlacements: Record<V11TouchpointId, V11TouchpointPlacement> = {
  storefront: {
    asset: 'touchpoints/v18/touchpoint-storefront.jpg',
    label: '店招',
    surfaceClass: 'storefront',
    x: 18.8,
    y: 10.4,
    width: 62.4,
    height: 17.8,
  },
  cup: {
    asset: 'touchpoints/v18/touchpoint-cup.jpg',
    label: '杯身',
    surfaceClass: 'cup',
    x: 33.2,
    y: 38.6,
    width: 33.8,
    height: 36.4,
  },
  packaging: {
    asset: 'touchpoints/v18/touchpoint-bag.jpg',
    label: '包装',
    surfaceClass: 'packaging',
    x: 26.8,
    y: 26.4,
    width: 47.4,
    height: 53.6,
  },
  avatar: {
    asset: 'touchpoints/v18/touchpoint-avatar.jpg',
    label: '头像',
    surfaceClass: 'avatar',
    x: 40.5,
    y: 15.4,
    width: 19.2,
    height: 25.4,
  },
  menu: {
    asset: 'touchpoints/v18/touchpoint-receipt.jpg',
    label: '小票',
    surfaceClass: 'menu',
    x: 28.8,
    y: 6.8,
    width: 43.8,
    height: 24.4,
  },
};

const sceneAssets: Record<string, string> = {
  'onboarding-place': 'scenes/onboarding/onboarding-place.jpg',
  'onboarding-goal': 'scenes/onboarding/onboarding-goal.jpg',
  'onboarding-operation': 'scenes/onboarding/onboarding-operation.jpg',
  'onboarding-loop-observe': 'scenes/onboarding/onboarding-loop-observe.jpg',
  'onboarding-loop-decide': 'scenes/onboarding/onboarding-loop-decide.jpg',
  'onboarding-loop-result': 'scenes/onboarding/onboarding-loop-result.jpg',
  'briefing-r01-street': 'scenes/briefing/briefing-r01-v18.jpg',
  'briefing-r02': 'scenes/briefing/briefing-r02.jpg',
  'briefing-r03-product': 'scenes/briefing/briefing-r03-v18.jpg',
  'briefing-r04': 'scenes/briefing/briefing-r04.jpg',
  'briefing-r05': 'scenes/briefing/briefing-r05.jpg',
  'briefing-r06': 'scenes/briefing/briefing-r06.jpg',
  'briefing-r07': 'scenes/briefing/briefing-r07.jpg',
  'briefing-r08-visual': 'scenes/briefing/briefing-r08-v18.jpg',
  'briefing-r09': 'scenes/briefing/briefing-r09.jpg',
  'briefing-r10': 'scenes/briefing/briefing-r10.jpg',
  'briefing-r11-growth': 'scenes/briefing/briefing-r11-v18.jpg',
  'briefing-r12': 'scenes/briefing/briefing-r12.jpg',
};

const actionAssets: Record<string, string> = {
  research: 'actions/action-observe-v1.webp',
  test: 'actions/action-test-v1.webp',
  quote: 'actions/action-quote-v1.webp',
};

// Keep the three actions shown in a single round visually distinguishable.
// These are semantic overrides, not extra decoration: a field audit reads as
// observation, a physical trial as testing, and a supplier discussion as a
// quote/conversation.
const actionAssetOverrides: Record<string, string> = {
  'r01-interview-neighbors': 'actions/action-test-v1.webp',
  'r03-negotiate-supply': 'actions/action-observe-v1.webp',
  'r08-test-sign': 'actions/action-observe-v1.webp',
};

const resultAssets: Record<string, string> = {};
for (let index = 1; index <= 12; index += 1) {
  const roundId = `r${String(index).padStart(2, '0')}`;
  for (const state of ['stable', 'strained', 'crisis'] as const) {
    resultAssets[`${roundId}-${state}`] = `scenes/results/result-${roundId}-${state}.jpg`;
  }
}
resultAssets['r08-stable'] = 'scenes/results/result-r08-v18-stable.jpg';
resultAssets['r08-strained'] = 'scenes/results/result-r08-v18-strained.jpg';
resultAssets['r08-crisis'] = 'scenes/results/result-r08-v18-crisis.jpg';
resultAssets['r01-stable'] = 'scenes/results/result-r01-v18-neighbor.jpg';
resultAssets['r01-strained'] = 'scenes/results/result-r01-v18-hybrid.jpg';
resultAssets['r01-crisis'] = 'scenes/results/result-r01-v18-tourist.jpg';
resultAssets['r03-stable'] = 'scenes/results/result-r03-v18-stable.jpg';
resultAssets['r03-strained'] = 'scenes/results/result-r03-v18-strained.jpg';
resultAssets['r03-crisis'] = 'scenes/results/result-r03-v18-crisis.jpg';
resultAssets['r11-stable'] = 'scenes/results/result-r11-v18-stable.jpg';
resultAssets['r11-strained'] = 'scenes/results/result-r11-v18-strained.jpg';
resultAssets['r11-crisis'] = 'scenes/results/result-r11-v18-crisis.jpg';

const decisionAssets: Record<string, string> = {
  'product-r03-stable': 'decisions/products/product-r03-v18-stable.jpg',
  'product-r03-complex': 'decisions/products/product-r03-v18-complex.jpg',
  'product-r03-local': 'decisions/products/product-r03-v18-local.jpg',
  'product-r03-seasonal-ritual': 'decisions/products/product-r03-v18-seasonal-ritual.jpg',
  'product-r03-modular-menu': 'decisions/products/product-r03-v18-modular-menu.jpg',
  'package-r04-everyday-cup': 'decisions/packaging/package-r04-v18-everyday-cup.jpg',
  'package-r04-gift-box': 'decisions/packaging/package-r04-v18-gift-box.jpg',
  'package-r04-refill': 'decisions/packaging/package-r04-v18-refill.jpg',
  'package-r04-price-ladder': 'decisions/packaging/package-r04-v18-price-ladder.jpg',
  'package-r04-bundle': 'decisions/packaging/package-r04-v18-bundle.jpg',
  'ip-object-sleeve-storage': 'decisions/ip-objects/ip-object-sleeve-storage.jpg',
  'ip-object-tea-clip': 'decisions/ip-objects/ip-object-tea-clip.jpg',
  'ip-object-cup-carrier': 'decisions/ip-objects/ip-object-cup-carrier.jpg',
};

const touchpointAssets: Record<string, string> = {
  'touchpoint-storefront': V11VisualTouchpointPlacements.storefront.asset,
  'touchpoint-cup': V11VisualTouchpointPlacements.cup.asset,
  'touchpoint-bag': V11VisualTouchpointPlacements.packaging.asset,
  'touchpoint-avatar': V11VisualTouchpointPlacements.avatar.asset,
  'touchpoint-receipt': V11VisualTouchpointPlacements.menu.asset,
};

const touchpointAliases: Record<string, string> = {
  packaging: 'touchpoint-bag',
  menu: 'touchpoint-receipt',
};

const chapterAssets: Record<string, string> = {
  'chapter-01-customers': 'scenes/chapters/chapter-01-customers.jpg',
  'chapter-02-product-identity': 'scenes/chapters/chapter-02-product-identity.jpg',
  'chapter-03-service': 'scenes/chapters/chapter-03-service-v2.jpg',
  'chapter-04-growth': 'scenes/chapters/chapter-04-growth.jpg',
};

// Decision visuals are deliberately sparse: they appear in the detail/result
// views, not on every compact option row. This keeps the mobile choice screen
// readable while making the course-specific product, packaging and IP choices
// concrete when a player is actually comparing them.
const choiceVisualAssets: Record<string, string> = {
  'r03-stable': decisionAssets['product-r03-stable']!,
  'r03-complex': decisionAssets['product-r03-complex']!,
  'r03-local-special': decisionAssets['product-r03-local']!,
  'r03-seasonal-ritual': decisionAssets['product-r03-seasonal-ritual']!,
  'r03-modular-menu': decisionAssets['product-r03-modular-menu']!,
  'r04-everyday-cup': decisionAssets['package-r04-everyday-cup']!,
  'r04-gift-box': decisionAssets['package-r04-gift-box']!,
  'r04-refill': decisionAssets['package-r04-refill']!,
  'r04-price-ladder': decisionAssets['package-r04-price-ladder']!,
  'r04-bundle': decisionAssets['package-r04-bundle']!,
  'r05-tea-character': decisionAssets['ip-object-tea-clip']!,
  'r05-neighborhood-seal': decisionAssets['ip-object-sleeve-storage']!,
  'r12-ip-merch': decisionAssets['ip-object-cup-carrier']!,
};

const choiceRouteAssets: Record<string, string> = {
  'r05-plain-word': 'visual-wordmark.svg',
  'r05-mountain-mark': 'visual-symbol.svg',
  'r05-tea-character': 'visual-ip.svg',
  // Historical choice id: keep it playable, but render it with the approved
  // symbol system instead of reviving the retired seal asset.
  'r05-neighborhood-seal': 'visual-symbol.svg',
  'r05-no-symbol': 'visual-wordmark.svg',
  'r08-line': 'visual-wordmark.svg',
  'r08-symbol': 'visual-symbol.svg',
  'r08-hand': 'visual-ip.svg',
  'r08-wordmark': 'visual-wordmark.svg',
  'r08-ip-stamp': 'visual-ip.svg',
};

export const V11VisualAssetManifest = {
  scene: sceneAssets,
  action: actionAssets,
  result: resultAssets,
  decision: decisionAssets,
  touchpoint: touchpointAssets,
  chapter: chapterAssets,
} as const;

export function sceneAsset(imageKey: string): string | undefined {
  return sceneAssets[imageKey];
}

export function actionAsset(actionId: string, actionType: string): string | undefined {
  if (actionAssetOverrides[actionId]) return actionAssetOverrides[actionId];
  if (actionType === 'negotiate') return actionAssets.quote;
  return actionAssets[actionType];
}

export function resultSceneAsset(
  roundId: string,
  outcomeState: V11OutcomeState,
): string | undefined {
  return resultAssets[`${roundId}-${outcomeState}`];
}

export function decisionAsset(choiceId: string): string | undefined {
  return choiceVisualAssets[choiceId];
}

export function choiceVisualAsset(choiceId: string): string | undefined {
  return choiceVisualAssets[choiceId] ?? choiceRouteAssets[choiceId];
}

export function touchpointAsset(touchpointId: string): string | undefined {
  return (
    touchpointAssets[`touchpoint-${touchpointId}`] ??
    touchpointAssets[touchpointAliases[touchpointId] ?? '']
  );
}

export function touchpointPlacement(touchpointId: string): V11TouchpointPlacement | undefined {
  return V11VisualTouchpointPlacements[touchpointId as V11TouchpointId];
}

export function chapterAsset(chapterId: string): string | undefined {
  return chapterAssets[
    `chapter-${chapterId === 'c1' ? '01-customers' : chapterId === 'c2' ? '02-product-identity' : chapterId === 'c3' ? '03-service' : chapterId === 'c4' ? '04-growth' : chapterId}`
  ];
}

export function visualAssetPath(relativePath: string): string {
  return `/assets/v11/${relativePath}`;
}
