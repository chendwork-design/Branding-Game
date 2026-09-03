import { extname } from 'node:path';

/**
 * SPA routes are extensionless.  A missing hashed asset must remain a 404:
 * returning index.html for it makes module loading fail as an opaque blank UI.
 */
export function shouldServeSpaFallback(pathname) {
  return pathname === '/' || extname(pathname) === '';
}

/**
 * Inject the API port into an HTML document without requiring a runtime script
 * to execute. This keeps LAN preview pages usable in embedded browsers that
 * restrict or reorder ordinary script loading.
 */
export function injectV11ApiPort(body, port) {
  return body.replaceAll('__LAOJIE_V11_API_PORT__', String(port));
}
