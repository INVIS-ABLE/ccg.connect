import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Cloudflare D1 schema (Drizzle) — migration off Base44.
 *
 * Phase 0 starter: a single reference table that proves the D1 + Drizzle +
 * migration pipeline end to end. The full 27-entity model (Job, ContractorProfile,
 * Timesheet, Invoice, …) lands in Phase 1 — see docs/migration-to-cloudflare.md.
 *
 * Conventions for the full model:
 *   - `id` text primary key (matches Base44's string ids so data migrates cleanly)
 *   - `created_at` / `updated_at` as epoch-ms integers (`mode: 'timestamp'`)
 *   - enums stored as `text`; booleans as integer (`mode: 'boolean'`)
 *   - relations expressed as `<entity>_id` text columns
 */
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  trade_category: text('trade_category'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});
