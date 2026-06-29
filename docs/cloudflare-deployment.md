# Deploying CCG Connect to Cloudflare (PWA)

CCG Connect is a **fully Cloudflare-native** app: a Vite/React SPA served by a
**Cloudflare Worker** (Hono) that also is the backend — data in **D1**, auth via
**Better Auth**, files in **R2** (later). There is **no Base44** and no external
backend or proxy. It is an installable **PWA**.

> History: the app was previously a Base44 front-end. Base44 has been removed —
> the Worker now owns auth, data and logic. The migration plan and phases are in
> `docs/migration-to-cloudflare.md`.

## What's in the repo for this

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker config: `main` = `api/index.ts`, static `assets` from `dist/` (SPA `not_found_handling`), D1 binding. |
| `api/index.ts` | The Hono Worker: `/api/auth/*` (Better Auth), authorized resource routes (`/api/me`, `/api/jobs`, …), else static assets / SPA. |
| `api/db/schema.ts`, `auth-schema.ts`, `migrations/` | Drizzle schema + D1 migrations. |
| `src/domain/permissions/` | Server-side authorization rules (unit-tested). |
| `vite.config.js` (`VitePWA`) | `manifest.webmanifest` + service worker; app-shell precache. |
| `public/*.png`, `*.svg` | App icons (PNG for iOS, SVG for the rest). |
| `public/_headers` | `no-cache` for `sw.js`/manifest + baseline security headers. |

## One-time Cloudflare setup (Git-connected)

1. **Workers & Pages → Create → Import a repository** → `INVIS-ABLE/ccg.connect`, branch `main`.
2. **Build settings:** framework **Vite**, build command `npm run build`, deploy command `npx wrangler deploy`, output `dist`.
3. **Save and Deploy.** Every push to `main` redeploys; PRs get preview URLs.

## Secrets & environment

Set on the Worker (Settings → Variables and Secrets, or `wrangler secret put`):

| Name | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Better Auth signing secret (a long random string). |
| `BETTER_AUTH_URL` | The app's canonical URL, e.g. `https://app.cookconstructiongrowth.co.uk`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *(optional)* enables Google sign-in. |

```bash
openssl rand -base64 32 | npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
```

> The old `VITE_BASE44_*` / `BASE44_APP_BASE_URL` variables are obsolete and can be
> deleted from the project.

## Bootstrapping the first admin (owner)

Every privileged action is admin-gated, so the **first** `owner` account must be
created out of band — there is no admin yet to promote it. Use the one-time
bootstrap route (`POST /api/admin/bootstrap`, see `api/routes/adminBootstrap.ts`).
It is disabled unless `ADMIN_BOOTSTRAP_SECRET` is set, self-disables once any
owner exists, and hashes the password via Better Auth. **The password is never
committed to the repo or stored in plaintext** — you supply it at request time.

```bash
# 1. Set a throwaway bootstrap secret on the Worker.
openssl rand -base64 32 | npx wrangler secret put ADMIN_BOOTSTRAP_SECRET
# (note the value it prints / that you piped in — you need it for the next call)

# 2. Create the first owner. Replace the secret, email and password.
#    The password is sent only over TLS at request time; do not hard-code it anywhere.
curl -sS -X POST https://app.cookconstructiongrowth.co.uk/api/admin/bootstrap \
  -H "content-type: application/json" \
  -H "x-bootstrap-secret: <THE_SECRET_FROM_STEP_1>" \
  -d '{"email":"invis-able@outlook.com","password":"<CHOSEN_PASSWORD>","name":"Admin"}'

# 3. Delete the secret so the route is permanently disabled again.
npx wrangler secret delete ADMIN_BOOTSTRAP_SECRET
```

The new owner then signs in normally at `/api/auth` (email + password). Further
admins are created by promoting existing users via `PATCH /api/admin/users/:id/role`.

## External integrations (optional)

In-app notifications and the e-signature button work without any of these. They
light up the moment the matching secret is set — no code change.

| Secret | Enables |
| --- | --- |
| `NOVU_API_KEY` | External notification channels (email/SMS/push) behind the in-app bell, via Novu. |
| `DOCUMENSO_API_KEY` | The "Request client e-signature" action on a job (Documenso). |

```bash
npx wrangler secret put NOVU_API_KEY
npx wrangler secret put DOCUMENSO_API_KEY
```

- **Novu:** every in-app notification also triggers a Novu event named after the
  notification type (`job_assigned`, `timesheet_approved`, `timesheet_returned`),
  with `subscriberId` = the user id and `{ title, body, deepLink }` payload.
  Create matching workflows in Novu and add the user as a subscriber to receive
  external channels. Without the key, only the in-app bell fires.
- **Documenso:** the job page's "Request client e-signature" calls Documenso for
  the job's client. Without the key the button reports that e-signatures aren't
  enabled. Configure the document template/fields on the Documenso side.

## Database (D1)

The D1 database is bound as `DB` in `wrangler.jsonc`. Apply migrations after schema
changes:

```bash
npx wrangler d1 migrations apply ccg-connect-db --remote   # production
# omit --remote (or use --local) for the local dev database
```

Inspect tables: `npx wrangler d1 execute ccg-connect-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"`

## Custom domain — `app.cookconstructiongrowth.co.uk`

1. Workers & Pages → this project → **Settings → Domains & Routes → Add → Custom domain**.
2. Enter `app.cookconstructiongrowth.co.uk` (the zone must be on Cloudflare; the
   `app` record is created automatically).
3. Set `BETTER_AUTH_URL` to that origin so sign-in redirects resolve correctly.

The marketing site links here via its `NEXT_PUBLIC_PORTAL_URL` env var (defaults to
`https://app.cookconstructiongrowth.co.uk`).

## How routing resolves on the Worker

1. `/api/auth/*` → Better Auth; `/api/health` → liveness.
2. `/api/me`, `/api/jobs`, `/api/profiles`, `/api/assignments` → native authorized routes.
3. Other `/api/*` → `404` (built out slice by slice).
4. Existing static file (`/assets/*.js`, `/sw.js`) → served from `dist/`.
5. Anything else → assets binding serves `/index.html` (SPA); React Router handles it.

## Verifying the PWA

After a deploy: Chrome DevTools → **Application → Manifest** (no errors) and
**Service Workers** (`sw.js` active); Lighthouse → **PWA** installable.

## App icons

SVG + branded PNG icons live under `public/` and are wired into `manifest.icons` /
`includeAssets` in `vite.config.js`. Regenerate PNGs from the SVG source with any
rasteriser (`rsvg-convert`, `sharp`, Pillow), keeping the maskable glyph in the
~80% safe zone.

## Local development

```bash
npm run dev                 # Vite dev server (UI)
npx wrangler dev            # run the Worker (API + D1) locally
npm run build && npx wrangler dev   # full production-like run
```
