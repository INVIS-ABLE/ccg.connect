import type { Bindings } from '../../env';

/**
 * Novu adapter (integration boundary). The in-app notification is always written
 * to D1; if NOVU_API_KEY is configured, we also trigger Novu to deliver external
 * channels (email/SMS/WhatsApp/push) behind the same bell. No key → no-op, so the
 * app works fully without the external service.
 */
export async function novuTrigger(
  env: Bindings,
  payload: { userId: string; type: string; title: string; body: string; deepLink?: string | null },
): Promise<{ configured: boolean }> {
  const key = env.NOVU_API_KEY;
  if (!key) return { configured: false };
  try {
    await fetch('https://api.novu.co/v1/events/trigger', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `ApiKey ${key}` },
      body: JSON.stringify({
        name: payload.type,
        to: { subscriberId: payload.userId },
        payload: { title: payload.title, body: payload.body, deepLink: payload.deepLink ?? null },
      }),
    });
  } catch {
    /* best-effort: in-app notification already delivered */
  }
  return { configured: true };
}
