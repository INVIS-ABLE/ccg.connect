import type { Bindings } from '../../env';

/**
 * Novu adapter (integration boundary). The in-app notification is always written
 * to D1; if NOVU_API_KEY is configured, we also trigger Novu to deliver external
 * channels (email/SMS/WhatsApp/push) behind the same bell.
 *
 * The subscriber's contact details (email/phone/name) are sent on every trigger,
 * so Novu upserts the subscriber and can actually deliver email/SMS without any
 * manual subscriber management. Defaults to the EU region (UK/Europe data
 * residency — api base https://eu.api.novu.co); set NOVU_API_URL to
 * https://api.novu.co only if your Novu account is in the US region. No key → no-op.
 */
export async function novuTrigger(
  env: Bindings,
  payload: {
    userId: string;
    type: string;
    title: string;
    body: string;
    deepLink?: string | null;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
): Promise<{ configured: boolean }> {
  const key = env.NOVU_API_KEY;
  if (!key) return { configured: false };

  const base = (env.NOVU_API_URL?.replace(/\/$/, '') || 'https://eu.api.novu.co');
  const to: Record<string, unknown> = { subscriberId: payload.userId };
  if (payload.email) to.email = payload.email;
  if (payload.phone) to.phone = payload.phone;
  if (payload.firstName) to.firstName = payload.firstName;
  if (payload.lastName) to.lastName = payload.lastName;

  try {
    await fetch(`${base}/v1/events/trigger`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `ApiKey ${key}` },
      body: JSON.stringify({
        name: payload.type,
        to,
        payload: { title: payload.title, body: payload.body, deepLink: payload.deepLink ?? null },
      }),
    });
  } catch {
    /* best-effort: in-app notification already delivered */
  }
  return { configured: true };
}
