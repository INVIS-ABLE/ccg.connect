import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { leads } from '../db/schema';
import { requireAuth } from '../lib/session';
import { canReadLeads } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'rejected'] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

// PUBLIC — create a lead (no auth). Invariant 4: anyone may create, no one public
// may read. Returns only an id, never lead contents.
route.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = str(body?.name, 200);
  const email = str(body?.email, 320);
  if (!name || !email) return c.json({ error: 'name_and_email_required' }, 400);
  if (body?.consent !== true) return c.json({ error: 'consent_required' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: 'invalid_email' }, 400);

  const db = drizzle(c.env.DB);
  const inserted = await db
    .insert(leads)
    .values({
      name,
      email,
      consent: true,
      status: 'new',
      company: str(body?.company, 200),
      phone: str(body?.phone, 50),
      site_postcode: str(body?.site_postcode, 20),
      work_type: str(body?.work_type, 200),
      description: str(body?.description, 5000),
      desired_dates: str(body?.desired_dates, 200),
    })
    .returning({ id: leads.id });
  return c.json({ ok: true, id: inserted[0]?.id }, 201);
});

// ADMIN — list leads.
route.get('/', requireAuth, async (c) => {
  if (!canReadLeads(c.get('principal'))) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(leads).orderBy(desc(leads.created_at)).limit(500);
  return c.json({ leads: rows });
});

// ADMIN — update lead status (e.g. qualify / reject / mark converted).
route.patch('/:id', requireAuth, async (c) => {
  if (!canReadLeads(c.get('principal'))) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status;
  if (typeof status !== 'string' || !LEAD_STATUSES.includes(status as LeadStatus)) {
    return c.json({ error: 'invalid_status' }, 400);
  }
  const db = drizzle(c.env.DB);
  const updated = await db
    .update(leads)
    .set({ status: status as LeadStatus })
    .where(eq(leads.id, c.req.param('id')))
    .returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ lead: updated[0] });
});

export default route;
