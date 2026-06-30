import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { commercialInvoices, commercialTimesheets, deployments, workers } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { computeTimesheetPay } from '../../src/domain/commercial/payEngine';
import { buildCommercialInvoice } from '../../src/domain/commercial/invoice';
import type { AppEnv } from '../env';

/**
 * Commercial (client) invoices generated from locked timesheets. Admin-only.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const deploymentId = c.req.query('deployment_id');
  const rows = deploymentId
    ? await db.select().from(commercialInvoices).where(eq(commercialInvoices.deployment_id, deploymentId)).all()
    : await db.select().from(commercialInvoices).orderBy(desc(commercialInvoices.created_at)).limit(500).all();
  return c.json({ invoices: rows });
});

// POST /api/commercial-invoices/generate { deployment_id, vat_rate? }
// Invoices the deployment's LOCKED timesheets, then marks them invoiced.
route.post('/generate', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const deploymentId = typeof body.deployment_id === 'string' ? body.deployment_id : '';
  if (!deploymentId) return c.json({ error: 'deployment_id_required' }, 400);
  const vatRate = typeof body.vat_rate === 'number' ? body.vat_rate : 0.2;

  const dep = (await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1))[0];
  if (!dep) return c.json({ error: 'deployment_not_found' }, 404);

  const tss = await db
    .select()
    .from(commercialTimesheets)
    .where(and(eq(commercialTimesheets.deployment_id, deploymentId), eq(commercialTimesheets.status, 'locked')))
    .all();
  if (tss.length === 0) return c.json({ error: 'no_locked_timesheets' }, 400);

  // Worker names for line descriptions.
  const workerIds = [...new Set(tss.map((t) => t.worker_id))];
  const wrows = workerIds.length ? await db.select().from(workers).where(inArray(workers.id, workerIds)).all() : [];
  const nameById = new Map(wrows.map((w) => [w.id, w.full_name]));

  const lines = tss.map((t) => {
    const { clientCharge, totalHours } = computeTimesheetPay({
      basicHours: t.basic_hours,
      overtimeHours: t.overtime_hours,
      payRate: t.pay_rate ?? 0,
      chargeRate: t.charge_rate ?? 0,
      oncostRate: t.oncost_rate ?? 0,
      overtimeMultiplier: t.overtime_multiplier ?? undefined,
      travel: t.travel ?? 0,
      lodge: t.lodge ?? 0,
      expenses: t.expenses ?? 0,
    });
    return { description: `${nameById.get(t.worker_id) ?? 'Worker'} — w/c ${t.week_start} (${totalHours}h)`, amount: clientCharge };
  });
  const invoice = buildCommercialInvoice(lines, vatRate);

  const weeks = tss.map((t) => t.week_start).sort();
  const now = new Date();
  const number = `CINV-${now.getFullYear()}-${String(Math.floor(now.getTime() / 1000) % 100000).padStart(5, '0')}`;
  const inserted = await db.insert(commercialInvoices).values({
    account_id: dep.account_id,
    deployment_id: deploymentId,
    invoice_number: number,
    period_start: weeks[0] ?? null,
    period_end: weeks[weeks.length - 1] ?? null,
    line_items: JSON.stringify(invoice.lineItems),
    net_amount: invoice.net,
    vat_rate: invoice.vatRate,
    vat_amount: invoice.vat,
    gross_amount: invoice.gross,
    status: 'issued',
    created_by: me.userId,
  }).returning();

  // Mark the invoiced timesheets.
  await db.update(commercialTimesheets)
    .set({ status: 'invoiced', updated_at: new Date() })
    .where(inArray(commercialTimesheets.id, tss.map((t) => t.id)));

  return c.json({ invoice: inserted[0] }, 201);
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (['draft', 'issued', 'paid', 'cancelled'].includes(String(body.status))) patch.status = body.status;
  if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes : null;
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(commercialInvoices).set({ ...patch, updated_at: new Date() }).where(eq(commercialInvoices.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ invoice: updated[0] });
});

export default route;
