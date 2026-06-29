import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { timesheets, timesheetEntries, jobs, contractorProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import { notify } from '../lib/notify';
import { timesheetReviewed } from '../../src/domain/notifications/templates';
import {
  isAdmin,
  canManageTimesheets,
  canSubmitTimesheet,
  canReadTimesheet,
} from '../../src/domain/permissions/permissions';
import { timesheetTotals, type TimeEntryInput } from '../../src/domain/timesheets/calc';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const REVIEW_STATUSES = ['approved', 'needs_correction', 'disputed', 'exported', 'paid'] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// GET /api/timesheets — role-scoped list.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  if (isAdmin(p)) {
    const rows = await db.select().from(timesheets).orderBy(desc(timesheets.created_at)).limit(500);
    return c.json({ timesheets: rows });
  }
  if (p.role === 'contractor') {
    if (!p.contractorId) return c.json({ timesheets: [] });
    const rows = await db
      .select()
      .from(timesheets)
      .where(eq(timesheets.contractor_id, p.contractorId))
      .orderBy(desc(timesheets.created_at))
      .limit(500);
    return c.json({ timesheets: rows });
  }
  if (p.role === 'client') {
    if (!p.clientId) return c.json({ timesheets: [] });
    const rows = await db
      .select({ t: timesheets })
      .from(timesheets)
      .innerJoin(jobs, eq(timesheets.job_id, jobs.id))
      .where(eq(jobs.client_id, p.clientId))
      .limit(500);
    return c.json({ timesheets: rows.map((r) => r.t) });
  }
  return c.json({ timesheets: [] });
});

// GET /api/timesheets/:id — timesheet + its entries (authorized).
route.get('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(timesheets).where(eq(timesheets.id, c.req.param('id'))).limit(1);
  const ts = rows[0];
  if (!ts) return c.json({ error: 'not_found' }, 404);

  let jobClientId: string | null = null;
  if (p.role === 'client') {
    const jr = await db.select({ client_id: jobs.client_id }).from(jobs).where(eq(jobs.id, ts.job_id)).limit(1);
    jobClientId = jr[0]?.client_id ?? null;
  }
  if (!canReadTimesheet(p, { contractor_id: ts.contractor_id, job_client_id: jobClientId })) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const entries = await db
    .select()
    .from(timesheetEntries)
    .where(eq(timesheetEntries.timesheet_id, ts.id));
  return c.json({ timesheet: ts, entries });
});

// POST /api/timesheets — contractor submits a week of entries; totals computed
// server-side from the hours engine.
route.post('/', async (c) => {
  const p = c.get('principal');
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const jobId = typeof body?.job_id === 'string' ? body.job_id : null;
  const weekStart = typeof body?.week_start === 'string' ? body.week_start : null;
  const contractorId =
    isAdmin(p) && typeof body?.contractor_id === 'string' ? body.contractor_id : p.contractorId;
  const rawEntries = Array.isArray(body?.entries) ? (body!.entries as Record<string, unknown>[]) : [];

  if (!jobId || !weekStart) return c.json({ error: 'job_id_and_week_start_required' }, 400);
  if (!contractorId) return c.json({ error: 'no_contractor_scope' }, 400);
  if (!canSubmitTimesheet(p, contractorId)) return c.json({ error: 'forbidden' }, 403);
  if (rawEntries.length === 0) return c.json({ error: 'at_least_one_entry_required' }, 400);

  const inputs: TimeEntryInput[] = rawEntries.map((e) => ({
    start_time: String(e.start_time ?? ''),
    finish_time: String(e.finish_time ?? ''),
    break_minutes: typeof e.break_minutes === 'number' ? e.break_minutes : 0,
    rate: typeof e.rate === 'number' ? e.rate : 0,
  }));

  let totals;
  try {
    totals = timesheetTotals(inputs);
  } catch (err) {
    return c.json({ error: 'invalid_entry_time', detail: err instanceof Error ? err.message : 'bad time' }, 400);
  }

  const db = drizzle(c.env.DB);
  const created = await db
    .insert(timesheets)
    .values({
      job_id: jobId,
      contractor_id: contractorId,
      week_start: weekStart,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      total_hours: totals.totalHours,
      total_amount: totals.totalAmount,
    })
    .returning();
  const timesheet = created[0]!;

  await db.insert(timesheetEntries).values(
    rawEntries.map((e, i) => ({
      timesheet_id: timesheet.id,
      work_date: String(e.work_date ?? weekStart),
      start_time: inputs[i]!.start_time,
      finish_time: inputs[i]!.finish_time,
      break_minutes: inputs[i]!.break_minutes ?? 0,
      total_hours: totals.entries[i]!.hours,
      rate: inputs[i]!.rate ?? 0,
      description: typeof e.description === 'string' ? e.description : null,
      evidence_url: typeof e.evidence_url === 'string' ? e.evidence_url : null,
    })),
  );

  return c.json({ timesheet }, 201);
});

// PATCH /api/timesheets/:id — admin review (approve / return / etc.).
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  if (!canManageTimesheets(p)) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status;
  if (typeof status !== 'string' || !REVIEW_STATUSES.includes(status as ReviewStatus)) {
    return c.json({ error: 'invalid_status' }, 400);
  }

  const db = drizzle(c.env.DB);
  const updated = await db
    .update(timesheets)
    .set({
      status: status as ReviewStatus,
      reviewed_by: p.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: typeof body?.rejection_reason === 'string' ? body.rejection_reason : null,
    })
    .where(eq(timesheets.id, c.req.param('id')))
    .returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  const ts = updated[0];

  // Notify the contractor of the review outcome (best-effort).
  c.executionCtx.waitUntil(
    (async () => {
      const cp = await db
        .select({ user_id: contractorProfiles.user_id })
        .from(contractorProfiles)
        .where(eq(contractorProfiles.id, ts.contractor_id))
        .limit(1);
      const userId = cp[0]?.user_id;
      if (!userId) return;
      const t = timesheetReviewed(status, ts.week_start);
      await notify(c.env, {
        userId,
        jobId: ts.job_id,
        notification_type: t.notification_type,
        title: t.title,
        body: t.body,
        deep_link: t.deep_link,
      });
    })(),
  );

  return c.json({ timesheet: ts });
});

export default route;
