/**
 * Release evidence for the six deterministic policy agents. This script does
 * not simulate a shortcut path: the engine applies every submitted action and
 * reports the same completion, cash, income, route, ending and fingerprint
 * fields that the release gate uses.
 */
async function main(): Promise<void> {
  const { v11FullContent, validateV11Content } =
    await import('../packages/content-schema/src/index.ts');
  const { compileV11Content } = await import('../packages/content-schema/src/compile-contract.ts');
  const { simulateV11Strategies } = await import('../packages/game-engine/src/index.ts');
  const content = validateV11Content(v11FullContent);
  const compiled = compileV11Content(content);
  const iterations = Number(process.env.V11_STRATEGY_SIMULATIONS ?? 200);
  const report = simulateV11Strategies(content, iterations);
  const strategyReports = Object.fromEntries(
    Object.entries(report.strategies).map(([strategy, result]) => [
      strategy,
      {
        completedRuns: result.completedRuns,
        deadlockedRuns: result.deadlockedRuns,
        invalidActionRuns: result.invalidActionRuns,
        minimumFinalCashYuan: result.minimumFinalCashYuan,
        averageOperatingIncomeYuan: Math.round(result.averageOperatingIncomeYuan),
        averageNetCashChangeYuan: Math.round(result.averageNetCashChangeYuan),
        skippedRounds: result.skippedRounds,
        averageActionCount: Number(result.averageActionCount.toFixed(2)),
        distinctChoiceIds: result.distinctChoiceIds,
        distinctRouteIds: result.distinctRouteIds,
        distinctEndingIds: result.distinctEndingIds,
        actionSequenceFingerprint: result.actionSequenceFingerprint,
        finalStateFingerprint: result.finalStateFingerprint,
      },
    ]),
  );
  if (report.deadlockedRuns !== 0) throw new Error(`策略代理存在死局：${report.deadlockedRuns}`);
  if (Object.values(report.strategies).some((result) => result.invalidActionRuns > 0))
    throw new Error('策略代理存在非法动作');
  console.log(
    JSON.stringify(
      {
        contentVersion: content.contentVersion,
        checksum: compiled.checksum,
        iterationsPerStrategy: iterations,
        completedRuns: report.completedRuns,
        deadlockedRuns: report.deadlockedRuns,
        distinctRouteIds: report.distinctRouteIds,
        distinctEndingIds: report.distinctEndingIds,
        strategies: strategyReports,
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
