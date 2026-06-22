# Deploying CCG Connect to Cloudflare (PWA)

CCG Connect is a Vite single-page app that talks to a **Base44 backend**. This
guide hosts the static app on **Cloudflare** and proxies the API to Base44 from
the same origin, so there is no CORS to configure and the Base44 auth
token/redirect flow keeps working. It is also an installable **PWA**.

> **Workers, not classic Pages.** Cloudflare's Git integration now deploys this as
> a **Worker with static assets** (`npx wrangler deploy`), not a classic Pages
> project. A tiny Worker (`worker/index.js`) serves the built SPA from `dist/` and
> proxies `/api/*` to Base44. Classic Pages Functions (`functions/`) and
> `_redirects` are **not** used in this model.

> Base44 still owns the data, auth, functions and the builder. Cloudflare only
> hosts the front-end and proxies `/api/*` to Base44. Nothing about the Base44
> backend changes.

## What's in the repo for this

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker config: `main` = `worker/index.js`, static `assets` from `dist/` with SPA `not_found_handling`. |
| `worker/index.js` | The Worker: proxies `/api/*` → Base44 (`BASE44_APP_BASE_URL`), otherwise serves assets / the SPA shell. |
| `vite.config.js` (`VitePWA`) | Generates `manifest.webmanifest` + service worker (`sw.js`). App-shell precache only; **never** caches `/api`. |
| `public/icon.svg`, `maskable-icon.svg`, `favicon.svg` | Scalable app icons (Android/Chrome/desktop). |
| `public/pwa-192.png`, `pwa-512.png`, `pwa-maskable-{192,512}.png`, `apple-touch-icon.png` | Branded PNG icons (iOS home-screen + broad install compatibility). |
| `public/_headers` | No-cache for `sw.js`/manifest + baseline security headers. |

> SPA routing is handled by the assets binding's
> `not_found_handling: "single-page-application"`, so there is **no** `_redirects`
> file — the Workers asset parser rejects a `/* /index.html 200` catch-all as an
> infinite loop, and it is unnecessary here.

## One-time Cloudflare setup (Git-connected)

1. **Cloudflare dashboard → Workers & Pages → Create → Import a repository.**
2. Pick the `INVIS-ABLE/ccg.connect` repo and the production branch (`main`).
3. **Build settings:**
   - Framework preset: **Vite**.
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (uses `wrangler.jsonc`).
   - Build output directory: `dist`
4. **Environment variables** — add for **Production** *and* **Preview**:

   | Name | Scope | Value |
   | --- | --- | --- |
   | `VITE_BASE44_APP_ID` | Build | Your Base44 app id (see `base44/.app.jsonc`) |
   | `VITE_BASE44_APP_BASE_URL` | Build | `https://<your-app>.base44.app` |
   | `BASE44_APP_BASE_URL` | Runtime (Worker) | `https://<your-app>.base44.app` |

   - `VITE_*` are read at **build time** by the app (SDK app id + the Base44 URL
     used to build login/logout redirects).
   - `BASE44_APP_BASE_URL` (no `VITE_` prefix) is read at **runtime** by the
     Worker proxy. Use the same Base44 URL for all three.
5. **Save and Deploy.** Every push to `main` redeploys; PRs get preview URLs.

## Base44 configuration

In the Base44 app settings, add your Cloudflare origin(s) as **allowed login /
redirect URLs** so the auth round-trip can return to the app:

- `https://<project>.pages.dev`
- your custom domain (if any) — e.g. `https://app.cookconstructiongrowth.co.uk`
- preview origins if you use them (`https://<hash>.<project>.pages.dev`)

This is the field that takes a **full URL** (with `https://`, dots and all).

> ⚠️ **Do _not_ use Base44's "Custom domain" setting for this.** That field is for
> apps served **directly** from Base44 (`*.base44.app`) and only accepts a bare
> hostname **label** (letters/numbers/hyphens, no dots) — so it will reject
> `app.cookconstructiongrowth.co.uk`. In this architecture the front-end is served
> by **Cloudflare** (a Worker), so the domain is attached there (see below); Base44
> only needs the origin added to the **allowed login / redirect URLs** list above.

No CORS allow-list is needed because the browser only ever calls its own origin
(`/api/*`), which the Worker proxies server-side.

## Domains — do I need to buy anything?

**No.** Every Worker gets a free, production-ready subdomain automatically, e.g.
`ccg-connect.<your-subdomain>.workers.dev`. It has HTTPS, the PWA installs from it,
and auth works once the URL is registered in Base44 (see below). You can launch on
this at zero cost.

A custom domain is **optional** and only about branding:

- You don't "buy a subdomain" on its own — you register a **domain** (e.g.
  `cookconstructiongrowth.co.uk`), and subdomains of it (`app.cookconstructiongrowth.co.uk`)
  are then free to create.
- **Already own the domain** → add the `app.` subdomain for free under *Custom
  domain* below. The only thing that ever costs money is registering a brand-new
  domain.

Recommended path: go live on the free `*.workers.dev` URL now, attach the custom
domain when ready — the switch is non-disruptive.

> Whatever URL you use (`*.workers.dev` and/or the custom domain) **must** be added
> to Base44's allowed login/redirect URLs, or sign-in fails after the redirect.

## Custom domain — `app.cookconstructiongrowth.co.uk`

CCG Connect is served as the **`app.` subdomain** of the marketing site
(`cookconstructiongrowth.co.uk`, a separate Cloudflare project). The two stay
independent — this is just a DNS subdomain pointed at this Worker.

1. Workers & Pages → this project → **Settings → Domains & Routes** → **Add →
   Custom domain**.
2. Enter `app.cookconstructiongrowth.co.uk`. The `cookconstructiongrowth.co.uk`
   zone must be active on Cloudflare; the required DNS record (the `app` CNAME) is
   then created and proxied automatically — **not** `base44.onrender.com` (that's
   for Base44-hosted apps only).
3. Wait for the certificate to be issued (status → **Active**).
4. In **Base44 app settings**, add `https://app.cookconstructiongrowth.co.uk` to the
   allowed login / redirect URLs (alongside the `*.workers.dev` URL and any preview
   origins) so the auth round-trip returns to the app.

The marketing site links here via its `NEXT_PUBLIC_PORTAL_URL` env var (defaults
to `https://app.cookconstructiongrowth.co.uk`) — see that repo's README.

## App icons

Both scalable SVG icons and branded PNG icons are committed under `public/` and
wired into `manifest.icons` / `includeAssets` in `vite.config.js`:

- **SVG** (`icon.svg`, `maskable-icon.svg`, `favicon.svg`) — used by
  Android/Chrome/desktop install.
- **PNG** (`pwa-192.png`, `pwa-512.png`, `pwa-maskable-{192,512}.png`,
  `apple-touch-icon.png`) — required for iOS home-screen and broad compatibility.
  `apple-touch-icon.png` (180×180) is referenced from `index.html`.

To regenerate the PNGs after editing the SVG source, rasterise the brand artwork
(any of `rsvg-convert`, `sharp`, or Pillow works), keeping the maskable glyph
inside the ~80% safe zone, e.g.:

```bash
rsvg-convert -w 192 -h 192 public/icon.svg > public/pwa-192.png
rsvg-convert -w 512 -h 512 public/icon.svg > public/pwa-512.png
rsvg-convert -w 180 -h 180 public/icon.svg > public/apple-touch-icon.png
rsvg-convert -w 512 -h 512 public/maskable-icon.svg > public/pwa-maskable-512.png
```

## Verifying the PWA

After a deploy:

- Chrome DevTools → **Application → Manifest**: no errors, icons render.
- **Application → Service Workers**: `sw.js` is activated.
- Lighthouse → **PWA**: installable.
- Confirm `/api/...` requests in the Network tab return data (proxy working) and
  are **not** served from the service worker cache.

## Local production preview

```bash
npm run build
npm run preview   # static preview only — /api proxy is NOT active here
```

The `/api` proxy only runs on Cloudflare. For a full local run that includes the
API proxy, use the dev server (`npm run dev`, which proxies via the Base44 Vite
plugin) or run the Worker locally with `npx wrangler dev` (set `BASE44_APP_BASE_URL`).

## How routing resolves on the Worker

1. `/api/*` → `worker/index.js` proxies to Base44 (`BASE44_APP_BASE_URL`).
2. Existing static file (e.g. `/assets/*.js`, `/sw.js`) → served from `dist/`.
3. Anything else → the Worker calls the assets binding, which serves `/index.html`
   (`not_found_handling: "single-page-application"`); React Router handles it.
