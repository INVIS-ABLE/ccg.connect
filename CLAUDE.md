# CLAUDE.md — CCG Connect

Guidance for working in this repository. Read this before making changes.

## Business purpose

CCG Connect is a **private** job-management platform for Cook Construction Growth.
It sources construction work, maintains an **approved** contractor network, matches
suitable contractors to jobs, keeps the owner (Lee) in final control, manages
contractor credentials, stores job communications and site evidence, processes
timesheets and invoices, and gives clients controlled visibility.

It is **not** an open marketplace. Do **not** introduce public bidding, public
contractor rankings, or automatic assignment.

## Tech stack

- React 18 + Vite 6, JavaScript (`.jsx`) with a TypeScript toolchain available
  (`jsconfig.json`, `tsc`). New domain logic should be authored in TypeScript.
- Base44 platform: data via `@base44/sdk` entities; server logic via Base44
  functions (Deno) under `base44/functions/*`; auth via the Base44 SDK.
- UI: Tailwind + shadcn/ui (Radix) components under `src/components/ui`.
- Routing: `react-router-dom`. Data fetching: `@tanstack/react-query` (available,
  largely unused — pages mostly call the SDK directly in `useEffect`).

## User roles

`UserProfile.role` ∈ `owner | ops_admin | contractor | client` (the Base44
platform `User.role` is only `admin | user` and must not be conflated with these).
Helpers live in `src/lib/roles.js` (`isAdmin`, `isOwner`, `isContractor`,
`isClient`). `owner` + `ops_admin` are the privileged "admin" roles.

## Security invariants (non-negotiable)

1. Contractors access **only their own** profile, credentials, offers,
   assignments, messages, timesheets and invoices.
2. Clients access **only their own** organisation and jobs.
3. Client access to media or credentials requires **explicit** client visibility
   (`client_visible` / shared credential pack).
4. Public visitors may **create** a Lead but may **never read** submitted leads.
5. Users **cannot promote their own role**. Role changes are an admin action and
   must be audited.
6. Internal notes (`internal_notes`, `private_admin_notes`) are **never** included
   in any client or contractor response.
7. Audit records are **append-only** from the live application.
8. Private file URLs must not be publicly enumerable.
9. **Server-side** permission checks must exist for every privileged operation.
   Frontend hiding is **not** security.
10. Secrets are never committed and never returned to the browser.
11. Sensitive actions must generate audit events.
12. Assignment always requires an authorised admin action.
13. Automated matching must be explainable and **cannot** make the final assignment.

> **Where enforcement lives:** the frontend talks directly to Base44 entities, so
> real authorization MUST be enforced by Base44 entity RLS rules (configured in
> the Base44 builder) and by backend functions — never by the React UI alone.
> The `base44/entities/*.jsonc` files in this repo define **schema only**, not RLS.

## Data ownership rules

- A `ContractorProfile`/`Client`/`UserProfile` is owned by its `user_id`.
- `Job`, `JobMedia`, `JobMessage`, `Timesheet`, `Invoice` are scoped to a job and,
  transitively, to the client and the assigned contractor(s).
- Visibility flags (`client_visible`, `contractor_visible`, `internal_only`,
  credential `visibility`) gate cross-role exposure and default to the most
  private setting.

## Coding conventions

- Prefer **TypeScript** for new domain logic; enable strict checks; avoid `any`
  unless documented and unavoidable.
- Put business rules in **reusable domain services** (`src/domain/<module>/`), not
  inline in pages. Pages orchestrate; services decide.
- Keep components focused. Every data view needs **loading / empty / success /
  error** states.
- Validate on **both** client and server. Sanitise user-created content.
- Use structured error handling; never silently swallow failures. Log meaningfully
  **without** logging personal data or secrets.
- Preserve Base44 runtime compatibility (SDK import style, entity names, function
  signatures).

## Base44 SDK rules

- Client: `import { base44 } from '@/api/base44Client'`.
- Entities: `base44.entities.<Entity>.{list,filter,create,update}`.
- Functions: `base44.functions.invoke('<name>', payload)`.
- Integrations: `base44.integrations.Core.{UploadFile,SendEmail,...}`.
- In Base44 functions use `createClientFromRequest(req)`; use
  `base44.asServiceRole.*` **only** for trusted server-side work (e.g. scheduled
  jobs) and re-check authorization explicitly.
- Entity field names are the integration contract — exports and functions must use
  stable field names. Schema changes need a migration/compatibility note.

## Integration boundaries

External systems are reached only through interfaces (adapters): Google Drive,
Google Sheets, accounting platform, SMS, WhatsApp, geocoding, PDF generation, email.
Domain code requests an action; it must not depend on a concrete provider. Store
external resource IDs (e.g. Drive folder IDs), not just names. Retry transient
failures; record sync status; log failures without leaking PII.

## Test commands

- Type check: `npm run typecheck`
- Lint: `npm run lint` (fix: `npm run lint:fix`)
- Unit/integration tests: **none configured yet** — to be added (Vitest planned).

## Build commands

- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

## Definition of done

A change is done only when: server-side permission checks exist; validation exists
(client + server); errors are handled; mobile layout works; accessibility is
considered; tests pass; audit events exist where required; no secrets are exposed;
documentation is updated; and Base44 compatibility is preserved.

---

## Scoped rules

### Authentication & permissions (`src/lib`, `ProtectedRoute`, functions)
- `ProtectedRoute` currently checks **authentication only**, not role. Privileged
  routes must additionally be role-guarded, and the matching server-side check is
  mandatory regardless of the UI guard.
- Never trust `UserProfile.role` written by a non-admin; role changes go through an
  audited admin path.

### Database entities (`base44/entities/*.jsonc`)
- These files are **schema only**. Any new entity or field must be paired with the
  corresponding Base44 RLS rules and a note in the PR describing the access model.
- Don't hard-delete records that may be under retention; mark `archived`/`superseded`.

### File uploads (`base44.integrations.Core.UploadFile`, `JobMedia`)
- Validate file type and size; compress images before upload where suitable.
- Default `client_visible` to **false**. Associate every upload with a job.
- Capture `captured_at`; collect location **only** with explicit permission.

### Notifications (`Notification` entity + future notification service)
- Go through a channel-independent service with adapters (in-app/email/SMS/
  WhatsApp/push). Make sends idempotent; record `delivery_status`; never embed
  public media links — use secure links.

### Tests
- New matching, timesheet and invoice logic requires unit tests covering
  boundaries (expiry dates, distance, date conflicts, overnight shifts, rounding,
  duplicates, approval/correction states, VAT).
- Permission-related changes require permission tests.

### UI components (`src/components`, `src/pages`)
- Reuse `src/components/ui/*`. Provide large touch targets, visible focus, form
  labels, and status not conveyed by colour alone. Avoid horizontal scroll in
  primary mobile workflows.
</content>
