import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entrypoint = resolve(root, 'apps', 'api', 'dist', 'apps', 'api', 'src', 'v11-server.js');
const contentFile = resolve(root, 'content', 'compiled', 'v1.4.0.json');
const port = process.env.RELEASE_SMOKE_PORT ?? '3399';
const endpoint = `http://127.0.0.1:${port}/ready`;

const child = spawn(process.execPath, [entrypoint], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    V11_API_PORT: port,
    DEV_V11_TRIAL_CLASS_CODE: 'LAOJIE11',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function stop() {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), delay(2_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  const expected = JSON.parse(await readFile(contentFile, 'utf8'));
  let ready;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`候选 API 在 ready 前退出（${child.exitCode}）：${output}`);
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        ready = await response.json();
        break;
      }
    } catch {
      // The process can need a few hundred milliseconds to bind its port.
    }
    await delay(250);
  }

  if (!ready || ready.status !== 'ready') throw new Error(`候选 API 未就绪：${output}`);
  if (
    ready.contentVersion !== expected.contentVersion ||
    ready.contentChecksum !== expected.checksum
  )
    throw new Error(
      `候选 API 内容身份不一致：${JSON.stringify({ ready, expected: { contentVersion: expected.contentVersion, checksum: expected.checksum } })}`,
    );

  console.log(
    JSON.stringify({
      endpoint,
      status: ready.status,
      contentVersion: ready.contentVersion,
      contentChecksum: ready.contentChecksum,
    }),
  );
} finally {
  await stop();
}
