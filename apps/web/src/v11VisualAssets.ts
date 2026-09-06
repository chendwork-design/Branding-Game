export type V11OutcomeState = 'stable' | 'strained' | 'crisis';

export type V11TouchpointId =
  | 'storefront'
  | 'side-sign'
  | 'door-info'
  | 'menu-board'
  | 'order-card'
  | 'receipt'
  | 'cup'
  | 'cup-sleeve'
  | 'packaging'
  | 'avatar';

export type V11TouchpointPlacement = {
  asset: string;
  label: string;
  surfaceClass: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type V11VisualFocalPoint = {
  x: number;
  y: number;
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
  'side-sign': {
    asset: 'touchpoints/v19/touchpoint-side-sign-v19.jpg',
    label: '侧挂招',
    surfaceClass: 'side-sign',
    x: 39.8,
    y: 18.4,
    width: 28.4,
    height: 61.8,
  },
  'door-info': {
    asset: 'touchpoints/v19/touchpoint-glass-door-v19.jpg',
    label: '玻璃门贴',
    surfaceClass: 'door-info',
    x: 28.3,
    y: 24.5,
    width: 45.2,
    height: 53.4,
  },
  'menu-board': {
    asset: 'touchpoints/v19/touchpoint-menu-board-v19.jpg',
    label: '室内菜单',
    surfaceClass: 'menu-board',
    x: 9.6,
    y: 18.2,
    width: 38.4,
    height: 42.2,
  },
  'order-card': {
    asset: 'touchpoints/v19/touchpoint-order-card-v19.jpg',
    label: '点单卡',
    surfaceClass: 'order-card',
    x: 26.9,
    y: 10.5,
    width: 47.6,
    height: 72.8,
  },
  receipt: {
    asset: 'touchpoints/v19/touchpoint-receipt.jpg',
    label: '小票',
    surfaceClass: 'receipt',
    x: 20.2,
    y: 23.4,
    width: 24.8,
    height: 16.8,
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
  'cup-sleeve': {
    asset: 'touchpoints/v19/touchpoint-hot-cup-sleeve-v19.jpg',
    label: '热饮杯套',
    surfaceClass: 'cup-sleeve',
    x: 30.8,
    y: 31.1,
    width: 37.5,
    height: 45.4,
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
};

// The ten course comparison surfaces stay in the primary tab row. The remaining
// applications are grouped separately so they remain inspectable without making a
// phone-sized tab strip unusable. Each placement is a real print/attachment area,
// never a centered card pasted over the photo.
export const V11VisualAdditionalTouchpointIds = [
  'a-frame',
  'story-wall',
  'pickup-token',
  'pickup-shelf-label',
  'price-tag',
  'tamper-seal',
  'lid-marker',
  'coaster-napkin',
  'tray-mat',
  'double-carrier',
  'gift-box',
  'refill-pouch',
  'tea-tin',
  'snack-carrier',
  'apron-patch',
  'name-badge',
  'customer-cards',
  'hotel-supply',
  'delivery-crates',
  'popup-flag',
  'sleeve-dispenser',
] as const;

type V11VisualAdditionalTouchpointId = (typeof V11VisualAdditionalTouchpointIds)[number];

export const V11VisualAdditionalTouchpointPlacements: Record<
  V11VisualAdditionalTouchpointId,
  V11TouchpointPlacement
> = {
  'a-frame': {
    asset: 'touchpoints/v19/touchpoint-a-frame-v19.jpg',
    label: '门口 A 字牌',
    surfaceClass: 'flat-board',
    x: 19,
    y: 9,
    width: 57,
    height: 86,
  },
  'story-wall': {
    asset: 'touchpoints/v19/touchpoint-story-wall-v19.jpg',
    label: '品牌故事墙',
    surfaceClass: 'flat-board',
    x: 28,
    y: 15,
    width: 47,
    height: 56,
  },
  'pickup-token': {
    asset: 'touchpoints/v19/touchpoint-pickup-token-v19.jpg',
    label: '取杯号牌',
    surfaceClass: 'small-token',
    x: 8,
    y: 47,
    width: 60,
    height: 24,
  },
  'pickup-shelf-label': {
    asset: 'touchpoints/v19/touchpoint-pickup-shelf-label-v19.jpg',
    label: '取杯架标签',
    surfaceClass: 'small-token',
    x: 34,
    y: 43,
    width: 58,
    height: 13,
  },
  'price-tag': {
    asset: 'touchpoints/v19/touchpoint-price-tag-v19.jpg',
    label: '价格/原料签',
    surfaceClass: 'small-token',
    x: 25,
    y: 56,
    width: 55,
    height: 20,
  },
  'tamper-seal': {
    asset: 'touchpoints/v19/touchpoint-tamper-seal-v19.jpg',
    label: '封口防拆贴',
    surfaceClass: 'round-surface',
    x: 11,
    y: 51,
    width: 25,
    height: 22,
  },
  'lid-marker': {
    asset: 'touchpoints/v19/touchpoint-lid-marker-v19.jpg',
    label: '杯盖口味贴',
    surfaceClass: 'round-surface',
    x: 16,
    y: 36,
    width: 26,
    height: 30,
  },
  'coaster-napkin': {
    asset: 'touchpoints/v19/touchpoint-coaster-napkin-v19.jpg',
    label: '杯垫与餐巾',
    surfaceClass: 'paper-surface',
    x: 62,
    y: 16,
    width: 28,
    height: 48,
  },
  'tray-mat': {
    asset: 'touchpoints/v19/touchpoint-tray-mat-v19.jpg',
    label: '托盘交接垫',
    surfaceClass: 'paper-surface',
    x: 19,
    y: 42,
    width: 63,
    height: 31,
  },
  'double-carrier': {
    asset: 'touchpoints/v19/touchpoint-double-carrier-v19.jpg',
    label: '双杯提篮',
    surfaceClass: 'paper-surface',
    x: 37,
    y: 55,
    width: 25,
    height: 20,
  },
  'gift-box': {
    asset: 'touchpoints/v19/touchpoint-gift-box-v19.jpg',
    label: '地方礼盒',
    surfaceClass: 'paper-surface',
    x: 21,
    y: 20,
    width: 38,
    height: 42,
  },
  'refill-pouch': {
    asset: 'touchpoints/v19/touchpoint-refill-pouch-v19.jpg',
    label: '补充装袋',
    surfaceClass: 'packaging',
    x: 45,
    y: 12,
    width: 31,
    height: 76,
  },
  'tea-tin': {
    asset: 'touchpoints/v19/touchpoint-tea-tin-v19.jpg',
    label: '茶罐',
    surfaceClass: 'cylinder-surface',
    x: 31,
    y: 20,
    width: 32,
    height: 60,
  },
  'snack-carrier': {
    asset: 'touchpoints/v19/touchpoint-snack-carrier-v19.jpg',
    label: '饮品点心组合',
    surfaceClass: 'paper-surface',
    x: 25,
    y: 50,
    width: 50,
    height: 24,
  },
  'apron-patch': {
    asset: 'touchpoints/v19/touchpoint-apron-patch-v19.jpg',
    label: '围裙胸前应用',
    surfaceClass: 'fabric-surface',
    x: 42,
    y: 30,
    width: 12,
    height: 10,
  },
  'name-badge': {
    asset: 'touchpoints/v19/touchpoint-name-badge-v19.jpg',
    label: '员工名牌',
    surfaceClass: 'small-token',
    x: 34,
    y: 45,
    width: 23,
    height: 16,
  },
  'customer-cards': {
    asset: 'touchpoints/v19/touchpoint-customer-cards-v19.jpg',
    label: '会员与投稿卡',
    surfaceClass: 'paper-surface',
    x: 8,
    y: 21,
    width: 82,
    height: 60,
  },
  'hotel-supply': {
    asset: 'touchpoints/v19/touchpoint-hotel-supply-v19.jpg',
    label: '酒店供货',
    surfaceClass: 'packaging',
    x: 15,
    y: 20,
    width: 60,
    height: 54,
  },
  'delivery-crates': {
    asset: 'touchpoints/v19/touchpoint-delivery-crates-v19.jpg',
    label: '配送箱',
    surfaceClass: 'flat-board',
    x: 20,
    y: 20,
    width: 50,
    height: 56,
  },
  'popup-flag': {
    asset: 'touchpoints/v19/touchpoint-popup-flag-v19.jpg',
    label: '快闪桌旗',
    surfaceClass: 'fabric-surface',
    x: 36,
    y: 30,
    width: 24,
    height: 45,
  },
  'sleeve-dispenser': {
    asset: 'touchpoints/v19/touchpoint-sleeve-dispenser-v19.jpg',
    label: '杯套收纳器',
    surfaceClass: 'round-surface',
    x: 38,
    y: 49,
    width: 22,
    height: 21,
  },
};

const allTouchpointPlacements: Record<string, V11TouchpointPlacement> = {
  ...V11VisualTouchpointPlacements,
  ...V11VisualAdditionalTouchpointPlacements,
};

const sceneAssets: Record<string, string> = {
  'onboarding-place': 'scenes/onboarding/onboarding-place-v19.jpg',
  'onboarding-goal': 'scenes/onboarding/onboarding-goal-v19.jpg',
  'onboarding-operation': 'scenes/onboarding/onboarding-operation-v19.jpg',
  'onboarding-loop-observe': 'scenes/onboarding/onboarding-loop-observe-v19.jpg',
  'onboarding-loop-decide': 'scenes/onboarding/onboarding-loop-decide-v19.jpg',
  'onboarding-loop-result': 'scenes/onboarding/onboarding-loop-result-v19.jpg',
  'briefing-r01-street': 'scenes/briefing/briefing-r01-v19.jpg',
  'briefing-r02': 'scenes/briefing/briefing-r02-v19.jpg',
  'briefing-r03-product': 'scenes/briefing/briefing-r03-v19.jpg',
  'briefing-r04': 'scenes/briefing/briefing-r04-v19.jpg',
  'briefing-r05': 'scenes/briefing/briefing-r05-v19.jpg',
  'briefing-r06': 'scenes/briefing/briefing-r06-v19.jpg',
  'briefing-r07': 'scenes/briefing/briefing-r07-v19.jpg',
  'briefing-r08-visual': 'scenes/briefing/briefing-r08-v19.jpg',
  'briefing-r09': 'scenes/briefing/briefing-r09-v19.jpg',
  'briefing-r10': 'scenes/briefing/briefing-r10-v19.jpg',
  'briefing-r11-growth': 'scenes/briefing/briefing-r11-v19.jpg',
  'briefing-r12': 'scenes/briefing/briefing-r12-v19.jpg',
};

// P1 gives each course action its own operational camera. There is no generic
// visual fallback in the runtime manifest: a new course action must ship its
// own approved photograph instead of silently reviving an old stock thumbnail.
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
  'r09-observe': 'actions/v19/action-r09-observe-customer-shares.jpg',
  'r09-test': 'actions/v19/action-r09-test-story-invite.jpg',
  'r09-quote': 'actions/v19/action-r09-quote-review-roles.jpg',
  'r10-observe': 'actions/v19/action-r10-observe-delivery.jpg',
  'r10-test': 'actions/v19/action-r10-test-small-batch.jpg',
  'r10-quote': 'actions/v19/action-r10-quote-fixed-costs.jpg',
  'r11-audit-capacity': 'actions/v19/action-r11-observe-peak-hour.jpg',
  'r11-test-delivery': 'actions/v19/action-r11-test-platform-batch.jpg',
  'r11-negotiate-platform': 'actions/v19/action-r11-quote-supplier-capacity.jpg',
  'r12-observe': 'actions/v19/action-r12-observe-regulars.jpg',
  'r12-test': 'actions/v19/action-r12-test-inventory-retro.jpg',
  'r12-quote': 'actions/v19/action-r12-quote-next-plan.jpg',
};

const resultAssets: Record<string, string> = {};
for (let index = 1; index <= 12; index += 1) {
  const roundId = `r${String(index).padStart(2, '0')}`;
  for (const state of ['stable', 'strained', 'crisis'] as const) {
    resultAssets[`${roundId}-${state}`] = `scenes/results/result-${roundId}-v19-${state}.jpg`;
  }
}

const decisionAssets: Record<string, string> = {
  'product-r03-stable': 'decisions/products/product-r03-v19-stable.jpg',
  'product-r03-complex': 'decisions/products/product-r03-v19-complex.jpg',
  'product-r03-local': 'decisions/products/product-r03-v19-local.jpg',
  'product-r03-seasonal-ritual': 'decisions/products/product-r03-v19-seasonal-ritual.jpg',
  'product-r03-modular-menu': 'decisions/products/product-r03-v19-modular-menu.jpg',
  'package-r04-everyday-cup': 'decisions/packaging/package-r04-v19-everyday-cup.jpg',
  'package-r04-gift-box': 'decisions/packaging/package-r04-v19-gift-box.jpg',
  'package-r04-refill': 'decisions/packaging/package-r04-v19-refill.jpg',
  'package-r04-price-ladder': 'decisions/packaging/package-r04-v19-price-ladder.jpg',
  'package-r04-bundle': 'decisions/packaging/package-r04-v19-bundle.jpg',
  'detail-r06-shortvideo': 'decisions/details/detail-r06-v19-shortvideo.jpg',
  'detail-r06-partner-host': 'decisions/details/detail-r06-v19-partner-host.jpg',
  'detail-r07-greeting-script': 'decisions/details/detail-r07-v19-greeting-script.jpg',
  'detail-r07-self-service': 'decisions/details/detail-r07-v19-self-service.jpg',
  'detail-r09-stories': 'decisions/details/detail-r09-v19-stories.jpg',
  'detail-r09-feedback-table': 'decisions/details/detail-r09-v19-feedback-table.jpg',
  'detail-r10-wholesale': 'decisions/details/detail-r10-v19-wholesale.jpg',
  'detail-r10-delivery': 'decisions/details/detail-r10-v19-delivery.jpg',
  'detail-r11-platform': 'decisions/details/detail-r11-v19-platform.jpg',
  'detail-r11-limited-drop': 'decisions/details/detail-r11-v19-limited-drop.jpg',
  'detail-r12-seasonal-new': 'decisions/details/detail-r12-v19-seasonal-new.jpg',
  'detail-r12-ip-merch': 'decisions/details/detail-r12-v19-ip-merch.jpg',
  'ip-object-sleeve-storage': 'decisions/ip-objects/ip-object-sleeve-storage-v19.jpg',
  'ip-object-tea-clip': 'decisions/ip-objects/ip-object-tea-clip-v19.jpg',
  'ip-object-cup-carrier': 'decisions/ip-objects/ip-object-cup-carrier-v19.jpg',
};

const touchpointAssets: Record<string, string> = {
  'touchpoint-storefront': V11VisualTouchpointPlacements.storefront.asset,
  'touchpoint-side-sign': V11VisualTouchpointPlacements['side-sign'].asset,
  'touchpoint-glass-door': V11VisualTouchpointPlacements['door-info'].asset,
  'touchpoint-menu-board': V11VisualTouchpointPlacements['menu-board'].asset,
  'touchpoint-order-card': V11VisualTouchpointPlacements['order-card'].asset,
  'touchpoint-receipt': V11VisualTouchpointPlacements.receipt.asset,
  'touchpoint-cup': V11VisualTouchpointPlacements.cup.asset,
  'touchpoint-hot-cup-sleeve': V11VisualTouchpointPlacements['cup-sleeve'].asset,
  'touchpoint-bag': V11VisualTouchpointPlacements.packaging.asset,
  'touchpoint-avatar': V11VisualTouchpointPlacements.avatar.asset,
  'touchpoint-a-frame': 'touchpoints/v19/touchpoint-a-frame-v19.jpg',
  'touchpoint-story-wall': 'touchpoints/v19/touchpoint-story-wall-v19.jpg',
  'touchpoint-pickup-token': 'touchpoints/v19/touchpoint-pickup-token-v19.jpg',
  'touchpoint-pickup-shelf-label': 'touchpoints/v19/touchpoint-pickup-shelf-label-v19.jpg',
  'touchpoint-price-tag': 'touchpoints/v19/touchpoint-price-tag-v19.jpg',
  'touchpoint-tamper-seal': 'touchpoints/v19/touchpoint-tamper-seal-v19.jpg',
  'touchpoint-lid-marker': 'touchpoints/v19/touchpoint-lid-marker-v19.jpg',
  'touchpoint-coaster-napkin': 'touchpoints/v19/touchpoint-coaster-napkin-v19.jpg',
  'touchpoint-tray-mat': 'touchpoints/v19/touchpoint-tray-mat-v19.jpg',
  'touchpoint-double-carrier': 'touchpoints/v19/touchpoint-double-carrier-v19.jpg',
  'touchpoint-gift-box': 'touchpoints/v19/touchpoint-gift-box-v19.jpg',
  'touchpoint-refill-pouch': 'touchpoints/v19/touchpoint-refill-pouch-v19.jpg',
  'touchpoint-tea-tin': 'touchpoints/v19/touchpoint-tea-tin-v19.jpg',
  'touchpoint-snack-carrier': 'touchpoints/v19/touchpoint-snack-carrier-v19.jpg',
  'touchpoint-apron-patch': 'touchpoints/v19/touchpoint-apron-patch-v19.jpg',
  'touchpoint-name-badge': 'touchpoints/v19/touchpoint-name-badge-v19.jpg',
  'touchpoint-customer-cards': 'touchpoints/v19/touchpoint-customer-cards-v19.jpg',
  'touchpoint-hotel-supply': 'touchpoints/v19/touchpoint-hotel-supply-v19.jpg',
  'touchpoint-delivery-crates': 'touchpoints/v19/touchpoint-delivery-crates-v19.jpg',
  'touchpoint-popup-flag': 'touchpoints/v19/touchpoint-popup-flag-v19.jpg',
  'touchpoint-sleeve-dispenser': 'touchpoints/v19/touchpoint-sleeve-dispenser-v19.jpg',
};

const touchpointAliases: Record<string, string> = {
  'side-sign': 'touchpoint-side-sign',
  'door-info': 'touchpoint-glass-door',
  'menu-board': 'touchpoint-menu-board',
  'order-card': 'touchpoint-order-card',
  receipt: 'touchpoint-receipt',
  'cup-sleeve': 'touchpoint-hot-cup-sleeve',
  packaging: 'touchpoint-bag',
  menu: 'touchpoint-receipt',
  social: 'touchpoint-avatar',
};

const chapterAssets: Record<string, string> = {
  'chapter-01-customers': 'scenes/chapters/chapter-01-customers-v19.jpg',
  'chapter-02-product-identity': 'scenes/chapters/chapter-02-product-identity-v19.jpg',
  'chapter-03-service': 'scenes/chapters/chapter-03-service-v19.jpg',
  'chapter-04-growth': 'scenes/chapters/chapter-04-growth-v19.jpg',
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
  'r06-shortvideo': decisionAssets['detail-r06-shortvideo']!,
  'r06-partner-host': decisionAssets['detail-r06-partner-host']!,
  'r07-greeting-script': decisionAssets['detail-r07-greeting-script']!,
  'r07-self-service': decisionAssets['detail-r07-self-service']!,
  'r09-stories': decisionAssets['detail-r09-stories']!,
  'r09-feedback-table': decisionAssets['detail-r09-feedback-table']!,
  'r10-wholesale': decisionAssets['detail-r10-wholesale']!,
  'r10-delivery': decisionAssets['detail-r10-delivery']!,
  'r11-platform': decisionAssets['detail-r11-platform']!,
  'r11-limited-drop': decisionAssets['detail-r11-limited-drop']!,
  'r12-seasonal-new': decisionAssets['detail-r12-seasonal-new']!,
  'r05-tea-character': decisionAssets['ip-object-tea-clip']!,
  'r05-neighborhood-seal': decisionAssets['ip-object-sleeve-storage']!,
  'r12-ip-merch': decisionAssets['detail-r12-ip-merch']!,
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
    'r09-observe': actionAssetOverrides['r09-observe']!,
    'r09-test': actionAssetOverrides['r09-test']!,
    'r09-quote': actionAssetOverrides['r09-quote']!,
    'r10-observe': actionAssetOverrides['r10-observe']!,
    'r10-test': actionAssetOverrides['r10-test']!,
    'r10-quote': actionAssetOverrides['r10-quote']!,
    'r11-audit-capacity': actionAssetOverrides['r11-audit-capacity']!,
    'r11-test-delivery': actionAssetOverrides['r11-test-delivery']!,
    'r11-negotiate-platform': actionAssetOverrides['r11-negotiate-platform']!,
    'r12-observe': actionAssetOverrides['r12-observe']!,
    'r12-test': actionAssetOverrides['r12-test']!,
    'r12-quote': actionAssetOverrides['r12-quote']!,
  },
  result: resultAssets,
  decision: decisionAssets,
  touchpoint: touchpointAssets,
  chapter: chapterAssets,
} as const;

type V11VisualAssetFamily = keyof typeof V11VisualAssetManifest;

export type V11VisualAssetRecord = {
  family: V11VisualAssetFamily;
  path: string;
  focalPoint: V11VisualFocalPoint;
};

const focalPointByFamily: Record<V11VisualAssetFamily, V11VisualFocalPoint> = {
  scene: { x: 50, y: 50 },
  action: { x: 50, y: 50 },
  result: { x: 50, y: 48 },
  decision: { x: 50, y: 50 },
  touchpoint: { x: 50, y: 50 },
  chapter: { x: 50, y: 50 },
};

// This metadata table is the formal, per-raster delivery manifest. It keeps
// crop intent beside every runtime path so components never have to guess a
// focal position from a generic `object-fit: cover` rule.
export const V11VisualAssetRecords: Record<string, V11VisualAssetRecord> = Object.fromEntries(
  Object.entries(V11VisualAssetManifest).flatMap(([family, assets]) => {
    const typedFamily = family as V11VisualAssetFamily;
    return Object.values(assets).map((path) => ({
      path,
      family: typedFamily,
      focalPoint: { ...focalPointByFamily[typedFamily] },
    }));
  }).map((record) => [record.path, record]),
);

export function sceneAsset(imageKey: string): string | undefined {
  return sceneAssets[imageKey];
}

export function actionAsset(actionId: string, _actionType: string): string | undefined {
  void _actionType;
  return actionAssetOverrides[actionId];
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
  return allTouchpointPlacements[touchpointId];
}

export function chapterAsset(chapterId: string): string | undefined {
  return chapterAssets[
    `chapter-${chapterId === 'c1' ? '01-customers' : chapterId === 'c2' ? '02-product-identity' : chapterId === 'c3' ? '03-service' : chapterId === 'c4' ? '04-growth' : chapterId}`
  ];
}

export function visualAssetPath(relativePath: string): string {
  return `/assets/v11/${relativePath}`;
}

export function visualAssetFocalPoint(relativePath: string): V11VisualFocalPoint | undefined {
  return V11VisualAssetRecords[relativePath]?.focalPoint;
}

export function visualAssetObjectPosition(relativePath: string): string {
  const focalPoint = visualAssetFocalPoint(relativePath);
  return focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : '50% 50%';
}
