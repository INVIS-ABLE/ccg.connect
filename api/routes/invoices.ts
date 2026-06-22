import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { invoices } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin, canManageInvoices, canReadInvoice } from '../../src/domain/permissions/permissions';
import { computeVat } from '../../src/domain/invoices/vat';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const INVOICE_STATUSES = [
  'draft', 'submitted', 'approved', 'sent', 'paid', 'overdue', 'disputed', 'cancelled',
] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// GET /api/invoices — role-scoped list.
route.get('/', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  if (isAdmin(p)) {
    const rows = await db.select().from(invoices).orderBy(desc(invoices.created_at)).limit(500);
    return c.json({ invoices: rows });
  }
  if (p.role === 'contractor') {
    if (!p.contractorId) return c.json({ invoices: [] });
    const rows = await db.select().from(invoices).where(eq(invoices.contractor_id, p.contractorId)).limit(500);
    return c.json({ invoices: rows });
  }
  if (p.role === 'client') {
    if (!p.clientId) return c.json({ invoices: [] });
    const rows = await db.select().from(invoices).where(eq(invoices.client_id, p.clientId)).limit(500);
    return c.json({ invoices: rows });
  }
  return c.json({ invoices: [] });
});

// GET /api/invoices/:id
route.get('/:id', async (c) => {
  const p = c.get('principal');
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(invoices).where(eq(invoices.id, c.req.param('id'))).limit(1);
  const inv = rows[0];
  if (!inv) return c.json({ error: 'not_found' }, 404);
  if (!canReadInvoice(p, inv)) return c.json({ error: 'forbidden' }, 403);
  return c.json({ invoice: inv });
});

// POST /api/invoices — admin creates an invoice; VAT/gross computed server-side.
route.post('/', async (c) => {
  const p = c.get('principal');
  if (!canManageInvoices(p)) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const jobId = typeof body?.job_id === 'string' ? body.job_id : null;
  const net = typeof body?.net_amount === 'number' ? body.net_amount : null;
  if (!jobId) return c.json({ error: 'job_id_required' }, 400);
  if (net == null || net < 0) return c.json({ error: 'net_amount_required' }, 400);

  const vatRate = typeof body?.vat_rate === 'number' ? body.vat_rate : 20;
  let vatBreakdown;
  try {
    vatBreakdown = computeVat(net, vatRate);
  } catch (err) {
    return c.json({ error: 'invalid_amount', detail: err instanceof Error ? err.message : 'bad amount' }, 400);
  }

  const invoiceType =
    body?.invoice_type === 'ccg_to_client' ? 'ccg_to_client' : 'contractor_to_ccg';

  const db = drizzle(c.env.DB);
  const created = await db
    .insert(invoices)
    .values({
      job_id: jobId,
      contractor_id: typeof body?.contractor_id === 'string' ? body.contractor_id : null,
      client_id: typeof body?.client_id === 'string' ? body.client_id : null,
      invoice_number: typeof body?.invoice_number === 'string' ? body.invoice_number : null,
      invoice_type: invoiceType,
      issue_date: typeof body?.issue_date === 'string' ? body.issue_date : null,
      due_date: typeof body?.due_date === 'string' ? body.due_date : null,
      net_amount: vatBreakdown.net,
      vat_rate: vatBreakdown.vatRate,
      vat_amount: vatBreakdown.vat,
      gross_amount: vatBreakdown.gross,
      status: 'draft',
      notes: typeof body?.notes === 'string' ? body.notes : null,
    })
    .returning();
  return c.json({ invoice: created[0] }, 201);
});

// PATCH /api/invoices/:id — admin status changes; recomputes VAT if net/rate change.
route.patch('/:id', async (c) => {
  const p = c.get('principal');
  if (!canManageInvoices(p)) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  const updates: Record<string, unknown> = {};
  if (typeof body.status === 'string') {
    if (!INVOICE_STATUSES.includes(body.status as InvoiceStatus)) return c.json({ error: 'invalid_status' }, 400);
    updates.status = body.status;
    if (body.status === 'paid' && typeof body.payment_date === 'string') updates.payment_date = body.payment_date;
  }
  if (typeof body.net_amount === 'number') {
    const rate = typeof body.vat_rate === 'number' ? body.vat_rate : 20;
    const v = computeVat(body.net_amount, rate);
    updates.net_amount = v.net;
    updates.vat_rate = v.vatRate;
    updates.vat_amount = v.vat;
    updates.gross_amount = v.gross;
  }
  if (Object.keys(updates).length === 0) return c.json({ error: 'nothing_to_update' }, 400);

  const db = drizzle(c.env.DB);
  const updated = await db.update(invoices).set(updates).where(eq(invoices.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ invoice: updated[0] });
});

export default route;
