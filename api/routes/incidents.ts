import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, or } from 'drizzle-orm';
import { incidents, userProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import {
  isIncidentType,
  isIncidentSeverity,
  requiresUrgentEscalation,
  incidentTypeLabel,
  type IncidentType,
  type IncidentSeverity,
} from '../../src/domain/commercial/incidents';
import { notify } from '../lib/notify';
import type { AppEnv } from '../env';

/**
 * Incident register — accidents, near misses, concerns and complaints. Admin-only
 * (the register holds sensitive/restricted notes). Urgent incidents notify the
 * ops team immediately (bypassing ordinary messaging).
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

const FIELDS = ['account_id', 'site_id', 'deployment_id', 'worker_id', 'gang_id', 'occurred_at', 'description', 'immediate_action', 'witnesses', 'investigation', 'outcome', 'restricted_notes'] as const;

route.get('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(incidents).orderBy(desc(incidents.created_at)).limit(500).all();
  return c.json({ incidents: rows });
});

route.get('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const r = (await db.select().from(incidents).where(eq(incidents.id, c.req.param('id'))).limit(1))[0];
  if (!r) return c.json({ error: 'not_found' }, 404);
  return c.json({ incident: r });
});

route.post('/', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isIncidentType(body.type)) return c.json({ error: 'invalid_type' }, 400);
  const type = body.type as IncidentType;
  const severity = isIncidentSeverity(body.severity) ? (body.severity as IncidentSeverity) : 'medium';
  const urgent = requiresUrgentEscalation(type, severity);

  const values: Record<string, unknown> = { type, severity, urgent, reported_by: me.userId };
  for (const f of FIELDS) if (f in body && body[f] !== undefined) values[f] = body[f] === '' ? null : body[f];

  const inserted = await db.insert(incidents).values(values as { type: IncidentType }).returning();
  const created = inserted[0]!;

  // Urgent incidents bypass ordinary messaging — alert the whole ops team now.
  if (urgent) {
    c.executionCtx.waitUntil(
      (async () => {
        const admins = await db.select({ user_id: userProfiles.user_id }).from(userProfiles)
          .where(or(eq(userProfiles.role, 'owner'), eq(userProfiles.role, 'ops_admin'))).all();
        for (const a of admins) {
          await notify(c.env, {
            userId: a.user_id,
            notification_type: 'incident_urgent',
            title: `Urgent: ${incidentTypeLabel(type)}`,
            body: str(body.description) ?? `A ${severity} ${incidentTypeLabel(type)} was reported.`,
            deep_link: '/workforce/incidents',
          });
        }
      })(),
    );
  }
  return c.json({ incident: created }, 201);
});

route.patch('/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const current = (await db.select().from(incidents).where(eq(incidents.id, id)).limit(1))[0];
  if (!current) return c.json({ error: 'not_found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body && body[f] !== undefined) patch[f] = body[f] === '' ? null : body[f];
  if (['open', 'investigating', 'closed'].includes(String(body.status))) patch.status = body.status;
  let type = current.type as IncidentType;
  let severity = current.severity as IncidentSeverity;
  if (isIncidentType(body.type)) { type = body.type as IncidentType; patch.type = type; }
  if (isIncidentSeverity(body.severity)) { severity = body.severity as IncidentSeverity; patch.severity = severity; }
  if ('type' in patch || 'severity' in patch) patch.urgent = requiresUrgentEscalation(type, severity);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);

  const updated = await db.update(incidents).set({ ...patch, updated_at: new Date() }).where(eq(incidents.id, id)).returning();
  return c.json({ incident: updated[0] });
});

export default route;
