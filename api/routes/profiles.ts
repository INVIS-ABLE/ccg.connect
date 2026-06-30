import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { userProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import { isAppRole } from '../../src/domain/auth/roles';
import {
  isAdmin,
  canReadProfile,
  canWriteProfile,
  canSetRole,
} from '../../src/domain/permissions/permissions';
import { validateUpload } from '../../src/domain/media/validation';
import type { AppEnv } from '../env';

/** Minimal shape of an uploaded file (Workers File/Blob), avoiding the DOM lib. */
interface UploadedFile {
  type: string;
  size: number;
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type ProfileInsert = typeof userProfiles.$inferInsert;
const SELF_WRITABLE: (keyof ProfileInsert)[] = [
  'first_name', 'last_name', 'display_name', 'phone', 'profile_photo_url',
];
const ADMIN_WRITABLE: (keyof ProfileInsert)[] = ['account_status', 'client_id'];

function pick(body: Record<string, unknown>, keys: (keyof ProfileInsert)[]): Partial<ProfileInsert> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body && body[k as string] !== undefined) out[k as string] = body[k as string];
  return out as Partial<ProfileInsert>;
}

// GET /api/profiles/:userId — own profile, or any for admins.
route.get('/:userId', async (c) => {
  const p = c.get('principal');
  const userId = c.req.param('userId');
  if (!canReadProfile(p, { user_id: userId })) return c.json({ error: 'forbidden' }, 403);

  const db = drizzle(c.env.DB);
  const rows = await db.select().from(userProfiles).where(eq(userProfiles.user_id, userId)).limit(1);
  if (!rows[0]) return c.json({ error: 'not_found' }, 404);
  return c.json({ profile: rows[0] });
});

// POST /api/profiles/:userId/photo — upload an avatar (self or admin). Stored at
// a fixed R2 key per user (overwrites); profile_photo_url points at the serve route.
route.post('/:userId/photo', async (c) => {
  const p = c.get('principal');
  const userId = c.req.param('userId');
  if (!canWriteProfile(p, { user_id: userId })) return c.json({ error: 'forbidden' }, 403);

  const form = await c.req.formData().catch(() => null);
  const fileEntry = form?.get('file');
  if (fileEntry == null || typeof fileEntry === 'string') return c.json({ error: 'file_required' }, 400);
  const file = fileEntry as unknown as UploadedFile;

  const v = validateUpload(file.type, file.size);
  if (!v.ok || v.mediaType !== 'image') return c.json({ error: 'image_required' }, 400);

  const key = `avatars/${userId}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const url = `/api/profiles/${userId}/photo`;
  const db = drizzle(c.env.DB);
  const existing = await db.select({ user_id: userProfiles.user_id }).from(userProfiles).where(eq(userProfiles.user_id, userId)).limit(1);
  if (existing[0]) {
    await db.update(userProfiles).set({ profile_photo_url: url }).where(eq(userProfiles.user_id, userId));
  } else {
    await db.insert(userProfiles).values({ user_id: userId, role: 'contractor', profile_photo_url: url });
  }
  return c.json({ profile_photo_url: url });
});

// GET /api/profiles/:userId/photo — serve the avatar. Any authenticated user may
// view an avatar (they appear in chat and contacts).
route.get('/:userId/photo', async (c) => {
  const userId = c.req.param('userId');
  const object = await c.env.MEDIA.get(`avatars/${userId}`);
  if (!object) return c.json({ error: 'not_found' }, 404);
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, max-age=3600',
    },
  });
});

// PATCH /api/profiles/:userId — update own profile (or any, for admins). Creates
// the profile if it does not exist yet (self-provisioning on first sign-in).
route.patch('/:userId', async (c) => {
  const p = c.get('principal');
  const userId = c.req.param('userId');
  if (!canWriteProfile(p, { user_id: userId })) return c.json({ error: 'forbidden' }, 403);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  const updates = pick(body, SELF_WRITABLE);
  if (isAdmin(p)) Object.assign(updates, pick(body, ADMIN_WRITABLE));

  // Role changes: admin-only and never on self (invariant 5).
  if (body.role !== undefined) {
    if (!canSetRole(p, userId) || !isAppRole(body.role)) {
      return c.json({ error: 'cannot_set_role' }, 403);
    }
    updates.role = body.role;
  }

  const db = drizzle(c.env.DB);
  const existing = await db
    .select({ user_id: userProfiles.user_id })
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(userProfiles)
      .set(updates)
      .where(eq(userProfiles.user_id, userId))
      .returning();
    return c.json({ profile: updated[0] });
  }

  // New profile. Role defaults to the least-privileged 'contractor' unless an
  // admin explicitly set it above.
  const created = await db
    .insert(userProfiles)
    .values({ user_id: userId, role: updates.role ?? 'contractor', ...updates } as ProfileInsert)
    .returning();
  return c.json({ profile: created[0] }, 201);
});

export default route;
