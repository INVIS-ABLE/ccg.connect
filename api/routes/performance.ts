import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq } from 'drizzle-orm';
import { performanceReviews } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { averageScore, isValidScores, requiresEvidence, isReviewDirection } from '../../src/domain/commercial/performance';
import type { AppEnv } from '../env';

/**
 * Performance & quality reviews (admin/ops only — the register is restricted).
 * A poor score requires an evidenced reason (enforced here, not just in the UI),
 * and reviews are appealable via `status`. Never an automated blacklist.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function parseScores(raw: unknown): Record<string, number> {
  return raw && typeof raw === 'object' ? (raw as Record<string, number>) : {};
}

// GET /api/performance?deployment_id=… | ?worker_id=…  — list reviews (admin).
route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const deploymentId = c.req.query('deployment_id');
  const workerId = c.req.query('worker_id');
  if (!deploymentId && !workerId) return c.json({ error: 'deployment_or_worker_required' }, 400);
  const where = deploymentId ? eq(performanceReviews.deployment_id, deploymentId) : eq(performanceReviews.worker_id, workerId!);
  const rows = await db.select().from(performanceReviews).where(where).orderBy(desc(performanceReviews.created_at)).all();
  return c.json({ reviews: rows.map((r) => ({ ...r, scores: parseScores(r.scores && JSON.parse(r.scores)) })) });
});

// GET /api/performance/worker/:id/summary — aggregate a worker's client ratings.
route.get('/worker/:id/summary', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(performanceReviews)
    .where(and(eq(performanceReviews.worker_id, c.req.param('id')), eq(performanceReviews.direction, 'client_on_worker'))).all();
  const overalls = rows.map((r) => r.overall).filter((n): n is number => typeof n === 'number');
  const average = overalls.length ? Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10 : null;
  const withRepeat = rows.filter((r) => r.would_repeat != null);
  const wouldRepeatRate = withRepeat.length ? withRepeat.filter((r) => r.would_repeat).length / withRepeat.length : null;
  return c.json({ worker_id: c.req.param('id'), count: rows.length, average, would_repeat_rate: wouldRepeatRate });
});

// POST /api/performance — record a review (admin).
route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const deploymentId = str(body.deployment_id);
  const workerId = str(body.worker_id);
  if (!deploymentId || !workerId) return c.json({ error: 'deployment_and_worker_required' }, 400);
  if (!isReviewDirection(body.direction)) return c.json({ error: 'invalid_direction' }, 400);
  const scores = parseScores(body.scores);
  if (!isValidScores(scores)) return c.json({ error: 'invalid_scores' }, 400);

  const evidence = str(body.evidence);
  // Guardrail: a poor score cannot be recorded without an evidenced reason.
  if (requiresEvidence(scores) && !evidence) return c.json({ error: 'evidence_required_for_low_scores' }, 400);

  const inserted = await db.insert(performanceReviews).values({
    deployment_id: deploymentId,
    worker_id: workerId,
    direction: body.direction,
    scores: JSON.stringify(scores),
    overall: averageScore(scores),
    would_repeat: typeof body.would_repeat === 'boolean' ? body.would_repeat : null,
    comment: str(body.comment),
    evidence,
    created_by: me.userId,
  }).returning();
  const r = inserted[0]!;
  return c.json({ review: { ...r, scores } }, 201);
});

// PATCH /api/performance/:id — appeal/resolution (admin): dispute, uphold, withdraw.
route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (['recorded', 'disputed', 'upheld', 'withdrawn'].includes(String(body.status))) patch.status = body.status;
  if ('comment' in body) patch.comment = str(body.comment);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(performanceReviews).set({ ...patch, updated_at: new Date() }).where(eq(performanceReviews.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  const r = updated[0];
  return c.json({ review: { ...r, scores: parseScores(r.scores && JSON.parse(r.scores)) } });
});

export default route;
