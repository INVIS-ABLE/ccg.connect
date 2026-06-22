import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, desc } from 'drizzle-orm';
import { jobMedia, jobAssignments, jobs } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin, canReadJob, type Principal } from '../../src/domain/permissions/permissions';
import { validateUpload } from '../../src/domain/media/validation';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const CATEGORIES = [
  'before', 'progress', 'completion', 'materials', 'delivery', 'variation', 'defect',
  'snagging', 'incident', 'other',
] as const;
type Category = (typeof CATEGORIES)[number];

type MediaRow = typeof jobMedia.$inferSelect;

/** Minimal shape of an uploaded file (Workers File/Blob), avoiding the DOM lib. */
interface UploadedFile {
  type: string;
  size: number;
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Never expose the raw R2 key; serve via the authorized file route instead. */
function publicShape(m: MediaRow) {
  const { file_url: _key, ...rest } = m;
  return { ...rest, url: `/api/media/${m.id}/file` };
}

async function assignedContractorIds(db: ReturnType<typeof drizzle>, jobId: string): Promise<string[]> {
  const rows = await db
    .select({ cid: jobAssignments.contractor_id })
    .from(jobAssignments)
    .where(eq(jobAssignments.job_id, jobId));
  return rows.map((r) => r.cid);
}

/** Can this principal see this media item, given the job + visibility flags? */
function canSeeMedia(p: Principal, m: MediaRow, ctx: { jobClientId: string | null; assignedContractorIds: string[] }): boolean {
  if (isAdmin(p)) return true;
  if (m.internal_only) return false; // never leaves admins
  if (!canReadJob(p, { client_id: ctx.jobClientId }, { assignedContractorIds: ctx.assignedContractorIds })) {
    return false;
  }
  // Clients additionally require explicit visibility (invariant 3).
  if (p.role === 'client') return m.client_visible;
  return true;
}

// POST /api/media — upload a file (multipart) for a job. Admin or assigned contractor.
route.post('/', async (c) => {
  const p = c.get('principal');
  const form = await c.req.formData().catch(() => null);
  const fileEntry = form?.get('file');
  const jobId = form?.get('job_id');
  if (fileEntry == null || typeof fileEntry === 'string' || typeof jobId !== 'string') {
    return c.json({ error: 'file_and_job_id_required' }, 400);
  }
  const file = fileEntry as unknown as UploadedFile;

  const v = validateUpload(file.type, file.size);
  if (!v.ok) return c.json({ error: v.reason }, 400);

  const db = drizzle(c.env.DB);
  const assigned = await assignedContractorIds(db, jobId);
  const canUpload =
    isAdmin(p) || (p.role === 'contractor' && p.contractorId != null && assigned.includes(p.contractorId));
  if (!canUpload) return c.json({ error: 'forbidden' }, 403);

  const key = `jobs/${jobId}/${crypto.randomUUID()}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const rawCategory = form?.get('category');
  const category: Category =
    typeof rawCategory === 'string' && (CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as Category)
      : 'progress';
  const caption = typeof form?.get('caption') === 'string' ? (form.get('caption') as string) : null;
  const capturedAt = typeof form?.get('captured_at') === 'string' ? (form.get('captured_at') as string) : null;

  const inserted = await db
    .insert(jobMedia)
    .values({
      job_id: jobId,
      uploaded_by: p.userId,
      contractor_id: p.contractorId ?? null,
      media_type: v.mediaType,
      category,
      file_url: key,
      original_filename: file.name,
      caption,
      captured_at: capturedAt,
      uploaded_at: new Date().toISOString(),
      client_visible: false, // default private (invariant 3 / file-upload rules)
    })
    .returning();
  return c.json({ media: publicShape(inserted[0]!) }, 201);
});

// GET /api/media?job_id=... — media for a job, filtered by the caller's visibility.
route.get('/', async (c) => {
  const p = c.get('principal');
  const jobId = c.req.query('job_id');
  if (!jobId) return c.json({ error: 'job_id_required' }, 400);

  const db = drizzle(c.env.DB);
  const jobRows = await db.select({ client_id: jobs.client_id }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!jobRows[0]) return c.json({ error: 'not_found' }, 404);
  const ctx = { jobClientId: jobRows[0].client_id, assignedContractorIds: await assignedContractorIds(db, jobId) };

  // Gate the whole job first.
  if (!isAdmin(p) && !canReadJob(p, { client_id: ctx.jobClientId }, { assignedContractorIds: ctx.assignedContractorIds })) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const rows = await db
    .select()
    .from(jobMedia)
    .where(and(eq(jobMedia.job_id, jobId), eq(jobMedia.archived, false)))
    .orderBy(desc(jobMedia.created_at))
    .limit(500);
  return c.json({ media: rows.filter((m) => canSeeMedia(p, m, ctx)).map(publicShape) });
});

// GET /api/media/:id/file — stream the file from R2 if authorized.
route.get('/:id/file', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(jobMedia).where(eq(jobMedia.id, c.req.param('id'))).limit(1);
  const media = rows[0];
  if (!media) return c.json({ error: 'not_found' }, 404);

  const jobRows = await db.select({ client_id: jobs.client_id }).from(jobs).where(eq(jobs.id, media.job_id)).limit(1);
  const ctx = {
    jobClientId: jobRows[0]?.client_id ?? null,
    assignedContractorIds: await assignedContractorIds(db, media.job_id),
  };
  if (!canSeeMedia(p, media, ctx)) return c.json({ error: 'forbidden' }, 403);

  const object = await c.env.MEDIA.get(media.file_url);
  if (!object) return c.json({ error: 'file_missing' }, 404);
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, max-age=3600',
    },
  });
});

export default route;
