import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

async function main(): Promise<void> {
  const { v11FullContent, validateV11Content } =
    await import('../packages/content-schema/src/index.ts');
  const { compileV11Content } = await import('../packages/content-schema/src/compile-contract.ts');
  const { simulateV11, simulateV11Strategies } =
    await import('../packages/game-engine/src/index.ts');
  const artifact = JSON.parse(
    await readFile(new URL('../content/compiled/v1.3.0.json', import.meta.url), 'utf8'),
  ) as { checksum: string };
  const compiled = compileV11Content(v11FullContent);
  const artifactContent = JSON.parse(
    await readFile(new URL('../content/compiled/v1.3.0.json', import.meta.url), 'utf8'),
  ) as { checksum: string } & Record<string, unknown>;
  const { checksum: artifactChecksum, ...artifactWithoutChecksum } = artifactContent;
  const recomputedArtifactChecksum = createHash('sha256')
    .update(JSON.stringify(artifactWithoutChecksum))
    .digest('hex');
  validateV11Content(artifactWithoutChecksum);
  if (artifactChecksum !== recomputedArtifactChecksum)
    throw new Error('已发布内容包内部校验和不一致');
  if (artifact.checksum !== compiled.checksum)
    throw new Error(`已发布内容包与源码不一致：${artifact.checksum} != ${compiled.checksum}`);
  if (v11FullContent.endings.length < 15)
    throw new Error(`结局数量不足：${v11FullContent.endings.length}`);
  const visualAssets = v11FullContent.assetManifest.filter((asset) => asset.assetType === 'visual');
  if (visualAssets.length !== v11FullContent.visualSystems.length)
    throw new Error('视觉方案与正式视觉资产数量不一致');
  for (const asset of visualAssets) {
    const source = await readFile(
      new URL(`../apps/web/public/assets/v11/${asset.assetKey}`, import.meta.url),
      'utf8',
    );
    if (!source.includes('<svg')) throw new Error(`正式视觉资产不是可用 SVG：${asset.assetKey}`);
  }
  const iterations = Number(process.env.V11_SIMULATIONS ?? 50_000);
  const simulation = simulateV11(v11FullContent, iterations);
  const maxChoiceShare = Math.max(...Object.values(simulation.choiceShares));
  if (simulation.completedRuns !== iterations)
    throw new Error(`存在未完成经营路径：${simulation.completedRuns}/${iterations}`);
  if ((simulation.endingShares.unfinished ?? 0) > 0) throw new Error('存在没有正式结局的完成路径');
  if (simulation.distinctRouteIds < 3)
    throw new Error(`路线过于单一：${simulation.distinctRouteIds}`);
  if (simulation.distinctEndingIds < 10)
    throw new Error(`结局分布过于单一：${simulation.distinctEndingIds}`);
  if (maxChoiceShare > 0.4) throw new Error(`存在疑似支配选择，最高选择份额为 ${maxChoiceShare}`);
  const strategyIterations = Number(process.env.V11_STRATEGY_SIMULATIONS ?? 200);
  const strategies = simulateV11Strategies(v11FullContent, strategyIterations);
  if (strategies.completedRuns !== strategyIterations * 6 || strategies.deadlockedRuns !== 0) {
    throw new Error(
      `策略代理存在未完成路径：${strategies.completedRuns}/${strategyIterations * 6}，死局 ${strategies.deadlockedRuns}`,
    );
  }
  if (Object.values(strategies.strategies).some((report) => report.invalidActionRuns > 0)) {
    throw new Error('策略代理出现非法自动动作');
  }
  if (
    Object.values(strategies.strategies).some((report) => report.incomeRuns !== strategyIterations)
  ) {
    throw new Error('存在策略代理没有收到经营收入反馈');
  }
  if (strategies.distinctRouteIds < 3 || strategies.distinctEndingIds < 3) {
    throw new Error(
      `策略代理没有形成足够的路线/结局差异：${strategies.distinctRouteIds}/${strategies.distinctEndingIds}`,
    );
  }
  console.log(
    JSON.stringify(
      {
        contentVersion: v11FullContent.contentVersion,
        checksum: compiled.checksum,
        rounds: v11FullContent.rounds.length,
        choices: v11FullContent.rounds.flatMap((round) => round.choices).length,
        events: v11FullContent.events.length,
        visualSystems: v11FullContent.visualSystems.length,
        verifiedVisualAssets: visualAssets.map((asset) => asset.assetKey),
        simulations: iterations,
        ...simulation,
        maxChoiceShare,
        strategySimulations: strategyIterations,
        strategyDeadlocks: strategies.deadlockedRuns,
        strategyRoutes: strategies.distinctRouteIds,
        strategyEndings: strategies.distinctEndingIds,
        reproducible: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
