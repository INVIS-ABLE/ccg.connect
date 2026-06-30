/**
 * Cloudflare Turnstile verification (bot protection). Used as a guard in front of
 * sign-up / sign-in. Entirely optional: when TURNSTILE_SECRET_KEY is unset the
 * guard does nothing. When set, a valid token is required.
 *
 * Fails OPEN on a network/parse error (so a Turnstile outage can't lock everyone
 * out) but CLOSED on an explicit "not verified" result.
 */
export async function verifyTurnstile(
  secret: string,
  token: string | undefined,
  ip?: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return true; // fail open on infrastructure errors
  }
}
