import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { conversations, directMessages, userProfiles } from '../db/schema';
import { requireAuth } from '../lib/session';
import {
  canStartConversation,
  isConversationParticipant,
} from '../../src/domain/permissions/permissions';
import { isAppRole } from '../../src/domain/auth/roles';
import type { AppEnv } from '../env';

/**
 * Direct messaging (1:1 WhatsApp-style chat).
 *
 * Authorization is enforced here on every operation (invariant 9): who may talk
 * to whom is hub-and-spoke (src/domain/permissions.canStartConversation), and
 * only the two participants may read or post in a conversation. Frontend hiding
 * is never the security boundary.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type ProfileRow = typeof userProfiles.$inferSelect;

function displayName(p: Pick<ProfileRow, 'first_name' | 'last_name' | 'display_name' | 'email'>): string {
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return full || p.display_name || p.email || 'User';
}

function toContact(p: ProfileRow) {
  return {
    user_id: p.user_id,
    name: displayName(p),
    role: p.role,
    profile_photo_url: p.profile_photo_url,
  };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('__');
}

// GET /api/messages/contacts — people the caller is allowed to start a chat with.
route.get('/contacts', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const all = await db.select().from(userProfiles).all();
  const contacts = all
    .filter((u) => u.user_id !== me.userId)
    .filter((u) => u.account_status !== 'archived')
    .filter((u) => isAppRole(u.role) && canStartConversation(me, u.role))
    .map(toContact)
    .sort((x, y) => x.name.localeCompare(y.name));
  return c.json({ contacts });
});

// GET /api/messages/conversations — the caller's chats, newest activity first,
// each with the other participant and an unread count.
route.get('/conversations', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);

  const rows = await db
    .select()
    .from(conversations)
    .where(or(eq(conversations.a_user_id, me.userId), eq(conversations.b_user_id, me.userId)))
    .orderBy(desc(conversations.last_message_at))
    .all();

  const otherIds = rows.map((r) => (r.a_user_id === me.userId ? r.b_user_id : r.a_user_id));
  const profiles = otherIds.length
    ? await db.select().from(userProfiles).where(inArray(userProfiles.user_id, otherIds)).all()
    : [];
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  // One query for all my unread messages, tallied per conversation.
  const unreadByConv = new Map<string, number>();
  if (rows.length) {
    const unread = await db
      .select({ cid: directMessages.conversation_id })
      .from(directMessages)
      .where(
        and(
          inArray(directMessages.conversation_id, rows.map((r) => r.id)),
          ne(directMessages.sender_user_id, me.userId),
          isNull(directMessages.read_at),
        ),
      )
      .all();
    for (const u of unread) unreadByConv.set(u.cid, (unreadByConv.get(u.cid) ?? 0) + 1);
  }

  const conversationsOut = rows.map((r) => {
    const otherId = r.a_user_id === me.userId ? r.b_user_id : r.a_user_id;
    const other = profileByUser.get(otherId);
    return {
      id: r.id,
      other: other
        ? toContact(other)
        : { user_id: otherId, name: 'User', role: null, profile_photo_url: null },
      last_message_at: r.last_message_at,
      last_message_preview: r.last_message_preview,
      unread: unreadByConv.get(r.id) ?? 0,
    };
  });

  return c.json({ conversations: conversationsOut });
});

// POST /api/messages/conversations — find or create a 1:1 conversation with a user.
route.post('/conversations', async (c) => {
  const me = c.get('principal');
  const body = (await c.req.json().catch(() => null)) as { user_id?: string } | null;
  const targetId = body?.user_id?.trim();
  if (!targetId) return c.json({ error: 'user_id_required' }, 400);
  if (targetId === me.userId) return c.json({ error: 'cannot_message_self' }, 400);

  const db = drizzle(c.env.DB);
  const target = (
    await db.select().from(userProfiles).where(eq(userProfiles.user_id, targetId)).limit(1)
  )[0];
  if (!target || !isAppRole(target.role)) return c.json({ error: 'user_not_found' }, 404);

  // Authorization: hub-and-spoke (invariants 1 & 2).
  if (!canStartConversation(me, target.role)) return c.json({ error: 'forbidden' }, 403);

  const key = pairKey(me.userId, targetId);
  const existing = (
    await db.select().from(conversations).where(eq(conversations.pair_key, key)).limit(1)
  )[0];
  if (existing) {
    return c.json({ conversation: { id: existing.id, other: toContact(target) } });
  }

  // Deterministic participant order (matches pairKey) so a_user_id/b_user_id are
  // stable and definitely strings.
  const a = me.userId < targetId ? me.userId : targetId;
  const b = me.userId < targetId ? targetId : me.userId;
  const created = (
    await db.insert(conversations).values({ pair_key: key, a_user_id: a, b_user_id: b }).returning()
  )[0];
  if (!created) return c.json({ error: 'create_failed' }, 500);
  return c.json({ conversation: { id: created.id, other: toContact(target) } }, 201);
});

// Load a conversation the caller participates in, or return the HTTP error.
async function loadOwnedConversation(c: Context<AppEnv>) {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  if (!id) return { error: c.json({ error: 'not_found' }, 404) } as const;
  const convo = (
    await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  )[0];
  if (!convo) return { error: c.json({ error: 'not_found' }, 404) } as const;
  if (!isConversationParticipant(me, convo)) return { error: c.json({ error: 'forbidden' }, 403) } as const;
  return { convo, db, me } as const;
}

// GET /api/messages/conversations/:id/messages — messages oldest→newest. Marks
// the other party's messages as read for the caller.
route.get('/conversations/:id/messages', async (c) => {
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, db, me } = loaded;

  const msgs = await db
    .select()
    .from(directMessages)
    .where(eq(directMessages.conversation_id, convo.id))
    .orderBy(asc(directMessages.created_at))
    .all();

  // Mark incoming messages read (drives unread badges for the other endpoints).
  await db
    .update(directMessages)
    .set({ read_at: new Date().toISOString() })
    .where(
      and(
        eq(directMessages.conversation_id, convo.id),
        ne(directMessages.sender_user_id, me.userId),
        isNull(directMessages.read_at),
      ),
    );

  return c.json({
    messages: msgs.map((m) => ({
      id: m.id,
      sender_user_id: m.sender_user_id,
      body: m.body,
      read_at: m.read_at,
      created_at: m.created_at,
      mine: m.sender_user_id === me.userId,
    })),
  });
});

// POST /api/messages/conversations/:id/messages — send a message.
route.post('/conversations/:id/messages', async (c) => {
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, db, me } = loaded;

  const body = (await c.req.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim();
  if (!text) return c.json({ error: 'empty_message' }, 400);
  if (text.length > 4000) return c.json({ error: 'message_too_long' }, 400);

  const now = new Date().toISOString();
  const created = (
    await db
      .insert(directMessages)
      .values({ conversation_id: convo.id, sender_user_id: me.userId, body: text })
      .returning()
  )[0];
  if (!created) return c.json({ error: 'send_failed' }, 500);

  await db
    .update(conversations)
    .set({ last_message_at: now, last_message_preview: text.slice(0, 140), updated_at: new Date() })
    .where(eq(conversations.id, convo.id));

  return c.json(
    {
      message: {
        id: created.id,
        sender_user_id: created.sender_user_id,
        body: created.body,
        read_at: created.read_at,
        created_at: created.created_at,
        mine: true,
      },
    },
    201,
  );
});

export default route;
