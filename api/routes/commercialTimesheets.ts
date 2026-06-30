import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and } from 'drizzle-orm';
import { commercialTimesheets, deploymentWorkers } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { computeTimesheetPay } from '../../src/domain/commercial/payEngine';
import {
  isTimesheetStatus,
  canTransitionTimesheet,
  isTimesheetEditable,
  type TimesheetStatus,
} from '../../src/domain/commercial/timesheetApproval';
import type { AppEnv } from '../env';

/**
 * Commercial timesheets — weekly hours per worker on a deployment, with the
 * pay/charge/margin computed by the rate engine. Admin-only for now (the CCG
 * commercial team); the margin is sensitive and only returned here.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

type TS = typeof commercialTimesheets.$inferSelect;
/** Attach computed pay/charge/margin (admin-only context). */
function withTotals(ts: TS) {
  const totals = computeTimesheetPay({
    basicHours: ts.basic_hours,
    overtimeHours: ts.overtime_hours,
    payRate: ts.pay_rate ?? 0,
    chargeRate: ts.charge_rate ?? 0,
    oncostRate: ts.oncost_rate ?? 0,
    overtimeMultiplier: ts.overtime_multiplier ?? undefined,
    travel: ts.travel ?? 0,
    lodge: ts.lodge ?? 0,
    expenses: ts.expenses ?? 0,
    deductions: ts.deductions ?? 0,
  });
  return { ...ts, totals };
}

const NUM_FIELDS = ['basic_hours', 'overtime_hours', 'pay_rate', 'charge_rate', 'oncost_rate', 'overtime_multiplier', 'travel', 'lodge', 'expenses', 'deductions'] as const;

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const deploymentId = c.req.query('deployment_id');
  const rows = deploymentId
    ? await db.select().from(commercialTimesheets).where(eq(commercialTimesheets.deployment_id, deploymentId)).all()
    : await db.select().from(commercialTimesheets).orderBy(desc(commercialTimesheets.created_at)).limit(500).all();
  return c.json({ timesheets: rows.map(withTotals) });
});

route.get('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const ts = (await db.select().from(commercialTimesheets).where(eq(commercialTimesheets.id, c.req.param('id'))).limit(1))[0];
  if (!ts) return c.json({ error: 'not_found' }, 404);
  return c.json({ timesheet: withTotals(ts) });
});

route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const deploymentId = typeof body.deployment_id === 'string' ? body.deployment_id : '';
  const workerId = typeof body.worker_id === 'string' ? body.worker_id : '';
  const weekStart = typeof body.week_start === 'string' ? body.week_start : '';
  if (!deploymentId || !workerId || !weekStart) return c.json({ error: 'deployment_worker_week_required' }, 400);

  // Snapshot rates from the deployment worker when not explicitly provided.
  const dw = (await db.select().from(deploymentWorkers).where(and(eq(deploymentWorkers.deployment_id, deploymentId), eq(deploymentWorkers.worker_id, workerId))).limit(1))[0];

  const values: Record<string, unknown> = {
    deployment_id: deploymentId,
    worker_id: workerId,
    week_start: weekStart,
    created_by: me.userId,
    pay_rate: num(body.pay_rate) ?? dw?.pay_rate ?? null,
    charge_rate: num(body.charge_rate) ?? dw?.charge_rate ?? null,
  };
  for (const f of NUM_FIELDS) {
    if (f === 'pay_rate' || f === 'charge_rate') continue;
    if (f in body && body[f] !== undefined && body[f] !== '') values[f] = num(body[f]);
  }
  const inserted = await db.insert(commercialTimesheets).values(values as { deployment_id: string; worker_id: string; week_start: string }).returning();
  return c.json({ timesheet: withTotals(inserted[0]!) }, 201);
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const current = (await db.select().from(commercialTimesheets).where(eq(commercialTimesheets.id, id)).limit(1))[0];
  if (!current) return c.json({ error: 'not_found' }, 404);

  const patch: Record<string, unknown> = {};

  // Hours/rates can only change while editable (draft/rejected).
  const editing = NUM_FIELDS.some((f) => f in body) || 'notes' in body;
  if (editing) {
    if (!isTimesheetEditable(current.status as TimesheetStatus)) {
      return c.json({ error: 'locked_period' }, 400);
    }
    for (const f of NUM_FIELDS) if (f in body && body[f] !== undefined) patch[f] = num(body[f]);
    if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes : null;
  }

  if (body.status !== undefined) {
    if (!isTimesheetStatus(body.status)) return c.json({ error: 'invalid_status' }, 400);
    if (body.status !== current.status && !canTransitionTimesheet(current.status as TimesheetStatus, body.status)) {
      return c.json({ error: 'illegal_transition' }, 400);
    }
    patch.status = body.status;
    if (body.status === 'rejected' && typeof body.rejection_reason === 'string') patch.rejection_reason = body.rejection_reason;
  }

  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(commercialTimesheets).set({ ...patch, updated_at: new Date() }).where(eq(commercialTimesheets.id, id)).returning();
  return c.json({ timesheet: withTotals(updated[0]!) });
});

export default route;
