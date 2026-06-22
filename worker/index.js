/**
 * Cloudflare Worker entry for CCG Connect (Workers + static assets).
 *
 * Cloudflare's Git integration deploys this project as a Worker with a static
 * assets binding (see `wrangler.jsonc`), not a classic Pages project — so the
 * SPA and the same-origin API proxy are served from here:
 *
 *   - `/api/*`  → proxied to the Base44 backend (`BASE44_APP_BASE_URL`). The
 *                 browser only ever talks to its own origin, so there is no CORS
 *                 to configure and the Base44 auth token/redirect flow keeps
 *                 working.
 *   - anything else → served from the built assets in `dist/`. Client-side
 *                 routes fall back to `index.html` via the assets binding's
 *                 `not_found_handling: "single-page-application"`.
 *
 * Required Worker environment variable (runtime, NOT prefixed with VITE_):
 *   BASE44_APP_BASE_URL = https://<your-app>.base44.app
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const base = env.BASE44_APP_BASE_URL;
      if (!base) {
        return new Response(
          JSON.stringify({ error: 'BASE44_APP_BASE_URL is not configured for this Worker.' }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        );
      }

      const target = base.replace(/\/+$/, '') + url.pathname + url.search;

      // Preserve method, headers and body. Drop the inbound Host so fetch sets it
      // from the target URL. `duplex: 'half'` is required when streaming a body.
      const headers = new Headers(request.headers);
      headers.delete('host');

      const proxied = new Request(target, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual', // pass Base44 auth redirects straight back to the client
        duplex: 'half',
      });

      return fetch(proxied);
    }

    // Static assets + SPA fallback (handled by the assets binding).
    return env.ASSETS.fetch(request);
  },
};
