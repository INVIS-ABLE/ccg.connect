import { defineConfig } from 'drizzle-kit';

// Drizzle config for the Cloudflare D1 schema (migration off Base44).
// `drizzle-kit generate` produces SQL migrations from api/db/schema.ts; they are
// applied to D1 with `npx wrangler d1 migrations apply ccg-connect-db`.
export default defineConfig({
  schema: './api/db/schema.ts',
  out: './api/db/migrations',
  dialect: 'sqlite',
});
