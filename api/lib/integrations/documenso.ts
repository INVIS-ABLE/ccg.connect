import type { Bindings } from '../../env';

/**
 * Documenso e-signature adapter (integration boundary, upgrade plan step 10).
 * A seam for contractor agreements / completion sign-off: when DOCUMENSO_API_KEY
 * is configured a signature request is created; otherwise it reports
 * `configured: false` so the caller can fall back. Not yet wired to a UI flow —
 * ready for one to call it.
 */
export interface SignatureRequest {
  documentTitle: string;
  signerEmail: string;
  signerName?: string;
  /** Authorized URL to the document to be signed (never a public link). */
  fileUrl?: string;
}

export async function requestSignature(
  env: Bindings,
  req: SignatureRequest,
): Promise<{ configured: boolean; id?: string }> {
  const key = env.DOCUMENSO_API_KEY;
  if (!key) return { configured: false };
  try {
    const res = await fetch('https://app.documenso.com/api/v1/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        title: req.documentTitle,
        recipients: [{ email: req.signerEmail, name: req.signerName ?? req.signerEmail, role: 'SIGNER' }],
      }),
    });
    const data = (await res.json().catch(() => null)) as { id?: string | number } | null;
    return { configured: true, id: data?.id != null ? String(data.id) : undefined };
  } catch {
    return { configured: true };
  }
}
