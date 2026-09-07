import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const compiled = JSON.parse(await readFile(resolve('content/compiled/v1.3.0.json'), 'utf8'));
const releaseCandidate = await readFile(resolve('docs/v1.2-发布候选验收包.md'), 'utf8');

const checks = [
  ['content version is v1.3.0', compiled.contentVersion === 'v1.3.0'],
  ['12 rounds are present', compiled.rounds.length === 12],
  ['the visual round is present', compiled.rounds.some((round) => round.visualRequired)],
  ['three approved visual systems are present', compiled.visualSystems.length === 3],
  ['at least 15 endings are present', compiled.endings.length >= 15],
  [
    'release candidate records the no-organized-pilot boundary',
    releaseCandidate.includes('A 项标记为“本版不执行”'),
  ],
];

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failures.length > 0) throw new Error(`直接建设发布前检查失败：${failures.join('、')}`);

console.log(
  JSON.stringify(
    {
      contentVersion: compiled.contentVersion,
      rounds: compiled.rounds.length,
      visualSystems: compiled.visualSystems.length,
      endings: compiled.endings.length,
      automatedChecks: checks.length,
      organizedPilot: 'deferred-by-product-decision',
      manualValidationPending: true,
    },
    null,
    2,
  ),
);
