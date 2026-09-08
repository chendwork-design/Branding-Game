import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { injectV11ApiPort, shouldServeSpaFallback } from '../static-server-utils.mjs';

describe('web tooling boundary', () => {
  it('keeps Playwright specs in the E2E runner and out of Vitest', async () => {
    const viteConfig = await readFile(new URL('../vite.config.mjs', import.meta.url), 'utf8');
    const playwrightConfig = await readFile(
      new URL('../playwright.config.ts', import.meta.url),
      'utf8',
    );
    const tsconfig = JSON.parse(
      await readFile(new URL('../tsconfig.json', import.meta.url), 'utf8'),
    ) as {
      include?: string[];
    };

    expect(viteConfig).toContain("'e2e/**'");
    expect(playwrightConfig).toContain("testDir: './e2e'");
    expect(tsconfig.include).toContain('e2e');
    expect(playwrightConfig).toContain(
      "const reuseExistingServer = process.env.REUSE_E2E_SERVERS === 'true'",
    );
    expect(playwrightConfig).toContain('reuseExistingServer,');
    const e2eRunner = await readFile(
      new URL('../../../scripts/run-web-e2e.mjs', import.meta.url),
      'utf8',
    );
    expect(e2eRunner).toContain("REUSE_E2E_SERVERS: 'true'");
    expect(e2eRunner).toContain('waitFor(`http://127.0.0.1:${v11ApiPort}/ready`');
    expect(e2eRunner).toContain("spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']");
    expect(e2eRunner).toContain("if (forwardedArgs[0] === '--') forwardedArgs.shift()");
  });

  it('keeps the production static server CSP aligned with the configured API port', async () => {
    const server = await readFile(new URL('../static-server.mjs', import.meta.url), 'utf8');
    expect(server).toContain('process.env.API_PORT');
    expect(server).toContain('process.env.V11_API_PORT');
    expect(server).toContain("requested === 'runtime-config.js'");
    expect(server).toContain('buildSecurityHeaders(request.headers.host)');
    expect(server).toContain('const v11ApiOrigin = origin.replace');
    expect(server).toContain("connect-src 'self' ${apiOrigin} ${v11ApiOrigin}");
    expect(server).toContain('process.env.DIST_DIR');
    expect(server).toContain("process.env.DIST_DIR ?? '../../.vite-cache/web-dist'");
    expect(server).toContain('content-security-policy');
    const serverUtils = await readFile(
      new URL('../static-server-utils.mjs', import.meta.url),
      'utf8',
    );
    expect(serverUtils).toContain('__LAOJIE_V11_API_PORT__');
    expect(serverUtils).toContain('replaceAll');
    const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    expect(index).toContain('/runtime-config.js');
    expect(index).toContain('name="laojie-v11-api-port"');
    expect(index).toContain('__LAOJIE_V11_API_PORT__');
  });

  it('never serves the SPA document in place of a missing hashed script asset', () => {
    expect(shouldServeSpaFallback('/teacher')).toBe(true);
    expect(shouldServeSpaFallback('/assets/index-old-build.js')).toBe(false);
    expect(shouldServeSpaFallback('/assets/index-old-build.css')).toBe(false);
  });

  it('injects the live v1.2 API port into HTML as a script-independent fallback', () => {
    expect(injectV11ApiPort('<meta content="__LAOJIE_V11_API_PORT__">', 3002)).toBe(
      '<meta content="3002">',
    );
    expect(injectV11ApiPort('<p>unchanged</p>', 3002)).toBe('<p>unchanged</p>');
  });

  it('uses a runtime API configuration file instead of hard-coding the static preview port', async () => {
    const server = await readFile(new URL('../static-server.mjs', import.meta.url), 'utf8');
    expect(server).toContain("requested === 'runtime-config.js'");
    expect(server).toContain('apiBase');
    expect(server).toContain('v11ApiBase');
  });

  it('keeps a non-React startup fallback and diagnostic loader in the entry document', async () => {
    const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const diagnostic = await readFile(
      new URL('../public/boot-diagnostic.js', import.meta.url),
      'utf8',
    );
    const legacyPage = await readFile(new URL('../public/legacy.html', import.meta.url), 'utf8');
    expect(index).toContain('startup-fallback');
    expect(index).toContain('/boot-diagnostic.js');
    expect(index).toContain('nomodule src="/legacy-app.js"');
    expect(diagnostic).toContain('游戏界面暂未启动');
    const main = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');
    expect(main).toContain("document.documentElement.dataset.laojieMounted = 'true'");
    expect(legacyPage).toContain('/legacy-app.js');
    expect(legacyPage).toContain('/legacy-app.css');
  });

  it('keeps classic fallback assets available during the Vite development preview', async () => {
    const legacyScript = await readFile(
      new URL('../public/legacy-app.js', import.meta.url),
      'utf8',
    );
    const legacyStyles = await readFile(
      new URL('../public/legacy-app.css', import.meta.url),
      'utf8',
    );
    const legacyConfig = await readFile(
      new URL('../legacy-vite.config.mjs', import.meta.url),
      'utf8',
    );
    expect(legacyScript).toContain('进入品牌局');
    expect(legacyScript).not.toContain('fetch(');
    expect(legacyStyles).toContain('.legacy-fallback');
    expect(legacyConfig).toContain("fileName: () => 'legacy-bundle.js'");
  });

  it('provides a repeatable v1.2 LAN preview command with both student services', async () => {
    const script = await readFile(new URL('../../../start-game-lan.cmd', import.meta.url), 'utf8');
    const readme = await readFile(new URL('../../../README.md', import.meta.url), 'utf8');
    expect(script).toContain('set HOST=0.0.0.0');
    expect(script).toContain('set WEB_PORT=4180');
    expect(script).toContain('set V11_API_PORT=3002');
    expect(script).toContain('findstr /C:"IPv4"');
    expect(script).toContain('start "Laojie Brand Game v1.2 API" /D "%~dp0" "%ComSpec%" /k');
    expect(script).toContain('start "Laojie Brand Game v1.2 Web" /D "%~dp0" "%ComSpec%" /k');
    expect(script).toContain('set DEV_V11_TRIAL_CLASS_CODE=LAOJIE11');
    expect(script).toContain('set "DIST_DIR=%~dp0.vite-cache\\web-dist"');
    expect(script).toContain('call pnpm release:build');
    expect(script).toContain('node apps/api/dist/apps/api/src/v11-server.js');
    expect(script).toContain('node apps/web/static-server.mjs');
    expect(script).toContain('Invoke-WebRequest');
    expect(script).toContain('http://127.0.0.1:3002/ready');
    expect(script).toContain('Services did not become ready');
    expect(script).toContain('Student preview: http://%LAN_IP%:%WEB_PORT%/v11');
    expect(readme).toContain('http://教师电脑IPv4地址:4180/v11');
    expect(readme).toContain('v1.2 API 固定到 `:3002`');
  });

  it('keeps semantic scene pairs behind a duplicate-image gate', async () => {
    const assetCheck = await readFile(
      new URL('../../../scripts/check-v11-assets.mjs', import.meta.url),
      'utf8',
    );
    expect(assetCheck).toContain('distinctVisualPairs');
    expect(assetCheck).toContain('duplicates its corresponding briefing scene');
  });

  it('runs pilot preflight against the published v1.3 content package', async () => {
    const script = await readFile(
      new URL('../../../scripts/pilot-preflight.mjs', import.meta.url),
      'utf8',
    );
    expect(script).toContain('content/compiled/v1.4.0.json');
    expect(script).toContain("compiled.contentVersion === 'v1.4.0'");
  });

  it('maps the public mobile test command to the configured mobile project', async () => {
    const rootPackage = JSON.parse(
      await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };
    expect(rootPackage.scripts?.['test:mobile']).toContain('--project=iphone-webkit');
  });
});
