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
    asset: 'touchpoints/v19/touchpoint-storefront.jpg',
    label: '店招',
    surfaceClass: 'storefront',
    x: 30.3,
    y: 14.1,
    width: 43.2,
    height: 16.2,
  },
  cup: {
    asset: 'touchpoints/v19/touchpoint-cup.jpg',
    label: '杯身',
    surfaceClass: 'cup',
    x: 35.2,
    y: 38.8,
    width: 29.8,
    height: 34.6,
  },
  packaging: {
    asset: 'touchpoints/v19/touchpoint-bag.jpg',
    label: '包装',
    surfaceClass: 'packaging',
    x: 32.2,
    y: 28.2,
    width: 35.2,
    height: 53.6,
  },
  avatar: {
    asset: 'touchpoints/v19/touchpoint-avatar.jpg',
    label: '头像',
    surfaceClass: 'avatar',
    x: 43.6,
    y: 29.5,
    width: 16.3,
    height: 21.7,
  },
  menu: {
    asset: 'touchpoints/v19/touchpoint-receipt.jpg',
    label: '小票',
    surfaceClass: 'menu',
    x: 20.2,
    y: 23.4,
    width: 24.8,
    height: 16.8,
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
  'briefing-r04': 'scenes/briefing/briefing-r04-v19.jpg',
  'briefing-r05': 'scenes/briefing/briefing-r05-v19.jpg',
  'briefing-r06': 'scenes/briefing/briefing-r06.jpg',
  'briefing-r07': 'scenes/briefing/briefing-r07-v19.jpg',
  'briefing-r08-visual': 'scenes/briefing/briefing-r08-v19.jpg',
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

// P1 gives each course action its own operational camera.  Keep the generic
// family as a compatibility fallback for unfinished or future content, but do
// not collapse the active round's three evidence-gathering jobs into one scene.
const actionAssetOverrides: Record<string, string> = {
  'r01-observe-footfall': 'actions/v19/action-r01-observe-footfall.jpg',
  'r01-interview-neighbors': 'actions/v19/action-r01-interview-neighbors.jpg',
  'r01-quote-rent': 'actions/v19/action-r01-quote-rent.jpg',
  'r02-observe': 'actions/v19/action-r02-interview-segments.jpg',
  'r02-test': 'actions/v19/action-r02-test-promise.jpg',
  'r02-quote': 'actions/v19/action-r02-quote-staffing.jpg',
  'r03-test-recipe': 'actions/v19/action-r03-test-recipe.jpg',
  'r03-quote-packaging': 'actions/v19/action-r03-quote-packaging.jpg',
  'r03-negotiate-supply': 'actions/v19/action-r03-negotiate-supply.jpg',
  'r04-observe': 'actions/v19/action-r04-observe-price.jpg',
  'r04-test': 'actions/v19/action-r04-test-gift-box.jpg',
  'r04-quote': 'actions/v19/action-r04-quote-full-cost.jpg',
  'r05-observe': 'actions/v19/action-r05-observe-sign-read.jpg',
  'r05-test': 'actions/v19/action-r05-test-avatar.jpg',
  'r05-quote': 'actions/v19/action-r05-quote-print.jpg',
  'r06-observe': 'actions/v19/action-r06-observe-entrance.jpg',
  'r06-test': 'actions/v19/action-r06-test-video-visit.jpg',
  'r06-quote': 'actions/v19/action-r06-quote-partner.jpg',
  'r07-observe': 'actions/v19/action-r07-observe-peak-order.jpg',
  'r07-test': 'actions/v19/action-r07-test-order-dots.jpg',
  'r07-quote': 'actions/v19/action-r07-quote-staff-roles.jpg',
  'r08-test-sign': 'actions/v19/action-r08-test-sign.jpg',
  'r08-test-packaging': 'actions/v19/action-r08-test-packaging.jpg',
  'r08-negotiate-production': 'actions/v19/action-r08-negotiate-production.jpg',
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
resultAssets['r04-stable'] = 'scenes/results/result-r04-v19-stable.jpg';
resultAssets['r04-strained'] = 'scenes/results/result-r04-v19-strained.jpg';
resultAssets['r04-crisis'] = 'scenes/results/result-r04-v19-crisis.jpg';
resultAssets['r05-stable'] = 'scenes/results/result-r05-v19-stable.jpg';
resultAssets['r05-strained'] = 'scenes/results/result-r05-v19-strained.jpg';
resultAssets['r05-crisis'] = 'scenes/results/result-r05-v19-crisis.jpg';
resultAssets['r06-stable'] = 'scenes/results/result-r06-v19-stable.jpg';
resultAssets['r06-strained'] = 'scenes/results/result-r06-v19-strained.jpg';
resultAssets['r06-crisis'] = 'scenes/results/result-r06-v19-crisis.jpg';
resultAssets['r09-stable'] = 'scenes/results/result-r09-v19-stable.jpg';
resultAssets['r09-strained'] = 'scenes/results/result-r09-v19-strained.jpg';
resultAssets['r09-crisis'] = 'scenes/results/result-r09-v19-crisis.jpg';
resultAssets['r12-stable'] = 'scenes/results/result-r12-v19-stable.jpg';
resultAssets['r12-strained'] = 'scenes/results/result-r12-v19-strained.jpg';
resultAssets['r12-crisis'] = 'scenes/results/result-r12-v19-crisis.jpg';
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
  'ip-object-sleeve-storage': 'decisions/ip-objects/ip-object-sleeve-storage-v19.jpg',
  'ip-object-tea-clip': 'decisions/ip-objects/ip-object-tea-clip-v19.jpg',
  'ip-object-cup-carrier': 'decisions/ip-objects/ip-object-cup-carrier-v19.jpg',
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
  action: {
    ...actionAssets,
    'r01-observe-footfall': actionAssetOverrides['r01-observe-footfall']!,
    'r01-interview-neighbors': actionAssetOverrides['r01-interview-neighbors']!,
    'r01-quote-rent': actionAssetOverrides['r01-quote-rent']!,
    'r02-observe': actionAssetOverrides['r02-observe']!,
    'r02-test': actionAssetOverrides['r02-test']!,
    'r02-quote': actionAssetOverrides['r02-quote']!,
    'r03-test-recipe': actionAssetOverrides['r03-test-recipe']!,
    'r03-quote-packaging': actionAssetOverrides['r03-quote-packaging']!,
    'r03-negotiate-supply': actionAssetOverrides['r03-negotiate-supply']!,
    'r04-observe': actionAssetOverrides['r04-observe']!,
    'r04-test': actionAssetOverrides['r04-test']!,
    'r04-quote': actionAssetOverrides['r04-quote']!,
    'r05-observe': actionAssetOverrides['r05-observe']!,
    'r05-test': actionAssetOverrides['r05-test']!,
    'r05-quote': actionAssetOverrides['r05-quote']!,
    'r06-observe': actionAssetOverrides['r06-observe']!,
    'r06-test': actionAssetOverrides['r06-test']!,
    'r06-quote': actionAssetOverrides['r06-quote']!,
    'r07-observe': actionAssetOverrides['r07-observe']!,
    'r07-test': actionAssetOverrides['r07-test']!,
    'r07-quote': actionAssetOverrides['r07-quote']!,
    'r08-test-sign': actionAssetOverrides['r08-test-sign']!,
    'r08-test-packaging': actionAssetOverrides['r08-test-packaging']!,
    'r08-negotiate-production': actionAssetOverrides['r08-negotiate-production']!,
  },
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
