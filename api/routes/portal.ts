import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray } from 'drizzle-orm';
import {
  corporateAccounts,
  commercialSites,
  labourRequests,
  deployments,
  deploymentWorkers,
  deploymentAttendance,
  commercialInvoices,
  incidents,
  workers,
  workerCards,
  kidDocuments,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { toPortalDeployment, toPortalInvoice, isClientVisibleInvoice } from '../../src/domain/commercial/portal';
import { cardStatus } from '../../src/domain/workforce/cardStatus';
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

/**
 * Worker self-service. The logged-in user is mapped to their own worker record
 * (workers.user_id) and sees ONLY their own assignments, credentials and Key
 * Information Documents — nothing about other workers, and no rates/margins.
 */
route.get('/worker', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const w = (await db.select().from(workers).where(eq(workers.user_id, p.userId)).limit(1))[0];
  if (!w) return c.json({ worker: null, assignments: [], credentials: [], kids: [] });

  // Assignments: deployments this worker is on (excluding cancelled).
  const dwRows = await db.select({ deployment_id: deploymentWorkers.deployment_id, role: deploymentWorkers.role })
    .from(deploymentWorkers).where(eq(deploymentWorkers.worker_id, w.id)).all();
  const depIds = dwRows.map((r) => r.deployment_id);
  const roleByDep = new Map(dwRows.map((r) => [r.deployment_id, r.role]));
  const deps = depIds.length ? await db.select().from(deployments).where(inArray(deployments.id, depIds)).all() : [];
  const siteIds = deps.map((d) => d.site_id).filter((x): x is string => Boolean(x));
  const sites = siteIds.length
    ? await db.select({ id: commercialSites.id, name: commercialSites.name, postcode: commercialSites.postcode }).from(commercialSites).where(inArray(commercialSites.id, siteIds)).all()
    : [];
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const assignments = deps
    .filter((d) => d.status !== 'cancelled')
    .map((d) => ({
      deployment_id: d.id,
      status: d.status,
      start_date: d.start_date,
      finish_date: d.finish_date,
      role: roleByDep.get(d.id) ?? null,
      site_name: d.site_id ? siteById.get(d.site_id)?.name ?? null : null,
      site_postcode: d.site_id ? siteById.get(d.site_id)?.postcode ?? null : null,
    }));

  // Credentials with an expiry status.
  const now = new Date();
  const cards = await db.select().from(workerCards).where(eq(workerCards.worker_id, w.id)).all();
  const credentials = cards.map((card) => ({
    id: card.id,
    card_type: card.card_type,
    reference: card.reference,
    issuer: card.issuer,
    expiry_date: card.expiry_date,
    verification_status: card.verification_status,
    status: cardStatus(card.expiry_date, now),
  }));

  // Key Information Documents (issued/acknowledged — drafts stay internal).
  const kidRows = await db.select().from(kidDocuments).where(eq(kidDocuments.worker_id, w.id)).all();
  const kids = kidRows
    .filter((k) => k.status !== 'draft')
    .map((k) => ({ id: k.id, deployment_id: k.deployment_id, status: k.status, version: k.version }));

  return c.json({
    worker: { id: w.id, full_name: w.full_name, primary_trade: w.primary_trade, right_to_work_status: w.right_to_work_status, status: w.status },
    assignments,
    credentials,
    kids,
  });
});

export default route;
