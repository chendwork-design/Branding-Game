// The production static server replaces this with the API addresses for its
// current environment. Local Vite development keeps an empty configuration so
// it can use the documented same-host development ports. Cloudflare Pages is a
// static host, however, so it cannot perform that replacement at request time.
// Keep the public production API origin here as a safe fallback when a Pages
// build variable is absent; an injected configuration still has precedence.
(function configureRuntimeApi(windowObject) {
  const config = (windowObject.__LAOJIE_RUNTIME_CONFIG__ =
    windowObject.__LAOJIE_RUNTIME_CONFIG__ || {});
  if (
    windowObject.location?.hostname === 'branding-game.pages.dev' &&
    !config.v11ApiBase
  )
    config.v11ApiBase = 'https://api-v2-production-6e81.up.railway.app';
})(window);
