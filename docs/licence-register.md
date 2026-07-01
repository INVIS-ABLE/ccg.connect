# Licence register

CCG Connect is a **private, proprietary** platform. This register tracks two
things so that stays true:

1. **Blueprints we studied** — third-party projects whose *workflows and ideas*
   informed our features, whose **source we did not copy**.
2. **Third-party code we actually ship** — runtime/build dependencies and the
   licences they carry.

Keep this file up to date whenever a feature is modelled on an external project,
or a dependency with a noteworthy licence is added or removed.

> **Golden rule:** do **not** paste source from a copyleft (GPL/AGPL) project
> into this repository. Recreate the behaviour in our own stack. If copying
> source ever becomes genuinely necessary, obtain **legal review first** and
> record the decision here before merging.

## 1. Blueprints studied (workflow inspiration only — no source copied)

These projects were read to understand *how* field-service management problems
are modelled. We reimplemented the relevant workflows from scratch in CCG's own
stack (Hono + D1 + Drizzle on Cloudflare Workers; React + shadcn/ui frontend).
No code, assets, schema files, or templates were copied from any of them.

| Project | Licence | Why it's sensitive | What we took (ideas only) |
| --- | --- | --- | --- |
| Beveren FSM | AGPL-3.0 | Strong copyleft; the network clause would reach a hosted SaaS. Copying source would force AGPL terms on this private platform. | Dispatch/scheduling concepts behind the Visual Dispatch Console (board → timeline → map). |
| FieldOpt | AGPL-3.0 | As above. | General field-operations patterns (deployments, roll-call, site evidence). |
| InspectionPress | GPL-3.0 | Strong copyleft. | Inspection / forms / KID document workflow concepts. |

**Features recreated from these blueprints so far:** Visual Dispatch Console
(§3 — PRs #110/#111/#112), rapid site photo evidence (§6), materials & dynamic
pricing surcharges (§8). All authored natively in this repo; see the PR history
for provenance.

## 2. Dependencies we ship

Licences verified from each package's `package.json` at the time of writing.
All are permissive (OSI-approved, non-copyleft) unless noted.

### Runtime — actually imported

| Package | Licence | Used for |
| --- | --- | --- |
| `maplibre-gl` | BSD-3-Clause | Dispatch map (`CoverageMap`) |
| `@fullcalendar/*` (react, daygrid, timegrid, interaction) | MIT | Dispatch & schedule timelines |
| `@hello-pangea/dnd` | Apache-2.0 | Drag-and-drop assignment |
| `@turf/helpers`, `@turf/circle`, `@turf/distance` | MIT | Geo helpers (`src/domain/geo`) |
| `frappe-gantt` | MIT | Project Gantt (Schedule page) |
| `react`, `react-router-dom` | MIT | UI / routing |
| `@tanstack/react-query` | MIT | Data fetching |
| `hono` | MIT | Worker HTTP framework |
| `drizzle-orm` | Apache-2.0 | D1 query builder / schema |
| `better-auth` | MIT | Authentication |
| `tailwindcss`, `vite` | MIT | Styling / build |
| shadcn/ui + Radix primitives | MIT | Component library |

### Map tile data

- **OpenStreetMap raster tiles** — map **data** is ODbL, tiles © OpenStreetMap
  contributors. Attribution is rendered on the map by `CoverageMap`. If tile
  usage grows, move to a keyed vector provider (e.g. MapTiler) per that
  component's note.

### Declared but not imported

| Package | Licence | Note |
| --- | --- | --- |
| `react-leaflet` | Hippocratic-2.1 (not OSI-approved) | Present in `package.json` but **not imported** anywhere in `src/`. The map uses `maplibre-gl` directly. Recommend removing it to avoid shipping a non-standard licence; until then it is dead weight, not distributed in the bundle. |

## Process

- Adding a dependency with a **copyleft** or **non-OSI** licence → flag it in the
  PR and record it here (or, preferably, choose a permissive alternative).
- Modelling a feature on an external project → add a row to §1, and **never**
  copy its source.
- This register is descriptive, not legal advice. Material licensing decisions
  should be confirmed with a qualified reviewer.
