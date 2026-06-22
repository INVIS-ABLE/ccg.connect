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
| `public/icon.svg`, `maskable-icon.svg`, `favicon.svg` | App icons (SVG). See *iOS icons* below. |
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

## Domains — do I need to buy anything?

**No.** Every Pages project gets a free, production-ready subdomain automatically,
e.g. `ccg-connect.pages.dev`. It has HTTPS, the PWA installs from it, and auth
works once the URL is registered in Base44 (see below). You can launch on this at
zero cost.

A custom domain is **optional** and only about branding:

- You don't "buy a subdomain" on its own — you register a **domain** (e.g.
  `ccgconnect.com`), and subdomains of it (`app.ccgconnect.com`) are then free to
  create.
- **Already own a domain** → add `app.yourdomain.com` (or the root) for free under
  *Custom domains* below. The only cost is a domain you'd register from scratch.

Recommended path: go live on the free `*.pages.dev` URL now, attach a custom
domain later if you want one — the switch is non-disruptive.

> Whatever URL you use (`*.pages.dev` and/or a custom domain) **must** be added to
> Base44's allowed login/redirect URLs, or sign-in fails after the redirect.

## Custom domain

Pages → your project → **Custom domains** → add the domain and follow the DNS
steps:

- If the domain's DNS is already on Cloudflare, it's a couple of clicks.
- Otherwise, add the `CNAME` record Cloudflare shows you at your DNS provider.

Then add the same origin to Base44's allowed redirect URLs.

## iOS icons (optional polish)

The manifest uses SVG icons, which Android/Chrome/desktop use for install. iOS
home-screen icons require PNG. To get a crisp iOS icon, generate PNGs from
`public/icon.svg` and add them, then reference a `180×180` `apple-touch-icon.png`
in `index.html`:

```bash
# example, requires a rasteriser such as rsvg-convert or sharp
rsvg-convert -w 180 -h 180 public/icon.svg > public/apple-touch-icon.png
rsvg-convert -w 192 -h 192 public/icon.svg > public/pwa-192.png
rsvg-convert -w 512 -h 512 public/icon.svg > public/pwa-512.png
```

Add the PNGs to the `manifest.icons` array in `vite.config.js` alongside the SVGs.

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
