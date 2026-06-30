import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { inArray } from 'drizzle-orm';
import {
  corporateAccounts,
  commercialSites,
  labourRequests,
  deployments,
  deploymentWorkers,
  deploymentAttendance,
  commercialInvoices,
  incidents,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { toPortalDeployment, toPortalInvoice, isClientVisibleInvoice } from '../../src/domain/commercial/portal';
import type { AppEnv } from '../env';

/**
 * Client-facing commercial portal (read-only). A client sees ONLY the corporate
 * accounts an admin has linked them to (Principal.corporateAccountIds), and only
 * the client-safe projection of that data — never rates, margins, cost, worker
 * identities, compliance or internal notes (enforced by toPortal* allowlists).
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

route.get('/commercial', async (c) => {
  const p = c.get('principal');

  // Resolve which accounts this caller may view. Clients are scoped to their
  // explicit links; an admin may preview a single account via ?account_id.
  let accountIds: string[];
  if (isAdmin(p)) {
    const q = c.req.query('account_id');
    accountIds = q ? [q] : [];
  } else if (p.role === 'client') {
    accountIds = [...(p.corporateAccountIds ?? [])];
  } else {
    return c.json({ error: 'forbidden' }, 403);
  }

  if (accountIds.length === 0) {
    return c.json({ accounts: [], deployments: [], invoices: [] });
  }

  const db = drizzle(c.env.DB);
  const [accounts, sites, requests, deps, invoices] = await Promise.all([
    db.select().from(corporateAccounts).where(inArray(corporateAccounts.id, accountIds)).all(),
    db.select().from(commercialSites).where(inArray(commercialSites.account_id, accountIds)).all(),
    db.select().from(labourRequests).where(inArray(labourRequests.account_id, accountIds)).all(),
    db.select().from(deployments).where(inArray(deployments.account_id, accountIds)).all(),
    db.select().from(commercialInvoices).where(inArray(commercialInvoices.account_id, accountIds)).all(),
  ]);

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const requestById = new Map(requests.map((r) => [r.id, r]));

  // Worker counts per deployment (a count only — never identities).
  const depIds = deps.map((d) => d.id);
  const dws = depIds.length ? await db.select({ deployment_id: deploymentWorkers.deployment_id }).from(deploymentWorkers).where(inArray(deploymentWorkers.deployment_id, depIds)).all() : [];
  const assignedCount = new Map<string, number>();
  for (const w of dws) assignedCount.set(w.deployment_id, (assignedCount.get(w.deployment_id) ?? 0) + 1);

  const portalDeployments = deps
    .filter((d) => d.status !== 'cancelled')
    .map((d) => {
      const req = d.labour_request_id ? requestById.get(d.labour_request_id) : undefined;
      return toPortalDeployment(d, {
        site_name: d.site_id ? siteName.get(d.site_id) ?? null : null,
        request_title: req?.title ?? null,
        workers_required: req?.number_required ?? null,
        workers_assigned: assignedCount.get(d.id) ?? 0,
      });
    });

  const portalInvoices = invoices.filter(isClientVisibleInvoice).map(toPortalInvoice);

  const portalAccounts = accounts.map((a) => ({ id: a.id, name: a.trading_name || a.legal_name }));

  // ── Dashboard summary — counts and the client's own invoice totals only.
  // Allowlist-safe: no worker identities, rates, margins, cost or internal notes.
  const liveStatuses = new Set(['confirmed', 'active']);
  const liveDeps = deps.filter((d) => liveStatuses.has(d.status));
  const today = new Date().toISOString().slice(0, 10);

  // Present-today is a COUNT only — worker ids are used to de-duplicate, never returned.
  const attendanceRows = depIds.length
    ? await db.select({ worker_id: deploymentAttendance.worker_id, status: deploymentAttendance.status, date: deploymentAttendance.date })
        .from(deploymentAttendance).where(inArray(deploymentAttendance.deployment_id, depIds)).all()
    : [];
  const presentToday = new Set(
    attendanceRows.filter((a) => a.date === today && (a.status === 'present' || a.status === 'late')).map((a) => a.worker_id),
  ).size;

  // Open incident COUNT for the client's accounts — never the detail/notes/worker.
  const incRows = await db.select({ status: incidents.status }).from(incidents).where(inArray(incidents.account_id, accountIds)).all();
  const openIncidents = incRows.filter((i) => i.status !== 'closed').length;

  const openReqStatuses = new Set(['open', 'sourcing', 'partially_filled', 'awaiting_approval', 'confirmed']);
  const summary = {
    activeDeployments: liveDeps.length,
    currentSites: new Set(liveDeps.map((d) => d.site_id).filter(Boolean)).size,
    workersBooked: liveDeps.reduce((s, d) => s + (assignedCount.get(d.id) ?? 0), 0),
    presentToday,
    openRequests: requests.filter((r) => openReqStatuses.has(r.status)).length,
    openIncidents,
    invoiced: Math.round(portalInvoices.reduce((s, i) => s + (i.gross_amount || 0), 0) * 100) / 100,
    outstanding: Math.round(invoices.filter((i) => i.status === 'issued').reduce((s, i) => s + (i.gross_amount || 0), 0) * 100) / 100,
  };

  return c.json({ accounts: portalAccounts, summary, deployments: portalDeployments, invoices: portalInvoices });
});

export default route;
