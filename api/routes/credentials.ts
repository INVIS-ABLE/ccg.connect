import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, desc } from 'drizzle-orm';
import { contractorCredentials, credentialTypes } from '../db/schema';
import { requireAuth } from '../lib/session';
import {
  isAdmin,
  canManageCredentials,
  canReadCredential,
  canWriteCredential,
} from '../../src/domain/permissions/permissions';
import { validateUpload } from '../../src/domain/media/validation';
import type { AppEnv } from '../env';

/** Minimal shape of an uploaded file (Workers File/Blob), avoiding the DOM lib. */
interface UploadedFile {
  type: string;
  size: number;
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type CredentialInsert = typeof contractorCredentials.$inferInsert;
const CONTRACTOR_WRITABLE: (keyof CredentialInsert)[] = [
  'credential_type_id', 'issuer', 'registration_or_policy_number', 'issue_date', 'expiry_date', 'file_url',
];
const VERIFY_STATUSES = ['awaiting_review', 'verified', 'rejected', 'expired', 'superseded'] as const;
type VerifyStatus = (typeof VERIFY_STATUSES)[number];

function pick(body: Record<string, unknown>, keys: (keyof CredentialInsert)[]): Partial<CredentialInsert> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body && body[k as string] !== undefined) out[k as string] = body[k as string];
  return out as Partial<CredentialInsert>;
}

// GET /api/credentials/types — active credential types (for dropdowns).
route.get('/types', async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(credentialTypes).where(eq(credentialTypes.active, true)).limit(200);
  return c.json({ credentialTypes: rows });
});

// GET /api/credentials — contractor's own, or ?contractor_id=… for admins.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  let contractorId: string | null = null;
  if (isAdmin(p)) contractorId = c.req.query('contractor_id') ?? null;
  else if (p.role === 'contractor') contractorId = p.contractorId;
  if (!contractorId) return c.json({ credentials: [] });

  const rows = await db
    .select()
    .from(contractorCredentials)
    .where(and(eq(contractorCredentials.contractor_id, contractorId), eq(contractorCredentials.archived, false)))
    .orderBy(desc(contractorCredentials.created_at))
    .limit(500);
  return c.json({ credentials: rows });
});

// GET /api/credentials/awaiting — admin review queue.
route.get('/awaiting', async (c) => {
  if (!canManageCredentials(c.get('principal'))) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(contractorCredentials)
    .where(
      and(
        eq(contractorCredentials.verification_status, 'awaiting_review'),
        eq(contractorCredentials.archived, false),
      ),
    )
    .orderBy(desc(contractorCredentials.created_at))
    .limit(500);
  return c.json({ credentials: rows });
});

// POST /api/credentials — a contractor adds one of their own (admins may add for any).
route.post('/', async (c) => {
  const p = c.get('principal');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const contractorId = isAdmin(p) && typeof body.contractor_id === 'string' ? body.contractor_id : p.contractorId;
  if (!contractorId) return c.json({ error: 'no_contractor_scope' }, 400);
  if (!canWriteCredential(p, { contractor_id: contractorId })) return c.json({ error: 'forbidden' }, 403);
  if (typeof body.credential_type_id !== 'string') return c.json({ error: 'credential_type_id_required' }, 400);

  const db = drizzle(c.env.DB);
  const values: CredentialInsert = {
    contractor_id: contractorId,
    credential_type_id: body.credential_type_id,
    verification_status: 'awaiting_review', // never self-verified
    ...pick(body, CONTRACTOR_WRITABLE),
  };
  const inserted = await db.insert(contractorCredentials).values(values).returning();
  return c.json({ credential: inserted[0] }, 201);
});

// PATCH /api/credentials/:id — contractor edits own metadata; admin verifies/rejects.
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(contractorCredentials)
    .where(eq(contractorCredentials.id, c.req.param('id')))
    .limit(1);
  const cred = rows[0];
  if (!cred) return c.json({ error: 'not_found' }, 404);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  // A verification decision is admin-only.
  if (body.verification_status !== undefined) {
    if (!canManageCredentials(p)) return c.json({ error: 'forbidden' }, 403);
    const status = body.verification_status;
    if (typeof status !== 'string' || !VERIFY_STATUSES.includes(status as VerifyStatus)) {
      return c.json({ error: 'invalid_status' }, 400);
    }
    const updated = await db
      .update(contractorCredentials)
      .set({
        verification_status: status as VerifyStatus,
        verified_by: p.userId,
        verified_at: new Date().toISOString(),
        rejection_reason: typeof body.rejection_reason === 'string' ? body.rejection_reason : null,
      })
      .where(eq(contractorCredentials.id, cred.id))
      .returning();
    return c.json({ credential: updated[0] });
  }

  // Otherwise it's a metadata edit by the owner (or an admin).
  if (!canWriteCredential(p, cred)) return c.json({ error: 'forbidden' }, 403);
  const updated = await db
    .update(contractorCredentials)
    .set(pick(body, CONTRACTOR_WRITABLE))
    .where(eq(contractorCredentials.id, cred.id))
    .returning();
  return c.json({ credential: updated[0] });
});

// POST /api/credentials/:id/file — attach the proof document (PDF/image). Owner
// contractor or an admin; re-sets status to awaiting_review so a new file is
// re-checked.
route.post('/:id/file', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(contractorCredentials)
    .where(eq(contractorCredentials.id, c.req.param('id')))
    .limit(1);
  const cred = rows[0];
  if (!cred) return c.json({ error: 'not_found' }, 404);
  if (!canWriteCredential(p, cred)) return c.json({ error: 'forbidden' }, 403);

  const form = await c.req.formData().catch(() => null);
  const fileEntry = form?.get('file');
  if (fileEntry == null || typeof fileEntry === 'string') return c.json({ error: 'file_required' }, 400);
  const file = fileEntry as unknown as UploadedFile;

  const v = validateUpload(file.type, file.size);
  if (!v.ok) return c.json({ error: v.reason }, 400);
  if (v.mediaType === 'video') return c.json({ error: 'unsupported_type' }, 400); // proofs are PDF/image

  const key = `credentials/${cred.contractor_id}/${crypto.randomUUID()}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const updated = await db
    .update(contractorCredentials)
    .set({ file_url: key, verification_status: 'awaiting_review' })
    .where(eq(contractorCredentials.id, cred.id))
    .returning();
  return c.json({ credential: updated[0] });
});

// GET /api/credentials/:id/file — stream the proof document if authorized
// (admin or the owning contractor).
route.get('/:id/file', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db
    .select()
    .from(contractorCredentials)
    .where(eq(contractorCredentials.id, c.req.param('id')))
    .limit(1);
  const cred = rows[0];
  if (!cred) return c.json({ error: 'not_found' }, 404);
  if (!canReadCredential(p, cred)) return c.json({ error: 'forbidden' }, 403);
  if (!cred.file_url) return c.json({ error: 'no_file' }, 404);

  const object = await c.env.MEDIA.get(cred.file_url);
  if (!object) return c.json({ error: 'file_missing' }, 404);
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, max-age=3600',
    },
  });
});

export default route;
