import { V11VisualAssetManifest, V11VisualAssetRecords } from '../apps/web/src/v11VisualAssets.ts';

const runtimeAssets = Object.entries(V11VisualAssetManifest)
  .flatMap(([family, assets]) =>
    Object.values(assets).map((path) => {
      const normalizedPath = path.replaceAll('\\', '/');
      const record = V11VisualAssetRecords[normalizedPath];
      return {
        family,
        path: normalizedPath,
        focalPoint: record?.focalPoint,
      };
    }),
  )
  .sort((left, right) => left.path.localeCompare(right.path));

process.stdout.write(`${JSON.stringify({ version: 'v1.9', runtimeAssets }, null, 2)}\n`);
