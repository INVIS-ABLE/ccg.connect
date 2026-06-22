import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

/**
 * Better Auth browser client. Talks to the Worker's /api/auth/* endpoints on the
 * same origin (session cookies), so no baseURL is needed. Exposes sign-in/up,
 * sign-out, email-OTP and the `useSession` hook.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
