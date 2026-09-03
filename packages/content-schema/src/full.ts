import { sampleContent } from './sample.js';
import { validateContent, type Choice, type Effect, type MetricKey, type Round } from './index.js';

const fx = (
  key: MetricKey,
  amount: number,
  timing: Effect['timing'],
  label: string,
  theoryId: string,
): Effect => ({
  key,
  amount,
  timing,
  label,
  theoryId,
});

const choiceSet = (
  roundId: string,
  theoryId: string,
  labels: readonly string[],
  primary: MetricKey,
  secondary: MetricKey,
): Choice[] =>
  labels.map((label, index) => {
    const positive = 5 + (index % 3) * 2;
    const tradeoff = index % 2 === 0 ? -3 : -5;
    return {
      choiceId: `${roundId}-alt-${index + 1}`,
      label,
      temptation: index % 2 === 0 ? '看起来更快、更有话题。' : '需要多做一点解释和准备。',
      statedBenefit: `${primary} 会得到一段时间的改善。`,
      statedConcern: `${secondary} 可能因此承受压力。`,
      effects: [
        fx(primary, positive, 'immediate', `${primary} 的短期变化`, theoryId),
        fx(secondary, tradeoff, 'delayed', `${secondary} 的后续代价`, theoryId),
      ],
      conditions: [],
      consequenceText: `${label} 让团队获得了一个清晰的方向，但也留下了需要补课的地方。`,
      theoryIds: [theoryId],
    };
  });

const evidence = (roundId: string, title: string, body: string, theoryId: string, cost: number) => [
  {
    evidenceId: `ev-${roundId}-field`,
    title,
    body,
    cost,
    theoryIds: [theoryId],
  },
];

const newRound = (
  roundId: string,
  chapterId: string,
  title: string,
  goal: string,
  openingScene: string,
  theoryId: string,
  primary: MetricKey,
  secondary: MetricKey,
  labels: readonly string[],
  visualRequired = false,
): Round => ({
  roundId,
  chapterId,
  title,
  goal,
  openingScene,
  visualRequired,
  evidence: evidence(
    roundId,
    '一次现场访谈',
    `你从现场得到了一条不能只凭直觉判断的信息：${goal}`,
    theoryId,
    6 + (Number(roundId.slice(1)) % 7),
  ),
  choices: choiceSet(roundId, theoryId, labels, primary, secondary),
  visualTests: [],
  eventIds: [],
  theoryIds: [theoryId],
});

const newRounds: Round[] = [
  newRound(
    'r02',
    'c1',
    '先去问，不要猜',
    '把模糊的喜欢变成可验证的需求。',
    '你在老街摆了一个小桌子。路人愿意聊天，但每个人说的“喜欢茶”都不一样。',
    't-research',
    'segmentFit',
    'actionPoints',
    [
      '做三次短访谈再定方向',
      '先发问卷，样本越大越安心',
      '凭自己的生活经验直接决定',
      '请店员讲他们看到的客人',
      '先观察不提问，避免打扰游客',
    ],
  ),
  newRound(
    'r03',
    'c1',
    '一杯茶的理由',
    '把洞察收敛成可被购买的产品概念。',
    '访谈记录里有十几个愿望：清醒、解渴、送礼、拍照、坐一会儿。菜单不能同时满足全部愿望。',
    't-concept',
    'conversion',
    'cash',
    [
      '先做一个通勤提神的单品',
      '把地方茶做成伴手礼',
      '做一杯最适合拍照分享的饮品',
      '做一个可以坐下来慢慢喝的组合',
      '每个愿望都做一款，先把选择交给顾客',
    ],
  ),
  newRound(
    'r04',
    'c1',
    '名字不是口号',
    '让命名、品类和品牌承诺指向同一件事。',
    '你有三个名字：一个很诗意，一个很直白，一个像朋友的外号。大家喜欢的原因完全不同。',
    't-name',
    'brandConsistency',
    'promiseCredibility',
    [
      '选择一眼能说清品类的名字',
      '选择最有古意、最像地方传说的名字',
      '选择容易被朋友叫出口的名字',
      '先注册最安全的通用名字',
      '把产品核心动作做成品牌名',
    ],
  ),
  newRound(
    'r06',
    'c2',
    '位置和价格会说话',
    '让定位在空间和价格上变得可感知。',
    '店铺位置不在最热闹的入口。你可以用价格、份量和服务速度去吸引不同的人。',
    't-position',
    'segmentFit',
    'cash',
    [
      '做日常价，让附近人可以反复购买',
      '做高价限量，把稀缺感放在第一位',
      '用双层产品同时覆盖两种人',
      '先做联名套餐，借别人的客流',
      '保持低价，但把空间体验做精致',
    ],
  ),
  newRound(
    'r07',
    'c2',
    'IP不是吉祥物',
    '决定一个 IP 在品牌关系中真正承担什么任务。',
    '插画师画了一只很可爱的“老街小茶客”。问题是：它除了可爱，还要替品牌做什么？',
    't-ip',
    'loyalty',
    'brandConsistency',
    [
      '让 IP 成为新客识别入口',
      '让 IP 负责解释茶的产地与做法',
      '让 IP 只在会员和包装上出现',
      '让 IP 参与城市漫游和打卡任务',
      '先不做 IP，把预算放回产品体验',
    ],
  ),
  newRound(
    'r09',
    'c3',
    '杯子会离店',
    '让包装在使用、携带和分享中继续传达品牌。',
    '第一批杯套离开老街后被放在汽车、办公室和垃圾桶旁。设计师问：包装要服务谁的下一步动作？',
    't-packaging',
    'visualAdaptability',
    'cash',
    [
      '优先让杯子在手机照片里保持识别',
      '优先降低材料和印刷成本',
      '加上可撕下收藏的地方故事',
      '让包装成为二次使用的小容器',
      '把所有信息都放上去，避免浪费版面',
    ],
  ),
  newRound(
    'r10',
    'c4',
    '谁在替你说话',
    '理解社群、平台和老客之间的关系。',
    '一位本地摄影师主动发帖，平台也提出投放合作。两种传播都能带来人，但带来的期待不同。',
    't-community',
    'trust',
    'channelDependence',
    [
      '先和本地社群共同做内容',
      '把预算交给平台快速放大',
      '邀请老客分享真实使用场景',
      '让员工成为第一批品牌讲述者',
      '做一场大型事件，一次性获得注意力',
    ],
  ),
  newRound(
    'r12',
    'c4',
    '把品牌交给明天',
    '把视觉、产品、关系和组织能力整理成可持续的系统。',
    '三个月后，店里终于不再只靠创始人记住每个细节。你需要决定下一次迭代先改什么。',
    't-system',
    'brandConsistency',
    'orgCapacity',
    [
      '先整理一页品牌决策原则',
      '先把视觉资产整理成可执行模板',
      '先培训新员工如何讲品牌',
      '先复盘最容易失真的服务触点',
      '先暂停扩张，验证一个新场景',
    ],
  ),
];

const extraChoiceLabels: Record<string, readonly string[]> = {
  r01: ['先做一个可复购的基础款', '把游客拍照动线设计好', '请附近店主一起试喝'],
  r05: ['把等待时间写进服务流程', '只保留最能代表承诺的两款', '把复杂款改成预约制'],
  r08: ['选择最醒目的标志性符号', '选择最亲切的手写语气', '选择能变成 IP 的图形角色'],
  r11: ['先培训再接平台订单', '把增长限定在周末', '用会员预约消化需求'],
};

const extendedBaseRounds = sampleContent.rounds.map((round) => ({
  ...round,
  choices: [
    ...round.choices,
    ...choiceSet(
      round.roundId,
      round.theoryIds[0] ?? 't-segment',
      extraChoiceLabels[round.roundId] ?? [],
      'brandConsistency',
      'cash',
    ),
  ],
}));

const orderedRounds = [
  extendedBaseRounds.find((round) => round.roundId === 'r01')!,
  newRounds[0]!,
  newRounds[1]!,
  newRounds[2]!,
  extendedBaseRounds.find((round) => round.roundId === 'r05')!,
  newRounds[3]!,
  newRounds[4]!,
  extendedBaseRounds.find((round) => round.roundId === 'r08')!,
  newRounds[5]!,
  newRounds[6]!,
  extendedBaseRounds.find((round) => round.roundId === 'r11')!,
  newRounds[7]!,
];

const extraTheoryIds = [
  't-research',
  't-concept',
  't-name',
  't-position',
  't-ip',
  't-packaging',
  't-community',
  't-system',
];
const extraEventConditions = [
  [{ type: 'metric_at_least', key: 'cash', value: 50 }],
  [{ type: 'metric_at_least', key: 'trust', value: 45 }],
  [{ type: 'tag_present', tag: 'segment_decided' }],
  [{ type: 'metric_at_most', key: 'channelDependence', value: 30 }],
  [{ type: 'tag_present', tag: 'promise_tested' }],
  [{ type: 'metric_at_least', key: 'culturalCredibility', value: 45 }],
] as const;
const extraEvents = Array.from({ length: 28 }, (_, index) => {
  const theoryId = extraTheoryIds[index % extraTheoryIds.length] ?? 't-system';
  const keys: MetricKey[] = [
    'trust',
    'cash',
    'awareness',
    'conversion',
    'loyalty',
    'differentiation',
  ];
  const key = keys[index % keys.length] ?? 'trust';
  return {
    eventId: `e-m4-${String(index + 1).padStart(2, '0')}`,
    title:
      [
        '雨停后的街角',
        '供应商临时改价',
        '一个学生拍了杯子',
        '隔壁店来借充电器',
        '老客带朋友回来',
        '平台给了一个入口位',
      ][index % 6] ?? '老街的小变化',
    body: '一个不算惊天动地的现实变化，让你看到品牌决策如何在日常经营中留下痕迹。',
    conditions: [...(extraEventConditions[index % extraEventConditions.length] ?? [])],
    probability: index % 4 === 0 ? 65 : 40,
    classWide: index % 2 === 0,
    once: true,
    effects: [
      fx(key, index % 3 === 0 ? 4 : -2, 'immediate', '现实环境带来的反馈', theoryId),
      fx('reputationDebt', index % 5 === 0 ? 3 : 1, 'delayed', '解释成本留下痕迹', theoryId),
    ],
    theoryIds: [theoryId],
  };
});

const rounds = orderedRounds.map((round, index) => ({
  ...round,
  eventIds: [
    ...round.eventIds,
    ...extraEvents
      .filter((_, eventIndex) => eventIndex % orderedRounds.length === index)
      .map((event) => event.eventId),
  ],
}));

export const fullContent = validateContent({
  contentVersion: 'v1.0.0',
  engineVersion: '0.1.0',
  theories: [
    ...sampleContent.theories,
    {
      theoryId: 't-research',
      title: '先问再做',
      explanation: '研究不是装饰，它决定你在服务谁以及不服务谁。',
      transferPrompt: '你的作业中哪条证据改变了方案？',
    },
    {
      theoryId: 't-concept',
      title: '概念收敛',
      explanation: '产品概念要把需求、场景和价值压缩成可选择的方向。',
      transferPrompt: '你的产品概念是否能用一句话被验证？',
    },
    {
      theoryId: 't-name',
      title: '命名与承诺',
      explanation: '名字会提前设置期待，期待越清楚，兑现边界越重要。',
      transferPrompt: '你的品牌名让人期待什么？',
    },
    {
      theoryId: 't-position',
      title: '定位可感知',
      explanation: '定位不是一段文案，而是价格、空间、服务和取舍的组合。',
      transferPrompt: '你的定位如何被实际体验到？',
    },
    {
      theoryId: 't-ip',
      title: 'IP的任务',
      explanation: 'IP应该承担识别、叙事或关系中的具体任务，而不只是可爱。',
      transferPrompt: '你的IP为品牌关系增加了什么？',
    },
    {
      theoryId: 't-packaging',
      title: '包装是离店触点',
      explanation: '包装离开门店后仍然在传播、使用和暴露品牌系统。',
      transferPrompt: '你的包装在离开现场后还解决什么问题？',
    },
    {
      theoryId: 't-community',
      title: '关系网络',
      explanation: '品牌由顾客、员工、社区和平台共同解释，传播会改变关系结构。',
      transferPrompt: '谁会替你的品牌说话？他们为什么愿意？',
    },
    {
      theoryId: 't-system',
      title: '品牌系统化',
      explanation: '可持续的品牌需要把原则转成团队能够重复执行的工具。',
      transferPrompt: '你的方案如何交给别人继续执行？',
    },
  ],
  rounds,
  events: [...sampleContent.events, ...extraEvents],
  visualSystems: [
    ...sampleContent.visualSystems,
    {
      visualId: 'v-heritage',
      name: '徽墨茶印',
      description: '以印章、留白和手工痕迹建立更浓的文化气质。',
      attributes: {
        recognitionStrength: 76,
        smallSizeLegibility: 58,
        storefrontDistinctiveness: 72,
        packagingRobustness: 84,
        culturalCredibility: 94,
        brandConsistency: 74,
        touchpointAdaptability: 66,
        productionCost: 68,
      },
      touchpoints: ['storefront', 'cup', 'packaging', 'avatar'],
    },
    {
      visualId: 'v-stamp',
      name: '一枚小印',
      description: '将小型印记作为低成本、可重复的品牌资产。',
      attributes: {
        recognitionStrength: 68,
        smallSizeLegibility: 78,
        storefrontDistinctiveness: 60,
        packagingRobustness: 88,
        culturalCredibility: 80,
        brandConsistency: 82,
        touchpointAdaptability: 84,
        productionCost: 38,
      },
      touchpoints: ['storefront', 'cup', 'packaging', 'avatar'],
    },
    {
      visualId: 'v-modern',
      name: '新茶几何',
      description: '用简洁几何和高对比色进入更年轻的数字触点。',
      attributes: {
        recognitionStrength: 88,
        smallSizeLegibility: 90,
        storefrontDistinctiveness: 86,
        packagingRobustness: 70,
        culturalCredibility: 56,
        brandConsistency: 80,
        touchpointAdaptability: 86,
        productionCost: 72,
      },
      touchpoints: ['storefront', 'cup', 'packaging', 'avatar'],
    },
  ],
  endings: [
    ...sampleContent.endings,
    {
      endingId: 'e-research-led',
      title: '证据驱动的小店',
      description: '你把现场证据变成了产品和品牌方向，而不是把调研留在报告里。',
      conditions: [{ type: 'choice_was', choiceId: 'r02-alt-1' }],
      priority: 95,
    },
    {
      endingId: 'e-visual-pragmatist',
      title: '视觉落地派',
      description: '你选择了能在真实触点中反复工作的视觉系统。',
      conditions: [{ type: 'choice_was', choiceId: 'r08-system' }],
      priority: 94,
    },
    {
      endingId: 'e-growth-restraint',
      title: '有节制的增长者',
      description: '你把增长速度交给了交付和关系，而不是交给一条热搜。',
      conditions: [{ type: 'choice_was', choiceId: 'r11-steady' }],
      priority: 93,
    },
    {
      endingId: 'e-platform-bet',
      title: '平台下注者',
      description: '你愿意用渠道换取速度，也必须继续偿还体验管理的成本。',
      conditions: [{ type: 'choice_was', choiceId: 'r11-grow' }],
      priority: 92,
    },
    {
      endingId: 'e-community-led',
      title: '社区共同品牌',
      description: '品牌不只属于店里的人，也在本地关系中获得了新的解释者。',
      conditions: [{ type: 'choice_was', choiceId: 'r10-alt-1' }],
      priority: 91,
    },
    {
      endingId: 'e-cultural',
      title: '文化转译者',
      description: '地域文化没有停在装饰上，而是成为可体验、可分享的品牌关系。',
      conditions: [
        { type: 'metric_at_least', key: 'culturalCredibility', value: 75 },
        { type: 'metric_at_least', key: 'differentiation', value: 55 },
      ],
      priority: 60,
    },
    {
      endingId: 'e-visual',
      title: '离店也能认出的品牌',
      description: '视觉系统在招牌、包装和数字头像之间保持了连续识别。',
      conditions: [
        { type: 'metric_at_least', key: 'visualRecognition', value: 70 },
        { type: 'metric_at_least', key: 'visualAdaptability', value: 60 },
      ],
      priority: 55,
    },
    {
      endingId: 'e-trust',
      title: '老客愿意替你解释',
      description: '品牌没有依赖每一次投放，而是在关系中获得了耐心。',
      conditions: [{ type: 'metric_at_least', key: 'trust', value: 70 }],
      priority: 50,
    },
    {
      endingId: 'e-delivery',
      title: '承诺可以被交付',
      description: '你把品牌话语压回了团队可以重复做到的范围。',
      conditions: [
        { type: 'metric_at_least', key: 'productDelivery', value: 75 },
        { type: 'metric_at_least', key: 'promiseCredibility', value: 60 },
      ],
      priority: 48,
    },
    {
      endingId: 'e-position',
      title: '位置清楚的日常品牌',
      description: '顾客知道为什么来，也知道什么时候会再来。',
      conditions: [
        { type: 'metric_at_least', key: 'segmentFit', value: 65 },
        { type: 'metric_at_least', key: 'conversion', value: 35 },
      ],
      priority: 45,
    },
    {
      endingId: 'e-adaptive',
      title: '有弹性的品牌系统',
      description: '品牌不靠创始人盯住每个细节，也能在新触点保持方向。',
      conditions: [
        { type: 'metric_at_least', key: 'orgCapacity', value: 65 },
        { type: 'metric_at_least', key: 'brandConsistency', value: 65 },
      ],
      priority: 44,
    },
    {
      endingId: 'e-ip',
      title: 'IP成为关系入口',
      description: 'IP从装饰物变成了顾客愿意参与的品牌角色。',
      conditions: [
        { type: 'metric_at_least', key: 'loyalty', value: 35 },
        { type: 'metric_at_least', key: 'brandConsistency', value: 55 },
      ],
      priority: 42,
    },
    {
      endingId: 'e-platform',
      title: '平台放大的品牌',
      description: '你获得了流量，但也必须学会管理渠道依赖和体验波动。',
      conditions: [
        { type: 'metric_at_least', key: 'channelDependence', value: 25 },
        { type: 'metric_at_least', key: 'awareness', value: 45 },
      ],
      priority: 40,
    },
    {
      endingId: 'e-hype',
      title: '被看见却没被相信',
      description: '注意力来得很快，品牌承诺和实际体验还没有追上。',
      conditions: [
        { type: 'metric_at_least', key: 'awareness', value: 65 },
        { type: 'metric_at_most', key: 'trust', value: 45 },
      ],
      priority: 39,
    },
    {
      endingId: 'e-overpromise',
      title: '承诺债务到期',
      description: '品牌说得比团队做得到的更多，解释成本最终显形。',
      conditions: [{ type: 'metric_at_least', key: 'reputationDebt', value: 30 }],
      priority: 38,
    },
    {
      endingId: 'e-cash',
      title: '漂亮但缺现金',
      description: '方案有吸引力，却没有留下足够的经营缓冲。',
      conditions: [
        { type: 'metric_at_most', key: 'cash', value: 20 },
        { type: 'metric_at_least', key: 'brandConsistency', value: 50 },
      ],
      priority: 37,
    },
    {
      endingId: 'e-quiet',
      title: '安静的邻里店',
      description: '它没有成为网红，却在日常关系里获得了位置。',
      conditions: [
        { type: 'metric_at_most', key: 'awareness', value: 35 },
        { type: 'metric_at_least', key: 'trust', value: 65 },
      ],
      priority: 36,
    },
    {
      endingId: 'e-drift',
      title: '每个人都在做一点',
      description: '选择很多，品牌却没有形成清晰的共同方向。',
      conditions: [{ type: 'metric_at_most', key: 'brandConsistency', value: 35 }],
      priority: 35,
    },
  ],
  conceptCards: [
    ...sampleContent.conceptCards,
    {
      conceptId: 'c-research',
      title: '证据改变方向',
      explanation: '研究的价值在于让方案发生可解释的改变。',
      sourceTheoryId: 't-research',
      unlockTag: 'segment_decided',
    },
    {
      conceptId: 'c-concept',
      title: '产品概念不是功能清单',
      explanation: '概念要把人、场景和价值放在同一个判断里。',
      sourceTheoryId: 't-concept',
      unlockTag: 'segment_decided',
    },
    {
      conceptId: 'c-name',
      title: '名字提前设置期待',
      explanation: '命名会影响顾客理解，也会影响之后的交付压力。',
      sourceTheoryId: 't-name',
      unlockTag: 'promise_tested',
    },
    {
      conceptId: 'c-position',
      title: '定位需要触点证明',
      explanation: '价格、空间和服务共同证明你是谁。',
      sourceTheoryId: 't-position',
      unlockTag: 'promise_tested',
    },
    {
      conceptId: 'c-ip',
      title: 'IP要有工作',
      explanation: '一个角色应该承担识别、叙事或参与中的至少一项任务。',
      sourceTheoryId: 't-ip',
      unlockTag: 'promise_tested',
    },
    {
      conceptId: 'c-packaging',
      title: '包装离店后继续说话',
      explanation: '包装是移动的品牌触点，不是最后一张效果图。',
      sourceTheoryId: 't-packaging',
      unlockTag: 'visual_tested',
    },
    {
      conceptId: 'c-community',
      title: '传播改变关系',
      explanation: '平台和社群带来的不只是曝光，也会带来不同的期待。',
      sourceTheoryId: 't-community',
      unlockTag: 'growth_event',
    },
    {
      conceptId: 'c-system',
      title: '把原则交给团队',
      explanation: '系统化让品牌不依赖创始人的临场记忆。',
      sourceTheoryId: 't-system',
      unlockTag: 'growth_event',
    },
    {
      conceptId: 'c-counterfactual',
      title: '结果不等于运气',
      explanation: '报告中的反事实帮助你追问：换一个决定，哪条路径会改变？',
      sourceTheoryId: 't-system',
      unlockTag: 'growth_event',
    },
    {
      conceptId: 'c-visual-choice',
      title: '视觉选择有代价',
      explanation: '高识别、文化感、适配性和成本之间必须做取舍。',
      sourceTheoryId: 't-identity',
      unlockTag: 'visual_tested',
    },
    {
      conceptId: 'c-stakeholder',
      title: '品牌是共同解释',
      explanation: '顾客、员工、社区和平台都在参与品牌意义的形成。',
      sourceTheoryId: 't-community',
      unlockTag: 'growth_event',
    },
    {
      conceptId: 'c-iteration',
      title: '先做可验证的下一步',
      explanation: '好的品牌不是一次性完成，而是每轮复盘后更能被执行。',
      sourceTheoryId: 't-system',
      unlockTag: 'growth_event',
    },
  ],
  achievements: [
    ...sampleContent.achievements,
    {
      achievementId: 'a-evidence-first',
      title: '先看现场',
      description: '在做选择前主动花行动力获取信息。',
      unlockTag: 'segment_decided',
    },
    {
      achievementId: 'a-concept-cut',
      title: '敢于删掉',
      description: '在资源有限时做出明确的概念收敛。',
      unlockTag: 'promise_tested',
    },
    {
      achievementId: 'a-ip-with-a-job',
      title: '让IP上班',
      description: '把IP放进一个真实的品牌任务。',
      unlockTag: 'promise_tested',
    },
    {
      achievementId: 'a-packaging-leaves',
      title: '包装离店',
      description: '完成一次关于包装离店后触点的判断。',
      unlockTag: 'visual_tested',
    },
    {
      achievementId: 'a-community-voice',
      title: '听见关系网',
      description: '在平台之外识别一个真实的品牌讲述者。',
      unlockTag: 'growth_event',
    },
  ],
  characters: [
    {
      characterId: 'ch-founder',
      name: '你',
      role: '品牌发起人',
      agenda: '在有限预算里做出一个值得继续经营的品牌。',
    },
    {
      characterId: 'ch-landlord',
      name: '许房东',
      role: '铺面房东',
      agenda: '希望老街热闹，但也担心短期网红把街区弄乱。',
    },
    {
      characterId: 'ch-barista',
      name: '阿禾',
      role: '店员与现场观察者',
      agenda: '希望承诺不要超过每天真正做得到的工作。',
    },
    {
      characterId: 'ch-supplier',
      name: '老周',
      role: '原料供应商',
      agenda: '愿意一起试，但需要稳定、可预测的订单。',
    },
    {
      characterId: 'ch-designer',
      name: '小满',
      role: '视觉设计师',
      agenda: '希望视觉系统能离开效果图进入每个触点。',
    },
    {
      characterId: 'ch-illustrator',
      name: '豆花',
      role: 'IP插画师',
      agenda: '希望角色有工作，而不是只被贴在墙上。',
    },
    {
      characterId: 'ch-regular',
      name: '陈姨',
      role: '附近老客',
      agenda: '想要一个不会为了游客而忘记邻里日常的地方。',
    },
    {
      characterId: 'ch-photographer',
      name: '小沈',
      role: '本地摄影者',
      agenda: '愿意分享真实街区，但不想替品牌说假话。',
    },
    {
      characterId: 'ch-platform',
      name: '周经理',
      role: '平台合作经理',
      agenda: '希望用一次漂亮的增长证明合作价值。',
    },
  ],
  discussionTopics: [
    {
      topicId: 'd-01',
      title: '你服务的是谁',
      prompt: '你的第一轮选择有没有真正排除某些人？这种排除带来了什么好处和代价？',
      relatedTheoryIds: ['t-segment'],
    },
    {
      topicId: 'd-02',
      title: '证据有没有改变你',
      prompt: '如果没有看现场，你会做出不同选择吗？',
      relatedTheoryIds: ['t-research'],
    },
    {
      topicId: 'd-03',
      title: '产品概念如何收敛',
      prompt: '一个产品同时满足太多愿望时，品牌会发生什么？',
      relatedTheoryIds: ['t-concept'],
    },
    {
      topicId: 'd-04',
      title: '名字制造了什么期待',
      prompt: '游戏里的命名与实际交付是否一致？',
      relatedTheoryIds: ['t-name', 't-promise'],
    },
    {
      topicId: 'd-05',
      title: '定位如何被看见',
      prompt: '定位是文案、价格、空间，还是一组共同的触点？',
      relatedTheoryIds: ['t-position'],
    },
    {
      topicId: 'd-06',
      title: 'IP为什么存在',
      prompt: '如果删掉IP，品牌损失的是识别、叙事还是关系？',
      relatedTheoryIds: ['t-ip'],
    },
    {
      topicId: 'd-07',
      title: '视觉测试改变了什么',
      prompt: '哪项视觉测试最可能改变你的作业方案？为什么？',
      relatedTheoryIds: ['t-identity', 't-packaging'],
    },
    {
      topicId: 'd-08',
      title: '包装离店之后',
      prompt: '包装如何继续影响品牌的传播与使用？',
      relatedTheoryIds: ['t-packaging'],
    },
    {
      topicId: 'd-09',
      title: '谁在替品牌说话',
      prompt: '平台、老客、员工和社区的解释有什么不同？',
      relatedTheoryIds: ['t-community'],
    },
    {
      topicId: 'd-10',
      title: '增长是否值得',
      prompt: '什么情况下应该放慢增长？这和品牌失败是一回事吗？',
      relatedTheoryIds: ['t-growth', 't-system'],
    },
  ],
});
