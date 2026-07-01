import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { inArray } from 'drizzle-orm';
import { deployments, deploymentWorkers, labourRequests, commercialSites, workers } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * Dispatch board data (admin/ops). One call returns the live deployments that
 * still need dispatching plus the active workforce, so the board can render the
 * worker roster next to the deployments and assign in place.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const LIVE = new Set(['proposed', 'confirmed', 'active']);

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);

  const allDeps = await db.select().from(deployments).all();
  const deps = allDeps.filter((d) => LIVE.has(d.status));
  const depIds = deps.map((d) => d.id);

  const dws = depIds.length ? await db.select({ deployment_id: deploymentWorkers.deployment_id, worker_id: deploymentWorkers.worker_id }).from(deploymentWorkers).where(inArray(deploymentWorkers.deployment_id, depIds)).all() : [];
  const workerIdsByDep = new Map<string, string[]>();
  for (const w of dws) {
    const arr = workerIdsByDep.get(w.deployment_id) ?? [];
    arr.push(w.worker_id);
    workerIdsByDep.set(w.deployment_id, arr);
  }

  const reqIds = [...new Set(deps.map((d) => d.labour_request_id).filter(Boolean))];
  const reqs = reqIds.length ? await db.select({ id: labourRequests.id, title: labourRequests.title, number_required: labourRequests.number_required }).from(labourRequests).where(inArray(labourRequests.id, reqIds)).all() : [];
  const reqById = new Map(reqs.map((r) => [r.id, r]));

  const siteIds = [...new Set(deps.map((d) => d.site_id).filter((x): x is string => Boolean(x)))];
  const sites = siteIds.length ? await db.select({ id: commercialSites.id, name: commercialSites.name, postcode: commercialSites.postcode, latitude: commercialSites.latitude, longitude: commercialSites.longitude }).from(commercialSites).where(inArray(commercialSites.id, siteIds)).all() : [];
  const siteById = new Map(sites.map((s) => [s.id, s]));

  const boardDeployments = deps
    .map((d) => {
      const req = d.labour_request_id ? reqById.get(d.labour_request_id) : null;
      const site = d.site_id ? siteById.get(d.site_id) : null;
      return {
        id: d.id,
        status: d.status,
        start_date: d.start_date,
        finish_date: d.finish_date,
        site_name: site?.name ?? null,
        site_postcode: site?.postcode ?? null,
        site_lat: site?.latitude ?? null,
        site_lng: site?.longitude ?? null,
        request_title: req?.title ?? null,
        workers_required: req?.number_required ?? null,
        worker_ids: workerIdsByDep.get(d.id) ?? [],
      };
    })
    .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'));

  const activeWorkers = (await db.select().from(workers).all())
    .filter((w) => w.status === 'active')
    .map((w) => ({
      id: w.id,
      full_name: w.full_name,
      primary_trade: w.primary_trade,
      base_postcode: w.base_postcode,
      available_from: w.available_from,
      right_to_work_status: w.right_to_work_status,
      latitude: w.latitude,
      longitude: w.longitude,
    }));

  return c.json({ deployments: boardDeployments, workers: activeWorkers });
});

export default route;
