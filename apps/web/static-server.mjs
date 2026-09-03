import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectV11ApiPort, shouldServeSpaFallback } from './static-server-utils.mjs';

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  process.env.DIST_DIR ?? '../../.vite-cache/web-dist',
);
const apiPort = process.env.API_PORT ?? '3000';
const v11ApiPort = process.env.V11_API_PORT ?? '3001';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
};
async function readAsset(candidate) {
  const body = await readFile(candidate);
  if (extname(candidate) !== '.html') return body;
  return injectV11ApiPort(body.toString(), v11ApiPort);
}
function buildSecurityHeaders(requestHost) {
  const origin = `http://${requestHost ?? `127.0.0.1:${process.env.PORT ?? 4173}`}`;
  const apiOrigin = origin.replace(/:\d+$/, `:${apiPort}`);
  const v11ApiOrigin = origin.replace(/:\d+$/, `:${v11ApiPort}`);
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': `default-src 'self'; connect-src 'self' ${apiOrigin} ${v11ApiOrigin}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'`,
  };
}
const server = createServer(async (request, response) => {
  const securityHeaders = buildSecurityHeaders(request.headers.host);
  const requested = normalize(request.url?.split('?')[0] ?? '/')
    .replace(/^[\\/]+/, '')
    .replace(/^([.][.][\\/])+/, '');
  if (requested === 'runtime-config.js') {
    const origin = `http://${request.headers.host ?? `127.0.0.1:${process.env.PORT ?? 4173}`}`;
    const config = `window.__LAOJIE_RUNTIME_CONFIG__ = ${JSON.stringify({ apiBase: `${origin.replace(/:\d+$/, `:${apiPort}`)}`, v11ApiBase: `${origin.replace(/:\d+$/, `:${v11ApiPort}`)}` })};`;
    response.writeHead(200, {
      ...securityHeaders,
      'cache-control': 'no-store',
      'content-type': 'text/javascript; charset=utf-8',
    });
    response.end(config);
    return;
  }
  const candidate = join(root, requested === '/' ? 'index.html' : requested);
  try {
    const body = await readAsset(candidate);
    response.writeHead(200, {
      ...securityHeaders,
      'cache-control':
        extname(candidate) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      'content-type': types[extname(candidate)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch {
    if (!shouldServeSpaFallback(requested)) {
      response.writeHead(404, {
        ...securityHeaders,
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('Not found');
      return;
    }
    const body = await readAsset(join(root, 'index.html'));
    response.writeHead(200, {
      ...securityHeaders,
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(body);
  }
});
server.listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit(0)));
