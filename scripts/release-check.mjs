import { spawnSync } from 'node:child_process';

// The root release command must verify the current production candidate. The
// v1.0 checker remains historical documentation, while v1.2 is the only
// candidate that the formal /v11 route can publish.
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(pnpm, ['--filter', '@laojie/game-engine', 'release:v11'], {
  cwd: process.cwd(),
  env: process.env,
  // Windows exposes pnpm through a .cmd shim; the shim requires a shell to
  // be launched by Node. Arguments are fixed below and contain no user input.
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  console.error(`无法执行 v1.2 发布检查：${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
