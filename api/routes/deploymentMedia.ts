import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq } from 'drizzle-orm';
import { deploymentMedia, deploymentWorkers, workers } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin, type Principal } from '../../src/domain/permissions/permissions';
import { validateUpload } from '../../src/domain/media/validation';
import type { AppEnv } from '../env';

/**
 * Site photo evidence on a deployment. Ops and the workers assigned to the
 * deployment can upload/see photos; clients are not exposed by default. The raw
 * R2 key is never returned — files stream via the authorised /file route.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const CATEGORIES = ['before', 'progress', 'safety', 'delivery', 'variation', 'snagging', 'completion', 'materials', 'incident', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

interface UploadedFile {
  type: string;
  size: number;
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

type Row = typeof deploymentMedia.$inferSelect;
const publicShape = (m: Row) => {
  const { file_url: _key, ...rest } = m;
  return { ...rest, url: `/api/deployment-media/${m.id}/file` };
};

/** Admin, or a worker (by login) assigned to this deployment. */
async function canAccess(db: ReturnType<typeof drizzle>, p: Principal, deploymentId: string): Promise<boolean> {
  if (isAdmin(p)) return true;
  const w = (await db.select({ id: workers.id }).from(workers).where(eq(workers.user_id, p.userId)).limit(1))[0];
  if (!w) return false;
  const row = (await db.select({ id: deploymentWorkers.id }).from(deploymentWorkers)
    .where(and(eq(deploymentWorkers.deployment_id, deploymentId), eq(deploymentWorkers.worker_id, w.id))).limit(1))[0];
  return Boolean(row);
}

// POST /api/deployment-media — upload a photo (multipart) for a deployment.
route.post('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const form = await c.req.formData().catch(() => null);
  const fileEntry = form?.get('file');
  const deploymentId = form?.get('deployment_id');
  if (fileEntry == null || typeof fileEntry === 'string' || typeof deploymentId !== 'string') {
    return c.json({ error: 'file_and_deployment_id_required' }, 400);
  }
  if (!(await canAccess(db, p, deploymentId))) return c.json({ error: 'forbidden' }, 403);

  const file = fileEntry as unknown as UploadedFile;
  const v = validateUpload(file.type, file.size);
  if (!v.ok) return c.json({ error: v.reason }, 400);

  const key = `deployments/${deploymentId}/${crypto.randomUUID()}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const rawCategory = form?.get('category');
  const category: Category = typeof rawCategory === 'string' && (CATEGORIES as readonly string[]).includes(rawCategory) ? (rawCategory as Category) : 'progress';
  const caption = typeof form?.get('caption') === 'string' ? (form.get('caption') as string) : null;

  const inserted = await db.insert(deploymentMedia).values({
    deployment_id: deploymentId,
    uploaded_by: p.userId,
    media_type: v.mediaType,
    category,
    file_url: key,
    original_filename: file.name,
    caption,
    captured_at: new Date().toISOString(),
  }).returning();
  return c.json({ media: publicShape(inserted[0]!) }, 201);
});

// GET /api/deployment-media?deployment_id=… — the deployment's photos.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const deploymentId = c.req.query('deployment_id');
  if (!deploymentId) return c.json({ error: 'deployment_id_required' }, 400);
  if (!(await canAccess(db, p, deploymentId))) return c.json({ error: 'forbidden' }, 403);
  const rows = await db.select().from(deploymentMedia).where(eq(deploymentMedia.deployment_id, deploymentId)).orderBy(desc(deploymentMedia.created_at)).limit(500);
  return c.json({ media: rows.map(publicShape) });
});

// GET /api/deployment-media/:id/file — stream the file from R2 if authorised.
route.get('/:id/file', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const media = (await db.select().from(deploymentMedia).where(eq(deploymentMedia.id, c.req.param('id'))).limit(1))[0];
  if (!media) return c.json({ error: 'not_found' }, 404);
  if (!(await canAccess(db, p, media.deployment_id))) return c.json({ error: 'forbidden' }, 403);

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
