import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import {
  deployments,
  deploymentWorkers,
  commercialTimesheets,
  commercialInvoices,
  deploymentAttendance,
  incidents,
  labourRequests,
  corporateAccounts,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { computeTimesheetPay } from '../../src/domain/commercial/payEngine';
import { bucketByMonth } from '../../src/domain/reports/timeseries';
import {
  rollupMargin,
  attendanceRollup,
  countByStatus,
  topByValue,
} from '../../src/domain/reports/commercialSummary';
import type { AppEnv } from '../env';

/**
 * Commercial (agency) management dashboard aggregates. Admin-only — these
 * figures include margins and cost, which are sensitive and never exposed to
 * client or contractor roles. All aggregation is pure (see reports/*).
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));

const REVENUE_STATUSES = new Set(['issued', 'paid']); // exclude drafts and cancelled
const LIVE_DEPLOYMENTS = new Set(['confirmed', 'active']);

route.get('/commercial', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const monthsParam = Number(c.req.query('months'));
  const months = Number.isFinite(monthsParam) && monthsParam >= 1 && monthsParam <= 24 ? Math.floor(monthsParam) : 6;
  const now = new Date();

  const [deps, dws, timesheets, invoices, attendance, inc, requests, accounts] = await Promise.all([
    db.select().from(deployments).all(),
    db.select().from(deploymentWorkers).all(),
    db.select().from(commercialTimesheets).orderBy(desc(commercialTimesheets.created_at)).limit(2000).all(),
    db.select().from(commercialInvoices).all(),
    db.select().from(deploymentAttendance).all(),
    db.select().from(incidents).all(),
    db.select().from(labourRequests).all(),
    db.select().from(corporateAccounts).all(),
  ]);

  // ── Deployments ──────────────────────────────────────────────────────────
  const liveDeploymentIds = new Set(deps.filter((d) => LIVE_DEPLOYMENTS.has(d.status)).map((d) => d.id));
  const activeDeployments = liveDeploymentIds.size;
  const workersDeployed = new Set(dws.filter((w) => liveDeploymentIds.has(w.deployment_id)).map((w) => w.worker_id)).size;
  const deploymentsByStatus = countByStatus(deps, (d) => d.status);

  // ── Requests ─────────────────────────────────────────────────────────────
  const openRequestStatuses = new Set(['open', 'sourcing', 'partially_filled', 'awaiting_approval']);
  const openRequests = requests.filter((r) => openRequestStatuses.has(r.status)).length;

  // ── Money: margin (from timesheets) + revenue (from invoices) ─────────────
  const totals = timesheets.map((ts) =>
    computeTimesheetPay({
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
    }),
  );
  const margin = rollupMargin(totals);

  const revenueInvoices = invoices.filter((i) => REVENUE_STATUSES.has(i.status));
  const revenue = Math.round(revenueInvoices.reduce((s, i) => s + (i.net_amount || 0), 0) * 100) / 100;
  const outstanding = Math.round(
    invoices.filter((i) => i.status === 'issued').reduce((s, i) => s + (i.gross_amount || 0), 0) * 100,
  ) / 100;

  // Trends (last N months).
  const revenueTrend = bucketByMonth(revenueInvoices, (i) => i.created_at, (i) => i.net_amount || 0, months, now);
  const marginTrend = bucketByMonth(
    timesheets.map((ts, idx) => ({ created_at: ts.created_at, margin: totals[idx]!.margin })),
    (r) => r.created_at,
    (r) => r.margin,
    months,
    now,
  );

  // Revenue by account (top 6), labelled with the account name.
  const accountName = new Map(accounts.map((a) => [a.id, a.trading_name || a.legal_name]));
  const revenueByAccount = topByValue(revenueInvoices, (i) => i.account_id, (i) => i.net_amount || 0, 6)
    .map((row) => ({ ...row, label: accountName.get(row.key) ?? 'Unknown account' }));

  // ── Attendance & incidents ───────────────────────────────────────────────
  const attendance30 = attendance.filter((a) => withinDays(a.date, 30, now));
  const attendanceReliability = attendanceRollup(attendance30);
  const openIncidents = inc.filter((i) => i.status !== 'closed').length;
  const incidentsBySeverity = countByStatus(inc.filter((i) => i.status !== 'closed'), (i) => i.severity);

  // ── Today's operational picture ──────────────────────────────────────────
  const today = now.toISOString().slice(0, 10);
  const todaysAttendance = attendance.filter((a) => a.date === today);
  const workersOnSiteToday = new Set(
    todaysAttendance.filter((a) => a.status === 'present' || a.status === 'late').map((a) => a.worker_id),
  ).size;
  const absentToday = todaysAttendance.filter((a) => a.status === 'absent' || a.status === 'no_show').length;

  // Timesheets in the approval pipeline (submitted by worker/site, not yet ops-approved).
  const AWAITING_APPROVAL = new Set(['submitted', 'site_confirmed']);
  const timesheetsAwaitingApproval = timesheets.filter((ts) => AWAITING_APPROVAL.has(ts.status)).length;

  // Payroll exposure: worker pay on approved/locked timesheets not yet invoiced.
  const PAYROLL_DUE = new Set(['ops_approved', 'locked']);
  const payrollExposure = Math.round(
    timesheets.reduce((s, ts, idx) => s + (PAYROLL_DUE.has(ts.status) ? totals[idx]!.workerPay : 0), 0) * 100,
  ) / 100;

  return c.json({
    months,
    kpis: {
      activeDeployments,
      workersDeployed,
      workersOnSiteToday,
      absentToday,
      openRequests,
      timesheetsAwaitingApproval,
      revenue,
      outstanding,
      payrollExposure,
      margin: margin.margin,
      marginPct: margin.marginPct,
      attendanceRate: attendanceReliability.rate,
      openIncidents,
    },
    margin,
    attendance: attendanceReliability,
    revenueTrend,
    marginTrend,
    revenueByAccount,
    deploymentsByStatus,
    incidentsBySeverity,
  });
});

/** True if an ISO date string falls within the last `days` days (inclusive). */
function withinDays(date: string | null | undefined, days: number, now: Date): boolean {
  if (!date) return false;
  const t = Date.parse(date.length <= 10 ? `${date}T00:00:00Z` : date);
  if (!Number.isFinite(t)) return false;
  const cutoff = now.getTime() - days * 86_400_000;
  return t >= cutoff && t <= now.getTime() + 86_400_000;
}

export default route;
