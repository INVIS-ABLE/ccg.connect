import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { inArray } from 'drizzle-orm';
import {
  corporateAccounts,
  commercialSites,
  labourRequests,
  deployments,
  deploymentWorkers,
  commercialInvoices,
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

  return c.json({ accounts: portalAccounts, deployments: portalDeployments, invoices: portalInvoices });
});

export default route;
