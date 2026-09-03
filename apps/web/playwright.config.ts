import { defineConfig, devices } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const webPort = process.env.WEB_PORT ?? '4173';
const apiPort = process.env.API_PORT ?? '3000';
const v11ApiPort = process.env.V11_API_PORT ?? '3001';
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const reuseExistingServer = process.env.REUSE_E2E_SERVERS === 'true';
const nodeExecutable = JSON.stringify(process.execPath);
const apiRequire = createRequire(new URL('../api/package.json', import.meta.url));
const tsxLoader = JSON.stringify(pathToFileURL(apiRequire.resolve('tsx')).href);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: '../../test-results/web',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'iphone-webkit',
      timeout: 120_000,
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: [
    {
      command: `${nodeExecutable} --import ${tsxLoader} ../api/src/server.ts`,
      url: `${apiOrigin}/health`,
      env: {
        PORT: apiPort,
        HOST: '127.0.0.1',
        CORS_ORIGINS: `${webOrigin},http://localhost:${webPort}`,
      },
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: `${nodeExecutable} static-server.mjs`,
      url: webOrigin,
      env: {
        PORT: webPort,
        HOST: '127.0.0.1',
        API_PORT: apiPort,
        V11_API_PORT: v11ApiPort,
        DIST_DIR: '../../.vite-cache/web-dist',
      },
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: `${nodeExecutable} --import ${tsxLoader} ../api/src/v11-server.ts`,
      url: `http://127.0.0.1:${v11ApiPort}/ready`,
      env: {
        V11_API_PORT: v11ApiPort,
        HOST: '127.0.0.1',
        DEV_V11_TRIAL_CLASS_CODE: 'LAOJIE11',
        CORS_ORIGINS: `${webOrigin},http://localhost:${webPort}`,
      },
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
});
