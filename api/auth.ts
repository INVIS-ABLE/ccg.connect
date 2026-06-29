import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { drizzle } from 'drizzle-orm/d1';
import * as authSchema from './db/auth-schema';

/**
 * Better Auth instance for CCG Connect (Phase 2).
 *
 * Created per request because Cloudflare bindings (the D1 database, secrets) are
 * request-scoped. Provides email/password, email OTP and — when the matching
 * secrets are configured — social sign-in. Sessions and accounts persist in D1
 * via the Drizzle adapter (see api/db/auth-schema.ts).
 *
 * NOTE: not yet wired to the front-end or the deployed Worker — the app still
 * authenticates via Base44 until the Phase 2b cutover.
 */
export type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // One-time first-admin bootstrap (see routes/adminBootstrap.ts). When unset the
  // bootstrap route is disabled. Provision transiently via `wrangler secret put`.
  ADMIN_BOOTSTRAP_SECRET?: string;
  // Optional integrations (step 10). Unset → in-app only / signature seam inert.
  NOVU_API_KEY?: string;
  // Novu API base. Defaults to EU (UK/Europe). Set to https://api.novu.co for US.
  NOVU_API_URL?: string;
  DOCUMENSO_API_KEY?: string;
};

export function createAuth(env: AuthEnv) {
  const db = drizzle(env.DB);

  const socialProviders =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    emailAndPassword: { enabled: true },
    socialProviders,
    plugins: [
      emailOTP({
        // TODO(Phase 4): deliver via the email adapter. Logged for now so the
        // backend is testable before email integration lands.
        async sendVerificationOTP({ email, otp }) {
          console.log(`[auth] email OTP for ${email}: ${otp}`);
        },
      }),
    ],
  });
}
