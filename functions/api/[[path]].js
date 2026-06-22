/**
 * Cloudflare Pages Function: same-origin proxy for the Base44 backend.
 *
 * The app calls the Base44 API at `/api/*` (the Base44 Vite plugin proxies this
 * in development). In production on Cloudflare Pages this Function forwards every
 * `/api/*` request to the Base44 app, so the browser only ever talks to its own
 * origin — no CORS, and the auth token/redirect flow keeps working.
 *
 * Required Pages environment variable (runtime, NOT prefixed with VITE_):
 *   BASE44_APP_BASE_URL = https://<your-app>.base44.app
 */
export async function onRequest(context) {
  const { request, env } = context;
  const base = env.BASE44_APP_BASE_URL;

  if (!base) {
    return new Response(
      JSON.stringify({ error: 'BASE44_APP_BASE_URL is not configured for this Pages project.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const incoming = new URL(request.url);
  const target = base.replace(/\/+$/, '') + incoming.pathname + incoming.search;

  // Preserve method, headers, and body. `duplex: 'half'` is required when
  // streaming a request body in the Workers/undici fetch implementation.
  const proxied = new Request(target, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual', // pass Base44 auth redirects straight back to the client
    duplex: 'half',
  });

  return fetch(proxied);
}
