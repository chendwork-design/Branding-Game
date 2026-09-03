import {
  validateV11Content,
  type V11Choice,
  type V11Effect,
  type V11Event,
  type V11Evidence,
  type V11Ending,
  type V11RiskPlan,
  type V11Round,
} from './v11.js';
import { v11SliceContent } from './v11-slice.js';

const effect = (
  key: V11Effect['key'],
  amount: number,
  timing: V11Effect['timing'],
  label: string,
  theoryId: string,
): V11Effect => ({ key, amount, timing, label, theoryId });

interface ChoiceSpec {
  key: string;
  label: string;
  summary: string;
  detail: string;
  cashCostYuan: number;
  actionPointCost: number;
  durationDays: number;
  workload: number;
  primaryBenefit: string;
  primaryRisk: string;
  evidenceRelations: string[];
  effects: V11Effect[];
  riskPlanIds?: string[];
  theoryIds: string[];
  visualRouteId?: string;
}

const roundTransferPrompts: Record<string, string> = {
  r01: '第一批顾客的到店习惯，哪一条证据真正改变了你的选择？',
  r02: '你承诺的那件事，忙起来时店员还能稳定做到吗？',
  r03: '主打产品的哪个步骤最可能拖慢高峰期出杯？',
  r04: '顾客支付的价格，具体换来了什么看得见的价值？',
  r05: '店名、LOGO 和 IP 分别负责让顾客记住什么？',
  r06: '这笔传播预算最终让哪一类顾客在什么地方看见了你？',
  r07: '订单一多，服务承诺最容易在哪个环节走样？',
  r08: '离开大幅效果图后，哪个触点最先暴露了设计问题？',
  r09: '顾客替你说出去的话，和店里实际体验对得上吗？',
  r10: '跨出老街后，哪一方要为包装、交付和客诉负责？',
  r11: '如果订单再增加一倍，团队会先在哪个环节忙不过来？',
  r12: '明年要保留、停止和先测试的分别是什么？',
};

function effectSceneCopy(effect: V11Effect | undefined, fallback: string): string {
  if (!effect) return fallback;
  const improving = effect.amount >= 0;
  const copy: Partial<Record<V11Effect['key'], string>> = {
    awareness: improving ? '更多路过的人注意到店门口和主打产品。' : '路过的人更难注意到这家店。',
    conversion: improving ? '看完菜单的顾客更容易决定下单。' : '顾客在菜单前更容易犹豫后离开。',
    trust: improving
      ? '顾客更愿意相信菜单上写的价格和承诺。'
      : '顾客开始怀疑店里说的话能不能做到。',
    loyalty: improving ? '买过的人多了一个再回来的理由。' : '熟客少了一个愿意回来的理由。',
    segmentFit: improving
      ? '第一批顾客更容易听懂这家店是为谁开的。'
      : '到店的人更难判断这家店是不是为自己准备的。',
    differentiation: improving
      ? '顾客更容易说出你和隔壁店哪里不同。'
      : '顾客更容易把你和同街门店混在一起。',
    promiseCredibility: improving
      ? '店里更有把说过的话稳定做到的把握。'
      : '店里说出去的话需要更多实际体验来证明。',
    productDelivery: improving
      ? '忙起来时，店员更容易把产品按时交到顾客手里。'
      : '高峰期的制作和交付更容易卡住。',
    orgCapacity: improving ? '人手和流程更能接住增加的订单。' : '增加的工作开始挤占店员和流程。',
    brandConsistency: improving
      ? '店招、菜单和店员的说法更像同一家店。'
      : '顾客在不同地方遇到的说法开始对不上。',
    visualRecognition: improving
      ? '顾客在街上和手机上更容易认出这家店。'
      : '顾客不容易从街景里认出这家店。',
    visualAdaptability: improving
      ? '同一套设计换到不同地方后仍然清楚好用。'
      : '设计换到杯身或小屏后开始失去作用。',
    culturalCredibility: improving
      ? '顾客能从茶材和做法里听到真实的地方来历。'
      : '地方故事缺少能让顾客相信的细节。',
    channelDependence: improving
      ? '订单更依赖单一渠道，渠道规则会更直接影响门店。'
      : '店里不再把太多订单押在同一个渠道上。',
    reputationDebt: improving
      ? '说出去却还没做到的话变多，下一次失误更容易被放大。'
      : '店里没做到的承诺在减少，顾客的不满没有继续累积。',
  };
  return copy[effect.key] ?? effect.label;
}

function choiceNarrative(
  roundId: string,
  spec: Pick<ChoiceSpec, 'label' | 'detail' | 'effects' | 'primaryBenefit' | 'primaryRisk'>,
): Pick<V11Choice, 'reportExplanation' | 'transferPrompt' | 'playerConsequence' | 'delayedRisk'> {
  const immediateEffect = spec.effects.find((item) => item.timing === 'immediate');
  const delayedEffect = spec.effects.find((item) => item.timing === 'delayed');
  const firstEffect = effectSceneCopy(immediateEffect, spec.primaryBenefit);
  const nextEffect = effectSceneCopy(delayedEffect, `接下来要盯住：${spec.primaryRisk}。`);
  return {
    reportExplanation: `你决定${spec.label}。${firstEffect}${nextEffect}`,
    transferPrompt:
      roundTransferPrompts[roundId] ??
      '这项选择先改变了谁的体验，又给店里留下了什么要继续处理的问题？',
    playerConsequence: firstEffect,
    delayedRisk: nextEffect,
  };
}

function choice(roundId: string, spec: ChoiceSpec): V11Choice {
  const choiceId = `${roundId}-${spec.key}`;
  return {
    choiceId,
    label: spec.label,
    summary: spec.summary,
    detail: spec.detail,
    cashCostYuan: spec.cashCostYuan,
    // Keep the authored strategic cost. The four-point strategic pool is
    // intentionally large enough to make the 2/3/4-point trade-off real.
    actionPointCost: spec.actionPointCost,
    durationDays: spec.durationDays,
    workload: spec.workload,
    primaryBenefit:
      spec.effects.find((effect) => effect.timing === 'immediate')?.label ?? spec.primaryBenefit,
    primaryRisk: spec.primaryRisk,
    evidenceRelations: spec.evidenceRelations,
    effects: spec.effects,
    riskPlanIds: spec.riskPlanIds ?? [],
    conditions: [],
    theoryIds: spec.theoryIds,
    ...(spec.visualRouteId ? { visualRouteId: spec.visualRouteId } : {}),
    ...choiceNarrative(roundId, spec),
    resultArtKey: `result-${choiceId}`,
    motionCue: `decision-${spec.key}`,
  };
}

const extraChoices: Record<string, V11Choice[]> = {
  r01: [
    choice('r01', {
      key: 'resident-loyalty',
      label: '给附近居民做一套熟客方案',
      summary: '用固定时段和小额回馈换日常关系。',
      detail: '把早晚高峰、价格和回馈写成可执行的小规则，让熟客知道为什么要回来。',
      cashCostYuan: 22000,
      actionPointCost: 3,
      durationDays: 6,
      workload: 3,
      primaryBenefit: '复购关系更具体',
      primaryRisk: '对游客的第一眼吸引较弱',
      evidenceRelations: ['ev-r01-footfall'],
      effects: [
        effect('trust', 7, 'immediate', '熟客觉得这家店记得住自己', 't-segment'),
        effect('loyalty', 4, 'delayed', '稳定关系开始带来复购', 't-segment'),
      ],
      riskPlanIds: ['risk-r01-repeat'],
      theoryIds: ['t-segment'],
    }),
    choice('r01', {
      key: 'office-morning',
      label: '先服务通勤和办公人群',
      summary: '把“快、稳、带得走”做成第一印象。',
      detail: '围绕工作日早晨和午后设计取杯节奏，先解决每天经过的人如何方便地买到。',
      cashCostYuan: 16000,
      actionPointCost: 2,
      durationDays: 4,
      workload: 2,
      primaryBenefit: '购买转化更快',
      primaryRisk: '品牌关系容易停在功能层',
      evidenceRelations: ['ev-r01-footfall'],
      effects: [
        effect('conversion', 7, 'immediate', '工作日购买更顺手', 't-segment'),
        effect('brandConsistency', -3, 'delayed', '只讲效率会让品牌语气变薄', 't-segment'),
      ],
      theoryIds: ['t-segment'],
    }),
  ],
  r03: [
    choice('r03', {
      key: 'seasonal-ritual',
      label: '做一款季节限定的轻仪式茶',
      summary: '保留地方感，但把工艺控制在可交付范围内。',
      detail: '用季节材料和一段简短服务动作增加记忆点，不把复杂步骤全部压给高峰期。',
      cashCostYuan: 47000,
      actionPointCost: 3,
      durationDays: 11,
      workload: 4,
      primaryBenefit: '文化记忆点与交付较平衡',
      primaryRisk: '季节变化会带来备货压力',
      evidenceRelations: ['ev-r03-price', 'ev-r03-supply'],
      effects: [
        effect('culturalCredibility', 7, 'immediate', '地方材料有了具体体验', 't-product'),
        effect('productDelivery', -4, 'delayed', '季节备货会增加一点交付压力', 't-product'),
      ],
      riskPlanIds: ['risk-r03-supply'],
      theoryIds: ['t-product', 't-insight'],
    }),
    choice('r03', {
      key: 'modular-menu',
      label: '做可自由组合的模块化菜单',
      summary: '让顾客参与搭配，同时控制后厨复杂度。',
      detail: '把口味、茶底和加料拆成有限模块，顾客感觉有选择，团队仍能按规则出杯。',
      cashCostYuan: 36000,
      actionPointCost: 3,
      durationDays: 8,
      workload: 3,
      primaryBenefit: '产品适配面更宽',
      primaryRisk: '选项太多会稀释主打记忆',
      evidenceRelations: ['ev-r03-queue'],
      effects: [
        effect('conversion', 6, 'immediate', '顾客更容易找到适合自己的组合', 't-product'),
        effect('differentiation', -3, 'delayed', '菜单变宽后主打产品不够突出', 't-product'),
      ],
      theoryIds: ['t-product'],
    }),
  ],
  r08: [
    choice('r08', {
      key: 'wordmark',
      label: '选清楚易读的文字标志系统',
      summary: '先让店名在街景和手机上都认得出来。',
      detail: '以字体、留白和比例为核心，减少装饰，让 LOGO 能稳定出现在招牌、杯身和头像。',
      cashCostYuan: 43000,
      actionPointCost: 3,
      durationDays: 10,
      workload: 3,
      primaryBenefit: '识别效率较高',
      primaryRisk: '地域故事需要靠其他触点补足',
      evidenceRelations: ['ev-r08-street', 'ev-r08-touchpoint'],
      effects: [
        effect('visualRecognition', 8, 'immediate', '店名更容易被读出来', 't-identity'),
        effect('brandConsistency', 6, 'delayed', '基础字形开始统一各个触点', 't-touchpoint'),
      ],
      riskPlanIds: ['risk-r08-production'],
      theoryIds: ['t-identity', 't-touchpoint'],
      visualRouteId: 'v-line',
    }),
    choice('r08', {
      key: 'ip-stamp',
      label: '让 IP 印章成为包装主角',
      summary: '用一个可重复使用的角色动作制造记忆点。',
      detail:
        '把角色表情、印章和杯套互动起来，让 IP 不只站在海报里，而是参与顾客带走和分享的过程。',
      cashCostYuan: 52000,
      actionPointCost: 4,
      durationDays: 13,
      workload: 4,
      primaryBenefit: '包装传播更有戏',
      primaryRisk: 'IP规则不清会增加制作负担',
      evidenceRelations: ['ev-r08-touchpoint'],
      effects: [
        effect('visualRecognition', 11, 'immediate', '包装上的角色更容易被记住', 't-identity'),
        effect('orgCapacity', -5, 'delayed', '多种 IP 物料让团队需要更多规范', 't-touchpoint'),
      ],
      riskPlanIds: ['risk-r08-production'],
      theoryIds: ['t-identity', 't-touchpoint'],
      visualRouteId: 'v-hand',
    }),
  ],
  r11: [
    choice('r11', {
      key: 'steady-circle',
      label: '把增长先投回熟客社区',
      summary: '不急着冲更大的声量，先让关系变厚。',
      detail: '用社区活动、熟客权益和稳定的产品节奏换取更慢但更可持续的增长。',
      cashCostYuan: 34000,
      actionPointCost: 3,
      durationDays: 9,
      workload: 3,
      primaryBenefit: '信任和复购更稳',
      primaryRisk: '规模扩张速度较慢',
      evidenceRelations: ['ev-r11-capacity'],
      effects: [
        effect('trust', 8, 'immediate', '老客感到品牌愿意长期相处', 't-growth'),
        effect('loyalty', 10, 'delayed', '复购关系进一步沉淀', 't-growth'),
      ],
      riskPlanIds: ['risk-r11-delivery'],
      theoryIds: ['t-growth'],
    }),
    choice('r11', {
      key: 'limited-drop',
      label: '做一次限量联名快闪',
      summary: '借外部话题测试新客，但控制数量和周期。',
      detail: '选择一个边界清楚的联名主题，用限量方式试探新客兴趣，不把全部产能押上去。',
      cashCostYuan: 58000,
      actionPointCost: 4,
      durationDays: 12,
      workload: 5,
      primaryBenefit: '新客和传播机会增加',
      primaryRisk: '联名复杂度可能挤压日常经营',
      evidenceRelations: ['ev-r11-capacity'],
      effects: [
        effect('awareness', 12, 'immediate', '一次联名让更多人知道你', 't-growth'),
        effect('orgCapacity', -7, 'delayed', '快闪协作让团队短期超载', 't-growth'),
      ],
      riskPlanIds: ['risk-r11-delivery'],
      theoryIds: ['t-growth'],
    }),
  ],
};

function expandSliceRound(round: V11Round): V11Round {
  const playerCopy = sliceRoundPlayerCopy[round.roundId];
  const evidenceIds = round.evidence.map((item) => item.evidenceId);
  const stageActions = round.stageActions.map((item, index) => ({
    ...item,
    label: playerCopy?.actions[index]?.label ?? item.label,
    description: playerCopy?.actions[index]?.description ?? item.description,
    questionId: `question-${round.roundId}-${Math.min(index + 1, 2)}`,
    outputType: index === 2 ? ('quote' as const) : ('evidence' as const),
    revealsEvidenceIds: item.revealsEvidenceIds?.length
      ? item.revealsEvidenceIds
      : evidenceIds.filter(
          (_, evidenceIndex) => evidenceIndex % round.stageActions.length === index,
        ),
    helpsCompareChoiceIds: round.choices
      .filter((choice) =>
        (item.revealsEvidenceIds?.length
          ? item.revealsEvidenceIds
          : evidenceIds.filter(
              (_, evidenceIndex) => evidenceIndex % round.stageActions.length === index,
            )
        ).some((evidenceId) => choice.evidenceRelations.includes(evidenceId)),
      )
      .map((choice) => choice.choiceId),
    remainingUnknown:
      (item.revealsEvidenceIds?.[0]
        ? round.evidence.find((evidence) => evidence.evidenceId === item.revealsEvidenceIds?.[0])
            ?.unknown
        : round.evidence[index]?.unknown) ??
      '具体投入在高峰期会不会继续波动，还要在后续经营里观察。',
  }));
  return {
    ...round,
    freeActionPointBudget: 4,
    strategicActionPointBudget: 4,
    skipPolicy: ['r06', 'r07', 'r09', 'r10', 'r11'].includes(round.roundId)
      ? 'allowed'
      : 'forbidden',
    stageActions,
    decisionQuestions: [
      {
        questionId: `question-${round.roundId}-1`,
        prompt: playerCopy?.questions[0].prompt ?? round.briefing.dilemma,
        context: playerCopy?.questions[0].context ?? '先看顾客、成本和现场限制，不要急着选答案。',
        actionIds: stageActions.slice(0, 2).map((item) => item.actionId),
      },
      {
        questionId: `question-${round.roundId}-2`,
        prompt: playerCopy?.questions[1].prompt ?? '这条路的投入和限制到底是什么？',
        context: playerCopy?.questions[1].context ?? '把预算、时间和门店工作量放在同一张表里比较。',
        actionIds: stageActions.slice(2).map((item) => item.actionId),
      },
    ],
    knownFacts: [{ factId: `known-${round.roundId}-1`, text: round.briefing.situation }],
    choices: [...round.choices, ...(extraChoices[round.roundId] ?? [])].map((item) => {
      const immediate =
        item.effects.find((effect) => effect.timing === 'immediate')?.label ?? item.primaryBenefit;
      return {
        ...item,
        primaryBenefit: immediate,
        ...choiceNarrative(round.roundId, item),
      };
    }),
    resultPresentation: playerCopy
      ? {
          ...round.resultPresentation,
          characterReactions: [
            {
              characterId: `character-${round.roundId}`,
              text: playerCopy.characterReaction,
              conditions: [],
            },
          ],
        }
      : round.resultPresentation,
  };
}

interface EvidenceSpec {
  key: string;
  title: string;
  fact: string;
  implication: string;
  unknown: string;
  angle: 'customer' | 'cost' | 'competition' | 'delivery' | 'culture' | 'visual';
  cashCostYuan?: number;
  actionPointCost?: number;
  relations: Array<{
    choiceKey: string;
    relation: 'supports' | 'warns' | 'contradicts' | 'context';
    strength: number;
    explanation: string;
  }>;
  theoryIds: string[];
}

interface RiskSpec {
  key: string;
  label: string;
  description: string;
  targetRisk: string;
  cashCostYuan: number;
  actionPointCost: number;
  mitigationRatio: number;
  theoryIds: string[];
}

interface RoundSpec {
  roundId: string;
  chapterId: string;
  title: string;
  timelineLabel: string;
  situation: string;
  whyNow: string;
  dilemma: string;
  mustComplete: string;
  theoryIds: string[];
  choices: ChoiceSpec[];
  evidence: EvidenceSpec[];
  riskPlans?: RiskSpec[];
  eventIds: string[];
  isKeyRound?: boolean;
  businessPhase?: 'pre_open' | 'operating';
  targetElapsedDay?: number;
  fixedCostPerDayYuan?: number;
  overdueFixedCostPerDayYuan?: number;
  baseRevenueYuan?: number;
}

type RoundPlayerCopy = {
  questions: [{ prompt: string; context: string }, { prompt: string; context: string }];
  actions: [
    { label: string; description: string },
    { label: string; description: string },
    { label: string; description: string },
  ];
  characterReaction: string;
};

const sliceRoundPlayerCopy: Record<string, RoundPlayerCopy> = {
  r01: {
    questions: [
      {
        prompt: '第一批谁会真的在这里买？',
        context: '比较居民、游客和通勤人群出现的时段、购买理由和服务难度。',
      },
      {
        prompt: '两类顾客能不能被同一间店接住？',
        context: '把人手、产品步骤和开店现金放在一起看。',
      },
    ],
    actions: [
      {
        label: '数一数早晚谁路过',
        description: '在早、午、晚各站二十分钟，记下居民、游客和通勤客停下来做什么。',
      },
      {
        label: '问十位附近住户',
        description: '问清他们平时在哪里买茶、赶不赶时间、愿不愿意下次再来。',
      },
      {
        label: '把开店第一笔钱逐项算出来',
        description: '和房东、供应商核对押金、原料和基础设备，别只算招牌。',
      },
    ],
    characterReaction: '附近居民：我不是每次都想拍照，顺手、好喝、下次还一样，才会常来。',
  },
  r03: {
    questions: [
      {
        prompt: '哪一杯能在高峰期稳定交到顾客手上？',
        context: '看口味、制作步骤和等待时间，别只看拍照效果。',
      },
      { prompt: '复杂做法到底会多花什么？', context: '把设备、包装和供应是否稳定一起问清楚。' },
    ],
    actions: [
      {
        label: '做十杯高峰期小样',
        description: '连续做十杯，记录哪一步最慢、顾客等多久、店员要解释几次。',
      },
      {
        label: '把复杂包装摊到每一杯',
        description: '问清包装和设备要花多少钱，别让一张好看的图把价格推高。',
      },
      {
        label: '和供应商核对每周能供多少',
        description: '直接问批次、交期和替代原料，看看主打产品会不会断。',
      },
    ],
    characterReaction: '店员小周：顾客愿意等一会儿，但高峰期每杯都多两步，后面的人可不会一直等。',
  },
  r08: {
    questions: [
      {
        prompt: '哪套设计放小了、被挡住后还认得出来？',
        context: '把店招、杯身、包装和头像放到真实大小，不只看大图。',
      },
      {
        prompt: '这套视觉会不会给门店增加额外负担？',
        context: '同时看制作、补货和店员每天要维护的细节。',
      },
    ],
    actions: [
      {
        label: '站到街对面认店招',
        description: '让路人看三秒，记下他们先读到店名、图形还是完全没看懂。',
      },
      {
        label: '把杯套放进顾客手里',
        description: '拿着杯子、缩成头像、改成单色各试一次，看哪些线索先消失。',
      },
      {
        label: '问清每种物料怎么做',
        description: '和制作方核对颜色、印刷和补货，避免设计进店后每天都难执行。',
      },
    ],
    characterReaction: '设计师阿岚：海报上好看只是起点，杯子被手挡住一半还能认出来才算真的能用。',
  },
  r11: {
    questions: [
      {
        prompt: '订单突然变多，最先堵在哪？',
        context: '分别看排队、出杯、打包和客诉，不把“火了”当成一个数字。',
      },
      {
        prompt: '平台带来的订单，店里能接住多少？',
        context: '把每天上限、平台抽成和老客体验一起比较。',
      },
    ],
    actions: [
      {
        label: '记一小时高峰期订单',
        description: '数清排队时间、错单次数和店员最常被打断的地方。',
      },
      {
        label: '用小批量平台单试跑',
        description: '只接一小批外卖，记录出杯、打包、配送和客诉谁先卡住。',
      },
      {
        label: '和供应商确认峰值上限',
        description: '直接问原料、包材和临时补货最多能撑到多少单。',
      },
    ],
    characterReaction: '老客：店火了当然好，可我下班路过还要等半小时，就不敢天天来了。',
  },
};

const extendedRoundPlayerCopy: Record<string, RoundPlayerCopy> = {
  r02: {
    questions: [
      {
        prompt: '第一批顾客会在什么时刻想到你？',
        context: '先分清居民、游客和通勤人群为什么来、多久来一次。',
      },
      { prompt: '一句承诺，店里真的做得到吗？', context: '把产品数量、价格和人手放在一起算。' },
    ],
    actions: [
      {
        label: '听三类顾客说说需求',
        description: '在街口分别问居民、游客和通勤人群：他们来买什么、赶不赶时间。',
      },
      {
        label: '把承诺写进一次点单',
        description: '用一张小菜单测试“快、稳、地方感”哪句话最容易被顾客听懂。',
      },
      {
        label: '算清双线服务要多少人',
        description: '和店员一起走一遍两类产品说明，看看高峰期会不会忙乱。',
      },
    ],
    characterReaction: '店员小周：顾客能听懂一句话是好事，可别让我们每单都要解释半天。',
  },
  r04: {
    questions: [
      { prompt: '顾客愿意为什么多付一点？', context: '比较金额、分量、等待时间和带走后的体验。' },
      {
        prompt: '包装和服务会不会把利润吃掉？',
        context: '先算单件成本，也走一遍清洁、归还或礼盒交付。',
      },
    ],
    actions: [
      {
        label: '记录顾客怎么比较价格',
        description: '观察顾客在菜单前停多久、会问什么、最后为什么放弃或下单。',
      },
      {
        label: '试一次礼盒带走体验',
        description: '让顾客拎着礼盒走一段老街，看看拿着、打开和送人顺不顺手。',
      },
      {
        label: '核算一杯茶的完整成本',
        description: '把茶、包材、制作时间和售后一起写进账本，不只看原料价。',
      },
    ],
    characterReaction: '顾客阿敏：贵一点没关系，别让我拿回家才发现包装不好用。',
  },
  r05: {
    questions: [
      {
        prompt: '顾客第一眼要记住什么？',
        context: '先决定店名、图形或角色各自负责什么，不让它们抢着说话。',
      },
      {
        prompt: '这套识别能不能做进每个触点？',
        context: '把店招、杯身、头像和菜单放在同一张检查表上。',
      },
    ],
    actions: [
      {
        label: '看清街上谁先被读到',
        description: '站到街对面看十秒，记录店名、图形和招牌里谁最先被看清。',
      },
      {
        label: '把识别缩到手机头像',
        description: '把方案缩小到头像大小，看看文字、图形或角色还认不认得出。',
      },
      {
        label: '问印刷和维护的边界',
        description: '和制作方确认颜色、尺寸和物料数量，避免设计好看却难以落地。',
      },
    ],
    characterReaction: '设计师阿岚：大图好看不算本事，缩到头像还能认出来才过关。',
  },
  r06: {
    questions: [
      {
        prompt: '开业预算先让谁看见？',
        context: '把门口、短视频、民宿推荐和熟客预订放回真实到店路径。',
      },
      {
        prompt: '哪种传播承诺店里接得住？',
        context: '估算每多一批顾客，谁要负责接待、出杯和解释。',
      },
    ],
    actions: [
      {
        label: '在门口做十秒测试',
        description: '看路过的人十秒内能不能知道你卖什么、值不值得进店。',
      },
      {
        label: '用一条短视频试到店',
        description: '发布一条只说一个卖点的内容，记录看完的人会不会真的来。',
      },
      {
        label: '问清合作方怎么推荐',
        description: '和民宿或街区伙伴约定推荐话术和交付边界，别把承诺说大。',
      },
    ],
    characterReaction: '合作方小许：我可以推荐客人，但他们来了以后，体验得和我说的一样。',
  },
  r07: {
    questions: [
      {
        prompt: '高峰期，哪一步最容易让顾客不耐烦？',
        context: '从点单、等待到取杯，找一个会拖慢所有人的环节。',
      },
      {
        prompt: '店员能用同一种方式把话说清楚吗？',
        context: '不是背口号，而是让承诺在忙的时候也不走样。',
      },
    ],
    actions: [
      {
        label: '跟一单高峰期点单',
        description: '从顾客排队到拿到杯子，记下每次停顿和需要重复解释的地方。',
      },
      {
        label: '试一张更短的点单提示',
        description: '用新菜单和取杯提示试半小时，看看错单和追问有没有变少。',
      },
      {
        label: '排一次高峰期人手',
        description: '把制作、收银和取杯分别交给谁写清楚，先看最缺哪一位。',
      },
    ],
    characterReaction: '店员小周：订单一多，大家只想快点把茶交出去，话得提前说清。',
  },
  r09: {
    questions: [
      { prompt: '顾客会替你说什么？', context: '先看他们真实发出的内容，再判断哪些说法能留下来。' },
      {
        prompt: '热闹来了，谁来守住产品承诺？',
        context: '把征集、审核和回应差评需要的人手算进去。',
      },
    ],
    actions: [
      {
        label: '翻看顾客真实分享',
        description: '收集十条真实评价，圈出顾客记住的是产品、空间还是角色。',
      },
      {
        label: '试一次顾客故事征集',
        description: '请熟客写下与老街茶的一次经历，看看他们会怎样理解品牌。',
      },
      {
        label: '排一张回应与审核表',
        description: '写清楚谁回应差评、谁确认投稿能不能用，避免忙起来没人负责。',
      },
    ],
    characterReaction: '熟客阿敏：我愿意帮你分享，但我说出去的话，得和店里体验对得上。',
  },
  r10: {
    questions: [
      {
        prompt: '跨出老街后，谁负责把体验交付好？',
        context: '把第二窗口、酒店、联名和外卖逐项拆到生产、包装和客诉。',
      },
      {
        prompt: '增长带来的钱，够不够覆盖新的麻烦？',
        context: '别只看订单，先看每周交货、返工和合作沟通需要什么。',
      },
    ],
    actions: [
      {
        label: '走一遍新渠道交付',
        description: '模拟一份订单从制作、包装到交到合作方手里，找出最容易断的地方。',
      },
      {
        label: '用小批量试一次合作',
        description: '只做一小批，记录顾客、合作方和店员分别卡在哪一步。',
      },
      {
        label: '算清扩张后的固定支出',
        description: '把新增人手、包装、沟通和返工都算进每周账本。',
      },
    ],
    characterReaction: '合作方小许：顾客不会管是哪一方出错，他们只会觉得这家店没做到。',
  },
  r12: {
    questions: [
      {
        prompt: '这一年，什么值得留下？',
        context: '回看熟客、产品、库存和店员压力，不把一时热闹当成资产。',
      },
      {
        prompt: '下一年先修哪里、再长哪里？',
        context: '把保留、停止和新尝试写成一张能执行的任务单。',
      },
    ],
    actions: [
      {
        label: '回看熟客为什么回来',
        description: '从订单和评价里找出顾客反复提到的产品、服务和视觉记忆点。',
      },
      {
        label: '做一次库存和流程复盘',
        description: '和店员把一年里最常出错的物料和步骤排出来，别让问题被忘掉。',
      },
      {
        label: '写下一年第一张任务单',
        description: '列出一件要保留、一件要停下、一件要先测试的事，再估算人手和预算。',
      },
    ],
    characterReaction: '店主：明年不一定要更热闹，先把大家已经信任的东西做稳。',
  },
};

function roundFromSpec(spec: RoundSpec): V11Round {
  const playerCopy = extendedRoundPlayerCopy[spec.roundId];
  const choices = spec.choices.map((item) => choice(spec.roundId, item));
  const choiceIds = new Set(choices.map((item) => item.choiceId));
  const evidence: V11Evidence[] = spec.evidence.map((item) => ({
    evidenceId: `ev-${spec.roundId}-${item.key}`,
    title: item.title,
    fact: item.fact,
    implication: item.implication,
    unknown: item.unknown,
    cashCostYuan: item.cashCostYuan ?? 0,
    actionPointCost: item.actionPointCost ?? 1,
    angle: item.angle,
    relations: item.relations.map((relation) => {
      const targetId = `${spec.roundId}-${relation.choiceKey}`;
      if (!choiceIds.has(targetId)) throw new Error(`内容构造错误：${targetId}`);
      return {
        targetType: 'choice' as const,
        targetId,
        relation: relation.relation,
        strength: relation.strength,
        explanation: relation.explanation,
      };
    }),
    theoryIds: item.theoryIds,
  }));
  const riskPlans: V11RiskPlan[] = (spec.riskPlans ?? []).map((item) => ({
    riskPlanId: `${spec.roundId}-${item.key}`,
    label: item.label,
    description: item.description,
    targetRisk: item.targetRisk,
    cashCostYuan: item.cashCostYuan,
    actionPointCost: item.actionPointCost,
    mitigationRatio: item.mitigationRatio,
    theoryIds: item.theoryIds,
  }));
  if (!playerCopy) throw new Error(`内容构造错误：${spec.roundId} 缺少玩家文案`);
  const stageActions = [
    {
      actionId: `${spec.roundId}-observe`,
      actionType: 'research' as const,
      label: playerCopy.actions[0].label,
      description: playerCopy.actions[0].description,
      cashCostYuan: 0,
      actionPointCost: 1,
      durationDays: 1,
      workload: 1,
      theoryIds: spec.theoryIds,
      questionId: `question-${spec.roundId}-1`,
      outputType: 'evidence' as const,
      revealsEvidenceIds: evidence
        .filter((_, index) => index % 3 === 0)
        .map((item) => item.evidenceId),
      helpsCompareChoiceIds: evidence
        .filter((_, index) => index % 3 === 0)
        .flatMap((item) => item.relations.map((relation) => relation.targetId)),
      remainingUnknown: evidence[0]?.unknown,
    },
    {
      actionId: `${spec.roundId}-test`,
      actionType: 'test' as const,
      label: playerCopy.actions[1].label,
      description: playerCopy.actions[1].description,
      cashCostYuan: 1800,
      actionPointCost: 2,
      durationDays: 2,
      workload: 2,
      theoryIds: spec.theoryIds,
      questionId: `question-${spec.roundId}-1`,
      outputType: 'evidence' as const,
      revealsEvidenceIds: evidence
        .filter((_, index) => index % 3 === 1)
        .map((item) => item.evidenceId),
      helpsCompareChoiceIds: evidence
        .filter((_, index) => index % 3 === 1)
        .flatMap((item) => item.relations.map((relation) => relation.targetId)),
      remainingUnknown: evidence[1]?.unknown,
    },
    {
      actionId: `${spec.roundId}-quote`,
      actionType: 'quote' as const,
      label: playerCopy.actions[2].label,
      description: playerCopy.actions[2].description,
      cashCostYuan: 800,
      actionPointCost: 1,
      durationDays: 1,
      workload: 1,
      theoryIds: spec.theoryIds,
      questionId: `question-${spec.roundId}-2`,
      outputType: 'quote' as const,
      revealsEvidenceIds: evidence
        .filter((_, index) => index % 3 === 2)
        .map((item) => item.evidenceId),
      helpsCompareChoiceIds: evidence
        .filter((_, index) => index % 3 === 2)
        .flatMap((item) => item.relations.map((relation) => relation.targetId)),
      remainingUnknown: evidence[2]?.unknown,
    },
  ];
  return {
    roundId: spec.roundId,
    chapterId: spec.chapterId,
    title: spec.title,
    timelineLabel: spec.timelineLabel,
    isKeyRound: spec.isKeyRound ?? false,
    businessPhase: spec.businessPhase ?? 'pre_open',
    targetElapsedDay: spec.targetElapsedDay ?? 9999,
    fixedCostPerDayYuan: spec.fixedCostPerDayYuan ?? 0,
    overdueFixedCostPerDayYuan: spec.overdueFixedCostPerDayYuan ?? 0,
    baseRevenueYuan: spec.baseRevenueYuan ?? 0,
    briefing: {
      situation: spec.situation,
      whyNow: spec.whyNow,
      dilemma: spec.dilemma,
      mustComplete: spec.mustComplete,
      imageKey: `briefing-${spec.roundId}`,
    },
    actionPointBudget: 8,
    freeActionPointBudget: 4,
    strategicActionPointBudget: 4,
    skipPolicy: ['r06', 'r07', 'r09', 'r10', 'r11'].includes(spec.roundId)
      ? 'allowed'
      : 'forbidden',
    skipDurationDays: 3,
    stageActions,
    decisionQuestions: [
      {
        questionId: `question-${spec.roundId}-1`,
        prompt: playerCopy.questions[0].prompt,
        context: playerCopy.questions[0].context,
        actionIds: stageActions.slice(0, 2).map((item) => item.actionId),
      },
      {
        questionId: `question-${spec.roundId}-2`,
        prompt: playerCopy.questions[1].prompt,
        context: playerCopy.questions[1].context,
        actionIds: stageActions.slice(2).map((item) => item.actionId),
      },
    ],
    knownFacts: [{ factId: `known-${spec.roundId}-1`, text: spec.situation }],
    evidence,
    choices,
    riskPlans,
    visualTests: [],
    visualRequired: false,
    eventIds: spec.eventIds,
    theoryIds: spec.theoryIds,
    resultPresentation: {
      resultArtKey: `result-${spec.roundId}`,
      motionCue: `round-${spec.roundId}`,
      characterReactions: [
        {
          characterId: `character-${spec.roundId}`,
          text: playerCopy.characterReaction,
          conditions: [],
        },
      ],
    },
  };
}

const ev = (roundId: string, key: string): string => `ev-${roundId}-${key}`;

const extendedRoundSpecs: RoundSpec[] = [
  {
    roundId: 'r02',
    chapterId: 'c1',
    title: '一句话要先对谁说',
    timelineLabel: '第1月下旬',
    situation:
      '午后三点，附近上班的人想快点带走一杯茶；游客却在门口问“这里有什么只属于老街的东西？”。两拨人都在进店，但要的不是同一句话。',
    whyNow: '如果今天什么都想答应，菜单、价格和店员的话会互相打架。',
    dilemma: '先把附近人的日常需求做稳，还是先为游客准备一段能带走的地方体验？',
    mustComplete: '决定这家店先为谁解决什么具体问题。',
    theoryIds: ['t-segment', 't-insight'],
    eventIds: ['event-r02-anchor', 'event-r02-voice', 'event-r02-rent'],
    choices: [
      {
        key: 'anchor',
        label: '先守住附近人的午后十分钟',
        summary: '把“顺手买到一杯好茶”做成最先被记住的理由。',
        detail:
          '围绕工作日下午的取杯速度、口味和价格安排菜单；游客可以进店，但先不让每一单都承担讲故事的任务。',
        cashCostYuan: 18000,
        actionPointCost: 2,
        durationDays: 5,
        workload: 2,
        primaryBenefit: '附近顾客更容易理解这家店的用途',
        primaryRisk: '游客第一次路过时，未必立刻知道这家店和自己有关',
        evidenceRelations: [ev('r02', 'audience')],
        effects: [
          effect('segmentFit', 9, 'immediate', '附近顾客知道午后想喝茶时可以来这里', 't-segment'),
          effect(
            'awareness',
            -3,
            'delayed',
            '游客第一次路过时不容易看出这家店的特别之处',
            't-segment',
          ),
        ],
        theoryIds: ['t-segment'],
      },
      {
        key: 'dual-track',
        label: '给居民和游客各留一个入口',
        summary: '日常杯装和地方体验分开说，别让顾客猜。',
        detail:
          '保留一套面向居民的日常产品，再为游客安排一项地方体验；两条线共用基础产品，但菜单和解释各自清楚。',
        cashCostYuan: 26000,
        actionPointCost: 3,
        durationDays: 8,
        workload: 4,
        primaryBenefit: '两类顾客都能找到进店理由',
        primaryRisk: '两名店员可能同时被两套菜单和说明拖住',
        evidenceRelations: [ev('r02', 'audience'), ev('r02', 'capacity')],
        effects: [
          effect(
            'segmentFit',
            5,
            'immediate',
            '居民和游客各自看得懂该怎么买、该期待什么',
            't-segment',
          ),
          effect('orgCapacity', -5, 'delayed', '两套菜单和说明让高峰期更容易顾不过来', 't-growth'),
        ],
        riskPlanIds: ['r02-risk-scope'],
        theoryIds: ['t-segment', 't-growth'],
      },
      {
        key: 'culture-first',
        label: '让每杯茶先讲清来处',
        summary: '用真实茶材和做法回答游客的第一个问题。',
        detail:
          '从茶材、产地和制作关系讲起，把能在杯里尝到、在店里看见的细节说清楚，而不是只挂一段山水故事。',
        cashCostYuan: 21000,
        actionPointCost: 2,
        durationDays: 6,
        workload: 3,
        primaryBenefit: '顾客能听到并验证地方来历',
        primaryRisk: '如果杯里的体验跟不上故事，顾客会觉得店里只会说',
        evidenceRelations: [ev('r02', 'culture')],
        effects: [
          effect(
            'culturalCredibility',
            9,
            'immediate',
            '顾客能说出茶叶从哪里来、为什么这样做',
            't-insight',
          ),
          effect(
            'promiseCredibility',
            -3,
            'delayed',
            '杯里的体验跟不上故事时，顾客会怀疑店里只是会说',
            't-product',
          ),
        ],
        theoryIds: ['t-insight', 't-product'],
      },
      {
        key: 'budget-first',
        label: '把每个价位说得明明白白',
        summary: '让顾客一眼看懂分量、价格和差别。',
        detail:
          '先做一张价格与分量说明，让顾客知道每一档多花的钱换来了什么，也让团队知道不能轻易许下超出成本的承诺。',
        cashCostYuan: 14000,
        actionPointCost: 2,
        durationDays: 4,
        workload: 2,
        primaryBenefit: '顾客少问一遍“为什么这个价”',
        primaryRisk: '路过的人暂时还记不住这家店的特别之处',
        evidenceRelations: [ev('r02', 'price')],
        effects: [
          effect(
            'trust',
            7,
            'immediate',
            '菜单把价格、分量和原因写清，顾客少问一遍“为什么这么贵”',
            't-insight',
          ),
          effect(
            'differentiation',
            -2,
            'delayed',
            '只讲价格时，路过的人还记不住这家店的特别之处',
            't-segment',
          ),
        ],
        theoryIds: ['t-insight', 't-segment'],
      },
      {
        key: 'anti-trend',
        label: '写一句只属于这家店的招呼',
        summary: '不用热梗，也让顾客愿意把这句话转给朋友。',
        detail:
          '把老街口语、茶饮动作和服务承诺组合成一句顺口的话；可以轻松，但每个店员都要知道这句话在现实里怎么做到。',
        cashCostYuan: 17000,
        actionPointCost: 2,
        durationDays: 5,
        workload: 2,
        primaryBenefit: '顾客能记住一句只属于这家店的招呼',
        primaryRisk: '没有热点帮忙时，新顾客认识店铺会慢一点',
        evidenceRelations: [ev('r02', 'voice')],
        effects: [
          effect(
            'differentiation',
            7,
            'immediate',
            '顾客能记住一句只属于这家店的招呼',
            't-segment',
          ),
          effect('awareness', -2, 'delayed', '没有热点帮忙时，新顾客认识店铺会慢一点', 't-segment'),
        ],
        theoryIds: ['t-segment'],
      },
    ],
    evidence: [
      {
        key: 'audience',
        title: '午后购买访谈',
        fact: '居民更在意方便和稳定，游客更在意地方感与带走后的谈资。',
        implication: '同一品牌可以有不同入口，但优先级必须先排出来。',
        unknown: '还不知道两类人是否能共享同一套产品基础。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'anchor',
            relation: 'supports',
            strength: 75,
            explanation: '日常场景访谈支持先把服务对象说窄。',
          },
          {
            choiceKey: 'dual-track',
            relation: 'context',
            strength: 60,
            explanation: '两类需求确实存在，但需要额外组织能力。',
          },
        ],
        theoryIds: ['t-segment', 't-insight'],
      },
      {
        key: 'culture',
        title: '茶材来源核对',
        fact: '本地茶材有真实来源，但不同供应商的批次和讲法并不完全一致。',
        implication: '文化故事越具体，越需要产品与供应链一起支撑。',
        unknown: '顾客是否愿意因为来源解释支付更多。',
        angle: 'culture',
        relations: [
          {
            choiceKey: 'culture-first',
            relation: 'supports',
            strength: 80,
            explanation: '来源记录支持从真实材料开始讲故事。',
          },
        ],
        theoryIds: ['t-insight', 't-product'],
      },
      {
        key: 'price',
        title: '同类价格带比较',
        fact: '同街饮品价格差距不只来自原料，也来自包装、等待时间和拍照体验。',
        implication: '价格表达必须和产品、服务、视觉共同出现。',
        unknown: '你的顾客愿意为哪一部分价值多付钱。',
        angle: 'cost',
        relations: [
          {
            choiceKey: 'budget-first',
            relation: 'supports',
            strength: 70,
            explanation: '价格带比较支持先管理顾客预期。',
          },
        ],
        theoryIds: ['t-insight', 't-product'],
      },
      {
        key: 'capacity',
        title: '团队时间盘点',
        fact: '目前团队只有两个人，无法同时维护太多产品和传播入口。',
        implication: '定位越宽，执行成本越容易被低估。',
        unknown: '忙起来以后哪些工作可以外包或标准化。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'dual-track',
            relation: 'warns',
            strength: 75,
            explanation: '团队容量提醒双线定位需要额外防护。',
          },
        ],
        theoryIds: ['t-growth'],
      },
      {
        key: 'voice',
        title: '老街语言采样',
        fact: '游客会记住一句顺口的招呼，但对网络热词的记忆通常很短。',
        implication: '语气可以轻松，品牌识别仍要建立在自己的关系上。',
        unknown: '哪句表达能在离开老街后仍被复述。',
        angle: 'competition',
        relations: [
          {
            choiceKey: 'anti-trend',
            relation: 'supports',
            strength: 65,
            explanation: '语言采样支持建立自己的说话方式。',
          },
        ],
        theoryIds: ['t-segment'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-scope',
        label: '给双线定位画一条边界',
        description: '提前写清居民线和游客线共享什么、各自不做什么。',
        targetRisk: '定位过宽导致执行失控',
        cashCostYuan: 5000,
        actionPointCost: 1,
        mitigationRatio: 45,
        theoryIds: ['t-segment', 't-growth'],
      },
    ],
  },
  {
    roundId: 'r04',
    chapterId: 'c2',
    title: '价格不是最后才填的数字',
    timelineLabel: '第2月下旬',
    situation: '第一款产品有了方向，包装厂却说不同规格会明显改变成本。',
    whyNow: '价格、分量和包装一起决定顾客是否相信这项承诺。',
    dilemma: '是做一款看起来更贵的礼盒，还是把日常购买做得更轻松？',
    mustComplete: '让价格、产品价值与包装形式彼此对得上。',
    theoryIds: ['t-product', 't-insight'],
    eventIds: ['event-r04-daily', 'event-r04-gift', 'event-r04-reuse'],
    choices: [
      {
        key: 'everyday-cup',
        label: '把主力放在日常杯装',
        summary: '让顾客不需要做太多计算就能买。',
        detail: '控制包材和制作复杂度，把稳定口味、分量和取杯速度作为主力价值。',
        cashCostYuan: 24000,
        actionPointCost: 2,
        durationDays: 6,
        workload: 2,
        primaryBenefit: '转化与复购门槛较低',
        primaryRisk: '礼赠场景的溢价空间较小',
        evidenceRelations: [ev('r04', 'daily')],
        effects: [
          effect('conversion', 8, 'immediate', '第一次购买更容易发生', 't-product'),
          effect('loyalty', 4, 'delayed', '日常购买开始积累复购', 't-product'),
        ],
        theoryIds: ['t-product'],
      },
      {
        key: 'gift-box',
        label: '做一款有地方感的礼盒',
        summary: '让包装承担送礼和带走的价值。',
        detail: '把茶材说明、包装结构和携带体验一起设计，接受更高的单次成本。',
        cashCostYuan: 42000,
        actionPointCost: 3,
        durationDays: 10,
        workload: 4,
        primaryBenefit: '客单与文化表达更高',
        primaryRisk: '礼盒滞销会占压现金',
        evidenceRelations: [ev('r04', 'gift'), ev('r04', 'package')],
        effects: [
          effect('culturalCredibility', 8, 'immediate', '地方故事被带进礼赠场景', 't-product'),
          effect('reputationDebt', 3, 'delayed', '库存压力让兑现承诺变得更难', 't-insight'),
        ],
        theoryIds: ['t-product', 't-insight'],
      },
      {
        key: 'refill',
        label: '做可回收容器的补充装',
        summary: '用复用机制把环保承诺落到产品上。',
        detail: '设置归还与清洁流程，让包装价值不只停在图案，而是参与顾客持续回来。',
        cashCostYuan: 31000,
        actionPointCost: 3,
        durationDays: 9,
        workload: 4,
        primaryBenefit: '关系与差异化更强',
        primaryRisk: '清洁和回收流程容易失控',
        evidenceRelations: [ev('r04', 'reuse')],
        effects: [
          effect('loyalty', 7, 'immediate', '顾客有了再次回来的理由', 't-product'),
          effect('productDelivery', -6, 'delayed', '回收流程增加交付工作量', 't-product'),
        ],
        riskPlanIds: ['r04-risk-reuse'],
        theoryIds: ['t-product'],
      },
      {
        key: 'price-ladder',
        label: '做三档清晰的价格梯度',
        summary: '给不同预算的顾客一条可理解的选择路径。',
        detail: '用基础、招牌和礼赠三档产品组织菜单，不让每一次加价都变成含糊的“升级”。',
        cashCostYuan: 27000,
        actionPointCost: 2,
        durationDays: 7,
        workload: 3,
        primaryBenefit: '价格解释更有层次',
        primaryRisk: '档位过多会拖慢选择',
        evidenceRelations: [ev('r04', 'price')],
        effects: [
          effect('conversion', 5, 'immediate', '顾客更容易找到合适档位', 't-insight'),
          effect('brandConsistency', 5, 'delayed', '产品梯度帮助品牌表达统一', 't-product'),
        ],
        theoryIds: ['t-insight', 't-product'],
      },
      {
        key: 'bundle',
        label: '把饮品和小点心组合销售',
        summary: '用一套完整体验提高单次价值。',
        detail: '选择一个和茶饮相容的小点心，控制品类数量，让组合不是为了凑满减。',
        cashCostYuan: 29000,
        actionPointCost: 3,
        durationDays: 8,
        workload: 3,
        primaryBenefit: '客单与体验完整度上升',
        primaryRisk: '备货复杂度增加',
        evidenceRelations: [ev('r04', 'margin')],
        effects: [
          effect('conversion', 6, 'immediate', '组合让购买理由更完整', 't-product'),
          effect('orgCapacity', -4, 'delayed', '额外备货牵动团队时间', 't-growth'),
        ],
        riskPlanIds: ['r04-risk-reuse'],
        theoryIds: ['t-product', 't-growth'],
      },
    ],
    evidence: [
      {
        key: 'daily',
        title: '工作日购买记录',
        fact: '附近顾客更常在十分钟内完成购买，愿意尝试但不愿承担复杂选择。',
        implication: '日常产品的价值首先体现在顺手和稳定。',
        unknown: '快购买是否会削弱地方感。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'everyday-cup',
            relation: 'supports',
            strength: 80,
            explanation: '购买记录支持把主力放在日常杯装。',
          },
        ],
        theoryIds: ['t-product'],
      },
      {
        key: 'gift',
        title: '游客带走场景访谈',
        fact: '游客愿意买礼物，但会先判断包装是否方便携带、是否说得清来源。',
        implication: '礼盒的溢价必须同时被产品与包装证明。',
        unknown: '礼盒会不会只在节假日销售。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'gift-box',
            relation: 'supports',
            strength: 75,
            explanation: '带走场景支持礼盒，但它不是所有时段的主力。',
          },
        ],
        theoryIds: ['t-product', 't-insight'],
      },
      {
        key: 'package',
        title: '包装打样报价',
        fact: '复杂结构和特殊印刷会把单件成本推高，且小批量价格更不稳定。',
        implication: '包装设计的表达欲要和生产批量、运输损耗一起算。',
        unknown: '顾客是否愿意为结构变化支付更多。',
        angle: 'cost',
        relations: [
          {
            choiceKey: 'gift-box',
            relation: 'warns',
            strength: 70,
            explanation: '报价提醒礼盒方案要管理库存与成本。',
          },
        ],
        theoryIds: ['t-insight', 't-product'],
      },
      {
        key: 'reuse',
        title: '容器回收试运行',
        fact: '顾客愿意参与回收，但归还、清洁和补充装的路径还没有固定。',
        implication: '一个环保概念需要可执行的服务流程。',
        unknown: '高峰期团队能否维持回收承诺。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'refill',
            relation: 'supports',
            strength: 60,
            explanation: '试运行显示关系机会存在，但流程仍要补强。',
          },
          {
            choiceKey: 'bundle',
            relation: 'context',
            strength: 50,
            explanation: '组合销售也会增加包材管理复杂度。',
          },
        ],
        theoryIds: ['t-product', 't-growth'],
      },
      {
        key: 'price',
        title: '竞品价格解释',
        fact: '顾客比较的不只是金额，还包括分量、等待、包装和“为什么值得”。',
        implication: '价格梯度要让价值差异能被一眼解释。',
        unknown: '哪一项附加价值最容易被顾客记住。',
        angle: 'competition',
        relations: [
          {
            choiceKey: 'price-ladder',
            relation: 'supports',
            strength: 75,
            explanation: '比较结果支持用档位解释不同价值。',
          },
        ],
        theoryIds: ['t-insight'],
      },
      {
        key: 'margin',
        title: '毛利测算表',
        fact: '小点心会提高客单，但也增加保鲜、备货和损耗。',
        implication: '组合不是越多越好，必须能被团队稳定兑现。',
        unknown: '顾客会不会只买低价组合。',
        angle: 'cost',
        relations: [
          {
            choiceKey: 'bundle',
            relation: 'context',
            strength: 65,
            explanation: '毛利表支持组合有机会，但提醒管理损耗。',
          },
        ],
        theoryIds: ['t-product', 't-growth'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-reuse',
        label: '先把补充装流程画成一张图',
        description: '明确归还、清洁、补充和异常处理，不让环保承诺靠记忆执行。',
        targetRisk: '回收服务失控',
        cashCostYuan: 4800,
        actionPointCost: 1,
        mitigationRatio: 50,
        theoryIds: ['t-product'],
      },
    ],
  },
  {
    roundId: 'r05',
    chapterId: 'c2',
    title: '名字、LOGO 和 IP 各自要做什么',
    timelineLabel: '第3月上旬',
    situation: '设计师拿来几张很漂亮的草图：有的适合招牌，有的适合包装，还有的只有放大时好看。',
    whyNow: '品牌视觉不是一次投票，而是要在不同尺寸、触点和语气里持续工作。',
    dilemma: '是先做一个醒目的符号，还是先建立一套可使用的规则？',
    mustComplete: '确定视觉资产各自承担的任务和边界。',
    theoryIds: ['t-identity', 't-touchpoint'],
    eventIds: ['event-r05-word', 'event-r05-mountain', 'event-r05-character'],
    isKeyRound: true,
    choices: [
      {
        key: 'plain-word',
        label: '先做清楚易读的文字标志',
        summary: '让店名在远处和小屏上都能认出来。',
        detail: '先建立字体、比例、留白和最小尺寸，再把地方感放进辅助图形与包装语气。',
        cashCostYuan: 23000,
        actionPointCost: 2,
        durationDays: 6,
        workload: 2,
        primaryBenefit: '识别稳定、落地成本可控',
        primaryRisk: '第一眼戏剧性不强',
        evidenceRelations: [ev('r05', 'scale')],
        effects: [
          effect('visualRecognition', 9, 'immediate', '店名在不同尺寸都更好读', 't-identity'),
          effect('culturalCredibility', -2, 'delayed', '地域故事需要其他触点补足', 't-touchpoint'),
        ],
        theoryIds: ['t-identity', 't-touchpoint'],
      },
      {
        key: 'mountain-mark',
        label: '把山形符号做成主识别',
        summary: '让顾客第一眼联想到黄山和老街。',
        detail: '用一个简洁山形建立地域入口，同时规定它不可以随意叠加屋檐、墨色和印章。',
        cashCostYuan: 28000,
        actionPointCost: 3,
        durationDays: 8,
        workload: 3,
        primaryBenefit: '地域理解速度较快',
        primaryRisk: '同街同类符号很多',
        evidenceRelations: [ev('r05', 'competition')],
        effects: [
          effect('culturalCredibility', 8, 'immediate', '地域联想更快建立', 't-identity'),
          effect('differentiation', -6, 'delayed', '通用山形容易带来同质化', 't-touchpoint'),
        ],
        theoryIds: ['t-identity', 't-touchpoint'],
      },
      {
        key: 'tea-character',
        label: '为包装设计一个会打招呼的 IP',
        summary: '让 IP 进入顾客带走和分享的过程。',
        detail:
          '给角色规定表情、动作、比例和使用场景，让它服务关系表达，而不是每张图都换一个造型。',
        cashCostYuan: 36000,
        actionPointCost: 3,
        durationDays: 10,
        workload: 4,
        primaryBenefit: '包装与社交传播更有记忆点',
        primaryRisk: 'IP 管理会增加内容工作量',
        evidenceRelations: [ev('r05', 'ip')],
        effects: [
          effect('visualRecognition', 10, 'immediate', '角色帮助顾客记住品牌', 't-identity'),
          effect('orgCapacity', -5, 'delayed', 'IP内容需要持续维护', 't-growth'),
        ],
        riskPlanIds: ['r05-risk-ip'],
        theoryIds: ['t-identity', 't-growth'],
      },
      {
        key: 'neighborhood-seal',
        label: '做一个像街坊印章的辅助图形',
        summary: '把熟悉感放在杯套、贴纸和会员物料里。',
        detail: '主 LOGO 保持稳定，印章作为可以变化的关系符号，避免把所有触点都塞满。',
        cashCostYuan: 21000,
        actionPointCost: 2,
        durationDays: 7,
        workload: 3,
        primaryBenefit: '关系表达更灵活',
        primaryRisk: '辅助图形过多会削弱主识别',
        evidenceRelations: [ev('r05', 'ip')],
        effects: [
          effect('trust', 6, 'immediate', '熟客觉得品牌更像在和自己说话', 't-touchpoint'),
          effect('brandConsistency', -3, 'delayed', '边界不清会让触点变松散', 't-touchpoint'),
        ],
        riskPlanIds: ['r05-risk-ip'],
        theoryIds: ['t-touchpoint'],
      },
      {
        key: 'no-symbol',
        label: '只做一套克制的文字与色彩规范',
        summary: '先把系统做稳，再考虑增加图形资产。',
        detail: '规定字体、主色、辅助色和版式边界，不急着用 IP 或地方图腾制造热闹。',
        cashCostYuan: 19000,
        actionPointCost: 2,
        durationDays: 5,
        workload: 2,
        primaryBenefit: '跨触点一致性较高',
        primaryRisk: '传播素材的变化空间较小',
        evidenceRelations: [ev('r05', 'scale')],
        effects: [
          effect('brandConsistency', 8, 'immediate', '基础规范让触点更像同一家店', 't-touchpoint'),
          effect('awareness', -3, 'delayed', '克制系统需要时间积累识别', 't-identity'),
        ],
        theoryIds: ['t-identity', 't-touchpoint'],
      },
    ],
    evidence: [
      {
        key: 'scale',
        title: '小尺寸识别测试',
        fact: '店名在手机头像和杯身上会被缩到很小，装饰细节很容易消失。',
        implication: 'LOGO 的任务首先是识别，复杂图形要有合适的使用边界。',
        unknown: '哪一项辅助元素能在小尺寸中保留下来。',
        angle: 'visual',
        relations: [
          {
            choiceKey: 'plain-word',
            relation: 'supports',
            strength: 80,
            explanation: '小尺寸测试支持先把文字识别做稳。',
          },
          {
            choiceKey: 'no-symbol',
            relation: 'supports',
            strength: 65,
            explanation: '规范优先能减少缩小时的噪音。',
          },
        ],
        theoryIds: ['t-identity'],
      },
      {
        key: 'competition',
        title: '同街符号并置',
        fact: '周边品牌常用山形、屋檐和墨色，顾客很容易把它们归为一类。',
        implication: '地域符号需要自己的组合语法，不能只靠“像黄山”。',
        unknown: '顾客会记住哪一个非通用的细节。',
        angle: 'competition',
        relations: [
          {
            choiceKey: 'mountain-mark',
            relation: 'warns',
            strength: 80,
            explanation: '并置结果提醒山形主识别必须处理同质化。',
          },
        ],
        theoryIds: ['t-identity', 't-touchpoint'],
      },
      {
        key: 'ip',
        title: '包装角色使用观察',
        fact: '有表情和动作的角色更容易被拍照，但频繁换造型会让品牌看起来没有规则。',
        implication: 'IP 需要角色任务、动作边界和触点规范。',
        unknown: '顾客会不会在没有文字的情况下认出它属于这家店。',
        angle: 'visual',
        relations: [
          {
            choiceKey: 'tea-character',
            relation: 'supports',
            strength: 70,
            explanation: '观察支持 IP 进入包装，但前提是先定规则。',
          },
          {
            choiceKey: 'neighborhood-seal',
            relation: 'context',
            strength: 55,
            explanation: '辅助图形也可以承担关系表达。',
          },
        ],
        theoryIds: ['t-identity', 't-touchpoint'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-ip',
        label: '先做一页 IP 使用边界',
        description: '规定角色能出现在哪里、怎么说话、最小尺寸和不能做的变形。',
        targetRisk: '视觉资产越做越乱',
        cashCostYuan: 5200,
        actionPointCost: 1,
        mitigationRatio: 55,
        theoryIds: ['t-identity', 't-touchpoint'],
      },
    ],
  },
  {
    roundId: 'r06',
    chapterId: 'c2',
    title: '开业第一周，品牌要出现在哪里',
    timelineLabel: '第3月下旬',
    situation:
      '门店快开了，预算只够把一部分触点做扎实：店招、杯套、社交页面和合作渠道不能同时铺满。',
    whyNow: '传播不是把同一张海报复制到所有地方，而是要决定顾客如何第一次遇见你。',
    dilemma: '是把钱砸在门店第一眼，还是借别人的场景快速获得讨论？',
    mustComplete: '选择第一批可承受的触点和传播节奏。',
    theoryIds: ['t-touchpoint', 't-growth'],
    eventIds: ['event-r06-street', 'event-r06-video', 'event-r06-partner'],
    businessPhase: 'operating',
    fixedCostPerDayYuan: 850,
    baseRevenueYuan: 150000,
    choices: [
      {
        key: 'streetboard',
        label: '先把店招和门口体验做扎实',
        summary: '让经过的人不用解释就知道这里卖什么。',
        detail: '优先完成店招、菜单和门口动线，再用小规模社交内容记录真实体验。',
        cashCostYuan: 30000,
        actionPointCost: 3,
        durationDays: 7,
        workload: 3,
        primaryBenefit: '到店转化基础更稳',
        primaryRisk: '线上传播起量较慢',
        evidenceRelations: [ev('r06', 'walkin')],
        effects: [
          effect('conversion', 7, 'immediate', '经过门店的人更容易进店', 't-touchpoint'),
          effect('awareness', -2, 'delayed', '只做线下会限制远端声量', 't-growth'),
        ],
        theoryIds: ['t-touchpoint', 't-growth'],
      },
      {
        key: 'shortvideo',
        label: '用一组短视频讲产品过程',
        summary: '把茶材、制作和包装变成可观看的理由。',
        detail: '拍摄真实制作和顾客使用，不追求每天上热搜，先建立能被复述的内容节奏。',
        cashCostYuan: 27000,
        actionPointCost: 3,
        durationDays: 8,
        workload: 4,
        primaryBenefit: '远端知名度上升',
        primaryRisk: '内容承诺可能跑在产品前面',
        evidenceRelations: [ev('r06', 'content')],
        effects: [
          effect('awareness', 10, 'immediate', '更多人第一次看到品牌', 't-growth'),
          effect('promiseCredibility', -4, 'delayed', '线上展示放大后续兑现压力', 't-product'),
        ],
        riskPlanIds: ['r06-risk-content'],
        theoryIds: ['t-growth', 't-product'],
      },
      {
        key: 'partner-host',
        label: '和老街民宿做互相推荐',
        summary: '借真实旅行场景接触有明确需求的人。',
        detail: '把推荐卡、地图和到店话术交给合作方，但不要求对方替你夸大产品。',
        cashCostYuan: 22000,
        actionPointCost: 2,
        durationDays: 6,
        workload: 3,
        primaryBenefit: '客群匹配更准确',
        primaryRisk: '渠道关系和服务标准要维护',
        evidenceRelations: [ev('r06', 'partner')],
        effects: [
          effect('segmentFit', 7, 'immediate', '到店顾客与旅行场景更匹配', 't-growth'),
          effect('channelDependence', 5, 'delayed', '对合作渠道的依赖开始增加', 't-growth'),
        ],
        theoryIds: ['t-growth'],
      },
      {
        key: 'member-preorder',
        label: '开业前先做熟客预订',
        summary: '用小范围的真实订单检查承诺。',
        detail: '邀请附近居民预订少量产品，提前暴露出杯、包装和沟通的问题。',
        cashCostYuan: 18000,
        actionPointCost: 3,
        durationDays: 5,
        workload: 3,
        primaryBenefit: '交付和信任先得到验证',
        primaryRisk: '开业声量不会很大',
        evidenceRelations: [ev('r06', 'walkin'), ev('r06', 'capacity')],
        effects: [
          effect('trust', 7, 'immediate', '第一批顾客愿意把体验交给你', 't-product'),
          effect('productDelivery', 6, 'delayed', '小范围试卖帮助团队变稳定', 't-product'),
        ],
        theoryIds: ['t-product', 't-touchpoint'],
      },
      {
        key: 'pop-up',
        label: '去一个热门活动做快闪',
        summary: '用一次集中曝光测试新客反应。',
        detail: '只带一款产品和一组轻量物料，活动结束后把有效反馈带回门店。',
        cashCostYuan: 33000,
        actionPointCost: 4,
        durationDays: 9,
        workload: 5,
        primaryBenefit: '声量与新客快速增加',
        primaryRisk: '临时场景可能掩盖日常经营问题',
        evidenceRelations: [ev('r06', 'event')],
        effects: [
          effect('awareness', 13, 'immediate', '活动现场让品牌迅速被看见', 't-growth'),
          effect('productDelivery', -6, 'delayed', '快闪压力暴露交付短板', 't-product'),
        ],
        riskPlanIds: ['r06-risk-content'],
        theoryIds: ['t-growth', 't-product'],
      },
    ],
    evidence: [
      {
        key: 'walkin',
        title: '门口停留记录',
        fact: '路人通常只给店招和门口十几秒，随后才决定要不要进店。',
        implication: '第一触点要同时完成品类识别和一个可信的购买理由。',
        unknown: '哪种视觉层级最能减少犹豫。',
        angle: 'visual',
        relations: [
          {
            choiceKey: 'streetboard',
            relation: 'supports',
            strength: 75,
            explanation: '停留记录支持先把门店入口做完整。',
          },
          {
            choiceKey: 'member-preorder',
            relation: 'context',
            strength: 55,
            explanation: '预订可以验证进店后的兑现，但不能替代门口识别。',
          },
        ],
        theoryIds: ['t-touchpoint'],
      },
      {
        key: 'content',
        title: '短视频评论整理',
        fact: '顾客喜欢看制作过程，但会立即追问价格、等待时间和实际分量。',
        implication: '传播画面越吸引人，产品交付越要跟上。',
        unknown: '哪些内容会带来真正到店而不是只点赞。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'shortvideo',
            relation: 'supports',
            strength: 70,
            explanation: '评论支持过程内容有吸引力，同时提醒兑现问题。',
          },
        ],
        theoryIds: ['t-growth', 't-product'],
      },
      {
        key: 'partner',
        title: '旅行路线合作访谈',
        fact: '民宿可以带来明确旅行场景，但合作方最在意顾客投诉是否会反过来影响自己。',
        implication: '渠道合作必须共享服务边界，不能只交换流量。',
        unknown: '合作渠道能持续多久。',
        angle: 'competition',
        relations: [
          {
            choiceKey: 'partner-host',
            relation: 'supports',
            strength: 65,
            explanation: '合作访谈支持场景匹配，但需要共同维护信任。',
          },
        ],
        theoryIds: ['t-growth'],
      },
      {
        key: 'capacity',
        title: '开业人手盘点',
        fact: '正式开业第一周只能稳定承接有限订单，超出后容易出现等待和错单。',
        implication: '预订和快闪都必须控制规模，增长不是免费的。',
        unknown: '什么时候需要增加人员或改流程。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'member-preorder',
            relation: 'supports',
            strength: 70,
            explanation: '人手盘点支持先以小订单测试交付。',
          },
          {
            choiceKey: 'pop-up',
            relation: 'warns',
            strength: 75,
            explanation: '人手盘点提醒快闪要控制数量。',
          },
        ],
        theoryIds: ['t-product', 't-growth'],
      },
      {
        key: 'event',
        title: '活动方摊位记录',
        fact: '热门活动能带来人流，但顾客停留短、比较多，物料和出杯速度都要更轻。',
        implication: '快闪是一次实验，不一定等于门店日常经营。',
        unknown: '活动带来的新客是否愿意去门店复购。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'pop-up',
            relation: 'context',
            strength: 60,
            explanation: '活动提供曝光机会，但不能掩盖日常能力。',
          },
        ],
        theoryIds: ['t-growth'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-content',
        label: '先写一份传播兑现清单',
        description: '把视频中的价格、分量、等待和服务承诺逐项对照门店能力。',
        targetRisk: '传播承诺跑在产品前面',
        cashCostYuan: 4500,
        actionPointCost: 1,
        mitigationRatio: 50,
        theoryIds: ['t-growth', 't-product'],
      },
    ],
  },
  {
    roundId: 'r07',
    chapterId: 'c3',
    title: '服务也是品牌的一部分',
    timelineLabel: '第4月',
    situation:
      '开业的新鲜感过去后，顾客开始记住的不是海报，而是点单、等待、取杯和离店时的每个动作。',
    whyNow: '如果服务体验和视觉、产品承诺不一致，顾客会把品牌理解成另一回事。',
    dilemma: '是追求更快的出杯，还是留下更有温度的互动？',
    mustComplete: '让至少三个真实触点说同一种品牌语言。',
    theoryIds: ['t-touchpoint', 't-product'],
    eventIds: ['event-r07-script', 'event-r07-express', 'event-r07-gift'],
    businessPhase: 'operating',
    fixedCostPerDayYuan: 900,
    baseRevenueYuan: 165000,
    choices: [
      {
        key: 'greeting-script',
        label: '把招呼和推荐写成一套轻量话术',
        summary: '让新人也能用同一种语气服务顾客。',
        detail: '为点单、等待和离店分别写一句可自由发挥的提示，不要求店员像背台词。',
        cashCostYuan: 16000,
        actionPointCost: 2,
        durationDays: 5,
        workload: 2,
        primaryBenefit: '品牌语气更一致',
        primaryRisk: '话术过硬会显得不自然',
        evidenceRelations: [ev('r07', 'tone')],
        effects: [
          effect('brandConsistency', 8, 'immediate', '服务语气开始和视觉系统对齐', 't-touchpoint'),
          effect('trust', 4, 'delayed', '顾客逐渐感到每次体验都可靠', 't-product'),
        ],
        theoryIds: ['t-touchpoint', 't-product'],
      },
      {
        key: 'express-line',
        label: '为高峰期做一条快取动线',
        summary: '先解决排队，再把互动留给愿意停留的人。',
        detail: '把菜单、取杯和外带包装重新排布，允许顾客快速完成购买，不用每个人都听一段故事。',
        cashCostYuan: 26000,
        actionPointCost: 3,
        durationDays: 7,
        workload: 3,
        primaryBenefit: '交付能力和转化上升',
        primaryRisk: '关系表达空间变少',
        evidenceRelations: [ev('r07', 'wait')],
        effects: [
          effect('productDelivery', 9, 'immediate', '高峰期出杯更稳定', 't-product'),
          effect('trust', -2, 'delayed', '过度追求速度会减少互动', 't-touchpoint'),
        ],
        riskPlanIds: ['r07-risk-balance'],
        theoryIds: ['t-product', 't-touchpoint'],
      },
      {
        key: 'gift-service',
        label: '把包装交接做成一个小仪式',
        summary: '让顾客带走产品时也带走一句品牌话。',
        detail: '在杯套、封口和交接动作中留出一个简短而可复用的记忆点，不增加太多等待。',
        cashCostYuan: 22000,
        actionPointCost: 3,
        durationDays: 8,
        workload: 3,
        primaryBenefit: '包装和服务共同传播',
        primaryRisk: '动作复杂会拖慢高峰',
        evidenceRelations: [ev('r07', 'package')],
        effects: [
          effect('visualRecognition', 7, 'immediate', '包装离店后仍能被辨认', 't-touchpoint'),
          effect('productDelivery', -4, 'delayed', '交接动作会带来一点等待', 't-product'),
        ],
        riskPlanIds: ['r07-risk-balance'],
        theoryIds: ['t-touchpoint', 't-product'],
      },
      {
        key: 'community-board',
        label: '在店里留一块街坊留言板',
        summary: '让社区关系成为持续更新的内容。',
        detail: '邀请熟客留下对茶和老街的短句，每周整理一次，既保留真实声音也设定内容边界。',
        cashCostYuan: 12000,
        actionPointCost: 2,
        durationDays: 4,
        workload: 2,
        primaryBenefit: '亲近感和复购理由增加',
        primaryRisk: '内容管理会占用时间',
        evidenceRelations: [ev('r07', 'tone')],
        effects: [
          effect('loyalty', 7, 'immediate', '熟客获得参与和回来的理由', 't-touchpoint'),
          effect('orgCapacity', -3, 'delayed', '内容整理成为持续工作', 't-growth'),
        ],
        theoryIds: ['t-touchpoint', 't-growth'],
      },
      {
        key: 'self-service',
        label: '把点单和取杯尽量自助化',
        summary: '用清晰界面减少沟通成本。',
        detail: '将菜单、价格、取杯提示做成容易读的系统，让店员把时间留给复杂问题和关系维护。',
        cashCostYuan: 25000,
        actionPointCost: 3,
        durationDays: 7,
        workload: 3,
        primaryBenefit: '高峰承接力更强',
        primaryRisk: '品牌显得更像一个冷静的工具',
        evidenceRelations: [ev('r07', 'wait')],
        effects: [
          effect('productDelivery', 8, 'immediate', '流程更快更少错单', 't-product'),
          effect('trust', -3, 'delayed', '缺少回应会让部分顾客感到疏离', 't-touchpoint'),
        ],
        theoryIds: ['t-product', 't-touchpoint'],
      },
    ],
    evidence: [
      {
        key: 'tone',
        title: '熟客服务回访',
        fact: '顾客喜欢自然的招呼和记得住的小细节，不喜欢店员机械背诵品牌故事。',
        implication: '品牌话术应该提供方向，而不是把人变成播放设备。',
        unknown: '哪种话术最适合新人和高峰期。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'greeting-script',
            relation: 'supports',
            strength: 75,
            explanation: '回访支持轻量话术，但不支持硬背台词。',
          },
          {
            choiceKey: 'community-board',
            relation: 'supports',
            strength: 60,
            explanation: '真实留言可以继续积累关系语言。',
          },
        ],
        theoryIds: ['t-touchpoint'],
      },
      {
        key: 'wait',
        title: '高峰排队计时',
        fact: '等待超过八分钟后，顾客对复杂仪式的耐心明显下降。',
        implication: '服务设计需要区分快取场景和愿意停留的场景。',
        unknown: '哪一项互动值得顾客多等两分钟。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'express-line',
            relation: 'supports',
            strength: 80,
            explanation: '排队计时支持先稳定高峰交付。',
          },
          {
            choiceKey: 'self-service',
            relation: 'supports',
            strength: 65,
            explanation: '清晰的自助流程可以减少等待和错单。',
          },
        ],
        theoryIds: ['t-product', 't-touchpoint'],
      },
      {
        key: 'package',
        title: '离店包装观察',
        fact: '顾客会把杯子放在车站座椅和办公桌上，包装往往只露出一小块。',
        implication: '包装交接是视觉、服务和携带场景共同发生的触点。',
        unknown: '顾客愿意保留什么样的包装细节。',
        angle: 'visual',
        relations: [
          {
            choiceKey: 'gift-service',
            relation: 'supports',
            strength: 75,
            explanation: '离店观察支持把交接作为品牌体验的一部分。',
          },
        ],
        theoryIds: ['t-touchpoint'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-balance',
        label: '把高峰和非高峰服务拆开设计',
        description: '提前规定什么时候快取、什么时候互动，避免一套动作压垮所有场景。',
        targetRisk: '服务温度拖慢交付',
        cashCostYuan: 4300,
        actionPointCost: 1,
        mitigationRatio: 50,
        theoryIds: ['t-product', 't-touchpoint'],
      },
    ],
  },
  {
    roundId: 'r09',
    chapterId: 'c3',
    title: '顾客愿意替你说什么',
    timelineLabel: '第6月',
    situation: '有顾客在社交平台分享杯套和茶，但他们说的品牌故事并不完全一样。',
    whyNow: '口碑会带来新的关系，也会把没有准备好的承诺放大。',
    dilemma: '是鼓励所有人自由发挥，还是先规定一句统一的话？',
    mustComplete: '让顾客参与传播，同时守住品牌核心承诺。',
    theoryIds: ['t-touchpoint', 't-growth'],
    eventIds: ['event-r09-stamp', 'event-r09-stories', 'event-r09-feedback'],
    businessPhase: 'operating',
    fixedCostPerDayYuan: 1000,
    baseRevenueYuan: 190000,
    choices: [
      {
        key: 'stamp',
        label: '做一套可收集的街区印章',
        summary: '用连续的小奖励换顾客再次回来。',
        detail: '每个印章对应一个真实街区或茶材故事，让收集成为复购关系而不是无条件打折。',
        cashCostYuan: 18000,
        actionPointCost: 2,
        durationDays: 6,
        workload: 2,
        primaryBenefit: '复购与文化记忆增加',
        primaryRisk: '奖励设计会增加物料成本',
        evidenceRelations: [ev('r09', 'repeat')],
        effects: [
          effect('loyalty', 9, 'immediate', '顾客多了一个回来的理由', 't-touchpoint'),
          effect('reputationDebt', 2, 'delayed', '奖励承诺需要持续兑现', 't-growth'),
        ],
        theoryIds: ['t-touchpoint', 't-growth'],
      },
      {
        key: 'stories',
        label: '邀请顾客讲自己的老街故事',
        summary: '让用户内容成为品牌关系的一部分。',
        detail:
          '设置投稿主题和授权边界，精选真实故事进入杯套或社交页面，不把顾客变成免费文案机器。',
        cashCostYuan: 22000,
        actionPointCost: 3,
        durationDays: 8,
        workload: 3,
        primaryBenefit: '关系和内容真实性上升',
        primaryRisk: '内容审核会占用团队时间',
        evidenceRelations: [ev('r09', 'story')],
        effects: [
          effect('trust', 8, 'immediate', '顾客感到自己的经验被认真对待', 't-touchpoint'),
          effect('orgCapacity', -4, 'delayed', '持续审核内容需要组织承接', 't-growth'),
        ],
        riskPlanIds: ['r09-risk-content'],
        theoryIds: ['t-touchpoint', 't-growth'],
      },
      {
        key: 'tea-class',
        label: '开一场小型茶饮体验课',
        summary: '把产品知识变成可参与的关系。',
        detail: '每次只接待少量人，展示茶材、配方与包装，让参与者知道品牌承诺从哪里来。',
        cashCostYuan: 26000,
        actionPointCost: 3,
        durationDays: 9,
        workload: 4,
        primaryBenefit: '文化可信度与信任提高',
        primaryRisk: '活动规模小，短期收入有限',
        evidenceRelations: [ev('r09', 'culture')],
        effects: [
          effect('culturalCredibility', 9, 'immediate', '产品故事被真实体验支撑', 't-product'),
          effect('loyalty', 5, 'delayed', '参与者更愿意长期关注', 't-touchpoint'),
        ],
        riskPlanIds: ['r09-risk-content'],
        theoryIds: ['t-product', 't-touchpoint'],
      },
      {
        key: 'feedback-table',
        label: '把差评也放进改进记录',
        summary: '把公开反馈变成产品和服务的修正依据。',
        detail: '按问题类型整理反馈，公开一部分改进进度，不承诺每个意见都照单全收。',
        cashCostYuan: 15000,
        actionPointCost: 2,
        durationDays: 5,
        workload: 2,
        primaryBenefit: '信任和交付能力更稳',
        primaryRisk: '短期看起来会暴露问题',
        evidenceRelations: [ev('r09', 'feedback')],
        effects: [
          effect('trust', 7, 'immediate', '顾客看到品牌愿意面对问题', 't-insight'),
          effect('productDelivery', 6, 'delayed', '反馈进入流程后交付更稳定', 't-product'),
        ],
        theoryIds: ['t-insight', 't-product'],
      },
      {
        key: 'seasonal-club',
        label: '建立季节茶饮会员通讯',
        summary: '用固定节奏维持关系，而不是天天刷屏。',
        detail: '每季发送一次产品和老街内容，提前告知变化与库存，不把会员变成高频促销名单。',
        cashCostYuan: 20000,
        actionPointCost: 2,
        durationDays: 7,
        workload: 3,
        primaryBenefit: '信任与复购节奏可持续',
        primaryRisk: '增长速度不如高频投放',
        evidenceRelations: [ev('r09', 'repeat')],
        effects: [
          effect('trust', 6, 'immediate', '顾客更知道品牌接下来要做什么', 't-touchpoint'),
          effect('awareness', -2, 'delayed', '低频沟通让扩散速度慢一些', 't-growth'),
        ],
        theoryIds: ['t-touchpoint', 't-growth'],
      },
    ],
    evidence: [
      {
        key: 'repeat',
        title: '复购路径记录',
        fact: '顾客愿意为了新口味回来，但对频繁促销很快失去兴趣。',
        implication: '关系机制要给出回来的理由，而不是只制造便宜。',
        unknown: '哪种内容能让顾客主动带朋友来。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'stamp',
            relation: 'supports',
            strength: 75,
            explanation: '复购记录支持连续的小回馈。',
          },
          {
            choiceKey: 'seasonal-club',
            relation: 'supports',
            strength: 60,
            explanation: '低频会员沟通更接近长期关系。',
          },
        ],
        theoryIds: ['t-touchpoint'],
      },
      {
        key: 'story',
        title: '用户分享语料',
        fact: '顾客会把品牌说成“黄山伴手礼”“办公室下午茶”或“街坊小店”。',
        implication: '用户叙事可以扩展品牌，但需要保留核心承诺。',
        unknown: '哪些用户表达适合长期公开使用。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'stories',
            relation: 'supports',
            strength: 75,
            explanation: '分享语料支持让顾客参与品牌叙事。',
          },
        ],
        theoryIds: ['t-touchpoint', 't-growth'],
      },
      {
        key: 'culture',
        title: '茶饮体验课回访',
        fact: '参与者更容易记住具体的茶材和制作动作，而不是一段泛泛的地方宣传。',
        implication: '文化内容要通过产品体验建立可信度。',
        unknown: '活动能否转化为日常购买。',
        angle: 'culture',
        relations: [
          {
            choiceKey: 'tea-class',
            relation: 'supports',
            strength: 70,
            explanation: '回访支持用体验而非口号解释文化。',
          },
        ],
        theoryIds: ['t-product'],
      },
      {
        key: 'feedback',
        title: '公开评价整理',
        fact: '顾客最在意等待、分量和包装是否方便，部分差评来自期待没有被提前说清。',
        implication: '反馈既能修产品，也能修正品牌承诺。',
        unknown: '公开问题会不会暂时影响新客信心。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'feedback-table',
            relation: 'supports',
            strength: 80,
            explanation: '反馈整理支持把差评转成流程改进。',
          },
        ],
        theoryIds: ['t-insight', 't-product'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-content',
        label: '先定用户内容授权和审核边界',
        description: '明确顾客故事可以如何使用、谁来审核、多久回复和什么不承诺。',
        targetRisk: '用户内容失控',
        cashCostYuan: 4200,
        actionPointCost: 1,
        mitigationRatio: 45,
        theoryIds: ['t-touchpoint', 't-growth'],
      },
    ],
  },
  {
    roundId: 'r10',
    chapterId: 'c4',
    title: '增长要不要跨出这条街',
    timelineLabel: '第8月',
    situation:
      '外地商场、精品酒店和电商平台都来问能不能合作，但每种渠道都要求不同的包装和供货节奏。',
    whyNow: '增长会放大品牌，也会放大生产、渠道和组织的弱点。',
    dilemma: '是抓住更多机会，还是先把一间店经营得更扎实？',
    mustComplete: '选择一种与当前能力相匹配的增长方式。',
    theoryIds: ['t-growth', 't-product'],
    eventIds: ['event-r10-second', 'event-r10-hotel', 'event-r10-co-brand'],
    businessPhase: 'operating',
    fixedCostPerDayYuan: 1200,
    baseRevenueYuan: 210000,
    choices: [
      {
        key: 'second-counter',
        label: '在老街附近开第二个小窗口',
        summary: '复制已经验证过的日常体验。',
        detail: '只复制主力产品和服务规则，不急着复制所有视觉和活动内容。',
        cashCostYuan: 52000,
        actionPointCost: 3,
        durationDays: 14,
        workload: 4,
        primaryBenefit: '规模和交付经验同步增长',
        primaryRisk: '现金与人员压力上升',
        evidenceRelations: [ev('r10', 'capacity')],
        effects: [
          effect('conversion', 7, 'immediate', '更多附近顾客能方便买到', 't-growth'),
          effect('orgCapacity', -6, 'delayed', '第二个点位考验团队承接力', 't-growth'),
        ],
        riskPlanIds: ['r10-risk-capacity'],
        theoryIds: ['t-growth'],
      },
      {
        key: 'wholesale',
        label: '给精品酒店做小批量供货',
        summary: '进入一个与地方旅行相容的渠道。',
        detail: '先设定每周小批量和明确的包装规格，不接受无法稳定兑现的临时大单。',
        cashCostYuan: 39000,
        actionPointCost: 3,
        durationDays: 12,
        workload: 4,
        primaryBenefit: '新客场景与文化表达结合',
        primaryRisk: '渠道交付标准更高',
        evidenceRelations: [ev('r10', 'hotel')],
        effects: [
          effect('awareness', 8, 'immediate', '品牌进入新的旅行触点', 't-growth'),
          effect('productDelivery', -5, 'delayed', '批量供货提高交付压力', 't-product'),
        ],
        riskPlanIds: ['r10-risk-capacity'],
        theoryIds: ['t-growth', 't-product'],
      },
      {
        key: 'co-brand',
        label: '和本地糕点店做联名礼盒',
        summary: '用互补产品一起讲地方伴手礼。',
        detail: '双方共享一部分包装和传播，但各自保留产品质量与来源说明。',
        cashCostYuan: 36000,
        actionPointCost: 3,
        durationDays: 10,
        workload: 4,
        primaryBenefit: '礼赠价值与差异化上升',
        primaryRisk: '合作方失误会牵连信任',
        evidenceRelations: [ev('r10', 'hotel'), ev('r10', 'partner')],
        effects: [
          effect('culturalCredibility', 8, 'immediate', '地方生活方式被组合起来', 't-growth'),
          effect('reputationDebt', 4, 'delayed', '合作方体验会反过来影响品牌', 't-growth'),
        ],
        riskPlanIds: ['r10-risk-partner'],
        theoryIds: ['t-growth', 't-product'],
      },
      {
        key: 'one-store',
        label: '暂时只经营好这一间店',
        summary: '把增长预算投入产品、团队和顾客关系。',
        detail: '不追求地理扩张，先把交付、服务、包装和复购做成能反复复制的能力。',
        cashCostYuan: 25000,
        actionPointCost: 2,
        durationDays: 8,
        workload: 2,
        primaryBenefit: '系统一致性和组织能力更稳',
        primaryRisk: '错过一部分外部机会',
        evidenceRelations: [ev('r10', 'capacity')],
        effects: [
          effect('orgCapacity', 9, 'immediate', '团队有时间把流程做扎实', 't-growth'),
          effect('awareness', -3, 'delayed', '外部扩张节奏会放慢', 't-growth'),
        ],
        theoryIds: ['t-growth'],
      },
      {
        key: 'delivery',
        label: '直接上外卖和远程配送',
        summary: '用更大范围的便利性换取增长。',
        detail: '先限定配送半径、菜单和包装，避免为了覆盖远方而牺牲到店体验。',
        cashCostYuan: 44000,
        actionPointCost: 4,
        durationDays: 13,
        workload: 5,
        primaryBenefit: '触达范围快速扩大',
        primaryRisk: '平台和配送会改变体验',
        evidenceRelations: [ev('r10', 'channel')],
        effects: [
          effect('awareness', 11, 'immediate', '更多远端顾客看见品牌', 't-growth'),
          effect('channelDependence', 8, 'delayed', '平台规则开始影响经营', 't-growth'),
        ],
        riskPlanIds: ['r10-risk-capacity'],
        theoryIds: ['t-growth', 't-touchpoint'],
      },
    ],
    evidence: [
      {
        key: 'capacity',
        title: '团队承接力盘点',
        fact: '目前团队能稳定服务一间店，第二个点位需要新增排班、培训和质检。',
        implication: '扩张不是把招牌复制过去，而是把能力也复制过去。',
        unknown: '新增人手多久能达到稳定水平。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'second-counter',
            relation: 'warns',
            strength: 75,
            explanation: '盘点提醒第二点位会直接考验组织能力。',
          },
          {
            choiceKey: 'one-store',
            relation: 'supports',
            strength: 70,
            explanation: '盘点支持先把现有系统做稳。',
          },
        ],
        theoryIds: ['t-growth'],
      },
      {
        key: 'hotel',
        title: '酒店渠道需求表',
        fact: '酒店顾客需要小包装、清晰来源说明和稳定的每周交付，临时缺货会影响酒店体验。',
        implication: '批量渠道的品牌承诺不只在店里发生。',
        unknown: '小批量供货的长期毛利是否足够。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'wholesale',
            relation: 'supports',
            strength: 70,
            explanation: '需求表支持先从小批量和明确规格开始。',
          },
          {
            choiceKey: 'co-brand',
            relation: 'context',
            strength: 55,
            explanation: '联名也要共享交付边界。',
          },
        ],
        theoryIds: ['t-product', 't-growth'],
      },
      {
        key: 'partner',
        title: '本地合作方评价',
        fact: '联名可以互相带来顾客，但顾客通常不会区分是哪一方造成了包装或服务问题。',
        implication: '合作品牌共享一部分声誉，规则和责任必须先写清楚。',
        unknown: '合作方能否长期遵守同一标准。',
        angle: 'competition',
        relations: [
          {
            choiceKey: 'co-brand',
            relation: 'warns',
            strength: 80,
            explanation: '合作评价提醒联名会共享声誉风险。',
          },
        ],
        theoryIds: ['t-growth'],
      },
      {
        key: 'channel',
        title: '配送体验测试',
        fact: '饮品离店超过一定时间后，温度、包装和视觉呈现都会变化。',
        implication: '远程配送需要重新设计产品与触点，而不是直接复制门店菜单。',
        unknown: '顾客是否接受配送后的产品差异。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'delivery',
            relation: 'warns',
            strength: 75,
            explanation: '配送测试提醒平台扩张会改变体验。',
          },
        ],
        theoryIds: ['t-product', 't-touchpoint'],
      },
      {
        key: 'price',
        title: '渠道费用核算',
        fact: '平台抽成、配送和外包装会显著改变原本的价格结构。',
        implication: '渠道增长要和毛利、价格解释一起决定。',
        unknown: '顾客是否愿意承担配送后的价格。',
        angle: 'cost',
        relations: [
          {
            choiceKey: 'delivery',
            relation: 'warns',
            strength: 65,
            explanation: '费用核算提醒扩大触达不等于扩大有效收益。',
          },
        ],
        theoryIds: ['t-product', 't-growth'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-capacity',
        label: '先做一份扩张能力清单',
        description: '把人员、培训、质检、供货和异常处理逐项列出来，缺一项就缩小规模。',
        targetRisk: '增长超过组织承接力',
        cashCostYuan: 6800,
        actionPointCost: 1,
        mitigationRatio: 55,
        theoryIds: ['t-growth'],
      },
      {
        key: 'risk-partner',
        label: '把联名责任写进协议',
        description: '明确产品、包装、客诉和来源说明由谁负责，避免出了问题互相甩锅。',
        targetRisk: '合作方失误牵连信任',
        cashCostYuan: 5200,
        actionPointCost: 1,
        mitigationRatio: 50,
        theoryIds: ['t-growth', 't-product'],
      },
    ],
  },
  {
    roundId: 'r12',
    chapterId: 'c4',
    title: '一年以后，品牌要留下什么',
    timelineLabel: '第12月',
    situation: '一年快结束了，品牌已经拥有一些熟客、一套视觉资产和几个增长机会。',
    whyNow: '最后的决定不是把指标都做大，而是判断什么值得继续、什么应该舍弃。',
    dilemma: '是追逐下一次更大的声量，还是把已经成立的关系做得更深？',
    mustComplete: '为品牌下一年选择一条可持续的方向。',
    theoryIds: ['t-growth', 't-touchpoint', 't-product'],
    eventIds: ['event-r12-steady', 'event-r12-platform'],
    isKeyRound: true,
    businessPhase: 'operating',
    fixedCostPerDayYuan: 1400,
    baseRevenueYuan: 250000,
    choices: [
      {
        key: 'steady-renewal',
        label: '把成熟产品和关系继续做深',
        summary: '减少无效扩张，让系统先稳定下来。',
        detail: '保留最有复购的产品、最有效的触点和最真实的关系，把剩余预算投入培训和体验。',
        cashCostYuan: 32000,
        actionPointCost: 2,
        durationDays: 8,
        workload: 2,
        primaryBenefit: '生存、信任和一致性更稳',
        primaryRisk: '外部声量增长较慢',
        evidenceRelations: [ev('r12', 'review')],
        effects: [
          effect('trust', 8, 'immediate', '熟客相信你会继续在这里', 't-growth'),
          effect('brandConsistency', 8, 'delayed', '稳定取舍让系统更一致', 't-touchpoint'),
        ],
        theoryIds: ['t-growth', 't-touchpoint'],
      },
      {
        key: 'seasonal-new',
        label: '开发下一季的地方限定产品',
        summary: '用新的产品故事保持新鲜感。',
        detail: '只开发一款能由现有团队承接的季节产品，保留旧产品作为关系锚点。',
        cashCostYuan: 43000,
        actionPointCost: 3,
        durationDays: 12,
        workload: 4,
        primaryBenefit: '文化内容和新客兴趣增加',
        primaryRisk: '新品会分散产品注意力',
        evidenceRelations: [ev('r12', 'renew')],
        effects: [
          effect('culturalCredibility', 8, 'immediate', '下一年的文化内容有了新入口', 't-product'),
          effect('productDelivery', -4, 'delayed', '新品让交付系统再受一次考验', 't-product'),
        ],
        riskPlanIds: ['r12-risk-product'],
        theoryIds: ['t-product', 't-growth'],
      },
      {
        key: 'ip-merch',
        label: '把 IP 做成少量可带走的物件',
        summary: '让品牌关系离开门店，但控制品类。',
        detail: '选择一个真正和茶饮、老街使用场景相关的物件，不把 IP 变成无边界周边商店。',
        cashCostYuan: 38000,
        actionPointCost: 3,
        durationDays: 10,
        workload: 3,
        primaryBenefit: '视觉资产和关系传播延展',
        primaryRisk: '库存会占用现金',
        evidenceRelations: [ev('r12', 'future')],
        effects: [
          effect('visualRecognition', 9, 'immediate', 'IP 在门店外获得新的触点', 't-identity'),
          effect('reputationDebt', 3, 'delayed', '周边库存和质量会带来兑现压力', 't-touchpoint'),
        ],
        riskPlanIds: ['r12-risk-product'],
        theoryIds: ['t-identity', 't-touchpoint'],
      },
      {
        key: 'platform-growth',
        label: '接受平台的年度增长计划',
        summary: '用更大的流量换下一阶段的规模。',
        detail: '把门店交付、包装和客服先做成标准，再决定接受多少平台曝光，不盲目承诺全国供应。',
        cashCostYuan: 62000,
        actionPointCost: 4,
        durationDays: 15,
        workload: 5,
        primaryBenefit: '知名度与订单规模上升',
        primaryRisk: '渠道依赖和组织压力显著增加',
        evidenceRelations: [ev('r12', 'platform')],
        effects: [
          effect('awareness', 15, 'immediate', '品牌被更大范围看见', 't-growth'),
          effect('channelDependence', 10, 'delayed', '平台规则成为新的经营变量', 't-growth'),
        ],
        riskPlanIds: ['r12-risk-platform'],
        theoryIds: ['t-growth'],
      },
      {
        key: 'loop-back',
        label: '把顾客反馈变成下一年的设计 brief',
        summary: '让每次经营都回到下一次产品和视觉决策。',
        detail:
          '整理顾客、团队和合作方的反馈，形成下一年的品牌简报，而不是凭老板一句“感觉应该升级”。',
        cashCostYuan: 24000,
        actionPointCost: 2,
        durationDays: 7,
        workload: 2,
        primaryBenefit: '洞察、产品和视觉形成闭环',
        primaryRisk: '成果不会立刻带来大声量',
        evidenceRelations: [ev('r12', 'review'), ev('r12', 'feedback')],
        effects: [
          effect('promiseCredibility', 8, 'immediate', '品牌承诺有了持续复盘的依据', 't-insight'),
          effect('differentiation', 6, 'delayed', '反馈闭环帮助下一年找到新差异', 't-insight'),
        ],
        theoryIds: ['t-insight', 't-growth'],
      },
    ],
    evidence: [
      {
        key: 'review',
        title: '一年经营复盘',
        fact: '真正带来复购的不是声量最高的一次活动，而是稳定产品、清楚价格和被记住的服务。',
        implication: '年度选择应该回看系统如何共同工作，而不是只看一个高点。',
        unknown: '下一年顾客关系会不会发生变化。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'steady-renewal',
            relation: 'supports',
            strength: 80,
            explanation: '复盘支持先守住已经成立的关系。',
          },
          {
            choiceKey: 'loop-back',
            relation: 'supports',
            strength: 70,
            explanation: '复盘也支持把经验转成下一年 brief。',
          },
        ],
        theoryIds: ['t-growth', 't-touchpoint'],
      },
      {
        key: 'renew',
        title: '新品意愿测试',
        fact: '顾客欢迎季节变化，但更在意新品是否仍然像这家店、是否会影响熟悉的主打产品。',
        implication: '创新需要保留品牌锚点，不能为了新鲜感切断关系。',
        unknown: '下一季最值得保留的产品线。',
        angle: 'customer',
        relations: [
          {
            choiceKey: 'seasonal-new',
            relation: 'supports',
            strength: 65,
            explanation: '意愿测试支持小规模创新而非全面换代。',
          },
        ],
        theoryIds: ['t-product'],
      },
      {
        key: 'future',
        title: 'IP 带走场景调查',
        fact: '顾客愿意带走小物，但会拒绝与茶饮和老街没有关系的泛周边。',
        implication: 'IP 设计需要明确角色任务和使用场景，库存也属于品牌承诺。',
        unknown: '哪种物件会被长期使用而不是买完闲置。',
        angle: 'visual',
        relations: [
          {
            choiceKey: 'ip-merch',
            relation: 'supports',
            strength: 70,
            explanation: '调查支持做少量有场景的 IP 物件。',
          },
        ],
        theoryIds: ['t-identity', 't-touchpoint'],
      },
      {
        key: 'platform',
        title: '平台年度需求表',
        fact: '平台能带来更大订单，但要求统一规格、快速客服和稳定发货，门店体验不一定能直接复制。',
        implication: '规模机会必须和组织能力、渠道依赖一起评估。',
        unknown: '扩大后品牌是否还能保留地方关系。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'platform-growth',
            relation: 'warns',
            strength: 80,
            explanation: '需求表提醒平台增长会改变交付与关系。',
          },
        ],
        theoryIds: ['t-growth', 't-product'],
      },
      {
        key: 'feedback',
        title: '团队与合作方回访',
        fact: '最有效的改进往往来自跨岗位的小问题：菜单、包装、排班和话术没有对齐。',
        implication: '品牌 brief 不应只写视觉愿景，还要写产品和组织如何兑现。',
        unknown: '下一年最值得优先解决的系统断点。',
        angle: 'delivery',
        relations: [
          {
            choiceKey: 'loop-back',
            relation: 'supports',
            strength: 80,
            explanation: '回访支持把反馈整理成下一年设计 brief。',
          },
        ],
        theoryIds: ['t-insight', 't-growth'],
      },
    ],
    riskPlans: [
      {
        key: 'risk-product',
        label: '给新品或周边设库存上限',
        description: '先限定批量、试销周期和退场条件，避免创新变成现金黑洞。',
        targetRisk: '新项目占压现金和交付',
        cashCostYuan: 5800,
        actionPointCost: 1,
        mitigationRatio: 50,
        theoryIds: ['t-product', 't-growth'],
      },
      {
        key: 'risk-platform',
        label: '先和平台谈清楚可承接范围',
        description: '把订单上限、发货时限和客诉边界写清楚，不用想象中的规模作承诺。',
        targetRisk: '平台增长超过承接能力',
        cashCostYuan: 7000,
        actionPointCost: 1,
        mitigationRatio: 55,
        theoryIds: ['t-growth'],
      },
    ],
  },
];

function event(
  eventId: string,
  triggerRoundId: string,
  choiceId: string,
  title: string,
  text: string,
  theoryId: string,
  effects: V11Effect[],
): V11Event {
  return {
    eventId,
    triggerRoundId,
    eventType: 'choice_triggered',
    title,
    text,
    conditions: [{ type: 'choice_was', choiceId }],
    effects,
    theoryIds: [theoryId],
    sourceNote: '基于本局已提交的经营选择触发；不是脱离状态的随机惩罚。',
  };
}

const termRefsByRound: Record<string, string[]> = {
  r01: ['target-customer', 'segment-fit', 'user-insight', 'conversion', 'loyalty', 'risk-plan'],
  r02: ['brand-positioning', 'differentiation', 'brand-promise'],
  r03: ['delivery'],
  r05: ['brand-personality', 'visual-semantics', 'logo', 'vi', 'ip'],
  r06: ['brand-touchpoint', 'brand-consistency'],
  r07: ['org-capacity'],
  r08: ['visual-recognition', 'visual-adaptability'],
  r09: ['culture-credibility'],
  r10: ['channel-dependence'],
  r11: ['reputation-debt'],
};

const fullRounds = (
  [
    {
      ...expandSliceRound(v11SliceContent.rounds.find((round) => round.roundId === 'r01')!),
      eventIds: ['event-r01-neighbor', 'event-r01-tourist', 'event-r01-hybrid'],
    },
    roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r02')!),
    {
      ...expandSliceRound(v11SliceContent.rounds.find((round) => round.roundId === 'r03')!),
      eventIds: ['event-r03-stable', 'event-r03-complex', 'event-r03-local'],
    },
    roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r04')!),
    roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r05')!),
    roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r06')!),
    roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r07')!),
    {
      ...expandSliceRound(v11SliceContent.rounds.find((round) => round.roundId === 'r08')!),
      eventIds: ['event-r08-line', 'event-r08-symbol', 'event-r08-hand'],
      businessPhase: 'operating',
      fixedCostPerDayYuan: 950,
      baseRevenueYuan: 175000,
    },
    {
      ...roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r09')!),
      visualRequired: true,
      visualTests: [
        {
          testId: 'r09-package-carry',
          title: '拎着走一段',
          prompt: '顾客把包装带出老街后，店名和产品信息还能一眼看清吗？',
          theoryIds: ['t-touchpoint'],
        },
        {
          testId: 'r09-package-wet',
          title: '遇水后还能读',
          prompt: '杯套受潮后，店名、口味和过敏提醒会不会一起糊掉？',
          theoryIds: ['t-touchpoint'],
        },
        {
          testId: 'r09-package-fold',
          title: '折叠后还认得出',
          prompt: '包装被折起、塞进袋子后，顾客还能找到品牌和产品信息吗？',
          theoryIds: ['t-touchpoint'],
        },
        {
          testId: 'r09-package-occlusion',
          title: '被手挡住一半',
          prompt: '顾客拿着杯子时，LOGO 被手遮住一半，剩下的线索还能让人认出你吗？',
          theoryIds: ['t-identity', 't-touchpoint'],
        },
      ],
    },
    roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r10')!),
    {
      ...expandSliceRound(v11SliceContent.rounds.find((round) => round.roundId === 'r11')!),
      eventIds: ['event-r11-community', 'event-r11-platform'],
      businessPhase: 'operating',
      fixedCostPerDayYuan: 1300,
      baseRevenueYuan: 230000,
    },
    roundFromSpec(extendedRoundSpecs.find((round) => round.roundId === 'r12')!),
  ] satisfies V11Round[]
).map((round): V11Round => ({ ...round, termRefs: termRefsByRound[round.roundId] ?? [] }));

const fullEvents: V11Event[] = [
  event(
    'event-r01-neighbor',
    'r01',
    'r01-neighbor',
    '熟客开始认出你',
    '附近住户开始把这家店当作日常路线的一部分。',
    't-segment',
    [effect('loyalty', 3, 'delayed', '熟客关系出现第一点积累', 't-segment')],
  ),
  event(
    'event-r01-tourist',
    'r01',
    'r01-tourist',
    '第一张游客照片传开',
    '游客照片带来注意力，但有人问：除了好拍，还有什么理由再来？',
    't-segment',
    [effect('awareness', 4, 'immediate', '游客传播带来额外注意力', 't-segment')],
  ),
  event(
    'event-r01-hybrid',
    'r01',
    'r01-hybrid',
    '两类顾客都来问了',
    '居民和游客同时出现，团队第一次感到“两边都要”并不轻松。',
    't-segment',
    [effect('orgCapacity', -2, 'delayed', '双线服务让团队出现额外压力', 't-segment')],
  ),
  event(
    'event-r02-anchor',
    'r02',
    'r02-anchor',
    '一句话被记住',
    '顾客终于能用一句自己的话复述品牌在什么时候最有用。',
    't-segment',
    [effect('promiseCredibility', 3, 'delayed', '清楚的定位开始支撑承诺', 't-segment')],
  ),
  event(
    'event-r02-voice',
    'r02',
    'r02-anti-trend',
    '没有追梗也有人转发',
    '一条不靠热词的短句被熟客转给朋友，慢，但更像自己的话。',
    't-segment',
    [effect('differentiation', 3, 'immediate', '独立语气形成一点差异', 't-segment')],
  ),
  event(
    'event-r02-rent',
    'r02',
    'r02-budget-first',
    '价格问题少了一半',
    '店员发现顾客不再反复问“这杯到底为什么这个价”。',
    't-insight',
    [effect('trust', 3, 'delayed', '价格解释减少了不信任', 't-insight')],
  ),
  event(
    'event-r03-stable',
    'r03',
    'r03-stable',
    '高峰少了一点慌乱',
    '稳定的主打产品让新员工知道先把哪几件事做好。',
    't-product',
    [effect('orgCapacity', 3, 'delayed', '流程稳定帮助团队承接', 't-product')],
  ),
  event(
    'event-r03-complex',
    'r03',
    'r03-complex',
    '顾客拍到了，但也等到了',
    '视频里层次漂亮，现场排队也很诚实地出现了。',
    't-product',
    [effect('trust', -4, 'delayed', '等待时间开始影响承诺可信度', 't-product')],
  ),
  event(
    'event-r03-local',
    'r03',
    'r03-local-special',
    '来源被认真追问',
    '顾客开始问茶材来自哪里，团队必须拿出比宣传语更具体的回答。',
    't-product',
    [effect('promiseCredibility', 4, 'delayed', '真实来源让产品承诺更可验证', 't-product')],
  ),
  event(
    'event-r04-daily',
    'r04',
    'r04-everyday-cup',
    '午后回购变得顺手',
    '附近顾客不用重新研究菜单，进店后很快就知道买什么。',
    't-product',
    [effect('loyalty', 3, 'delayed', '日常产品形成复购习惯', 't-product')],
  ),
  event(
    'event-r04-gift',
    'r04',
    'r04-gift-box',
    '礼盒被带去见朋友',
    '礼盒的地方说明让顾客有了送礼时可以讲的一句话。',
    't-product',
    [effect('awareness', 4, 'immediate', '礼赠场景带来额外传播', 't-product')],
  ),
  event(
    'event-r04-reuse',
    'r04',
    'r04-refill',
    '回收箱需要有人照看',
    '环保承诺被顾客认真执行，也把清洁和补充的工作推到台前。',
    't-product',
    [effect('orgCapacity', -3, 'delayed', '回收流程增加组织工作', 't-product')],
  ),
  event(
    'event-r05-word',
    'r05',
    'r05-plain-word',
    '店名在远处被读出来',
    '路人没有停下拍照，但能准确说出这是一家卖茶饮的店。',
    't-identity',
    [effect('conversion', 3, 'immediate', '清楚识别提高进入门店的可能', 't-identity')],
  ),
  event(
    'event-r05-mountain',
    'r05',
    'r05-mountain-mark',
    '山形撞车了',
    '顾客说“这条街好几家都像这样”，设计师开始重新寻找组合差异。',
    't-identity',
    [effect('differentiation', -3, 'delayed', '通用符号带来同质化压力', 't-identity')],
  ),
  event(
    'event-r05-character',
    'r05',
    'r05-tea-character',
    'IP 开始被顾客叫出名字',
    '角色在杯套上有了自己的称呼，但团队也收到更多使用需求。',
    't-identity',
    [effect('awareness', 4, 'immediate', 'IP带来额外识别', 't-identity')],
  ),
  event(
    'event-r06-street',
    'r06',
    'r06-streetboard',
    '门口少了几次犹豫',
    '新的店招和菜单让路人更快明白这家店的产品和价格。',
    't-touchpoint',
    [effect('conversion', 3, 'immediate', '入口信息减少了犹豫', 't-touchpoint')],
  ),
  event(
    'event-r06-video',
    'r06',
    'r06-shortvideo',
    '评论区开始追问细节',
    '视频的热度来了，价格和等待时间的问题也一起涌进来。',
    't-growth',
    [effect('reputationDebt', 2, 'delayed', '传播放大了未兑现的细节', 't-growth')],
  ),
  event(
    'event-r06-partner',
    'r06',
    'r06-partner-host',
    '民宿老板来复查',
    '合作方带着顾客来店里，顺便检查推荐卡上写的承诺是否真的成立。',
    't-growth',
    [effect('trust', 3, 'delayed', '合作场景验证了品牌可信度', 't-growth')],
  ),
  event(
    'event-r07-script',
    'r07',
    'r07-greeting-script',
    '新店员没有念错品牌话',
    '轻量提示帮新人找到语气，但真正的自然感仍然要靠练习。',
    't-touchpoint',
    [effect('brandConsistency', 3, 'immediate', '服务语气更容易保持一致', 't-touchpoint')],
  ),
  event(
    'event-r07-express',
    'r07',
    'r07-express-line',
    '高峰终于能转身',
    '顾客排队时间缩短，店员有余力回应真正需要帮助的人。',
    't-product',
    [effect('trust', 3, 'delayed', '稳定交付增加信任', 't-product')],
  ),
  event(
    'event-r07-gift',
    'r07',
    'r07-gift-service',
    '杯套跟着顾客上了车',
    '顾客把包装带出老街，朋友先看见了那句交接时的品牌话。',
    't-touchpoint',
    [effect('awareness', 3, 'immediate', '包装触点带来新的看见', 't-touchpoint')],
  ),
  event(
    'event-r08-line',
    'r08',
    'r08-line',
    '一套规则开始工作',
    '招牌、杯套和社交头像虽然尺寸不同，却仍然像同一家店。',
    't-touchpoint',
    [effect('brandConsistency', 4, 'delayed', '视觉系统开始支撑多个触点', 't-touchpoint')],
  ),
  event(
    'event-r08-symbol',
    'r08',
    'r08-symbol',
    '第一眼很像老街，但还不够像你',
    '地方联想很快建立，顾客却需要更多线索分辨你和邻店。',
    't-identity',
    [effect('differentiation', -3, 'delayed', '视觉同质化继续积累', 't-touchpoint')],
  ),
  event(
    'event-r08-hand',
    'r08',
    'r08-hand',
    '手写留言越来越多',
    '顾客愿意参与，但团队开始需要决定哪些字形和语气可以长期保留。',
    't-touchpoint',
    [effect('loyalty', 3, 'delayed', '参与感带来关系积累', 't-touchpoint')],
  ),
  event(
    'event-r09-stamp',
    'r09',
    'r09-stamp',
    '有人专程回来盖章',
    '印章没有制造大促销，却让熟客多了一次回到老街的理由。',
    't-touchpoint',
    [effect('loyalty', 4, 'immediate', '可收集关系提高复购', 't-touchpoint')],
  ),
  event(
    'event-r09-stories',
    'r09',
    'r09-stories',
    '顾客说出了自己的品牌版本',
    '用户故事让品牌更有人味，也提醒团队核心承诺不能在转述中消失。',
    't-touchpoint',
    [effect('trust', 3, 'delayed', '真实叙事增加关系信任', 't-touchpoint')],
  ),
  event(
    'event-r09-feedback',
    'r09',
    'r09-feedback-table',
    '差评变成了改进清单',
    '团队没有把差评藏起来，而是先修了等待和包装两个具体问题。',
    't-insight',
    [effect('productDelivery', 4, 'delayed', '反馈进入流程后交付改善', 't-product')],
  ),
  event(
    'event-r10-second',
    'r10',
    'r10-second-counter',
    '第二个窗口开始问同样的问题',
    '新点位复制了招牌，却还没有复制团队处理异常的能力。',
    't-growth',
    [effect('orgCapacity', -4, 'delayed', '扩张放大组织短板', 't-growth')],
  ),
  event(
    'event-r10-hotel',
    'r10',
    'r10-wholesale',
    '酒店客人带走了来源说明',
    '小批量供货让品牌进入了一个新的旅行触点，但每周交付不能出错。',
    't-growth',
    [effect('awareness', 4, 'immediate', '酒店场景带来新客看见', 't-growth')],
  ),
  event(
    'event-r10-co-brand',
    'r10',
    'r10-co-brand',
    '联名礼盒被一起讨论',
    '顾客喜欢两家店的组合，也开始追问出了问题到底找谁。',
    't-growth',
    [
      effect(
        'reputationDebt',
        3,
        'delayed',
        '礼盒漏液或迟到时，顾客会把责任算在两家店头上',
        't-growth',
      ),
    ],
  ),
  event(
    'event-r11-community',
    'r11',
    'r11-community',
    '老客把朋友带来了',
    '社区关系没有爆炸式增长，却带来了更容易被服务的新顾客。',
    't-growth',
    [effect('loyalty', 4, 'delayed', '稳定关系推动自然复购', 't-growth')],
  ),
  event(
    'event-r11-platform',
    'r11',
    'r11-platform',
    '平台订单像潮水一样来',
    '订单增长很漂亮，店员的出杯、打包和客诉清单也一下排满了。',
    't-growth',
    [effect('orgCapacity', -5, 'delayed', '平台增长放大组织压力', 't-growth')],
  ),
  event(
    'event-r12-steady',
    'r12',
    'r12-steady-renewal',
    '品牌没有被自己吓到',
    '团队删掉了一些热闹项目，把时间留给真正被顾客依赖的体验。',
    't-growth',
    [effect('brandConsistency', 4, 'delayed', '克制让系统更一致', 't-touchpoint')],
  ),
  event(
    'event-r12-platform',
    'r12',
    'r12-platform-growth',
    '下一年合同送来了',
    '更大的机会出现了，但它要求品牌先回答能不能稳定兑现。',
    't-growth',
    [effect('awareness', 4, 'immediate', '增长机会带来额外声量', 't-growth')],
  ),
];

const priceBaseline = [
  {
    priceId: 'price-tea-cup',
    item: '日常茶饮单杯',
    amountYuan: 18,
    source: '课程前测：同类门店菜单采样',
    asOf: '2026-08-27',
    note: '用于日常杯装的教学基准，不代表真实商户报价。',
  },
  {
    priceId: 'price-signature-cup',
    item: '招牌茶饮单杯',
    amountYuan: 28,
    source: '课程前测：同类门店菜单采样',
    asOf: '2026-08-27',
    note: '用于比较产品体验与溢价解释。',
  },
  {
    priceId: 'price-gift-box',
    item: '地方茶饮礼盒',
    amountYuan: 68,
    source: '课程假设：小批量礼赠包装测算',
    asOf: '2026-08-27',
    note: '需随包装结构与批量重新核价。',
  },
  {
    priceId: 'price-packaging',
    item: '杯套与外带包装',
    amountYuan: 3,
    source: '课程假设：基础包材询价区间',
    asOf: '2026-08-27',
    note: '不含特殊印刷和结构设计。',
  },
  {
    priceId: 'price-ip-sticker',
    item: 'IP贴纸小物',
    amountYuan: 6,
    source: '课程假设：小批量印刷测算',
    asOf: '2026-08-27',
    note: '用于讨论IP触点的成本边界。',
  },
  {
    priceId: 'price-refill',
    item: '补充装服务',
    amountYuan: 12,
    source: '课程假设：复用容器试运行',
    asOf: '2026-08-27',
    note: '需同时计入清洁与回收工作量。',
  },
  {
    priceId: 'price-event',
    item: '快闪活动单日物料',
    amountYuan: 8000,
    source: '课程假设：小型活动物料预算',
    asOf: '2026-08-27',
    note: '不含场地租金与临时人力。',
  },
  {
    priceId: 'price-video',
    item: '短视频小组制作',
    amountYuan: 5000,
    source: '课程假设：轻量内容制作预算',
    asOf: '2026-08-27',
    note: '不等同于购买平台流量。',
  },
  {
    priceId: 'price-workshop',
    item: '小型茶饮体验活动',
    amountYuan: 3500,
    source: '课程假设：小规模体验活动预算',
    asOf: '2026-08-27',
    note: '用于讨论关系经营的时间成本。',
  },
  {
    priceId: 'price-partner',
    item: '合作渠道物料',
    amountYuan: 2500,
    source: '课程假设：民宿与街区推荐物料',
    asOf: '2026-08-27',
    note: '合作关系还需要服务标准。',
  },
  {
    priceId: 'price-second-counter',
    item: '第二个窗口启动投入',
    amountYuan: 52000,
    source: '课程假设：轻量窗口复制测算',
    asOf: '2026-08-27',
    note: '不含完整新店装修。',
  },
  {
    priceId: 'price-platform',
    item: '平台年度增长准备',
    amountYuan: 62000,
    source: '课程假设：渠道与包装标准化准备',
    asOf: '2026-08-27',
    note: '必须和交付能力、渠道费用一起评估。',
  },
];

const referencedAssetKeys = [
  ...new Set([
    ...v11SliceContent.onboardingSlides.map((slide) => slide.imageKey),
    ...fullRounds.flatMap((round) => [
      round.briefing.imageKey,
      round.resultPresentation.resultArtKey,
      ...round.choices.map((item) => item.resultArtKey),
    ]),
  ]),
];

const assetManifest = [
  {
    assetKey: 'asset-placeholder',
    assetType: 'icon' as const,
    fallbackKey: 'asset-placeholder',
    width: 240,
    height: 160,
    priority: 'critical' as const,
  },
  {
    assetKey: 'scene-atlas.svg',
    assetType: 'scene' as const,
    fallbackKey: 'asset-placeholder',
    width: 640,
    height: 420,
    priority: 'critical' as const,
  },
  ...['visual-wordmark.svg', 'visual-symbol.svg', 'visual-ip.svg'].map((assetKey) => ({
    assetKey,
    assetType: 'visual' as const,
    fallbackKey: 'asset-placeholder',
    width: 1200,
    height: 800,
    priority: 'critical' as const,
  })),
  ...referencedAssetKeys.map((assetKey) => ({
    assetKey,
    assetType:
      assetKey.startsWith('briefing-') || assetKey.startsWith('onboarding-')
        ? ('scene' as const)
        : ('result' as const),
    fallbackKey: 'asset-placeholder',
    width: 1200,
    height: 800,
    priority:
      assetKey.startsWith('briefing-') || assetKey.startsWith('onboarding-')
        ? ('critical' as const)
        : ('normal' as const),
    recipe: {
      baseKey: 'scene-atlas.svg',
      overlayKeys: [assetKey],
    },
  })),
];

const fullEndings: V11Ending[] = [
  {
    endingId: 'e-everyday-trust',
    title: '把日常做到值得再来',
    description: '顾客不一定天天发朋友圈，但知道这家店会稳定地把一杯茶做好。',
    conditions: [
      { type: 'choice_was', choiceId: 'r03-stable' },
      { type: 'metric_at_least', key: 'productDelivery', value: 45 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-hybrid-schedule',
    title: '两段时间，两种招呼',
    description: '你没有强迫所有顾客用同一种方式买茶，而是把不同场景安排进同一家店。',
    conditions: [
      { type: 'choice_was', choiceId: 'r01-hybrid' },
      { type: 'metric_at_least', key: 'orgCapacity', value: 35 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-culture-gift',
    title: '一盒茶，把地方带出去',
    description: '礼盒让地方故事有了可以带走的形状，也让包装承担了更多解释工作。',
    conditions: [
      { type: 'choice_was', choiceId: 'r04-gift-box' },
      { type: 'metric_at_least', key: 'culturalCredibility', value: 35 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-reuse-loop',
    title: '把环保做成日常动作',
    description: '复用方案让承诺更具体，但清洁、回收和补充也变成了每天要做的工作。',
    conditions: [
      { type: 'choice_was', choiceId: 'r04-refill' },
      { type: 'metric_at_least', key: 'trust', value: 35 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-clear-signature',
    title: '先让人认出你',
    description: '店名和产品先说清楚，顾客不必猜这家店卖什么、适不适合自己。',
    conditions: [
      { type: 'choice_was', choiceId: 'r05-plain-word' },
      { type: 'metric_at_least', key: 'visualRecognition', value: 25 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-symbol-memory',
    title: '一个符号，留下一个联想',
    description: '符号让品牌更容易被远远认出，但还需要持续补足“为什么是你”的理由。',
    conditions: [
      { type: 'choice_was', choiceId: 'r08-symbol' },
      { type: 'metric_at_least', key: 'visualRecognition', value: 30 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-ip-companion',
    title: '让角色陪顾客走一段',
    description: 'IP 不只是贴在杯套上的图，它开始承担提醒、互动和被顾客叫出名字的任务。',
    conditions: [
      { type: 'choice_was', choiceId: 'r05-tea-character' },
      { type: 'metric_at_least', key: 'visualRecognition', value: 25 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-touchpoint-system',
    title: '不是一张海报，是一套系统',
    description: '店招、杯身、包装和头像换了尺寸，顾客仍能认出这是同一家店。',
    conditions: [
      { type: 'choice_was', choiceId: 'r08-line' },
      { type: 'metric_at_least', key: 'visualAdaptability', value: 30 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-feedback-learner',
    title: '把差评变成下一张清单',
    description: '你没有只追求好听的评价，而是把等待和包装等具体问题带回了经营。',
    conditions: [
      { type: 'choice_was', choiceId: 'r09-feedback-table' },
      { type: 'metric_at_least', key: 'productDelivery', value: 45 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-community-stories',
    title: '顾客替你讲出自己的版本',
    description: '顾客故事让品牌更有人味，也提醒团队不能把核心承诺讲丢。',
    conditions: [
      { type: 'choice_was', choiceId: 'r09-stories' },
      { type: 'metric_at_least', key: 'loyalty', value: 15 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-partner-network',
    title: '把老街装进更多行程',
    description: '合作渠道带来新的旅行触点，但每周供货和承诺交接都不能掉链子。',
    conditions: [
      { type: 'choice_was', choiceId: 'r10-wholesale' },
      { type: 'metric_at_least', key: 'awareness', value: 20 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-careful-expansion',
    title: '先把一间店站稳',
    description: '你把时间留给现有顾客和团队，增长慢一点，但每个承诺更容易被接住。',
    conditions: [
      { type: 'choice_was', choiceId: 'r10-one-store' },
      { type: 'metric_at_least', key: 'orgCapacity', value: 45 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-platform-operator',
    title: '流量来了，先学会接单',
    description: '平台让更多人看见品牌，也把出杯、打包和客诉变成了同一张经营考卷。',
    conditions: [
      { type: 'choice_was', choiceId: 'r11-platform' },
      { type: 'metric_at_least', key: 'awareness', value: 25 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-limited-campaign',
    title: '热闹只开一阵子',
    description: '限量活动制造了期待，你也给团队留下了收尾和复盘的空间。',
    conditions: [
      { type: 'choice_was', choiceId: 'r11-limited-drop' },
      { type: 'metric_at_least', key: 'awareness', value: 20 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  {
    endingId: 'e-renewal-loop',
    title: '明年继续，但先删掉多余的',
    description: '你把顾客真正依赖的体验留下，把只制造忙乱的项目放回了计划之外。',
    conditions: [
      { type: 'choice_was', choiceId: 'r12-steady-renewal' },
      { type: 'metric_at_least', key: 'trust', value: 45 },
    ],
    minimumRoundsRequired: 3,
    minimumDimensionsRequired: 2,
    fallback: false,
  },
  // Keep the three slice endings as broad fallback routes. The more specific
  // v1.2 endings stay first so a player's distinctive decision is still
  // reflected when several conditions are true at the same time.
  ...v11SliceContent.endings,
];

export const v11FullContent = validateV11Content({
  ...v11SliceContent,
  rounds: fullRounds,
  events: fullEvents,
  priceBaseline,
  assetManifest,
  endings: fullEndings,
  termGlossary: [
    {
      termId: 'target-customer',
      label: '目标顾客',
      firstUseRoundId: 'r01',
      plainDefinition: '你最想先服务、也最有能力服务好的一群人。',
      inGameMeaning: '选谁会影响产品、价格、服务和传播先做什么。',
      example: '先让附近居民每天顺手买到，再考虑游客拍照传播。',
      relatedMetricKeys: ['segmentFit', 'conversion'],
      relatedTheoryIds: ['t-segment'],
    },
    {
      termId: 'segment-fit',
      label: '人群匹配',
      firstUseRoundId: 'r01',
      plainDefinition: '产品、价格和表达是否真的适合那群顾客。',
      inGameMeaning: '它高，说明顾客更容易觉得这家店是为自己准备的。',
      example: '通勤客需要快取，游客需要看得懂地方来源。',
      relatedMetricKeys: ['segmentFit'],
      relatedTheoryIds: ['t-segment'],
    },
    {
      termId: 'user-insight',
      label: '用户洞察',
      firstUseRoundId: 'r01',
      plainDefinition: '能改变决定的顾客真实行为，不是一句好听评价。',
      inGameMeaning: '调查要带回这种事实，才值得花行动力。',
      example: '居民午后十分钟内买完，游客愿意为可带走的故事停留。',
      relatedMetricKeys: ['segmentFit', 'conversion'],
      relatedTheoryIds: ['t-insight'],
    },
    {
      termId: 'conversion',
      label: '购买转化',
      firstUseRoundId: 'r01',
      plainDefinition: '看见或感兴趣的人里，最后真的下单的人有多少。',
      inGameMeaning: '它反映顾客是否能迅速理解产品、价格和购买方法。',
      example: '菜单太复杂，很多人看过后就离开，转化会下降。',
      relatedMetricKeys: ['conversion'],
      relatedTheoryIds: ['t-segment'],
    },
    {
      termId: 'loyalty',
      label: '复购',
      firstUseRoundId: 'r01',
      plainDefinition: '买过的人愿不愿意再回来。',
      inGameMeaning: '稳定产品和可信服务会让复购慢慢积累。',
      example: '熟客知道每周都能喝到同一杯合适的茶。',
      relatedMetricKeys: ['loyalty'],
      relatedTheoryIds: ['t-segment'],
    },
    {
      termId: 'risk-plan',
      label: '风险预案',
      firstUseRoundId: 'r01',
      plainDefinition: '问题发生前，先花资源准备一套应对办法。',
      inGameMeaning: '它不能消除所有风险，但能在问题出现时减轻损失。',
      example: '先写清双线产品各自不做什么，避免高峰期两头忙乱。',
      relatedMetricKeys: ['reputationDebt', 'orgCapacity'],
      relatedTheoryIds: ['t-growth'],
    },
    {
      termId: 'brand-positioning',
      label: '品牌定位',
      firstUseRoundId: 'r02',
      plainDefinition: '顾客在几家店之间选择时，为什么会先想到你。',
      inGameMeaning: '定位会约束你对谁说话、卖什么和承诺什么。',
      example: '工作日下午五分钟拿到一杯稳定的老街茶。',
      relatedMetricKeys: ['segmentFit', 'differentiation'],
      relatedTheoryIds: ['t-segment'],
    },
    {
      termId: 'differentiation',
      label: '差异化',
      firstUseRoundId: 'r02',
      plainDefinition: '顾客能否用一句具体的话说出你和隔壁店不同。',
      inGameMeaning: '差异不是更复杂，而是让人明白为何要选你。',
      example: '不是“有文化”，而是“能带走真实茶材来源的一杯茶”。',
      relatedMetricKeys: ['differentiation'],
      relatedTheoryIds: ['t-segment'],
    },
    {
      termId: 'brand-promise',
      label: '品牌承诺',
      firstUseRoundId: 'r02',
      plainDefinition: '顾客每次来，都能期待你稳定做到的事。',
      inGameMeaning: '你说得再好，产品、价格和服务也要一起做得到。',
      example: '“工作日下午，五分钟拿到一杯稳定的茶。”',
      relatedMetricKeys: ['promiseCredibility', 'trust'],
      relatedTheoryIds: ['t-segment', 't-product'],
    },
    {
      termId: 'delivery',
      label: '交付能力',
      firstUseRoundId: 'r03',
      plainDefinition: '店里能否按时、稳定地把产品和服务做出来。',
      inGameMeaning: '复杂产品和高峰订单都会考验它。',
      example: '一杯茶需要七个步骤，排队时是否还能按时交到顾客手上。',
      relatedMetricKeys: ['productDelivery'],
      relatedTheoryIds: ['t-product'],
    },
    {
      termId: 'brand-personality',
      label: '品牌人格',
      firstUseRoundId: 'r05',
      plainDefinition: '如果品牌像一个人，它会怎样说话和待客。',
      inGameMeaning: '它会影响店员语气、包装文字和顾客感到的距离。',
      example: '松弛、可靠、有一点幽默，而不是每次换一种口气。',
      relatedMetricKeys: ['brandConsistency', 'trust'],
      relatedTheoryIds: ['t-identity'],
    },
    {
      termId: 'visual-semantics',
      label: '视觉语义',
      firstUseRoundId: 'r05',
      plainDefinition: '顾客从颜色、字体和图形里读到的感觉。',
      inGameMeaning: '画面不只好不好看，也会让人猜测价格、气质和服务方式。',
      example: '手写字可能显得亲切，也可能让人觉得不够利落。',
      relatedMetricKeys: ['visualRecognition', 'differentiation'],
      relatedTheoryIds: ['t-identity', 't-touchpoint'],
    },
    {
      termId: 'logo',
      label: 'LOGO',
      firstUseRoundId: 'r05',
      plainDefinition: '让顾客认出品牌的核心标志。',
      inGameMeaning: '它要在店招、杯身和手机头像上都能被读出来。',
      example: '可以是文字、图形，或两者组合。',
      relatedMetricKeys: ['visualRecognition'],
      relatedTheoryIds: ['t-identity'],
    },
    {
      termId: 'vi',
      label: 'VI',
      firstUseRoundId: 'r05',
      plainDefinition: '让不同触点看起来像同一品牌的一套规则。',
      inGameMeaning: '它规定 LOGO、颜色、字体和版式怎样一起使用。',
      example: '店招、杯套、菜单和头像不用长得一模一样，但要认得出是一家。',
      relatedMetricKeys: ['brandConsistency', 'visualAdaptability'],
      relatedTheoryIds: ['t-touchpoint'],
    },
    {
      termId: 'ip',
      label: 'IP',
      firstUseRoundId: 'r05',
      plainDefinition: '有固定身份和任务的品牌角色。',
      inGameMeaning: '它可以帮包装和互动被记住，但不是随便加一个卡通图。',
      example: '角色的表情、动作和出现位置要有规则，也要有人持续维护。',
      relatedMetricKeys: ['visualRecognition', 'orgCapacity'],
      relatedTheoryIds: ['t-identity', 't-touchpoint'],
    },
    {
      termId: 'brand-touchpoint',
      label: '品牌触点',
      firstUseRoundId: 'r06',
      plainDefinition: '顾客遇见品牌的地方。',
      inGameMeaning: '每个触点都要让顾客看懂同一个产品和承诺。',
      example: '店招、杯身、包装、菜单和手机头像都是触点。',
      relatedMetricKeys: ['awareness', 'brandConsistency'],
      relatedTheoryIds: ['t-touchpoint'],
    },
    {
      termId: 'brand-consistency',
      label: '品牌一致性',
      firstUseRoundId: 'r06',
      plainDefinition: '顾客在不同地方遇见你时，仍认得出是同一家店。',
      inGameMeaning: '视觉、产品和服务说法不打架，才会让人信任。',
      example: '海报说亲切，店员忙时也不能只剩冷冰冰的指令。',
      relatedMetricKeys: ['brandConsistency', 'trust'],
      relatedTheoryIds: ['t-touchpoint'],
    },
    {
      termId: 'org-capacity',
      label: '组织承接力',
      firstUseRoundId: 'r07',
      plainDefinition: '订单增加后，人手、供货和客服能不能接得住。',
      inGameMeaning: '它决定增长是否会变成排队、错单和抱怨。',
      example: '短视频火了以后，谁出杯、谁处理客诉、谁补货。',
      relatedMetricKeys: ['orgCapacity', 'productDelivery'],
      relatedTheoryIds: ['t-growth'],
    },
    {
      termId: 'visual-recognition',
      label: '视觉识别',
      firstUseRoundId: 'r08',
      plainDefinition: '顾客能否很快看见、读懂并记住你的品牌。',
      inGameMeaning: '它先看清不清楚，再谈好不好看。',
      example: '远看店招、缩成头像、被手挡住后还能认出来。',
      relatedMetricKeys: ['visualRecognition'],
      relatedTheoryIds: ['t-identity'],
    },
    {
      termId: 'visual-adaptability',
      label: '视觉适配',
      firstUseRoundId: 'r08',
      plainDefinition: '同一套设计放进不同地方后，是否仍清楚好用。',
      inGameMeaning: '它避免一张大海报好看，杯套和头像却失效。',
      example: '杯套侧面被手遮住时，店名和图形还能不能读懂。',
      relatedMetricKeys: ['visualAdaptability', 'brandConsistency'],
      relatedTheoryIds: ['t-touchpoint'],
    },
    {
      termId: 'culture-credibility',
      label: '文化可信度',
      firstUseRoundId: 'r09',
      plainDefinition: '顾客是否相信你的地方故事有真实材料和做法支撑。',
      inGameMeaning: '它来自茶材、来源和服务中的真实细节。',
      example: '店员能说明茶从哪里来，而不是只贴一张山水图。',
      relatedMetricKeys: ['culturalCredibility', 'trust'],
      relatedTheoryIds: ['t-insight'],
    },
    {
      termId: 'channel-dependence',
      label: '渠道依赖',
      firstUseRoundId: 'r10',
      plainDefinition: '订单越依赖一个平台或伙伴，越会受它的规则影响。',
      inGameMeaning: '增长带来订单，也可能带来抽成、交付和客诉压力。',
      example: '平台一改配送规则，菜单、包装和利润都要跟着变。',
      relatedMetricKeys: ['channelDependence', 'orgCapacity'],
      relatedTheoryIds: ['t-growth'],
    },
    {
      termId: 'reputation-debt',
      label: '声誉负债',
      firstUseRoundId: 'r11',
      plainDefinition: '已经说出去、却还没稳定做到的承诺。',
      inGameMeaning: '积得越多，顾客失望时反弹越明显。',
      example: '宣传五分钟出杯，高峰期却让顾客等二十分钟。',
      relatedMetricKeys: ['reputationDebt', 'trust'],
      relatedTheoryIds: ['t-growth'],
    },
  ],
  achievements: [
    ...v11SliceContent.achievements,
    {
      achievementId: 'a-ask-before-claim',
      title: '听清顾客再定方向',
      description: '你把居民和游客的真实需求带进了定位判断。',
      conditions: [{ type: 'evidence_viewed', evidenceId: 'ev-r02-audience' }],
      reasonTemplate: '你先听清不同顾客为什么进店，再决定这家店先解决谁的问题。',
    },
    {
      achievementId: 'a-product-reality',
      title: '高峰期还能做出来',
      description: '你先确认了产品在忙时能不能稳定交付。',
      conditions: [{ type: 'evidence_viewed', evidenceId: 'ev-r03-queue' }],
      reasonTemplate: '你没有只看产品好不好拍，也看见了高峰期每杯多一步会带来什么。',
    },
    {
      achievementId: 'a-promise-kept',
      title: '每杯都按说好的做',
      description: '你选了顾客和店员都能长期做到的产品路线。',
      conditions: [{ type: 'choice_was', choiceId: 'r03-stable' }],
      reasonTemplate: '你让菜单上的话先在产品和出杯速度里站住。',
    },
    {
      achievementId: 'a-identity-conscious',
      title: '店名在小屏上也读得清',
      description: '你选了能从店招用到手机头像的识别方式。',
      conditions: [{ type: 'choice_was', choiceId: 'r05-plain-word' }],
      reasonTemplate: '你先保证顾客看得清店名，再增加装饰。',
    },
    {
      achievementId: 'a-queue-respect',
      title: '高峰期少等一会',
      description: '你为排队时的顾客做了明确取舍。',
      conditions: [{ type: 'choice_was', choiceId: 'r07-express-line' }],
      reasonTemplate: '你把店员的时间留给真正需要帮助的人，没有让顾客一直干等。',
    },
    {
      achievementId: 'a-system-not-poster',
      title: '招牌和杯子认得出同一家',
      description: '你选了能在多个真实地方使用的视觉路线。',
      conditions: [{ type: 'choice_was', choiceId: 'r08-line' }],
      reasonTemplate: '店招、杯身、包装和头像换了尺寸，顾客还是认得出你。',
    },
    {
      achievementId: 'a-relationship-builder',
      title: '让熟客说出自己的故事',
      description: '你让顾客的真实经历进入了店里的表达。',
      conditions: [{ type: 'choice_was', choiceId: 'r09-stories' }],
      reasonTemplate: '你没有把顾客只当成流量，而是让他们说出为什么愿意带朋友来。',
    },
    {
      achievementId: 'a-growth-brake',
      title: '订单多了也不乱',
      description: '你在增长时先留住了老客和交付质量。',
      conditions: [{ type: 'choice_was', choiceId: 'r11-steady' }],
      reasonTemplate: '你没有把每次热度都当成加速信号，而是先看店里能不能接住。',
    },
    {
      achievementId: 'a-next-year-brief',
      title: '留下一张明年的清单',
      description: '你把下一年的产品和设计工作排出了先后。',
      conditions: [{ type: 'choice_was', choiceId: 'r12-seasonal-new' }],
      reasonTemplate: '你把今年留下的经验，变成了下一年可以逐项完成的事。',
    },
  ],
  // Publish only the three approved routes. Exploratory artwork is not part
  // of the player choice pool or production statistics.
  visualSystems: v11SliceContent.visualSystems,
});
