import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, desc, and } from 'drizzle-orm';
import {
  deployments,
  deploymentWorkers,
  deploymentAttendance,
  deploymentReplacements,
  siteDiaryEntries,
  labourRequests,
  gangMembers,
  workers,
  workerCards,
  conversations,
  commercialSites,
  kidDocuments,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import { complianceMatrix, mergeRequirements, RTW_REQUIREMENT } from '../../src/domain/workforce/compliance';
import { isAttendanceStatus } from '../../src/domain/commercial/attendance';
import { rankReplacementCandidates } from '../../src/domain/commercial/replacement';
import { distanceMeters } from '../../src/domain/geo/geo';
import { notify } from '../lib/notify';
import type { AppEnv } from '../env';

/**
 * Deployments — connect workers (often a gang) to a labour request + site. On
 * confirmation we freeze a compliance snapshot and auto-create the site group
 * chat. Admin-only.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Workers (passport + cards) for a deployment, shaped for the compliance matrix. */
async function deploymentWorkerInputs(db: ReturnType<typeof drizzle>, deploymentId: string) {
  const dws = await db.select().from(deploymentWorkers).where(eq(deploymentWorkers.deployment_id, deploymentId)).all();
  const ids = dws.map((d) => d.worker_id);
  const wrows = ids.length ? await db.select().from(workers).where(inArray(workers.id, ids)).all() : [];
  const crows = ids.length ? await db.select().from(workerCards).where(inArray(workerCards.worker_id, ids)).all() : [];
  const cardsByWorker = new Map<string, typeof crows>();
  for (const cd of crows) {
    const arr = cardsByWorker.get(cd.worker_id) ?? [];
    arr.push(cd);
    cardsByWorker.set(cd.worker_id, arr);
  }
  const byId = new Map(wrows.map((w) => [w.id, w]));
  return { dws, workersById: byId, cardsByWorker };
}

/** Required checks for a request: RTW + its comma-separated minimum qualifications. */
function requestRequirements(req: { minimum_qualifications: string | null }): string[] {
  const quals = (req.minimum_qualifications ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return mergeRequirements([RTW_REQUIREMENT], quals);
}

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const requestId = c.req.query('labour_request_id');
  const rows = requestId
    ? await db.select().from(deployments).where(eq(deployments.labour_request_id, requestId)).all()
    : await db.select().from(deployments).orderBy(desc(deployments.created_at)).all();
  return c.json({ deployments: rows });
});

route.get('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select().from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);

  const req = (await db.select().from(labourRequests).where(eq(labourRequests.id, dep.labour_request_id)).limit(1))[0] ?? null;
  const { dws, workersById, cardsByWorker } = await deploymentWorkerInputs(db, id);
  const members = dws.map((d) => {
    const w = workersById.get(d.worker_id);
    return {
      id: d.id,
      worker_id: d.worker_id,
      role: d.role,
      pay_rate: d.pay_rate,
      charge_rate: d.charge_rate,
      worker: w ? { ...w, cards: cardsByWorker.get(d.worker_id) ?? [] } : null,
    };
  });

  // Live compliance against the request's requirements.
  const requirements = req ? requestRequirements(req) : [RTW_REQUIREMENT];
  const matrixInputs = members
    .filter((m) => m.worker)
    .map((m) => ({
      id: m.worker_id,
      full_name: m.worker!.full_name,
      right_to_work_status: m.worker!.right_to_work_status,
      rtw_expiry: m.worker!.rtw_expiry,
      cards: m.worker!.cards ?? [],
    }));
  const compliance = complianceMatrix(matrixInputs, requirements, new Date());

  return c.json({ deployment: dep, request: req, requirements, members, compliance });
});

route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const requestId = str(body.labour_request_id);
  if (!requestId) return c.json({ error: 'labour_request_id_required' }, 400);
  const req = (await db.select().from(labourRequests).where(eq(labourRequests.id, requestId)).limit(1))[0];
  if (!req) return c.json({ error: 'request_not_found' }, 404);

  // Worker ids come either from an explicit list or by expanding a gang.
  let workerIds: string[] = Array.isArray(body.worker_ids)
    ? (body.worker_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const gangId = str(body.gang_id);
  if (gangId) {
    const gm = await db.select({ worker_id: gangMembers.worker_id }).from(gangMembers).where(eq(gangMembers.gang_id, gangId)).all();
    workerIds = [...new Set([...workerIds, ...gm.map((m) => m.worker_id)])];
  }

  const inserted = await db.insert(deployments).values({
    labour_request_id: requestId,
    account_id: req.account_id,
    site_id: req.site_id,
    gang_id: gangId,
    start_date: str(body.start_date) ?? req.start_date,
    finish_date: str(body.finish_date) ?? req.finish_date,
    notes: str(body.notes),
    created_by: me.userId,
  }).returning();
  const deployment = inserted[0]!;

  // Attach workers (idempotent via unique index).
  for (const wid of workerIds) {
    try {
      await db.insert(deploymentWorkers).values({ deployment_id: deployment.id, worker_id: wid });
    } catch {
      /* already attached */
    }
  }
  return c.json({ deployment }, 201);
});

route.post('/:id/confirm', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select().from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);
  if (dep.status === 'cancelled') return c.json({ error: 'cancelled' }, 400);

  const req = (await db.select().from(labourRequests).where(eq(labourRequests.id, dep.labour_request_id)).limit(1))[0] ?? null;
  const { dws, workersById, cardsByWorker } = await deploymentWorkerInputs(db, id);
  const requirements = req ? requestRequirements(req) : [RTW_REQUIREMENT];
  const inputs = dws
    .map((d) => workersById.get(d.worker_id))
    .filter((w): w is NonNullable<typeof w> => !!w)
    .map((w) => ({
      id: w.id,
      full_name: w.full_name,
      right_to_work_status: w.right_to_work_status,
      rtw_expiry: w.rtw_expiry,
      cards: cardsByWorker.get(w.id) ?? [],
    }));
  const now = new Date();
  const snapshot = { at: now.toISOString(), requirements, rows: complianceMatrix(inputs, requirements, now) };

  // Auto-create the site group chat (idempotent on pair_key) and link it.
  const pairKey = `deployment:${id}`;
  let conversationId = dep.conversation_id;
  if (!conversationId) {
    const existing = (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.pair_key, pairKey)).limit(1))[0];
    if (existing) {
      conversationId = existing.id;
    } else {
      const title = req?.title ? `Site — ${req.title}` : 'Site chat';
      const created = (await db.insert(conversations).values({
        kind: 'site', pair_key: pairKey, deployment_id: id, title,
      }).returning())[0];
      conversationId = created?.id ?? null;
    }
  }

  const updated = await db.update(deployments).set({
    status: 'confirmed',
    confirmed_at: now.toISOString(),
    compliance_snapshot: JSON.stringify(snapshot),
    conversation_id: conversationId,
    updated_at: now,
  }).where(eq(deployments.id, id)).returning();

  // Notify each assigned worker who has a login — the bell in their portal.
  c.executionCtx.waitUntil((async () => {
    for (const d of dws) {
      const w = workersById.get(d.worker_id);
      if (!w?.user_id) continue;
      await notify(c.env, {
        userId: w.user_id,
        notification_type: 'deployment_confirmed',
        title: 'New assignment confirmed',
        body: req?.title ? `You're booked on ${req.title}.` : 'You have a new site assignment.',
        deep_link: `/checkin/deployment/${id}`,
      });
    }
  })());

  return c.json({ deployment: updated[0], conversation_id: conversationId, snapshot });
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (['proposed', 'confirmed', 'active', 'completed', 'cancelled'].includes(String(body.status))) {
    patch.status = body.status;
  }
  if ('notes' in body) patch.notes = str(body.notes);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(deployments).set({ ...patch, updated_at: new Date() }).where(eq(deployments.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ deployment: updated[0] });
});

// ── Assign / unassign a worker on an existing deployment (dispatch) ───────────
route.post('/:id/workers', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select({ id: deployments.id }).from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const workerId = str(body.worker_id);
  if (!workerId) return c.json({ error: 'worker_id_required' }, 400);
  // Idempotent — the unique (deployment, worker) index prevents duplicates.
  try {
    await db.insert(deploymentWorkers).values({ deployment_id: id, worker_id: workerId });
  } catch {
    /* already assigned */
  }
  return c.json({ ok: true }, 201);
});

route.delete('/:id/workers/:workerId', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  await db.delete(deploymentWorkers).where(and(eq(deploymentWorkers.deployment_id, c.req.param('id')), eq(deploymentWorkers.worker_id, c.req.param('workerId'))));
  return c.json({ ok: true });
});

// ── Attendance / roll-call ───────────────────────────────────────────────────
route.get('/:id/attendance', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const date = c.req.query('date');
  const rows = date
    ? await db.select().from(deploymentAttendance).where(and(eq(deploymentAttendance.deployment_id, c.req.param('id')), eq(deploymentAttendance.date, date))).all()
    : await db.select().from(deploymentAttendance).where(eq(deploymentAttendance.deployment_id, c.req.param('id'))).all();
  return c.json({ attendance: rows });
});

// Upsert one worker's roll-call for a day.
route.post('/:id/attendance', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const deploymentId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const workerId = str(body.worker_id);
  const date = str(body.date);
  if (!workerId || !date) return c.json({ error: 'worker_id_and_date_required' }, 400);
  const status = isAttendanceStatus(body.status) ? body.status : 'present';
  const fields = {
    status,
    check_in_time: str(body.check_in_time),
    check_out_time: str(body.check_out_time),
    method: ['qr', 'geofence', 'roll_call', 'supervisor', 'manual'].includes(String(body.method)) ? (body.method as 'qr' | 'geofence' | 'roll_call' | 'supervisor' | 'manual') : 'roll_call',
    confirmed_by: me.userId,
    reason: str(body.reason),
    replacement_needed: body.replacement_needed === true,
    notes: str(body.notes),
  };

  const existing = (await db.select({ id: deploymentAttendance.id }).from(deploymentAttendance)
    .where(and(eq(deploymentAttendance.deployment_id, deploymentId), eq(deploymentAttendance.worker_id, workerId), eq(deploymentAttendance.date, date))).limit(1))[0];
  if (existing) {
    const updated = await db.update(deploymentAttendance).set({ ...fields, updated_at: new Date() }).where(eq(deploymentAttendance.id, existing.id)).returning();
    return c.json({ record: updated[0] });
  }
  const inserted = await db.insert(deploymentAttendance).values({ deployment_id: deploymentId, worker_id: workerId, date, ...fields }).returning();
  return c.json({ record: inserted[0] }, 201);
});

// ── QR site check-in ─────────────────────────────────────────────────────────
// A worker scans the site QR and clocks themselves in/out; ops or the gang
// leader can clock a worker in from the same screen (kiosk style). Writes to
// deployment_attendance with method='qr' and the captured location as evidence.
// Roll-call still overrides — GPS is never the sole truth (CLAUDE.md / HSE).

/** The worker record (if any) linked to the caller's login. */
async function callerWorkerId(db: ReturnType<typeof drizzle>, userId: string): Promise<string | null> {
  const row = (await db.select({ id: workers.id }).from(workers).where(eq(workers.user_id, userId)).limit(1))[0];
  return row?.id ?? null;
}

async function workerOnDeployment(db: ReturnType<typeof drizzle>, deploymentId: string, workerId: string): Promise<boolean> {
  const row = (await db.select({ id: deploymentWorkers.id }).from(deploymentWorkers)
    .where(and(eq(deploymentWorkers.deployment_id, deploymentId), eq(deploymentWorkers.worker_id, workerId))).limit(1))[0];
  return Boolean(row);
}

const todayDate = () => new Date().toISOString().slice(0, 10);

// GET /api/deployments/:id/checkin — context for the check-in screen.
route.get('/:id/checkin', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select().from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);

  const isAdminUser = admin(c);
  const myWorkerId = isAdminUser ? null : await callerWorkerId(db, me.userId);
  if (!isAdminUser && !(myWorkerId && (await workerOnDeployment(db, id, myWorkerId)))) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const site = dep.site_id
    ? (await db.select({ name: commercialSites.name, postcode: commercialSites.postcode })
        .from(commercialSites).where(eq(commercialSites.id, dep.site_id)).limit(1))[0] ?? null
    : null;
  const date = todayDate();
  const att = await db.select().from(deploymentAttendance)
    .where(and(eq(deploymentAttendance.deployment_id, id), eq(deploymentAttendance.date, date))).all();
  const recordOf = (wid: string) => att.find((a) => a.worker_id === wid) ?? null;

  const base = {
    deployment: {
      id: dep.id, status: dep.status, start_date: dep.start_date,
      site_name: site?.name ?? null, site_postcode: site?.postcode ?? null,
    },
    date,
    is_admin: isAdminUser,
  };

  // Admins see the full roster + today's marks; a worker sees only their own
  // status (never other workers' names — invariant: minimal disclosure).
  if (isAdminUser) {
    const { dws, workersById } = await deploymentWorkerInputs(db, id);
    const roster = dws.map((d) => {
      const r = recordOf(d.worker_id);
      return {
        worker_id: d.worker_id,
        full_name: workersById.get(d.worker_id)?.full_name ?? 'Worker',
        status: r?.status ?? null, check_in_time: r?.check_in_time ?? null, check_out_time: r?.check_out_time ?? null,
        geofence_ok: r?.geofence_ok ?? null, geofence_distance_m: r?.geofence_distance_m ?? null,
      };
    });
    return c.json({ ...base, roster });
  }

  const meWorker = (await db.select({ full_name: workers.full_name }).from(workers).where(eq(workers.id, myWorkerId!)).limit(1))[0];
  const r = recordOf(myWorkerId!);
  // Surface the worker's own Key Information Document for this deployment so they
  // can review and acknowledge it — drafts stay hidden (not yet issued).
  const kidRow = (await db.select().from(kidDocuments)
    .where(and(eq(kidDocuments.deployment_id, id), eq(kidDocuments.worker_id, myWorkerId!)))
    .orderBy(desc(kidDocuments.created_at)).limit(1))[0];
  return c.json({
    ...base,
    me_worker: {
      id: myWorkerId, full_name: meWorker?.full_name ?? 'You',
      status: r?.status ?? null, check_in_time: r?.check_in_time ?? null, check_out_time: r?.check_out_time ?? null,
      geofence_ok: r?.geofence_ok ?? null, geofence_distance_m: r?.geofence_distance_m ?? null,
    },
    my_kid: kidRow && kidRow.status !== 'draft' ? kidRow : null,
  });
});

// POST /api/deployments/:id/checkin — record a QR arrival/departure (+ location).
route.post('/:id/checkin', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select({ id: deployments.id, site_id: deployments.site_id }).from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const checkType = body.check_type === 'departure' ? 'departure' : 'arrival';

  // Admins may clock any worker on the deployment; a worker clocks only themselves.
  const myWorkerId = await callerWorkerId(db, me.userId);
  const targetWorkerId = admin(c) && str(body.worker_id) ? str(body.worker_id) : myWorkerId;
  if (!targetWorkerId) return c.json({ error: 'no_worker_for_user' }, 403);
  if (!(await workerOnDeployment(db, id, targetWorkerId))) return c.json({ error: 'forbidden' }, 403);

  const date = todayDate();
  const now = new Date().toISOString();
  const lat = num(body.latitude);
  const lng = num(body.longitude);

  // Geofence: flag whether the worker is within the site's radius. Advisory only
  // — never blocks a check-in (poor signal / large sites); roll-call overrides.
  let geofence_ok: boolean | null = null;
  let geofence_distance_m: number | null = null;
  if (dep.site_id && lat != null && lng != null) {
    const site = (await db.select({ latitude: commercialSites.latitude, longitude: commercialSites.longitude, geofence_radius_m: commercialSites.geofence_radius_m })
      .from(commercialSites).where(eq(commercialSites.id, dep.site_id)).limit(1))[0];
    if (site?.latitude != null && site.longitude != null && site.geofence_radius_m) {
      geofence_distance_m = distanceMeters({ lng: site.longitude, lat: site.latitude }, { lng, lat });
      geofence_ok = geofence_distance_m <= site.geofence_radius_m;
    }
  }
  const loc = { check_in_lat: lat, check_in_lng: lng, check_in_accuracy_m: num(body.accuracy_m), geofence_ok, geofence_distance_m };
  const existing = (await db.select().from(deploymentAttendance)
    .where(and(eq(deploymentAttendance.deployment_id, id), eq(deploymentAttendance.worker_id, targetWorkerId), eq(deploymentAttendance.date, date))).limit(1))[0];

  if (checkType === 'departure') {
    if (existing) {
      const updated = await db.update(deploymentAttendance)
        .set({ check_out_time: now, method: 'qr', confirmed_by: me.userId, updated_at: new Date() })
        .where(eq(deploymentAttendance.id, existing.id)).returning();
      return c.json({ record: updated[0] });
    }
    const inserted = await db.insert(deploymentAttendance).values({
      deployment_id: id, worker_id: targetWorkerId, date, status: 'present',
      check_out_time: now, method: 'qr', confirmed_by: me.userId, ...loc,
    }).returning();
    return c.json({ record: inserted[0] }, 201);
  }

  // arrival — keep an earlier check-in time if one exists; refresh location.
  if (existing) {
    const updated = await db.update(deploymentAttendance)
      .set({ check_in_time: existing.check_in_time ?? now, method: 'qr', confirmed_by: me.userId, ...loc, updated_at: new Date() })
      .where(eq(deploymentAttendance.id, existing.id)).returning();
    return c.json({ record: updated[0] });
  }
  const inserted = await db.insert(deploymentAttendance).values({
    deployment_id: id, worker_id: targetWorkerId, date, status: 'present',
    check_in_time: now, method: 'qr', confirmed_by: me.userId, ...loc,
  }).returning();
  return c.json({ record: inserted[0] }, 201);
});

// ── Site diary ───────────────────────────────────────────────────────────────
route.get('/:id/diary', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(siteDiaryEntries).where(eq(siteDiaryEntries.deployment_id, c.req.param('id'))).orderBy(desc(siteDiaryEntries.date)).all();
  return c.json({ entries: rows });
});

route.post('/:id/diary', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const date = str(body.date);
  if (!date) return c.json({ error: 'date_required' }, 400);
  const headcount = num(body.headcount);
  const inserted = await db.insert(siteDiaryEntries).values({
    deployment_id: c.req.param('id'),
    date,
    weather: str(body.weather),
    headcount,
    work_summary: str(body.work_summary),
    deliveries: str(body.deliveries),
    visitors: str(body.visitors),
    issues: str(body.issues),
    notes: str(body.notes),
    created_by: me.userId,
  }).returning();
  return c.json({ entry: inserted[0] }, 201);
});

// ── Replacements ─────────────────────────────────────────────────────────────
// Surface compliant stand-ins ranked best-first. Every candidate is checked
// individually against the request's requirements — a gang is never a shortcut.
route.get('/:id/replacement-candidates', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select().from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);
  const req = (await db.select().from(labourRequests).where(eq(labourRequests.id, dep.labour_request_id)).limit(1))[0] ?? null;
  const requirements = req ? requestRequirements(req) : [RTW_REQUIREMENT];

  // Available workers = active workers not already on this deployment.
  const onDeployment = new Set(
    (await db.select({ worker_id: deploymentWorkers.worker_id }).from(deploymentWorkers).where(eq(deploymentWorkers.deployment_id, id)).all())
      .map((d) => d.worker_id),
  );
  const allWorkers = await db.select().from(workers).where(eq(workers.status, 'active')).all();
  const available = allWorkers.filter((w) => !onDeployment.has(w.id));
  const ids = available.map((w) => w.id);
  const crows = ids.length ? await db.select().from(workerCards).where(inArray(workerCards.worker_id, ids)).all() : [];
  const cardsByWorker = new Map<string, typeof crows>();
  for (const cd of crows) {
    const arr = cardsByWorker.get(cd.worker_id) ?? [];
    arr.push(cd);
    cardsByWorker.set(cd.worker_id, arr);
  }
  const inputs = available.map((w) => ({
    id: w.id,
    full_name: w.full_name,
    right_to_work_status: w.right_to_work_status,
    rtw_expiry: w.rtw_expiry,
    cards: cardsByWorker.get(w.id) ?? [],
  }));
  const candidates = rankReplacementCandidates(inputs, requirements, new Date());
  return c.json({ requirements, candidates });
});

route.get('/:id/replacements', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(deploymentReplacements)
    .where(eq(deploymentReplacements.deployment_id, c.req.param('id')))
    .orderBy(desc(deploymentReplacements.created_at)).all();
  return c.json({ replacements: rows });
});

// Swap one worker for another, preserving role/rates, and record an audit row.
route.post('/:id/replacements', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const dep = (await db.select().from(deployments).where(eq(deployments.id, id)).limit(1))[0];
  if (!dep) return c.json({ error: 'not_found' }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const originalWorkerId = str(body.original_worker_id);
  const replacementWorkerId = str(body.replacement_worker_id);
  if (!originalWorkerId || !replacementWorkerId) return c.json({ error: 'original_and_replacement_required' }, 400);
  if (originalWorkerId === replacementWorkerId) return c.json({ error: 'same_worker' }, 400);

  const original = (await db.select().from(deploymentWorkers)
    .where(and(eq(deploymentWorkers.deployment_id, id), eq(deploymentWorkers.worker_id, originalWorkerId))).limit(1))[0];
  if (!original) return c.json({ error: 'original_not_on_deployment' }, 404);

  const replacement = (await db.select().from(workers).where(eq(workers.id, replacementWorkerId)).limit(1))[0];
  if (!replacement) return c.json({ error: 'replacement_not_found' }, 404);

  const alreadyOn = (await db.select({ id: deploymentWorkers.id }).from(deploymentWorkers)
    .where(and(eq(deploymentWorkers.deployment_id, id), eq(deploymentWorkers.worker_id, replacementWorkerId))).limit(1))[0];
  if (alreadyOn) return c.json({ error: 'replacement_already_on_deployment' }, 409);

  const now = new Date();
  // Preserve the slot's role and rates so margins/costing stay intact.
  await db.insert(deploymentWorkers).values({
    deployment_id: id,
    worker_id: replacementWorkerId,
    role: original.role,
    pay_rate: original.pay_rate,
    charge_rate: original.charge_rate,
  });
  await db.delete(deploymentWorkers).where(eq(deploymentWorkers.id, original.id));

  const audit = await db.insert(deploymentReplacements).values({
    deployment_id: id,
    original_worker_id: originalWorkerId,
    replacement_worker_id: replacementWorkerId,
    reason: str(body.reason),
    status: 'filled',
    requested_by: me.userId,
    filled_at: now.toISOString(),
  }).returning();

  return c.json({ replacement: audit[0] }, 201);
});

export default route;
