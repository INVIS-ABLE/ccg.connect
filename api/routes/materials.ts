import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq } from 'drizzle-orm';
import { deploymentMaterials } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { materialTotals, rollupMaterials, isMaterialCategory } from '../../src/domain/commercial/materials';
import type { AppEnv } from '../env';

/**
 * Materials / plant / consumables on a deployment. Admin/ops only — cost, charge
 * and margin are internal. Tracks the quantity lifecycle and the money per line.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(x) ? x : null;
};

const TEXT_FIELDS = ['name', 'unit', 'supplier', 'delivery_ref', 'notes'] as const;
const NUM_FIELDS = ['planned_qty', 'issued_qty', 'used_qty', 'returned_qty', 'lost_qty', 'supplier_cost', 'client_charge'] as const;

const withTotals = (row: typeof deploymentMaterials.$inferSelect) => ({ ...row, totals: materialTotals(row) });

// GET /api/materials?deployment_id=… — lines + a rollup for the deployment.
route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const deploymentId = c.req.query('deployment_id');
  if (!deploymentId) return c.json({ error: 'deployment_id_required' }, 400);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(deploymentMaterials).where(eq(deploymentMaterials.deployment_id, deploymentId)).orderBy(desc(deploymentMaterials.created_at)).all();
  return c.json({ materials: rows.map(withTotals), rollup: rollupMaterials(rows) });
});

// POST /api/materials — add a line to a deployment.
route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const deploymentId = str(body.deployment_id);
  const name = str(body.name);
  if (!deploymentId || !name) return c.json({ error: 'deployment_and_name_required' }, 400);
  const category = isMaterialCategory(body.category) ? body.category : 'material';

  const values: Record<string, unknown> = { deployment_id: deploymentId, name, category, created_by: me.userId };
  for (const f of TEXT_FIELDS) if (f in body && f !== 'name') values[f] = str(body[f]);
  for (const f of NUM_FIELDS) if (f in body) values[f] = num(body[f]);
  if ('chargeable' in body) values.chargeable = body.chargeable !== false;

  const inserted = await db.insert(deploymentMaterials).values(values as { deployment_id: string; name: string }).returning();
  return c.json({ material: withTotals(inserted[0]!) }, 201);
});

// PATCH /api/materials/:id — update a line.
route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) if (f in body) patch[f] = str(body[f]);
  for (const f of NUM_FIELDS) if (f in body) patch[f] = num(body[f]);
  if (isMaterialCategory(body.category)) patch.category = body.category;
  if ('chargeable' in body) patch.chargeable = body.chargeable !== false;
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(deploymentMaterials).set({ ...patch, updated_at: new Date() }).where(eq(deploymentMaterials.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ material: withTotals(updated[0]) });
});

// DELETE /api/materials/:id — remove a line (operational, not under retention).
route.delete('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  await db.delete(deploymentMaterials).where(eq(deploymentMaterials.id, c.req.param('id')));
  return c.json({ ok: true });
});

export default route;
