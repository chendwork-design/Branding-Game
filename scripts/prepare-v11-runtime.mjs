import { access, copyFile, cp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = join(root, 'apps', 'api', 'dist');
const packageRoot = join(runtimeRoot, 'node_modules', '@laojie');
const publishedContentVersions = ['v1.2.0', 'v1.3.0', 'v1.4.0'];
const currentContentVersion = 'v1.4.0';
const contentSource = join(root, 'content', 'compiled', `${currentContentVersion}.json`);
const contentTarget = join(runtimeRoot, 'content', 'compiled', `${currentContentVersion}.json`);
const nobleSource = await realpath(
  join(root, 'packages', 'game-engine', 'node_modules', '@noble', 'hashes'),
);

const workspacePackages = ['content-schema', 'game-engine', 'report-engine', 'shared-contracts'];
for (const packageName of workspacePackages) {
  const packageDirectory = join(packageRoot, packageName);
  const sourceDirectory =
    packageName === 'content-schema'
      ? join(root, 'packages', packageName, 'dist', 'src')
      : join(runtimeRoot, 'packages', packageName, 'src');
  await mkdir(packageDirectory, { recursive: true });
  await cp(sourceDirectory, join(packageDirectory, 'src'), {
    recursive: true,
    force: true,
  });
  await writeFile(
    join(packageDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: `@laojie/${packageName}`,
        private: true,
        type: 'module',
        exports: {
          '.': './src/index.js',
          './full': './src/full.js',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

await access(join(packageRoot, 'content-schema', 'src', 'full.js'));

await cp(nobleSource, join(runtimeRoot, 'node_modules', '@noble', 'hashes'), {
  recursive: true,
  force: true,
});

await mkdir(dirname(contentTarget), { recursive: true });
await Promise.all(
  publishedContentVersions.map((version) =>
    copyFile(
      join(root, 'content', 'compiled', `${version}.json`),
      join(runtimeRoot, 'content', 'compiled', `${version}.json`),
    ),
  ),
);

const artifact = JSON.parse(await readFile(contentSource, 'utf8'));
await writeFile(
  join(runtimeRoot, 'runtime-manifest.json'),
  `${JSON.stringify(
    {
      runtime: currentContentVersion,
      entrypoint: 'apps/api/src/v11-server.js',
      contentVersion: artifact.contentVersion,
      contentChecksum: artifact.checksum,
      supportedContentVersions: publishedContentVersions,
      workspacePackages,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  JSON.stringify({
    runtimeRoot,
    entrypoint: join(runtimeRoot, 'apps', 'api', 'src', 'v11-server.js'),
    contentVersion: artifact.contentVersion,
    contentChecksum: artifact.checksum,
  }),
);
