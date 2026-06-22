# Deploying CCG Connect to Cloudflare Pages (PWA)

CCG Connect is a Vite single-page app that talks to a **Base44 backend**. This
guide hosts the static app on **Cloudflare Pages** and proxies the API to Base44
from the same origin, so there is no CORS to configure and the Base44 auth
token/redirect flow keeps working. It is also an installable **PWA**.

> Base44 still owns the data, auth, functions and the builder. Cloudflare only
> hosts the front-end and proxies `/api/*` to Base44. Nothing about the Base44
> backend changes.

## What's in the repo for this

| File | Purpose |
| --- | --- |
| `vite.config.js` (`VitePWA`) | Generates `manifest.webmanifest` + service worker (`sw.js`). App-shell precache only; **never** caches `/api`. |
| `public/icon.svg`, `maskable-icon.svg`, `favicon.svg` | Scalable app icons (Android/Chrome/desktop). |
| `public/pwa-192.png`, `pwa-512.png`, `pwa-maskable-{192,512}.png`, `apple-touch-icon.png` | Branded PNG icons (iOS home-screen + broad install compatibility). |
| `functions/api/[[path]].js` | Pages Function proxying `/api/*` → Base44. |
| `public/_redirects` | SPA fallback (`/* /index.html 200`). |
| `public/_headers` | No-cache for `sw.js`/manifest + baseline security headers. |

## One-time Cloudflare setup (Git-connected)

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.**
2. Pick the `INVIS-ABLE/ccg.connect` repo and the production branch (`main`).
3. **Build settings:**
   - Framework preset: **Vite** (or "None").
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: *(leave default)*
4. **Environment variables** — add for **Production** *and* **Preview**:

   | Name | Scope | Value |
   | --- | --- | --- |
   | `VITE_BASE44_APP_ID` | Build | Your Base44 app id (see `base44/.app.jsonc`) |
   | `VITE_BASE44_APP_BASE_URL` | Build | `https://<your-app>.base44.app` |
   | `BASE44_APP_BASE_URL` | Runtime (Functions) | `https://<your-app>.base44.app` |

   - `VITE_*` are read at **build time** by the app (SDK app id + the Base44 URL
     used to build login/logout redirects).
   - `BASE44_APP_BASE_URL` (no `VITE_` prefix) is read at **runtime** by the
     proxy Function. Use the same Base44 URL for all three.
5. **Save and Deploy.** Every push to `main` redeploys; PRs get preview URLs.

## Base44 configuration

In the Base44 app settings, add your Cloudflare origin(s) as **allowed login /
redirect URLs** so the auth round-trip can return to the app:

- `https://<project>.pages.dev`
- your custom domain (if any)
- preview origins if you use them (`https://<hash>.<project>.pages.dev`)

No CORS allow-list is needed because the browser only ever calls its own origin
(`/api/*`), which the Function proxies server-side.

## Custom domain — `app.cookconstructiongrowth.co.uk`

CCG Connect is served as the **`app.` subdomain** of the marketing site
(`cookconstructiongrowth.co.uk`, a separate Cloudflare project). The two stay
independent — this is just a DNS subdomain pointed at this Pages project.

1. Pages → this project → **Custom domains** → **Set up a custom domain**.
2. Enter `app.cookconstructiongrowth.co.uk`. If the apex `cookconstructiongrowth.co.uk`
   zone is already on Cloudflare, the required `CNAME` (`app` →
   `<project>.pages.dev`) is added automatically; otherwise add it at your DNS
   provider as shown.
3. Wait for the certificate to be issued (status → **Active**).
4. In **Base44 app settings**, add `https://app.cookconstructiongrowth.co.uk` to the
   allowed login / redirect URLs (alongside `https://<project>.pages.dev` and any
   preview origins) so the auth round-trip returns to the app.

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
plugin) or `npx wrangler pages dev dist` with `BASE44_APP_BASE_URL` set.

## How routing resolves on Pages

1. `/api/*` → Pages Function (`functions/api/[[path]].js`) → Base44.
2. Existing static file (e.g. `/assets/*.js`, `/sw.js`) → served directly.
3. Anything else → `_redirects` serves `/index.html` (SPA), React Router handles it.
