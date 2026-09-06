import { V11VisualAssetManifest } from '../apps/web/src/v11VisualAssets.ts';

const runtimeAssets = Object.entries(V11VisualAssetManifest)
  .flatMap(([family, assets]) =>
    Object.values(assets).map((path) => ({ family, path: path.replaceAll('\\', '/') })),
  )
  .sort((left, right) => left.path.localeCompare(right.path));

process.stdout.write(`${JSON.stringify({ version: 'v1.9', runtimeAssets }, null, 2)}\n`);
