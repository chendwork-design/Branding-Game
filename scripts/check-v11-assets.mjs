import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const assetDir = join(root, 'apps', 'web', 'public', 'assets', 'v11');
const sourceFiles = [
  join(root, 'apps', 'web', 'src', 'v11VisualAssets.ts'),
  join(root, 'apps', 'web', 'src', 'v11App.tsx'),
];
const requiredAssets = [
  'visual-wordmark.svg',
  'visual-symbol.svg',
  'visual-ip.svg',
  'scene-atlas.svg',
  'ui-icons.svg',
];
const MAX_RUNTIME_RASTER_BYTES = 320 * 1024;
const MAX_RUNTIME_VECTOR_BYTES = 32 * 1024;
const MAX_INITIAL_BYTES = 20 * 1024 * 1024;

const sourceText = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join(
  '\n',
);
const runtimeAssets = new Set(requiredAssets);
const staticAssetPattern =
  /['"]((?:actions|decisions|scenes|touchpoints|rewards)\/[^'"]+\.(?:jpg|jpeg|png|webp|avif|svg))['"]/g;
for (const match of sourceText.matchAll(staticAssetPattern)) runtimeAssets.add(match[1]);
for (const match of sourceText.matchAll(/\/assets\/v11\/([^'"]+\.(?:jpg|jpeg|png|webp|avif|svg))/g))
  runtimeAssets.add(match[1]);

for (let index = 1; index <= 12; index += 1) {
  const roundId = `r${String(index).padStart(2, '0')}`;
  for (const state of ['stable', 'strained', 'crisis'])
    runtimeAssets.add(`scenes/results/result-${roundId}-${state}.jpg`);
}
for (const file of [
  'scenes/results/result-r01-v18-neighbor.jpg',
  'scenes/results/result-r01-v18-hybrid.jpg',
  'scenes/results/result-r01-v18-tourist.jpg',
  'scenes/results/result-r03-v18-stable.jpg',
  'scenes/results/result-r03-v18-strained.jpg',
  'scenes/results/result-r03-v18-crisis.jpg',
  'scenes/results/result-r08-v18-stable.jpg',
  'scenes/results/result-r08-v18-strained.jpg',
  'scenes/results/result-r08-v18-crisis.jpg',
  'scenes/results/result-r11-v18-stable.jpg',
  'scenes/results/result-r11-v18-strained.jpg',
  'scenes/results/result-r11-v18-crisis.jpg',
])
  runtimeAssets.add(file);

const failures = [];
const runtimeStats = [];
for (const relativePath of runtimeAssets) {
  const absolutePath = join(assetDir, relativePath);
  const info = await stat(absolutePath).catch(() => undefined);
  if (!info?.isFile()) {
    failures.push(`${relativePath}: runtime file is missing`);
    continue;
  }
  const limit = /\.svg$/i.test(relativePath) ? MAX_RUNTIME_VECTOR_BYTES : MAX_RUNTIME_RASTER_BYTES;
  if (info.size > limit)
    failures.push(`${relativePath}: ${info.size} bytes exceeds ${limit} bytes`);
  runtimeStats.push({ relativePath, size: info.size });
}

const atlas = await readFile(join(assetDir, 'scene-atlas.svg'), 'utf8').catch(() => '');
const missingAtlasSymbols = [];
for (const id of [
  ...Array.from({ length: 12 }, (_, index) => `briefing-r${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, index) => `result-r${String(index + 1).padStart(2, '0')}`),
]) {
  if (!atlas.includes(`id="${id}"`)) missingAtlasSymbols.push(id);
}
if (missingAtlasSymbols.length > 0)
  failures.push(`scene-atlas.svg: missing symbols ${missingAtlasSymbols.join(', ')}`);

const initialAssets = runtimeStats.filter(({ relativePath }) =>
  /^(visual-(?:wordmark|symbol|ip)\.svg|scene-atlas\.svg|ui-icons\.svg|actions\/|scenes\/(?:onboarding|briefing\/briefing-r01-v18\.jpg))/.test(
    relativePath,
  ),
);
const initialBytes = initialAssets.reduce((sum, asset) => sum + asset.size, 0);
if (initialBytes > MAX_INITIAL_BYTES)
  failures.push(`initial runtime image budget exceeds ${MAX_INITIAL_BYTES} bytes`);

const distinctVisualPairs = [
  ['scenes/briefing/briefing-r01-v18.jpg', 'scenes/chapters/chapter-01-customers.jpg'],
  ['scenes/briefing/briefing-r03-v18.jpg', 'scenes/chapters/chapter-02-product-identity.jpg'],
  ['scenes/briefing/briefing-r07.jpg', 'scenes/chapters/chapter-03-service-v2.jpg'],
  ['scenes/briefing/briefing-r11-v18.jpg', 'scenes/chapters/chapter-04-growth.jpg'],
];
for (const [briefingPath, chapterPath] of distinctVisualPairs) {
  const [briefingBytes, chapterBytes] = await Promise.all([
    readFile(join(assetDir, briefingPath)).catch(() => undefined),
    readFile(join(assetDir, chapterPath)).catch(() => undefined),
  ]);
  if (briefingBytes && chapterBytes) {
    const briefingHash = createHash('sha256').update(briefingBytes).digest('hex');
    const chapterHash = createHash('sha256').update(chapterBytes).digest('hex');
    if (briefingHash === chapterHash)
      failures.push(`${chapterPath}: duplicates its corresponding briefing scene ${briefingPath}`);
  }
}

console.log(
  `v11 runtime assets: ${runtimeStats.length} files, ${runtimeStats.reduce((sum, asset) => sum + asset.size, 0)} bytes total`,
);
console.log(`v11 initial route assets: ${initialAssets.length} files, ${initialBytes} bytes`);
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
}
