import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, desc } from 'drizzle-orm';
import { quotes } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import type { AppEnv } from '../env';

/**
 * Quotes. Admin-managed; a client user may read only quotes for their own org
 * (invariant 2). Amounts are computed server-side from the line items so the
 * stored totals are trustworthy.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type QuoteInsert = typeof quotes.$inferInsert;
type LineItem = { description?: string; qty?: number; unitPrice?: number };

function computeTotals(lineItems: LineItem[], vatRate: number) {
  const net = lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unitPrice) || 0), 0);
  const vat = net * (vatRate / 100);
  return { net_amount: net, vat_amount: vat, gross_amount: net + vat };
}

// GET /api/quotes?job_id=… — admins all; client users only their org's.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const jobId = c.req.query('job_id');

  if (isAdmin(p)) {
    const where = jobId ? eq(quotes.job_id, jobId) : undefined;
    const rows = await db
      .select()
      .from(quotes)
      .where(where ?? undefined)
      .orderBy(desc(quotes.created_at))
      .limit(500);
    return c.json({ quotes: rows });
  }
  if (p.role === 'client' && p.clientId) {
    const rows = await db
      .select()
      .from(quotes)
      .where(jobId ? and(eq(quotes.client_id, p.clientId), eq(quotes.job_id, jobId)) : eq(quotes.client_id, p.clientId))
      .orderBy(desc(quotes.created_at))
      .limit(500);
    return c.json({ quotes: rows });
  }
  return c.json({ quotes: [] });
});

// POST /api/quotes — create (admin only). Totals are recomputed server-side.
route.post('/', async (c) => {
  const p = c.get('principal');
  if (!isAdmin(p)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const lineItems: LineItem[] = Array.isArray(body.line_items) ? (body.line_items as LineItem[]) : [];
  const vatRate = typeof body.vat_rate === 'number' ? body.vat_rate : 20;
  const totals = computeTotals(lineItems, vatRate);

  const values: QuoteInsert = {
    job_id: typeof body.job_id === 'string' ? body.job_id : null,
    client_id: typeof body.client_id === 'string' ? body.client_id : null,
    quote_number: typeof body.quote_number === 'string' ? body.quote_number : null,
    recipient_name: typeof body.recipient_name === 'string' ? body.recipient_name : null,
    status: 'draft',
    line_items: JSON.stringify(lineItems),
    vat_rate: vatRate,
    ...totals,
    valid_until: typeof body.valid_until === 'string' ? body.valid_until : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    created_by: p.userId,
  };
  const db = drizzle(c.env.DB);
  const inserted = await db.insert(quotes).values(values).returning();
  return c.json({ quote: inserted[0] }, 201);
});

// PATCH /api/quotes/:id — update status / fields (admin only).
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  if (!isAdmin(p)) return c.json({ error: 'forbidden' }, 403);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  const patch: Partial<QuoteInsert> = {};
  const ALLOWED = ['draft', 'sent', 'accepted', 'declined', 'expired'];
  if (typeof body.status === 'string' && ALLOWED.includes(body.status)) {
    patch.status = body.status as QuoteInsert['status'];
  }
  if (typeof body.notes === 'string') patch.notes = body.notes;
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);

  const db = drizzle(c.env.DB);
  const updated = await db.update(quotes).set(patch).where(eq(quotes.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ quote: updated[0] });
});

export default route;
