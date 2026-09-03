import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const webRoot = resolve(workspaceRoot, 'apps/web');
const apiRequire = createRequire(new URL('../apps/api/package.json', import.meta.url));
const tsxLoader = pathToFileURL(apiRequire.resolve('tsx')).href;
const playwrightCli = resolve(webRoot, 'node_modules/@playwright/test/cli.js');
const forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === '--') forwardedArgs.shift();

async function canListen(port) {
  const probe = createServer();
  return new Promise((resolveProbe) => {
    const finish = (result) => {
      probe.removeAllListeners();
      if (probe.listening) probe.close(() => resolveProbe(result));
      else resolveProbe(result);
    };
    probe.once('error', () => finish(false));
    probe.listen(port, '127.0.0.1', () => finish(true));
  });
}

async function choosePort(preferred, used) {
  if (process.env[preferred.name]) {
    const requested = Number(process.env[preferred.name]);
    if (!(await canListen(requested)))
      throw new Error(
        `${preferred.name}=${requested} is already in use; choose another test port.`,
      );
    return String(requested);
  }
  for (let port = preferred.start; port < preferred.start + 100; port += 1) {
    if (used.has(port)) continue;
    if (await canListen(port)) {
      used.add(port);
      return String(port);
    }
  }
  throw new Error(`Could not find a free port near ${preferred.start}.`);
}

async function waitFor(url, label) {
  const deadline = Date.now() + 60_000;
  let lastError = 'not ready';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`${label} did not become ready at ${url}: ${lastError}`);
}

function start(command, args, env) {
  const child = spawn(command, args, {
    cwd: webRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  child.once('error', (error) => {
    process.stderr.write(`${command} failed to start: ${error.message}\n`);
  });
  return child;
}

async function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await once(killer, 'close');
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // The child may have exited between the guard and the signal.
  }
  await Promise.race([
    once(child, 'close'),
    new Promise((resolveWait) => setTimeout(resolveWait, 2_000)),
  ]);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // The child may have exited during the timeout.
    }
  }
}

const usedPorts = new Set();
const apiPort = await choosePort({ name: 'API_PORT', start: 3000 }, usedPorts);
const v11ApiPort = await choosePort({ name: 'V11_API_PORT', start: 3001 }, usedPorts);
const webPort = await choosePort({ name: 'WEB_PORT', start: 4173 }, usedPorts);
const env = {
  API_PORT: apiPort,
  V11_API_PORT: v11ApiPort,
  WEB_PORT: webPort,
  REUSE_E2E_SERVERS: 'true',
  DEV_TRIAL_CLASS_CODE: 'LAOJIE11',
  DEV_V11_TRIAL_CLASS_CODE: 'LAOJIE11',
};
const children = [
  start(process.execPath, ['--import', tsxLoader, '../api/src/server.ts'], {
    ...env,
    PORT: apiPort,
    HOST: '127.0.0.1',
    CORS_ORIGINS: `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
  }),
  start(process.execPath, ['static-server.mjs'], {
    ...env,
    PORT: webPort,
    HOST: '127.0.0.1',
    DIST_DIR: '../../.vite-cache/web-dist',
  }),
  start(process.execPath, ['--import', tsxLoader, '../api/src/v11-server.ts'], {
    ...env,
    V11_API_PORT: v11ApiPort,
    HOST: '127.0.0.1',
    CORS_ORIGINS: `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
  }),
];
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all(children.map(killTree));
};
process.once('SIGINT', async () => {
  await shutdown();
  process.exit(130);
});
process.once('SIGTERM', async () => {
  await shutdown();
  process.exit(143);
});

try {
  await Promise.all([
    waitFor(`http://127.0.0.1:${apiPort}/health`, 'API server'),
    waitFor(`http://127.0.0.1:${webPort}/`, 'web server'),
    waitFor(`http://127.0.0.1:${v11ApiPort}/ready`, 'V11 API server'),
  ]);
  const result = spawn(
    process.execPath,
    [playwrightCli, 'test', '--config', resolve(webRoot, 'playwright.config.ts'), ...forwardedArgs],
    {
      cwd: workspaceRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  const [exitCode] = await once(result, 'close');
  await shutdown();
  process.exit(exitCode ?? 1);
} catch (error) {
  await shutdown();
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
