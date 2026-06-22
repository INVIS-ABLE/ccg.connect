# Migrating CCG Connect off Base44 → Cloudflare-native

Goal: remove the Base44 dependency and run the whole platform on Cloudflare —
**cost** (no Base44 plan), **no vendor lock-in**, and **one stack to operate**.
The React/Vite front-end stays; everything it talks to is rebuilt on Cloudflare.

> **This is a backend re-platforming, not a config change.** It ships in phases;
> the app keeps working throughout. The hard, security-critical part is the
> authorization layer (Phase 3) — today Base44's RLS is the only thing enforcing
> per-role data isolation, and we take ownership of that.

## Target architecture

| Concern | Base44 today | Cloudflare-native replacement |
| --- | --- | --- |
| Front-end host | Cloudflare Worker (already) | unchanged |
| API / business logic | direct entity calls + RLS | **Hono** API on a Cloudflare Worker, enforcing all permission checks server-side |
| Database | 27 Base44 entities | **D1** (SQLite) + **Drizzle ORM** (schema, migrations, types) |
| Auth | `base44.auth.*` (email/pw, OTP, OAuth, reset, sessions) | **Better Auth** (self-hosted on Workers/D1) |
| Authorization (RLS) | Base44 RLS rules | per-route checks in the API, encoding the 13 invariants, with permission tests |
| File storage | `integrations.Core.UploadFile` | **R2** + signed URLs |
| Scheduled work | `credentialExpiryAlerts` function | **Cron Trigger** Worker |
| Matching | `matchContractors` function | API route (explainable; never auto-assigns) |
| Email / SMS / WhatsApp | Base44 integrations | provider adapters called from the Worker (e.g. Resend/MailChannels, Twilio) |
| Secrets | Base44 | `wrangler secret` / Worker env |

## Inventory (what has to move)

- **27 entities** → D1 tables: AuditEvent, CalendarEvent, ChecklistTemplate(+Item),
  Client, ContractorAvailability, ContractorCredential, ContractorProfile,
  ContractorSkill, CredentialType, Invoice, Job, JobAssignment, JobChecklistItem,
  JobDocument, JobMatch, JobMedia, JobMessage, JobRequiredCredential,
  JobRequiredSkill, JobThread, Lead, Notification, Skill, Timesheet,
  TimesheetEntry, User, UserProfile.
- **3 server functions** → Workers: `api` (proxy, becomes obsolete),
  `matchContractors`, `credentialExpiryAlerts` (cron).
- **~120 SDK call sites** in `src/` → routed through the new API client.
- **Full auth surface**: `me`, `loginViaEmailPassword`, `loginWithProvider`,
  `verifyOtp`, `resendOtp`, `register`, `resetPasswordRequest`, `resetPassword`,
  `setToken`, `logout`, `redirectToLogin`.
- **1 upload** path (`UploadFile`, JobMedia) → R2.

## Security invariants to re-implement (non-negotiable)

These are enforced by Base44 RLS today and become **our** responsibility in the
API layer. Each needs a permission test (see CLAUDE.md → Tests):

1. Contractors read/write **only their own** profile, credentials, offers,
   assignments, messages, timesheets, invoices.
2. Clients access **only their own** organisation and jobs.
3. Media/credential exposure requires explicit `client_visible` / shared pack.
4. Public can **create** a Lead, never **read** leads.
5. No self-role-promotion; role changes are audited admin actions.
6. `internal_notes` / `private_admin_notes` never in client/contractor responses.
7. Audit records append-only.
8. Private file URLs not publicly enumerable (signed R2 URLs).
9. Server-side checks on **every** privileged operation.
10. Secrets never returned to the browser.
11. Sensitive actions emit audit events.
12. Assignment is always an authorised admin action.
13. Automated matching is explainable and never makes the final assignment.

## Phases (each ships independently; app stays live)

### Phase 0 — Scaffolding *(reversible, no behaviour change)*
- Add Hono API Worker skeleton, Drizzle + D1 wiring, Better Auth config.
- Add `wrangler.jsonc` D1 binding (placeholder `database_id`).
- CI: typecheck/lint/test cover the new `api/` code.
- **Manual prerequisite:** create the D1 database (see below).

### Phase 1 — Schema
- Translate the 27 entity `.jsonc` definitions into Drizzle tables + relations.
- Generate the first migration; seed reference data (Skill, CredentialType).

### Phase 2 — Auth cutover
- Implement Better Auth endpoints (email/pw, OTP, OAuth, reset, sessions).
- Swap the front-end `base44.auth.*` calls to the new client; keep `UserProfile`
  role model (`owner | ops_admin | contractor | client`).

### Phase 3 — API + authorization *(the crux)*
- Build entity endpoints with per-role checks encoding the invariants above.
- Add permission tests for every protected path.
- Migrate the ~120 call sites **entity-by-entity**, lowest-risk first
  (`Skill`, `CredentialType`) → highest-risk last (`Invoice`, `Timesheet`,
  `JobMedia`). Each entity is its own small PR.

### Phase 4 — Functions, files, integrations
- Port `matchContractors` (API route) and `credentialExpiryAlerts` (Cron Trigger).
- Move uploads to R2 with signed URLs and the existing validation rules.
- Wire email/SMS/WhatsApp provider adapters.

### Phase 5 — Data migration + cutover
- Export Base44 data → import into D1 (script, stable field names preserved).
- Flip the front-end to the new API; smoke-test all roles.
- Decommission Base44; remove `@base44/sdk` and the proxy.

## Manual prerequisites (Cloudflare account — can't be scripted from the repo)

1. **Create the D1 database** and paste its id into `wrangler.jsonc`:
   ```bash
   npx wrangler d1 create ccg-connect-db
   # → copy "database_id" into the d1_databases binding
   ```
2. **Create an R2 bucket** (Phase 4): `npx wrangler r2 bucket create ccg-connect-media`.
3. **Set secrets** (Phase 2+): `npx wrangler secret put BETTER_AUTH_SECRET`, plus any
   OAuth client id/secret and email/SMS provider keys.

## Risks & notes

- **Authorization is the whole ballgame.** Until Phase 3 is complete and tested,
  Base44 stays the source of truth — do **not** point the front-end at a
  half-built API.
- **Data migration is one-way-ish.** Keep Base44 read-only during cutover and
  retain an export.
- **D1 limits** (SQLite, 10 GB/db) are comfortable for this workload; revisit only
  if scale changes.
- Estimated effort: multiple weeks, but value lands incrementally each phase.
