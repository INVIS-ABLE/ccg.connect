import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and } from 'drizzle-orm';
import { formTemplates, formDocuments } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAdmin } from '../../src/domain/permissions/permissions';
import {
  parseContent,
  validateCompleteness,
  highestResidualBand,
  isFormType,
  type FormType,
} from '../../src/domain/forms/rams';
import type { AppEnv } from '../env';

/**
 * Forms — reusable RAMS / Method Statement templates, and the filled documents
 * produced from them (attached to a deployment). Admin-only (ops author site
 * safety paperwork). `content` is the RamsContent JSON shape; it is always
 * parsed/normalised through the domain so stored data is well-formed.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const admin = (c: Context<AppEnv>) => isAdmin(c.get('principal'));
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const asFormType = (v: unknown): FormType => (isFormType(v) ? v : 'rams');
const serialise = (raw: unknown): string => JSON.stringify(parseContent(raw));

/** Decorate a document row with parsed content + derived completeness/risk. */
function hydrateDoc(row: typeof formDocuments.$inferSelect) {
  const content = parseContent(row.content);
  const type = asFormType(row.form_type);
  return {
    ...row,
    content,
    completeness: validateCompleteness(content, type),
    highest_residual: highestResidualBand(content),
  };
}

// ── Templates ────────────────────────────────────────────────────────────────
route.get('/templates', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const type = c.req.query('type');
  const rows = type
    ? await db.select().from(formTemplates).where(eq(formTemplates.form_type, asFormType(type))).orderBy(desc(formTemplates.updated_at)).all()
    : await db.select().from(formTemplates).orderBy(desc(formTemplates.updated_at)).all();
  return c.json({ templates: rows.map((t) => ({ ...t, content: parseContent(t.content) })) });
});

route.get('/templates/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const t = (await db.select().from(formTemplates).where(eq(formTemplates.id, c.req.param('id'))).limit(1))[0];
  if (!t) return c.json({ error: 'not_found' }, 404);
  return c.json({ template: { ...t, content: parseContent(t.content) } });
});

route.post('/templates', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name);
  if (!name) return c.json({ error: 'name_required' }, 400);
  const inserted = await db.insert(formTemplates).values({
    name,
    form_type: asFormType(body.form_type),
    description: str(body.description),
    content: serialise(body.content),
    created_by: me.userId,
  }).returning();
  return c.json({ template: { ...inserted[0]!, content: parseContent(inserted[0]!.content) } }, 201);
});

route.patch('/templates/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ('name' in body) {
    const name = str(body.name);
    if (!name) return c.json({ error: 'name_required' }, 400);
    patch.name = name;
  }
  if ('description' in body) patch.description = str(body.description);
  if ('content' in body) patch.content = serialise(body.content);
  if ('active' in body) patch.active = body.active === true;
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(formTemplates).set({ ...patch, updated_at: new Date() }).where(eq(formTemplates.id, c.req.param('id'))).returning();
  if (!updated[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ template: { ...updated[0], content: parseContent(updated[0].content) } });
});

// ── Documents (filled, attached to a deployment) ─────────────────────────────
route.get('/documents', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const deploymentId = c.req.query('deployment_id');
  const rows = deploymentId
    ? await db.select().from(formDocuments).where(eq(formDocuments.deployment_id, deploymentId)).orderBy(desc(formDocuments.created_at)).all()
    : await db.select().from(formDocuments).orderBy(desc(formDocuments.created_at)).limit(500).all();
  return c.json({ documents: rows.map(hydrateDoc) });
});

route.get('/documents/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const d = (await db.select().from(formDocuments).where(eq(formDocuments.id, c.req.param('id'))).limit(1))[0];
  if (!d) return c.json({ error: 'not_found' }, 404);
  return c.json({ document: hydrateDoc(d) });
});

route.post('/documents', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = str(body.title);
  if (!title) return c.json({ error: 'title_required' }, 400);

  // Seed content & type from a template when one is given and no content passed.
  let formType = asFormType(body.form_type);
  let content = body.content;
  const templateId = str(body.template_id);
  if (templateId && content === undefined) {
    const tpl = (await db.select().from(formTemplates).where(eq(formTemplates.id, templateId)).limit(1))[0];
    if (tpl) {
      content = parseContent(tpl.content);
      formType = asFormType(tpl.form_type);
    }
  }

  const inserted = await db.insert(formDocuments).values({
    template_id: templateId,
    deployment_id: str(body.deployment_id),
    form_type: formType,
    title,
    reference: str(body.reference),
    site_name: str(body.site_name),
    prepared_by: str(body.prepared_by),
    content: serialise(content),
    created_by: me.userId,
  }).returning();
  return c.json({ document: hydrateDoc(inserted[0]!) }, 201);
});

route.patch('/documents/:id', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const current = (await db.select().from(formDocuments).where(eq(formDocuments.id, id)).limit(1))[0];
  if (!current) return c.json({ error: 'not_found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if ('title' in body) {
    const title = str(body.title);
    if (!title) return c.json({ error: 'title_required' }, 400);
    patch.title = title;
  }
  for (const f of ['reference', 'site_name', 'prepared_by'] as const) {
    if (f in body) patch[f] = str(body[f]);
  }
  if ('content' in body) {
    patch.content = serialise(body.content);
    // Editing an already-issued document re-opens it as a new draft version.
    if (current.status === 'issued') {
      patch.status = 'draft';
      patch.version = (current.version ?? 1) + 1;
      patch.issued_at = null;
    }
  }
  if (body.status === 'archived') patch.status = 'archived';
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing_to_update' }, 400);
  const updated = await db.update(formDocuments).set({ ...patch, updated_at: new Date() }).where(eq(formDocuments.id, id)).returning();
  return c.json({ document: hydrateDoc(updated[0]!) });
});

// Issue: freeze the document for distribution. Refuses if not complete — safety
// paperwork must not go out with required sections or the hazard table missing.
route.post('/documents/:id/issue', async (c) => {
  if (!admin(c)) return c.json({ error: 'forbidden' }, 403);
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const d = (await db.select().from(formDocuments).where(eq(formDocuments.id, id)).limit(1))[0];
  if (!d) return c.json({ error: 'not_found' }, 404);
  const content = parseContent(d.content);
  const completeness = validateCompleteness(content, asFormType(d.form_type));
  if (!completeness.complete) return c.json({ error: 'incomplete', missing: completeness.missing }, 400);
  const updated = await db.update(formDocuments).set({
    status: 'issued',
    issued_at: new Date().toISOString(),
    updated_at: new Date(),
  }).where(and(eq(formDocuments.id, id), eq(formDocuments.status, 'draft'))).returning();
  if (!updated[0]) return c.json({ error: 'not_draft' }, 400);
  return c.json({ document: hydrateDoc(updated[0]) });
});

export default route;
